import { ApiError } from '../../types/api';
import { FeatureFlagsManager } from '../featureFlags';

export class ApiErrorHandler {
  private featureFlags: FeatureFlagsManager;

  constructor() {
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public handleError(error: any): ApiError {
    const timestamp = new Date().toISOString();
    const errorType = this.classifyError(error);
    
    const apiError: ApiError = {
      message: this.extractErrorMessage(error),
      code: this.extractErrorCode(error),
      status: this.extractHttpStatus(error),
      type: errorType,
      details: this.extractErrorDetails(error),
      timestamp,
    };

    if (this.featureFlags.isDebugModeEnabled()) {
      this.logError(apiError, error);
    }

    return apiError;
  }

  private classifyError(error: any): ApiError['type'] {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'timeout';
    }
    
    if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK' || !error.response) {
      return 'network';
    }
    
    if (error.response) {
      return 'http';
    }
    
    if (error.name === 'SyntaxError' || error.message?.includes('JSON')) {
      return 'parse';
    }
    
    return 'unknown';
  }

  private extractErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error.message) {
      return error.message;
    }
    
    if (error.response?.statusText) {
      return error.response.statusText;
    }
    
    return 'An unknown error occurred';
  }

  private extractErrorCode(error: any): string | undefined {
    return error.response?.data?.code || error.code;
  }

  private extractHttpStatus(error: any): number | undefined {
    return error.response?.status;
  }

  private extractErrorDetails(error: any): any {
    if (error.response?.data) {
      return {
        data: error.response.data,
        headers: error.response.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        },
      };
    }
    
    return {
      originalError: error.message,
      code: error.code,
      name: error.name,
    };
  }

  private logError(apiError: ApiError, originalError: any): void {
    console.group('🚨 API Error Handler');
    console.error('Classified Error:', apiError);
    console.error('Original Error:', originalError);
    console.groupEnd();
  }

  public isRetryableError(error: ApiError): boolean {
    if (error.type === 'network' || error.type === 'timeout') {
      return true;
    }
    
    if (error.type === 'http' && error.status) {
      return error.status >= 500 && error.status < 600;
    }
    
    return false;
  }

  public getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
    return baseDelay * Math.pow(2, attemptNumber - 1);
  }

  public formatUserFriendlyMessage(error: ApiError): string {
    switch (error.type) {
      case 'network':
        return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
      case 'timeout':
        return 'リクエストがタイムアウトしました。しばらく待ってから再試行してください。';
      case 'http':
        if (error.status === 400) {
          return 'リクエストが無効です。入力内容を確認してください。';
        }
        if (error.status === 401) {
          return '認証が必要です。再度ログインしてください。';
        }
        if (error.status === 403) {
          return 'この操作を実行する権限がありません。';
        }
        if (error.status === 404) {
          return '要求されたリソースが見つかりません。';
        }
        if (error.status === 429) {
          return 'リクエストが多すぎます。しばらく待ってから再試行してください。';
        }
        if (error.status && error.status >= 500) {
          return 'サーバーに問題が発生しています。しばらく待ってから再試行してください。';
        }
        return `サーバーエラーが発生しました (${error.status})`;
      case 'parse':
        return 'レスポンスの解析中にエラーが発生しました。';
      default:
        return '予期しないエラーが発生しました。';
    }
  }

  public createErrorSummary(errors: ApiError[]): {
    total: number;
    byType: Record<string, number>;
    recentErrors: ApiError[];
  } {
    const summary = {
      total: errors.length,
      byType: {} as Record<string, number>,
      recentErrors: errors.slice(-5),
    };

    errors.forEach(error => {
      summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
    });

    return summary;
  }
}