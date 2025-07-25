import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal, Menu, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Sidebar from '../../components/Sidebar';
import { useAppDispatch } from '../../hooks/redux';
// import { postsApi } from '../../store/api/postsApi'; // Supabase無効時は使用しない
import { FeatureFlagsManager } from '../../services/featureFlags';
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
  aiResponse?: string;
}

const mockAiResponses: { [postId: string]: string } = {
  'mock_post_1': '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね ♡',
  'mock_post_2': '離乳食の悩み、よくわかります。無理をせず、お子さんのペースに合わせて大丈夫ですよ',
  'mock_post_3': '人見知りは恥ずかしいことじゃないですよ。無理をしないで、自分らしくいることが一番です',
};

// Mock posts for when Supabase is disabled
const mockPosts: PostWithLocalState[] = [
  {
    id: 'mock_post_1',
    authorId: 'user1',
    authorName: 'ママ太郎',
    content: '夜泣きで全然寝れない…誰か同じ経験ある人いますか？もう限界かも😭',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    likesCount: 12,
    commentsCount: 5,
    isLiked: false,
    aiResponse: mockAiResponses['mock_post_1'],
  },
  {
    id: 'mock_post_2',
    authorId: 'user2',
    authorName: 'はなまる',
    content: '離乳食始めたけど全然食べてくれない。みんなどうしてる？',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    likesCount: 8,
    commentsCount: 3,
    isLiked: true,
    aiResponse: mockAiResponses['mock_post_2'],
  },
  {
    id: 'mock_post_3',
    authorId: 'user3',
    authorName: '匿名ママ',
    content: '児童館デビューしたいけど人見知りで…みんな最初は緊張した？',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    likesCount: 15,
    commentsCount: 7,
    isLiked: false,
    aiResponse: mockAiResponses['mock_post_3'],
  },
];

export default function HomeScreen() {
  const { getFreeHandSide } = useHandPreference();
  const { theme } = useTheme();
  
  // UI State
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostWithLocalState | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // Mock states for when Supabase is disabled
  const [localPosts, setLocalPosts] = useState(mockPosts);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Real-time subscriptions (disabled for now)
  // const realtimePosts = useRealtimePosts({
  //   autoSubscribe: isSupabaseEnabled,
  //   conflictResolution: 'latest',
  //   debug: __DEV__,
  //   onError: (error, context) => {
  //     console.error(`[RealtimePosts] ${context}:`, error);
  //   }
  // });
  
  // const realtimeNotifications = useRealtimeNotifications({
  //   autoSubscribe: isSupabaseEnabled,
  //   enableSound: true,
  //   enableVibration: true,
  //   showInForeground: false, // Don't show notifications on home screen
  //   debug: __DEV__,
  //   onError: (error, context) => {
  //     console.error(`[RealtimeNotifications] ${context}:`, error);
  //   }
  // });

  // 空いた手の側を計算（利き手の逆側）
  const freeHandSide = getFreeHandSide();
  
  // Use local posts for now (Supabase is disabled)
  const posts = localPosts;
  const comments: any[] = [];
  const loading = false;
  const refreshing = isRefreshing;
  const error = null;

  const onRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleLike = async (postId: string) => {
    // Mock local update
    setLocalPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? {
              ...post,
              isLiked: !post.isLiked,
              likesCount: post.likesCount + (post.isLiked ? -1 : 1)
            }
          : post
      )
    );
  };

  const handleCommentPress = (post: PostWithLocalState) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    // Comments will be loaded automatically via useGetCommentsQuery
  };

  const handleCommentSubmit = async () => {
    if (!selectedPost || commentText.trim().length === 0) return;

    // Mock comment submission
    Alert.alert('開発モード', 'コメント機能は現在モック状態です。');
    setCommentText('');
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

  const renderPost = (post: PostWithLocalState) => (
    <TouchableOpacity
      style={dynamicStyles.postContainer}
      onLongPress={() => handleLongPress(post.id)}
      delayLongPress={800}
    >
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/profile', params: { userId: post.authorId } })}>
          <Text style={dynamicStyles.authorName}>{post.authorName}</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.timestamp}>{new Date(post.createdAt).toLocaleString('ja-JP', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</Text>
      </View>

      <Text style={dynamicStyles.postContent}>{post.content}</Text>

      {post.aiResponse && (
        <View style={dynamicStyles.aiResponseContainer}>
          <Text style={dynamicStyles.aiResponseLabel}>ママの味方</Text>
          <Text style={dynamicStyles.aiResponseText}>{post.aiResponse}</Text>
        </View>
      )}

      <View style={dynamicStyles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, post.isLiked && styles.likedButton]}
          onPress={() => handleLike(post.id)}
        >
          <Heart size={20} color={post.isLiked ? theme.colors.primary : theme.colors.text.disabled} fill={post.isLiked ? theme.colors.primary : 'none'} />
          <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
            {post.likesCount} 共感
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCommentPress(post)}
        >
          <MessageCircle size={20} color={theme.colors.text.disabled} />
          <Text style={dynamicStyles.actionText}>{post.commentsCount} コメント</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton}>
          <MoreHorizontal size={20} color={theme.colors.text.disabled} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

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
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={dynamicStyles.loadingText}>読み込み中...</Text>
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => renderPost(item)}
          keyExtractor={(item) => item.id}
          style={styles.timeline}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
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

                <FlatList
                  data={comments}
                  keyExtractor={(comment) => comment.id}
                  style={styles.commentsList}
                  renderItem={({ item: comment }) => (
                    <View style={dynamicStyles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Text style={dynamicStyles.commentAuthor}>{comment.authorName}</Text>
                        <Text style={dynamicStyles.commentTimestamp}>{new Date(comment.createdAt).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</Text>
                      </View>
                      <Text style={dynamicStyles.commentContent}>{comment.content}</Text>
                    </View>
                  )}
                  ListEmptyComponent={() => (
                    <View style={styles.noCommentsContainer}>
                      <Text style={dynamicStyles.noCommentsText}>まだコメントがありません</Text>
                    </View>
                  )}
                />

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
});