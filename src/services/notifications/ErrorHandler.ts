import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';

export enum NotificationErrorType {
  PERMISSION_DENIED = 'permission_denied',
  TOKEN_INVALID = 'token_invalid',
  NETWORK_ERROR = 'network_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  DEVICE_NOT_REGISTERED = 'device_not_registered',
  MESSAGE_TOO_BIG = 'message_too_big',
  INVALID_CREDENTIALS = 'invalid_credentials',
  INTERNAL_ERROR = 'internal_error',
  RATE_LIMITED = 'rate_limited',
  SERVICE_UNAVAILABLE = 'service_unavailable'
}

export interface NotificationError {
  type: NotificationErrorType;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;
  timestamp: string;
  userId?: string;
  notificationId?: string;
  stackTrace?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<NotificationErrorType, number>;
  retrySuccessRate: number;
  averageRetryDelay: number;
  lastError?: NotificationError;
}

class NotificationErrorHandler {
  private static instance: NotificationErrorHandler;
  private readonly ERROR_LOG_KEY = '@notification_errors';
  private readonly ERROR_STATS_KEY = '@notification_error_stats';
  private readonly MAX_ERROR_LOGS = 100;

  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  private readonly RETRY_CONFIGS: Record<NotificationErrorType, RetryConfig> = {
    [NotificationErrorType.PERMISSION_DENIED]: {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitter: false,
    },
    [NotificationErrorType.TOKEN_INVALID]: {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitter: false,
    },
    [NotificationErrorType.NETWORK_ERROR]: {
      maxAttempts: 5,
      baseDelay: 2000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitter: true,
    },
    [NotificationErrorType.QUOTA_EXCEEDED]: {
      maxAttempts: 3,
      baseDelay: 60000, // 1分
      maxDelay: 300000, // 5分
      backoffMultiplier: 2,
      jitter: true,
    },
    [NotificationErrorType.DEVICE_NOT_REGISTERED]: {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitter: false,
    },
    [NotificationErrorType.MESSAGE_TOO_BIG]: {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitter: false,
    },
    [NotificationErrorType.INVALID_CREDENTIALS]: {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitter: false,
    },
    [NotificationErrorType.INTERNAL_ERROR]: {
      maxAttempts: 3,
      baseDelay: 5000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
    },
    [NotificationErrorType.RATE_LIMITED]: {
      maxAttempts: 4,
      baseDelay: 10000,
      maxDelay: 120000,
      backoffMultiplier: 3,
      jitter: true,
    },
    [NotificationErrorType.SERVICE_UNAVAILABLE]: {
      maxAttempts: 4,
      baseDelay: 5000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitter: true,
    },
  };

  private fallbackHandlers: Map<NotificationErrorType, (error: NotificationError) => Promise<void>> = new Map();

  public static getInstance(): NotificationErrorHandler {
    if (!NotificationErrorHandler.instance) {
      NotificationErrorHandler.instance = new NotificationErrorHandler();
    }
    return NotificationErrorHandler.instance;
  }

  constructor() {
    this.initializeFallbackHandlers();
  }

  private initializeFallbackHandlers(): void {
    // 権限拒否時のフォールバック
    this.fallbackHandlers.set(NotificationErrorType.PERMISSION_DENIED, async (error) => {
      await this.showPermissionDialog();
    });

    // トークン無効時のフォールバック
    this.fallbackHandlers.set(NotificationErrorType.TOKEN_INVALID, async (error) => {
      await this.refreshPushToken(error.userId);
    });

    // デバイス未登録時のフォールバック
    this.fallbackHandlers.set(NotificationErrorType.DEVICE_NOT_REGISTERED, async (error) => {
      await this.reregisterDevice(error.userId);
    });

    // ネットワークエラー時のフォールバック
    this.fallbackHandlers.set(NotificationErrorType.NETWORK_ERROR, async (error) => {
      await this.storeForOfflineRetry(error);
    });

    // クォータ超過時のフォールバック
    this.fallbackHandlers.set(NotificationErrorType.QUOTA_EXCEEDED, async (error) => {
      await this.enableRateLimiting(error.userId);
    });
  }

  // メインのエラーハンドリング関数
  async handleError(
    error: Error,
    context: {
      userId?: string;
      notificationId?: string;
      operation: string;
      metadata?: any;
    }
  ): Promise<NotificationError> {
    try {
      // エラーを分類
      const notificationError = this.classifyError(error, context);
      
      // エラーログに記録
      await this.logError(notificationError);

      // 統計を更新
      await this.updateErrorStats(notificationError);

      // フォールバック処理を実行
      await this.executeFallback(notificationError);

      // Supabaseにエラーレポートを送信（デバッグモード時）
      if (__DEV__) {
        await this.reportErrorToSupabase(notificationError);
      }

      console.error('通知エラー処理完了:', notificationError);
      return notificationError;

    } catch (handlingError) {
      console.error('エラーハンドリング自体でエラー発生:', handlingError);
      
      // 最低限のエラー情報を返す
      return {
        type: NotificationErrorType.INTERNAL_ERROR,
        message: 'エラーハンドリング失敗',
        details: { originalError: error.message, handlingError: handlingError.message },
        retryable: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private classifyError(error: Error, context: any): NotificationError {
    const message = error.message.toLowerCase();
    const timestamp = new Date().toISOString();

    // エラーメッセージベースの分類
    if (message.includes('permission') || message.includes('denied')) {
      return {
        type: NotificationErrorType.PERMISSION_DENIED,
        message: 'プッシュ通知の権限が拒否されました',
        details: { originalMessage: error.message },
        retryable: false,
        timestamp,
        ...context,
      };
    }

    if (message.includes('token') || message.includes('invalid') || message.includes('malformed')) {
      return {
        type: NotificationErrorType.TOKEN_INVALID,
        message: 'プッシュトークンが無効です',
        details: { originalMessage: error.message },
        retryable: false,
        timestamp,
        ...context,
      };
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        type: NotificationErrorType.NETWORK_ERROR,
        message: 'ネットワークエラーが発生しました',
        details: { originalMessage: error.message },
        retryable: true,
        timestamp,
        ...context,
      };
    }

    if (message.includes('quota') || message.includes('limit') || message.includes('exceeded')) {
      return {
        type: NotificationErrorType.QUOTA_EXCEEDED,
        message: '送信制限に達しました',
        details: { originalMessage: error.message },
        retryable: true,
        retryAfter: 3600000, // 1時間後
        timestamp,
        ...context,
      };
    }

    if (message.includes('devicenotregistered') || message.includes('not registered')) {
      return {
        type: NotificationErrorType.DEVICE_NOT_REGISTERED,
        message: 'デバイスが登録されていません',
        details: { originalMessage: error.message },
        retryable: false,
        timestamp,
        ...context,
      };
    }

    if (message.includes('messagetoobig') || message.includes('too big')) {
      return {
        type: NotificationErrorType.MESSAGE_TOO_BIG,
        message: '通知メッセージが大きすぎます',
        details: { originalMessage: error.message },
        retryable: false,
        timestamp,
        ...context,
      };
    }

    if (message.includes('credentials') || message.includes('unauthorized')) {
      return {
        type: NotificationErrorType.INVALID_CREDENTIALS,
        message: '認証情報が無効です',
        details: { originalMessage: error.message },
        retryable: false,
        timestamp,
        ...context,
      };
    }

    if (message.includes('rate') || message.includes('limited')) {
      return {
        type: NotificationErrorType.RATE_LIMITED,
        message: 'レート制限に達しました',
        details: { originalMessage: error.message },
        retryable: true,
        retryAfter: 60000, // 1分後
        timestamp,
        ...context,
      };
    }

    if (message.includes('service') || message.includes('unavailable') || message.includes('503')) {
      return {
        type: NotificationErrorType.SERVICE_UNAVAILABLE,
        message: 'サービスが利用できません',
        details: { originalMessage: error.message },
        retryable: true,
        timestamp,
        ...context,
      };
    }

    // デフォルトは内部エラー
    return {
      type: NotificationErrorType.INTERNAL_ERROR,
      message: '内部エラーが発生しました',
      details: { originalMessage: error.message },
      retryable: true,
      timestamp,
      stackTrace: error.stack,
      ...context,
    };
  }

  // 指数バックオフによる再試行
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      userId?: string;
      notificationId?: string;
      operationName: string;
    },
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.DEFAULT_RETRY_CONFIG, ...customRetryConfig };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const notificationError = await this.handleError(lastError, {
          ...context,
          operation: `${context.operationName} (試行 ${attempt}/${config.maxAttempts})`,
        });

        // 再試行不可能なエラーの場合は即座にスロー
        if (!notificationError.retryable) {
          throw error;
        }

        // 最後の試行の場合はスロー
        if (attempt === config.maxAttempts) {
          throw error;
        }

        // 再試行までの待機時間を計算
        const delay = this.calculateRetryDelay(attempt, config, notificationError);
        console.log(`再試行まで${delay}ms待機 (試行 ${attempt}/${config.maxAttempts})`);
        
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private calculateRetryDelay(attempt: number, config: RetryConfig, error: NotificationError): number {
    // エラータイプ別の設定を取得
    const typeConfig = this.RETRY_CONFIGS[error.type] || config;
    
    // retryAfterが指定されている場合はそれを使用
    if (error.retryAfter) {
      return error.retryAfter;
    }

    // 指数バックオフ計算
    let delay = Math.min(
      typeConfig.baseDelay * Math.pow(typeConfig.backoffMultiplier, attempt - 1),
      typeConfig.maxDelay
    );

    // ジッターを追加（複数のクライアントが同時に再試行するのを避ける）
    if (typeConfig.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // フォールバック処理の実行
  private async executeFallback(error: NotificationError): Promise<void> {
    const handler = this.fallbackHandlers.get(error.type);
    if (handler) {
      try {
        await handler(error);
      } catch (fallbackError) {
        console.error('フォールバック処理エラー:', fallbackError);
      }
    }
  }

  // フォールバック処理の実装

  private async showPermissionDialog(): Promise<void> {
    // React Native Alertまたはカスタムモーダルを表示
    console.log('権限設定ダイアログ表示をリクエスト');
  }

  private async refreshPushToken(userId?: string): Promise<void> {
    if (!userId) return;

    try {
      const { pushTokenManager } = await import('./PushTokenManager');
      const newToken = await pushTokenManager.getExpoPushToken();
      await pushTokenManager.updateToken(userId, newToken);
      console.log('プッシュトークンを更新しました');
    } catch (error) {
      console.error('プッシュトークン更新失敗:', error);
    }
  }

  private async reregisterDevice(userId?: string): Promise<void> {
    if (!userId) return;

    try {
      const { pushTokenManager } = await import('./PushTokenManager');
      const token = await pushTokenManager.getExpoPushToken();
      await pushTokenManager.registerToken(userId, token);
      console.log('デバイスを再登録しました');
    } catch (error) {
      console.error('デバイス再登録失敗:', error);
    }
  }

  private async storeForOfflineRetry(error: NotificationError): Promise<void> {
    try {
      const { notificationQueueManager } = await import('./NotificationQueueManager');
      
      if (error.notificationId && error.userId) {
        // 通知をキューに追加して後で再試行
        await notificationQueueManager.enqueue({
          userId: error.userId,
          type: 'system' as any,
          title: 'オフライン通知',
          message: '接続回復後に送信されます',
          data: error.details || {},
          actionUrl: '/notifications',
          maxAttempts: 5,
        });
      }
    } catch (queueError) {
      console.error('オフライン再試行キューイング失敗:', queueError);
    }
  }

  private async enableRateLimiting(userId?: string): Promise<void> {
    if (!userId) return;

    try {
      // ユーザーの通知設定を一時的に制限
      await supabase
        .from('notification_settings')
        .update({
          push_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log('レート制限によりプッシュ通知を一時無効化しました');

      // 1時間後に再有効化
      setTimeout(async () => {
        try {
          await supabase
            .from('notification_settings')
            .update({
              push_enabled: true,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          
          console.log('プッシュ通知を再有効化しました');
        } catch (error) {
          console.error('プッシュ通知再有効化失敗:', error);
        }
      }, 3600000); // 1時間

    } catch (error) {
      console.error('レート制限設定失敗:', error);
    }
  }

  // エラーログ管理

  private async logError(error: NotificationError): Promise<void> {
    try {
      const logs = await this.getErrorLogs();
      logs.unshift(error);

      // 最大ログ数を超えた場合は古いログを削除
      if (logs.length > this.MAX_ERROR_LOGS) {
        logs.splice(this.MAX_ERROR_LOGS);
      }

      await AsyncStorage.setItem(this.ERROR_LOG_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('エラーログ保存失敗:', error);
    }
  }

  private async getErrorLogs(): Promise<NotificationError[]> {
    try {
      const logsData = await AsyncStorage.getItem(this.ERROR_LOG_KEY);
      return logsData ? JSON.parse(logsData) : [];
    } catch (error) {
      console.error('エラーログ取得失敗:', error);
      return [];
    }
  }

  private async updateErrorStats(error: NotificationError): Promise<void> {
    try {
      const stats = await this.getErrorStats();
      
      stats.totalErrors = (stats.totalErrors || 0) + 1;
      stats.errorsByType = stats.errorsByType || {};
      stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
      stats.lastError = error;

      await AsyncStorage.setItem(this.ERROR_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('エラー統計更新失敗:', error);
    }
  }

  async getErrorStats(): Promise<ErrorStats> {
    try {
      const statsData = await AsyncStorage.getItem(this.ERROR_STATS_KEY);
      return statsData ? JSON.parse(statsData) : {
        totalErrors: 0,
        errorsByType: {},
        retrySuccessRate: 0,
        averageRetryDelay: 0,
      };
    } catch (error) {
      console.error('エラー統計取得失敗:', error);
      return {
        totalErrors: 0,
        errorsByType: {},
        retrySuccessRate: 0,
        averageRetryDelay: 0,
      };
    }
  }

  private async reportErrorToSupabase(error: NotificationError): Promise<void> {
    try {
      await supabase.functions.invoke('log-notification-error', {
        body: {
          error,
          timestamp: new Date().toISOString(),
          environment: __DEV__ ? 'development' : 'production',
        },
      });
    } catch (reportError) {
      console.error('Supabaseエラーレポート送信失敗:', reportError);
    }
  }

  // クリーンアップ

  async clearErrorLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.ERROR_LOG_KEY);
      await AsyncStorage.removeItem(this.ERROR_STATS_KEY);
      console.log('エラーログをクリアしました');
    } catch (error) {
      console.error('エラーログクリア失敗:', error);
    }
  }
}

export const notificationErrorHandler = NotificationErrorHandler.getInstance();