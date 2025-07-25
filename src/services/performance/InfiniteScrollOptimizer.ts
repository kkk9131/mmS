import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { FlatList, ViewToken } from 'react-native';
import { performanceManager } from './PerformanceManager';

/**
 * 無限スクロール最適化の設定
 */
export interface InfiniteScrollConfig<T> {
  data: T[];
  loadMore: () => Promise<void>;
  hasMore: boolean;
  threshold?: number;
  preloadItemCount?: number;
  enablePreload?: boolean;
  batchSize?: number;
  debounceMs?: number;
  retryCount?: number;
  errorHandler?: (error: Error) => void;
}

/**
 * プリロード状態の管理
 */
interface PreloadState {
  isPreloading: boolean;
  lastPreloadIndex: number;
  preloadedBatches: Set<number>;
  failedBatches: Set<number>;
}

/**
 * 無限スクロールとプリロード最適化クラス
 */
export class InfiniteScrollOptimizer<T> {
  private config: InfiniteScrollConfig<T>;
  private preloadState: PreloadState;
  private loadMoreDebounce: number | null = null;
  private isLoadingMore: boolean = false;
  private retryTimeouts: Map<number, number> = new Map();

  constructor(config: InfiniteScrollConfig<T>) {
    this.config = {
      threshold: 0.5,
      preloadItemCount: 5,
      enablePreload: true,
      batchSize: 10,  
      debounceMs: 300,
      retryCount: 3,
      ...config
    };

    this.preloadState = {
      isPreloading: false,
      lastPreloadIndex: -1,
      preloadedBatches: new Set(),
      failedBatches: new Set()
    };
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<InfiniteScrollConfig<T>>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * onEndReached ハンドラー
   */
  public getEndReachedHandler = (): (() => void) => {
    return () => {
      if (this.isLoadingMore || !this.config.hasMore) {
        return;
      }

      // デバウンス処理
      if (this.loadMoreDebounce) {
        clearTimeout(this.loadMoreDebounce);
      }

      this.loadMoreDebounce = setTimeout(() => {
        this.executeLoadMore();
      }, this.config.debounceMs);
    };
  };

  /**
   * onViewableItemsChanged ハンドラー
   */
  public getViewableItemsChangedHandler = (): ((info: { viewableItems: ViewToken[] }) => void) => {
    return ({ viewableItems }) => {
      if (!this.config.enablePreload || viewableItems.length === 0) {
        return;
      }

      // 最後に表示されているアイテムのインデックス
      const lastVisibleIndex = Math.max(
        ...viewableItems.map(item => item.index || 0)
      );

      // プリロードの実行判定
      this.checkAndExecutePreload(lastVisibleIndex);

      // パフォーマンス監視
      this.recordScrollMetrics(viewableItems);
    };
  };

  /**
   * 読み込み状態の取得
   */
  public getLoadingState(): {
    isLoadingMore: boolean;
    isPreloading: boolean;
    hasMore: boolean;
    preloadProgress: number;
  } {
    const totalBatches = Math.ceil(this.config.data.length / (this.config.batchSize || 10));
    const preloadedCount = this.preloadState.preloadedBatches.size;
    
    return {
      isLoadingMore: this.isLoadingMore,
      isPreloading: this.preloadState.isPreloading,
      hasMore: this.config.hasMore,
      preloadProgress: totalBatches > 0 ? preloadedCount / totalBatches : 0
    };
  }

  /**
   * プリロード状態のリセット
   */
  public resetPreloadState(): void {
    this.preloadState = {
      isPreloading: false,
      lastPreloadIndex: -1,
      preloadedBatches: new Set(),
      failedBatches: new Set()
    };

    // タイムアウトのクリア
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  /**
   * 手動プリロード実行
   */
  public async executeManualPreload(startIndex: number, count: number): Promise<void> {
    if (this.preloadState.isPreloading) {
      console.log('InfiniteScrollOptimizer: プリロード中のため、手動プリロードをスキップ');
      return;
    }

    const batchNumber = Math.floor(startIndex / (this.config.batchSize || 10));
    
    if (this.preloadState.preloadedBatches.has(batchNumber)) {
      console.log(`InfiniteScrollOptimizer: バッチ ${batchNumber} は既にプリロード済み`);
      return;
    }

    await this.executePreload(startIndex, count);
  }

  /**
   * エラー統計の取得
   */
  public getErrorStats(): {
    failedBatches: number[];
    totalErrors: number;
    lastError: Error | null;
  } {
    return {
      failedBatches: Array.from(this.preloadState.failedBatches),
      totalErrors: this.preloadState.failedBatches.size,
      lastError: null // TODO: 最後のエラーを保存
    };
  }

  /**
   * 実際の読み込み実行
   */
  private async executeLoadMore(): Promise<void> {
    if (this.isLoadingMore || !this.config.hasMore) {
      return;
    }

    this.isLoadingMore = true;
    console.log('InfiniteScrollOptimizer: 追加データ読み込み開始');

    const startTime = performance.now();

    try {
      await this.config.loadMore();
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      console.log(`InfiniteScrollOptimizer: 追加データ読み込み完了 (${loadTime.toFixed(2)}ms)`);
      
      // パフォーマンスメトリクス記録
      this.recordLoadMoreMetrics(loadTime);
      
    } catch (error) {
      console.error('InfiniteScrollOptimizer: 追加データ読み込みエラー', error);
      
      if (this.config.errorHandler) {
        this.config.errorHandler(error as Error);
      }
      
    } finally {
      this.isLoadingMore = false;
    }
  }

  /**
   * プリロード実行の判定と実行
   */
  private checkAndExecutePreload(lastVisibleIndex: number): void {
    const { data, preloadItemCount = 5 } = this.config;
    const preloadThreshold = data.length - preloadItemCount;

    // プリロード条件の確認
    if (lastVisibleIndex >= preloadThreshold && 
        lastVisibleIndex > this.preloadState.lastPreloadIndex) {
      
      this.preloadState.lastPreloadIndex = lastVisibleIndex;
      this.executePreload(lastVisibleIndex, preloadItemCount);
    }
  }

  /**
   * プリロードの実行
   */
  private async executePreload(startIndex: number, count: number): Promise<void> {
    if (this.preloadState.isPreloading) {
      return;
    }

    const batchNumber = Math.floor(startIndex / (this.config.batchSize || 10));
    
    // 既にプリロード済み、または失敗済みのバッチはスキップ
    if (this.preloadState.preloadedBatches.has(batchNumber) ||
        this.preloadState.failedBatches.has(batchNumber)) {
      return;
    }

    this.preloadState.isPreloading = true;
    console.log(`InfiniteScrollOptimizer: プリロード開始 (インデックス: ${startIndex}, 件数: ${count})`);

    const startTime = performance.now();

    try {
      // プリロード処理（実際はloadMoreと同じだが、UIには影響しない）
      await this.config.loadMore();
      
      const endTime = performance.now();
      const preloadTime = endTime - startTime;
      
      // 成功したバッチを記録
      this.preloadState.preloadedBatches.add(batchNumber);
      
      console.log(`InfiniteScrollOptimizer: プリロード完了 (${preloadTime.toFixed(2)}ms)`);
      
      // パフォーマンスメトリクス記録
      this.recordPreloadMetrics(preloadTime, batchNumber);
      
    } catch (error) {
      console.error('InfiniteScrollOptimizer: プリロードエラー', error);
      
      // 失敗したバッチを記録
      this.preloadState.failedBatches.add(batchNumber);
      
      // リトライの実行
      this.scheduleRetry(batchNumber, startIndex, count);
      
    } finally {
      this.preloadState.isPreloading = false;
    }
  }

  /**
   * リトライのスケジューリング
   */
  private scheduleRetry(batchNumber: number, startIndex: number, count: number): void {
    const retryCount = this.config.retryCount || 3;
    
    // 既にリトライ中の場合はスキップ
    if (this.retryTimeouts.has(batchNumber)) {
      return;
    }

    // 指数バックオフでリトライ
    const retryDelay = Math.pow(2, retryCount) * 1000; // 2^n秒
    
    const retryTimeout = setTimeout(async () => {
      this.retryTimeouts.delete(batchNumber);
      
      // 失敗状態をクリアしてリトライ
      this.preloadState.failedBatches.delete(batchNumber);
      
      console.log(`InfiniteScrollOptimizer: バッチ ${batchNumber} をリトライします`);
      await this.executePreload(startIndex, count);
      
    }, retryDelay);

    this.retryTimeouts.set(batchNumber, retryTimeout);
  }

  /**
   * スクロールメトリクスの記録
   */
  private recordScrollMetrics(viewableItems: ViewToken[]): void {
    const visibleCount = viewableItems.length;
    const firstVisibleIndex = viewableItems[0]?.index || 0;
    const lastVisibleIndex = viewableItems[viewableItems.length - 1]?.index || 0;

    // パフォーマンス監視に記録
    // TODO: PerformanceMonitorと連携
    console.log(`InfiniteScrollOptimizer: 表示中アイテム ${visibleCount}件 (${firstVisibleIndex}-${lastVisibleIndex})`);
  }

  /**
   * LoadMoreメトリクスの記録
   */
  private recordLoadMoreMetrics(loadTime: number): void {
    // パフォーマンス監視システムに記録
    // TODO: PerformanceMonitorと連携
    if (loadTime > 2000) { // 2秒以上の場合は警告
      console.warn(`InfiniteScrollOptimizer: LoadMore処理が遅延しています (${loadTime.toFixed(2)}ms)`);
    }
  }

  /**
   * プリロードメトリクスの記録
   */
  private recordPreloadMetrics(preloadTime: number, batchNumber: number): void {
    // パフォーマンス監視システムに記録
    console.log(`InfiniteScrollOptimizer: バッチ ${batchNumber} プリロード時間: ${preloadTime.toFixed(2)}ms`);
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    if (this.loadMoreDebounce) {
      clearTimeout(this.loadMoreDebounce);
      this.loadMoreDebounce = null;
    }

    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();

    this.resetPreloadState();
  }
}

/**
 * 無限スクロール最適化用カスタムフック
 */
export const useInfiniteScrollOptimization = <T>(
  data: T[],
  loadMore: () => Promise<void>,
  hasMore: boolean,
  options?: Partial<InfiniteScrollConfig<T>>
) => {
  const optimizerRef = useRef<InfiniteScrollOptimizer<T> | null>(null);
  const [loadingState, setLoadingState] = useState({
    isLoadingMore: false,
    isPreloading: false,
    hasMore: false,
    preloadProgress: 0
  });

  // オプティマイザーの初期化
  useEffect(() => {
    const config: InfiniteScrollConfig<T> = {
      data,
      loadMore,
      hasMore,
      ...options
    };

    if (optimizerRef.current) {
      optimizerRef.current.updateConfig(config);
    } else {
      optimizerRef.current = new InfiniteScrollOptimizer(config);
    }

    // 状態の更新
    setLoadingState(optimizerRef.current.getLoadingState());
  }, [data, loadMore, hasMore, options]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (optimizerRef.current) {
        optimizerRef.current.cleanup();
      }
    };
  }, []);

  // ハンドラーの取得
  const handleEndReached = useMemo(() => {
    return optimizerRef.current?.getEndReachedHandler() || (() => {});
  }, [optimizerRef.current]);

  const handleViewableItemsChanged = useMemo(() => {
    return optimizerRef.current?.getViewableItemsChangedHandler() || (() => {});
  }, [optimizerRef.current]);

  // 手動操作用メソッド
  const manualPreload = useCallback(async (startIndex: number, count: number) => {
    if (optimizerRef.current) {
      await optimizerRef.current.executeManualPreload(startIndex, count);
      setLoadingState(optimizerRef.current.getLoadingState());
    }
  }, []);

  const resetPreload = useCallback(() => {
    if (optimizerRef.current) {
      optimizerRef.current.resetPreloadState();
      setLoadingState(optimizerRef.current.getLoadingState());
    }
  }, []);

  const getErrorStats = useCallback(() => {
    return optimizerRef.current?.getErrorStats() || {
      failedBatches: [],
      totalErrors: 0,
      lastError: null
    };
  }, []);

  return {
    handleEndReached,
    handleViewableItemsChanged,
    loadingState,
    manualPreload,
    resetPreload,
    getErrorStats
  };
};