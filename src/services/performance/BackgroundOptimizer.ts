import * as React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { performanceManager } from './PerformanceManager';

// Timerタイプの定義
type Timer = ReturnType<typeof setInterval>;

/**
 * バックグラウンド タスクの優先度
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * バックグラウンド タスクの定義
 */
export interface BackgroundTask {
  id: string;
  name: string;
  priority: TaskPriority;
  intervalMs: number;
  lastExecuted: number;
  isActive: boolean;
  execute: () => Promise<void>;
  onError?: (error: Error) => void;
  maxRetries?: number;
  currentRetries?: number;
}

/**
 * アプリ状態の定義
 */
export interface AppStateInfo {
  current: AppStateStatus;
  previous: AppStateStatus;
  transitionTime: number;
  backgroundDuration: number;
}

/**
 * バックグラウンド処理の統計
 */
export interface BackgroundStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  batteryImpact: number;
}

/**
 * バックグラウンド処理最適化クラス
 * アプリの状態に応じてバックグラウンドタスクを管理し、
 * バッテリー消費とパフォーマンスを最適化する
 */
export class BackgroundOptimizer {
  private static instance: BackgroundOptimizer;
  private tasks: Map<string, BackgroundTask> = new Map();
  private intervals: Map<string, Timer> = new Map();
  private appState: AppStateInfo;
  private isOptimizationEnabled: boolean = true;
  private stats: BackgroundStats;

  private constructor() {
    this.appState = {
      current: AppState.currentState,
      previous: AppState.currentState,
      transitionTime: Date.now(),
      backgroundDuration: 0
    };

    this.stats = {
      totalTasks: 0,
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      batteryImpact: 0
    };

    this.initializeAppStateListener();
  }

  public static getInstance(): BackgroundOptimizer {
    if (!BackgroundOptimizer.instance) {
      BackgroundOptimizer.instance = new BackgroundOptimizer();
    }
    return BackgroundOptimizer.instance;
  }

  /**
   * バックグラウンドタスクの登録
   */
  public registerTask(task: BackgroundTask): void {
    task.currentRetries = 0;
    task.maxRetries = task.maxRetries || 3;
    
    this.tasks.set(task.id, task);
    this.stats.totalTasks++;

    if (task.isActive) {
      this.startTask(task.id);
    }

    console.log(`BackgroundOptimizer: タスク '${task.name}' を登録しました`);
  }

  /**
   * バックグラウンドタスクの削除
   */
  public unregisterTask(taskId: string): void {
    this.stopTask(taskId);
    this.tasks.delete(taskId);
    console.log(`BackgroundOptimizer: タスク '${taskId}' を削除しました`);
  }

  /**
   * タスクの開始
   */
  public startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`BackgroundOptimizer: タスク '${taskId}' が見つかりません`);
      return;
    }

    // 既に実行中の場合は停止してから再開
    this.stopTask(taskId);

    // アプリ状態に応じた間隔調整
    const adjustedInterval = this.adjustIntervalForAppState(task);

    const intervalId = setInterval(async () => {
      await this.executeTask(task);
    }, adjustedInterval);

    this.intervals.set(taskId, intervalId as Timer);
    task.isActive = true;
    this.stats.activeTasks++;

    console.log(`BackgroundOptimizer: タスク '${task.name}' を開始しました (間隔: ${adjustedInterval}ms)`);
  }

  /**
   * タスクの停止
   */
  public stopTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    const intervalId = this.intervals.get(taskId);

    if (intervalId) {
      clearInterval(intervalId as any);
      this.intervals.delete(taskId);
    }

    if (task) {
      task.isActive = false;
      this.stats.activeTasks = Math.max(0, this.stats.activeTasks - 1);
      console.log(`BackgroundOptimizer: タスク '${task.name}' を停止しました`);
    }
  }

  /**
   * 全タスクの停止
   */
  public stopAllTasks(): void {
    console.log('BackgroundOptimizer: 全タスクを停止します');
    
    this.intervals.forEach((intervalId, taskId) => {
      clearInterval(intervalId as any);
    });
    
    this.intervals.clear();
    
    this.tasks.forEach(task => {
      task.isActive = false;
    });
    
    this.stats.activeTasks = 0;
  }

  /**
   * 優先度に基づくタスク管理
   */
  public optimizeTasksByPriority(): void {
    if (!this.isOptimizationEnabled) return;

    const currentTasks = Array.from(this.tasks.values()).filter(task => task.isActive);
    
    // アプリ状態に応じた優先度フィルタリング
    if (this.appState.current === 'background') {
      // バックグラウンド時は低優先度タスクを停止
      currentTasks.forEach(task => {
        if (task.priority === TaskPriority.LOW) {
          this.stopTask(task.id);
          console.log(`BackgroundOptimizer: バックグラウンド時のため低優先度タスク '${task.name}' を停止`);
        }
      });
    } else if (this.appState.current === 'active') {
      // フォアグラウンド時は必要なタスクを再開
      this.tasks.forEach(task => {
        if (!task.isActive && task.priority !== TaskPriority.LOW) {
          this.startTask(task.id);
        }
      });
    }
  }

  /**
   * バッテリー使用量を考慮した最適化
   */
  public optimizeForBattery(): void {
    if (!this.isOptimizationEnabled) return;

    const batteryOptimizedTasks: string[] = [];

    this.tasks.forEach(task => {
      if (task.isActive) {
        // バッテリー消費の高いタスクの間隔を延長
        if (task.priority === TaskPriority.LOW || task.priority === TaskPriority.MEDIUM) {
          const currentInterval = this.intervals.get(task.id);
          if (currentInterval) {
            // 間隔を2倍に延長
            this.stopTask(task.id);
            
            const extendedInterval = setInterval(async () => {
              await this.executeTask(task);
            }, task.intervalMs * 2);

            this.intervals.set(task.id, extendedInterval as Timer);
            batteryOptimizedTasks.push(task.name);
          }
        }
      }
    });

    if (batteryOptimizedTasks.length > 0) {
      console.log('BackgroundOptimizer: バッテリー最適化を適用:', batteryOptimizedTasks);
    }
  }

  /**
   * リアルタイム通信の最適化
   */
  public optimizeRealtimeConnections(): void {
    // WebSocket接続の管理
    this.tasks.forEach(task => {
      if (task.name.includes('realtime') || task.name.includes('websocket')) {
        if (this.appState.current === 'background') {
          // バックグラウンド時は接続を一時停止
          if (task.isActive) {
            this.stopTask(task.id);
            console.log(`BackgroundOptimizer: リアルタイム接続 '${task.name}' を一時停止`);
          }
        } else {
          // フォアグラウンド時は接続を再開
          if (!task.isActive) {
            this.startTask(task.id);
            console.log(`BackgroundOptimizer: リアルタイム接続 '${task.name}' を再開`);
          }
        }
      }
    });
  }

  /**
   * 統計情報の取得
   */
  public getStats(): BackgroundStats {
    // 平均実行時間の更新
    const executionTimes: number[] = [];
    this.tasks.forEach(task => {
      if (task.lastExecuted > 0) {
        executionTimes.push(Date.now() - task.lastExecuted);
      }
    });

    if (executionTimes.length > 0) {
      this.stats.averageExecutionTime = 
        executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    }

    // バッテリー影響度の計算
    this.stats.batteryImpact = this.calculateBatteryImpact();

    return { ...this.stats };
  }

  /**
   * アプリ状態の取得
   */
  public getAppState(): AppStateInfo {
    return { ...this.appState };
  }

  /**
   * 最適化の有効/無効切り替え
   */
  public setOptimizationEnabled(enabled: boolean): void {
    this.isOptimizationEnabled = enabled;
    console.log(`BackgroundOptimizer: 最適化を${enabled ? '有効' : '無効'}にしました`);
  }

  /**
   * アプリ状態リスナーの初期化
   */
  private initializeAppStateListener(): void {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const now = Date.now();
      const previousState = this.appState.current;

      // バックグラウンド時間の計算
      if (previousState === 'background' && nextAppState === 'active') {
        this.appState.backgroundDuration = now - this.appState.transitionTime;
      }

      this.appState = {
        current: nextAppState,
        previous: previousState,
        transitionTime: now,
        backgroundDuration: nextAppState === 'background' ? 0 : this.appState.backgroundDuration
      };

      console.log(`BackgroundOptimizer: アプリ状態変更 ${previousState} -> ${nextAppState}`);

      // 状態変更に応じた最適化実行
      this.handleAppStateChange(nextAppState, previousState);
    });
  }

  /**
   * アプリ状態変更の処理
   */
  private handleAppStateChange(current: AppStateStatus, previous: AppStateStatus): void {
    if (current === 'background') {
      // バックグラウンド移行時の最適化
      this.optimizeTasksByPriority();
      this.optimizeRealtimeConnections();
      this.optimizeForBattery();
    } else if (current === 'active' && previous === 'background') {
      // フォアグラウンド復帰時の最適化
      this.restoreNormalOperation();
    }
  }

  /**
   * 通常動作の復元
   */
  private restoreNormalOperation(): void {
    console.log('BackgroundOptimizer: 通常動作を復元します');

    // 停止していたタスクの再開
    this.tasks.forEach(task => {
      if (!task.isActive && task.priority !== TaskPriority.LOW) {
        this.startTask(task.id);
      }
    });

    // リアルタイム接続の復元
    this.optimizeRealtimeConnections();
  }

  /**
   * アプリ状態に応じた間隔調整
   */
  private adjustIntervalForAppState(task: BackgroundTask): number {
    let multiplier = 1;

    if (this.appState.current === 'background') {
      // バックグラウンド時は間隔を延長
      switch (task.priority) {
        case TaskPriority.LOW:
          multiplier = 4; // 4倍に延長
          break;
        case TaskPriority.MEDIUM:
          multiplier = 2; // 2倍に延長
          break;
        case TaskPriority.HIGH:
          multiplier = 1.5; // 1.5倍に延長
          break;
        case TaskPriority.CRITICAL:
          multiplier = 1; // 変更なし
          break;
      }
    }

    return task.intervalMs * multiplier;
  }

  /**
   * タスクの実行
   */
  private async executeTask(task: BackgroundTask): Promise<void> {
    const startTime = performance.now();

    try {
      await task.execute();
      
      task.lastExecuted = Date.now();
      task.currentRetries = 0; // 成功時はリトライカウントをリセット
      this.stats.completedTasks++;

      const executionTime = performance.now() - startTime;
      console.log(`BackgroundOptimizer: タスク '${task.name}' 実行完了 (${executionTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error(`BackgroundOptimizer: タスク '${task.name}' 実行エラー:`, error);
      
      this.stats.failedTasks++;
      task.currentRetries = (task.currentRetries || 0) + 1;

      // エラーハンドラーの実行
      if (task.onError) {
        task.onError(error as Error);
      }

      // 最大リトライ回数に達した場合は停止
      if (task.currentRetries >= (task.maxRetries || 3)) {
        console.error(`BackgroundOptimizer: タスク '${task.name}' の最大リトライ回数に達したため停止します`);
        this.stopTask(task.id);
      }
    }
  }

  /**
   * バッテリー影響度の計算
   */
  private calculateBatteryImpact(): number {
    let impact = 0;

    this.tasks.forEach(task => {
      if (task.isActive) {
        // 優先度と実行頻度に基づいてバッテリー影響度を計算
        const frequencyFactor = 60000 / task.intervalMs; // 1分あたりの実行回数
        
        let priorityWeight = 1;
        switch (task.priority) {
          case TaskPriority.LOW: priorityWeight = 0.5; break;
          case TaskPriority.MEDIUM: priorityWeight = 1; break;
          case TaskPriority.HIGH: priorityWeight = 1.5; break;
          case TaskPriority.CRITICAL: priorityWeight = 2; break;
        }

        impact += frequencyFactor * priorityWeight;
      }
    });

    return Math.round(impact * 100) / 100;
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    console.log('BackgroundOptimizer: クリーンアップを実行します');
    this.stopAllTasks();
    // AppStateのリスナーはReact Nativeが自動的に管理
  }
}

/**
 * バックグラウンド最適化用カスタムフック
 */
export const useBackgroundOptimization = () => {
  const optimizer = BackgroundOptimizer.getInstance();

  const registerTask = React.useCallback((task: BackgroundTask) => {
    optimizer.registerTask(task);
  }, []);

  const unregisterTask = React.useCallback((taskId: string) => {
    optimizer.unregisterTask(taskId);
  }, []);

  const startTask = React.useCallback((taskId: string) => {
    optimizer.startTask(taskId);
  }, []);

  const stopTask = React.useCallback((taskId: string) => {
    optimizer.stopTask(taskId);
  }, []);

  const getStats = React.useCallback(() => {
    return optimizer.getStats();
  }, []);

  const getAppState = React.useCallback(() => {
    return optimizer.getAppState();
  }, []);

  return {
    registerTask,
    unregisterTask,
    startTask,
    stopTask,
    getStats,
    getAppState
  };
};

// シングルトンインスタンスのエクスポート
export const backgroundOptimizer = BackgroundOptimizer.getInstance();