// データ取得の信頼性向上のためのリトライメカニズム
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

export class ReliableDataFetcher {
  private defaultOptions: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  };

  async fetchWithRetry<T>(
    fetcher: () => Promise<T>, 
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;
    let delay = config.initialDelay;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          fetcher(),
          this.createTimeoutPromise(15000) // 15秒タイムアウト
        ]);
        
        // 成功時のレスポンス時間測定
        const endTime = Date.now();
        console.log(`データ取得成功 (試行回数: ${attempt + 1})`);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`データ取得失敗 (試行 ${attempt + 1}/${config.maxRetries + 1}):`, error);

        if (attempt < config.maxRetries) {
          // 指数バックオフでリトライ
          await this.delay(Math.min(delay, config.maxDelay));
          delay *= config.backoffFactor;
        }
      }
    }

    throw new Error(`データ取得に失敗しました (${config.maxRetries + 1}回試行): ${lastError?.message}`);
  }

  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('リクエストタイムアウト')), timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ネットワーク状態の監視
export class NetworkQualityMonitor {
  private measurements: number[] = [];
  private readonly maxMeasurements = 10;

  addMeasurement(responseTime: number) {
    this.measurements.push(responseTime);
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  getAverageResponseTime(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, time) => sum + time, 0) / this.measurements.length;
  }

  getNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgTime = this.getAverageResponseTime();
    if (avgTime < 100) return 'excellent';
    if (avgTime < 300) return 'good';
    if (avgTime < 1000) return 'fair';
    return 'poor';
  }
}

// データ取得の段階的最適化
export class AdaptiveDataLoader {
  private networkMonitor = new NetworkQualityMonitor();
  private fetcher = new ReliableDataFetcher();

  async loadData<T>(
    lightDataFetcher: () => Promise<T>,
    fullDataFetcher: () => Promise<T>
  ): Promise<T> {
    const networkQuality = this.networkMonitor.getNetworkQuality();
    
    try {
      if (networkQuality === 'poor' || networkQuality === 'fair') {
        // ネットワーク状況が悪い場合は軽量データを優先
        console.log('ネットワーク状況により軽量データを読み込み中...');
        return await this.fetcher.fetchWithRetry(lightDataFetcher, {
          maxRetries: 2,
          initialDelay: 500
        });
      } else {
        // ネットワーク状況が良い場合は完全なデータを取得
        console.log('完全なデータを読み込み中...');
        return await this.fetcher.fetchWithRetry(fullDataFetcher, {
          maxRetries: 3,
          initialDelay: 1000
        });
      }
    } catch (error) {
      // フォールバック: 軽量データでリトライ
      console.warn('完全データ取得失敗、軽量データにフォールバック:', error);
      return await this.fetcher.fetchWithRetry(lightDataFetcher, {
        maxRetries: 2,
        initialDelay: 500
      });
    }
  }

  recordResponseTime(responseTime: number) {
    this.networkMonitor.addMeasurement(responseTime);
  }
}

// グローバルインスタンス
export const reliableDataFetcher = new ReliableDataFetcher();
export const adaptiveDataLoader = new AdaptiveDataLoader();
export const networkMonitor = new NetworkQualityMonitor();