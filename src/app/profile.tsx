import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, User, MessageCircle, UserPlus, UserMinus, Heart, Calendar, MapPin, Share, MoveHorizontal as MoreHorizontal, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from '../hooks/redux';
// import { usersApi } from '../store/api/usersApi'; // Supabase無効時は使用しない
// import { followsApi } from '../store/api/followsApi'; // Supabase無効時は使用しない
// import { postsApi } from '../store/api/postsApi'; // Supabase無効時は使用しない
import { User as UserType, UserProfile as UserProfileType } from '../types/users';
import { useTheme } from '../contexts/ThemeContext';

// 画面表示用のプロフィールインターface（既存のUIとの互換性維持）
interface DisplayProfile {
  id: string;
  name: string;
  bio?: string;
  location?: string;
  joinDate: string;
  postCount: number;
  followingCount: number;
  followerCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  avatar?: string;
}

interface UserPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  tags: string[];
  aiResponse?: string;
}

const mockUserProfile: DisplayProfile = {
  id: '1',
  name: 'ゆかちゃん',
  bio: '2歳の男の子のママです♡ 毎日の子育て、お互いに支え合いましょう！夜泣きや離乳食の悩みをシェアしています。',
  location: '東京都',
  joinDate: '2024年1月',
  postCount: 24,
  followingCount: 156,
  followerCount: 203,
  isFollowing: false,
  isOwnProfile: false,
};

const mockOwnProfile: DisplayProfile = {
  id: 'own',
  name: 'みさき',
  bio: '新米ママです！みんなのアドバイスに助けられています。よろしくお願いします♪',
  location: '神奈川県',
  joinDate: '2024年1月',
  postCount: 18,
  followingCount: 67,
  followerCount: 89,
  isFollowing: false,
  isOwnProfile: true
};

const mockUserPosts: UserPost[] = [
  {
    id: '1',
    content: '今日は息子の夜泣きがひどくて、もう限界かも...😢 みんなはどうやって乗り切ってる？',
    timestamp: '2時間前',
    likes: 12,
    comments: 3,
    isLiked: false,
    tags: ['夜泣き', '新生児', 'しんどい'],
    aiResponse: '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね ♡'
  },
  {
    id: '2',
    content: '離乳食を全然食べてくれない... 栄養面が心配で毎日不安です。何かいい方法はないでしょうか？',
    timestamp: '1日前',
    likes: 8,
    comments: 5,
    isLiked: true,
    tags: ['離乳食', '食べない', '心配']
  },
  {
    id: '3',
    content: '保育園の送迎で他のママとの会話が苦手... 人見知りな性格で毎朝憂鬱になっちゃう',
    timestamp: '3日前',
    likes: 15,
    comments: 7,
    isLiked: false,
    tags: ['保育園', '人見知り', 'ママ友']
  }
];

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { logout, user } = useAuth();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  
  // 自分のプロフィールかどうかを判定
  const isOwnProfile = !userId || userId === 'own';
  const [refreshing, setRefreshing] = useState(false);
  
  // モック投稿データを状態として管理
  const [mockPostsState, setMockPostsState] = useState<UserPost[]>(mockUserPosts);
  
  // Mock user profile (Supabase is disabled)
  const userProfile = isOwnProfile ? null : mockUserProfile;
  const userProfileError = null;
  const userProfileLoading = false;
  const refetchProfile = async () => {};
  
  // Mock own profile (Supabase is disabled)
  const ownProfile = isOwnProfile ? mockOwnProfile : null;
  const ownProfileError = null;
  const ownProfileLoading = false;
  const refetchOwnProfile = async () => {};
  
  // Mock posts data (Supabase is disabled) - use state version
  const postsData = { posts: mockPostsState };
  const postsLoading = false;
  const refetchPosts = async () => {};
  
  // Mock follow mutations (Supabase is disabled)
  const followUser = async () => {
    console.log('Mock follow user');
    return { unwrap: () => Promise.resolve() };
  };
  const unfollowUser = async () => {
    console.log('Mock unfollow user');
    return { unwrap: () => Promise.resolve() };
  };
  
  // Mock post mutations (Supabase is disabled)
  const likePost = async () => {
    console.log('Mock like post');
    return { unwrap: () => Promise.resolve() };
  };
  const unlikePost = async () => {
    console.log('Mock unlike post');
    return { unwrap: () => Promise.resolve() };
  };

  // Transform profile data
  const rawProfile = isOwnProfile ? ownProfile : userProfile;
  const posts: UserPost[] = (postsData as any)?.posts?.map((post: any) => ({
    id: post.id,
    content: post.content,
    timestamp: new Date(post.createdAt).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    likes: post.likesCount,
    comments: post.commentsCount,
    isLiked: post.isLiked,
    tags: [], // TODO: Extract tags from content or add tags field
    aiResponse: undefined // TODO: Add AI response logic if needed
  })) || [];
  
  // Transform to display profile (rawProfile is already in DisplayProfile format for mock data)
  const profile: DisplayProfile | null = rawProfile;
  
  // Loading and error states
  const loading = isOwnProfile ? ownProfileLoading : userProfileLoading;
  const error = (isOwnProfile ? ownProfileError : userProfileError) ? 'プロフィールの読み込みに失敗しました' : null;

  // Refetch on focus for own profile (to reflect updates from editing)
  useFocusEffect(
    React.useCallback(() => {
      if (isOwnProfile) {
        refetchOwnProfile();
        refetchPosts();
      }
    }, [isOwnProfile, refetchOwnProfile, refetchPosts])
  );

  const handleBack = () => {
    router.back();
  };

  const handleFollow = async () => {
    if (!profile || profile.isOwnProfile) return;

    const willFollow = !profile.isFollowing;

    try {
      if (willFollow) {
        await (await followUser()).unwrap();
      } else {
        await (await unfollowUser()).unwrap();
      }
    } catch (error) {
      console.error('Failed to update follow status:', error);
      Alert.alert(
        'エラー',
        willFollow ? 'フォローに失敗しました' : 'フォロー解除に失敗しました'
      );
    }
  };

  const handleMessage = () => {
    router.push({
      pathname: '/chat',
      params: { userId: profile?.id || '', userName: profile?.name || '' }
    });
  };

  const handleShare = () => {
    Alert.alert('プロフィールを共有', 'プロフィールのリンクをコピーしました');
  };

  const handleLike = async (postId: string) => {
    // Update local state for immediate UI feedback
    setMockPostsState(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1
            }
          : post
      )
    );
    
    console.log('Like toggled for post:', postId);
  };

  const handleComment = (postId: string) => {
    const post = mockPostsState.find(p => p.id === postId);
    if (post) {
      Alert.alert(
        'コメント',
        `「${post.content.substring(0, 50)}...」へのコメント機能は開発中です。`,
        [{ text: 'OK' }]
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isOwnProfile) {
        await Promise.all([refetchOwnProfile(), refetchPosts()]);
      } else {
        await Promise.all([refetchProfile(), refetchPosts()]);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('エラー', 'ログアウトに失敗しました');
            }
          },
        },
      ]
    );
  };

  // 動的スタイル
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
      color: theme.colors.primary,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    profileSection: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    avatarContainer: {
      position: 'relative',
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageButton: {
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followingButton: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followingText: {
      color: theme.colors.text.disabled,
    },
    editButton: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editButtonText: {
      color: theme.colors.text.primary,
      fontWeight: '600',
    },
    profileName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    profileBio: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 22,
      marginBottom: 12,
    },
    metaText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 4,
    },
    statNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
      marginRight: 4,
    },
    statLabel: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    activityButton: {
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      marginHorizontal: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activityButtonText: {
      fontSize: 11,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginTop: 4,
      fontWeight: '500',
    },
    postsTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
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
    postCard: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    postUserName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    postTimestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
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
    postActions: {
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
    loadingText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
  });

  // ローディング状態の表示
  if (loading || !profile) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={dynamicStyles.headerTitle}>読み込み中...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={dynamicStyles.loadingText}>プロフィールを読み込んでいます...</Text>
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
        <View style={styles.headerContent}>
          <Text style={dynamicStyles.headerTitle}>プロフィール</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share size={24} color={theme.colors.text.disabled} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* プロフィール情報 */}
        <View style={dynamicStyles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.userSection}>
              <View style={dynamicStyles.avatarContainer}>
                <User size={60} color={theme.colors.primary} />
              </View>
              <View style={styles.userInfo}>
                <Text style={dynamicStyles.userName}>{profile.name}</Text>
              </View>
            </View>

            <View style={styles.profileActions}>
              {profile.isOwnProfile ? (
                <TouchableOpacity
                  style={dynamicStyles.editButton}
                  onPress={() => router.push('/profile-edit')}
                >
                  <Text style={dynamicStyles.editButtonText}>プロフィール編集</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={dynamicStyles.messageButton} onPress={handleMessage}>
                    <MessageCircle size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followButton, profile.isFollowing && dynamicStyles.followingButton]}
                    onPress={handleFollow}
                  >
                    {profile.isFollowing ? (
                      <>
                        <UserMinus size={18} color={theme.colors.text.disabled} />
                        <Text style={[styles.followButtonText, dynamicStyles.followingText]}>フォロー中</Text>
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} color="#fff" />
                        <Text style={styles.followButtonText}>フォロー</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={dynamicStyles.profileName}>{profile.name}</Text>
            <Text style={dynamicStyles.profileBio}>{profile.bio}</Text>

            <View style={styles.profileMeta}>
              <View style={styles.metaItem}>
                <MapPin size={16} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.metaText}>{profile.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Calendar size={16} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.metaText}>{profile.joinDate}から利用</Text>
              </View>
            </View>

            <View style={styles.statsContainer}>
              {profile.isOwnProfile && (
                <View style={styles.activityButtons}>
                  <TouchableOpacity
                    style={dynamicStyles.activityButton}
                    onPress={() => router.push('/liked-posts')}
                  >
                    <Heart size={16} color={theme.colors.primary} />
                    <Text style={dynamicStyles.activityButtonText}>共感履歴</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={dynamicStyles.activityButton}
                    onPress={() => router.push('/follow-list')}
                  >
                    <User size={16} color={theme.colors.primary} />
                    <Text style={dynamicStyles.activityButtonText}>フォロー管理</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dynamicStyles.activityButton, styles.logoutButton]}
                    onPress={handleLogout}
                  >
                    <LogOut size={16} color="#ff4444" />
                    <Text style={[styles.activityButtonText, styles.logoutButtonText]}>ログアウト</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ポスト一覧 */}
        <View style={styles.postsSection}>
          <Text style={dynamicStyles.postsTitle}>ポスト</Text>
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={48} color={theme.colors.text.disabled} />
              <Text style={dynamicStyles.emptyTitle}>まだポストがありません</Text>
              <Text style={dynamicStyles.emptyDescription}>
                {profile.isOwnProfile ? '最初のポストを作成してみませんか？' : 'このユーザーはまだポストしていません'}
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={dynamicStyles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.postUser}>
                    <User size={32} color={theme.colors.primary} />
                    <View style={styles.postUserInfo}>
                      <Text style={dynamicStyles.postUserName}>{profile.name}</Text>
                      <Text style={dynamicStyles.postTimestamp}>{post.timestamp}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.postMore}>
                    <MoreHorizontal size={20} color={theme.colors.text.disabled} />
                  </TouchableOpacity>
                </View>

                <Text style={dynamicStyles.postContent}>{post.content}</Text>

                <View style={styles.tagsContainer}>
                  {post.tags.map((tag, index) => (
                    <Text key={index} style={styles.tag}>#{tag}</Text>
                  ))}
                </View>

                {post.aiResponse && (
                  <View style={dynamicStyles.aiResponseContainer}>
                    <Text style={dynamicStyles.aiResponseLabel}>ママの味方</Text>
                    <Text style={dynamicStyles.aiResponseText}>{post.aiResponse}</Text>
                  </View>
                )}

                <View style={dynamicStyles.postActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && styles.likedButton]}
                    onPress={() => handleLike(post.id)}
                  >
                    <Heart size={20} color={post.isLiked ? theme.colors.primary : theme.colors.text.disabled} fill={post.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
                      {post.likes}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleComment(post.id)}
                  >
                    <MessageCircle size={20} color={theme.colors.text.disabled} />
                    <Text style={dynamicStyles.actionText}>{post.comments}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    justifyContent: 'center',
    marginLeft: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4ade80',
    borderWidth: 3,
    borderColor: '#121212',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageButton: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  followButton: {
    backgroundColor: '#ff6b9d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  followingText: {
    color: '#666',
  },
  editButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  editButtonText: {
    color: '#e0e0e0',
    fontWeight: '600',
  },
  profileInfo: {
    marginTop: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 22,
    marginBottom: 12,
  },
  profileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginRight: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
  },
  activityButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
  },
  activityButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  activityButtonText: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  postsSection: {
    padding: 20,
  },
  postsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0e0e0',
    marginTop: 16,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUserInfo: {
    marginLeft: 8,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b9d',
  },
  postTimestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  postMore: {
    padding: 4,
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
  postActions: {
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
  logoutButton: {
    borderColor: '#ff4444',
    backgroundColor: '#2a1f1f',
  },
  logoutButtonText: {
    color: '#ff4444',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
});