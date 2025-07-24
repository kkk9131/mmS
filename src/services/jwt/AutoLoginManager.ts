import { JWTAuthService } from './JWTAuthService';
import { SessionRestoreService } from './SessionRestoreService';
import { BiometricAuthManager } from './BiometricAuthManager';
import { JWTUtils } from './JWTUtils';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoLoginConfig {
  enableBiometric: boolean;
  enableTokenRestore: boolean;
  maxRetryAttempts: number;
  timeoutMs: number;
}

export interface AutoLoginResult {
  success: boolean;
  method: 'token' | 'biometric' | 'none';
  user?: User;
  error?: string;
  requiresUserAction: boolean;
}

export class AutoLoginManager {
  private config: AutoLoginConfig;
  private jwtAuthService: JWTAuthService;
  private sessionRestoreService: SessionRestoreService;
  private biometricAuthManager: BiometricAuthManager;
  private isProcessing: boolean = false;

  constructor(
    config: AutoLoginConfig = {
      enableBiometric: true,
      enableTokenRestore: true,
      maxRetryAttempts: 3,
      timeoutMs: 30000,
    },
    jwtAuthService?: JWTAuthService,
    sessionRestoreService?: SessionRestoreService,
    biometricAuthManager?: BiometricAuthManager
  ) {
    this.config = config;
    this.jwtAuthService = jwtAuthService || new JWTAuthService();
    this.sessionRestoreService = sessionRestoreService || new SessionRestoreService(this.jwtAuthService);
    this.biometricAuthManager = biometricAuthManager || new BiometricAuthManager();
  }

  async attemptAutoLogin(): Promise<AutoLoginResult> {
    if (this.isProcessing) {
      return {
        success: false,
        method: 'none',
        error: 'Auto login already in progress',
        requiresUserAction: false,
      };
    }

    this.isProcessing = true;
    
    try {
      console.log('Attempting auto login...');

      // まずトークンベースの復元を試行
      if (this.config.enableTokenRestore) {
        const tokenResult = await this.restoreFromToken();
        if (tokenResult.success) {
          this.notifyAutoLoginResult(tokenResult);
          return tokenResult;
        }
      }

      // トークンが無効な場合、生体認証を試行
      if (this.config.enableBiometric) {
        const biometricResult = await this.restoreFromBiometric();
        if (biometricResult.success) {
          this.notifyAutoLoginResult(biometricResult);
          return biometricResult;
        }
      }

      // 両方とも失敗した場合
      const result: AutoLoginResult = {
        success: false,
        method: 'none',
        error: 'All auto login methods failed',
        requiresUserAction: true,
      };

      this.notifyAutoLoginResult(result);
      return result;

    } catch (error) {
      console.error('Auto login error:', error);
      return this.handleAutoLoginError(error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  async restoreFromToken(): Promise<AutoLoginResult> {
    try {
      console.log('Attempting token restoration...');

      // SessionRestoreServiceを使用してセッション復元を試行
      const sessionUser = await this.sessionRestoreService.restoreSession();
      if (!sessionUser) {
        return {
          success: false,
          method: 'token',
          error: 'No valid stored session found',
          requiresUserAction: true,
        };
      }

      // JWTトークンの存在確認
      const accessToken = await this.jwtAuthService.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          method: 'token',
          error: 'No access token found',
          requiresUserAction: true,
        };
      }

      // トークンの有効性を確認
      if (this.jwtAuthService.isTokenExpired(accessToken)) {
        console.log('Access token expired, attempting refresh...');
        
        try {
          await this.jwtAuthService.refreshToken();
          // リフレッシュ後、新しいトークンを取得
          const newAccessToken = await this.jwtAuthService.getAccessToken();
          if (!newAccessToken) {
            throw new Error('Failed to get token after refresh');
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          return {
            success: false,
            method: 'token',
            error: 'Token refresh failed',
            requiresUserAction: true,
          };
        }
      }

      // セッションデータを更新（最終アクティビティ時刻など）
      await this.sessionRestoreService.saveSessionData(sessionUser);

      console.log('Token restoration successful');
      return {
        success: true,
        method: 'token',
        user: sessionUser,
        requiresUserAction: false,
      };

    } catch (error) {
      console.error('Token restoration error:', error);
      return {
        success: false,
        method: 'token',
        error: `Token restoration failed: ${error.message}`,
        requiresUserAction: true,
      };
    }
  }

  async restoreFromBiometric(): Promise<AutoLoginResult> {
    try {
      console.log('Attempting biometric restoration...');

      // 生体認証が利用可能かチェック
      const isAvailable = await this.biometricAuthManager.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          method: 'biometric',
          error: 'Biometric authentication not available',
          requiresUserAction: true,
        };
      }

      // 生体認証が有効になっているかチェック
      const isEnabled = await this.biometricAuthManager.isEnabled();
      if (!isEnabled) {
        return {
          success: false,
          method: 'biometric',
          error: 'Biometric authentication not enabled',
          requiresUserAction: true,
        };
      }

      // 保存されたセッションから復元するためのユーザー情報を確認
      const sessionUser = await this.sessionRestoreService.restoreSession();
      if (!sessionUser) {
        return {
          success: false,
          method: 'biometric',
          error: 'No valid session found for biometric restore',
          requiresUserAction: true,
        };
      }

      // 生体認証を実行
      const authResult = await this.biometricAuthManager.authenticate(
        'アプリにアクセスするために認証してください',
        '認証をキャンセル',
        false // fallback無効（自動ログインではパスワード入力させない）
      );

      if (!authResult.success) {
        return {
          success: false,
          method: 'biometric',
          error: authResult.error || 'Biometric authentication failed',
          requiresUserAction: true,
        };
      }

      // 生体認証成功後、JWTトークンの検証と更新
      let accessToken = await this.jwtAuthService.getAccessToken();
      if (!accessToken || this.jwtAuthService.isTokenExpired(accessToken)) {
        try {
          // トークンリフレッシュを試行
          await this.jwtAuthService.refreshToken();
          accessToken = await this.jwtAuthService.getAccessToken();
          if (!accessToken) {
            // リフレッシュ失敗時は生体認証でログイン（モック）
            const mockTokens = this.jwtAuthService.createMockJWT(sessionUser.id);
            await this.jwtAuthService.storeTokens(mockTokens);
          }
        } catch (refreshError) {
          console.log('Token refresh failed, using biometric to re-authenticate');
          // 新しいトークンを生成（実際の実装ではAPIコール）
          const mockTokens = this.jwtAuthService.createMockJWT(sessionUser.id);
          await this.jwtAuthService.storeTokens(mockTokens);
        }
      }

      // セッションデータを更新
      await this.sessionRestoreService.saveSessionData(sessionUser);

      console.log('Biometric restoration successful');
      return {
        success: true,
        method: 'biometric',
        user: sessionUser,
        requiresUserAction: false,
      };

    } catch (error) {
      console.error('Biometric restoration error:', error);
      return {
        success: false,
        method: 'biometric',
        error: `Biometric restoration failed: ${error.message}`,
        requiresUserAction: true,
      };
    }
  }

  private async validateStoredSession(): Promise<boolean> {
    try {
      // SessionRestoreServiceを使用した包括的なセッション検証
      const sessionInfo = await this.sessionRestoreService.getSessionInfo();
      if (!sessionInfo) {
        console.log('No session info found');
        return false;
      }

      // セッションデータを使用してバリデーション
      return await this.sessionRestoreService.validateSession(sessionInfo);
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  private handleAutoLoginError(error: Error): AutoLoginResult {
    console.error('Auto login error:', error);
    
    return {
      success: false,
      method: 'none',
      error: `Auto login failed: ${error.message}`,
      requiresUserAction: true,
    };
  }

  private notifyAutoLoginResult(result: AutoLoginResult): void {
    // 自動ログイン結果の通知（イベント発火など）
    console.log('Auto login result:', {
      success: result.success,
      method: result.method,
      hasUser: !!result.user,
      error: result.error,
      requiresUserAction: result.requiresUserAction,
    });

    // 将来的にはEventEmitterやObserverパターンで通知
    // this.emit('autoLoginResult', result);
  }

  private async getCurrentUser(): Promise<User | null> {
    try {
      // モック実装：実際のAPIコールに置き換える
      const accessToken = await this.jwtAuthService.getAccessToken();
      if (!accessToken) {
        return null;
      }

      // JWTからユーザー情報を取得（簡易実装）
      const { payload } = JWTUtils.parseJWT(accessToken);
      if (!payload || !payload.sub) {
        return null;
      }

      // モックユーザーデータ
      const user: User = {
        id: payload.sub,
        email: payload.email || 'user@example.com',
        name: payload.name || 'ユーザー',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // 設定の更新
  updateConfig(config: Partial<AutoLoginConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 処理状態の確認
  isAutoLoginInProgress(): boolean {
    return this.isProcessing;
  }
}