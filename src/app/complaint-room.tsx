import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { ArrowLeft, Send, Clock, Heart, MessageCircle, Users, Info } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface ComplaintPost {
  id: string;
  content: string;
  timestamp: string;
  expiresAt: string;
  likes: number;
  comments: number;
  isLiked: boolean;
}

const mockComplaintPosts: ComplaintPost[] = [
  {
    id: '1',
    content: '今日は夫が「疲れた」って言っただけで怒鳴ってしまった... 私の方が疲れてるのに',
    timestamp: '15分前',
    expiresAt: '45分後に削除',
    likes: 8,
    comments: 3,
    isLiked: false,
  },
  {
    id: '2',
    content: '保育園のお迎えに遅れそうになって冷や汗... 仕事の会議が長引いて本当に困る',
    timestamp: '32分前',
    expiresAt: '28分後に削除',
    likes: 12,
    comments: 5,
    isLiked: true,
  },
  {
    id: '3',
    content: '離乳食作ったのに全然食べなくて、結局大人の食事の準備もできてない... もう疲れた',
    timestamp: '48分前',
    expiresAt: '12分後に削除',
    likes: 15,
    comments: 7,
    isLiked: false,
  },
];

export default function ComplaintRoomScreen() {
  const [posts, setPosts] = useState<ComplaintPost[]>(mockComplaintPosts);
  const [newPost, setNewPost] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeUsers] = useState(34);

  useEffect(() => {
    // 1時間経った投稿を削除するタイマー
    const interval = setInterval(() => {
      const now = new Date();
      setPosts(prevPosts => 
        prevPosts.filter(post => {
          const postTime = new Date(post.timestamp);
          const diffInMinutes = (now.getTime() - postTime.getTime()) / (1000 * 60);
          return diffInMinutes < 60;
        })
      );
    }, 60000); // 1分毎にチェック

    return () => clearInterval(interval);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const handleSubmitPost = () => {
    if (newPost.trim().length === 0) {
      Alert.alert('エラー', '愚痴の内容を入力してください');
      return;
    }

    if (newPost.length > 300) {
      Alert.alert('エラー', '300文字以内で入力してください');
      return;
    }

    const now = new Date();
    const newComplaintPost: ComplaintPost = {
      id: Date.now().toString(),
      content: newPost,
      timestamp: '今',
      expiresAt: '60分後に削除',
      likes: 0,
      comments: 0,
      isLiked: false,
    };

    setPosts([newComplaintPost, ...posts]);
    setNewPost('');
    Alert.alert('ポスト完了', '愚痴をポストしました。1時間後に自動で削除されます。');
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const getTimeRemaining = (expiresAt: string) => {
    // 簡単な実装のため、文字列をそのまま返す
    return expiresAt;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>愚痴もたまにはさ。</Text>
          <View style={styles.headerSubtitle}>
            <Users size={16} color="#666" />
            <Text style={styles.activeUsers}>{activeUsers}人が参加中</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.infoButton}>
          <Info size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.roomInfo}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>このルームについて</Text>
          <Text style={styles.infoText}>
            • 完全匿名で投稿できます{'\n'}
            • 投稿は1時間で自動削除されます{'\n'}
            • 愚痴や不満を安心して共有してください{'\n'}
            • お互いを思いやる温かいコメントをお願いします
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.postsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
        }
      >
        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>まだ愚痴のポストがありません</Text>
            <Text style={styles.emptyDescription}>
              最初の愚痴をポストしてみませんか？
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Text style={styles.anonymousLabel}>匿名</Text>
                <View style={styles.postMeta}>
                  <Clock size={14} color="#666" />
                  <Text style={styles.timestamp}>{post.timestamp}</Text>
                </View>
              </View>
              
              <Text style={styles.postContent}>{post.content}</Text>
              
              <View style={styles.postFooter}>
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && styles.likedButton]}
                    onPress={() => handleLike(post.id)}
                  >
                    <Heart size={18} color={post.isLiked ? '#ff6b9d' : '#666'} fill={post.isLiked ? '#ff6b9d' : 'none'} />
                    <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                      {post.likes}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <MessageCircle size={18} color="#666" />
                    <Text style={styles.actionText}>{post.comments}</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.expiresAt}>{getTimeRemaining(post.expiresAt)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.postInputContainer}>
        <TextInput
          style={styles.postInput}
          placeholder="今日の愚痴を匿名でポスト..."
          placeholderTextColor="#666"
          multiline
          value={newPost}
          onChangeText={setNewPost}
          maxLength={300}
        />
        <View style={styles.inputFooter}>
          <Text style={styles.charCount}>{newPost.length}/300</Text>
          <TouchableOpacity
            style={[styles.submitButton, newPost.trim().length === 0 && styles.submitButtonDisabled]}
            onPress={handleSubmitPost}
            disabled={newPost.trim().length === 0}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeUsers: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  infoButton: {
    padding: 8,
  },
  roomInfo: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ffa500',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffa500',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 18,
  },
  postsContainer: {
    flex: 1,
    padding: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  postCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  anonymousLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  postContent: {
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 24,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 48,
    minHeight: 32,
    justifyContent: 'center',
  },
  likedButton: {
    backgroundColor: '#ff6b9d20',
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  likedText: {
    color: '#ff6b9d',
  },
  expiresAt: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  postInputContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  postInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#e0e0e0',
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#ff6b9d',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
  },
});