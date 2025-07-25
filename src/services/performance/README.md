# パフォーマンス最適化システム

Mamapaceアプリの包括的なパフォーマンス最適化システムです。レンダリング、リスト表示、メモリ管理、パフォーマンス監視を統合的に管理します。

## 主要機能

- **レンダリング最適化**: React.memo、メモ化、不要な再レンダリング防止
- **リスト最適化**: FlatListの仮想化、無限スクロール最適化
- **メモリ最適化**: 画像メモリ管理、LRUキャッシュ、ガベージコレクション
- **パフォーマンス監視**: リアルタイム監視、アラート、レポート生成

## セットアップ

### 1. システムの初期化

```typescript
import { initializePerformanceOptimization } from '@/services/performance';

// アプリ起動時に実行
const App = () => {
  useEffect(() => {
    const setupPerformance = async () => {
      const success = await initializePerformanceOptimization();
      if (success) {
        console.log('パフォーマンス最適化システムが有効になりました');
      }
    };
    
    setupPerformance();
  }, []);

  return (
    // アプリコンポーネント
  );
};
```

### 2. 個別機能の有効化/無効化

```typescript
import { configurePerformanceOptimization } from '@/services/performance';

// 特定の最適化のみを有効化
configurePerformanceOptimization({
  enableRendering: true,
  enableList: true,
  enableMemory: false,
  enableMonitoring: true
});
```

## 使用方法

### レンダリング最適化

#### HOCを使用したコンポーネント最適化

```typescript
import { withPerformanceOptimization } from '@/services/performance';

const MyComponent = ({ title, data }) => {
  return (
    <View>
      <Text>{title}</Text>
      {data.map(item => <Text key={item.id}>{item.name}</Text>)}
    </View>
  );
};

// 自動最適化を適用
export default withPerformanceOptimization(MyComponent);
```

#### カスタムフックを使用したメモ化

```typescript
import { useOptimizedMemo, useOptimizedCallback } from '@/services/performance';

const ExpensiveComponent = ({ data }) => {
  // 重い計算をメモ化
  const processedData = useOptimizedMemo(() => {
    return data.map(item => ({
      ...item,
      processedValue: expensiveCalculation(item.value)
    }));
  }, [data]);

  // イベントハンドラーをメモ化
  const handlePress = useOptimizedCallback((item) => {
    console.log('Pressed:', item);
  }, []);

  return (
    <FlatList
      data={processedData}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => handlePress(item)}>
          <Text>{item.processedValue}</Text>
        </TouchableOpacity>
      )}
    />
  );
};
```

### リスト最適化

#### 最適化されたFlatListの使用

```typescript
import { useOptimizedList } from '@/services/performance';

const PostList = ({ posts }) => {
  const { OptimizedList } = useOptimizedList({
    data: posts,
    renderItem: ({ item }) => <PostCard post={item} />,
    keyExtractor: (item) => item.id,
    estimatedItemSize: 150
  });

  return <OptimizedList />;
};
```

#### 無限スクロールの最適化

```typescript
import { useInfiniteScrollOptimization } from '@/services/performance';

const InfinitePostList = () => {
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    // 新しいデータを読み込み
    const newPosts = await fetchMorePosts();
    setPosts(prev => [...prev, ...newPosts]);
    setHasMore(newPosts.length > 0);
  };

  const {
    handleEndReached,
    handleViewableItemsChanged,
    isLoading
  } = useInfiniteScrollOptimization(posts, loadMore, hasMore);

  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => <PostCard post={item} />}
      onEndReached={handleEndReached}
      onViewableItemsChanged={handleViewableItemsChanged}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isLoading ? <ActivityIndicator /> : null}
    />
  );
};
```

### メモリ最適化

#### 画像の自動最適化

```typescript
import { withMemoryOptimization } from '@/services/performance';

// Image コンポーネントに自動最適化を適用
const OptimizedImage = withMemoryOptimization(Image);

const ProfileImage = ({ imageUri }) => {
  return (
    <OptimizedImage 
      source={{ uri: imageUri }}
      style={{ width: 100, height: 100 }}
    />
  );
};
```

#### メモリ使用量の監視

```typescript
import { useMemoryOptimization } from '@/services/performance';

const MemoryStatus = () => {
  const { getStats, clearCache } = useMemoryOptimization();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View>
      <Text>メモリ使用量: {stats?.current.usedMemory}MB</Text>
      <Text>キャッシュサイズ: {stats?.cacheStats.size}件</Text>
      <Button title="キャッシュクリア" onPress={clearCache} />
    </View>
  );
};
```

### パフォーマンス監視

#### リアルタイム監視の利用

```typescript
import { usePerformanceMonitoring } from '@/services/performance';

const PerformanceDashboard = () => {
  const { 
    isActive, 
    startMonitoring, 
    stopMonitoring, 
    getStats 
  } = usePerformanceMonitoring();
  
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setStats(getStats());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <View>
      <Text>監視状態: {isActive ? '有効' : '無効'}</Text>
      {stats && (
        <>
          <Text>平均FPS: {stats.averagePerformance.fps}fps</Text>
          <Text>メモリ使用量: {stats.averagePerformance.memory}MB</Text>
          <Text>アクティブアラート: {stats.activeAlerts}件</Text>
        </>
      )}
      <Button 
        title={isActive ? "監視停止" : "監視開始"} 
        onPress={isActive ? stopMonitoring : startMonitoring} 
      />
    </View>
  );
};
```

#### カスタムメトリクスの記録

```typescript
import { performanceMonitor } from '@/services/performance';

const CustomComponent = () => {
  const handleAction = async () => {
    const startTime = Date.now();
    
    // 何らかの処理
    await someExpensiveOperation();
    
    const duration = Date.now() - startTime;
    
    // カスタムメトリクスを記録
    performanceMonitor.recordMetric('custom_operation_time', duration, {
      operation: 'data_processing',
      screen: 'home'
    });
  };

  return (
    <Button title="実行" onPress={handleAction} />
  );
};
```

## パフォーマンスレポートの取得

```typescript
import { performanceManager } from '@/services/performance';

const getPerformanceReport = () => {
  const report = performanceManager.getPerformanceReport();
  
  console.log('パフォーマンスレポート:', {
    timestamp: report.timestamp,
    fps: report.fps,
    memoryUsage: report.memoryUsage,
    issues: report.issues.length,
    recommendations: report.recommendations
  });
  
  return report;
};
```

## 設定のカスタマイズ

```typescript
import { performanceManager } from '@/services/performance';

// パフォーマンス閾値の調整
performanceManager.configureThresholds({
  fpsThreshold: 50,        // FPS閾値
  memoryThreshold: 100,    // メモリ使用量閾値(MB)
  renderTimeThreshold: 20, // レンダリング時間閾値(ms)
  batteryOptimizationEnabled: true
});
```

## トラブルシューティング

### よくある問題

1. **FPSが低下する**
   - コンポーネントのメモ化を確認
   - 不要な再レンダリングがないかチェック
   - アニメーションの複雑さを軽減

2. **メモリ使用量が高い**
   - 画像キャッシュをクリア
   - メモリリークの可能性を調査
   - 大きな画像の最適化を確認

3. **スクロールが重い**
   - FlatListの設定を確認
   - getItemLayoutの実装をチェック
   - リストアイテムの複雑さを軽減

### デバッグ情報の確認

```typescript
import { 
  renderingOptimizer, 
  listOptimizer, 
  memoryOptimizer 
} from '@/services/performance';

// レンダリング統計
console.log('レンダリング統計:', renderingOptimizer.getRenderingStats());

// リスト性能統計
console.log('リスト性能統計:', listOptimizer.getListPerformanceStats());

// メモリ統計
console.log('メモリ統計:', memoryOptimizer.getMemoryStats());
```

## 注意事項

- パフォーマンス最適化システムは開発版とプロダクション版で異なる動作をする場合があります
- デバイスの性能に応じて自動的に最適化レベルが調整されます
- メモリ監視は定期的に実行されるため、バッテリー消費に影響する可能性があります
- 本番環境では適切な閾値設定を行ってください