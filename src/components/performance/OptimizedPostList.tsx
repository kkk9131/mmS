import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptimizedList, useInfiniteScrollOptimization } from '../../services/performance';
import OptimizedPostCard from './OptimizedPostCard';

interface Post {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
  comments: number;
  tags: string[];
  isLiked: boolean;
  aiResponse?: string;
  image_url?: string;
  images?: string[];
}

interface OptimizedPostListProps {
  posts: Post[];
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onMore?: (postId: string) => void;
  onPostPress?: (post: Post) => void;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  error?: string | null;
  estimatedItemHeight?: number;
}

const OptimizedPostList: React.FC<OptimizedPostListProps> = React.memo(({
  posts,
  onLike,
  onComment,
  onMore,
  onPostPress,
  onRefresh,
  onLoadMore,
  loading = false,
  refreshing = false,
  hasMore = false,
  error = null,
  estimatedItemHeight = 300
}) => {
  const { theme } = useTheme();
  const listRef = useRef<FlatList>(null);

  // 最適化されたFlatListコンポーネントの作成
  const { OptimizedList } = useOptimizedList({
    data: posts,
    renderItem: ({ item }) => (
      <OptimizedPostCard
        key={item.id}
        post={item}
        onLike={onLike}
        onComment={onComment}
        onMore={onMore}
      />
    ),
    keyExtractor: (item) => item.id,
    estimatedItemSize: estimatedItemHeight,
    windowSize: 10,
    maxToRenderPerBatch: 5,
    initialNumToRender: 8,
    removeClippedSubviews: true,
    getItemLayout: (data, index) => ({
      length: estimatedItemHeight,
      offset: estimatedItemHeight * index,
      index
    })
  });

  // 無限スクロール最適化
  const {
    handleEndReached,
    handleViewableItemsChanged,
    loadingState
  } = useInfiniteScrollOptimization(
    posts,
    onLoadMore || (() => Promise.resolve()),
    hasMore
  );

  // リフレッシュ制御のメモ化
  const refreshControl = useMemo(() => {
    if (!onRefresh) return undefined;

    return (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    );
  }, [refreshing, onRefresh, theme.colors.primary, theme.colors.surface]);

  // フッターコンポーネントのメモ化
  const footerComponent = useMemo(() => {
    if (!hasMore || posts.length === 0) return null;

    if (loading) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.footerText, { color: theme.colors.text.secondary }]}>
            読み込み中...
          </Text>
        </View>
      );
    }

    return null;
  }, [hasMore, posts.length, loading, theme.colors.primary, theme.colors.text.secondary]);

  // エラー表示のメモ化
  const errorComponent = useMemo(() => {
    if (!error || posts.length > 0) return null;

    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      </View>
    );
  }, [error, posts.length, theme.colors.error]);

  // 空状態の表示
  const emptyComponent = useMemo(() => {
    if (loading || error || posts.length > 0) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
          まだ投稿がありません
        </Text>
        <Text style={[styles.emptySubText, { color: theme.colors.text.disabled }]}>
          最初の投稿をしてみませんか？
        </Text>
      </View>
    );
  }, [loading, error, posts.length, theme.colors.text.secondary, theme.colors.text.disabled]);

  // 初期読み込み中の表示
  const loadingComponent = useMemo(() => {
    if (!loading || posts.length > 0) return null;

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          投稿を読み込み中...
        </Text>
      </View>
    );
  }, [loading, posts.length, theme.colors.primary, theme.colors.text.secondary]);

  // パフォーマンス監視用のコールバック
  const onScrollBeginDrag = useCallback(() => {
    // スクロール開始時のパフォーマンス記録
    console.log('PostList: スクロール開始');
  }, []);

  const onScrollEndDrag = useCallback(() => {
    // スクロール終了時のパフォーマンス記録
    console.log('PostList: スクロール終了');
  }, []);

  // コンテンツサイズ変更の監視
  const onContentSizeChange = useCallback((width: number, height: number) => {
    console.log(`PostList: コンテンツサイズ変更 ${width}x${height}`);
  }, []);

  // メイン表示の決定
  if (loadingComponent) return loadingComponent;
  if (errorComponent) return errorComponent;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        ref={listRef}
        data={posts}
        renderItem={({ item }) => (
          <OptimizedPostCard post={item} onPress={() => onPostPress?.(item)} />
        )}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={posts.length === 0 ? styles.emptyContentContainer : undefined}
        
        // 無限スクロール設定
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={handleViewableItemsChanged}
        
        // パフォーマンス最適化設定
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        scrollEventThrottle={16}
        
        // UI設定
        refreshControl={refreshControl}
        ListFooterComponent={footerComponent}
        ListEmptyComponent={emptyComponent}
        
        // パフォーマンス監視
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onContentSizeChange={onContentSizeChange}
        
        // アクセシビリティ
        accessible={true}
        accessibilityLabel="投稿一覧"
        accessibilityHint="上下にスワイプして投稿を閲覧できます"
        
        // Android固有の最適化
        persistentScrollbar={false}
        disableVirtualization={false}
        
        // その他の設定
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoading: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
  },
});

OptimizedPostList.displayName = 'OptimizedPostList';

export default OptimizedPostList;