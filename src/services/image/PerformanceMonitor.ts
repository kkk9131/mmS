/**
 * 画像システムパフォーマンス監視サービス
 * メモリ使用量、処理時間、FPS監視、最適化提案
 */

import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Timeout型の定義
type Timeout = ReturnType<typeof setTimeout>;

export interface PerformanceMetrics {
  // 処理時間メトリクス
  imageSelectionTime: number;
  imageProcessingTime: number;
  uploadTime: number;
  cacheRetrievalTime: number;
  renderTime: number;
  
  // メモリメトリクス
  memoryUsage: number;
  peakMemoryUsage: number;
  memoryLeaks: number;
  
  // ネットワークメトリクス
  uploadSpeed: number; // bytes/sec
  downloadSpeed: number;
  networkLatency: number;
  
  // UI メトリクス
  fps: number;
  frameDrops: number;
  interactionDelay: number;
  
  // エラーメトリクス
  errorRate: number;
  retryCount: number;
  failureRate: number;
  
  // 品質メトリクス
  compressionRatio: number;
  imageQualityScore: number;
  
  timestamp: Date;
}

export interface PerformanceThresholds {
  maxImageProcessingTime: number; // ms
  maxUploadTime: number; // ms
  maxMemoryUsage: number; // bytes
  minFPS: number;
  maxErrorRate: number; // percentage
  maxInteractionDelay: number; // ms
}

export interface OptimizationSuggestion {
  type: 'memory' | 'network' | 'processing' | 'ui' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number; // percentage
}

const PERFORMANCE_LOG_KEY = 'image_performance_logs';
const MAX_PERFORMANCE_LOGS = 500;

// デフォルトパフォーマンス閾値
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxImageProcessingTime: 5000, // 5秒
  maxUploadTime: 30000, // 30秒
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  minFPS: 55, // 55 FPS以上
  maxErrorRate: 5, // 5%以下
  maxInteractionDelay: 100 // 100ms以下
};

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private currentMetrics: Partial<PerformanceMetrics> = {};
  private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
  private timers: Map<string, number> = new Map();
  private memoryBaseline: number = 0;
  private isMonitoring: boolean = false;
  private monitoringInterval?: Timeout;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * パフォーマンス監視を開始
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ パフォーマンス監視は既に開始されています');
      return;
    }

    try {
      console.log('📊 パフォーマンス監視開始');
      
      this.isMonitoring = true;
      this.memoryBaseline = await this.getCurrentMemoryUsage();
      
      // 過去のメトリクスを読み込み
      await this.loadPerformanceMetrics();
      
      // 定期的な監視を開始
      this.monitoringInterval = setInterval(() => {
        this.collectSystemMetrics();
      }, 1000); // 1秒ごと
      
      console.log('✅ パフォーマンス監視開始完了');
    } catch (error) {
      console.error('❌ パフォーマンス監視開始エラー:', error);
    }
  }

  /**
   * パフォーマンス監視を停止
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('📊 パフォーマンス監視停止');
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    // メトリクスを保存
    this.savePerformanceMetrics();
  }

  /**
   * 処理時間の測定開始
   */
  startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
    console.log(`⏱️ ${operation} 処理時間測定開始`);
  }

  /**
   * 処理時間の測定終了
   */
  endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      console.warn(`⚠️ ${operation} の開始時間が見つかりません`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);
    
    console.log(`✅ ${operation} 処理時間: ${duration}ms`);
    
    // メトリクスに記録
    this.recordOperationTime(operation, duration);
    
    return duration;
  }

  /**
   * メモリ使用量を記録
   */
  recordMemoryUsage(context: string): void {
    this.getCurrentMemoryUsage().then(usage => {
      console.log(`💾 ${context} メモリ使用量: ${this.formatBytes(usage)}`);
      
      this.currentMetrics.memoryUsage = usage;
      
      if (!this.currentMetrics.peakMemoryUsage || usage > this.currentMetrics.peakMemoryUsage) {
        this.currentMetrics.peakMemoryUsage = usage;
      }
      
      // メモリリーク検出
      if (usage > this.memoryBaseline * 2) {
        console.warn('⚠️ メモリリークの可能性を検出');
        this.currentMetrics.memoryLeaks = (this.currentMetrics.memoryLeaks || 0) + 1;
      }
    });
  }

  /**
   * ネットワーク速度を記録
   */
  recordNetworkSpeed(bytes: number, durationMs: number, type: 'upload' | 'download'): void {
    const speed = (bytes / (durationMs / 1000)); // bytes per second
    
    if (type === 'upload') {
      this.currentMetrics.uploadSpeed = speed;
    } else {
      this.currentMetrics.downloadSpeed = speed;
    }
    
    console.log(`🌐 ${type} 速度: ${this.formatBytes(speed)}/s`);
  }

  /**
   * FPSを記録
   */
  recordFPS(fps: number): void {
    this.currentMetrics.fps = fps;
    
    if (fps < this.thresholds.minFPS) {
      this.currentMetrics.frameDrops = (this.currentMetrics.frameDrops || 0) + 1;
      console.warn(`⚠️ FPS低下検出: ${fps} FPS`);
    }
  }

  /**
   * エラー率を記録
   */
  recordError(operation: string): void {
    console.log(`❌ エラー記録: ${operation}`);
    
    // エラー率の計算と記録
    this.currentMetrics.errorRate = (this.currentMetrics.errorRate || 0) + 1;
  }

  /**
   * 画像品質スコアを記録
   */
  recordImageQuality(compressionRatio: number, qualityScore: number): void {
    this.currentMetrics.compressionRatio = compressionRatio;
    this.currentMetrics.imageQualityScore = qualityScore;
    
    console.log(`🖼️ 画像品質 - 圧縮率: ${(compressionRatio * 100).toFixed(1)}%, 品質: ${qualityScore}`);
  }

  /**
   * 現在のメトリクスを取得
   */
  getCurrentMetrics(): Partial<PerformanceMetrics> {
    return { ...this.currentMetrics };
  }

  /**
   * パフォーマンス統計を取得
   */
  getPerformanceStatistics(): {
    averageProcessingTime: number;
    averageUploadTime: number;
    averageMemoryUsage: number;
    averageFPS: number;
    errorRate: number;
    trends: {
      processingTime: 'improving' | 'stable' | 'degrading';
      memoryUsage: 'improving' | 'stable' | 'degrading';
      errorRate: 'improving' | 'stable' | 'degrading';
    };
  } {
    if (this.metrics.length === 0) {
      return {
        averageProcessingTime: 0,
        averageUploadTime: 0,
        averageMemoryUsage: 0,
        averageFPS: 0,
        errorRate: 0,
        trends: {
          processingTime: 'stable',
          memoryUsage: 'stable',
          errorRate: 'stable'
        }
      };
    }

    const recent = this.metrics.slice(-50); // 最新50件
    const older = this.metrics.slice(-100, -50); // その前の50件

    const averageProcessingTime = this.calculateAverage(recent, 'imageProcessingTime');
    const averageUploadTime = this.calculateAverage(recent, 'uploadTime');
    const averageMemoryUsage = this.calculateAverage(recent, 'memoryUsage');
    const averageFPS = this.calculateAverage(recent, 'fps');
    const errorRate = this.calculateAverage(recent, 'errorRate');

    // トレンド分析
    const trends = {
      processingTime: this.analyzeTrend(older, recent, 'imageProcessingTime'),
      memoryUsage: this.analyzeTrend(older, recent, 'memoryUsage'),
      errorRate: this.analyzeTrend(older, recent, 'errorRate')
    };

    return {
      averageProcessingTime,
      averageUploadTime,
      averageMemoryUsage,
      averageFPS,
      errorRate,
      trends
    };
  }

  /**
   * 最適化提案を生成
   */
  generateOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const stats = this.getPerformanceStatistics();

    // 処理時間の最適化
    if (stats.averageProcessingTime > this.thresholds.maxImageProcessingTime) {
      suggestions.push({
        type: 'processing',
        severity: 'high',
        title: '画像処理時間の最適化',
        description: `画像処理に平均${(stats.averageProcessingTime / 1000).toFixed(1)}秒かかっています`,
        impact: 'ユーザー体験の向上、CPU使用率の削減',
        implementation: 'WebWorkerやネイティブ処理の使用、並列処理の実装',
        estimatedImprovement: 40
      });
    }

    // メモリ使用量の最適化
    if (stats.averageMemoryUsage > this.thresholds.maxMemoryUsage) {
      suggestions.push({
        type: 'memory',
        severity: 'high',
        title: 'メモリ使用量の最適化',
        description: `平均メモリ使用量が${this.formatBytes(stats.averageMemoryUsage)}です`,
        impact: 'アプリクラッシュの防止、バッテリー消費の削減',
        implementation: '画像サイズの制限、メモリプールの実装、ガベージコレクションの最適化',
        estimatedImprovement: 35
      });
    }

    // FPSの最適化
    if (stats.averageFPS < this.thresholds.minFPS) {
      suggestions.push({
        type: 'ui',
        severity: 'medium',
        title: 'UIパフォーマンスの最適化',
        description: `平均FPSが${stats.averageFPS.toFixed(1)}で基準値を下回っています`,
        impact: 'スムーズなアニメーション、レスポンシブな操作感',
        implementation: 'レンダリング最適化、仮想化リストの実装、不要な再レンダリングの削除',
        estimatedImprovement: 25
      });
    }

    // エラー率の改善
    if (stats.errorRate > this.thresholds.maxErrorRate) {
      suggestions.push({
        type: 'processing',
        severity: 'medium',
        title: 'エラー率の改善',
        description: `エラー率が${stats.errorRate.toFixed(1)}%で基準値を上回っています`,
        impact: 'ユーザー満足度の向上、サポートコストの削減',
        implementation: 'エラーハンドリングの強化、入力値検証の追加、フォールバック処理の実装',
        estimatedImprovement: 50
      });
    }

    // キャッシュ最適化
    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate < 0.8) {
      suggestions.push({
        type: 'cache',
        severity: 'low',
        title: 'キャッシュ効率の向上',
        description: `キャッシュヒット率が${(cacheHitRate * 100).toFixed(1)}%です`,
        impact: 'ネットワーク使用量の削減、レスポンス時間の短縮',
        implementation: 'キャッシュ戦略の見直し、プリフェッチの実装、キャッシュサイズの調整',
        estimatedImprovement: 30
      });
    }

    return suggestions.sort((a, b) => {
      const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityWeight[b.severity] - severityWeight[a.severity];
    });
  }

  /**
   * パフォーマンスレポートを生成
   */
  generatePerformanceReport(): {
    summary: string;
    metrics: Partial<PerformanceMetrics>;
    statistics: {
      averageProcessingTime: number;
      averageUploadTime: number;
      averageMemoryUsage: number;
      averageFPS: number;
      errorRate: number;
      trends: {
        processingTime: 'improving' | 'stable' | 'degrading';
        memoryUsage: 'improving' | 'stable' | 'degrading';
        errorRate: 'improving' | 'stable' | 'degrading';
      };
    };
    suggestions: OptimizationSuggestion[];
    deviceInfo: {
      platform: string;
      screenSize: string;
      memoryBaseline: string;
    };
  } {
    const statistics = this.getPerformanceStatistics();
    const suggestions = this.generateOptimizationSuggestions();
    
    const { width, height } = Dimensions.get('window');
    
    return {
      summary: this.generateSummaryText(statistics, suggestions),
      metrics: this.getCurrentMetrics(),
      statistics,
      suggestions,
      deviceInfo: {
        platform: Platform.OS,
        screenSize: `${width}x${height}`,
        memoryBaseline: this.formatBytes(this.memoryBaseline)
      }
    };
  }

  /**
   * システムメトリクスを収集
   */
  private async collectSystemMetrics(): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      // メモリ使用量を更新
      const memoryUsage = await this.getCurrentMemoryUsage();
      this.currentMetrics.memoryUsage = memoryUsage;
      
      // タイムスタンプを更新
      this.currentMetrics.timestamp = new Date();
      
      // 5秒ごとにメトリクスを記録
      if (Date.now() % 5000 < 1000) {
        this.recordMetrics();
      }
    } catch (error) {
      console.error('❌ システムメトリクス収集エラー:', error);
    }
  }

  /**
   * 現在のメトリクスを記録
   */
  private recordMetrics(): void {
    if (Object.keys(this.currentMetrics).length === 0) return;

    const metrics: PerformanceMetrics = {
      imageSelectionTime: 0,
      imageProcessingTime: 0,
      uploadTime: 0,
      cacheRetrievalTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      memoryLeaks: 0,
      uploadSpeed: 0,
      downloadSpeed: 0,
      networkLatency: 0,
      fps: 60,
      frameDrops: 0,
      interactionDelay: 0,
      errorRate: 0,
      retryCount: 0,
      failureRate: 0,
      compressionRatio: 0,
      imageQualityScore: 0,
      timestamp: new Date(),
      ...this.currentMetrics
    };

    this.metrics.push(metrics);
    
    // 最大記録数を超えた場合は古いものを削除
    if (this.metrics.length > MAX_PERFORMANCE_LOGS) {
      this.metrics = this.metrics.slice(-MAX_PERFORMANCE_LOGS);
    }
    
    // メトリクスをリセット（一部の累積値は保持）
    const preservedMetrics = {
      memoryLeaks: this.currentMetrics.memoryLeaks,
      frameDrops: this.currentMetrics.frameDrops,
      errorRate: this.currentMetrics.errorRate,
      retryCount: this.currentMetrics.retryCount
    };
    
    this.currentMetrics = preservedMetrics;
  }

  /**
   * 操作時間を記録
   */
  private recordOperationTime(operation: string, duration: number): void {
    const operationMap: Record<string, keyof PerformanceMetrics> = {
      'image_selection': 'imageSelectionTime',
      'image_processing': 'imageProcessingTime',
      'image_upload': 'uploadTime',
      'cache_retrieval': 'cacheRetrievalTime',
      'render': 'renderTime'
    };

    const metricKey = operationMap[operation];
    if (metricKey) {
      (this.currentMetrics as any)[metricKey] = duration;
    }
  }

  /**
   * 現在のメモリ使用量を取得
   */
  private async getCurrentMemoryUsage(): Promise<number> {
    // React Nativeでのメモリ使用量取得は制限があるため、
    // 簡易的な推定値を返す
    if (Platform.OS === 'ios') {
      // iOS用の実装
      return 50 * 1024 * 1024; // 50MB仮想値
    } else {
      // Android用の実装
      return 60 * 1024 * 1024; // 60MB仮想値
    }
  }

  /**
   * 平均値を計算
   */
  private calculateAverage(metrics: PerformanceMetrics[], key: keyof PerformanceMetrics): number {
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, metric) => {
      const value = metric[key];
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    
    return sum / metrics.length;
  }

  /**
   * トレンド分析
   */
  private analyzeTrend(
    older: PerformanceMetrics[], 
    recent: PerformanceMetrics[], 
    key: keyof PerformanceMetrics
  ): 'improving' | 'stable' | 'degrading' {
    if (older.length === 0 || recent.length === 0) return 'stable';
    
    const olderAvg = this.calculateAverage(older, key);
    const recentAvg = this.calculateAverage(recent, key);
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'degrading';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  /**
   * キャッシュヒット率を計算
   */
  private calculateCacheHitRate(): number {
    // キャッシュ統計の実装依存
    // 簡易版として固定値を返す
    return 0.75; // 75%
  }

  /**
   * バイト数をフォーマット
   */
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));
    
    return `${size} ${sizes[i]}`;
  }

  /**
   * サマリーテキストを生成
   */
  private generateSummaryText(
    statistics: {
      averageProcessingTime: number;
      averageUploadTime: number;
      averageMemoryUsage: number;
      averageFPS: number;
      errorRate: number;
      trends: {
        processingTime: 'improving' | 'stable' | 'degrading';
        memoryUsage: 'improving' | 'stable' | 'degrading';
        errorRate: 'improving' | 'stable' | 'degrading';
      };
    },
    suggestions: OptimizationSuggestion[]
  ): string {
    const criticalIssues = suggestions.filter(s => s.severity === 'critical').length;
    const highIssues = suggestions.filter(s => s.severity === 'high').length;
    
    if (criticalIssues > 0) {
      return `パフォーマンスに重大な問題があります。${criticalIssues}件の緊急改善事項があります。`;
    } else if (highIssues > 0) {
      return `パフォーマンスに改善の余地があります。${highIssues}件の重要な最適化項目があります。`;
    } else if (suggestions.length > 0) {
      return `パフォーマンスは良好です。${suggestions.length}件の軽微な最適化提案があります。`;
    } else {
      return 'パフォーマンスは最適化されています。';
    }
  }

  /**
   * パフォーマンスメトリクスを保存
   */
  private async savePerformanceMetrics(): Promise<void> {
    try {
      const data = {
        metrics: this.metrics.slice(-100), // 最新100件を保存
        thresholds: this.thresholds,
        timestamp: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(PERFORMANCE_LOG_KEY, JSON.stringify(data));
      console.log('✅ パフォーマンスメトリクス保存完了');
    } catch (error) {
      console.error('❌ パフォーマンスメトリクス保存エラー:', error);
    }
  }

  /**
   * パフォーマンスメトリクスを読み込み
   */
  private async loadPerformanceMetrics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PERFORMANCE_LOG_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.metrics = data.metrics || [];
        this.thresholds = { ...this.thresholds, ...data.thresholds };
        console.log(`✅ ${this.metrics.length}件のパフォーマンスメトリクスを読み込み`);
      }
    } catch (error) {
      console.error('❌ パフォーマンスメトリクス読み込みエラー:', error);
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.stopMonitoring();
    this.timers.clear();
  }
}