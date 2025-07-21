import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, User, MessageCircle, UserPlus, UserMinus, Heart, Calendar, MapPin, Share, MoveHorizontal as MoreHorizontal, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
  id: string;
  name: string;
  bio: string;
  location: string;
  joinDate: string;
  postCount: number;
  followingCount: number;
  followerCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  isOnline: boolean;
  lastActivity: string;
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

const mockUserProfile: UserProfile = {
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
  isOnline: true,
  lastActivity: '2時間前'
};

const mockOwnProfile: UserProfile = {
  id: 'own',
  name: 'みさき',
  bio: '新米ママです！みんなのアドバイスに助けられています。よろしくお願いします♪',
  location: '神奈川県',
  joinDate: '2024年1月',
  postCount: 18,
  followingCount: 67,
  followerCount: 89,
  isFollowing: false,
  isOwnProfile: true,
  isOnline: true,
  lastActivity: '現在'
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
  
  // 自分のプロフィールかどうかを判定
  const isOwnProfile = !userId || userId === 'own';
  const [profile, setProfile] = useState<UserProfile>(isOwnProfile ? { ...mockOwnProfile, name: user?.nickname || mockOwnProfile.name } : mockUserProfile);
  const [posts, setPosts] = useState<UserPost[]>(mockUserPosts);
  const [refreshing, setRefreshing] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleFollow = () => {
    if (profile.isOwnProfile) return;
    
    setProfile(prev => ({
      ...prev,
      isFollowing: !prev.isFollowing,
      followerCount: prev.isFollowing ? prev.followerCount - 1 : prev.followerCount + 1
    }));
  };

  const handleMessage = () => {
    router.push({
      pathname: '/chat',
      params: { userId: profile.id, userName: profile.name }
    });
  };

  const handleShare = () => {
    Alert.alert('プロフィールを共有', 'プロフィールのリンクをコピーしました');
  };

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{profile.name}</Text>
          <Text style={styles.headerSubtitle}>{profile.postCount} ポスト</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
        }
      >
        {/* プロフィール情報 */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <User size={60} color="#ff6b9d" />
              {profile.isOnline && <View style={styles.onlineIndicator} />}
            </View>
            
            <View style={styles.profileActions}>
              {profile.isOwnProfile ? (
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => router.push('/profile-edit')}
                >
                  <Text style={styles.editButtonText}>プロフィール編集</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                    <MessageCircle size={18} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followButton, profile.isFollowing && styles.followingButton]}
                    onPress={handleFollow}
                  >
                    {profile.isFollowing ? (
                      <>
                        <UserMinus size={18} color="#666" />
                        <Text style={[styles.followButtonText, styles.followingText]}>フォロー中</Text>
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
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileBio}>{profile.bio}</Text>
            
            <View style={styles.profileMeta}>
              <View style={styles.metaItem}>
                <MapPin size={16} color="#666" />
                <Text style={styles.metaText}>{profile.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Calendar size={16} color="#666" />
                <Text style={styles.metaText}>{profile.joinDate}から利用</Text>
              </View>
              {!profile.isOwnProfile && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaText}>最終活動: {profile.lastActivity}</Text>
                </View>
              )}
            </View>

            <View style={styles.statsContainer}>
              {profile.isOwnProfile && (
                <View style={styles.activityButtons}>
                  <TouchableOpacity 
                    style={styles.activityButton}
                    onPress={() => router.push('/liked-posts')}
                  >
                    <Heart size={16} color="#ff6b9d" />
                    <Text style={styles.activityButtonText}>共感履歴</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.activityButton}
                    onPress={() => router.push('/follow-list')}
                  >
                    <User size={16} color="#ff6b9d" />
                    <Text style={styles.activityButtonText}>フォロー管理</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.activityButton, styles.logoutButton]}
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
          <Text style={styles.postsTitle}>ポスト</Text>
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={48} color="#666" />
              <Text style={styles.emptyTitle}>まだポストがありません</Text>
              <Text style={styles.emptyDescription}>
                {profile.isOwnProfile ? '最初のポストを作成してみませんか？' : 'このユーザーはまだポストしていません'}
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.postUser}>
                    <User size={32} color="#ff6b9d" />
                    <View style={styles.postUserInfo}>
                      <Text style={styles.postUserName}>{profile.name}</Text>
                      <Text style={styles.postTimestamp}>{post.timestamp}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.postMore}>
                    <MoreHorizontal size={20} color="#666" />
                  </TouchableOpacity>
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
                
                <View style={styles.postActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && styles.likedButton]}
                    onPress={() => handleLike(post.id)}
                  >
                    <Heart size={20} color={post.isLiked ? '#ff6b9d' : '#666'} fill={post.isLiked ? '#ff6b9d' : 'none'} />
                    <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                      {post.likes}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <MessageCircle size={20} color="#666" />
                    <Text style={styles.actionText}>{post.comments}</Text>
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
});