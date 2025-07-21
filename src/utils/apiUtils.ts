import { ApiError } from '../types/api';
import { ErrorUtils } from './errorUtils';

interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: ApiError, attemptNumber: number) => boolean;
}

export class ApiUtils {
  /**
   * リトライ機能付きのAPI呼び出し
   */
  public static async withRetry<T>(
    apiCall: () => Promise<T>,
    config: RetryConfig = {},
    context?: string
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      retryCondition = (error: ApiError, attemptNumber: number) => 
        ErrorUtils.shouldRetry(error, attemptNumber, maxRetries)
    } = config;

    let lastError: ApiError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        const { apiError } = ErrorUtils.handleError(error, context);
        lastError = apiError;

        if (attempt > maxRetries || !retryCondition(apiError, attempt)) {
          throw apiError;
        }

        // リトライ前の待機
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        );
        
        console.warn(`API call failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms...`, {
          context,
          error: apiError,
        });

        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * 複数のAPI呼び出しを並列実行（一部失敗を許可）
   */
  public static async parallelWithPartialSuccess<T>(
    apiCalls: (() => Promise<T>)[],
    minSuccessCount: number = 1
  ): Promise<{
    results: (T | null)[];
    errors: (ApiError | null)[];
    successCount: number;
  }> {
    const promises = apiCalls.map(async (call, index) => {
      try {
        const result = await call();
        return { success: true, result, error: null, index };
      } catch (error) {
        const { apiError } = ErrorUtils.handleError(error, `parallel-call-${index}`);
        return { success: false, result: null, error: apiError, index };
      }
    });

    const outcomes = await Promise.all(promises);
    
    const results: (T | null)[] = new Array(apiCalls.length).fill(null);
    const errors: (ApiError | null)[] = new Array(apiCalls.length).fill(null);
    let successCount = 0;

    outcomes.forEach(({ success, result, error, index }) => {
      if (success) {
        results[index] = result;
        successCount++;
      } else {
        errors[index] = error;
      }
    });

    if (successCount < minSuccessCount) {
      throw new Error(`Only ${successCount} out of ${apiCalls.length} API calls succeeded. Required: ${minSuccessCount}`);
    }

    return { results, errors, successCount };
  }

  /**
   * API呼び出しのタイムアウト処理
   */
  public static async withTimeout<T>(
    apiCall: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    return Promise.race([apiCall(), timeoutPromise]);
  }

  /**
   * API呼び出しの結果をキャッシュ
   */
  public static createCachedCall<T>(
    apiCall: () => Promise<T>,
    cacheKey: string,
    ttlMs: number = 5 * 60 * 1000 // 5分
  ): () => Promise<T> {
    const cache = new Map<string, { data: T; timestamp: number }>();

    return async (): Promise<T> => {
      const cached = cache.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < ttlMs) {
        return cached.data;
      }

      const result = await apiCall();
      cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    };
  }

  /**
   * API呼び出しのレート制限
   */
  public static createRateLimitedCall<T>(
    apiCall: () => Promise<T>,
    maxCallsPerPeriod: number,
    periodMs: number = 60000 // 1分
  ): () => Promise<T> {
    const callTimes: number[] = [];

    return async (): Promise<T> => {
      const now = Date.now();
      
      // 古い呼び出し記録を削除
      while (callTimes.length > 0 && (now - callTimes[0]) > periodMs) {
        callTimes.shift();
      }

      if (callTimes.length >= maxCallsPerPeriod) {
        const oldestCall = callTimes[0];
        const waitTime = periodMs - (now - oldestCall);
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
      }

      callTimes.push(now);
      return apiCall();
    };
  }

  /**
   * 遅延ユーティリティ
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * API呼び出しの監視とログ記録
   */
  public static async withMonitoring<T>(
    apiCall: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await apiCall();
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ API Success: ${operationName}`, {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const { apiError } = ErrorUtils.handleError(error, operationName);

      console.error(`❌ API Error: ${operationName}`, {
        error: apiError,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      throw apiError;
    }
  }

  /**
   * バッチ処理用のAPI呼び出し
   */
  public static async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 5,
    delayBetweenBatches: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(processor);
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // バッチ間の遅延
      if (i + batchSize < items.length && delayBetweenBatches > 0) {
        await this.delay(delayBetweenBatches);
      }
    }

    return results;
  }
}