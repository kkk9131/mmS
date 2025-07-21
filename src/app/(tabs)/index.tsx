import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal, Menu, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Sidebar from '../../components/Sidebar';
import { PostsService } from '../../services/PostsService';
import { Post, Comment } from '../../types/posts';

interface PostWithLocalState extends Post {
  aiResponse?: string;
}

const mockAiResponses: { [postId: string]: string } = {
  'mock_post_1': '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね ♡',
  'mock_post_2': '離乳食の悩み、よくわかります。無理をせず、お子さんのペースに合わせて大丈夫ですよ',
  'mock_post_3': '人見知りは恥ずかしいことじゃないですよ。無理をしないで、自分らしくいることが一番です',
};

export default function HomeScreen() {
  const [posts, setPosts] = useState<PostWithLocalState[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostWithLocalState | null>(null);
  const [selectedPostComments, setSelectedPostComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [dominantHand, setDominantHand] = useState<'right' | 'left'>('right');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const postsService = PostsService.getInstance();

  // 空いた手の側を計算（利き手の逆側）
  const freeHandSide = dominantHand === 'right' ? 'left' : 'right';

  const loadPosts = async (page: number = 1, isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setError(null);
      }

      const response = await postsService.getPosts({
        page,
        limit: 10,
        sortBy: 'createdAt',
        order: 'desc'
      });

      const postsWithAi = response.posts.map(post => ({
        ...post,
        aiResponse: mockAiResponses[post.id]
      }));

      if (isRefresh || page === 1) {
        setPosts(postsWithAi);
      } else {
        setPosts(prev => [...prev, ...postsWithAi]);
      }

      setHasMore(response.pagination.hasNext);
      setCurrentPage(page);
    } catch (error: any) {
      console.error('投稿の読み込みに失敗しました:', error);
      setError('投稿の読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const response = await postsService.getComments(postId, {
        page: 1,
        limit: 50,
        sortBy: 'createdAt',
        order: 'asc'
      });
      setSelectedPostComments(response.comments);
    } catch (error) {
      console.error('コメントの読み込みに失敗しました:', error);
      setSelectedPostComments([]);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts(1, true);
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasLiked = post.isLiked;

    // 楽観的更新
    setPosts(posts.map(p =>
      p.id === postId
        ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
        : p
    ));

    try {
      if (wasLiked) {
        await postsService.unlikePost(postId);
      } else {
        await postsService.likePost(postId);
      }
    } catch (error) {
      // エラー時はロールバック
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, isLiked: wasLiked, likesCount: wasLiked ? p.likesCount + 1 : p.likesCount - 1 }
          : p
      ));
      Alert.alert('エラー', 'いいねの処理に失敗しました。');
    }
  };

  const handleCommentPress = async (post: PostWithLocalState) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    await loadComments(post.id);
  };

  const handleCommentSubmit = async () => {
    if (!selectedPost || commentText.trim().length === 0) return;

    try {
      const newComment = await postsService.createComment(selectedPost.id, {
        content: commentText.trim()
      });

      // コメント一覧を更新
      setSelectedPostComments(prev => [...prev, newComment]);

      // 投稿のコメント数を更新
      setPosts(posts.map(post =>
        post.id === selectedPost.id
          ? { ...post, commentsCount: post.commentsCount + 1 }
          : post
      ));

      setCommentText('');
    } catch (error) {
      Alert.alert('エラー', 'コメントの投稿に失敗しました。');
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

  const renderPost = (post: PostWithLocalState) => (
    <TouchableOpacity
      style={styles.postContainer}
      onLongPress={() => handleLongPress(post.id)}
      delayLongPress={800}
    >
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/profile', params: { userId: post.authorId } })}>
          <Text style={styles.authorName}>{post.authorName}</Text>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{new Date(post.createdAt).toLocaleString('ja-JP', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</Text>
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      {post.aiResponse && (
        <View style={styles.aiResponseContainer}>
          <Text style={styles.aiResponseLabel}>ママの味方</Text>
          <Text style={styles.aiResponseText}>{post.aiResponse}</Text>
        </View>
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, post.isLiked && styles.likedButton]}
          onPress={() => handleLike(post.id)}
        >
          <Heart size={20} color={post.isLiked ? '#ff6b9d' : '#666'} fill={post.isLiked ? '#ff6b9d' : 'none'} />
          <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
            {post.likesCount} 共感
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCommentPress(post)}
        >
          <MessageCircle size={20} color="#666" />
          <Text style={styles.actionText}>{post.commentsCount} コメント</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton}>
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.menuButton,
            freeHandSide === 'left' ? styles.menuButtonLeft : styles.menuButtonRight
          ]}
          onPress={() => setSidebarVisible(true)}
        >
          <Menu size={24} color="#ff6b9d" />
        </TouchableOpacity>



        <Text style={styles.headerSubtitle}>ママの共感コミュニティ</Text>
      </View>

      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Mamapace</Text>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6b9d" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPosts()}>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
          }
          onEndReached={() => {
            if (hasMore && !loading) {
              loadPosts(currentPage + 1, false);
            }
          }}
          onEndReachedThreshold={0.1}
          ListFooterComponent={() => {
            if (hasMore && posts.length > 0) {
              return (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color="#ff6b9d" />
                </View>
              );
            }
            return null;
          }}
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
            style={styles.commentModalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.commentModalHeader}>
              <Text style={styles.commentModalTitle}>コメント</Text>
              <TouchableOpacity
                onPress={() => setCommentModalVisible(false)}
                style={styles.commentModalClose}
              >
                <Text style={styles.commentModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <>
                <View style={styles.originalPost}>
                  <Text style={styles.originalPostAuthor}>{selectedPost.authorName}</Text>
                  <Text style={styles.originalPostContent}>{selectedPost.content}</Text>
                </View>

                <FlatList
                  data={selectedPostComments}
                  keyExtractor={(comment) => comment.id}
                  style={styles.commentsList}
                  renderItem={({ item: comment }) => (
                    <View style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                        <Text style={styles.commentTimestamp}>{new Date(comment.createdAt).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</Text>
                      </View>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                    </View>
                  )}
                  ListEmptyComponent={() => (
                    <View style={styles.noCommentsContainer}>
                      <Text style={styles.noCommentsText}>まだコメントがありません</Text>
                    </View>
                  )}
                />

                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="コメントを入力..."
                    placeholderTextColor="#666"
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