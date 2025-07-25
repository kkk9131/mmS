import * as React from 'react';
import { performanceManager } from './PerformanceManager';
import { 
  PerformanceMetrics, 
  AlertThresholds, 
  TimeRange, 
  PerformanceReport,
  PerformanceErrorType,
  PerformanceIssue
} from './types';

/**
 * アラート通知のインターフェース
 */
interface PerformanceAlert {
  id: string;
  type: PerformanceErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  context: {
    screenName: string;
    userAction: string;
    deviceInfo: any;
  };
  resolved: boolean;
}

/**
 * メトリクス収集の設定
 */
interface MetricsCollectionConfig {
  fpsMonitoring: boolean;
  memoryMonitoring: boolean;
  networkMonitoring: boolean;
  userInteractionMonitoring: boolean;
  intervalMs: number;
}

/**
 * パフォーマンス監視システムの中核クラス
 * リアルタイム監視、アラート、レポート生成を担当
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private isMonitoring: boolean = false;
  private metrics: PerformanceMetrics = {
    fps: [],
    renderTimes: [],
    memoryUsage: [],
    networkLatency: [],
    userInteractionDelay: []
  };
  private alerts: PerformanceAlert[] = [];
  private alertThresholds: AlertThresholds;
  private collectionConfig: MetricsCollectionConfig;
  private intervalId: number | null = null;
  private lastFPSTime: number = 0;
  private frameCount: number = 0;

  private constructor() {
    this.alertThresholds = {
      lowFPS: 45,
      highMemoryUsage: 80,
      slowRenderTime: 16,
      highNetworkLatency: 2000
    };

    this.collectionConfig = {
      fpsMonitoring: true,
      memoryMonitoring: true,
      networkMonitoring: true,
      userInteractionMonitoring: true,
      intervalMs: 5000
    };
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * パフォーマンス監視の開始
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('PerformanceMonitor: 既に監視中です');
      return;
    }

    this.isMonitoring = true;
    console.log('PerformanceMonitor: パフォーマンス監視を開始しました');

    // FPS監視の開始
    this.startFPSMonitoring();

    // 定期的なメトリクス収集
    this.intervalId = setInterval(() => {
      this.collectAllMetrics();
    }, this.collectionConfig.intervalMs) as number;

    // ユーザーインタラクション監視
    this.startUserInteractionMonitoring();
  }

  /**
   * パフォーマンス監視の停止
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('PerformanceMonitor: 監視は実行されていません');
      return;
    }

    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('PerformanceMonitor: パフォーマンス監視を停止しました');
  }

  /**
   * メトリクスの記録
   */
  public recordMetric(
    name: string, 
    value: number, 
    tags?: Record<string, string>
  ): void {
    const timestamp = Date.now();
    
    switch (name.toLowerCase()) {
      case 'fps':
        this.metrics.fps.push(value);
        this.checkFPSAlert(value);
        break;
      case 'rendertime':
        this.metrics.renderTimes.push(value);
        this.checkRenderTimeAlert(value);
        break;
      case 'memoryusage':
        this.metrics.memoryUsage.push(value);
        this.checkMemoryAlert(value);
        break;
      case 'networklatency':
        this.metrics.networkLatency.push(value);
        this.checkNetworkAlert(value);
        break;
      case 'userinteractiondelay':
        this.metrics.userInteractionDelay.push(value);
        break;
      default:
        console.warn(`PerformanceMonitor: 未知のメトリクス名 ${name}`);
    }

    // メトリクスの履歴制限（最新1000件まで）
    this.limitMetricsHistory();

    // タグ付きログ出力
    if (tags) {
      console.log(`PerformanceMonitor: ${name}=${value}`, tags);
    }
  }

  /**
   * 指定期間のメトリクス取得
   */
  public getMetrics(timeRange?: TimeRange): PerformanceMetrics {
    // 時間範囲フィルタリングは簡略化
    // 実際の実装では timestamp ベースのフィルタリングが必要
    return {
      fps: [...this.metrics.fps],
      renderTimes: [...this.metrics.renderTimes],
      memoryUsage: [...this.metrics.memoryUsage],
      networkLatency: [...this.metrics.networkLatency],
      userInteractionDelay: [...this.metrics.userInteractionDelay]
    };
  }

  /**
   * パフォーマンスレポートの生成
   */
  public generateReport(): PerformanceReport {
    const currentMetrics = this.getMetrics();
    
    // 平均値の計算
    const avgFPS = this.calculateAverage(currentMetrics.fps);
    const avgMemory = this.calculateAverage(currentMetrics.memoryUsage);
    const avgRenderTime = this.calculateAverage(currentMetrics.renderTimes);
    const avgNetworkLatency = this.calculateAverage(currentMetrics.networkLatency);

    // 問題の検出
    const issues = this.detectPerformanceIssues(currentMetrics);
    
    // 推奨事項の生成
    const recommendations = this.generateRecommendations(issues);

    return {
      timestamp: new Date(),
      fps: avgFPS,
      memoryUsage: avgMemory,
      renderTime: avgRenderTime,
      batterLevel: 100, // TODO: 実際のバッテリーレベル取得
      issues,
      recommendations
    };
  }

  /**
   * アラート閾値の設定
   */
  public setAlertThresholds(thresholds: AlertThresholds): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log('PerformanceMonitor: アラート閾値を更新しました', this.alertThresholds);
  }

  /**
   * アラート履歴の取得
   */
  public getAlerts(includeResolved: boolean = false): PerformanceAlert[] {
    if (includeResolved) {
      return [...this.alerts];
    }
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * アラートの解決
   */
  public resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`PerformanceMonitor: アラート ${alertId} を解決しました`);
    }
  }

  /**
   * 統計情報の取得
   */
  public getStats(): {
    totalMetrics: number;
    activeAlerts: number;
    averagePerformance: {
      fps: number;
      memory: number;
      renderTime: number;
      networkLatency: number;
    };
    uptime: number;
  } {
    const totalMetrics = 
      this.metrics.fps.length +
      this.metrics.renderTimes.length +
      this.metrics.memoryUsage.length +
      this.metrics.networkLatency.length +
      this.metrics.userInteractionDelay.length;

    const activeAlerts = this.getAlerts(false).length;

    return {
      totalMetrics,
      activeAlerts,
      averagePerformance: {
        fps: this.calculateAverage(this.metrics.fps),
        memory: this.calculateAverage(this.metrics.memoryUsage),
        renderTime: this.calculateAverage(this.metrics.renderTimes),
        networkLatency: this.calculateAverage(this.metrics.networkLatency)
      },
      uptime: this.isMonitoring ? Date.now() - this.lastFPSTime : 0
    };
  }

  /**
   * FPS監視の開始
   */
  private startFPSMonitoring(): void {
    this.lastFPSTime = Date.now();
    this.frameCount = 0;

    const measureFPS = () => {
      if (!this.isMonitoring) return;

      this.frameCount++;
      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastFPSTime;

      // 1秒間隔でFPSを計算
      if (deltaTime >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / deltaTime);
        this.recordMetric('fps', fps);
        
        this.frameCount = 0;
        this.lastFPSTime = currentTime;
      }

      // 次のフレームで再実行
      if (this.isMonitoring) {
        requestAnimationFrame(measureFPS);
      }
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * 全メトリクスの収集
   */
  private collectAllMetrics(): void {
    if (!this.isMonitoring) return;

    // メモリ使用量の収集
    if (this.collectionConfig.memoryMonitoring) {
      const memoryUsage = this.getCurrentMemoryUsage();
      this.recordMetric('memoryusage', memoryUsage);
    }

    // ネットワーク遅延の収集
    if (this.collectionConfig.networkMonitoring) {
      this.measureNetworkLatency();
    }
  }

  /**
   * ユーザーインタラクション監視の開始
   */
  private startUserInteractionMonitoring(): void {
    // タッチイベントの監視（簡略化版）
    // 実際の実装では、React NativeのPanResponderやGestureHandlerを使用
    
    let lastInteractionTime = 0;
    
    const measureInteractionDelay = () => {
      const currentTime = Date.now();
      if (lastInteractionTime > 0) {
        const delay = currentTime - lastInteractionTime;
        this.recordMetric('userinteractiondelay', delay);
      }
      lastInteractionTime = currentTime;
    };

    // 仮のインタラクション測定（実際の実装では適切なイベントリスナーを使用）
    console.log('PerformanceMonitor: ユーザーインタラクション監視を開始しました');
  }

  /**
   * 現在のメモリ使用量を取得
   */
  private getCurrentMemoryUsage(): number {
    // 実際の実装では react-native-device-info を使用
    return Math.random() * 100 + 50; // 仮の値
  }

  /**
   * ネットワーク遅延の測定
   */
  private measureNetworkLatency(): void {
    const startTime = Date.now();
    
    // 簡単なHTTPリクエストでの遅延測定
    fetch('https://www.google.com', { 
      method: 'HEAD',
      cache: 'no-cache'
    })
    .then(() => {
      const latency = Date.now() - startTime;
      this.recordMetric('networklatency', latency);
    })
    .catch(() => {
      // ネットワークエラーの場合は高い遅延として記録
      this.recordMetric('networklatency', 5000);
    });
  }

  /**
   * 平均値計算のユーティリティ
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  /**
   * メトリクス履歴の制限
   */
  private limitMetricsHistory(): void {
    const maxHistory = 1000;
    
    if (this.metrics.fps.length > maxHistory) {
      this.metrics.fps = this.metrics.fps.slice(-maxHistory);
    }
    if (this.metrics.renderTimes.length > maxHistory) {
      this.metrics.renderTimes = this.metrics.renderTimes.slice(-maxHistory);
    }
    if (this.metrics.memoryUsage.length > maxHistory) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-maxHistory);
    }
    if (this.metrics.networkLatency.length > maxHistory) {
      this.metrics.networkLatency = this.metrics.networkLatency.slice(-maxHistory);
    }
    if (this.metrics.userInteractionDelay.length > maxHistory) {
      this.metrics.userInteractionDelay = this.metrics.userInteractionDelay.slice(-maxHistory);
    }
  }

  /**
   * FPSアラートのチェック
   */
  private checkFPSAlert(fps: number): void {
    if (fps < this.alertThresholds.lowFPS) {
      this.createAlert({
        type: PerformanceErrorType.LOW_FPS,
        severity: fps < 30 ? 'critical' : 'high',
        message: `FPSが低下しています: ${fps}fps (閾値: ${this.alertThresholds.lowFPS}fps)`
      });
    }
  }

  /**
   * レンダータイムアラートのチェック
   */
  private checkRenderTimeAlert(renderTime: number): void {
    if (renderTime > this.alertThresholds.slowRenderTime) {
      this.createAlert({
        type: PerformanceErrorType.SLOW_RENDER,
        severity: renderTime > 33 ? 'high' : 'medium',
        message: `レンダリング時間が遅延しています: ${renderTime}ms (閾値: ${this.alertThresholds.slowRenderTime}ms)`
      });
    }
  }

  /**
   * メモリアラートのチェック
   */
  private checkMemoryAlert(memoryUsage: number): void {
    if (memoryUsage > this.alertThresholds.highMemoryUsage) {
      this.createAlert({
        type: PerformanceErrorType.HIGH_MEMORY_USAGE,
        severity: memoryUsage > 150 ? 'critical' : 'high',
        message: `メモリ使用量が高すぎます: ${memoryUsage}MB (閾値: ${this.alertThresholds.highMemoryUsage}MB)`
      });
    }
  }

  /**
   * ネットワークアラートのチェック
   */
  private checkNetworkAlert(latency: number): void {
    if (latency > this.alertThresholds.highNetworkLatency) {
      this.createAlert({
        type: PerformanceErrorType.BATTERY_DRAIN, // ネットワーク遅延はバッテリー消費にも影響
        severity: latency > 5000 ? 'high' : 'medium',
        message: `ネットワーク遅延が発生しています: ${latency}ms (閾値: ${this.alertThresholds.highNetworkLatency}ms)`
      });
    }
  }

  /**
   * アラートの作成
   */
  private createAlert(alertData: {
    type: PerformanceErrorType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date(),
      context: {
        screenName: 'unknown', // TODO: 現在の画面名を取得
        userAction: 'unknown', // TODO: 現在のユーザーアクションを取得
        deviceInfo: {} // TODO: デバイス情報を取得
      },
      resolved: false
    };

    this.alerts.push(alert);
    
    // アラート履歴の制限（最新100件まで）
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn(`PerformanceMonitor: ${alertData.severity.toUpperCase()} アラート`, alert);
  }

  /**
   * パフォーマンス問題の検出
   */
  private detectPerformanceIssues(metrics: PerformanceMetrics): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    
    const avgFPS = this.calculateAverage(metrics.fps);
    const avgMemory = this.calculateAverage(metrics.memoryUsage);
    const avgRenderTime = this.calculateAverage(metrics.renderTimes);

    if (avgFPS < this.alertThresholds.lowFPS) {
      issues.push({
        type: PerformanceErrorType.LOW_FPS,
        severity: avgFPS < 30 ? 'critical' : 'high',
        description: `平均FPSが低下 (${avgFPS.toFixed(1)}fps)`,
        affectedComponents: ['アニメーション', 'スクロール'],
        suggestedFix: 'レンダリング最適化とコンポーネントメモ化を実施してください'
      });
    }

    if (avgMemory > this.alertThresholds.highMemoryUsage) {
      issues.push({
        type: PerformanceErrorType.HIGH_MEMORY_USAGE,
        severity: avgMemory > 150 ? 'critical' : 'high',
        description: `平均メモリ使用量が高い (${avgMemory.toFixed(1)}MB)`,
        affectedComponents: ['画像表示', 'キャッシュ'],
        suggestedFix: 'メモリキャッシュのクリアと画像最適化を実行してください'
      });
    }

    if (avgRenderTime > this.alertThresholds.slowRenderTime) {
      issues.push({
        type: PerformanceErrorType.SLOW_RENDER,
        severity: avgRenderTime > 33 ? 'high' : 'medium',
        description: `平均レンダリング時間が遅い (${avgRenderTime.toFixed(1)}ms)`,
        affectedComponents: ['UI更新'],
        suggestedFix: 'コンポーネントの複雑さを軽減し、メモ化を活用してください'
      });
    }

    return issues;
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.type === PerformanceErrorType.LOW_FPS)) {
      recommendations.push('不要なアニメーションを削減してください');
      recommendations.push('コンポーネントのレンダリング頻度を最適化してください');
    }

    if (issues.some(issue => issue.type === PerformanceErrorType.HIGH_MEMORY_USAGE)) {
      recommendations.push('画像キャッシュをクリアしてください');
      recommendations.push('メモリリークの可能性を調査してください');
    }

    if (issues.some(issue => issue.type === PerformanceErrorType.SLOW_RENDER)) {
      recommendations.push('React.memoとuseCallbackを活用してください');
      recommendations.push('重い計算処理を別スレッドに移動してください');
    }

    if (recommendations.length === 0) {
      recommendations.push('現在のパフォーマンスは良好です');
    }

    return recommendations;
  }
}

/**
 * パフォーマンス監視用カスタムフック
 */
export const usePerformanceMonitoring = () => {
  const monitor = PerformanceMonitor.getInstance();
  
  const [isActive, setIsActive] = React.useState(false);
  
  const startMonitoring = () => {
    monitor.startMonitoring();
    setIsActive(true);
  };
  
  const stopMonitoring = () => {
    monitor.stopMonitoring();
    setIsActive(false);
  };
  
  const recordMetric = (name: string, value: number, tags?: Record<string, string>) => {
    monitor.recordMetric(name, value, tags);
  };
  
  const getStats = () => {
    return monitor.getStats();
  };

  return {
    isActive,
    startMonitoring,
    stopMonitoring,
    recordMetric,
    getStats
  };
};

// シングルトンインスタンスのエクスポート
export const performanceMonitor = PerformanceMonitor.getInstance();