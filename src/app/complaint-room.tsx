import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { ArrowLeft, Send, Clock, Heart, MessageCircle, Users, Info } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

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
  const { theme } = useTheme();
  const [posts, setPosts] = useState<ComplaintPost[]>(mockComplaintPosts);
  const [newPost, setNewPost] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeUsers] = useState(34);

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    activeUsers: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 4,
    },
    roomInfo: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoCard: {
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#ffa500',
    },
    infoText: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      lineHeight: 18,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#ffa500',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    postCard: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    anonymousLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 4,
    },
    postContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 24,
      marginBottom: 12,
    },
    postFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 4,
    },
    expiresAt: {
      fontSize: 11,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    },
    postInputContainer: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    postInput: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text.primary,
      maxHeight: 100,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    likedButton: {
      backgroundColor: theme.colors.primary + '20',
    },
    likedText: {
      color: theme.colors.primary,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonDisabled: {
      backgroundColor: theme.colors.text.disabled,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

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
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={dynamicStyles.headerTitle}>愚痴もたまにはさ。</Text>
          <View style={styles.headerSubtitle}>
            <Users size={16} color={theme.colors.text.secondary} />
            <Text style={dynamicStyles.activeUsers}>{activeUsers}人が参加中</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.infoButton}>
          <Info size={24} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.roomInfo}>
        <View style={dynamicStyles.infoCard}>
          <Text style={dynamicStyles.infoTitle}>このルームについて</Text>
          <Text style={dynamicStyles.infoText}>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={dynamicStyles.emptyTitle}>まだ愚痴のポストがありません</Text>
            <Text style={dynamicStyles.emptyDescription}>
              最初の愚痴をポストしてみませんか？
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={dynamicStyles.postCard}>
              <View style={styles.postHeader}>
                <Text style={dynamicStyles.anonymousLabel}>匿名</Text>
                <View style={styles.postMeta}>
                  <Clock size={14} color={theme.colors.text.secondary} />
                  <Text style={dynamicStyles.timestamp}>{post.timestamp}</Text>
                </View>
              </View>
              
              <Text style={dynamicStyles.postContent}>{post.content}</Text>
              
              <View style={dynamicStyles.postFooter}>
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && dynamicStyles.likedButton]}
                    onPress={() => handleLike(post.id)}
                  >
                    <Heart size={18} color={post.isLiked ? theme.colors.primary : theme.colors.text.secondary} fill={post.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
                      {post.likes}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <MessageCircle size={18} color={theme.colors.text.secondary} />
                    <Text style={dynamicStyles.actionText}>{post.comments}</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={dynamicStyles.expiresAt}>{getTimeRemaining(post.expiresAt)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={dynamicStyles.postInputContainer}>
        <TextInput
          style={dynamicStyles.postInput}
          placeholder="今日の愚痴を匿名でポスト..."
          placeholderTextColor={theme.colors.text.secondary}
          multiline
          value={newPost}
          onChangeText={setNewPost}
          maxLength={300}
        />
        <View style={styles.inputFooter}>
          <Text style={dynamicStyles.charCount}>{newPost.length}/300</Text>
          <TouchableOpacity
            style={[dynamicStyles.submitButton, newPost.trim().length === 0 && dynamicStyles.submitButtonDisabled]}
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
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    padding: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffa500',
    marginBottom: 8,
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
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
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
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
});