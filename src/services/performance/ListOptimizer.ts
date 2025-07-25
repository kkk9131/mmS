import * as React from 'react';
import { FlatList, FlatListProps } from 'react-native';

/**
 * リスト最適化設定
 */
export interface ListOptimizationConfig {
  virtualizationEnabled: boolean;
  windowSize: number;
  maxToRenderPerBatch: number;
  updateCellsBatchingPeriod: number;
  initialNumToRender: number;
  removeClippedSubviews: boolean;
  enablePrefetch: boolean;
  prefetchThreshold: number;
}

/**
 * リスト最適化クラス
 */
export class ListOptimizer {
  private static instance: ListOptimizer;
  private config: ListOptimizationConfig;
  private isScrollMonitoring: boolean = false;

  private constructor() {
    this.config = {
      virtualizationEnabled: true,
      windowSize: 10,
      maxToRenderPerBatch: 5,
      updateCellsBatchingPeriod: 50,
      initialNumToRender: 8,
      removeClippedSubviews: true,
      enablePrefetch: true,
      prefetchThreshold: 0.5
    };
  }

  public static getInstance(): ListOptimizer {
    if (!ListOptimizer.instance) {
      ListOptimizer.instance = new ListOptimizer();
    }
    return ListOptimizer.instance;
  }

  /**
   * 最適化設定の取得
   */
  public getOptimizedProps<ItemT>(): Partial<FlatListProps<ItemT>> {
    return {
      windowSize: this.config.windowSize,
      maxToRenderPerBatch: this.config.maxToRenderPerBatch,
      updateCellsBatchingPeriod: this.config.updateCellsBatchingPeriod,
      initialNumToRender: this.config.initialNumToRender,
      removeClippedSubviews: this.config.removeClippedSubviews,
      scrollEventThrottle: 16,
      disableVirtualization: !this.config.virtualizationEnabled
    };
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<ListOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('ListOptimizer: 設定を更新しました');
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): ListOptimizationConfig {
    return { ...this.config };
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    this.isScrollMonitoring = false;
    console.log('ListOptimizer: クリーンアップ完了');
  }
}

/**
 * リスト最適化カスタムフック
 */
export const useOptimizedList = <ItemT = any>(config?: {
  data: ItemT[];
  renderItem: ({ item }: { item: ItemT }) => React.ReactElement;
  keyExtractor: (item: ItemT) => string;
  estimatedItemSize?: number;
  windowSize?: number;
  maxToRenderPerBatch?: number;
  initialNumToRender?: number;
  removeClippedSubviews?: boolean;
  getItemLayout?: (data: ItemT[] | null | undefined, index: number) => { length: number; offset: number; index: number };
}) => {
  const optimizer = ListOptimizer.getInstance();
  
  const OptimizedList = React.useMemo(() => {
    const Component = React.forwardRef<FlatList<ItemT>, FlatListProps<ItemT>>((props, ref) => {
      const optimizedProps = {
        ...props,
        ...optimizer.getOptimizedProps<ItemT>()
      };

      return React.createElement(FlatList as any, { ...optimizedProps, ref });
    });
    
    Component.displayName = 'OptimizedFlatList';
    return Component;
  }, [optimizer]);

  return { OptimizedList };
};

// シングルトンインスタンスのエクスポート
export const listOptimizer = ListOptimizer.getInstance();