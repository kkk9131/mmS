
// 1. FlatListの最適化
import { FlatList, memo } from 'react-native';

// メモ化されたリストアイテムコンポーネント
const PostItem = memo(({ item }) => {
  return (
    <View style={styles.postItem}>
      <Text>{item.content}</Text>
    </View>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数で再レンダリング制御
  return prevProps.item.id === nextProps.item.id;
});

// 最適化されたFlatList
export const OptimizedPostList = ({ posts }) => {
  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => <PostItem item={item} />}
      keyExtractor={(item) => item.id}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
      initialNumToRender={10}
      getItemLayout={(data, index) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
    />
  );
};

// 2. 画像の遅延読み込み
import { Image } from 'expo-image';

export const OptimizedImage = ({ source, ...props }) => {
  return (
    <Image
      source={source}
      placeholder={blurhash}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      {...props}
    />
  );
};

// 3. useMemoとuseCallbackの適切な使用
export const OptimizedComponent = () => {
  const expensiveCalculation = useMemo(() => {
    return posts.filter(post => post.is_anonymous === false);
  }, [posts]);

  const handlePress = useCallback((postId) => {
    navigation.navigate('PostDetail', { postId });
  }, [navigation]);

  return <View>{/* ... */}</View>;
};
