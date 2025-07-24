import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import { NotificationType } from './NotificationHandler';

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached items
  strategy: 'lru' | 'fifo' | 'lfu'; // Cache eviction strategy
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerSecond: number;
  cacheHitRate: number;
  errorRate: number;
  memoryUsage: number;
  activeConnections: number;
}

interface CacheItem<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class NotificationPerformanceOptimizer {
  private static instance: NotificationPerformanceOptimizer;
  
  // キャッシュ設定
  private readonly cacheConfigs: Record<string, CacheConfig> = {
    notifications: {
      ttl: 5 * 60 * 1000, // 5分
      maxSize: 100,
      strategy: 'lru',
    },
    settings: {
      ttl: 10 * 60 * 1000, // 10分
      maxSize: 50,
      strategy: 'lru',
    },
    tokens: {
      ttl: 30 * 60 * 1000, // 30分
      maxSize: 20,
      strategy: 'fifo',
    },
  };

  // レート制限設定
  private readonly rateLimitConfigs: Record<string, RateLimitConfig> = {
    pushNotification: {
      windowMs: 60 * 1000, // 1分
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    },
    settingsUpdate: {
      windowMs: 30 * 1000, // 30秒
      maxRequests: 10,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    tokenRefresh: {
      windowMs: 5 * 60 * 1000, // 5分
      maxRequests: 5,
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    },
  };

  // キャッシュストレージ
  private caches: Map<string, Map<string, CacheItem<any>>> = new Map();
  
  // レート制限トラッカー
  private rateLimitTrackers: Map<string, { requests: number; resetTime: number }> = new Map();

  // パフォーマンスメトリクス
  private metrics = {
    requestTimes: [] as number[],
    totalRequests: 0,
    successfulRequests: 0,
    cacheHits: 0,
    cacheAttempts: 0,
  };

  public static getInstance(): NotificationPerformanceOptimizer {
    if (!NotificationPerformanceOptimizer.instance) {
      NotificationPerformanceOptimizer.instance = new NotificationPerformanceOptimizer();
    }
    return NotificationPerformanceOptimizer.instance;
  }

  constructor() {
    this.initializeCaches();
    this.startMetricsCollection();
  }

  private initializeCaches(): void {
    for (const cacheType in this.cacheConfigs) {
      this.caches.set(cacheType, new Map());
    }
  }

  private startMetricsCollection(): void {
    // 1分ごとにメトリクスをリセット
    setInterval(() => {
      this.resetMetrics();
    }, 60000);
  }

  // キャッシュ管理

  async cacheGet<T>(cacheType: string, key: string): Promise<T | null> {
    const cache = this.caches.get(cacheType);
    if (!cache) return null;

    const config = this.cacheConfigs[cacheType];
    if (!config) return null;

    const item = cache.get(key);
    if (!item) {
      this.metrics.cacheAttempts++;
      return null;
    }

    // TTLチェック
    if (Date.now() - item.timestamp > config.ttl) {
      cache.delete(key);
      this.metrics.cacheAttempts++;
      return null;
    }

    // アクセス情報を更新
    item.lastAccessed = Date.now();
    item.accessCount++;

    this.metrics.cacheHits++;
    this.metrics.cacheAttempts++;

    return item.value;
  }

  async cacheSet<T>(cacheType: string, key: string, value: T): Promise<void> {
    const cache = this.caches.get(cacheType);
    if (!cache) return;

    const config = this.cacheConfigs[cacheType];
    if (!config) return;

    // キャッシュサイズ制限チェック
    if (cache.size >= config.maxSize) {
      this.evictCache(cache, config);
    }

    const item: CacheItem<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    cache.set(key, item);
  }

  private evictCache(cache: Map<string, CacheItem<any>>, config: CacheConfig): void {
    const items = Array.from(cache.values());
    
    let itemToEvict: CacheItem<any>;

    switch (config.strategy) {
      case 'lru': // Least Recently Used
        itemToEvict = items.reduce((oldest, current) => 
          current.lastAccessed < oldest.lastAccessed ? current : oldest
        );
        break;
        
      case 'lfu': // Least Frequently Used
        itemToEvict = items.reduce((least, current) => 
          current.accessCount < least.accessCount ? current : least
        );
        break;
        
      case 'fifo': // First In, First Out
      default:
        itemToEvict = items.reduce((oldest, current) => 
          current.timestamp < oldest.timestamp ? current : oldest
        );
        break;
    }

    cache.delete(itemToEvict.key);
  }

  async cacheInvalidate(cacheType: string, key?: string): Promise<void> {
    const cache = this.caches.get(cacheType);
    if (!cache) return;

    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }

  // レート制限

  async checkRateLimit(operation: string, userId?: string): Promise<boolean> {
    const config = this.rateLimitConfigs[operation];
    if (!config) return true;

    const trackerId = userId ? `${operation}_${userId}` : operation;
    const tracker = this.rateLimitTrackers.get(trackerId);
    const now = Date.now();

    if (!tracker || now >= tracker.resetTime) {
      // 新しいウィンドウを開始
      this.rateLimitTrackers.set(trackerId, {
        requests: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (tracker.requests >= config.maxRequests) {
      console.warn(`レート制限に達しました: ${operation} (${tracker.requests}/${config.maxRequests})`);
      return false;
    }

    tracker.requests++;
    return true;
  }

  // 通知の優先度制御

  calculateNotificationPriority(
    type: NotificationType,
    userSettings: any,
    context: {
      isQuietHours?: boolean;
      userActivelyUsingApp?: boolean;
      lastNotificationTime?: number;
      batteryLevel?: number;
    }
  ): number {
    let priority = 0;

    // 基本優先度（通知タイプ別）
    const typePriorities: Record<NotificationType, number> = {
      [NotificationType.SYSTEM]: 100,
      [NotificationType.MESSAGE]: 80,
      [NotificationType.MENTION]: 70,
      [NotificationType.COMMENT]: 50,
      [NotificationType.POST_REPLY]: 45,
      [NotificationType.FOLLOW]: 30,
      [NotificationType.LIKE]: 20,
    };

    priority = typePriorities[type] || 10;

    // ユーザー設定による調整
    if (userSettings) {
      if (!userSettings.pushEnabled) priority = 0;
      if (!userSettings[`${type}s_enabled`]) priority = 0;
    }

    // コンテキストによる調整
    if (context.isQuietHours && type !== NotificationType.SYSTEM) {
      priority *= 0.2; // おやすみモード中は優先度を大幅に下げる
    }

    if (context.userActivelyUsingApp) {
      priority *= 0.5; // アプリ使用中は通知の必要性が低い
    }

    if (context.lastNotificationTime) {
      const timeSinceLastNotification = Date.now() - context.lastNotificationTime;
      if (timeSinceLastNotification < 60000) { // 1分以内
        priority *= 0.7; // 短時間での連続通知を抑制
      }
    }

    if (context.batteryLevel && context.batteryLevel < 0.2) {
      priority *= 0.8; // バッテリー残量が少ない時は抑制
    }

    return Math.max(0, Math.round(priority));
  }

  // バッチ処理の最適化

  async optimizeBatchSize(
    queueSize: number,
    averageProcessingTime: number,
    systemLoad: number
  ): Promise<number> {
    let optimalBatchSize = 10; // デフォルト

    // キューサイズに基づく調整
    if (queueSize > 100) {
      optimalBatchSize = 20;
    } else if (queueSize > 50) {
      optimalBatchSize = 15;
    } else if (queueSize < 10) {
      optimalBatchSize = 5;
    }

    // 処理時間に基づく調整
    if (averageProcessingTime > 5000) { // 5秒以上
      optimalBatchSize = Math.max(5, Math.floor(optimalBatchSize * 0.7));
    } else if (averageProcessingTime < 1000) { // 1秒未満
      optimalBatchSize = Math.min(25, Math.floor(optimalBatchSize * 1.3));
    }

    // システム負荷に基づく調整
    if (systemLoad > 0.8) {
      optimalBatchSize = Math.max(3, Math.floor(optimalBatchSize * 0.6));
    } else if (systemLoad < 0.3) {
      optimalBatchSize = Math.min(30, Math.floor(optimalBatchSize * 1.2));
    }

    return optimalBatchSize;
  }

  // データベースクエリ最適化

  async optimizeNotificationQuery(
    userId: string,
    filters: {
      type?: NotificationType;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<any> {
    const cacheKey = `notifications_${userId}_${JSON.stringify(filters)}`;
    
    // キャッシュから取得を試行
    const cached = await this.cacheGet('notifications', cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();

    try {
      // 最適化されたクエリの構築
      let query = supabase
        .from('notifications')
        .select(`
          id,
          type,
          title,
          message,
          data,
          is_read,
          created_at,
          read_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // 条件付きフィルター
      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.unreadOnly) {
        query = query.eq('is_read', false);
      }

      // ページネーション
      const limit = Math.min(filters.limit || 20, 100); // 最大100件に制限
      const offset = filters.offset || 0;
      
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      const result = {
        notifications: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      };

      // 結果をキャッシュ
      await this.cacheSet('notifications', cacheKey, result);

      // メトリクス更新
      this.updateRequestMetrics(Date.now() - startTime, true);

      return result;

    } catch (error) {
      this.updateRequestMetrics(Date.now() - startTime, false);
      throw error;
    }
  }

  // メモリ使用量の最適化

  async optimizeMemoryUsage(): Promise<void> {
    try {
      // 古いキャッシュエントリを削除
      for (const [cacheType, cache] of this.caches) {
        const config = this.cacheConfigs[cacheType];
        const now = Date.now();
        
        for (const [key, item] of cache) {
          if (now - item.timestamp > config.ttl) {
            cache.delete(key);
          }
        }
      }

      // メトリクス履歴をトリミング
      if (this.metrics.requestTimes.length > 1000) {
        this.metrics.requestTimes = this.metrics.requestTimes.slice(-500);
      }

      // 古いレート制限トラッカーを削除
      const now = Date.now();
      for (const [key, tracker] of this.rateLimitTrackers) {
        if (now >= tracker.resetTime) {
          this.rateLimitTrackers.delete(key);
        }
      }

      console.log('メモリ使用量を最適化しました');
    } catch (error) {
      console.error('メモリ最適化エラー:', error);
    }
  }

  // パフォーマンスメトリクス

  private updateRequestMetrics(responseTime: number, success: boolean): void {
    this.metrics.requestTimes.push(responseTime);
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    }

    // 直近100リクエストのみ保持
    if (this.metrics.requestTimes.length > 100) {
      this.metrics.requestTimes.shift();
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const requestTimes = this.metrics.requestTimes;
    const averageResponseTime = requestTimes.length > 0 
      ? requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length 
      : 0;

    const requestsPerSecond = this.metrics.totalRequests / 60; // 1分間のアベレージ

    const cacheHitRate = this.metrics.cacheAttempts > 0 
      ? (this.metrics.cacheHits / this.metrics.cacheAttempts) * 100 
      : 0;

    const errorRate = this.metrics.totalRequests > 0 
      ? ((this.metrics.totalRequests - this.metrics.successfulRequests) / this.metrics.totalRequests) * 100 
      : 0;

    return {
      averageResponseTime: Math.round(averageResponseTime),
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      memoryUsage: await this.getMemoryUsage(),
      activeConnections: this.getActiveConnections(),
    };
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      // React Nativeでのメモリ使用量取得は制限があるため、
      // キャッシュサイズベースでの概算を返す
      let totalCacheSize = 0;
      for (const cache of this.caches.values()) {
        totalCacheSize += cache.size;
      }
      return totalCacheSize;
    } catch (error) {
      return 0;
    }
  }

  private getActiveConnections(): number {
    // Supabaseの接続数やWebSocket接続数の概算
    return 1; // 基本的に1つのメイン接続
  }

  private resetMetrics(): void {
    this.metrics = {
      requestTimes: [],
      totalRequests: 0,
      successfulRequests: 0,
      cacheHits: 0,
      cacheAttempts: 0,
    };
  }

  // 設定の動的調整

  async adjustConfigBasedOnPerformance(): Promise<void> {
    const metrics = await this.getPerformanceMetrics();

    // レスポンス時間が遅い場合
    if (metrics.averageResponseTime > 3000) {
      // キャッシュTTLを延長
      for (const config of Object.values(this.cacheConfigs)) {
        config.ttl = Math.min(config.ttl * 1.5, 30 * 60 * 1000); // 最大30分
      }
      console.log('レスポンス時間改善のためキャッシュTTLを延長しました');
    }

    // キャッシュヒット率が低い場合
    if (metrics.cacheHitRate < 30) {
      // キャッシュサイズを増加
      for (const config of Object.values(this.cacheConfigs)) {
        config.maxSize = Math.min(config.maxSize * 1.2, 500); // 最大500件
      }
      console.log('キャッシュヒット率改善のためキャッシュサイズを増加しました');
    }

    // エラー率が高い場合
    if (metrics.errorRate > 10) {
      // レート制限を厳しくする
      for (const config of Object.values(this.rateLimitConfigs)) {
        config.maxRequests = Math.max(config.maxRequests * 0.8, 5);
      }
      console.log('エラー率改善のためレート制限を厳しくしました');
    }
  }

  // データベースパーティショニングサポート

  async createPartitionedQuery(
    table: string,
    dateField: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // 日付範囲に基づいてパーティションを選択
    const partitions = this.calculatePartitions(startDate, endDate);
    
    if (partitions.length === 1) {
      // 単一パーティション
      return supabase
        .from(`${table}_${partitions[0]}`)
        .select('*')
        .gte(dateField, startDate.toISOString())
        .lte(dateField, endDate.toISOString());
    } else {
      // 複数パーティションにまたがる場合はUNIONクエリ
      // 実際の実装では、Supabaseの制限により単純化
      return supabase
        .from(table)
        .select('*')
        .gte(dateField, startDate.toISOString())
        .lte(dateField, endDate.toISOString());
    }
  }

  private calculatePartitions(startDate: Date, endDate: Date): string[] {
    const partitions: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      partitions.push(`${year}_${month}`);
      current.setMonth(current.getMonth() + 1);
    }

    return partitions;
  }

  // クリーンアップ

  cleanup(): void {
    // 定期的なメトリクス収集を停止
    // キャッシュをクリア
    this.caches.clear();
    this.rateLimitTrackers.clear();
    console.log('パフォーマンス最適化をクリーンアップしました');
  }
}

export const notificationPerformanceOptimizer = NotificationPerformanceOptimizer.getInstance();