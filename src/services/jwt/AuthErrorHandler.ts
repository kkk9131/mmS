import { JWTAuthError } from './types';

export interface ErrorConfig {
  showUserFriendlyMessages: boolean;
  enableRetry: boolean;
  maxRetryAttempts: number;
  supportContactInfo: string;
  logErrors: boolean;
  enableTelemetry: boolean;
}

export interface ErrorHandlingResult {
  handled: boolean;
  userMessage: string;
  actions: ErrorAction[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  shouldLogout?: boolean;
  shouldRetry?: boolean;
}

export interface ErrorAction {
  label: string;
  action: () => Promise<void>;
  primary: boolean;
  destructive?: boolean;
}

export interface NetworkError extends Error {
  status?: number;
  code?: string;
  timeout?: boolean;
}

export interface BiometricError extends Error {
  type: 'not_available' | 'not_enabled' | 'failed' | 'cancelled' | 'lockout';
  fallbackAvailable?: boolean;
}

export class AuthErrorHandler {
  private config: ErrorConfig;

  constructor(config: Partial<ErrorConfig> = {}) {
    this.config = {
      showUserFriendlyMessages: true,
      enableRetry: true,
      maxRetryAttempts: 3,
      supportContactInfo: 'support@mamaspace.app',
      logErrors: true,
      enableTelemetry: false,
      ...config,
    };
  }

  handleAuthError(error: Error, context: string = 'authentication'): ErrorHandlingResult {
    console.log(`Handling auth error in context: ${context}`, error);

    if (this.config.logErrors) {
      this.logError(error, context);
    }

    // エラーの種類を判定
    if (error instanceof JWTAuthError) {
      return this.handleJWTError(error, context);
    }

    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error as NetworkError);
    }

    if (this.isBiometricError(error)) {
      return this.handleBiometricError(error as BiometricError);
    }

    // 一般的なエラー
    return this.handleGenericError(error, context);
  }

  handleNetworkError(error: NetworkError): ErrorHandlingResult {
    console.log('Handling network error:', error);

    const isTimeout = error.timeout || error.message.includes('timeout');
    const isOffline = error.message.includes('Network request failed') || 
                     error.message.includes('No internet connection');

    if (isOffline) {
      return {
        handled: true,
        userMessage: 'インターネット接続を確認してください。',
        actions: [
          {
            label: '再試行',
            action: async () => {
              // ネットワーク接続確認後に再試行
              console.log('Retrying after network check...');
            },
            primary: true,
          },
          {
            label: 'オフラインで続行',
            action: async () => {
              console.log('Continuing offline...');
            },
            primary: false,
          },
        ],
        severity: 'medium',
        shouldRetry: true,
      };
    }

    if (isTimeout) {
      return {
        handled: true,
        userMessage: 'サーバーとの通信がタイムアウトしました。',
        actions: [
          {
            label: '再試行',
            action: async () => {
              console.log('Retrying after timeout...');
            },
            primary: true,
          },
        ],
        severity: 'medium',
        shouldRetry: true,
      };
    }

    if (error.status === 401) {
      return {
        handled: true,
        userMessage: '認証の有効期限が切れました。再度ログインしてください。',
        actions: [
          {
            label: 'ログイン画面へ',
            action: async () => {
              console.log('Redirecting to login...');
            },
            primary: true,
          },
        ],
        severity: 'high',
        shouldLogout: true,
      };
    }

    if (error.status === 403) {
      return {
        handled: true,
        userMessage: 'この操作を実行する権限がありません。',
        actions: [
          {
            label: '戻る',
            action: async () => {
              console.log('Going back...');
            },
            primary: true,
          },
        ],
        severity: 'medium',
      };
    }

    if (error.status && error.status >= 500) {
      return {
        handled: true,
        userMessage: 'サーバーでエラーが発生しました。しばらく待ってから再試行してください。',
        actions: [
          {
            label: '再試行',
            action: async () => {
              console.log('Retrying server error...');
            },
            primary: true,
          },
          {
            label: 'サポートに連絡',
            action: async () => {
              console.log('Contacting support...');
            },
            primary: false,
          },
        ],
        severity: 'high',
        shouldRetry: true,
      };
    }

    return this.handleGenericError(error, 'network');
  }

  handleBiometricError(error: BiometricError): ErrorHandlingResult {
    console.log('Handling biometric error:', error);

    switch (error.type) {
      case 'not_available':
        return {
          handled: true,
          userMessage: 'この端末では生体認証がご利用いただけません。',
          actions: [
            {
              label: 'パスワードでログイン',
              action: async () => {
                console.log('Switching to password login...');
              },
              primary: true,
            },
          ],
          severity: 'low',
        };

      case 'not_enabled':
        return {
          handled: true,
          userMessage: '生体認証が無効になっています。設定から有効にしてください。',
          actions: [
            {
              label: '設定を開く',
              action: async () => {
                console.log('Opening biometric settings...');
              },
              primary: true,
            },
            {
              label: 'パスワードでログイン',
              action: async () => {
                console.log('Switching to password login...');
              },
              primary: false,
            },
          ],
          severity: 'low',
        };

      case 'failed':
        return {
          handled: true,
          userMessage: '生体認証に失敗しました。もう一度お試しください。',
          actions: [
            {
              label: '再試行',
              action: async () => {
                console.log('Retrying biometric auth...');
              },
              primary: true,
            },
            ...(error.fallbackAvailable ? [{
              label: 'パスワードでログイン',
              action: async () => {
                console.log('Switching to password login...');
              },
              primary: false,
            }] : []),
          ],
          severity: 'medium',
          shouldRetry: true,
        };

      case 'cancelled':
        return {
          handled: true,
          userMessage: '生体認証がキャンセルされました。',
          actions: [
            {
              label: '再試行',
              action: async () => {
                console.log('Retrying biometric auth...');
              },
              primary: true,
            },
            {
              label: 'パスワードでログイン',
              action: async () => {
                console.log('Switching to password login...');
              },
              primary: false,
            },
          ],
          severity: 'low',
        };

      case 'lockout':
        return {
          handled: true,
          userMessage: '生体認証が一時的にロックされています。しばらく待ってから再試行してください。',
          actions: [
            {
              label: 'パスワードでログイン',
              action: async () => {
                console.log('Switching to password login...');
              },
              primary: true,
            },
          ],
          severity: 'medium',
        };

      default:
        return this.handleGenericError(error, 'biometric');
    }
  }

  handleTokenError(error: JWTAuthError): ErrorHandlingResult {
    console.log('Handling JWT token error:', error);

    switch (error.code) {
      case 'TOKEN_EXPIRED':
        return {
          handled: true,
          userMessage: 'セッションの有効期限が切れました。再度ログインしてください。',
          actions: [
            {
              label: 'ログイン画面へ',
              action: async () => {
                console.log('Redirecting to login...');
              },
              primary: true,
            },
          ],
          severity: 'medium',
          shouldLogout: true,
        };

      case 'TOKEN_INVALID':
        return {
          handled: true,
          userMessage: '認証情報が無効です。再度ログインしてください。',
          actions: [
            {
              label: 'ログイン画面へ',
              action: async () => {
                console.log('Redirecting to login...');
              },
              primary: true,
            },
          ],
          severity: 'high',
          shouldLogout: true,
        };

      case 'REFRESH_FAILED':
        return {
          handled: true,
          userMessage: 'セッションの更新に失敗しました。再度ログインしてください。',
          actions: [
            {
              label: 'ログイン画面へ',
              action: async () => {
                console.log('Redirecting to login...');
              },
              primary: true,
            },
          ],
          severity: 'medium',
          shouldLogout: true,
        };

      case 'STORAGE_ERROR':
        return {
          handled: true,
          userMessage: 'データの保存中にエラーが発生しました。',
          actions: [
            {
              label: '再試行',
              action: async () => {
                console.log('Retrying storage operation...');
              },
              primary: true,
            },
            {
              label: 'アプリを再起動',
              action: async () => {
                console.log('Suggesting app restart...');
              },
              primary: false,
            },
          ],
          severity: 'medium',
          shouldRetry: true,
        };

      case 'BIOMETRIC_ERROR':
        // 生体認証エラーとして処理
        const biometricError: BiometricError = {
          ...error,
          type: 'failed',
        };
        return this.handleBiometricError(biometricError);

      default:
        return this.handleGenericError(error, 'token');
    }
  }

  private handleJWTError(error: JWTAuthError, context: string): ErrorHandlingResult {
    return this.handleTokenError(error);
  }

  private handleGenericError(error: Error, context: string): ErrorHandlingResult {
    console.log(`Handling generic error in context: ${context}`, error);

    const userMessage = this.config.showUserFriendlyMessages
      ? this.generateUserMessage(error)
      : error.message;

    return {
      handled: true,
      userMessage,
      actions: this.generateErrorActions(error),
      severity: this.determineErrorSeverity(error),
      shouldRetry: this.shouldShowRetryOption(error),
    };
  }

  private generateUserMessage(error: Error): string {
    // よくあるエラーパターンに対するユーザーフレンドリーなメッセージ
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection')) {
      return 'ネットワーク接続を確認してください。';
    }

    if (message.includes('timeout')) {
      return '処理に時間がかかっています。しばらく待ってから再試行してください。';
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return '認証が必要です。ログインしてください。';
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return 'この操作を実行する権限がありません。';
    }

    if (message.includes('not found') || message.includes('404')) {
      return '要求されたリソースが見つかりません。';
    }

    if (message.includes('server') || message.includes('500')) {
      return 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
    }

    // デフォルトメッセージ
    return 'エラーが発生しました。しばらく待ってから再試行してください。';
  }

  private generateErrorActions(error: Error): ErrorAction[] {
    const actions: ErrorAction[] = [];

    // 再試行オプション
    if (this.shouldShowRetryOption(error)) {
      actions.push({
        label: '再試行',
        action: async () => {
          console.log('Retrying operation...');
        },
        primary: true,
      });
    }

    // サポート連絡オプション
    actions.push({
      label: 'サポートに連絡',
      action: async () => {
        console.log(`Contacting support: ${this.config.supportContactInfo}`);
      },
      primary: false,
    });

    return actions;
  }

  private shouldShowRetryOption(error: Error): boolean {
    if (!this.config.enableRetry) {
      return false;
    }

    // 再試行が意味のあるエラータイプかチェック
    const message = error.message.toLowerCase();
    
    // 再試行すべきでないエラー
    if (message.includes('unauthorized') || 
        message.includes('forbidden') ||
        message.includes('not found')) {
      return false;
    }

    return true;
  }

  private determineErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }

    if (message.includes('unauthorized') || 
        message.includes('security') ||
        message.includes('token')) {
      return 'high';
    }

    if (message.includes('network') || 
        message.includes('timeout') ||
        message.includes('server')) {
      return 'medium';
    }

    return 'low';
  }

  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('network') ||
           message.includes('fetch') ||
           message.includes('connection') ||
           message.includes('timeout') ||
           (error as any).status !== undefined;
  }

  private isBiometricError(error: Error): boolean {
    return error.message.includes('biometric') ||
           error.message.includes('touchid') ||
           error.message.includes('faceid') ||
           (error as any).type !== undefined;
  }

  private logError(error: Error, context: string): void {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      name: error.name,
    };

    console.error('Auth Error Log:', errorInfo);

    // 実際の実装では、ログサービスやエラー追跡サービスに送信
    if (this.config.enableTelemetry) {
      this.sendErrorTelemetry(errorInfo);
    }
  }

  private sendErrorTelemetry(errorInfo: any): void {
    // エラー追跡サービス（Sentry、Bugsnag等）への送信
    console.log('Sending error telemetry:', errorInfo);
  }

  // 設定の更新
  updateConfig(config: Partial<ErrorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}