import { JWTAuthService } from './JWTAuthService';
import { AuthErrorHandler, ErrorAction } from './AuthErrorHandler';
import { LogoutManager } from './LogoutManager';
import { AutoLoginManager } from './AutoLoginManager';

export interface RecoveryOption {
  type: 'retry' | 'fallback' | 'reset' | 'contact' | 'logout' | 'refresh';
  label: string;
  description: string;
  action: () => Promise<boolean>;
  severity: 'low' | 'medium' | 'high';
  estimatedTime?: string;
  requiresUserAction?: boolean;
}

export interface RecoveryConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableAutoRecovery: boolean;
  enableFallbackAuth: boolean;
  supportContactInfo: string;
}

export interface RecoveryResult {
  success: boolean;
  method: string;
  attempts: number;
  error?: string;
  nextSteps?: string[];
}

export class ErrorRecoveryService {
  private authService: JWTAuthService;
  private errorHandler: AuthErrorHandler;
  private logoutManager: LogoutManager;
  private autoLoginManager: AutoLoginManager;
  private config: RecoveryConfig;
  private retryAttempts: Map<string, number> = new Map();

  constructor(
    config: Partial<RecoveryConfig> = {},
    authService?: JWTAuthService,
    errorHandler?: AuthErrorHandler,
    logoutManager?: LogoutManager,
    autoLoginManager?: AutoLoginManager
  ) {
    this.config = {
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableAutoRecovery: true,
      enableFallbackAuth: true,
      supportContactInfo: 'support@mamaspace.app',
      ...config,
    };

    this.authService = authService || new JWTAuthService();
    this.errorHandler = errorHandler || new AuthErrorHandler();
    this.logoutManager = logoutManager || new LogoutManager();
    this.autoLoginManager = autoLoginManager || new AutoLoginManager();
  }

  async getRecoveryOptions(error: Error): Promise<RecoveryOption[]> {
    console.log('Generating recovery options for error:', error.message);

    const options: RecoveryOption[] = [];
    const errorType = this.categorizeError(error);

    switch (errorType) {
      case 'network':
        options.push(
          await this.createRetryOption(error),
          await this.createOfflineModeOption(),
          await this.createContactOption()
        );
        break;

      case 'token_expired':
        options.push(
          await this.createRefreshTokenOption(),
          await this.createReloginOption(),
          await this.createContactOption()
        );
        break;

      case 'token_invalid':
        options.push(
          await this.createReloginOption(),
          await this.createResetOption(),
          await this.createContactOption()
        );
        break;

      case 'biometric':
        options.push(
          await this.createRetryBiometricOption(),
          await this.createFallbackAuthOption(),
          await this.createBiometricSetupOption(),
          await this.createContactOption()
        );
        break;

      case 'permission':
        options.push(
          await this.createPermissionRequestOption(),
          await this.createLogoutOption(),
          await this.createContactOption()
        );
        break;

      case 'storage':
        options.push(
          await this.createRetryOption(error),
          await this.createClearCacheOption(),
          await this.createResetOption(),
          await this.createContactOption()
        );
        break;

      default:
        options.push(
          await this.createRetryOption(error),
          await this.createResetOption(),
          await this.createContactOption()
        );
        break;
    }

    return options.filter(option => option !== null);
  }

  async executeRecovery(option: RecoveryOption): Promise<boolean> {
    console.log(`Executing recovery option: ${option.type} - ${option.label}`);

    try {
      const result = await option.action();
      
      if (result) {
        console.log(`Recovery successful: ${option.type}`);
        this.resetRetryAttempts(option.type);
      } else {
        console.log(`Recovery failed: ${option.type}`);
        this.incrementRetryAttempts(option.type);
      }

      return result;
    } catch (error) {
      console.error(`Recovery execution error for ${option.type}:`, error);
      this.incrementRetryAttempts(option.type);
      return false;
    }
  }

  async attemptAutoRecovery(error: Error): Promise<RecoveryResult> {
    if (!this.config.enableAutoRecovery) {
      return {
        success: false,
        method: 'none',
        attempts: 0,
        error: 'Auto recovery disabled',
      };
    }

    const errorType = this.categorizeError(error);
    const attempts = this.getRetryAttempts(errorType);

    if (attempts >= this.config.maxRetryAttempts) {
      return {
        success: false,
        method: errorType,
        attempts,
        error: 'Max retry attempts exceeded',
        nextSteps: ['manual_recovery', 'contact_support'],
      };
    }

    console.log(`Attempting auto recovery for ${errorType}, attempt ${attempts + 1}`);

    try {
      let recoverySuccess = false;

      switch (errorType) {
        case 'token_expired':
          recoverySuccess = await this.autoRecoverTokenExpired();
          break;

        case 'network':
          recoverySuccess = await this.autoRecoverNetwork();
          break;

        case 'biometric':
          recoverySuccess = await this.autoRecoverBiometric();
          break;

        case 'storage':
          recoverySuccess = await this.autoRecoverStorage();
          break;

        default:
          recoverySuccess = await this.autoRecoverGeneric(error);
          break;
      }

      const newAttempts = this.incrementRetryAttempts(errorType);

      if (recoverySuccess) {
        this.resetRetryAttempts(errorType);
        return {
          success: true,
          method: errorType,
          attempts: newAttempts,
        };
      }

      return {
        success: false,
        method: errorType,
        attempts: newAttempts,
        error: 'Auto recovery failed',
      };

    } catch (recoveryError) {
      const newAttempts = this.incrementRetryAttempts(errorType);
      return {
        success: false,
        method: errorType,
        attempts: newAttempts,
        error: `Auto recovery error: ${recoveryError.message}`,
      };
    }
  }

  private async createRetryOption(error: Error): Promise<RecoveryOption> {
    const errorType = this.categorizeError(error);
    const attempts = this.getRetryAttempts(errorType);

    return {
      type: 'retry',
      label: '再試行',
      description: `操作を再試行します (${attempts + 1}/${this.config.maxRetryAttempts})`,
      action: async () => {
        await this.delay(this.config.retryDelayMs);
        // 実際の再試行ロジックはコンテキストに依存
        return true;
      },
      severity: 'low',
      estimatedTime: '数秒',
    };
  }

  private async createRefreshTokenOption(): Promise<RecoveryOption> {
    return {
      type: 'refresh',
      label: 'トークン更新',
      description: '認証トークンを更新します',
      action: async () => {
        try {
          await this.authService.refreshToken();
          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          return false;
        }
      },
      severity: 'medium',
      estimatedTime: '数秒',
    };
  }

  private async createFallbackAuthOption(): Promise<RecoveryOption> {
    return {
      type: 'fallback',
      label: 'パスワード認証',
      description: '生体認証の代わりにパスワードで認証します',
      action: async () => {
        try {
          // パスワード認証フォールバックの実装
          console.log('Switching to password authentication...');
          return true;
        } catch (error) {
          console.error('Fallback auth failed:', error);
          return false;
        }
      },
      severity: 'low',
      estimatedTime: '1分',
      requiresUserAction: true,
    };
  }

  private async createResetOption(): Promise<RecoveryOption> {
    return {
      type: 'reset',
      label: 'データリセット',
      description: '認証データをリセットして再設定します',
      action: async () => {
        try {
          await this.logoutManager.forceLogout('data_reset');
          return true;
        } catch (error) {
          console.error('Reset failed:', error);
          return false;
        }
      },
      severity: 'high',
      estimatedTime: '2-3分',
      requiresUserAction: true,
    };
  }

  private async createContactOption(): Promise<RecoveryOption> {
    return {
      type: 'contact',
      label: 'サポートに連絡',
      description: 'カスタマーサポートに問題を報告します',
      action: async () => {
        try {
          console.log(`Opening support contact: ${this.config.supportContactInfo}`);
          // 実際の実装では、メールアプリやサポートフォームを開く
          return true;
        } catch (error) {
          console.error('Contact support failed:', error);
          return false;
        }
      },
      severity: 'low',
      estimatedTime: '5-10分',
      requiresUserAction: true,
    };
  }

  private async createLogoutOption(): Promise<RecoveryOption> {
    return {
      type: 'logout',
      label: 'ログアウト',
      description: '安全にログアウトして認証をリセットします',
      action: async () => {
        try {
          const result = await this.logoutManager.logout('user', {
            reason: 'error_recovery',
          });
          return result.success;
        } catch (error) {
          console.error('Logout failed:', error);
          return false;
        }
      },
      severity: 'medium',
      estimatedTime: '30秒',
    };
  }

  private async createReloginOption(): Promise<RecoveryOption> {
    return {
      type: 'fallback',
      label: '再ログイン',
      description: '新しいセッションでログインし直します',
      action: async () => {
        try {
          await this.logoutManager.forceLogout('relogin');
          // ログイン画面へのナビゲーションは上位レイヤーで処理
          return true;
        } catch (error) {
          console.error('Relogin preparation failed:', error);
          return false;
        }
      },
      severity: 'medium',
      estimatedTime: '1-2分',
      requiresUserAction: true,
    };
  }

  private async createOfflineModeOption(): Promise<RecoveryOption> {
    return {
      type: 'fallback',
      label: 'オフラインモード',
      description: 'ネットワーク接続なしで利用できる機能を使用します',
      action: async () => {
        try {
          console.log('Switching to offline mode...');
          // オフラインモードの有効化
          return true;
        } catch (error) {
          console.error('Offline mode failed:', error);
          return false;
        }
      },
      severity: 'low',
      estimatedTime: '即座',
    };
  }

  private async createRetryBiometricOption(): Promise<RecoveryOption> {
    return {
      type: 'retry',
      label: '生体認証を再試行',
      description: '生体認証を再度実行します',
      action: async () => {
        try {
          const result = await this.authService.authenticateWithBiometric();
          return result.success;
        } catch (error) {
          console.error('Biometric retry failed:', error);
          return false;
        }
      },
      severity: 'low',
      estimatedTime: '30秒',
      requiresUserAction: true,
    };
  }

  private async createBiometricSetupOption(): Promise<RecoveryOption> {
    return {
      type: 'fallback',
      label: '生体認証設定',
      description: '端末の生体認証設定を確認・修正します',
      action: async () => {
        try {
          console.log('Opening biometric settings...');
          // 設定画面への誘導
          return true;
        } catch (error) {
          console.error('Biometric setup failed:', error);
          return false;
        }
      },
      severity: 'medium',
      estimatedTime: '2-3分',
      requiresUserAction: true,
    };
  }

  private async createPermissionRequestOption(): Promise<RecoveryOption> {
    return {
      type: 'retry',
      label: '権限を要求',
      description: '必要な権限を再度要求します',
      action: async () => {
        try {
          console.log('Requesting permissions...');
          // 権限要求の実装
          return true;
        } catch (error) {
          console.error('Permission request failed:', error);
          return false;
        }
      },
      severity: 'medium',
      estimatedTime: '1分',
      requiresUserAction: true,
    };
  }

  private async createClearCacheOption(): Promise<RecoveryOption> {
    return {
      type: 'reset',
      label: 'キャッシュクリア',
      description: 'アプリのキャッシュデータをクリアします',
      action: async () => {
        try {
          console.log('Clearing cache...');
          // キャッシュクリアの実装
          return true;
        } catch (error) {
          console.error('Cache clear failed:', error);
          return false;
        }
      },
      severity: 'medium',
      estimatedTime: '30秒',
    };
  }

  // 自動復旧メソッド
  private async autoRecoverTokenExpired(): Promise<boolean> {
    try {
      await this.authService.refreshToken();
      return true;
    } catch (error) {
      console.error('Auto token refresh failed:', error);
      return false;
    }
  }

  private async autoRecoverNetwork(): Promise<boolean> {
    // ネットワーク復旧の待機
    await this.delay(this.config.retryDelayMs);
    return true; // 次回のリクエストで確認
  }

  private async autoRecoverBiometric(): Promise<boolean> {
    // 生体認証の自動復旧は通常行わない（ユーザーアクションが必要）
    return false;
  }

  private async autoRecoverStorage(): Promise<boolean> {
    try {
      // ストレージエラーの場合、キャッシュクリアを試行
      console.log('Auto recovering storage error...');
      return true;
    } catch (error) {
      console.error('Auto storage recovery failed:', error);
      return false;
    }
  }

  private async autoRecoverGeneric(error: Error): Promise<boolean> {
    // 一般的なエラーの場合、単純な待機
    await this.delay(this.config.retryDelayMs);
    return false;
  }

  // ユーティリティメソッド
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('token expired') || message.includes('expired')) {
      return 'token_expired';
    }
    if (message.includes('token invalid') || message.includes('unauthorized')) {
      return 'token_invalid';
    }
    if (message.includes('biometric') || message.includes('touchid') || message.includes('faceid')) {
      return 'biometric';
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'permission';
    }
    if (message.includes('storage') || message.includes('save') || message.includes('read')) {
      return 'storage';
    }

    return 'generic';
  }

  private getRetryAttempts(errorType: string): number {
    return this.retryAttempts.get(errorType) || 0;
  }

  private incrementRetryAttempts(errorType: string): number {
    const current = this.getRetryAttempts(errorType);
    const newCount = current + 1;
    this.retryAttempts.set(errorType, newCount);
    return newCount;
  }

  private resetRetryAttempts(errorType: string): void {
    this.retryAttempts.delete(errorType);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 設定の更新
  updateConfig(config: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 再試行カウンターのリセット
  clearRetryAttempts(): void {
    this.retryAttempts.clear();
  }
}