import React, { memo, useCallback, useMemo, lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { reliableDataFetcher, adaptiveDataLoader } from './reliableDataFetcher';

// レイジーロード用のコンポーネント
const LazyImage = lazy(() => import('../components/LazyImage'));
const LazyPostList = lazy(() => import('../components/LazyPostList'));

// パフォーマンス最適化Hook
export const usePerformanceOptimization = () => {
  // メモ化されたコールバック
  const memoizedHandlers = useMemo(() => ({
    handleDataFetch: async (fetchFunction: () => Promise<any>, cacheKey: string) => {
      const startTime = Date.now();
      
      try {
        const result = await adaptiveDataLoader.loadData(
          // 軽量版データ取得
          async () => {
            console.log(`軽量データ取得開始: ${cacheKey}`);
            const data = await fetchFunction();
            return Array.isArray(data) ? data.slice(0, 10) : data; // 最初の10件のみ
          },
          // 完全版データ取得
          async () => {
            console.log(`完全データ取得開始: ${cacheKey}`);
            return await fetchFunction();
          }
        );
        
        const responseTime = Date.now() - startTime;
        adaptiveDataLoader.recordResponseTime(responseTime);
        
        return result;
      } catch (error) {
        console.error(`データ取得エラー (${cacheKey}):`, error);
        throw error;
      }
    },
    
    handleImageLoad: useCallback((imageUrl: string) => {
      // 画像の段階的読み込み
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(imageUrl);
        img.onerror = () => reject(new Error(`画像読み込み失敗: ${imageUrl}`));
        img.src = imageUrl;
      });
    }, []),
    
    // データの事前キャッシュ
    prefetchData: useCallback(async (keys: string[], fetchers: (() => Promise<any>)[]) => {
      const prefetchPromises = keys.map((key, index) => {
        const fetcher = fetchers[index];
        return reliableDataFetcher.fetchWithRetry(fetcher, {
          maxRetries: 1, // 事前取得なので少ないリトライ
          initialDelay: 500
        }).catch(error => {
          console.warn(`事前取得失敗 (${key}):`, error);
          return null;
        });
      });
      
      const results = await Promise.allSettled(prefetchPromises);
      console.log(`事前取得完了: ${results.filter(r => r.status === 'fulfilled').length}/${keys.length}件成功`);
    }, [])
  }), []);

  return memoizedHandlers;
};

// 高性能リストアイテムコンポーネント
interface OptimizedListItemProps {
  item: any;
  index: number;
  onPress?: (item: any) => void;
}

export const OptimizedListItem = memo<OptimizedListItemProps>(({ item, index, onPress }) => {
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  // アイテムが画面に表示される前の軽量レンダリング
  const isLightweightRender = useMemo(() => {
    return index > 20; // 20番目以降は軽量レンダリング
  }, [index]);

  if (isLightweightRender) {
    return (
      <View style={{ height: 100, backgroundColor: colors.neutral.gray100, margin: 4 }}>
        <ActivityIndicator size="small" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <Suspense fallback={<ActivityIndicator size="small" color={colors.primary.main} />}>
      <View style={{ padding: 12, backgroundColor: colors.neutral.white, margin: 4, borderRadius: 8 }}>
        {/* 実際のコンテンツ */}
        <LazyImage
          source={{ uri: item.avatar || 'https://via.placeholder.com/40' }}
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
      </View>
    </Suspense>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数でレンダリング最適化
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.index === nextProps.index
  );
});

// バーチャライゼーション対応リストコンポーネント
interface VirtualizedListProps {
  data: any[];
  renderItem: (props: { item: any; index: number }) => React.ReactElement;
  keyExtractor?: (item: any, index: number) => string;
  windowSize?: number;
  maxToRenderPerBatch?: number;
  updateCellsBatchingPeriod?: number;
}

export const VirtualizedList: React.FC<VirtualizedListProps> = ({
  data,
  renderItem,
  keyExtractor = (item, index) => item.id || index.toString(),
  windowSize = 5,
  maxToRenderPerBatch = 10,
  updateCellsBatchingPeriod = 250
}) => {
  const memoizedData = useMemo(() => data, [data]);
  
  const memoizedRenderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      return renderItem({ item, index });
    },
    [renderItem]
  );

  return (
    <Suspense fallback={<ActivityIndicator size="large" color={colors.primary.main} />}>
      <LazyPostList
        data={memoizedData}
        renderItem={memoizedRenderItem}
        keyExtractor={keyExtractor}
        windowSize={windowSize}
        maxToRenderPerBatch={maxToRenderPerBatch}
        updateCellsBatchingPeriod={updateCellsBatchingPeriod}
        removeClippedSubviews={true}
        initialNumToRender={10}
        getItemLayout={(data, index) => ({
          length: 100, // 推定アイテム高さ
          offset: 100 * index,
          index,
        })}
      />
    </Suspense>
  );
};

// パフォーマンス監視Hook
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = React.useState({
    renderTime: 0,
    dataFetchTime: 0,
    memoryUsage: 0,
    fps: 60
  });

  const measureRenderTime = useCallback((componentName: string) => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 16.67) { // 60FPS基準
        console.warn(`${componentName} レンダリング時間が長すぎます: ${renderTime.toFixed(2)}ms`);
      }
      
      setMetrics(prev => ({ ...prev, renderTime }));
    };
  }, []);

  const measureDataFetch = useCallback(async (fetchFunction: () => Promise<any>, label: string) => {
    const startTime = performance.now();
    
    try {
      const result = await fetchFunction();
      const fetchTime = performance.now() - startTime;
      
      setMetrics(prev => ({ ...prev, dataFetchTime: fetchTime }));
      
      if (fetchTime > 1000) {
        console.warn(`${label} データ取得時間が長すぎます: ${fetchTime.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      console.error(`${label} データ取得エラー:`, error);
      throw error;
    }
  }, []);

  // メモリ使用量の監視（ブラウザ環境でのみ有効）
  const monitorMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      
      setMetrics(prev => ({ ...prev, memoryUsage: usedMB }));
      
      if (usedMB > 100) { // 100MB以上で警告
        console.warn(`メモリ使用量が多すぎます: ${usedMB.toFixed(2)}MB`);
      }
    }
  }, []);

  React.useEffect(() => {
    const interval = setInterval(monitorMemoryUsage, 5000); // 5秒ごと
    return () => clearInterval(interval);
  }, [monitorMemoryUsage]);

  return {
    metrics,
    measureRenderTime,
    measureDataFetch,
    monitorMemoryUsage
  };
};

// 画像最適化コンポーネント
interface OptimizedImageProps {
  uri: string;
  width: number;
  height: number;
  placeholder?: string;
  quality?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  uri,
  width,
  height,
  placeholder = 'https://via.placeholder.com/100',
  quality = 80
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  // 画像URLの最適化
  const optimizedUri = useMemo(() => {
    if (!uri) return placeholder;
    
    // 画像サイズとクオリティの最適化パラメータを追加
    const separator = uri.includes('?') ? '&' : '?';
    return `${uri}${separator}w=${width}&h=${height}&q=${quality}&f=webp`;
  }, [uri, width, height, quality, placeholder]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setError(false);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    console.warn('画像読み込みエラー:', optimizedUri);
  }, [optimizedUri]);

  return (
    <Suspense fallback={<ActivityIndicator size="small" color={colors.primary.main} />}>
      <LazyImage
        source={{ uri: error ? placeholder : optimizedUri }}
        style={{ width, height, borderRadius: 8 }}
        onLoad={handleLoad}
        onError={handleError}
        placeholder={placeholder}
        resizeMode="cover"
      />
    </Suspense>
  );
});

OptimizedImage.displayName = 'OptimizedImage';