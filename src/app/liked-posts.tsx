import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { ArrowLeft, Heart, MessageCircle, Calendar, Clock, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector } from '../hooks/redux';
import { postsApi } from '../store/api/postsApi';

// Interface for displaying liked posts - based on PostWithExtras from postsApi
interface LikedPostDisplay {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
  comments: number;
  likedAt: string;
  authorId: string;
  image_url?: string;
}

export default function LikedPostsScreen() {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get current user ID from Redux state
  const currentUserId = useAppSelector(state => state.auth?.profile?.id || state.auth?.user?.id);
  
  console.log('🔍 LikedPosts - currentUserId:', currentUserId);
  console.log('🔍 LikedPosts - auth state:', useAppSelector(state => state.auth));
  
  // RTK Query hook for fetching liked posts
  const {
    data: likedPostsData,
    error,
    isLoading,
    refetch
  } = postsApi.useGetLikedPostsQuery(
    { userId: currentUserId || '' },
    { skip: !currentUserId }
  );
  
  console.log('🔍 LikedPosts - query result:', {
    dataLength: likedPostsData?.length,
    error,
    isLoading,
    skip: !currentUserId,
    rawData: likedPostsData
  });
  
  // Transform RTK Query data to display format
  console.log('🔍 LikedPosts - likedPostsData:', likedPostsData);
  console.log('🔍 LikedPosts - likedPostsData type:', typeof likedPostsData);
  console.log('🔍 LikedPosts - isArray:', Array.isArray(likedPostsData));
  
  const likedPosts: LikedPostDisplay[] = (Array.isArray(likedPostsData) ? likedPostsData : []).map(post => {
    console.log('🔍 LikedPosts - transforming post:', {
      id: post.id,
      content: post.content,
      users: post.users,
      nickname: post.users?.nickname
    });
    
    return {
      id: post.id,
      content: post.content || '',
      author: post.users?.nickname || 'Unknown',
      authorId: post.user_id || '',
      timestamp: post.created_at || '',
      likes: post.likes_count || 0,
      comments: post.comments_count || 0,
      likedAt: post.liked_at || '',
      image_url: post.image_url || undefined
    };
  });

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
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    postContainer: {
      backgroundColor: theme.colors.surface,
      margin: 10,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateText: {
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
    aiResponseContainer: {
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    aiResponseText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
    },
    postStats: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginBottom: 8,
    },
    statText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6,
    },
    likedAtText: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 4,
      fontStyle: 'italic',
    },
    authorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginLeft: 6,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    statTextLiked: {
      fontSize: 14,
      color: theme.colors.primary,
      marginLeft: 6,
    },
    aiResponseLabel: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
      marginBottom: 4,
    },
  });

  const onRefresh = async () => {
    if (!currentUserId) return;
    
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('共感履歴のリフレッシュに失敗:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今日';
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return timestamp.split(' ')[0];
    }
  };

  const totalLikes = likedPosts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = likedPosts.reduce((sum, post) => sum + post.comments, 0);
  
  // Loading state
  if (isLoading && likedPosts.length === 0) {
    return (
      <SafeAreaView style={[dynamicStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[dynamicStyles.emptyDescription, { marginTop: 16 }]}>共感履歴を読み込み中...</Text>
      </SafeAreaView>
    );
  }
  
  // Error state
  if (error && likedPosts.length === 0) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>共感したポスト</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyState}>
          <Heart size={48} color={theme.colors.text.disabled} />
          <Text style={dynamicStyles.emptyTitle}>データの読み込みに失敗しました</Text>
          <Text style={dynamicStyles.emptyDescription}>
            ネットワーク接続を確認して、再試行してください。
          </Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // No user logged in
  if (!currentUserId) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>共感したポスト</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyState}>
          <Heart size={48} color={theme.colors.text.disabled} />
          <Text style={dynamicStyles.emptyTitle}>ログインが必要です</Text>
          <Text style={dynamicStyles.emptyDescription}>
            共感履歴を表示するにはログインしてください。
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>共感したポスト</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={dynamicStyles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={dynamicStyles.statNumber}>{likedPosts.length}</Text>
          <Text style={dynamicStyles.statLabel}>共感したポスト</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={dynamicStyles.statNumber}>{totalLikes}</Text>
          <Text style={dynamicStyles.statLabel}>総共感数</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={dynamicStyles.statNumber}>{totalComments}</Text>
          <Text style={dynamicStyles.statLabel}>総コメント数</Text>
        </View>
      </View>

      <FlatList
        data={likedPosts}
        keyExtractor={(item) => item.id}
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        renderItem={({ item: post }) => (
          <TouchableOpacity
            style={dynamicStyles.postContainer}
            onPress={() => router.push({ pathname: '/profile', params: { userId: post.authorId } })}
          >
            <View style={styles.postHeader}>
              <View style={styles.authorInfo}>
                <User size={16} color={theme.colors.primary} />
                <Text style={dynamicStyles.authorName}>{post.author}</Text>
              </View>
              <View style={styles.postDate}>
                <Calendar size={14} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.dateText}>{formatDate(post.timestamp)}</Text>
              </View>
            </View>
            
            <Text style={dynamicStyles.postContent}>{post.content}</Text>
            
            <View style={dynamicStyles.postStats}>
              <View style={styles.statGroup}>
                <Heart size={16} color={theme.colors.primary} fill={theme.colors.primary} />
                <Text style={dynamicStyles.statTextLiked}>{post.likes} 共感</Text>
              </View>
              <View style={styles.statGroup}>
                <MessageCircle size={16} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.statText}>{post.comments} コメント</Text>
              </View>
            </View>
            
            <View style={styles.likedAtContainer}>
              <Clock size={12} color={theme.colors.text.disabled} />
              <Text style={dynamicStyles.likedAtText}>
                {formatDate(post.likedAt)} に共感
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Heart size={48} color={theme.colors.text.disabled} />
            <Text style={dynamicStyles.emptyTitle}>共感したポストがありません</Text>
            <Text style={dynamicStyles.emptyDescription}>
              気になるポストに共感してみませんか？
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerRight: {
    width: 40,
  },
  statItem: {
    alignItems: 'center',
  },
  content: {
    flex: 1,
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
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  likedAtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});