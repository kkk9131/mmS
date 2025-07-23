interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface MemoryMetric {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
  suggestions: string[];
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private memoryMetrics: MemoryMetric[] = [];
  private operationCounts: Map<string, number> = new Map();
  private slowQueryThreshold = 1000; // 1 second
  private memoryCheckInterval: ReturnType<typeof setInterval> | null = null;
  private maxMemoryMetrics = 100; // Keep last 100 memory measurements
  private alerts: PerformanceAlert[] = [];
  private thresholds = {
    queryTime: { warning: 1000, critical: 3000 }, // ms
    memoryUsage: { warning: 150, critical: 300 }, // MB
    networkLatency: { warning: 500, critical: 1500 }, // ms
    realtimeConnections: { warning: 50, critical: 100 }, // connections
    cacheHitRate: { warning: 80, critical: 60 }, // percentage
    errorRate: { warning: 5, critical: 15 } // percentage
  };
  private queryMetrics: { table: string; operation: string; duration: number; success: boolean; timestamp: number }[] = [];
  private errorCount = 0;
  private totalQueries = 0;

  private constructor() {
    if (__DEV__) {
      this.startMemoryMonitoring();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start tracking a performance metric
  startMetric(name: string, metadata?: Record<string, any>): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  // End tracking a performance metric
  endMetric(name: string): PerformanceMetric | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // Log slow operations
    if (metric.duration > this.slowQueryThreshold) {
      console.warn(`Slow operation detected: ${name} took ${metric.duration.toFixed(2)}ms`, metric.metadata);
    }

    // Track operation counts
    const count = this.operationCounts.get(name) || 0;
    this.operationCounts.set(name, count + 1);

    this.metrics.delete(name);
    return metric;
  }

  // Track Supabase query performance
  trackSupabaseQuery(table: string, operation: string, queryFn: () => Promise<any>): Promise<any> {
    const metricName = `supabase_${table}_${operation}`;
    const startTime = performance.now();
    this.startMetric(metricName, { table, operation });
    this.totalQueries++;

    return queryFn()
      .then((result) => {
        const metric = this.endMetric(metricName);
        const duration = performance.now() - startTime;
        
        // Record query metrics for analysis
        this.queryMetrics.push({
          table,
          operation,
          duration,
          success: true,
          timestamp: Date.now()
        });

        // Check for slow queries and create alerts
        if (duration > this.thresholds.queryTime.warning) {
          this.createAlert(
            duration > this.thresholds.queryTime.critical ? 'critical' : 'warning',
            'queryTime',
            duration,
            this.thresholds.queryTime.warning,
            `遅いクエリが検出されました: ${table}.${operation}`,
            [
              'データベースインデックスの確認',
              'クエリの最適化',
              'データ量の削減を検討'
            ]
          );
        }

        if (__DEV__ && metric) {
          console.log(`Supabase ${operation} on ${table}: ${metric.duration?.toFixed(2)}ms`);
        }
        return result;
      })
      .catch((error) => {
        const metric = this.endMetric(metricName);
        const duration = performance.now() - startTime;
        
        this.errorCount++;
        this.queryMetrics.push({
          table,
          operation,
          duration,
          success: false,
          timestamp: Date.now()
        });

        // Check error rate
        const errorRate = (this.errorCount / this.totalQueries) * 100;
        if (errorRate > this.thresholds.errorRate.warning) {
          this.createAlert(
            errorRate > this.thresholds.errorRate.critical ? 'critical' : 'warning',
            'errorRate',
            errorRate,
            this.thresholds.errorRate.warning,
            `エラー率が高くなっています: ${errorRate.toFixed(1)}%`,
            [
              'エラーログの確認',
              'システムの安定性チェック',
              'ネットワーク接続の確認'
            ]
          );
        }

        if (__DEV__ && metric) {
          console.error(`Supabase ${operation} on ${table} failed after ${metric.duration?.toFixed(2)}ms`, error);
        }
        throw error;
      });
  }

  // Track RTK Query performance
  trackRTKQuery<T>(
    endpoint: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const metricName = `rtk_query_${endpoint}`;
    this.startMetric(metricName, { endpoint });

    return queryFn()
      .then((result) => {
        const metric = this.endMetric(metricName);
        if (__DEV__ && metric && metric.duration) {
          if (metric.duration > this.slowQueryThreshold) {
            console.warn(`RTK Query ${endpoint} is slow: ${metric.duration.toFixed(2)}ms`);
          }
        }
        return result;
      })
      .catch((error) => {
        const metric = this.endMetric(metricName);
        if (__DEV__ && metric) {
          console.error(`RTK Query ${endpoint} failed after ${metric.duration?.toFixed(2)}ms`, error);
        }
        throw error;
      });
  }

  // Monitor memory usage
  private startMemoryMonitoring(): void {
    if (!__DEV__ || typeof performance === 'undefined' || !('memory' in performance)) {
      return;
    }

    // Check memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        const metric: MemoryMetric = {
          timestamp: Date.now(),
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        };

        this.memoryMetrics.push(metric);

        // Keep only recent metrics
        if (this.memoryMetrics.length > this.maxMemoryMetrics) {
          this.memoryMetrics.shift();
        }

        // Warn if memory usage is high
        const usagePercent = (metric.usedJSHeapSize / metric.jsHeapSizeLimit) * 100;
        if (usagePercent > 80) {
          console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`, metric);
        }
      }
    }, 30000);
  }

  // Stop memory monitoring
  stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  // Get performance statistics
  getStats(): {
    operationCounts: Record<string, number>;
    memoryMetrics: MemoryMetric[];
    currentMemoryUsage?: MemoryMetric;
  } {
    const currentMemory = this.memoryMetrics[this.memoryMetrics.length - 1];
    
    return {
      operationCounts: Object.fromEntries(this.operationCounts),
      memoryMetrics: [...this.memoryMetrics],
      currentMemoryUsage: currentMemory,
    };
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.operationCounts.clear();
    this.memoryMetrics = [];
  }

  // Monitor realtime subscription count
  private realtimeSubscriptions = new Map<string, number>();

  trackRealtimeSubscription(channel: string, action: 'subscribe' | 'unsubscribe'): void {
    const count = this.realtimeSubscriptions.get(channel) || 0;
    
    if (action === 'subscribe') {
      this.realtimeSubscriptions.set(channel, count + 1);
    } else {
      this.realtimeSubscriptions.set(channel, Math.max(0, count - 1));
    }

    // Warn if too many subscriptions
    const totalSubscriptions = Array.from(this.realtimeSubscriptions.values()).reduce((a, b) => a + b, 0);
    if (totalSubscriptions > 50) {
      console.warn(`High number of realtime subscriptions: ${totalSubscriptions}`);
    }

    if (__DEV__) {
      console.log(`Realtime ${action} on ${channel}. Total subscriptions: ${totalSubscriptions}`);
    }
  }

  // Get current subscription count
  getRealtimeSubscriptionCount(): number {
    return Array.from(this.realtimeSubscriptions.values()).reduce((a, b) => a + b, 0);
  }

  // Batch operation tracking
  trackBatchOperation<T>(
    name: string,
    items: T[],
    operation: (batch: T[]) => Promise<any>
  ): Promise<any> {
    const metricName = `batch_${name}`;
    this.startMetric(metricName, { 
      batchSize: items.length,
      operationName: name 
    });

    return operation(items)
      .then((result) => {
        const metric = this.endMetric(metricName);
        if (__DEV__ && metric) {
          const throughput = items.length / ((metric.duration || 1) / 1000);
          console.log(
            `Batch operation ${name}: ${items.length} items in ${metric.duration?.toFixed(2)}ms ` +
            `(${throughput.toFixed(1)} items/sec)`
          );
        }
        return result;
      })
      .catch((error) => {
        const metric = this.endMetric(metricName);
        if (__DEV__ && metric) {
          console.error(`Batch operation ${name} failed after ${metric.duration?.toFixed(2)}ms`, error);
        }
        throw error;
      });
  }

  // Create performance alert
  private createAlert(
    type: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number,
    message: string,
    suggestions: string[]
  ): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      message,
      timestamp: new Date(),
      suggestions
    };

    this.alerts.push(alert);
    
    // 重複アラートの防止（同じメトリクスの同じタイプのアラートが5分以内にある場合は追加しない）
    const recentAlerts = this.alerts.filter(
      a => a.metric === metric && 
           a.type === type && 
           Date.now() - a.timestamp.getTime() < 5 * 60 * 1000
    );

    if (recentAlerts.length <= 1) {
      console.warn(`⚠️  ${type.toUpperCase()}: ${message}`);
      if (type === 'critical') {
        console.error(`🚨 CRITICAL PERFORMANCE ISSUE: ${message}`);
      }
    }

    // 古いアラートをクリーンアップ（24時間以上古い）
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > oneDayAgo);
  }

  // Get comprehensive performance statistics
  getPerformanceStats(): {
    queryStats: {
      totalQueries: number;
      errorRate: number;
      averageQueryTime: number;
      slowQueries: number;
    };
    memoryStats: {
      current: MemoryMetric | undefined;
      trend: 'stable' | 'increasing' | 'decreasing';
      peakUsage: number;
    };
    realtimeStats: {
      totalSubscriptions: number;
      activeChannels: number;
    };
    alerts: {
      total: number;
      warnings: number;
      critical: number;
      recent: PerformanceAlert[];
    };
    operationCounts: Record<string, number>;
  } {
    // クエリ統計
    const recentQueries = this.queryMetrics.filter(q => Date.now() - q.timestamp < 5 * 60 * 1000);
    const totalQueries = recentQueries.length;
    const failedQueries = recentQueries.filter(q => !q.success).length;
    const errorRate = totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0;
    const averageQueryTime = totalQueries > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0;
    const slowQueries = recentQueries.filter(q => q.duration > this.thresholds.queryTime.warning).length;

    // メモリ統計
    const currentMemory = this.memoryMetrics[this.memoryMetrics.length - 1];
    const memoryTrend = this.analyzeMemoryTrend();
    const peakUsage = this.memoryMetrics.length > 0 
      ? Math.max(...this.memoryMetrics.map(m => m.usedJSHeapSize)) / (1024 * 1024)
      : 0;

    // リアルタイム統計
    const totalSubscriptions = this.getRealtimeSubscriptionCount();
    const activeChannels = this.realtimeSubscriptions.size;

    // アラート統計
    const recentAlerts = this.alerts.filter(a => Date.now() - a.timestamp.getTime() < 60 * 60 * 1000);
    const warnings = this.alerts.filter(a => a.type === 'warning').length;
    const critical = this.alerts.filter(a => a.type === 'critical').length;

    return {
      queryStats: {
        totalQueries: this.totalQueries,
        errorRate,
        averageQueryTime,
        slowQueries
      },
      memoryStats: {
        current: currentMemory,
        trend: memoryTrend,
        peakUsage
      },
      realtimeStats: {
        totalSubscriptions,
        activeChannels
      },
      alerts: {
        total: this.alerts.length,
        warnings,
        critical,
        recent: recentAlerts.slice(-10) // 最新10件
      },
      operationCounts: Object.fromEntries(this.operationCounts)
    };
  }

  // Analyze memory usage trend
  private analyzeMemoryTrend(): 'stable' | 'increasing' | 'decreasing' {
    if (this.memoryMetrics.length < 10) return 'stable';

    const recent = this.memoryMetrics.slice(-5);
    const older = this.memoryMetrics.slice(-10, -5);

    const recentAvg = recent.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  // Generate performance report
  generatePerformanceReport(): string {
    const stats = this.getPerformanceStats();
    const lines: string[] = [];

    lines.push('📊 パフォーマンスレポート');
    lines.push('=' .repeat(50));
    lines.push(`生成時刻: ${new Date().toLocaleString()}`);
    lines.push('');

    // クエリ統計
    lines.push('🗃️ データベースクエリ:');
    lines.push(`  総クエリ数: ${stats.queryStats.totalQueries}`);
    lines.push(`  エラー率: ${stats.queryStats.errorRate.toFixed(1)}%`);
    lines.push(`  平均クエリ時間: ${stats.queryStats.averageQueryTime.toFixed(2)}ms`);
    lines.push(`  遅いクエリ数: ${stats.queryStats.slowQueries}`);
    lines.push('');

    // メモリ統計
    lines.push('🧠 メモリ使用量:');
    if (stats.memoryStats.current) {
      const currentMB = stats.memoryStats.current.usedJSHeapSize / (1024 * 1024);
      lines.push(`  現在の使用量: ${currentMB.toFixed(1)}MB`);
      lines.push(`  ピーク使用量: ${stats.memoryStats.peakUsage.toFixed(1)}MB`);
      lines.push(`  トレンド: ${stats.memoryStats.trend}`);
    }
    lines.push('');

    // リアルタイム統計
    lines.push('⚡ リアルタイム接続:');
    lines.push(`  アクティブ接続数: ${stats.realtimeStats.totalSubscriptions}`);
    lines.push(`  アクティブチャネル数: ${stats.realtimeStats.activeChannels}`);
    lines.push('');

    // アラート
    lines.push('🚨 アラート:');
    lines.push(`  警告: ${stats.alerts.warnings}, 重要: ${stats.alerts.critical}`);
    if (stats.alerts.recent.length > 0) {
      lines.push('  最新のアラート:');
      stats.alerts.recent.slice(-3).forEach(alert => {
        lines.push(`    ${alert.type.toUpperCase()}: ${alert.message}`);
      });
    }
    lines.push('');

    return lines.join('\n');
  }

  // Clear old data
  private cleanupOldData(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.queryMetrics = this.queryMetrics.filter(q => q.timestamp > oneHourAgo);
    
    // Reset error counts periodically to prevent overflow
    if (this.totalQueries > 10000) {
      this.errorCount = Math.floor(this.errorCount * 0.8);
      this.totalQueries = Math.floor(this.totalQueries * 0.8);
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Utility functions for common monitoring patterns
export const monitorSupabaseQuery = (table: string, operation: string) => {
  return <T extends (...args: any[]) => Promise<any>>(target: T): T => {
    return ((...args: Parameters<T>) => {
      return performanceMonitor.trackSupabaseQuery(table, operation, () => target(...args));
    }) as T;
  };
};

export const monitorRTKEndpoint = (endpoint: string) => {
  return <T extends (...args: any[]) => Promise<any>>(target: T): T => {
    return ((...args: Parameters<T>) => {
      return performanceMonitor.trackRTKQuery(endpoint, () => target(...args));
    }) as T;
  };
};