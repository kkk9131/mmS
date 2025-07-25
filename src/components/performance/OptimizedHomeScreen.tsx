import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Menu, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { withPerformanceOptimization, useRenderTimeTracker } from '../../services/performance';
import OptimizedPostList from './OptimizedPostList';
import Sidebar from '../Sidebar';

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  aiResponse?: string;
  author: string;
  timestamp: string;
  likes: number;
  comments: number;
  tags: string[];
  image_url?: string;
  images?: string[];
}

interface OptimizedHomeScreenProps {
  posts: Post[];
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
}

const OptimizedHomeScreen: React.FC<OptimizedHomeScreenProps> = React.memo(({
  posts,
  loading = false,
  refreshing = false,
  hasMore = false,
  error = null,
  onRefresh,
  onLoadMore
}) => {
  const { theme } = useTheme();
  const { handPreference, getFreeHandSide } = useHandPreference();
  
  // レンダリング時間追跡
  useRenderTimeTracker('OptimizedHomeScreen');
  
  // UI State
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [localPosts, setLocalPosts] = useState(posts);

  // 空いた手の側を計算（利き手の逆側）
  const freeHandSide = getFreeHandSide();

  // 投稿データの同期
  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // 最適化されたコールバック関数
  const handleLike = useCallback(async (postId: string) => {
    // 楽観的更新でUI即座に反映
    setLocalPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? {
              ...post,
              isLiked: !post.isLiked,
              likesCount: post.likesCount + (post.isLiked ? -1 : 1),
              likes: post.likes + (post.isLiked ? -1 : 1) // 互換性のため
            }
          : post
      )
    );

    // TODO: 実際のAPI呼び出し
    try {
      // await likesApi.toggleLike({ postId });
      console.log(`いいね処理: ${postId}`);
    } catch (error) {
      // エラー時はロールバック
      setLocalPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? {
                ...post,
                isLiked: !post.isLiked,
                likesCount: post.likesCount + (post.isLiked ? -1 : 1),
                likes: post.likes + (post.isLiked ? -1 : 1)
              }
            : post
        )
      );
      console.error('いいねエラー:', error);
    }
  }, []);

  const handleComment = useCallback((postId: string) => {
    const post = localPosts.find(p => p.id === postId);
    if (post) {
      setSelectedPost(post);
      setCommentModalVisible(true);
    }
  }, [localPosts]);

  const handleMore = useCallback((postId: string) => {
    console.log('More options for post:', postId);
    // TODO: その他のオプション処理
  }, []);

  const handleCommentSubmit = useCallback(async () => {
    if (!selectedPost || commentText.trim().length === 0) return;

    try {
      // TODO: 実際のコメント投稿処理
      console.log('コメント投稿:', {
        postId: selectedPost.id,
        content: commentText.trim()
      });
      
      setCommentText('');
      setCommentModalVisible(false);
    } catch (error) {
      console.error('コメント投稿エラー:', error);
    }
  }, [selectedPost, commentText]);

  const handleCreatePost = useCallback(() => {
    // パフォーマンス追跡のためのタイムスタンプ
    const navigationStart = performance.now();
    
    router.push('/post');
    
    const navigationEnd = performance.now();
    console.log(`投稿画面遷移時間: ${navigationEnd - navigationStart}ms`);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    setSidebarVisible(prev => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarVisible(false);
  }, []);

  const handleCommentModalClose = useCallback(() => {
    setCommentModalVisible(false);
    setSelectedPost(null);
    setCommentText('');
  }, []);

  // スタイルのメモ化
  const dynamicStyles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      position: 'relative',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginTop: 4,
    },
    menuButton: {
      position: 'absolute',
      top: 20,
      zIndex: 1,
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    menuButtonLeft: {
      left: 20,
    },
    menuButtonRight: {
      right: 20,
    },
    createPostButton: {
      position: 'absolute',
      bottom: 120,
      zIndex: 9999,
      backgroundColor: theme.colors.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    createPostButtonLeft: {
      left: 20,
    },
    createPostButtonRight: {
      right: 20,
    },
    commentModalContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: '80%',
      maxHeight: '80%',
    },
    commentModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    commentModalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    commentModalCloseText: {
      fontSize: 24,
      color: theme.colors.text.secondary,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    commentInput: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.colors.text.primary,
      maxHeight: 80,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    commentSubmitButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minHeight: 36,
      justifyContent: 'center',
    },
    commentSubmitButtonDisabled: {
      backgroundColor: theme.colors.text.disabled,
    },
    commentSubmitButtonText: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '600',
    },
  }), [theme, freeHandSide]);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          style={[
            dynamicStyles.menuButton,
            freeHandSide === 'left' ? dynamicStyles.menuButtonLeft : dynamicStyles.menuButtonRight
          ]}
          onPress={handleSidebarToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Menu size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <Text style={dynamicStyles.headerTitle}>Mamapace</Text>
        <Text style={dynamicStyles.headerSubtitle}>ママの共感コミュニティ</Text>
      </View>

      <OptimizedPostList
        posts={localPosts}
        onLike={handleLike}
        onComment={handleComment}
        onMore={handleMore}
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        loading={loading}
        refreshing={refreshing}
        hasMore={hasMore}
        error={error}
        estimatedItemHeight={320}
      />

      <TouchableOpacity
        style={[
          dynamicStyles.createPostButton,
          freeHandSide === 'left' ? dynamicStyles.createPostButtonLeft : dynamicStyles.createPostButtonRight
        ]}
        onPress={handleCreatePost}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>

      <Sidebar
        visible={sidebarVisible}
        onClose={handleSidebarClose}
      />

      {/* コメントモーダル */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={commentModalVisible}
        onRequestClose={handleCommentModalClose}
      >
        <View style={styles.commentModalOverlay}>
          <KeyboardAvoidingView
            style={dynamicStyles.commentModalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={dynamicStyles.commentModalHeader}>
              <Text style={dynamicStyles.commentModalTitle}>コメント</Text>
              <TouchableOpacity
                onPress={handleCommentModalClose}
                style={styles.commentModalClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={dynamicStyles.commentModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <>
                <View style={styles.originalPost}>
                  <Text style={styles.originalPostAuthor}>{selectedPost.authorName}</Text>
                  <Text style={styles.originalPostContent}>{selectedPost.content}</Text>
                </View>

                <View style={dynamicStyles.commentInputContainer}>
                  <TextInput
                    style={dynamicStyles.commentInput}
                    placeholder="コメントを入力..."
                    placeholderTextColor={theme.colors.text.disabled}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={200}
                  />
                  <TouchableOpacity
                    style={[
                      dynamicStyles.commentSubmitButton,
                      commentText.trim().length === 0 && dynamicStyles.commentSubmitButtonDisabled
                    ]}
                    onPress={handleCommentSubmit}
                    disabled={commentText.trim().length === 0}
                  >
                    <Text style={dynamicStyles.commentSubmitButtonText}>送信</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentModalClose: {
    padding: 8,
    borderRadius: 8,
  },
  originalPost: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  originalPostAuthor: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  originalPostContent: {
    fontSize: 16,
    lineHeight: 22,
  },
});

OptimizedHomeScreen.displayName = 'OptimizedHomeScreen';

export default withPerformanceOptimization(OptimizedHomeScreen);