import * as React from 'react';
import { performanceManager } from './PerformanceManager';
import { deviceAdaptationManager, DevicePerformanceCategory } from './DeviceAdaptationManager';
import { analyticsReporter } from './AnalyticsReporter';

/**
 * ユーザー体験優先度レベル
 */
export enum UXPriorityLevel {
  CRITICAL = 'critical',    // 即座にレスポンスが必要
  HIGH = 'high',           // 高優先度
  MEDIUM = 'medium',       // 中優先度
  LOW = 'low',            // 低優先度
  BACKGROUND = 'background' // バックグラウンド処理
}

/**
 * UX制御ポリシー
 */
export enum UXControlPolicy {
  PERFORMANCE_FIRST = 'performance_first',    // パフォーマンス優先
  BALANCED = 'balanced',                      // バランス
  USER_SATISFACTION = 'user_satisfaction',   // ユーザー満足度優先
  BATTERY_SAVE = 'battery_save',             // バッテリー節約優先
  ADAPTIVE = 'adaptive'                       // 適応的
}

/**
 * ユーザーインタラクション種別
 */
export interface UserInteractionType {
  type: 'tap' | 'scroll' | 'swipe' | 'long_press' | 'pinch' | 'navigation';
  priority: UXPriorityLevel;
  expectedResponseTime: number; // ms
  fallbackStrategy: 'immediate' | 'progressive' | 'deferred';
}

/**
 * UX優先制御設定
 */
export interface UXPriorityConfig {
  policy: UXControlPolicy;
  responsiveThreshold: number; // ms
  frameDropTolerance: number;
  memoryPressureThreshold: number; // %
  batteryLevelThreshold: number; // %
  adaptiveAdjustmentEnabled: boolean;
  userFeedbackWeight: number; // 0-1
}

/**
 * リソース配分設定 
 */
export interface ResourceAllocation {
  cpu: {
    critical: number;  // %
    high: number;      // %
    medium: number;    // %
    low: number;       // %
    background: number; // %
  };
  memory: {
    critical: number;  // MB
    high: number;      // MB
    medium: number;    // MB
    low: number;       // MB
    background: number; // MB
  };
  network: {
    critical: number;  // requests/sec
    high: number;      // requests/sec
    medium: number;    // requests/sec
    low: number;       // requests/sec
    background: number; // requests/sec
  };
}

/**
 * UX品質メトリクス
 */
export interface UXQualityMetrics {
  responsiveness: number;    // 0-100
  smoothness: number;       // 0-100
  reliability: number;      // 0-100
  efficiency: number;       // 0-100
  userSatisfaction: number; // 0-100
  overallScore: number;     // 0-100
}

/**
 * タスク実行コンテキスト
 */
export interface TaskExecutionContext {
  id: string;
  priority: UXPriorityLevel;
  estimatedDuration: number; // ms
  resourceRequirements: {
    cpu: number;    // %
    memory: number; // MB
    network: boolean;
  };
  userVisible: boolean;
  deadline?: number; // timestamp
  dependsOn?: string[]; // task IDs
}

/**
 * ユーザー体験優先制御システム
 * ユーザーの操作や体験を最優先に、システムリソースを動的に配分し
 * 最適なレスポンス性を提供する
 */
export class UserExperiencePrioritizer {
  private static instance: UserExperiencePrioritizer;
  private config: UXPriorityConfig;
  private resourceAllocation: ResourceAllocation;
  private interactionTypes: Map<string, UserInteractionType> = new Map();
  private activeTasksQueue: Map<string, TaskExecutionContext> = new Map();
  private priorityScheduler: number | null = null;
  private isActive: boolean = false;
  private uxMetrics: UXQualityMetrics;
  private userFeedbackHistory: number[] = [];

  private constructor() {
    this.config = {
      policy: UXControlPolicy.ADAPTIVE,
      responsiveThreshold: 100, // 100ms
      frameDropTolerance: 2,
      memoryPressureThreshold: 85,
      batteryLevelThreshold: 20,
      adaptiveAdjustmentEnabled: true,
      userFeedbackWeight: 0.3
    };

    this.resourceAllocation = this.createDefaultResourceAllocation();
    this.uxMetrics = this.initializeUXMetrics();
    this.initializeInteractionTypes();
  }

  public static getInstance(): UserExperiencePrioritizer {
    if (!UserExperiencePrioritizer.instance) {
      UserExperiencePrioritizer.instance = new UserExperiencePrioritizer();
    }
    return UserExperiencePrioritizer.instance;
  }

  /**
   * UX優先制御の開始
   */
  public startPrioritization(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.startPriorityScheduler();
    this.adaptResourceAllocation();
    
    console.log('UserExperiencePrioritizer: UX優先制御を開始しました');
  }

  /**
   * UX優先制御の停止
   */
  public stopPrioritization(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.stopPriorityScheduler();
    
    console.log('UserExperiencePrioritizer: UX優先制御を停止しました');
  }

  /**
   * 制御ポリシーの設定
   */
  public setControlPolicy(policy: UXControlPolicy): void {
    this.config.policy = policy;
    
    if (this.isActive) {
      this.adaptResourceAllocation();
    }
    
    console.log(`UserExperiencePrioritizer: 制御ポリシーを${policy}に設定`);
  }

  /**
   * ユーザーインタラクションの登録/処理
   */
  public handleUserInteraction(
    interactionId: string, 
    type: UserInteractionType['type'],
    callback: () => Promise<void>
  ): Promise<void> {
    const interaction = this.interactionTypes.get(type);
    if (!interaction) {
      console.warn(`UserExperiencePrioritizer: 未知のインタラクション種別: ${type}`);
      return callback();
    }

    return this.executeWithPriority(
      interactionId,
      interaction.priority,
      callback,
      interaction.expectedResponseTime
    );
  }

  /**
   * タスクの優先実行
   */
  public async executeWithPriority(
    taskId: string,
    priority: UXPriorityLevel,
    task: () => Promise<void>,
    deadline?: number
  ): Promise<void> {
    const context: TaskExecutionContext = {
      id: taskId,
      priority,
      estimatedDuration: deadline || this.config.responsiveThreshold,
      resourceRequirements: this.estimateResourceRequirements(priority),
      userVisible: priority === UXPriorityLevel.CRITICAL || priority === UXPriorityLevel.HIGH,
      deadline: deadline ? Date.now() + deadline : undefined
    };

    this.activeTasksQueue.set(taskId, context);

    try {
      // リソース確保と実行制御
      await this.executeTaskWithResourceControl(context, task);
    } finally {
      this.activeTasksQueue.delete(taskId);
    }
  }

  /**
   * リソース配分の動的調整
   */
  public adjustResourceAllocation(customAllocation?: Partial<ResourceAllocation>): void {
    if (customAllocation) {
      this.resourceAllocation = { 
        ...this.resourceAllocation, 
        ...customAllocation 
      };
    }
    
    this.adaptResourceAllocation();
    console.log('UserExperiencePrioritizer: リソース配分を調整しました');
  }

  /**
   * UX品質メトリクスの取得
   */
  public getUXMetrics(): UXQualityMetrics {
    this.updateUXMetrics();
    return { ...this.uxMetrics };
  }

  /**
   * ユーザーフィードバックの記録
   */
  public recordUserFeedback(satisfactionScore: number): void {
    // 0-100のスケールで満足度を記録
    const normalizedScore = Math.max(0, Math.min(100, satisfactionScore));
    this.userFeedbackHistory.push(normalizedScore);

    // 履歴のサイズ制限
    if (this.userFeedbackHistory.length > 100) {
      this.userFeedbackHistory.shift();
    }

    // 適応的調整が有効な場合は設定を調整
    if (this.config.adaptiveAdjustmentEnabled) {
      this.adaptConfigurationBasedOnFeedback();
    }

    console.log(`UserExperiencePrioritizer: ユーザーフィードバック記録: ${normalizedScore}`);
  }

  /**
   * パフォーマンス劣化の検出と対応
   */
  public detectAndHandlePerformanceDegradation(): {
    detected: boolean;
    actions: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const currentMetrics = this.getUXMetrics();
    const actions: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    // 応答性の問題検出
    if (currentMetrics.responsiveness < 70) {
      actions.push('レスポンス性の改善');
      severity = currentMetrics.responsiveness < 50 ? 'high' : 'medium';
      this.handleResponsivenessIssue();
    }

    // スムーズさの問題検出
    if (currentMetrics.smoothness < 70) {
      actions.push('描画性能の最適化');
      if (severity === 'low') severity = 'medium';
      this.handleSmoothnessIssue();
    }

    // 信頼性の問題検出
    if (currentMetrics.reliability < 80) {
      actions.push('安定性の向上');
      if (severity !== 'high') severity = 'medium';
      this.handleReliabilityIssue();
    }

    return {
      detected: actions.length > 0,
      actions,
      severity
    };
  }

  /**
   * プリエンプティブ最適化の実行
   */
  public executePreemptiveOptimization(): void {
    const deviceProfile = deviceAdaptationManager.getCurrentProfile();
    const batteryLevel = 80; // 実際の実装ではバッテリーAPIから取得

    // バッテリーレベルに基づく最適化
    if (batteryLevel < this.config.batteryLevelThreshold) {
      this.enableBatterySavingMode();
    }

    // デバイス性能に基づく最適化
    this.optimizeForDeviceCategory(deviceProfile.category);

    // メモリプレッシャーに基づく最適化
    const memoryUsage = this.getCurrentMemoryUsage();
    if (memoryUsage > this.config.memoryPressureThreshold) {
      this.handleMemoryPressure();
    }

    console.log('UserExperiencePrioritizer: プリエンプティブ最適化を実行');
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<UXPriorityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isActive) {
      this.adaptResourceAllocation();
    }

    console.log('UserExperiencePrioritizer: 設定を更新しました');
  }

  /**
   * アクティブタスクの取得
   */
  public getActiveTasks(): TaskExecutionContext[] {
    return Array.from(this.activeTasksQueue.values());
  }

  /**
   * インタラクション種別の初期化
   */
  private initializeInteractionTypes(): void {
    const interactions: [string, UserInteractionType][] = [
      ['tap', {
        type: 'tap',
        priority: UXPriorityLevel.CRITICAL,
        expectedResponseTime: 50,
        fallbackStrategy: 'immediate'
      }],
      ['scroll', {
        type: 'scroll',
        priority: UXPriorityLevel.HIGH,
        expectedResponseTime: 16, // 60fps
        fallbackStrategy: 'progressive'
      }],
      ['swipe', {
        type: 'swipe',
        priority: UXPriorityLevel.HIGH,
        expectedResponseTime: 100,
        fallbackStrategy: 'immediate'
      }],
      ['long_press', {
        type: 'long_press',
        priority: UXPriorityLevel.MEDIUM,
        expectedResponseTime: 200,
        fallbackStrategy: 'deferred'
      }],
      ['pinch', {
        type: 'pinch',
        priority: UXPriorityLevel.HIGH,
        expectedResponseTime: 50,
        fallbackStrategy: 'progressive'
      }],
      ['navigation', {
        type: 'navigation',
        priority: UXPriorityLevel.HIGH,
        expectedResponseTime: 300,
        fallbackStrategy: 'progressive'
      }]
    ];

    interactions.forEach(([key, interaction]) => {
      this.interactionTypes.set(key, interaction);
    });
  }

  /**
   * デフォルトリソース配分の作成
   */
  private createDefaultResourceAllocation(): ResourceAllocation {
    return {
      cpu: {
        critical: 60,
        high: 25,
        medium: 10,
        low: 4,
        background: 1
      },
      memory: {
        critical: 100,
        high: 80,
        medium: 50,
        low: 30,
        background: 10
      },
      network: {
        critical: 10,
        high: 8,
        medium: 5,
        low: 3,
        background: 1
      }
    };
  }

  /**
   * UXメトリクスの初期化
   */
  private initializeUXMetrics(): UXQualityMetrics {
    return {
      responsiveness: 85,
      smoothness: 80,
      reliability: 90,
      efficiency: 75,
      userSatisfaction: 80,
      overallScore: 82
    };
  }

  /**
   * 優先度スケジューラーの開始
   */
  private startPriorityScheduler(): void {
    this.priorityScheduler = setInterval(() => {
      this.evaluateAndAdjustPriorities();
      this.updateUXMetrics();
    }, 1000) as number; // 1秒毎
  }

  /**
   * 優先度スケジューラーの停止
   */
  private stopPriorityScheduler(): void {
    if (this.priorityScheduler) {
      clearInterval(this.priorityScheduler);
      this.priorityScheduler = null;
    }
  }

  /**
   * リソース配分の適応
   */
  private adaptResourceAllocation(): void {
    const policy = this.config.policy;
    
    if (policy === UXControlPolicy.ADAPTIVE) {
      this.adaptBasedOnCurrentConditions();
    } else {
      this.applyStaticPolicy(policy);
    }
  }

  /**
   * 現在の状況に基づく適応
   */
  private adaptBasedOnCurrentConditions(): void {
    const deviceProfile = deviceAdaptationManager.getCurrentProfile();
    const currentMetrics = this.getUXMetrics();
    
    // デバイス性能に基づく調整
    if (deviceProfile.category === DevicePerformanceCategory.LOW || 
        deviceProfile.category === DevicePerformanceCategory.LEGACY) {
      this.adjustForLowEndDevice();
    }

    // UX品質に基づく調整
    if (currentMetrics.responsiveness < 70) {
      this.boostResponsiveness();
    }

    if (currentMetrics.smoothness < 70) {
      this.boostSmoothness();
    }
  }

  /**
   * 静的ポリシーの適用
   */
  private applyStaticPolicy(policy: UXControlPolicy): void {
    switch (policy) {
      case UXControlPolicy.PERFORMANCE_FIRST:
        this.resourceAllocation.cpu.critical = 70;
        this.resourceAllocation.cpu.high = 20;
        break;
      case UXControlPolicy.BALANCED:
        // デフォルト設定を使用
        break;
      case UXControlPolicy.USER_SATISFACTION:
        this.prioritizeUserSatisfaction();
        break;
      case UXControlPolicy.BATTERY_SAVE:
        this.optimizeForBattery();
        break;
    }
  }

  /**
   * リソース要件の推定
   */
  private estimateResourceRequirements(priority: UXPriorityLevel): TaskExecutionContext['resourceRequirements'] {
    const baseRequirements = {
      [UXPriorityLevel.CRITICAL]: { cpu: 30, memory: 50, network: true },
      [UXPriorityLevel.HIGH]: { cpu: 20, memory: 30, network: true },
      [UXPriorityLevel.MEDIUM]: { cpu: 15, memory: 20, network: false },
      [UXPriorityLevel.LOW]: { cpu: 10, memory: 15, network: false },
      [UXPriorityLevel.BACKGROUND]: { cpu: 5, memory: 10, network: false }
    };

    return baseRequirements[priority];
  }

  /**
   * リソース制御付きタスク実行
   */
  private async executeTaskWithResourceControl(
    context: TaskExecutionContext,
    task: () => Promise<void>
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      // リソース制御の適用
      this.applyResourceConstraints(context);
      
      // タスクの実行
      await task();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // パフォーマンス記録
      this.recordTaskPerformance(context, executionTime);
      
    } catch (error) {
      console.error(`UserExperiencePrioritizer: タスク実行エラー ${context.id}:`, error);
      throw error;
    }
  }

  /**
   * リソース制約の適用
   */
  private applyResourceConstraints(context: TaskExecutionContext): void {
    // CPU制約
    const cpuAllocation = this.resourceAllocation.cpu[context.priority];
    console.log(`Task ${context.id}: CPU制約 ${cpuAllocation}%`);
    
    // メモリ制約
    const memoryAllocation = this.resourceAllocation.memory[context.priority];
    console.log(`Task ${context.id}: メモリ制約 ${memoryAllocation}MB`);
    
    // ネットワーク制約
    if (context.resourceRequirements.network) {
      const networkAllocation = this.resourceAllocation.network[context.priority];
      console.log(`Task ${context.id}: ネットワーク制約 ${networkAllocation}req/s`);
    }
  }

  /**
   * タスクパフォーマンスの記録
   */
  private recordTaskPerformance(context: TaskExecutionContext, executionTime: number): void {
    analyticsReporter.recordCustomMetric(`task-${context.priority}-duration`, executionTime);
    
    // 期待時間との比較
    if (executionTime > context.estimatedDuration) {
      console.warn(`Task ${context.id} exceeded expected duration: ${executionTime}ms vs ${context.estimatedDuration}ms`);
    }
  }

  /**
   * 優先度の評価と調整
   */
  private evaluateAndAdjustPriorities(): void {
    const currentTime = Date.now();
    
    this.activeTasksQueue.forEach((context, taskId) => {
      // デッドライン近接チェック
      if (context.deadline && currentTime > context.deadline - 100) { // 100ms前に警告
        console.warn(`Task ${taskId} approaching deadline`);
        // 優先度を動的に上げる
        if (context.priority !== UXPriorityLevel.CRITICAL) {
          context.priority = UXPriorityLevel.HIGH;
        }
      }
    });
  }

  /**
   * UXメトリクスの更新
   */
  private updateUXMetrics(): void {
    // 応答性の計算
    this.uxMetrics.responsiveness = this.calculateResponsiveness();
    
    // スムーズさの計算
    this.uxMetrics.smoothness = this.calculateSmoothness();
    
    // 信頼性の計算
    this.uxMetrics.reliability = this.calculateReliability();
    
    // 効率性の計算
    this.uxMetrics.efficiency = this.calculateEfficiency();
    
    // ユーザー満足度の計算
    this.uxMetrics.userSatisfaction = this.calculateUserSatisfaction();
    
    // 総合スコアの計算
    this.uxMetrics.overallScore = this.calculateOverallScore();
  }

  /**
   * 応答性の計算
   */
  private calculateResponsiveness(): number {
    // 実際の実装では、レスポンス時間の統計から計算
    return Math.max(0, Math.min(100, 90 - (this.getAverageResponseTime() - 50) / 10));
  }

  /**
   * スムーズさの計算
   */
  private calculateSmoothness(): number {
    // 実際の実装では、FPSの統計から計算
    const fps = this.getCurrentFPS();
    return Math.max(0, Math.min(100, fps * 100 / 60));
  }

  /**
   * 信頼性の計算
   */
  private calculateReliability(): number {
    // 実際の実装では、エラー率から計算
    return 95; // 仮の値
  }

  /**
   * 効率性の計算
   */
  private calculateEfficiency(): number {
    // リソース使用効率から計算
    return 85; // 仮の値
  }

  /**
   * ユーザー満足度の計算
   */
  private calculateUserSatisfaction(): number {
    if (this.userFeedbackHistory.length === 0) return 80;
    
    const recentFeedback = this.userFeedbackHistory.slice(-10); // 直近10件
    const average = recentFeedback.reduce((sum, score) => sum + score, 0) / recentFeedback.length;
    
    return Math.round(average);
  }

  /**
   * 総合スコアの計算
   */
  private calculateOverallScore(): number {
    const weights = {
      responsiveness: 0.3,
      smoothness: 0.25,
      reliability: 0.2,
      efficiency: 0.1,
      userSatisfaction: 0.15
    };
    
    return Math.round(
      this.uxMetrics.responsiveness * weights.responsiveness +
      this.uxMetrics.smoothness * weights.smoothness +
      this.uxMetrics.reliability * weights.reliability +
      this.uxMetrics.efficiency * weights.efficiency +
      this.uxMetrics.userSatisfaction * weights.userSatisfaction
    );
  }

  /**
   * フィードバックに基づく設定適応
   */
  private adaptConfigurationBasedOnFeedback(): void {
    const averageSatisfaction = this.calculateUserSatisfaction();
    
    if (averageSatisfaction < 60) {
      // 満足度が低い場合は応答性を重視
      this.config.responsiveThreshold = Math.max(50, this.config.responsiveThreshold - 10);
      this.boostResponsiveness();
    } else if (averageSatisfaction > 90) {
      // 満足度が高い場合はバッテリー効率を重視
      this.optimizeForBattery();
    }
  }

  // パフォーマンス問題対応メソッド群
  private handleResponsivenessIssue(): void {
    console.log('UserExperiencePrioritizer: 応答性問題を検出、対応措置を実行');
    this.boostResponsiveness();
  }

  private handleSmoothnessIssue(): void {
    console.log('UserExperiencePrioritizer: スムーズさの問題を検出、対応措置を実行');
    this.boostSmoothness();
  }

  private handleReliabilityIssue(): void {
    console.log('UserExperiencePrioritizer: 信頼性の問題を検出、対応措置を実行');
    // エラー処理の強化など
  }

  private boostResponsiveness(): void {
    this.resourceAllocation.cpu.critical = Math.min(80, this.resourceAllocation.cpu.critical + 10);
    this.resourceAllocation.cpu.high = Math.min(30, this.resourceAllocation.cpu.high + 5);
  }

  private boostSmoothness(): void {
    this.resourceAllocation.cpu.high = Math.min(35, this.resourceAllocation.cpu.high + 5);
    this.config.frameDropTolerance = Math.max(1, this.config.frameDropTolerance - 1);
  }

  private adjustForLowEndDevice(): void {
    this.resourceAllocation.cpu.background = Math.max(0.5, this.resourceAllocation.cpu.background - 0.5);
    this.config.responsiveThreshold = Math.min(200, this.config.responsiveThreshold + 20);
  }

  private prioritizeUserSatisfaction(): void {
    // ユーザー満足度を重視した設定
    this.config.userFeedbackWeight = 0.5;
    this.config.responsiveThreshold = 80;
  }

  private optimizeForBattery(): void {
    // バッテリー節約重視の設定
    Object.keys(this.resourceAllocation.cpu).forEach(key => {
      this.resourceAllocation.cpu[key as keyof typeof this.resourceAllocation.cpu] *= 0.8;
    });
  }

  private optimizeForDeviceCategory(category: DevicePerformanceCategory): void {
    switch (category) {
      case DevicePerformanceCategory.LEGACY:
        this.adjustForLowEndDevice();
        break;
      case DevicePerformanceCategory.FLAGSHIP:
        this.resourceAllocation.cpu.critical = Math.min(90, this.resourceAllocation.cpu.critical + 10);
        break;
    }
  }

  private enableBatterySavingMode(): void {
    this.optimizeForBattery();
    console.log('UserExperiencePrioritizer: バッテリー節約モードを有効化');
  }

  private handleMemoryPressure(): void {
    // メモリプレッシャー対応
    Object.keys(this.resourceAllocation.memory).forEach(key => {
      this.resourceAllocation.memory[key as keyof typeof this.resourceAllocation.memory] *= 0.7;
    });
    console.log('UserExperiencePrioritizer: メモリプレッシャー対応を実行');
  }

  // ヘルパーメソッド群
  private getAverageResponseTime(): number {
    // 実際の実装では、レスポンス時間の統計を取得
    return 80; // 仮の値
  }

  private getCurrentFPS(): number {
    // 実際の実装では、FPS監視システムから取得
    return 58; // 仮の値
  }

  private getCurrentMemoryUsage(): number {
    // 実際の実装では、メモリ使用量を取得
    return 70; // 仮の値
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    this.stopPrioritization();
    this.activeTasksQueue.clear();
    this.userFeedbackHistory.length = 0;
    console.log('UserExperiencePrioritizer: クリーンアップ完了');
  }
}

/**
 * UX優先制御用カスタムフック
 */
export const useUserExperiencePriorizer = () => {
  const prioritizer = UserExperiencePrioritizer.getInstance();
  const [uxMetrics, setUxMetrics] = React.useState(prioritizer.getUXMetrics());
  const [activeTasks, setActiveTasks] = React.useState(prioritizer.getActiveTasks());

  React.useEffect(() => {
    const updateInterval = setInterval(() => {
      setUxMetrics(prioritizer.getUXMetrics());
      setActiveTasks(prioritizer.getActiveTasks());
    }, 2000) as number; // 2秒毎

    return () => clearInterval(updateInterval);
  }, [prioritizer]);

  const handleInteraction = React.useCallback(async (
    interactionId: string,
    type: UserInteractionType['type'],
    callback: () => Promise<void>
  ) => {
    return await prioritizer.handleUserInteraction(interactionId, type, callback);
  }, [prioritizer]);

  const recordFeedback = React.useCallback((score: number) => {
    prioritizer.recordUserFeedback(score);
  }, [prioritizer]);

  const setControlPolicy = React.useCallback((policy: UXControlPolicy) => {
    prioritizer.setControlPolicy(policy);
  }, [prioritizer]);

  const detectPerformanceIssues = React.useCallback(() => {
    return prioritizer.detectAndHandlePerformanceDegradation();
  }, [prioritizer]);

  return {
    uxMetrics,
    activeTasks,
    handleInteraction,
    recordFeedback,
    setControlPolicy,
    detectPerformanceIssues
  };
};

// シングルトンインスタンスのエクスポート
export const userExperiencePrioritizer = UserExperiencePrioritizer.getInstance();