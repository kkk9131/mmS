import * as React from 'react';
import { performanceManager } from './PerformanceManager';
const { useMemo, useCallback, useRef, useEffect } = React;

/**
 * レンダリング最適化を担当するクラス
 * React.memo、useMemo、useCallbackを統合管理し、
 * 不要な再レンダリングを防止してパフォーマンスを向上させる
 */
export class RenderingOptimizer {
  private static instance: RenderingOptimizer;
  private renderTimes: Map<string, number[]> = new Map();
  private isMonitoring: boolean = false;

  private constructor() {}

  public static getInstance(): RenderingOptimizer {
    if (!RenderingOptimizer.instance) {
      RenderingOptimizer.instance = new RenderingOptimizer();
    }
    return RenderingOptimizer.instance;
  }

  /**
   * コンポーネントを自動最適化するHOC
   * React.memo + カスタム比較関数で再レンダリングを制御
   */
  public optimizeComponent<T extends object>(
    Component: React.ComponentType<T>,
    compareProps?: (prevProps: T, nextProps: T) => boolean
  ): React.ComponentType<T> {
    const componentName = Component.displayName || Component.name || 'Unknown';
    
    const OptimizedComponent = React.memo(Component, (prevProps: T, nextProps: T) => {
      const startTime = performance.now();
      
      let shouldSkipRender = false;
      
      if (compareProps) {
        shouldSkipRender = compareProps(prevProps, nextProps);
      } else {
        shouldSkipRender = this.shallowEqual(prevProps, nextProps);
      }
      
      const endTime = performance.now();
      this.recordRenderTime(componentName, endTime - startTime);
      
      if (shouldSkipRender) {
        console.log(`RenderingOptimizer: ${componentName} の再レンダリングをスキップしました`);
      }
      
      return shouldSkipRender;
    });

    OptimizedComponent.displayName = `Optimized(${componentName})`;
    
    return OptimizedComponent;
  }

  /**
   * 重い計算処理をメモ化するユーティリティ
   * 注意：このメソッドは通常のJavaScriptメモ化を行います。
   * React Hookではないため、Reactコンポーネント外でも使用可能です。
   */
  public memoizeExpensiveCalculations<T>(
    fn: (...args: any[]) => T,
    dependencies?: any[]
  ): (...args: any[]) => T {
    const cache = new Map<string, T>();
    
    const memoizedFunction = (...args: any[]): T => {
      const key = JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const startTime = performance.now();
      const result = fn(...args);
      const endTime = performance.now();
      
      console.log(`RenderingOptimizer: メモ化された計算が実行されました (${(endTime - startTime).toFixed(2)}ms)`);
      
      cache.set(key, result);
      return result;
    };

    return memoizedFunction;
  }

  /**
   * レンダータイムの測定開始
   */
  public measureRenderTime(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      this.recordRenderTime(componentName, renderTime);
      
      // 閾値を超えた場合の警告
      const settings = performanceManager.getSettings();
      if (settings && renderTime > settings.renderingOptimization.rerenderThreshold) {
        console.warn(
          `RenderingOptimizer: ${componentName} のレンダリング時間が閾値を超えました (${renderTime.toFixed(2)}ms)`
        );
      }
    };
  }

  /**
   * レンダリング監視の開始
   */
  public startRenderingMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('RenderingOptimizer: レンダリング監視を開始しました');
    
    // 定期的にレンダリング統計をチェック
    setInterval(() => {
      this.analyzeRenderingPerformance();
    }, 10000) as number; // 10秒間隔
  }

  /**
   * レンダリング監視の停止
   */
  public stopRenderingMonitoring(): void {
    this.isMonitoring = false;
    console.log('RenderingOptimizer: レンダリング監視を停止しました');
  }

  /**
   * 不要な再レンダリングを検出して防止
   */
  public preventUnnecessaryRerenders<T extends object>(
    Component: React.ComponentType<T>
  ): React.ComponentType<T> {
    return this.optimizeComponent(Component, (prevProps: T, nextProps: T) => {
      // プロパティの詳細比較
      const keys = Object.keys(nextProps as any);
      
      for (const key of keys) {
        const prevValue = (prevProps as any)[key];
        const nextValue = (nextProps as any)[key];
        
        // 関数の参照比較
        if (typeof prevValue === 'function' && typeof nextValue === 'function') {
          if (prevValue !== nextValue) {
            console.log(`RenderingOptimizer: 関数プロパティ '${key}' の変更を検出`);
            return false;
          }
        }
        // オブジェクトの浅い比較
        else if (typeof prevValue === 'object' && typeof nextValue === 'object') {
          if (!this.shallowEqual(prevValue, nextValue)) {
            console.log(`RenderingOptimizer: オブジェクトプロパティ '${key}' の変更を検出`);
            return false;
          }
        }
        // プリミティブ値の比較
        else if (prevValue !== nextValue) {
          console.log(`RenderingOptimizer: プロパティ '${key}' の変更を検出`);
          return false;
        }
      }
      
      return true; // 変更なし、再レンダリングをスキップ
    });
  }

  /**
   * レンダリング統計の取得
   */
  public getRenderingStats(): { [componentName: string]: { avgTime: number; totalRenders: number } } {
    const stats: { [componentName: string]: { avgTime: number; totalRenders: number } } = {};
    
    this.renderTimes.forEach((times, componentName) => {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      stats[componentName] = {
        avgTime: Math.round(avgTime * 100) / 100,
        totalRenders: times.length
      };
    });
    
    return stats;
  }

  /**
   * レンダリング時間の記録
   */
  private recordRenderTime(componentName: string, renderTime: number): void {
    if (!this.renderTimes.has(componentName)) {
      this.renderTimes.set(componentName, []);
    }
    
    const times = this.renderTimes.get(componentName)!;
    times.push(renderTime);
    
    // 最新100回分のみ保持
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * 浅い比較関数
   */
  private shallowEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    
    if (typeof obj1 !== 'object' || obj1 === null || 
        typeof obj2 !== 'object' || obj2 === null) {
      return false;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key) || obj1[key] !== obj2[key]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * レンダリング性能の分析
   */
  private analyzeRenderingPerformance(): void {
    const stats = this.getRenderingStats();
    const settings = performanceManager.getSettings();
    
    if (!settings) return;
    
    const threshold = settings.renderingOptimization.rerenderThreshold;
    
    Object.entries(stats).forEach(([componentName, stat]) => {
      if (stat.avgTime > threshold) {
        console.warn(
          `RenderingOptimizer: ${componentName} の平均レンダリング時間が閾値を超えています ` +
          `(平均: ${stat.avgTime}ms, 閾値: ${threshold}ms)`
        );
      }
      
      if (stat.totalRenders > 50) { // 頻繁な再レンダリングの検出
        console.warn(
          `RenderingOptimizer: ${componentName} が頻繁に再レンダリングされています ` +
          `(回数: ${stat.totalRenders})`
        );
      }
    });
  }
}

/**
 * パフォーマンス最適化用カスタムフック
 */
export const useOptimizedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  return useCallback(callback, deps);
};

/**
 * パフォーマンス最適化用メモ化フック
 */
export const useOptimizedMemo = <T>(
  factory: () => T,
  deps?: React.DependencyList
): T => {
  return useMemo(factory, deps || []);
};

/**
 * レンダリング時間測定フック
 */
export const useRenderTimeTracker = (componentName: string) => {
  const renderingOptimizer = RenderingOptimizer.getInstance();
  
  useEffect(() => {
    const endMeasurement = renderingOptimizer.measureRenderTime(componentName);
    return endMeasurement;
  });
};

/**
 * コンポーネント自動最適化HOC
 */
export const withPerformanceOptimization = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  const renderingOptimizer = RenderingOptimizer.getInstance();
  return renderingOptimizer.optimizeComponent(Component);
};

// シングルトンインスタンスのエクスポート
export const renderingOptimizer = RenderingOptimizer.getInstance();