import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal, Menu, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Sidebar from '../../components/Sidebar';

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
  commentList?: Comment[];
}

interface Comment {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
  isLiked: boolean;
}

const mockPosts: Post[] = [
  {
    id: '1',
    content: '今日は息子の夜泣きがひどくて、もう限界かも...😢 みんなはどうやって乗り切ってる？ #夜泣き #新生児 #しんどい',
    author: 'みさき',
    timestamp: '2分前',
    likes: 12,
    comments: 3,
    tags: ['夜泣き', '新生児', 'しんどい'],
    isLiked: false,
    aiResponse: '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね ♡',
    commentList: [
      {
        id: '1',
        content: '私も同じ悩みを抱えています。一緒に頑張りましょう！',
        author: 'ゆか',
        timestamp: '5分前',
        likes: 2,
        isLiked: false
      },
      {
        id: '2',
        content: 'マッサージが効果的でした。試してみてください',
        author: 'さくら',
        timestamp: '10分前',
        likes: 1,
        isLiked: true
      }
    ]
  },
  {
    id: '2',
    content: '離乳食を全然食べてくれない... 栄養面が心配で毎日不安です。何かいい方法はないでしょうか？ #離乳食 #食べない #心配',
    author: 'ゆか',
    timestamp: '15分前',
    likes: 8,
    comments: 5,
    tags: ['離乳食', '食べない', '心配'],
    isLiked: true,
    aiResponse: '離乳食の悩み、よくわかります。無理をせず、お子さんのペースに合わせて大丈夫ですよ',
    commentList: [
      {
        id: '3',
        content: '少しずつでも食べてくれるようになりますよ',
        author: 'えみ',
        timestamp: '1時間前',
        likes: 3,
        isLiked: false
      }
    ]
  },
  {
    id: '3',
    content: '保育園の送迎で他のママとの会話が苦手... 人見知りな性格で毎朝憂鬱になっちゃう #保育園 #人見知り #ママ友',
    author: 'えみ',
    timestamp: '1時間前',
    likes: 15,
    comments: 7,
    tags: ['保育園', '人見知り', 'ママ友'],
    isLiked: false,
    aiResponse: '人見知りは恥ずかしいことじゃないですよ。無理をしないで、自分らしくいることが一番です',
    commentList: []
  }
];

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  // 実際の実装では、AsyncStorageやContextから読み込む
  const [dominantHand, setDominantHand] = useState<'right' | 'left'>('right');
  
  // 空いた手の側を計算（利き手の逆側）
  const freeHandSide = dominantHand === 'right' ? 'left' : 'right';

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const handleCommentLike = (postId: string, commentId: string) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? {
            ...post,
            commentList: post.commentList?.map(comment =>
              comment.id === commentId
                ? { ...comment, isLiked: !comment.isLiked, likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1 }
                : comment
            )
          }
        : post
    ));
  };

  const handleCommentPress = (post: Post) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
  };

  const handleCommentSubmit = () => {
    if (!selectedPost || commentText.trim().length === 0) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      content: commentText,
      author: 'あなた',
      timestamp: '今',
      likes: 0,
      isLiked: false
    };

    setPosts(posts.map(post => 
      post.id === selectedPost.id 
        ? { 
            ...post, 
            comments: post.comments + 1,
            commentList: [...(post.commentList || []), newComment]
          }
        : post
    ));

    setCommentText('');
    setCommentModalVisible(false);
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

  const renderPost = (post: Post) => (
    <TouchableOpacity
      key={post.id}
      style={styles.postContainer}
      onLongPress={() => handleLongPress(post.id)}
      delayLongPress={800}
    >
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/profile', params: { userId: post.id } })}>
          <Text style={styles.authorName}>{post.author}</Text>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{post.timestamp}</Text>
      </View>
      
      <Text style={styles.postContent}>{post.content}</Text>
      
      <View style={styles.tagsContainer}>
        {post.tags.map((tag, index) => (
          <Text key={index} style={styles.tag}>#{tag}</Text>
        ))}
      </View>
      
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
            {post.likes} 共感
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCommentPress(post)}
        >
          <MessageCircle size={20} color="#666" />
          <Text style={styles.actionText}>{post.comments} コメント</Text>
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
      
      <ScrollView
        style={styles.timeline}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />}
      >
        {posts.map(renderPost)}
      </ScrollView>
      
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
                  <Text style={styles.originalPostAuthor}>{selectedPost.author}</Text>
                  <Text style={styles.originalPostContent}>{selectedPost.content}</Text>
                </View>
                
                <ScrollView style={styles.commentsList}>
                  {selectedPost.commentList?.map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{comment.author}</Text>
                        <Text style={styles.commentTimestamp}>{comment.timestamp}</Text>
                      </View>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                      <TouchableOpacity 
                        style={[styles.commentLikeButton, comment.isLiked && styles.commentLikedButton]}
                        onPress={() => handleCommentLike(selectedPost.id, comment.id)}
                      >
                        <Heart size={16} color={comment.isLiked ? '#ff6b9d' : '#666'} fill={comment.isLiked ? '#ff6b9d' : 'none'} />
                        <Text style={[styles.commentLikeText, comment.isLiked && styles.commentLikedText]}>
                          {comment.likes}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                
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
});