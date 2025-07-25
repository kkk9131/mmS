/**
 * アクセシビリティパフォーマンス最適化ユーティリティ
 * 
 * アクセシビリティ機能の遅延読み込み、メモリ最適化、
 * レンダリングパフォーマンスの改善を提供します。
 */

import * as React from 'react';
import { AccessibilityInfo, InteractionManager } from 'react-native';

/**
 * 遅延読み込み設定
 */
interface LazyLoadConfig {
  enabled: boolean;
  delay: number;
  priority: 'high' | 'normal' | 'low';
  dependencies?: string[];
}

/**
 * パフォーマンスメトリクス
 */
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  accessibilityNodesCount: number;
  lastMeasurement: number;
}

/**
 * アクセシビリティパフォーマンス最適化マネージャー
 */
class AccessibilityPerformanceManager {
  private static instance: AccessibilityPerformanceManager;
  private isScreenReaderEnabled: boolean = false;
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    memoryUsage: 0,
    accessibilityNodesCount: 0,
    lastMeasurement: Date.now()
  };
  private lazyLoadQueue: Map<string, LazyLoadConfig> = new Map();
  private loadedComponents: Set<string> = new Set();

  private constructor() {
    this.initializeScreenReaderDetection();
    this.startPerformanceMonitoring();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AccessibilityPerformanceManager {
    if (!AccessibilityPerformanceManager.instance) {
      AccessibilityPerformanceManager.instance = new AccessibilityPerformanceManager();
    }
    return AccessibilityPerformanceManager.instance;
  }

  /**
   * スクリーンリーダー検出の初期化
   */
  private async initializeScreenReaderDetection(): Promise<void> {
    try {
      this.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      AccessibilityInfo.addEventListener('screenReaderChanged', (isEnabled) => {
        this.isScreenReaderEnabled = isEnabled;
        console.log(`パフォーマンス最適化: スクリーンリーダー状態変更 - ${isEnabled ? '有効' : '無効'}`);
        
        // スクリーンリーダーが有効になった場合、遅延読み込みを実行
        if (isEnabled) {
          this.loadPendingAccessibilityComponents();
        }
      });
    } catch (error) {
      console.warn('スクリーンリーダー検出でエラー:', error);
    }
  }

  /**
   * パフォーマンス監視の開始
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.measurePerformance();
    }, 5000); // 5秒間隔で測定
  }

  /**
   * パフォーマンス測定
   */
  private measurePerformance(): void {
    if (__DEV__) {
      const now = Date.now();
      const timeDiff = now - this.metrics.lastMeasurement;
      
      // 簡易的なメモリ使用量推定
      this.metrics.memoryUsage = this.estimateMemoryUsage();
      this.metrics.accessibilityNodesCount = this.loadedComponents.size;
      this.metrics.lastMeasurement = now;

      // メモリ使用量が多い場合は警告
      if (this.metrics.memoryUsage > 50000) {
        console.warn(`アクセシビリティメモリ使用量が高い: ${this.metrics.memoryUsage}KB`);
        this.optimizeMemoryUsage();
      }
    }
  }

  /**
   * メモリ使用量の推定
   */
  private estimateMemoryUsage(): number {
    // 簡易的な推定（実際の実装では正確な測定が必要）
    return this.loadedComponents.size * 1000; // 1コンポーネントあたり1KB
  }

  /**
   * メモリ使用量の最適化
   */
  private optimizeMemoryUsage(): void {
    // 不要なアクセシビリティノードをクリーンアップ
    console.log('アクセシビリティメモリ最適化を実行中...');
    
    // 未使用のコンポーネントを特定してアンロード
    const unusedComponents: string[] = [];
    this.loadedComponents.forEach(componentId => {
      // 簡易的な使用チェック（実際の実装では使用状況を追跡）
      const lastUsed = Date.now() - 300000; // 5分前
      if (Math.random() > 0.8) { // 20%の確率で未使用とみなす（デモ用）
        unusedComponents.push(componentId);
      }
    });

    unusedComponents.forEach(componentId => {
      this.unloadComponent(componentId);
    });

    console.log(`${unusedComponents.length}個のコンポーネントをアンロードしました`);
  }

  /**
   * コンポーネントの遅延読み込み登録
   */
  public registerLazyLoad(componentId: string, config: LazyLoadConfig): void {
    this.lazyLoadQueue.set(componentId, config);
    
    // スクリーンリーダーが既に有効な場合は即座に読み込み
    if (this.isScreenReaderEnabled) {
      this.loadComponent(componentId);
    }
  }

  /**
   * 保留中のアクセシビリティコンポーネントを読み込み
   */
  private loadPendingAccessibilityComponents(): void {
    console.log('保留中のアクセシビリティコンポーネントを読み込み中...');
    
    const sortedComponents = Array.from(this.lazyLoadQueue.entries())
      .sort(([, a], [, b]) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    sortedComponents.forEach(([componentId, config]) => {
      if (!this.loadedComponents.has(componentId)) {
        setTimeout(() => {
          this.loadComponent(componentId);
        }, config.delay);
      }
    });
  }

  /**
   * 個別コンポーネントの読み込み
   */
  private loadComponent(componentId: string): void {
    if (this.loadedComponents.has(componentId)) {
      return;
    }

    const config = this.lazyLoadQueue.get(componentId);
    if (!config) {
      return;
    }

    console.log(`アクセシビリティコンポーネントを読み込み: ${componentId}`);
    
    InteractionManager.runAfterInteractions(() => {
      this.loadedComponents.add(componentId);
      this.lazyLoadQueue.delete(componentId);
      
      // 読み込み完了イベントを発火
      this.notifyComponentLoaded(componentId);
    });
  }

  /**
   * コンポーネントのアンロード
   */
  private unloadComponent(componentId: string): void {
    if (this.loadedComponents.has(componentId)) {
      this.loadedComponents.delete(componentId);
      console.log(`アクセシビリティコンポーネントをアンロード: ${componentId}`);
    }
  }

  /**
   * コンポーネント読み込み完了の通知
   */
  private notifyComponentLoaded(componentId: string): void {
    // カスタムイベントの発火やコールバックの実行
    console.log(`コンポーネント読み込み完了: ${componentId}`);
  }

  /**
   * 現在のパフォーマンスメトリクスを取得
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * スクリーンリーダー状態を取得
   */
  public isScreenReaderActive(): boolean {
    return this.isScreenReaderEnabled;
  }

  /**
   * 読み込み済みコンポーネント数を取得
   */
  public getLoadedComponentsCount(): number {
    return this.loadedComponents.size;
  }
}

/**
 * 遅延読み込み対応のアクセシビリティプロバイダー
 */
export const useLazyAccessibility = (
  componentId: string,
  config: Partial<LazyLoadConfig> = {}
) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const manager = AccessibilityPerformanceManager.getInstance();

  const defaultConfig: LazyLoadConfig = {
    enabled: true,
    delay: 0,
    priority: 'normal',
    ...config
  };

  React.useEffect(() => {
    if (!defaultConfig.enabled) {
      setIsLoaded(true);
      return;
    }

    // スクリーンリーダーが有効な場合は読み込み
    if (manager.isScreenReaderActive()) {
      setIsLoading(true);
      manager.registerLazyLoad(componentId, defaultConfig);
      
      // 読み込み完了を待機
      const checkLoaded = () => {
        if (manager.getLoadedComponentsCount() > 0) {
          setIsLoaded(true);
          setIsLoading(false);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      
      setTimeout(checkLoaded, defaultConfig.delay);
    } else {
      // スクリーンリーダーが無効な場合は登録のみ
      manager.registerLazyLoad(componentId, defaultConfig);
    }
  }, [componentId, manager]);

  return {
    isLoaded,
    isLoading,
    isScreenReaderActive: manager.isScreenReaderActive()
  };
};

/**
 * パフォーマンス最適化されたリストアイテム
 */
export interface OptimizedListProps {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  getItemId: (item: any, index: number) => string;
  windowSize?: number;
  accessibilityBatchSize?: number;
}

export const useOptimizedAccessibilityList = ({
  items,
  renderItem,
  getItemId,
  windowSize = 10,
  accessibilityBatchSize = 5
}: OptimizedListProps) => {
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: windowSize });
  const [accessibilityRange, setAccessibilityRange] = React.useState({ start: 0, end: accessibilityBatchSize });
  const manager = AccessibilityPerformanceManager.getInstance();

  // 可視範囲の更新
  const updateVisibleRange = React.useCallback((start: number, end: number) => {
    setVisibleRange({ start: Math.max(0, start), end: Math.min(items.length, end) });
    
    // アクセシビリティ範囲も更新（スクリーンリーダーが有効な場合）
    if (manager.isScreenReaderActive()) {
      const accessStart = Math.max(0, start - accessibilityBatchSize);
      const accessEnd = Math.min(items.length, end + accessibilityBatchSize);
      setAccessibilityRange({ start: accessStart, end: accessEnd });
    }
  }, [items.length, accessibilityBatchSize, manager]);

  // 最適化されたアイテムをレンダリング
  const renderOptimizedItems = React.useCallback(() => {
    const itemsToRender = [];
    const { start, end } = manager.isScreenReaderActive() ? accessibilityRange : visibleRange;

    for (let i = start; i < end; i++) {
      if (items[i]) {
        const itemId = getItemId(items[i], i);
        const listItem = React.createElement(OptimizedListItem, {
          key: itemId,
          item: items[i],
          index: i,
          renderItem: renderItem,
          isVisible: i >= visibleRange.start && i < visibleRange.end
        });
        itemsToRender.push(listItem);
      }
    }

    return itemsToRender;
  }, [items, renderItem, getItemId, visibleRange, accessibilityRange, manager]);

  return {
    renderOptimizedItems,
    updateVisibleRange,
    visibleRange,
    accessibilityRange
  };
};

/**
 * 最適化されたリストアイテムコンポーネント
 */
interface OptimizedListItemProps {
  item: any;
  index: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  isVisible: boolean;
}

const OptimizedListItem: React.FC<OptimizedListItemProps> = React.memo(({
  item,
  index,
  renderItem,
  isVisible
}) => {
  const [shouldRender, setShouldRender] = React.useState(isVisible);

  React.useEffect(() => {
    if (isVisible && !shouldRender) {
      // 可視になった時に遅延レンダリング
      InteractionManager.runAfterInteractions(() => {
        setShouldRender(true);
      });
    }
  }, [isVisible, shouldRender]);

  if (!shouldRender) {
    // プレースホルダーを表示
    return null; // React NativeではdivではなくViewを使用するか、nullを返す
  }

  return renderItem(item, index) as React.ReactElement;
});

OptimizedListItem.displayName = 'OptimizedListItem';

/**
 * レンダリングパフォーマンス測定フック
 */
export const useRenderPerformance = (componentName: string) => {
  const renderStartTime = React.useRef<number>(0);
  const renderCount = React.useRef<number>(0);

  React.useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current++;
  });

  React.useLayoutEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    if (__DEV__ && renderTime > 16) { // 16ms閾値（60fps）
      console.warn(`${componentName}: レンダリング時間が長い (${renderTime.toFixed(2)}ms)`);
    }

    // パフォーマンスマネージャーに記録
    const manager = AccessibilityPerformanceManager.getInstance();
    const metrics = manager.getMetrics();
    metrics.renderTime = renderTime;
  });

  return {
    renderCount: renderCount.current,
    componentName
  };
};

/**
 * アクセシビリティ機能の条件付き読み込み
 */
export const useConditionalAccessibility = () => {
  const manager = AccessibilityPerformanceManager.getInstance();
  const [features, setFeatures] = React.useState({
    screenReader: false,
    highContrast: false,
    largeText: false,
    reducedMotion: false
  });

  React.useEffect(() => {
    const updateFeatures = () => {
      setFeatures({
        screenReader: manager.isScreenReaderActive(),
        highContrast: false, // 実装に応じて検出
        largeText: false,    // 実装に応じて検出
        reducedMotion: false // 実装に応じて検出
      });
    };

    updateFeatures();
    
    // スクリーンリーダー状態変更の監視
    const interval = setInterval(updateFeatures, 1000);
    
    return () => clearInterval(interval);
  }, [manager]);

  return features;
};

/**
 * メモリ効率的なアクセシビリティノード管理
 */
export const useAccessibilityNodePool = (maxNodes: number = 100) => {
  const nodePool = React.useRef<Map<string, any>>(new Map());
  const usedNodes = React.useRef<Set<string>>(new Set());

  const acquireNode = React.useCallback((nodeId: string, nodeData: any) => {
    if (nodePool.current.size >= maxNodes) {
      // 古いノードを削除
      const oldestNode = nodePool.current.keys().next().value;
      if (oldestNode !== undefined) {
        nodePool.current.delete(oldestNode);
        usedNodes.current.delete(oldestNode);
      }
    }

    nodePool.current.set(nodeId, nodeData);
    usedNodes.current.add(nodeId);
    
    return nodeData;
  }, [maxNodes]);

  const releaseNode = React.useCallback((nodeId: string) => {
    usedNodes.current.delete(nodeId);
    
    // 即座に削除せず、一定時間後に削除（再利用の可能性を考慮）
    setTimeout(() => {
      if (!usedNodes.current.has(nodeId)) {
        nodePool.current.delete(nodeId);
      }
    }, 5000);
  }, []);

  const getPoolStats = React.useCallback(() => {
    return {
      totalNodes: nodePool.current.size,
      usedNodes: usedNodes.current.size,
      freeNodes: nodePool.current.size - usedNodes.current.size
    };
  }, []);

  return {
    acquireNode,
    releaseNode,
    getPoolStats
  };
};

// シングルトンインスタンスをエクスポート
export const AccessibilityPerformance = AccessibilityPerformanceManager.getInstance();

export default AccessibilityPerformanceManager;