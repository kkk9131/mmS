import { store } from '../store';
import { SupabaseError, SupabaseErrorHandler } from '../utils/SupabaseErrorHandler';
import { postsApi } from '../store/api/postsApi';
import { notificationsApi } from '../store/api/notificationsApi';

export interface RetryContext {
  operation: string;
  params?: any;
  retryCount: number;
  maxRetries: number;
  lastError?: Error | SupabaseError;
}

export interface RetryStrategy {
  canRetry: (error: Error | SupabaseError) => boolean;
  getDelayMs: (retryCount: number) => number;
  maxRetries: number;
}

class ErrorRetryService {
  private static instance: ErrorRetryService;
  private retryQueue = new Map<string, RetryContext>();
  
  private defaultStrategy: RetryStrategy = {
    canRetry: (error) => {
      // ネットワークエラーやサーバーエラーは再試行可能
      if (error instanceof Error) {
        return error.message.includes('network') || 
               error.message.includes('timeout') ||
               error.message.includes('connection');
      }
      
      if (SupabaseErrorHandler.isSupabaseError(error)) {
        return error.type === 'NETWORK_ERROR' || 
               error.type === 'SERVER_ERROR' ||
               (error.type === 'DATABASE_ERROR' && error.recoverable);
      }
      
      return false;
    },
    getDelayMs: (retryCount) => {
      // 指数バックオフ: 1s, 2s, 4s, 8s, 16s
      return Math.min(1000 * Math.pow(2, retryCount), 30000);
    },
    maxRetries: 3,
  };

  private strategies = new Map<string, RetryStrategy>([
    ['default', this.defaultStrategy],
    ['posts', {
      ...this.defaultStrategy,
      maxRetries: 5, // 投稿は重要なので多めに再試行
    }],
    ['notifications', {
      ...this.defaultStrategy,
      maxRetries: 2, // 通知は即座でなくても良い
    }],
    ['auth', {
      canRetry: (error) => {
        // 認証エラーは基本的に再試行しない（無効なトークンなど）
        if (SupabaseErrorHandler.isSupabaseError(error)) {
          return error.type === 'NETWORK_ERROR';
        }
        return false;
      },
      getDelayMs: (retryCount) => 2000 * (retryCount + 1),
      maxRetries: 1,
    }],
  ]);

  private constructor() {}

  public static getInstance(): ErrorRetryService {
    if (!ErrorRetryService.instance) {
      ErrorRetryService.instance = new ErrorRetryService();
    }
    return ErrorRetryService.instance;
  }

  public async retryOperation(
    error: Error | SupabaseError,
    context?: {
      operation?: string;
      params?: any;
      strategyName?: string;
    }
  ): Promise<boolean> {
    const operation = context?.operation || 'unknown';
    const strategyName = context?.strategyName || this.getStrategyForOperation(operation);
    const strategy = this.strategies.get(strategyName) || this.defaultStrategy;

    if (!strategy.canRetry(error)) {
      console.log(`Cannot retry operation: ${operation} - error not retryable`);
      return false;
    }

    const retryKey = `${operation}_${Date.now()}`;
    const existingContext = this.retryQueue.get(retryKey);
    const retryCount = existingContext?.retryCount || 0;

    if (retryCount >= strategy.maxRetries) {
      console.log(`Max retries exceeded for operation: ${operation}`);
      this.retryQueue.delete(retryKey);
      return false;
    }

    const retryContext: RetryContext = {
      operation,
      params: context?.params,
      retryCount: retryCount + 1,
      maxRetries: strategy.maxRetries,
      lastError: error,
    };

    this.retryQueue.set(retryKey, retryContext);

    const delayMs = strategy.getDelayMs(retryCount);
    console.log(`Retrying operation: ${operation} (attempt ${retryCount + 1}/${strategy.maxRetries}) in ${delayMs}ms`);

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          await this.executeRetry(retryContext);
          this.retryQueue.delete(retryKey);
          resolve(true);
        } catch (retryError) {
          console.error(`Retry failed for operation: ${operation}`, retryError);
          // 再帰的に再試行を続ける
          const success = await this.retryOperation(retryError as Error, context);
          resolve(success);
        }
      }, delayMs);
    });
  }

  private async executeRetry(context: RetryContext): Promise<void> {
    const { operation, params } = context;

    switch (operation) {
      case 'posts/get':
        await this.retryGetPosts(params);
        break;
      case 'posts/create':
        await this.retryCreatePost(params);
        break;
      case 'posts/like':
        await this.retryLikePost(params);
        break;
      case 'posts/unlike':
        await this.retryUnlikePost(params);
        break;
      case 'notifications/get':
        await this.retryGetNotifications(params);
        break;
      case 'notifications/markRead':
        await this.retryMarkNotificationRead(params);
        break;
      default:
        throw new Error(`Unknown retry operation: ${operation}`);
    }
  }

  private async retryGetPosts(params: any): Promise<void> {
    const result = await store.dispatch(
      postsApi.endpoints.getPosts.initiate(params, { forceRefetch: true })
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  private async retryCreatePost(params: any): Promise<void> {
    const result = await store.dispatch(
      postsApi.endpoints.createPost.initiate(params)
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  private async retryLikePost(params: { postId: string }): Promise<void> {
    // RTK Queryのlikeエンドポイントが実装されたら使用
    // 現在はPostsServiceを直接使用
    const { PostsService } = await import('./PostsService');
    const postsService = PostsService.getInstance();
    await postsService.likePost(params.postId);
  }

  private async retryUnlikePost(params: { postId: string }): Promise<void> {
    // RTK Queryのunlikeエンドポイントが実装されたら使用
    const { PostsService } = await import('./PostsService');
    const postsService = PostsService.getInstance();
    await postsService.unlikePost(params.postId);
  }

  private async retryGetNotifications(params: any): Promise<void> {
    const result = await store.dispatch(
      notificationsApi.endpoints.getNotifications.initiate(params, { forceRefetch: true })
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  private async retryMarkNotificationRead(params: { notificationId: string }): Promise<void> {
    const result = await store.dispatch(
      notificationsApi.endpoints.markNotificationAsRead.initiate(params.notificationId)
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  private getStrategyForOperation(operation: string): string {
    if (operation.startsWith('posts/')) {
      return 'posts';
    }
    if (operation.startsWith('notifications/')) {
      return 'notifications';
    }
    if (operation.startsWith('auth/')) {
      return 'auth';
    }
    return 'default';
  }

  public getRetryStatus(): {
    activeRetries: number;
    totalRetries: number;
    operations: string[];
  } {
    const operations = Array.from(this.retryQueue.values());
    
    return {
      activeRetries: operations.length,
      totalRetries: operations.reduce((sum, ctx) => sum + ctx.retryCount, 0),
      operations: operations.map(ctx => ctx.operation),
    };
  }

  public clearRetryQueue(): void {
    this.retryQueue.clear();
  }

  public addCustomStrategy(name: string, strategy: RetryStrategy): void {
    this.strategies.set(name, strategy);
  }
}

export const errorRetryService = ErrorRetryService.getInstance();