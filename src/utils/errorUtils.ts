import { ApiError } from '../types/api';
import { ApiErrorHandler } from '../services/api/errorHandler';

export class ErrorUtils {
  private static errorHandler = new ApiErrorHandler();
  private static errorLog: ApiError[] = [];
  private static readonly MAX_ERROR_LOG_SIZE = 100;

  /**
   * エラーを統一的に処理し、ユーザーフレンドリーなメッセージを返す
   */
  public static handleError(error: any, context?: string): {
    apiError: ApiError;
    userMessage: string;
    shouldRetry: boolean;
  } {
    const apiError = this.errorHandler.handleError(error);
    
    // エラーログに追加
    this.addToErrorLog(apiError, context);
    
    return {
      apiError,
      userMessage: this.errorHandler.formatUserFriendlyMessage(apiError),
      shouldRetry: this.errorHandler.isRetryableError(apiError),
    };
  }

  /**
   * エラー情報をログに追加
   */
  private static addToErrorLog(apiError: ApiError, context?: string): void {
    const logEntry: ApiError = {
      ...apiError,
      details: {
        ...apiError.details,
        context,
      },
    };

    this.errorLog.push(logEntry);
    
    // ログサイズの制限
    if (this.errorLog.length > this.MAX_ERROR_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(-this.MAX_ERROR_LOG_SIZE);
    }
  }

  /**
   * エラーログの要約を取得
   */
  public static getErrorSummary(): {
    total: number;
    byType: Record<string, number>;
    byContext: Record<string, number>;
    recentErrors: ApiError[];
  } {
    const summary = this.errorHandler.createErrorSummary(this.errorLog);
    
    // コンテキスト別の集計を追加
    const byContext: Record<string, number> = {};
    this.errorLog.forEach(error => {
      const context = error.details?.context || 'unknown';
      byContext[context] = (byContext[context] || 0) + 1;
    });

    return {
      ...summary,
      byContext,
    };
  }

  /**
   * リトライ可能かどうかを判定
   */
  public static shouldRetry(error: ApiError, attemptNumber: number, maxRetries: number = 3): boolean {
    if (attemptNumber >= maxRetries) {
      return false;
    }
    
    return this.errorHandler.isRetryableError(error);
  }

  /**
   * リトライ遅延時間を計算
   */
  public static getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
    return this.errorHandler.getRetryDelay(attemptNumber, baseDelay);
  }

  /**
   * 認証エラーかどうかを判定
   */
  public static isAuthError(error: ApiError): boolean {
    return error.status === 401 || error.status === 403;
  }

  /**
   * ネットワークエラーかどうかを判定
   */
  public static isNetworkError(error: ApiError): boolean {
    return error.type === 'network' || error.type === 'timeout';
  }

  /**
   * バリデーションエラーかどうかを判定
   */
  public static isValidationError(error: ApiError): boolean {
    return error.status === 400 || error.status === 422;
  }

  /**
   * サーバーエラーかどうかを判定
   */
  public static isServerError(error: ApiError): boolean {
    return error.status ? error.status >= 500 && error.status < 600 : false;
  }

  /**
   * エラーログをクリア
   */
  public static clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * 特定期間のエラーログを取得
   */
  public static getErrorsInTimeRange(startTime: Date, endTime: Date): ApiError[] {
    return this.errorLog.filter(error => {
      const errorTime = new Date(error.timestamp);
      return errorTime >= startTime && errorTime <= endTime;
    });
  }

  /**
   * エラー頻度を計算（過去1時間のエラー数）
   */
  public static getErrorFrequency(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();
    return this.getErrorsInTimeRange(oneHourAgo, now).length;
  }

  /**
   * エラーメッセージの多言語対応
   */
  public static getLocalizedErrorMessage(error: ApiError, locale: string = 'ja'): string {
    if (locale === 'ja') {
      return this.errorHandler.formatUserFriendlyMessage(error);
    }

    // 英語などの他言語対応（将来の拡張用）
    switch (error.type) {
      case 'network':
        return 'Network connection problem. Please check your internet connection.';
      case 'timeout':
        return 'Request timed out. Please try again after a while.';
      case 'http':
        if (error.status === 400) return 'Invalid request. Please check your input.';
        if (error.status === 401) return 'Authentication required. Please login again.';
        if (error.status === 403) return 'You do not have permission to perform this action.';
        if (error.status === 404) return 'The requested resource was not found.';
        if (error.status === 429) return 'Too many requests. Please try again after a while.';
        if (error.status && error.status >= 500) return 'Server error. Please try again later.';
        return `Server error occurred (${error.status})`;
      case 'parse':
        return 'Error occurred while parsing response.';
      default:
        return 'An unexpected error occurred.';
    }
  }
}