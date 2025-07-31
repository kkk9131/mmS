import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal, Menu, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Sidebar from '../../components/Sidebar';
import PostCard from '../../components/PostCard';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { postsApi } from '../../store/api/postsApi';
import { FeatureFlagsManager } from '../../services/featureFlags';
import { PostsService } from '../../services/PostsService';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { useTheme } from '../../contexts/ThemeContext';

interface PostWithLocalState {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isCommented: boolean;
  images?: string[]; // 複数画像フィールド
  image_url?: string; // 旧画像フィールド（フォールバック用）
  aiResponse?: string;
}

// モックデータは削除し、Supabaseデータのみを使用

export default function HomeScreen() {
  const { getFreeHandSide } = useHandPreference();
  const { theme } = useTheme();
  const featureFlags = FeatureFlagsManager.getInstance();
  const postsService = PostsService.getInstance();
  
  // UI State
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostWithLocalState | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // Data State
  const [posts, setPosts] = useState<PostWithLocalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Image loading states
  const [imageLoading, setImageLoading] = useState<{[key: string]: boolean}>({});
  const [imageError, setImageError] = useState<{[key: string]: boolean}>({});
  
  // RTK Query hooks - use when available
  const {
    data: rtkPosts,
    error: rtkError,
    isLoading: rtkLoading,
    refetch: rtkRefetch
  } = postsApi.useGetPostsQuery(
    { limit: 20, sortBy: 'created_at', order: 'desc' },
    { 
      skip: !featureFlags.isSupabaseEnabled() || !featureFlags.isReduxEnabled(),
      refetchOnMountOrArgChange: true
    }
  );

  // 空いた手の側を計算（利き手の逆側）
  const freeHandSide = getFreeHandSide();

  // Load posts on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  // Reload posts when screen comes into focus (after posting)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 ホーム画面にフォーカス - データ再読み込み');
      
      // RTK Queryを使用している場合はrefetchを呼び出し
      if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
        if (rtkRefetch) {
          rtkRefetch();
        }
      } else {
        loadPosts();
      }
    }, [])
  );

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Loading posts with configuration:', {
        isSupabaseEnabled: featureFlags.isSupabaseEnabled(),
        isReduxEnabled: featureFlags.isReduxEnabled(),
        dataSource: postsService.getDataSourceInfo()
      });

      if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
        // RTK Query が利用可能な場合は、rtkPosts を使用
        console.log('📡 Using RTK Query for posts');
        return;
      } else {
        // PostsService を直接使用（Supabaseを強制的に有効化）
        console.log('🔧 Using PostsService directly - forcing Supabase');
        
        // 一時的にSupabaseを有効化
        const originalSupabaseFlag = featureFlags.getFlag('USE_SUPABASE');
        featureFlags.setFlag('USE_SUPABASE', true);
        
        try {
          const response = await postsService.getPosts({
            page: 1,
            limit: 20,
            sortBy: 'createdAt',
            order: 'desc'
          });
          
          setPosts(response.posts.map(post => ({
            ...post,
            isLiked: post.isLiked || false
          })));
        } finally {
          // フラグを元に戻す
          featureFlags.setFlag('USE_SUPABASE', originalSupabaseFlag);
        }
      }
    } catch (err) {
      console.error('投稿の読み込みに失敗:', err);
      setError('投稿の読み込みに失敗しました');
      // エラー時は空の配列を設定（モックデータは使用しない）
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Use RTK Query data when available, otherwise use local state
  const displayPosts: PostWithLocalState[] = (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled() && rtkPosts) 
    ? rtkPosts.map(post => {
        const mappedPost = { 
          id: post.id,
          authorId: post.user_id || '',
          authorName: (post.users?.nickname || 'Unknown').replace(/_修正$/, ''),
          content: post.content || '',
          createdAt: post.created_at || new Date().toISOString(),
          likesCount: post.likes_count || 0,
          commentsCount: post.comments_count || 0,
          isLiked: post.user_liked || false,
          isCommented: post.user_commented || false,
          images: post.images || undefined, // 複数画像フィールド
          image_url: post.image_url || undefined, // 旧画像フィールド（フォールバック用）
          aiResponse: undefined
        };
        
        console.log('🔍 RTK投稿データ変換:', { 
          元データ: {
            id: post.id,
            images: post.images,
            image_url: post.image_url
          },
          変換後: {
            id: mappedPost.id,
            images: mappedPost.images,
            image_url: mappedPost.image_url
          }
        });
        
        return mappedPost;
      })
    : posts.map(post => {
        console.log('🔍 PostsService投稿データ:', { 
          id: post.id, 
          authorId: post.authorId, 
          authorName: post.authorName,
          images: post.images,
          image_url: post.image_url
        });
        return {
          ...post,
          image_url: post.image_url || undefined
        };
      });
  
  const isDataLoading = (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) 
    ? rtkLoading 
    : loading;
    
  const dataError = (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) 
    ? rtkError 
    : error;

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 手動リフレッシュ開始');
      
      if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
        console.log('📡 RTK Query リフレッシュ');
        if (rtkRefetch) {
          await rtkRefetch();
        }
      } else {
        console.log('🔧 PostsService リフレッシュ');
        await loadPosts();
      }
      
      console.log('✅ リフレッシュ完了');
    } catch (err) {
      console.error('❌ リフレッシュに失敗:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // RTK Query mutations
  const [toggleLike] = postsApi.useToggleLikeMutation();
  const currentUserId = useAppSelector(state => state.auth?.profile?.id || state.auth?.user?.id);

  const handleLike = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    try {
      if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
        // RTK Query mutation を使用
        await toggleLike({ postId, userId: currentUserId }).unwrap();
        console.log('✅ いいね状態を更新しました:', postId);
      } else {
        // PostsService を直接使用
        const post = displayPosts.find(p => p.id === postId);
        if (post?.isLiked) {
          await postsService.unlikePost(postId);
        } else {
          await postsService.likePost(postId);
        }
        
        // ローカル状態を更新
        setPosts(prevPosts => 
          prevPosts.map(p => 
            p.id === postId 
              ? {
                  ...p,
                  isLiked: !p.isLiked,
                  likesCount: p.likesCount + (p.isLiked ? -1 : 1)
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error('いいね処理に失敗:', err);
      Alert.alert('エラー', 'いいね処理に失敗しました');
    }
  };

  const handleCommentPress = (post: PostWithLocalState) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    // Comments will be loaded automatically via useGetCommentsQuery
  };

  // RTK Query hooks for comments
  const [createComment] = postsApi.useCreateCommentMutation();
  const {
    data: comments = [],
    isLoading: commentsLoading,
    refetch: refetchComments
  } = postsApi.useGetCommentsQuery(selectedPost?.id || '', {
    skip: !selectedPost?.id || !commentModalVisible
  });

  const handleCommentSubmit = async () => {
    if (!selectedPost || commentText.trim().length === 0 || !currentUserId) {
      if (!currentUserId) {
        Alert.alert('エラー', 'ログインが必要です');
      }
      return;
    }

    try {
      if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
        // RTK Query mutation を使用
        const result = await createComment({
          post_id: selectedPost.id,
          user_id: currentUserId,
          content: commentText.trim(),
          is_anonymous: false
        }).unwrap();
        
        console.log('✅ コメントを投稿しました:', result);
        
        // コメントリストを再取得
        await refetchComments();
        
        setCommentText('');
        // モーダルは開いたままにする
      } else {
        // PostsService を直接使用
        await postsService.createComment(selectedPost.id, {
          content: commentText.trim()
        });
        
        // ローカル状態を更新
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === selectedPost.id 
              ? { ...post, commentsCount: post.commentsCount + 1, isCommented: true }
              : post
          )
        );
        
        setCommentText('');
      }
    } catch (err) {
      console.error('コメント投稿に失敗:', err);
      Alert.alert('エラー', 'コメントの投稿に失敗しました');
    }
  };

  const handleLongPress = (postId: string) => {
    Alert.alert(
      '投稿の操作',
      '実行したい操作を選択してください',
      [
        { text: 'ユーザーをブロック', onPress: () => console.log('Block user'), style: 'destructive' },
        { text: '投稿を報告', onPress: () => console.log('Report post'), style: 'destructive' },
        { text: 'キャンセル', style: 'cancel' }
      ]
    );
  };

  const handleCreatePost = () => {
    router.push('/post');
  };

  // Image handling functions
  const handleImageLoadStart = (uri: string) => {
    setImageLoading(prev => ({...prev, [uri]: true}));
    setImageError(prev => ({...prev, [uri]: false}));
    console.log('🔄 画像読み込み開始:', uri);
  };

  const handleImageLoad = (uri: string) => {
    setImageLoading(prev => ({...prev, [uri]: false}));
    setImageError(prev => ({...prev, [uri]: false}));
    console.log('✅ 画像読み込み成功:', uri);
  };

  const handleImageError = (uri: string, error: any) => {
    setImageLoading(prev => ({...prev, [uri]: false}));
    setImageError(prev => ({...prev, [uri]: true}));
    console.error('❌ 画像読み込みエラー:', {
      uri: uri,
      error: error,
      nativeEvent: error.nativeEvent,
      message: error.message,
      url_valid: uri && uri.length > 0,
      starts_with_https: uri && uri.startsWith('https://')
    });
  };

  // 勘的スタイル
  const dynamicStyles = StyleSheet.create({
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
    postContainer: {
      backgroundColor: theme.colors.surface,
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
    postContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 24,
      marginBottom: 12,
    },
    aiResponseContainer: {
      backgroundColor: theme.colors.card,
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
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.text.disabled,
      marginLeft: 6,
    },
    likedText: {
      color: theme.colors.primary,
    },
    commentedText: {
      color: theme.colors.primary,
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
      color: theme.colors.text.disabled,
    },
    originalPost: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    originalPostAuthor: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 8,
    },
    originalPostContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 22,
    },
    commentItem: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      marginBottom: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    commentTimestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    commentContent: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
      marginBottom: 8,
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
    loadingText: {
      color: theme.colors.text.secondary,
      marginTop: 10,
      fontSize: 16,
    },
    noCommentsText: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      textAlign: 'center',
    },
  });

  const renderPost = (post: PostWithLocalState) => {
    // 画像データのデバッグログ
    console.log('🎨 ホーム画面投稿レンダリング:', {
      id: post.id,
      imagesArray: post.images,
      imagesLength: post.images?.length,
      imageUrl: post.image_url,
      authorName: post.authorName
    });

    // PostWithLocalStateからPost型に変換
    const postData: Post = {
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      authorName: post.authorName,
      authorAvatar: undefined,
      createdAt: post.createdAt,
      updatedAt: post.createdAt,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      isLiked: post.isLiked,
      isCommented: post.isCommented,
      images: post.images && post.images.length > 0 ? post.images : (post.image_url ? [post.image_url] : undefined)
    };

    console.log('📋 PostCardに渡すデータ:', {
      id: postData.id,
      images: postData.images,
      imagesCount: postData.images?.length
    });

    return (
      <PostCard
        post={postData}
        onLike={handleLike}
        onComment={handleCommentPress}
        onMore={handleLongPress}
      />
    );
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          style={[
            styles.menuButton,
            freeHandSide === 'left' ? styles.menuButtonLeft : styles.menuButtonRight
          ]}
          onPress={() => setSidebarVisible(true)}
        >
          <Menu size={24} color={theme.colors.primary} />
        </TouchableOpacity>



        <Text style={dynamicStyles.headerSubtitle}>ママの共感コミュニティ</Text>
      </View>

      <View style={styles.headerContent}>
        <Text style={dynamicStyles.headerTitle}>Mamapace</Text>
        {__DEV__ && (
          <Text style={[styles.debugInfo, { color: theme.colors.primary }]}>
            {featureFlags.isSupabaseEnabled() ? '🟢 Supabase' : '🔴 Mock'} | 
            {featureFlags.isReduxEnabled() ? ' RTK' : ' Direct'} | 
            {displayPosts.length}件 | 
            {(featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled() && rtkPosts) ? 'RTK Data' : 'PostsService Data'}
          </Text>
        )}
      </View>

      {isDataLoading && displayPosts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={dynamicStyles.loadingText}>読み込み中...</Text>
        </View>
      ) : dataError && displayPosts.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {typeof dataError === 'string' ? dataError : '投稿の読み込みに失敗しました'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayPosts}
          renderItem={({ item }) => renderPost(item)}
          keyExtractor={(item) => item.id}
          style={styles.timeline}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          onEndReachedThreshold={0.1}
        />
      )}

      <TouchableOpacity
        style={[
          styles.createPostButton,
          freeHandSide === 'left' ? styles.createPostButtonLeft : styles.createPostButtonRight
        ]}
        onPress={handleCreatePost}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>

      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />

      {/* コメントモーダル */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={commentModalVisible}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.commentModalOverlay}>
          <KeyboardAvoidingView
            style={dynamicStyles.commentModalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={dynamicStyles.commentModalHeader}>
              <Text style={dynamicStyles.commentModalTitle}>コメント</Text>
              <TouchableOpacity
                onPress={() => setCommentModalVisible(false)}
                style={styles.commentModalClose}
              >
                <Text style={dynamicStyles.commentModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <>
                <View style={dynamicStyles.originalPost}>
                  <Text style={dynamicStyles.originalPostAuthor}>{selectedPost.authorName}</Text>
                  <Text style={dynamicStyles.originalPostContent}>{selectedPost.content}</Text>
                </View>

                {commentsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={dynamicStyles.loadingText}>コメントを読み込み中...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={comments}
                    keyExtractor={(comment) => comment.id}
                    style={styles.commentsList}
                    renderItem={({ item: comment }) => {
                      const user = (comment as any).users;
                      const authorName = user?.nickname || 'Unknown';
                      
                      return (
                        <View style={dynamicStyles.commentItem}>
                          <View style={styles.commentHeader}>
                            <Text style={dynamicStyles.commentAuthor}>{authorName.replace(/_修正$/, '')}</Text>
                            <Text style={dynamicStyles.commentTimestamp}>{new Date(comment.created_at || new Date()).toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</Text>
                          </View>
                          <Text style={dynamicStyles.commentContent}>{comment.content}</Text>
                        </View>
                      );
                    }}
                    ListEmptyComponent={() => (
                      <View style={styles.noCommentsContainer}>
                        <Text style={dynamicStyles.noCommentsText}>まだコメントがありません</Text>
                      </View>
                    )}
                  />
                )}

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
                    style={[styles.commentSubmitButton, commentText.trim().length === 0 && styles.commentSubmitButtonDisabled]}
                    onPress={handleCommentSubmit}
                    disabled={commentText.trim().length === 0}
                  >
                    <Text style={styles.commentSubmitButtonText}>送信</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    position: 'relative',
  },
  menuButton: {
    position: 'absolute',
    top: 20,
    zIndex: 1,
    padding: 8,
    borderRadius: 8,
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
    backgroundColor: '#ff6b9d',
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
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff6b9d',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  timeline: {
    flex: 1,
  },
  postContainer: {
    backgroundColor: '#1a1a1a',
    margin: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b9d',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  postContent: {
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 24,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    fontSize: 14,
    color: '#4a9eff',
    marginRight: 8,
    marginBottom: 4,
  },
  aiResponseContainer: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b9d',
  },
  aiResponseLabel: {
    fontSize: 12,
    color: '#ff6b9d',
    fontWeight: '500',
    marginBottom: 4,
  },
  aiResponseText: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
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
  likedButton: {
    backgroundColor: '#ff6b9d20',
  },
  commentedButton: {
    backgroundColor: '#ff6b9d20',
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  likedText: {
    color: '#ff6b9d',
  },
  moreButton: {
    marginLeft: 'auto',
    padding: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentModalContainer: {
    backgroundColor: '#121212',
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
    borderBottomColor: '#333',
  },
  commentModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  commentModalClose: {
    padding: 8,
    borderRadius: 8,
  },
  commentModalCloseText: {
    fontSize: 24,
    color: '#666',
  },
  originalPost: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  originalPostAuthor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b9d',
    marginBottom: 8,
  },
  originalPostContent: {
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 22,
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  commentItem: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b9d',
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#888',
  },
  commentContent: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 48,
    minHeight: 32,
  },
  commentLikedButton: {
    backgroundColor: '#ff6b9d20',
  },
  commentLikeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  commentLikedText: {
    color: '#ff6b9d',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#e0e0e0',
    maxHeight: 80,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  commentSubmitButton: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#666',
  },
  commentSubmitButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#888',
    marginTop: 10,
    fontSize: 16,
  },
  debugInfo: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLoading: {
    padding: 20,
    alignItems: 'center',
  },
  noCommentsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noCommentsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
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
    justifyContent: 'space-between',
  },
  gridImage: {
    width: '48%',
    height: 120,
    borderRadius: 8,
  },
  gridImageContainer: {
    width: '48%',
    marginBottom: 4,
    position: 'relative',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  errorOverlay: {
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
});