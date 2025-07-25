import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PerformanceConfig,
  PerformanceReport,
  PerformanceSettings,
  PerformanceMetricsData,
  DeviceCapability,
  PerformanceErrorType,
  PerformanceIssue
} from './types';

/**
 * パフォーマンス最適化システムの中央管理クラス
 * 全ての最適化機能を統括し、設定管理とシステム初期化を担当
 */
export class PerformanceManager {
  private static instance: PerformanceManager;
  private isInitialized: boolean = false;
  private settings: PerformanceSettings | null = null;
  private config: PerformanceConfig;
  private deviceCapability: DeviceCapability | null = null;
  private metricsData: PerformanceMetricsData[] = [];
  
  // デフォルト設定
  private defaultConfig: PerformanceConfig = {
    fpsThreshold: 55,
    memoryThreshold: 80, // MB
    renderTimeThreshold: 16, // ms (60FPS)
    batteryOptimizationEnabled: true
  };

  private defaultSettings: Omit<PerformanceSettings, 'id' | 'userId'> = {
    renderingOptimization: {
      enabled: true,
      memoizationLevel: 'basic',
      rerenderThreshold: 3
    },
    listOptimization: {
      enabled: true,
      virtualizationEnabled: true,
      windowSize: 10,
      maxToRenderPerBatch: 5
    },
    memoryOptimization: {
      enabled: true,
      imageCompressionLevel: 80,
      cacheSize: 50, // MB
      garbageCollectionInterval: 30000 // 30秒
    },
    batteryOptimization: {
      enabled: true,
      powerSaveMode: false,
      backgroundTaskLimitation: true
    },
    monitoring: {
      enabled: true,
      metricsCollectionInterval: 5000, // 5秒
      alertsEnabled: true
    }
  };

  private constructor() {
    this.config = { ...this.defaultConfig };
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  /**
   * パフォーマンスマネージャーの初期化
   * デバイス情報の取得、設定の読み込み、システムの初期化を実行
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('PerformanceManager: 既に初期化済みです');
        return;
      }

      console.log('PerformanceManager: 初期化を開始します');
      
      // デバイス性能の検出
      await this.detectDeviceCapability();
      
      // 設定の読み込み
      await this.loadSettings();
      
      // デバイス性能に応じた設定調整
      this.adjustSettingsForDevice();
      
      // メトリクス収集の開始
      this.startMetricsCollection();
      
      this.isInitialized = true;
      console.log('PerformanceManager: 初期化が完了しました');
      
    } catch (error) {
      console.error('PerformanceManager初期化エラー:', error);
      throw error;
    }
  }

  /**
   * 最適化機能を有効化
   */
  public enableOptimizations(): void {
    if (!this.isInitialized) {
      console.warn('PerformanceManager: 初期化されていません');
      return;
    }

    if (this.settings) {
      this.settings.renderingOptimization.enabled = true;
      this.settings.listOptimization.enabled = true;
      this.settings.memoryOptimization.enabled = true;
      this.settings.batteryOptimization.enabled = true;
      this.settings.monitoring.enabled = true;
      
      this.saveSettings();
      console.log('PerformanceManager: 全ての最適化機能を有効化しました');
    }
  }

  /**
   * 最適化機能を無効化
   */
  public disableOptimizations(): void {
    if (!this.isInitialized) {
      console.warn('PerformanceManager: 初期化されていません');
      return;
    }

    if (this.settings) {
      this.settings.renderingOptimization.enabled = false;
      this.settings.listOptimization.enabled = false;
      this.settings.memoryOptimization.enabled = false;
      this.settings.batteryOptimization.enabled = false;
      this.settings.monitoring.enabled = false;
      
      this.saveSettings();
      console.log('PerformanceManager: 全ての最適化機能を無効化しました');
    }
  }

  /**
   * パフォーマンス閾値の設定
   */
  public configureThresholds(config: PerformanceConfig): void {
    this.config = { ...this.config, ...config };
    console.log('PerformanceManager: 閾値を更新しました', this.config);
  }

  /**
   * パフォーマンスレポートの生成
   */
  public getPerformanceReport(): PerformanceReport {
    const recentMetrics = this.metricsData.slice(-10); // 最新10件
    const avgFPS = this.calculateAverageMetric(recentMetrics, 'fps');
    const avgMemory = this.calculateAverageMetric(recentMetrics, 'memoryUsage');
    const avgRenderTime = this.calculateAverageMetric(recentMetrics, 'renderTime');
    
    const issues = this.detectPerformanceIssues(avgFPS, avgMemory, avgRenderTime);
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
   * 設定の取得
   */
  public getSettings(): PerformanceSettings | null {
    return this.settings;
  }

  /**
   * デバイス性能の検出
   */
  private async detectDeviceCapability(): Promise<void> {
    try {
      // React Native Device Infoを使用してデバイス情報を取得
      // TODO: react-native-device-infoの実装
      const totalMemory = 4000; // 仮の値、実際はDeviceInfo.getTotalMemorySync()
      const cpuType = 'unknown'; // 仮の値、実際はDeviceInfo.getSystemName()
      
      // メモリ量に基づいてデバイス性能を判定
      let tier: 'low' | 'medium' | 'high' = 'medium';
      if (totalMemory < 3000) {
        tier = 'low';
      } else if (totalMemory > 6000) {
        tier = 'high';
      }

      this.deviceCapability = {
        tier,
        memory: totalMemory,
        cpu: cpuType,
        gpu: 'unknown'
      };

      console.log('PerformanceManager: デバイス性能を検出しました', this.deviceCapability);
    } catch (error) {
      console.error('デバイス性能検出エラー:', error);
      
      // フォールバック設定
      this.deviceCapability = {
        tier: 'medium',
        memory: 4000,
        cpu: 'unknown',
        gpu: 'unknown'
      };
    }
  }

  /**
   * 設定の読み込み
   */
  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem('performance_settings');
      if (savedSettings) {
        this.settings = JSON.parse(savedSettings);
        console.log('PerformanceManager: 保存された設定を読み込みました');
      } else {
        // デフォルト設定でユーザー設定を作成
        this.settings = {
          id: `perf_${Date.now()}`,
          userId: 'default_user', // TODO: 実際のユーザーIDを取得
          ...this.defaultSettings
        };
        await this.saveSettings();
        console.log('PerformanceManager: デフォルト設定を作成しました');
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error);
      this.settings = {
        id: `perf_${Date.now()}`,
        userId: 'default_user',
        ...this.defaultSettings
      };
    }
  }

  /**
   * 設定の保存
   */
  private async saveSettings(): Promise<void> {
    try {
      if (this.settings) {
        await AsyncStorage.setItem('performance_settings', JSON.stringify(this.settings));
        console.log('PerformanceManager: 設定を保存しました');
      }
    } catch (error) {
      console.error('設定保存エラー:', error);
    }
  }

  /**
   * デバイス性能に応じた設定調整
   */
  private adjustSettingsForDevice(): void {
    if (!this.deviceCapability || !this.settings) return;

    switch (this.deviceCapability.tier) {
      case 'low':
        // 低性能デバイス向けの最適化
        this.settings.renderingOptimization.memoizationLevel = 'aggressive';
        this.settings.listOptimization.windowSize = 5;
        this.settings.listOptimization.maxToRenderPerBatch = 3;
        this.settings.memoryOptimization.imageCompressionLevel = 60;
        this.settings.memoryOptimization.cacheSize = 30;
        this.config.fpsThreshold = 45;
        break;
        
      case 'high':
        // 高性能デバイス向けの設定
        this.settings.listOptimization.windowSize = 15;
        this.settings.listOptimization.maxToRenderPerBatch = 8;
        this.settings.memoryOptimization.cacheSize = 100;
        this.config.fpsThreshold = 58;
        break;
        
      default:
        // 中性能デバイスはデフォルト設定を使用
        break;
    }

    console.log(`PerformanceManager: ${this.deviceCapability.tier}性能デバイス向けに設定を調整しました`);
  }

  /**
   * メトリクス収集の開始
   */
  private startMetricsCollection(): void {
    if (!this.settings?.monitoring.enabled) return;

    const interval = this.settings.monitoring.metricsCollectionInterval;
    
    setInterval(() => {
      this.collectMetrics();
    }, interval);

    console.log(`PerformanceManager: ${interval}ms間隔でメトリクス収集を開始しました`);
  }

  /**
   * メトリクスデータの収集
   */
  private collectMetrics(): void {
    // TODO: 実際のメトリクス収集の実装
    const metricsData: PerformanceMetricsData = {
      timestamp: new Date(),
      sessionId: `session_${Date.now()}`,
      userId: this.settings?.userId || 'unknown',
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        memory: this.deviceCapability?.memory || 0,
        cpu: this.deviceCapability?.cpu || 'unknown'
      },
      metrics: {
        fps: Math.random() * 60 + 30, // 仮の値
        renderTime: Math.random() * 20 + 5, // 仮の値
        memoryUsage: Math.random() * 100 + 50, // 仮の値
        batteryLevel: 100, // 仮の値
        networkLatency: Math.random() * 200 + 50, // 仮の値
        userInteractionDelay: Math.random() * 100 + 10 // 仮の値
      },
      context: {
        screenName: 'unknown',
        userAction: 'unknown',
        dataSize: 0
      }
    };

    this.metricsData.push(metricsData);
    
    // データ数の制限（最新1000件まで）
    if (this.metricsData.length > 1000) {
      this.metricsData = this.metricsData.slice(-1000);
    }
  }

  /**
   * メトリクスの平均値計算
   */
  private calculateAverageMetric(
    metrics: PerformanceMetricsData[], 
    field: keyof PerformanceMetricsData['metrics']
  ): number {
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, metric) => acc + metric.metrics[field], 0);
    return sum / metrics.length;
  }

  /**
   * パフォーマンス問題の検出
   */
  private detectPerformanceIssues(
    avgFPS: number, 
    avgMemory: number, 
    avgRenderTime: number
  ): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (avgFPS < this.config.fpsThreshold) {
      issues.push({
        type: PerformanceErrorType.LOW_FPS,
        severity: avgFPS < 30 ? 'critical' : 'high',
        description: `FPSが低下しています (平均: ${avgFPS.toFixed(1)}fps)`,
        affectedComponents: ['アニメーション', 'スクロール'],
        suggestedFix: 'レンダリング最適化を有効化し、不要な再レンダリングを削減してください'
      });
    }

    if (avgMemory > this.config.memoryThreshold) {
      issues.push({
        type: PerformanceErrorType.HIGH_MEMORY_USAGE,
        severity: avgMemory > 150 ? 'critical' : 'high',
        description: `メモリ使用量が高すぎます (平均: ${avgMemory.toFixed(1)}MB)`,
        affectedComponents: ['画像表示', 'リスト表示'],
        suggestedFix: 'メモリ最適化を有効化し、画像圧縮とキャッシュクリアを実行してください'
      });
    }

    if (avgRenderTime > this.config.renderTimeThreshold) {
      issues.push({
        type: PerformanceErrorType.SLOW_RENDER,
        severity: avgRenderTime > 33 ? 'high' : 'medium',
        description: `レンダリング時間が遅延しています (平均: ${avgRenderTime.toFixed(1)}ms)`,
        affectedComponents: ['UI更新', 'コンポーネント'],
        suggestedFix: 'コンポーネントのメモ化と計算の最適化を実施してください'
      });
    }

    return issues;
  }

  /**
   * 改善提案の生成
   */
  private generateRecommendations(issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.type === PerformanceErrorType.LOW_FPS)) {
      recommendations.push('アニメーション品質を下げることを検討してください');
      recommendations.push('不要なバックグラウンド処理を停止してください');
    }

    if (issues.some(issue => issue.type === PerformanceErrorType.HIGH_MEMORY_USAGE)) {
      recommendations.push('アプリの再起動でメモリをリフレッシュしてください');
      recommendations.push('不要な画像キャッシュをクリアしてください');
    }

    if (issues.some(issue => issue.type === PerformanceErrorType.SLOW_RENDER)) {
      recommendations.push('画面の複雑さを軽減することを検討してください');
      recommendations.push('データの事前読み込みを活用してください');
    }

    if (recommendations.length === 0) {
      recommendations.push('現在のパフォーマンスは良好です');
    }

    return recommendations;
  }
}

// シングルトンインスタンスのエクスポート
export const performanceManager = PerformanceManager.getInstance();