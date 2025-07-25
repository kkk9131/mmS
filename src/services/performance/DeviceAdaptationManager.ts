import * as React from 'react';
import { performanceManager } from './PerformanceManager';
import { batteryOptimizer, DevicePerformanceProfile } from './BatteryOptimizer';
import { analyticsReporter } from './AnalyticsReporter';

/**
 * デバイス性能カテゴリ
 */
export enum DevicePerformanceCategory {
  FLAGSHIP = 'flagship',    // 最高性能デバイス
  HIGH = 'high',           // 高性能デバイス
  MEDIUM = 'medium',       // 中性能デバイス
  LOW = 'low',            // 低性能デバイス
  LEGACY = 'legacy'        // レガシーデバイス
}

/**
 * 適応設定プロファイル
 */
export interface AdaptationProfile {
  category: DevicePerformanceCategory;
  renderingConfig: {
    targetFPS: number;
    animationScale: number;
    enableGPUAcceleration: boolean;
    enableShadows: boolean;
    textureQuality: 'low' | 'medium' | 'high';
  };
  memoryConfig: {
    maxCacheSize: number;
    preloadThreshold: number;
    garbageCollectionAggressive: boolean;
    imageCompressionLevel: number;
  };
  networkConfig: {
    requestBatchSize: number;
    timeoutMs: number;
    retryAttempts: number;
    enablePrefetch: boolean;
  };
  uiConfig: {
    listVirtualization: boolean;
    lazyLoadThreshold: number;
    debounceMs: number;
    enableHapticFeedback: boolean;
  };
}

/**
 * 動的調整結果
 */
export interface AdaptationResult {
  previousCategory: DevicePerformanceCategory;
  newCategory: DevicePerformanceCategory;
  changesApplied: string[];
  performanceImpact: number;
  timestamp: number;
}

/**
 * パフォーマンス監視データ
 */
export interface PerformanceMonitoringData {
  averageFPS: number;
  memoryUsage: number;
  cpuUsage: number;
  batteryDrain: number;
  networkLatency: number;
  renderTime: number;
  interactionLatency: number;
}

/**
 * デバイス適応・動的調整マネージャー
 * デバイスの性能を検出し、リアルタイムでアプリの設定を最適化する
 */
export class DeviceAdaptationManager {
  private static instance: DeviceAdaptationManager;
  private currentProfile: AdaptationProfile;
  private deviceProfile: DevicePerformanceProfile;
  private isAdaptationEnabled: boolean = true;
  private monitoringInterval: number | null = null;
  private adaptationHistory: AdaptationResult[] = [];
  private performanceThresholds: Map<string, number> = new Map();
  private adaptationCallbacks: Map<string, (profile: AdaptationProfile) => void> = new Map();

  private constructor() {
    this.deviceProfile = batteryOptimizer.getDeviceProfile();
    this.currentProfile = this.createInitialProfile();
    this.initializePerformanceThresholds();
  }

  public static getInstance(): DeviceAdaptationManager {
    if (!DeviceAdaptationManager.instance) {
      DeviceAdaptationManager.instance = new DeviceAdaptationManager();
    }
    return DeviceAdaptationManager.instance;
  }

  /**
   * 動的適応の開始
   */
  public startAdaptation(): void {
    if (!this.isAdaptationEnabled) return;

    // 初期デバイス検出と設定適用
    this.detectAndApplyOptimalSettings();
    
    // リアルタイム監視の開始
    this.startPerformanceMonitoring();
    
    console.log('DeviceAdaptationManager: 動的適応を開始しました');
  }

  /**
   * 動的適応の停止
   */
  public stopAdaptation(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('DeviceAdaptationManager: 動的適応を停止しました');
  }

  /**
   * 手動でのデバイス再検出と設定適用
   */
  public forceRedetectionAndAdaptation(): AdaptationResult {
    console.log('DeviceAdaptationManager: 手動再検出を開始');
    
    const previousCategory = this.currentProfile.category;
    const newProfile = this.detectOptimalProfile();
    
    if (newProfile.category !== previousCategory) {
      return this.applyAdaptationProfile(newProfile, 'manual-redetection');
    }
    
    return {
      previousCategory,
      newCategory: previousCategory,
      changesApplied: [],
      performanceImpact: 0,
      timestamp: Date.now()
    };
  }

  /**
   * 現在の適応プロファイルの取得
   */
  public getCurrentProfile(): AdaptationProfile {
    return { ...this.currentProfile };
  }

  /**
   * デバイスプロファイルの取得
   */
  public getDeviceProfile(): DevicePerformanceProfile {
    return { ...this.deviceProfile };
  }

  /**
   * 適応履歴の取得
   */
  public getAdaptationHistory(limit: number = 10): AdaptationResult[] {
    return this.adaptationHistory.slice(-limit);
  }

  /**
   * パフォーマンス閾値の設定
   */
  public setPerformanceThreshold(metric: string, threshold: number): void {
    this.performanceThresholds.set(metric, threshold);
    console.log(`DeviceAdaptationManager: ${metric}の閾値を${threshold}に設定`);
  }

  /**
   * 適応コールバックの登録
   */
  public registerAdaptationCallback(id: string, callback: (profile: AdaptationProfile) => void): void {
    this.adaptationCallbacks.set(id, callback);
  }

  /**
   * 適応コールバックの削除
   */
  public unregisterAdaptationCallback(id: string): void {
    this.adaptationCallbacks.delete(id);
  }

  /**
   * 動的適応の有効/無効
   */
  public setAdaptationEnabled(enabled: boolean): void {
    this.isAdaptationEnabled = enabled;
    
    if (enabled) {
      this.startAdaptation();
    } else {
      this.stopAdaptation();
    }
    
    console.log(`DeviceAdaptationManager: 動的適応を${enabled ? '有効' : '無効'}にしました`);
  }

  /**
   * 特定の設定のオーバーライド
   */
  public overrideProfileSetting(category: keyof AdaptationProfile, setting: string, value: any): void {
    if (category === 'category') return; // カテゴリは変更不可
    
    const profile = this.currentProfile;
    if (profile[category] && typeof profile[category] === 'object') {
      (profile[category] as any)[setting] = value;
      this.applyProfileChanges([`${category}.${setting}`]);
      
      console.log(`DeviceAdaptationManager: ${category}.${setting}を${value}にオーバーライド`);
    }
  }

  /**
   * ベンチマークテストの実行
   */
  public async runPerformanceBenchmark(): Promise<{
    category: DevicePerformanceCategory;
    scores: {
      rendering: number;
      memory: number;
      cpu: number;
      storage: number;
    };
    recommendedProfile: AdaptationProfile;
  }> {
    console.log('DeviceAdaptationManager: パフォーマンスベンチマークを開始');
    
    const scores = await this.executePerformanceTests();
    const category = this.categorizeDevice(scores);
    const recommendedProfile = this.createProfileForCategory(category);
    
    return {
      category,
      scores,
      recommendedProfile
    };
  }

  /**
   * 初期プロファイルの作成
   */
  private createInitialProfile(): AdaptationProfile {
    const category = this.categorizeDeviceFromProfile(this.deviceProfile);
    return this.createProfileForCategory(category);
  }

  /**
   * デバイス性能カテゴリの判定
   */
  private categorizeDeviceFromProfile(profile: DevicePerformanceProfile): DevicePerformanceCategory {
    const { cpuCores, memoryGB, screenResolution } = profile;
    const pixelCount = screenResolution.width * screenResolution.height;
    
    // 総合スコアの計算
    let score = 0;
    
    // CPU評価
    if (cpuCores >= 8) score += 30;
    else if (cpuCores >= 6) score += 25;
    else if (cpuCores >= 4) score += 20;
    else score += 10;
    
    // メモリ評価
    if (memoryGB >= 12) score += 30;
    else if (memoryGB >= 8) score += 25;
    else if (memoryGB >= 6) score += 20;
    else if (memoryGB >= 4) score += 15;
    else score += 10;
    
    // 画面解像度評価
    if (pixelCount >= 2073600) score += 20; // 1440p以上
    else if (pixelCount >= 1920*1080) score += 15; // 1080p
    else if (pixelCount >= 1280*720) score += 10; // 720p
    else score += 5;
    
    // GPU評価
    if (profile.gpuSupport) score += 20;
    
    // カテゴリ決定
    if (score >= 90) return DevicePerformanceCategory.FLAGSHIP;
    if (score >= 70) return DevicePerformanceCategory.HIGH;
    if (score >= 50) return DevicePerformanceCategory.MEDIUM;
    if (score >= 30) return DevicePerformanceCategory.LOW;
    return DevicePerformanceCategory.LEGACY;
  }

  /**
   * カテゴリ別プロファイルの作成
   */
  private createProfileForCategory(category: DevicePerformanceCategory): AdaptationProfile {
    const profiles: Record<DevicePerformanceCategory, AdaptationProfile> = {
      [DevicePerformanceCategory.FLAGSHIP]: {
        category,
        renderingConfig: {
          targetFPS: 120,
          animationScale: 1.0,
          enableGPUAcceleration: true,
          enableShadows: true,
          textureQuality: 'high'
        },
        memoryConfig: {
          maxCacheSize: 200 * 1024 * 1024, // 200MB
          preloadThreshold: 50,
          garbageCollectionAggressive: false,
          imageCompressionLevel: 85
        },
        networkConfig: {
          requestBatchSize: 10,
          timeoutMs: 5000,
          retryAttempts: 3,
          enablePrefetch: true
        },
        uiConfig: {
          listVirtualization: true,
          lazyLoadThreshold: 1000,
          debounceMs: 100,
          enableHapticFeedback: true
        }
      },
      [DevicePerformanceCategory.HIGH]: {
        category,
        renderingConfig: {
          targetFPS: 60,
          animationScale: 1.0,
          enableGPUAcceleration: true,
          enableShadows: true,
          textureQuality: 'high'
        },
        memoryConfig: {
          maxCacheSize: 150 * 1024 * 1024, // 150MB
          preloadThreshold: 40,
          garbageCollectionAggressive: false,
          imageCompressionLevel: 80
        },
        networkConfig: {
          requestBatchSize: 8,
          timeoutMs: 6000,
          retryAttempts: 3,
          enablePrefetch: true
        },
        uiConfig: {
          listVirtualization: true,
          lazyLoadThreshold: 800,
          debounceMs: 150,
          enableHapticFeedback: true
        }
      },
      [DevicePerformanceCategory.MEDIUM]: {
        category,
        renderingConfig: {
          targetFPS: 60,
          animationScale: 0.8,
          enableGPUAcceleration: true,
          enableShadows: false,
          textureQuality: 'medium'
        },
        memoryConfig: {
          maxCacheSize: 100 * 1024 * 1024, // 100MB
          preloadThreshold: 30,
          garbageCollectionAggressive: true,
          imageCompressionLevel: 75
        },
        networkConfig: {
          requestBatchSize: 6,
          timeoutMs: 8000,
          retryAttempts: 2,
          enablePrefetch: false
        },
        uiConfig: {
          listVirtualization: true,
          lazyLoadThreshold: 600,
          debounceMs: 200,
          enableHapticFeedback: true
        }
      },
      [DevicePerformanceCategory.LOW]: {
        category,
        renderingConfig: {
          targetFPS: 30,
          animationScale: 0.6,
          enableGPUAcceleration: false,
          enableShadows: false,
          textureQuality: 'low'
        },
        memoryConfig: {
          maxCacheSize: 50 * 1024 * 1024, // 50MB
          preloadThreshold: 20,
          garbageCollectionAggressive: true,
          imageCompressionLevel: 70
        },
        networkConfig: {
          requestBatchSize: 4,
          timeoutMs: 10000,
          retryAttempts: 1,
          enablePrefetch: false
        },
        uiConfig: {
          listVirtualization: true,
          lazyLoadThreshold: 400,
          debounceMs: 300,
          enableHapticFeedback: false
        }
      },
      [DevicePerformanceCategory.LEGACY]: {
        category,
        renderingConfig: {
          targetFPS: 20,
          animationScale: 0.4,
          enableGPUAcceleration: false,
          enableShadows: false,
          textureQuality: 'low'
        },
        memoryConfig: {
          maxCacheSize: 25 * 1024 * 1024, // 25MB
          preloadThreshold: 10,
          garbageCollectionAggressive: true,
          imageCompressionLevel: 60
        },
        networkConfig: {
          requestBatchSize: 2,
          timeoutMs: 15000,
          retryAttempts: 1,
          enablePrefetch: false
        },
        uiConfig: {
          listVirtualization: false,
          lazyLoadThreshold: 200,
          debounceMs: 500,
          enableHapticFeedback: false
        }
      }
    };

    return profiles[category];
  }

  /**
   * パフォーマンス閾値の初期化
   */
  private initializePerformanceThresholds(): void {
    this.performanceThresholds.set('fps-critical', 15);
    this.performanceThresholds.set('fps-low', 25);
    this.performanceThresholds.set('memory-high', 80);
    this.performanceThresholds.set('memory-critical', 90);
    this.performanceThresholds.set('battery-high', 25);
    this.performanceThresholds.set('latency-high', 300);
  }

  /**
   * デバイス検出と最適設定の適用
   */
  private detectAndApplyOptimalSettings(): void {
    const optimalProfile = this.detectOptimalProfile();
    
    if (optimalProfile.category !== this.currentProfile.category) {
      this.applyAdaptationProfile(optimalProfile, 'initial-detection');
    }
  }

  /**
   * 最適プロファイルの検出
   */
  private detectOptimalProfile(): AdaptationProfile {
    // 現在のパフォーマンスデータを取得
    const performanceData = this.getCurrentPerformanceData();
    
    // パフォーマンスに基づいた動的カテゴリ調整
    let adjustedCategory = this.currentProfile.category;
    
    if (this.shouldDowngradePerformance(performanceData)) {
      adjustedCategory = this.downgradeCategory(adjustedCategory);
    } else if (this.shouldUpgradePerformance(performanceData)) {
      adjustedCategory = this.upgradeCategory(adjustedCategory);
    }
    
    return this.createProfileForCategory(adjustedCategory);
  }

  /**
   * パフォーマンス監視の開始
   */
  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkAndAdaptPerformance();
    }, 30000) as number; // 30秒毎
  }

  /**
   * パフォーマンスチェックと適応
   */
  private checkAndAdaptPerformance(): void {
    if (!this.isAdaptationEnabled) return;
    
    const performanceData = this.getCurrentPerformanceData();
    const currentCategory = this.currentProfile.category;
    
    // パフォーマンス問題の検出
    if (this.detectPerformanceIssues(performanceData)) {
      const newProfile = this.detectOptimalProfile();
      
      if (newProfile.category !== currentCategory) {
        this.applyAdaptationProfile(newProfile, 'performance-adaptation');
      }
    }
  }

  /**
   * 現在のパフォーマンスデータの取得
   */
  private getCurrentPerformanceData(): PerformanceMonitoringData {
    // 実際の実装では、各種パフォーマンス監視システムからデータを取得
    return {
      averageFPS: 45, // 仮の値
      memoryUsage: 65,
      cpuUsage: 40,
      batteryDrain: 15,
      networkLatency: 200,
      renderTime: 20,
      interactionLatency: 150
    };
  }

  /**
   * パフォーマンス問題の検出
   */
  private detectPerformanceIssues(data: PerformanceMonitoringData): boolean {
    const issues = [
      data.averageFPS < (this.performanceThresholds.get('fps-low') || 25),
      data.memoryUsage > (this.performanceThresholds.get('memory-high') || 80),
      data.interactionLatency > (this.performanceThresholds.get('latency-high') || 300),
      data.batteryDrain > (this.performanceThresholds.get('battery-high') || 25)
    ];
    
    return issues.filter(Boolean).length >= 2; // 2つ以上の問題があれば適応
  }

  /**
   * パフォーマンス低下判定
   */
  private shouldDowngradePerformance(data: PerformanceMonitoringData): boolean {
    return data.averageFPS < (this.performanceThresholds.get('fps-critical') || 15) ||
           data.memoryUsage > (this.performanceThresholds.get('memory-critical') || 90);
  }

  /**
   * パフォーマンス向上判定
   */
  private shouldUpgradePerformance(data: PerformanceMonitoringData): boolean {
    return data.averageFPS > 55 && 
           data.memoryUsage < 60 && 
           data.interactionLatency < 100;
  }

  /**
   * カテゴリのダウングレード
   */
  private downgradeCategory(current: DevicePerformanceCategory): DevicePerformanceCategory {
    const downgrades: Record<DevicePerformanceCategory, DevicePerformanceCategory> = {
      [DevicePerformanceCategory.FLAGSHIP]: DevicePerformanceCategory.HIGH,
      [DevicePerformanceCategory.HIGH]: DevicePerformanceCategory.MEDIUM,
      [DevicePerformanceCategory.MEDIUM]: DevicePerformanceCategory.LOW,
      [DevicePerformanceCategory.LOW]: DevicePerformanceCategory.LEGACY,
      [DevicePerformanceCategory.LEGACY]: DevicePerformanceCategory.LEGACY
    };
    
    return downgrades[current];
  }

  /**
   * カテゴリのアップグレード
   */
  private upgradeCategory(current: DevicePerformanceCategory): DevicePerformanceCategory {
    const upgrades: Record<DevicePerformanceCategory, DevicePerformanceCategory> = {
      [DevicePerformanceCategory.LEGACY]: DevicePerformanceCategory.LOW,
      [DevicePerformanceCategory.LOW]: DevicePerformanceCategory.MEDIUM,
      [DevicePerformanceCategory.MEDIUM]: DevicePerformanceCategory.HIGH,
      [DevicePerformanceCategory.HIGH]: DevicePerformanceCategory.FLAGSHIP,
      [DevicePerformanceCategory.FLAGSHIP]: DevicePerformanceCategory.FLAGSHIP
    };
    
    return upgrades[current];
  }

  /**
   * 適応プロファイルの適用
   */
  private applyAdaptationProfile(newProfile: AdaptationProfile, reason: string): AdaptationResult {
    const previousCategory = this.currentProfile.category;
    const changesApplied: string[] = [];
    
    // 設定変更の検出と適用
    changesApplied.push(...this.compareAndApplyRenderingConfig(newProfile.renderingConfig));
    changesApplied.push(...this.compareAndApplyMemoryConfig(newProfile.memoryConfig));
    changesApplied.push(...this.compareAndApplyNetworkConfig(newProfile.networkConfig));
    changesApplied.push(...this.compareAndApplyUIConfig(newProfile.uiConfig));
    
    this.currentProfile = newProfile;
    
    // コールバックの実行
    this.adaptationCallbacks.forEach(callback => {
      try {
        callback(newProfile);
      } catch (error) {
        console.error('DeviceAdaptationManager: コールバック実行エラー:', error);
      }
    });
    
    const result: AdaptationResult = {
      previousCategory,
      newCategory: newProfile.category,
      changesApplied,
      performanceImpact: this.calculatePerformanceImpact(previousCategory, newProfile.category),
      timestamp: Date.now()
    };
    
    this.adaptationHistory.push(result);
    
    console.log(`DeviceAdaptationManager: ${reason}により${previousCategory}から${newProfile.category}に適応`);
    console.log('適用された変更:', changesApplied);
    
    return result;
  }

  /**
   * レンダリング設定の比較と適用
   */
  private compareAndApplyRenderingConfig(newConfig: AdaptationProfile['renderingConfig']): string[] {
    const changes: string[] = [];
    const current = this.currentProfile.renderingConfig;
    
    if (current.targetFPS !== newConfig.targetFPS) {
      changes.push(`FPS目標値: ${current.targetFPS} → ${newConfig.targetFPS}`);
    }
    
    if (current.animationScale !== newConfig.animationScale) {
      changes.push(`アニメーション速度: ${current.animationScale} → ${newConfig.animationScale}`);
    }
    
    if (current.enableGPUAcceleration !== newConfig.enableGPUAcceleration) {
      changes.push(`GPU加速: ${current.enableGPUAcceleration ? '有効' : '無効'} → ${newConfig.enableGPUAcceleration ? '有効' : '無効'}`);
    }
    
    return changes;
  }

  /**
   * メモリ設定の比較と適用
   */
  private compareAndApplyMemoryConfig(newConfig: AdaptationProfile['memoryConfig']): string[] {
    const changes: string[] = [];
    const current = this.currentProfile.memoryConfig;
    
    if (current.maxCacheSize !== newConfig.maxCacheSize) {
      changes.push(`最大キャッシュサイズ: ${Math.round(current.maxCacheSize / 1024 / 1024)}MB → ${Math.round(newConfig.maxCacheSize / 1024 / 1024)}MB`);
    }
    
    if (current.imageCompressionLevel !== newConfig.imageCompressionLevel) {
      changes.push(`画像圧縮レベル: ${current.imageCompressionLevel}% → ${newConfig.imageCompressionLevel}%`);
    }
    
    return changes;
  }

  /**
   * ネットワーク設定の比較と適用
   */
  private compareAndApplyNetworkConfig(newConfig: AdaptationProfile['networkConfig']): string[] {
    const changes: string[] = [];
    const current = this.currentProfile.networkConfig;
    
    if (current.requestBatchSize !== newConfig.requestBatchSize) {
      changes.push(`リクエストバッチサイズ: ${current.requestBatchSize} → ${newConfig.requestBatchSize}`);
    }
    
    if (current.timeoutMs !== newConfig.timeoutMs) {
      changes.push(`タイムアウト: ${current.timeoutMs}ms → ${newConfig.timeoutMs}ms`);
    }
    
    return changes;
  }

  /**
   * UI設定の比較と適用
   */
  private compareAndApplyUIConfig(newConfig: AdaptationProfile['uiConfig']): string[] {
    const changes: string[] = [];
    const current = this.currentProfile.uiConfig;
    
    if (current.lazyLoadThreshold !== newConfig.lazyLoadThreshold) {
      changes.push(`遅延読み込み閾値: ${current.lazyLoadThreshold} → ${newConfig.lazyLoadThreshold}`);
    }
    
    if (current.debounceMs !== newConfig.debounceMs) {
      changes.push(`デバウンス時間: ${current.debounceMs}ms → ${newConfig.debounceMs}ms`);
    }
    
    return changes;
  }

  /**
   * プロファイル変更の適用
   */
  private applyProfileChanges(changes: string[]): void {
    // 実際の設定変更をシステムに反映
    console.log('DeviceAdaptationManager: プロファイル変更を適用:', changes);
  }

  /**
   * パフォーマンス影響度の計算
   */
  private calculatePerformanceImpact(from: DevicePerformanceCategory, to: DevicePerformanceCategory): number {
    const categoryScores = {
      [DevicePerformanceCategory.FLAGSHIP]: 100,
      [DevicePerformanceCategory.HIGH]: 80,
      [DevicePerformanceCategory.MEDIUM]: 60,
      [DevicePerformanceCategory.LOW]: 40,
      [DevicePerformanceCategory.LEGACY]: 20
    };
    
    return categoryScores[to] - categoryScores[from];
  }

  /**
   * パフォーマンステストの実行
   */
  private async executePerformanceTests(): Promise<{
    rendering: number;
    memory: number;
    cpu: number;
    storage: number;
  }> {
    // 実際の実装では、各種ベンチマークテストを実行
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒のテスト時間をシミュレート
    
    return {
      rendering: Math.random() * 100,
      memory: Math.random() * 100,
      cpu: Math.random() * 100,
      storage: Math.random() * 100
    };
  }

  /**
   * スコアからデバイスカテゴリを決定
   */
  private categorizeDevice(scores: { rendering: number; memory: number; cpu: number; storage: number }): DevicePerformanceCategory {
    const averageScore = (scores.rendering + scores.memory + scores.cpu + scores.storage) / 4;
    
    if (averageScore >= 90) return DevicePerformanceCategory.FLAGSHIP;
    if (averageScore >= 70) return DevicePerformanceCategory.HIGH;
    if (averageScore >= 50) return DevicePerformanceCategory.MEDIUM;
    if (averageScore >= 30) return DevicePerformanceCategory.LOW;
    return DevicePerformanceCategory.LEGACY;
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    this.stopAdaptation();
    this.adaptationCallbacks.clear();
    this.adaptationHistory.length = 0;
    console.log('DeviceAdaptationManager: クリーンアップ完了');
  }
}

/**
 * デバイス適応用カスタムフック
 */
export const useDeviceAdaptation = () => {
  const manager = DeviceAdaptationManager.getInstance();
  const [currentProfile, setCurrentProfile] = React.useState(manager.getCurrentProfile());
  const [deviceProfile] = React.useState(manager.getDeviceProfile());

  React.useEffect(() => {
    const callback = (profile: AdaptationProfile) => {
      setCurrentProfile(profile);
    };

    manager.registerAdaptationCallback('hook-update', callback);
    
    return () => {
      manager.unregisterAdaptationCallback('hook-update');
    };
  }, [manager]);

  const forceRedetection = React.useCallback(() => {
    return manager.forceRedetectionAndAdaptation();
  }, [manager]);

  const runBenchmark = React.useCallback(async () => {
    return await manager.runPerformanceBenchmark();
  }, [manager]);

  const getAdaptationHistory = React.useCallback((limit?: number) => {
    return manager.getAdaptationHistory(limit);
  }, [manager]);

  const setAdaptationEnabled = React.useCallback((enabled: boolean) => {
    manager.setAdaptationEnabled(enabled);
  }, [manager]);

  return {
    currentProfile,
    deviceProfile,
    forceRedetection,
    runBenchmark,
    getAdaptationHistory,
    setAdaptationEnabled
  };
};

// シングルトンインスタンスのエクスポート
export const deviceAdaptationManager = DeviceAdaptationManager.getInstance();