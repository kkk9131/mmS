import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { LazyImage } from '../image/LazyImage';
import { ImageViewer } from '../image/ImageViewer';
import { withPerformanceOptimization, useRenderTimeTracker } from '../../services/performance';

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

interface OptimizedPostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onMore?: (postId: string) => void;
  onPress?: () => void;
}

const OptimizedPostCard: React.FC<OptimizedPostCardProps> = React.memo(({ 
  post, 
  onLike, 
  onComment, 
  onMore,
  onPress 
}) => {
  const { theme } = useTheme();
  
  // レンダリング時間追跡
  useRenderTimeTracker('OptimizedPostCard');
  
  // 状態のメモ化
  const [showImageViewer, setShowImageViewer] = React.useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  
  // コールバックのメモ化
  const handleLike = useCallback(() => {
    onLike?.(post.id);
  }, [onLike, post.id]);
  
  const handleComment = useCallback(() => {
    onComment?.(post.id);
  }, [onComment, post.id]);
  
  const handleMore = useCallback(() => {
    onMore?.(post.id);
  }, [onMore, post.id]);
  
  const handleLongPress = useCallback(() => {
    Alert.alert(
      '投稿の操作',
      '実行したい操作を選択してください',
      [
        { text: 'ユーザーをブロック', onPress: () => console.log('Block user'), style: 'destructive' },
        { text: '投稿を報告', onPress: () => console.log('Report post'), style: 'destructive' },
        { text: 'キャンセル', style: 'cancel' }
      ]
    );
  }, []);

  const handleImagePress = useCallback((index: number = 0) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  }, []);

  // 重い計算のメモ化
  const imageList = useMemo((): string[] => {
    if (post.images && post.images.length > 0) {
      return post.images;
    }
    if (post.image_url) {
      try {
        if (post.image_url.startsWith('[')) {
          return JSON.parse(post.image_url);
        } else {
          return [post.image_url];
        }
      } catch (error) {
        console.warn('画像URL解析エラー:', error);
        return [post.image_url];
      }
    }
    return [];
  }, [post.images, post.image_url]);

  // フォーマット済みタイムスタンプのメモ化
  const formattedTimestamp = useMemo(() => {
    return new Date(post.timestamp).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [post.timestamp]);

  // スタイルのメモ化
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      margin: 10,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    authorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    content: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 24,
      marginBottom: 12,
    },
    tag: {
      fontSize: 14,
      color: theme.colors.primary,
      marginRight: 8,
      marginBottom: 4,
    },
    aiResponseContainer: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    aiResponseLabel: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
      marginBottom: 4,
    },
    aiResponseText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
    },
    imageContainer: {
      marginVertical: 12,
    },
    singleImage: {
      width: '100%',
      height: 200,
      borderRadius: 8,
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    gridImage: {
      width: '48%',
      height: 120,
      borderRadius: 8,
    },
    imageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    overlayText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    likedButton: {
      backgroundColor: `${theme.colors.primary}20`,
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6,
    },
    likedText: {
      color: theme.colors.primary,
    },
  }), [theme]);

  // 画像レンダリングの最適化
  const renderImages = useMemo(() => {
    if (imageList.length === 0) return null;

    return (
      <View style={dynamicStyles.imageContainer}>
        {imageList.length === 1 ? (
          <TouchableOpacity onPress={() => handleImagePress(0)}>
            <LazyImage
              uri={imageList[0]}
              style={dynamicStyles.singleImage}
              resizeMode="cover"
              borderRadius={8}
              accessibilityLabel="投稿の画像"
              priority="normal"
              onPress={() => handleImagePress(0)}
            />
          </TouchableOpacity>
        ) : (
          <View style={dynamicStyles.imageGrid}>
            {imageList.slice(0, 4).map((imageUri, index) => (
              <View key={`${post.id}_image_${index}`} style={{ position: 'relative' }}>
                <TouchableOpacity onPress={() => handleImagePress(index)}>
                  <LazyImage
                    uri={imageUri}
                    style={dynamicStyles.gridImage}
                    resizeMode="cover"
                    borderRadius={8}
                    accessibilityLabel={`投稿の画像 ${index + 1}`}
                    priority="normal"
                    onPress={() => handleImagePress(index)}
                  />
                </TouchableOpacity>
                {index === 3 && imageList.length > 4 && (
                  <TouchableOpacity 
                    style={dynamicStyles.imageOverlay}
                    onPress={() => handleImagePress(index)}
                  >
                    <Text style={dynamicStyles.overlayText}>
                      +{imageList.length - 4}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }, [imageList, dynamicStyles, handleImagePress, post.id]);

  // タグレンダリングの最適化
  const renderTags = useMemo(() => {
    if (!post.tags || post.tags.length === 0) return null;

    return (
      <View style={styles.tagsContainer}>
        {post.tags.map((tag, index) => (
          <Text key={`${post.id}_tag_${index}`} style={dynamicStyles.tag}>
            #{tag}
          </Text>
        ))}
      </View>
    );
  }, [post.tags, post.id, dynamicStyles.tag]);

  // AIレスポンスレンダリングの最適化
  const renderAiResponse = useMemo(() => {
    if (!post.aiResponse) return null;

    return (
      <View style={dynamicStyles.aiResponseContainer}>
        <Text style={dynamicStyles.aiResponseLabel}>ママの味方</Text>
        <Text style={dynamicStyles.aiResponseText}>{post.aiResponse}</Text>
      </View>
    );
  }, [post.aiResponse, dynamicStyles]);

  return (
    <TouchableOpacity
      style={dynamicStyles.container}
      onLongPress={handleLongPress}
      delayLongPress={800}
      activeOpacity={0.95}
    >
      <View style={styles.header}>
        <Text style={dynamicStyles.authorName}>{post.author}</Text>
        <Text style={dynamicStyles.timestamp}>{formattedTimestamp}</Text>
      </View>

      <Text style={dynamicStyles.content}>{post.content}</Text>

      {renderImages}
      {renderTags}
      {renderAiResponse}

      <View style={dynamicStyles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, post.isLiked && dynamicStyles.likedButton]}
          onPress={handleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Heart 
            size={20} 
            color={post.isLiked ? theme.colors.primary : theme.colors.text.secondary} 
            fill={post.isLiked ? theme.colors.primary : 'none'} 
          />
          <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
            {post.likes} 共感
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleComment}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MessageCircle size={20} color={theme.colors.text.secondary} />
          <Text style={dynamicStyles.actionText}>{post.comments} コメント</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.moreButton} 
          onPress={handleMore}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreHorizontal size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {imageList.length > 0 && (
        <ImageViewer
          visible={showImageViewer}
          imageUri={imageList[selectedImageIndex]}
          onClose={() => setShowImageViewer(false)}
          title={`投稿画像 ${selectedImageIndex + 1}/${imageList.length}`}
          altText={`${post.author}の投稿画像`}
          enableDownload={true}
          enableShare={true}
        />
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数でより詳細な変更検出
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.post.likes === nextProps.post.likes &&
    prevProps.post.comments === nextProps.post.comments &&
    prevProps.post.isLiked === nextProps.post.isLiked &&
    prevProps.post.aiResponse === nextProps.post.aiResponse &&
    JSON.stringify(prevProps.post.images) === JSON.stringify(nextProps.post.images) &&
    prevProps.post.image_url === nextProps.post.image_url &&
    JSON.stringify(prevProps.post.tags) === JSON.stringify(nextProps.post.tags)
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  moreButton: {
    marginLeft: 'auto',
    padding: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

OptimizedPostCard.displayName = 'OptimizedPostCard';

export default OptimizedPostCard;