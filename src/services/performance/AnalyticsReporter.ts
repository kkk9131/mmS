import * as React from 'react';
import { performanceManager } from './PerformanceManager';
import { backgroundOptimizer } from './BackgroundOptimizer';
import { batteryOptimizer } from './BatteryOptimizer';

/**
 * パフォーマンス分析レポートの種類
 */
export enum ReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  REAL_TIME = 'realtime'
}

/**
 * ユーザー体験メトリクス
 */
export interface UserExperienceMetrics {
  averageLoadTime: number;
  averageFPS: number;
  memoryUsage: number;
  batteryImpact: number;
  crashRate: number;
  userSatisfactionScore: number;
  interactionLatency: number;
  scrollPerformance: number;
  imageLoadTime: number;
  networkLatency: number;
}

/**
 * パフォーマンス分析データ
 */
export interface PerformanceAnalytics {
  timestamp: number;
  period: string;
  userExperience: UserExperienceMetrics;
  technicalMetrics: {
    renderTime: number[];
    memoryLeaks: number;
    backgroundTasksCount: number;
    errorCount: number;
    optimizationImpact: number;
  };
  deviceInfo: {
    model: string;
    osVersion: string;
    appVersion: string;
    screenResolution: string;
    memoryCapacity: number;
  };
  usagePatterns: {
    sessionDuration: number;
    screenTimeDaily: number;
    featureMostUsed: string[];
    timeOfDayUsage: number[];
  };
}

/**
 * レポート生成設定
 */
export interface ReportConfig {
  type: ReportType;
  includeUserExperience: boolean;
  includeTechnicalMetrics: boolean;
  includeDeviceInfo: boolean;
  includeUsagePatterns: boolean;
  exportFormat: 'json' | 'csv' | 'pdf';
  emailReport: boolean;
  emailAddress?: string;
}

/**
 * 体験品質スコア
 */
export interface ExperienceQualityScore {
  overall: number;
  performance: number;
  reliability: number;
  usability: number;
  battery: number;
  recommendations: string[];
}

/**
 * 分析・レポート生成クラス
 * アプリのパフォーマンスとユーザー体験を継続的に監視し、
 * 詳細な分析レポートを生成する
 */
export class AnalyticsReporter {
  private static instance: AnalyticsReporter;
  private metricsBuffer: Map<string, any[]> = new Map();
  private reportScheduler: number | null = null;
  private isCollecting: boolean = false;
  private config: ReportConfig;
  private reportHistory: PerformanceAnalytics[] = [];
  private userInteractions: Map<string, number[]> = new Map();

  private constructor() {
    this.config = {
      type: ReportType.DAILY,
      includeUserExperience: true,
      includeTechnicalMetrics: true,
      includeDeviceInfo: true,
      includeUsagePatterns: true,
      exportFormat: 'json',
      emailReport: false
    };

    this.initializeMetricsCollection();
  }

  public static getInstance(): AnalyticsReporter {
    if (!AnalyticsReporter.instance) {
      AnalyticsReporter.instance = new AnalyticsReporter();
    }
    return AnalyticsReporter.instance;
  }

  /**
   * データ収集の開始
   */
  public startCollection(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.startMetricsCollection();
    this.scheduleReports();
    
    console.log('AnalyticsReporter: データ収集を開始しました');
  }

  /**
   * データ収集の停止
   */
  public stopCollection(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;
    this.stopMetricsCollection();
    this.cancelScheduledReports();
    
    console.log('AnalyticsReporter: データ収集を停止しました');
  }

  /**
   * レポート設定の更新
   */
  public updateConfig(newConfig: Partial<ReportConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isCollecting) {
      this.cancelScheduledReports();
      this.scheduleReports();
    }

    console.log('AnalyticsReporter: レポート設定を更新しました');
  }

  /**
   * 即座にレポートを生成
   */
  public async generateReport(type: ReportType = ReportType.REAL_TIME): Promise<PerformanceAnalytics> {
    const report = await this.createReport(type);
    this.reportHistory.push(report);
    
    console.log(`AnalyticsReporter: ${type}レポートを生成しました`);
    return report;
  }

  /**
   * ユーザー体験スコアの計算
   */
  public calculateExperienceScore(): ExperienceQualityScore {
    const currentMetrics = this.getCurrentMetrics();
    
    const performanceScore = this.calculatePerformanceScore(currentMetrics);
    const reliabilityScore = this.calculateReliabilityScore(currentMetrics);
    const usabilityScore = this.calculateUsabilityScore(currentMetrics);
    const batteryScore = this.calculateBatteryScore(currentMetrics);
    
    const overall = (performanceScore + reliabilityScore + usabilityScore + batteryScore) / 4;
    
    const recommendations = this.generateRecommendations({
      performance: performanceScore,
      reliability: reliabilityScore,
      usability: usabilityScore,
      battery: batteryScore
    });

    return {
      overall: Math.round(overall),
      performance: Math.round(performanceScore),
      reliability: Math.round(reliabilityScore),
      usability: Math.round(usabilityScore),
      battery: Math.round(batteryScore),
      recommendations
    };
  }

  /**
   * ユーザーインタラクションの記録
   */
  public recordUserInteraction(action: string, duration: number): void {
    if (!this.isCollecting) return;

    if (!this.userInteractions.has(action)) {
      this.userInteractions.set(action, []);
    }

    this.userInteractions.get(action)!.push(duration);
    
    // バッファサイズ制限
    const interactions = this.userInteractions.get(action)!;
    if (interactions.length > 1000) {
      interactions.splice(0, interactions.length - 1000);
    }
  }

  /**
   * カスタムメトリクスの記録
   */
  public recordCustomMetric(key: string, value: any): void {
    if (!this.isCollecting) return;

    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, []);
    }

    this.metricsBuffer.get(key)!.push({
      timestamp: Date.now(),
      value
    });

    // バッファサイズ制限
    const metrics = this.metricsBuffer.get(key)!;
    if (metrics.length > 5000) {
      metrics.splice(0, metrics.length - 5000);
    }
  }

  /**
   * レポート履歴の取得
   */
  public getReportHistory(limit: number = 10): PerformanceAnalytics[] {
    return this.reportHistory.slice(-limit);
  }

  /**
   * レポートのエクスポート
   */
  public async exportReport(report: PerformanceAnalytics, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<string> {
    switch (format) {
      case 'json':
        return this.exportAsJSON(report);
      case 'csv':
        return this.exportAsCSV(report);
      case 'pdf':
        return await this.exportAsPDF(report);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * リアルタイム監視の開始
   */
  public startRealTimeMonitoring(callback: (metrics: UserExperienceMetrics) => void): void {
    const monitoringInterval = setInterval(() => {
      if (this.isCollecting) {
        const metrics = this.getCurrentMetrics();
        callback(metrics);
      }
    }, 5000) as number; // 5秒毎

    // クリーンアップ用にintervalIdを保存
    this.metricsBuffer.set('realtime-monitoring', [monitoringInterval]);
  }

  /**
   * パフォーマンス異常の検出
   */
  public detectPerformanceAnomalies(): {
    detected: boolean;
    anomalies: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const metrics = this.getCurrentMetrics();
    const anomalies: string[] = [];

    // FPS低下の検出
    if (metrics.averageFPS < 20) {
      anomalies.push('FPS critically low');
    } else if (metrics.averageFPS < 30) {
      anomalies.push('FPS below optimal');
    }

    // メモリ使用量の検出
    if (metrics.memoryUsage > 90) {
      anomalies.push('Memory usage critically high');
    } else if (metrics.memoryUsage > 75) {
      anomalies.push('Memory usage high');
    }

    // 読み込み時間の検出
    if (metrics.averageLoadTime > 5000) {
      anomalies.push('Load time critically slow');
    } else if (metrics.averageLoadTime > 3000) {
      anomalies.push('Load time slow');
    }

    // インタラクション遅延の検出
    if (metrics.interactionLatency > 300) {
      anomalies.push('Interaction latency high');
    }

    // バッテリー影響の検出
    if (metrics.batteryImpact > 25) {
      anomalies.push('Battery impact high');
    }

    const severity = this.calculateAnomalySeverity(anomalies);

    return {
      detected: anomalies.length > 0,
      anomalies,
      severity
    };
  }

  /**
   * メトリクス収集の初期化
   */
  private initializeMetricsCollection(): void {
    // 各種メトリクスバッファの初期化
    this.metricsBuffer.set('fps', []);
    this.metricsBuffer.set('memory', []);
    this.metricsBuffer.set('loadTime', []);
    this.metricsBuffer.set('renderTime', []);
    this.metricsBuffer.set('interactions', []);
    this.metricsBuffer.set('errors', []);
  }

  /**
   * メトリクス収集の開始
   */
  private startMetricsCollection(): void {
    // パフォーマンスマネージャーからのメトリクス収集
    const collectInterval = setInterval(() => {
      if (!this.isCollecting) return;

      this.collectSystemMetrics();
      this.collectPerformanceMetrics();
      this.collectUserExperienceMetrics();
    }, 10000) as number; // 10秒毎

    this.metricsBuffer.set('collection-interval', [collectInterval]);
  }

  /**
   * メトリクス収集の停止
   */
  private stopMetricsCollection(): void {
    const interval = this.metricsBuffer.get('collection-interval')?.[0];
    if (interval) {
      clearInterval(interval);
    }

    const realtimeInterval = this.metricsBuffer.get('realtime-monitoring')?.[0];
    if (realtimeInterval) {
      clearInterval(realtimeInterval);
    }
  }

  /**
   * システムメトリクスの収集
   */
  private collectSystemMetrics(): void {
    const batteryStats = batteryOptimizer.getBatteryStats();
    const backgroundStats = backgroundOptimizer.getStats();

    this.recordCustomMetric('battery-level', batteryStats.currentLevel);
    this.recordCustomMetric('battery-impact', batteryStats.optimizationImpact);
    this.recordCustomMetric('background-tasks', backgroundStats.activeTasks);
    this.recordCustomMetric('memory-usage', this.getMemoryUsage());
  }

  /**
   * パフォーマンスメトリクスの収集
   */
  private collectPerformanceMetrics(): void {
    // パフォーマンスマネージャーからデータを取得
    const fps = this.getCurrentFPS();
    const renderTime = this.getCurrentRenderTime();
    
    this.recordCustomMetric('fps', fps);
    this.recordCustomMetric('render-time', renderTime);
  }

  /**
   * ユーザー体験メトリクスの収集
   */
  private collectUserExperienceMetrics(): void {
    const loadTime = this.getAverageLoadTime();
    const interactionLatency = this.getAverageInteractionLatency();
    
    this.recordCustomMetric('load-time', loadTime);
    this.recordCustomMetric('interaction-latency', interactionLatency);
  }

  /**
   * レポートのスケジューリング
   */
  private scheduleReports(): void {
    const intervals = {
      [ReportType.DAILY]: 24 * 60 * 60 * 1000, // 24時間
      [ReportType.WEEKLY]: 7 * 24 * 60 * 60 * 1000, // 7日
      [ReportType.MONTHLY]: 30 * 24 * 60 * 60 * 1000, // 30日
      [ReportType.REAL_TIME]: 60 * 1000 // 1分（リアルタイム）
    };

    const interval = intervals[this.config.type];
    if (!interval) return;

    this.reportScheduler = setInterval(async () => {
      const report = await this.generateReport(this.config.type);
      
      if (this.config.emailReport && this.config.emailAddress) {
        await this.sendEmailReport(report, this.config.emailAddress);
      }
    }, interval) as number;
  }

  /**
   * スケジュールされたレポートのキャンセル
   */
  private cancelScheduledReports(): void {
    if (this.reportScheduler) {
      clearInterval(this.reportScheduler);
      this.reportScheduler = null;
    }
  }

  /**
   * レポートの作成
   */
  private async createReport(type: ReportType): Promise<PerformanceAnalytics> {
    const now = Date.now();
    const period = this.getReportPeriodString(type, now);

    const report: PerformanceAnalytics = {
      timestamp: now,
      period,
      userExperience: this.getCurrentMetrics(),
      technicalMetrics: {
        renderTime: this.getMetricValues('render-time'),
        memoryLeaks: this.detectMemoryLeaks(),
        backgroundTasksCount: backgroundOptimizer.getStats().activeTasks,
        errorCount: this.getMetricValues('errors').length,
        optimizationImpact: batteryOptimizer.getBatteryStats().optimizationImpact
      },
      deviceInfo: this.getDeviceInfo(),
      usagePatterns: this.getUsagePatterns()
    };

    return report;
  }

  /**
   * 現在のメトリクスの取得
   */
  private getCurrentMetrics(): UserExperienceMetrics {
    return {
      averageLoadTime: this.getAverageLoadTime(),
      averageFPS: this.getCurrentFPS(),
      memoryUsage: this.getMemoryUsage(),
      batteryImpact: batteryOptimizer.getBatteryStats().optimizationImpact,
      crashRate: this.getCrashRate(),
      userSatisfactionScore: this.calculateUserSatisfactionScore(),
      interactionLatency: this.getAverageInteractionLatency(),
      scrollPerformance: this.getScrollPerformance(),
      imageLoadTime: this.getImageLoadTime(),
      networkLatency: this.getNetworkLatency()
    };
  }

  /**
   * パフォーマンススコアの計算
   */
  private calculatePerformanceScore(metrics: UserExperienceMetrics): number {
    let score = 100;

    // FPS評価
    if (metrics.averageFPS < 20) score -= 30;
    else if (metrics.averageFPS < 30) score -= 20;
    else if (metrics.averageFPS < 45) score -= 10;

    // 読み込み時間評価
    if (metrics.averageLoadTime > 5000) score -= 25;
    else if (metrics.averageLoadTime > 3000) score -= 15;
    else if (metrics.averageLoadTime > 2000) score -= 10;

    // インタラクション遅延評価
    if (metrics.interactionLatency > 300) score -= 20;
    else if (metrics.interactionLatency > 200) score -= 10;
    else if (metrics.interactionLatency > 100) score -= 5;

    return Math.max(0, score);
  }

  /**
   * 信頼性スコアの計算
   */
  private calculateReliabilityScore(metrics: UserExperienceMetrics): number {
    let score = 100;

    // クラッシュ率評価
    if (metrics.crashRate > 5) score -= 40;
    else if (metrics.crashRate > 3) score -= 30;
    else if (metrics.crashRate > 1) score -= 20;
    else if (metrics.crashRate > 0.1) score -= 10;

    // メモリ使用量評価
    if (metrics.memoryUsage > 90) score -= 30;
    else if (metrics.memoryUsage > 80) score -= 20;
    else if (metrics.memoryUsage > 70) score -= 10;

    return Math.max(0, score);
  }

  /**
   * ユーザビリティスコアの計算
   */
  private calculateUsabilityScore(metrics: UserExperienceMetrics): number {
    let score = 100;

    // スクロールパフォーマンス評価
    if (metrics.scrollPerformance < 60) score -= 20;
    else if (metrics.scrollPerformance < 80) score -= 10;

    // 画像読み込み時間評価
    if (metrics.imageLoadTime > 3000) score -= 15;
    else if (metrics.imageLoadTime > 2000) score -= 10;
    else if (metrics.imageLoadTime > 1000) score -= 5;

    // ネットワーク遅延評価
    if (metrics.networkLatency > 2000) score -= 15;
    else if (metrics.networkLatency > 1000) score -= 10;
    else if (metrics.networkLatency > 500) score -= 5;

    return Math.max(0, score);
  }

  /**
   * バッテリースコアの計算
   */
  private calculateBatteryScore(metrics: UserExperienceMetrics): number {
    let score = 100;

    // バッテリー影響評価
    if (metrics.batteryImpact > 30) score -= 40;
    else if (metrics.batteryImpact > 20) score -= 30;
    else if (metrics.batteryImpact > 15) score -= 20;
    else if (metrics.batteryImpact > 10) score -= 10;

    return Math.max(0, score);
  }

  /**
   * 改善提案の生成
   */
  private generateRecommendations(scores: { performance: number; reliability: number; usability: number; battery: number }): string[] {
    const recommendations: string[] = [];

    if (scores.performance < 70) {
      recommendations.push('FPS最適化とレンダリング性能の改善が必要です');
      recommendations.push('重い処理の非同期化を検討してください');
    }

    if (scores.reliability < 70) {
      recommendations.push('メモリリークの調査と修正が必要です');
      recommendations.push('エラーハンドリングの強化を推奨します');
    }

    if (scores.usability < 70) {
      recommendations.push('スクロール性能の最適化が必要です');
      recommendations.push('画像の遅延読み込みの実装を検討してください');
    }

    if (scores.battery < 70) {
      recommendations.push('バックグラウンド処理の最適化が必要です');
      recommendations.push('パワーセーブ機能の活用を推奨します');
    }

    return recommendations;
  }

  // ヘルパーメソッド群
  private getReportPeriodString(type: ReportType, timestamp: number): string {
    const date = new Date(timestamp);
    switch (type) {
      case ReportType.DAILY:
        return date.toISOString().split('T')[0];
      case ReportType.WEEKLY:
        const startOfWeek = new Date(date.setDate(date.getDate() - date.getDay()));
        return `Week of ${startOfWeek.toISOString().split('T')[0]}`;
      case ReportType.MONTHLY:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return 'Real-time';
    }
  }

  private getMetricValues(key: string): number[] {
    return this.metricsBuffer.get(key)?.map(item => item.value) || [];
  }

  private getCurrentFPS(): number {
    const fpsValues = this.getMetricValues('fps');
    return fpsValues.length > 0 ? fpsValues.reduce((a, b) => a + b) / fpsValues.length : 60;
  }

  private getCurrentRenderTime(): number {
    const renderTimes = this.getMetricValues('render-time');
    return renderTimes.length > 0 ? renderTimes.reduce((a, b) => a + b) / renderTimes.length : 16;
  }

  private getMemoryUsage(): number {
    // 実際の実装では、React Nativeのメモリ情報を取得
    return Math.random() * 100; // 仮の値
  }

  private getAverageLoadTime(): number {
    const loadTimes = this.getMetricValues('load-time');
    return loadTimes.length > 0 ? loadTimes.reduce((a, b) => a + b) / loadTimes.length : 1000;
  }

  private getAverageInteractionLatency(): number {
    const latencies = this.getMetricValues('interaction-latency');
    return latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 50;
  }

  private getCrashRate(): number {
    // 実際の実装では、クラッシュレポートからデータを取得
    return 0.1; // 仮の値
  }

  private calculateUserSatisfactionScore(): number {
    // 実際の実装では、ユーザーフィードバックから算出
    return 85; // 仮の値
  }

  private getScrollPerformance(): number {
    // スクロール時のFPSから算出
    return this.getCurrentFPS();
  }

  private getImageLoadTime(): number {
    // 画像読み込み時間の平均値
    return 800; // 仮の値
  }

  private getNetworkLatency(): number {
    // ネットワーク遅延の測定値
    return 200; // 仮の値
  }

  private detectMemoryLeaks(): number {
    // メモリリークの検出数
    return 0; // 仮の値
  }

  private getDeviceInfo(): any {
    return batteryOptimizer.getDeviceProfile();
  }

  private getUsagePatterns(): any {
    return {
      sessionDuration: 1800000, // 30分
      screenTimeDaily: 7200000, // 2時間
      featureMostUsed: ['home', 'profile', 'post'],
      timeOfDayUsage: [10, 15, 25, 30, 20] // 時間帯別使用率
    };
  }

  private calculateAnomalySeverity(anomalies: string[]): 'low' | 'medium' | 'high' {
    const criticalCount = anomalies.filter(a => a.includes('critically')).length;
    if (criticalCount >= 2) return 'high';
    if (criticalCount >= 1 || anomalies.length >= 3) return 'medium';
    return 'low';
  }

  private exportAsJSON(report: PerformanceAnalytics): string {
    return JSON.stringify(report, null, 2);
  }

  private exportAsCSV(report: PerformanceAnalytics): string {
    // CSV形式での出力実装
    const headers = ['Timestamp', 'Period', 'Average FPS', 'Memory Usage', 'Load Time', 'Battery Impact'];
    const values = [
      report.timestamp,
      report.period,
      report.userExperience.averageFPS,
      report.userExperience.memoryUsage,
      report.userExperience.averageLoadTime,
      report.userExperience.batteryImpact
    ];
    
    return `${headers.join(',')}\n${values.join(',')}`;
  }

  private async exportAsPDF(report: PerformanceAnalytics): Promise<string> {
    // PDF形式での出力実装（実際にはライブラリが必要）
    return `PDF export for report ${report.timestamp}`;
  }

  private async sendEmailReport(report: PerformanceAnalytics, email: string): Promise<void> {
    // メール送信の実装
    console.log(`Sending report to ${email}`);
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    this.stopCollection();
    this.metricsBuffer.clear();
    this.userInteractions.clear();
    this.reportHistory.length = 0;
    console.log('AnalyticsReporter: クリーンアップ完了');
  }
}

/**
 * 分析レポート用カスタムフック
 */
export const useAnalyticsReporter = () => {
  const reporter = AnalyticsReporter.getInstance();
  const [experienceScore, setExperienceScore] = React.useState<ExperienceQualityScore | null>(null);
  const [currentMetrics, setCurrentMetrics] = React.useState<UserExperienceMetrics | null>(null);

  React.useEffect(() => {
    // リアルタイム監視の開始
    reporter.startRealTimeMonitoring((metrics) => {
      setCurrentMetrics(metrics);
    });

    // 体験スコアの定期更新
    const scoreInterval = setInterval(() => {
      const score = reporter.calculateExperienceScore();
      setExperienceScore(score);
    }, 30000) as number; // 30秒毎

    return () => {
      clearInterval(scoreInterval);
    };
  }, [reporter]);

  const generateReport = React.useCallback(async (type: ReportType) => {
    return await reporter.generateReport(type);
  }, [reporter]);

  const recordInteraction = React.useCallback((action: string, duration: number) => {
    reporter.recordUserInteraction(action, duration);
  }, [reporter]);

  const detectAnomalies = React.useCallback(() => {
    return reporter.detectPerformanceAnomalies();
  }, [reporter]);

  const getReportHistory = React.useCallback((limit?: number) => {
    return reporter.getReportHistory(limit);
  }, [reporter]);

  return {
    experienceScore,
    currentMetrics,
    generateReport,
    recordInteraction,
    detectAnomalies,
    getReportHistory
  };
};

// シングルトンインスタンスのエクスポート
export const analyticsReporter = AnalyticsReporter.getInstance();