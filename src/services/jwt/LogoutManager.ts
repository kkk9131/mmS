import { JWTAuthService } from './JWTAuthService';
import { SessionRestoreService } from './SessionRestoreService';
import { BiometricAuthManager } from './BiometricAuthManager';
import { Alert } from 'react-native';

export interface LogoutConfig {
  confirmationRequired: boolean;
  clearBiometric: boolean;
  clearAllSessions: boolean;
  redirectTo: string;
  enableGracefulLogout: boolean;
  timeoutMs: number;
}

export interface LogoutResult {
  success: boolean;
  method: 'user' | 'auto' | 'force';
  clearedData: string[];
  error?: string;
}

export interface LogoutOptions {
  skipConfirmation?: boolean;
  reason?: string;
  clearBiometric?: boolean;
}

export class LogoutManager {
  private config: LogoutConfig;
  private jwtAuthService: JWTAuthService;
  private sessionService: SessionRestoreService;
  private biometricManager: BiometricAuthManager;
  private logoutInProgress: boolean = false;

  constructor(
    config: Partial<LogoutConfig> = {},
    jwtAuthService?: JWTAuthService,
    sessionService?: SessionRestoreService,
    biometricManager?: BiometricAuthManager
  ) {
    this.config = {
      confirmationRequired: true,
      clearBiometric: true,
      clearAllSessions: true,
      redirectTo: '/login',
      enableGracefulLogout: true,
      timeoutMs: 10000, // 10秒
      ...config,
    };

    this.jwtAuthService = jwtAuthService || new JWTAuthService();
    this.sessionService = sessionService || new SessionRestoreService(this.jwtAuthService);
    this.biometricManager = biometricManager || new BiometricAuthManager();
  }

  async logout(
    method: 'user' | 'auto' | 'force' = 'user',
    options: LogoutOptions = {}
  ): Promise<LogoutResult> {
    if (this.logoutInProgress) {
      return {
        success: false,
        method,
        clearedData: [],
        error: 'Logout already in progress',
      };
    }

    this.logoutInProgress = true;

    try {
      console.log(`Starting ${method} logout...`);

      // 確認ダイアログの表示（必要な場合）
      if (this.shouldShowConfirmation(method, options)) {
        const confirmed = await this.showLogoutConfirmation(method, options.reason);
        if (!confirmed) {
          console.log('Logout cancelled by user');
          return {
            success: false,
            method,
            clearedData: [],
            error: 'Logout cancelled by user',
          };
        }
      }

      // 実際のログアウト処理
      const clearedData = await this.performLogout(options);

      const result: LogoutResult = {
        success: true,
        method,
        clearedData,
      };

      // ログアウト完了通知
      this.notifyLogoutComplete(result);

      console.log(`${method} logout completed successfully`);
      return result;

    } catch (error) {
      console.error('Logout error:', error);
      
      const result: LogoutResult = {
        success: false,
        method,
        clearedData: [],
        error: `Logout failed: ${error.message}`,
      };

      // エラーが発生した場合でも強制ログアウトを試行
      if (this.config.enableGracefulLogout) {
        try {
          const emergencyCleared = await this.emergencyLogout();
          result.clearedData = emergencyCleared;
          result.success = true;
          console.log('Emergency logout successful');
        } catch (emergencyError) {
          console.error('Emergency logout failed:', emergencyError);
        }
      }

      return result;

    } finally {
      this.logoutInProgress = false;
    }
  }

  async forceLogout(reason: string = 'security'): Promise<LogoutResult> {
    console.log(`Force logout initiated: ${reason}`);
    
    return this.logout('force', {
      skipConfirmation: true,
      reason,
      clearBiometric: true,
    });
  }

  private shouldShowConfirmation(method: string, options: LogoutOptions): boolean {
    // 強制ログアウトまたは確認スキップが指定されている場合は確認しない
    if (method === 'force' || options.skipConfirmation) {
      return false;
    }

    // 設定で確認が有効な場合
    return this.config.confirmationRequired;
  }

  private async showLogoutConfirmation(method: string, reason?: string): Promise<boolean> {
    return new Promise((resolve) => {
      const title = this.getConfirmationTitle(method);
      const message = this.getConfirmationMessage(method, reason);

      Alert.alert(
        title,
        message,
        [
          {
            text: 'キャンセル',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'ログアウト',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  private getConfirmationTitle(method: string): string {
    switch (method) {
      case 'auto':
        return 'セッション期限切れ';
      case 'force':
        return 'セキュリティログアウト';
      default:
        return 'ログアウト確認';
    }
  }

  private getConfirmationMessage(method: string, reason?: string): string {
    const baseMessage = 'ログアウトしますか？\n保存されていないデータは失われる可能性があります。';
    
    if (reason) {
      return `${reason}\n\n${baseMessage}`;
    }

    switch (method) {
      case 'auto':
        return 'セッションの有効期限が切れました。\n再度ログインが必要です。';
      case 'force':
        return 'セキュリティ上の理由により、強制的にログアウトします。';
      default:
        return baseMessage;
    }
  }

  private async performLogout(options: LogoutOptions): Promise<string[]> {
    const clearedData: string[] = [];

    try {
      // 1. セッションの無効化
      await this.sessionService.invalidateSession();
      clearedData.push('session');

      // 2. JWTトークンの削除
      await this.jwtAuthService.logout();
      clearedData.push('jwt_tokens');

      // 3. 生体認証設定のクリア（必要な場合）
      if (this.config.clearBiometric || options.clearBiometric) {
        try {
          await this.biometricManager.disable();
          clearedData.push('biometric_settings');
        } catch (bioError) {
          console.warn('Failed to clear biometric settings:', bioError);
        }
      }

      // 4. セッションデータのクリア
      await this.sessionService.clearSessionData();
      clearedData.push('session_data');

      // 5. その他のキャッシュデータのクリア
      await this.clearAdditionalData();
      clearedData.push('cache_data');

      console.log('Logout data cleared:', clearedData);
      return clearedData;

    } catch (error) {
      console.error('Error during logout data clearing:', error);
      throw error;
    }
  }

  private async emergencyLogout(): Promise<string[]> {
    console.log('Performing emergency logout...');
    const clearedData: string[] = [];

    try {
      // 最低限の必要なデータをクリア
      await this.jwtAuthService.clearTokens();
      clearedData.push('emergency_tokens');

      await this.sessionService.clearSessionData();
      clearedData.push('emergency_session');

      return clearedData;
    } catch (error) {
      console.error('Emergency logout failed:', error);
      throw error;
    }
  }

  private async clearAdditionalData(): Promise<void> {
    try {
      // その他のアプリ固有のデータをクリア
      // 例：ユーザー設定、キャッシュ、一時ファイルなど
      
      // AsyncStorageの特定キーをクリア
      const keysToRemove = [
        'user_preferences',
        'app_cache',
        'temp_data',
        'offline_queue',
      ];

      await Promise.all(
        keysToRemove.map(async (key) => {
          try {
            const AsyncStorage = await import('@react-native-async-storage/async-storage');
            await AsyncStorage.default.removeItem(key);
          } catch (error) {
            console.warn(`Failed to remove ${key}:`, error);
          }
        })
      );

    } catch (error) {
      console.warn('Failed to clear additional data:', error);
    }
  }

  private notifyLogoutComplete(result: LogoutResult): void {
    console.log('Logout completed:', {
      success: result.success,
      method: result.method,
      clearedDataCount: result.clearedData.length,
      error: result.error,
    });

    // 将来的にはEventEmitterやObserverパターンで通知
    // this.emit('logoutComplete', result);
  }

  // ログアウト状態の確認
  isLogoutInProgress(): boolean {
    return this.logoutInProgress;
  }

  // 設定の更新
  updateConfig(config: Partial<LogoutConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ログアウト前のデータ保存
  async saveImportantDataBeforeLogout(): Promise<boolean> {
    try {
      // 重要なデータを一時的に保存
      // 例：下書き投稿、設定変更など
      console.log('Saving important data before logout...');
      
      // 実装例：
      // - 下書き投稿をサーバーに保存
      // - ユーザー設定を同期
      // - 未送信データをキューに追加

      return true;
    } catch (error) {
      console.error('Failed to save important data:', error);
      return false;
    }
  }

  // 自動ログアウトの設定
  scheduleAutoLogout(delayMs: number, reason: string): ReturnType<typeof setTimeout> {
    console.log(`Auto logout scheduled in ${delayMs}ms: ${reason}`);
    
    return setTimeout(async () => {
      try {
        await this.logout('auto', { reason });
      } catch (error) {
        console.error('Scheduled auto logout failed:', error);
        await this.forceLogout('auto_logout_error');
      }
    }, delayMs);
  }

  // ログアウトタイマーのキャンセル
  cancelAutoLogout(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
    console.log('Auto logout cancelled');
  }
}