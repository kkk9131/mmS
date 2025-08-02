import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, Search, User, UserPlus, UserMinus, MessageCircle, Heart } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FollowService } from '../services/FollowService';
import { FollowUser as FollowUserFromService } from '../types/follow';
import { useTheme } from '../contexts/ThemeContext';
import { FeatureFlagsManager } from '../services/featureFlags';

// 既存UIとの互換性のために、表示用の型を定義
interface DisplayFollowUser {
  id: string;
  name: string;
  lastActivity: string;
  isFollowing: boolean;
  isFollower: boolean;
  mutualFollows: boolean;
  recentPost?: string;
  isOnline: boolean;
  avatar?: string;
}

const mockFollowing: DisplayFollowUser[] = [
  {
    id: '1',
    name: 'ゆかちゃん',
    lastActivity: '2時間前',
    isFollowing: true,
    isFollower: true,
    mutualFollows: true,
    recentPost: '夜泣きの対処法について投稿',
    isOnline: true
  },
  {
    id: '2',
    name: 'さくら',
    lastActivity: '1日前',
    isFollowing: true,
    isFollower: false,
    mutualFollows: false,
    recentPost: '離乳食レシピをシェア',
    isOnline: false
  },
  {
    id: '3',
    name: 'みさき',
    lastActivity: '3日前',
    isFollowing: true,
    isFollower: true,
    mutualFollows: true,
    recentPost: '保育園の送迎について',
    isOnline: true
  },
  {
    id: '4',
    name: 'えみ',
    lastActivity: '1週間前',
    isFollowing: true,
    isFollower: false,
    mutualFollows: false,
    recentPost: '子育てグッズのレビュー',
    isOnline: false
  },
];

const mockFollowers: DisplayFollowUser[] = [
  {
    id: '5',
    name: 'あい',
    lastActivity: '30分前',
    isFollowing: false,
    isFollower: true,
    mutualFollows: false,
    recentPost: 'ママ友作りについて',
    isOnline: true
  },
  {
    id: '6',
    name: 'りか',
    lastActivity: '5時間前',
    isFollowing: true,
    isFollower: true,
    mutualFollows: true,
    recentPost: '初めての言葉について',
    isOnline: false
  },
  {
    id: '1',
    name: 'ゆかちゃん',
    lastActivity: '2時間前',
    isFollowing: true,
    isFollower: true,
    mutualFollows: true,
    recentPost: '夜泣きの対処法について投稿',
    isOnline: true
  },
  {
    id: '7',
    name: 'なな',
    lastActivity: '2日前',
    isFollowing: false,
    isFollower: true,
    mutualFollows: false,
    recentPost: '病気の時の対処法',
    isOnline: false
  },
];

export default function FollowListScreen() {
  const { theme } = useTheme();
  const featureFlags = FeatureFlagsManager.getInstance();
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following');
  const [following, setFollowing] = useState<DisplayFollowUser[]>([]);
  const [followers, setFollowers] = useState<DisplayFollowUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const followService = FollowService.getInstance();

  // サービス層のデータを表示用の形式に変換
  const convertToDisplayFollowUser = (serviceUser: FollowUserFromService): DisplayFollowUser => {
    // タイムスタンプを相対的な時間表示に変換
    const getRelativeTime = (dateString?: string): string => {
      if (!dateString) return '不明';
      const now = new Date();
      const past = new Date(dateString);
      const diffMs = now.getTime() - past.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHours < 1) return '1時間未満';
      if (diffHours < 24) return `${diffHours}時間前`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}日前`;
    };

    return {
      id: serviceUser.id,
      name: serviceUser.nickname,
      lastActivity: getRelativeTime(serviceUser.followedAt),
      isFollowing: serviceUser.isFollowing,
      isFollower: serviceUser.isFollowedBy,
      mutualFollows: serviceUser.isFollowing && serviceUser.isFollowedBy,
      recentPost: undefined, // API仕様に含まれていないため省略
      isOnline: Math.random() > 0.5, // モック値（API仕様に含まれていないため）
      avatar: serviceUser.avatar,
    };
  };

  // フォロー中ユーザー一覧を取得
  const fetchFollowing = async () => {
    try {
      if (featureFlags.isDebugModeEnabled()) {
        console.log('📡 フォロー中ユーザー一覧を取得中...');
      }
      const response = await followService.getFollowing(undefined, 1, 100);
      if (featureFlags.isDebugModeEnabled()) {
        console.log('✅ フォロー中ユーザー取得成功:', response.users.length, '人');
      }
      const displayUsers = response.users.map(convertToDisplayFollowUser);
      setFollowing(displayUsers);
    } catch (error) {
      console.error('❌ フォロー中ユーザー取得失敗:', error);
      // エラー時はモックデータを使用
      if (featureFlags.isDebugModeEnabled()) {
        console.log('🔄 モックデータを使用');
      }
      setFollowing(mockFollowing);
    }
  };

  // フォロワー一覧を取得
  const fetchFollowers = async () => {
    try {
      if (featureFlags.isDebugModeEnabled()) {
        console.log('📡 フォロワー一覧を取得中...');
      }
      const response = await followService.getFollowers(undefined, 1, 100);
      if (featureFlags.isDebugModeEnabled()) {
        console.log('✅ フォロワー取得成功:', response.users.length, '人');
      }
      const displayUsers = response.users.map(convertToDisplayFollowUser);
      setFollowers(displayUsers);
    } catch (error) {
      console.error('❌ フォロワー取得失敗:', error);
      // エラー時はモックデータを使用
      if (featureFlags.isDebugModeEnabled()) {
        console.log('🔄 モックデータを使用');
      }
      setFollowers(mockFollowers);
    }
  };

  // 両方のリストを取得
  const fetchFollowData = async () => {
    try {
      if (featureFlags.isDebugModeEnabled()) {
        console.log('📊 フォローデータ取得開始');
      }
      setLoading(true);
      await Promise.all([fetchFollowing(), fetchFollowers()]);
      if (featureFlags.isDebugModeEnabled()) {
        console.log('✅ フォローデータ取得完了');
      }
    } catch (error) {
      console.error('❌ フォローデータ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード時にデータを取得
  useEffect(() => {
    fetchFollowData();
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleFollowToggle = async (userId: string) => {
    if (featureFlags.isDebugModeEnabled()) {
      console.log('🚀 フォローボタンクリック:', userId);
    }
    
    // フォロー状態を取得
    const followingUser = following.find(u => u.id === userId);
    const followerUser = followers.find(u => u.id === userId);
    const currentUser = followingUser || followerUser;
    
    if (featureFlags.isDebugModeEnabled()) {
      console.log('👤 対象ユーザー:', currentUser);
      console.log('📊 現在のフォロー状態:', currentUser?.isFollowing);
    }
    
    if (!currentUser) {
      console.error('❌ 対象ユーザーが見つかりません:', userId);
      return;
    }

    const willFollow = !currentUser.isFollowing;
    if (featureFlags.isDebugModeEnabled()) {
      console.log('🎯 実行予定の操作:', willFollow ? 'フォロー' : 'フォロー解除');
    }

    // 楽観的更新: UIを即座に更新
    const updateUser = (users: DisplayFollowUser[]) =>
      users.map(user => 
        user.id === userId 
          ? { ...user, isFollowing: willFollow, mutualFollows: willFollow && user.isFollower }
          : user
      );

    if (featureFlags.isDebugModeEnabled()) {
      console.log('🔄 UI楽観的更新実行');
    }
    setFollowing(updateUser(following));
    setFollowers(updateUser(followers));

    try {
      if (featureFlags.isDebugModeEnabled()) {
        console.log('📡 FollowService API呼び出し開始');
      }
      
      if (willFollow) {
        if (featureFlags.isDebugModeEnabled()) {
          console.log('➡️ followUser API呼び出し:', userId);
        }
        const result = await followService.followUser(userId);
        if (featureFlags.isDebugModeEnabled()) {
          console.log('✅ followUser API成功:', result);
        }
        followService.optimisticallyUpdateFollow(userId, true);
      } else {
        if (featureFlags.isDebugModeEnabled()) {
          console.log('➡️ unfollowUser API呼び出し:', userId);
        }
        const result = await followService.unfollowUser(userId);
        console.log('✅ unfollowUser API成功:', result);
        followService.optimisticallyUpdateFollow(userId, false);
      }
      
      console.log('🎉 フォロー操作完了');
    } catch (error) {
      console.error('❌ フォロー操作エラー:', error);
      if (featureFlags.isDebugModeEnabled()) {
        console.error('❌ エラー詳細:', JSON.stringify(error, null, 2));
        console.error('❌ エラータイプ:', typeof error);
        console.error('❌ エラーメッセージ:', (error as any)?.message);
        console.error('❌ エラースタック:', (error as any)?.stack);
      }
      
      // エラー時はUIをロールバック
      if (featureFlags.isDebugModeEnabled()) {
        console.log('🔄 UIロールバック実行');
      }
      const rollbackUser = (users: DisplayFollowUser[]) =>
        users.map(user => 
          user.id === userId 
            ? { ...user, isFollowing: !willFollow, mutualFollows: !willFollow && user.isFollower }
            : user
        );

      setFollowing(rollbackUser(following));
      setFollowers(rollbackUser(followers));
      
      Alert.alert(
        'エラー', 
        `${willFollow ? 'フォロー' : 'フォロー解除'}に失敗しました\n\n詳細: ${(error as any)?.message || 'Unknown error'}`
      );
    }
  };

  const handleChatPress = (userId: string, userName: string) => {
    router.push({
      pathname: '/chat',
      params: { userId, userName }
    });
  };

  const handleRemoveFollower = (userId: string) => {
    Alert.alert(
      'フォロワーを削除',
      'このユーザーをフォロワーから削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除', 
          style: 'destructive',
          onPress: () => {
            setFollowers(followers.filter(user => user.id !== userId));
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchFollowData();
    } catch (error) {
      if (featureFlags.isDebugModeEnabled()) {
        console.error('Failed to refresh follow data:', error);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const styles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 8,
      borderRadius: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600' as const,
      color: theme.colors.text.primary,
    },
    searchButton: {
      padding: 8,
      borderRadius: 8,
    },
    tabContainer: {
      flexDirection: 'row' as const,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center' as const,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 16,
      color: theme.colors.text.disabled,
      fontWeight: '500' as const,
    },
    activeTabText: {
      color: theme.colors.primary,
      fontWeight: '600' as const,
    },
    userList: {
      flex: 1,
    },
    emptyState: {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 40,
      minHeight: 200,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: theme.colors.text.primary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    userItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    userInfo: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      flex: 1,
    },
    avatarContainer: {
      position: 'relative' as const,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.colors.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 12,
    },
    onlineIndicator: {
      position: 'absolute' as const,
      bottom: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#4ade80',
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    userDetails: {
      flex: 1,
    },
    userHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginBottom: 4,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: theme.colors.text.primary,
      marginRight: 8,
    },
    mutualBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    mutualText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '500' as const,
    },
    lastActivity: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 4,
    },
    recentPost: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      fontStyle: 'italic' as const,
    },
    actionButtons: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    chatButton: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      marginRight: 8,
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    followButton: {
      backgroundColor: theme.colors.primary,
      padding: 10,
      borderRadius: 8,
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    unfollowButton: {
      backgroundColor: theme.colors.text.disabled,
    },
    followerActions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    removeButton: {
      backgroundColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      marginLeft: 8,
    },
    removeText: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      padding: 16,
    },
    statsContainer: {
      alignItems: 'center' as const,
    },
    statItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    statText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 8,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center' as const,
    },
  };

  const currentUsers = activeTab === 'following' ? following : followers;

  // ローディング状態の表示
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>フォロー管理</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>フォロー情報を読み込んでいます...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>フォロー管理</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Search size={24} color={theme.colors.text.disabled} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'following' && styles.activeTab]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
            フォロー中 ({following.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
          onPress={() => setActiveTab('followers')}
        >
          <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
            フォロワー ({followers.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.userList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
        }
      >
        {currentUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={48} color={theme.colors.text.disabled} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'following' ? 'フォロー中のユーザーがいません' : 'フォロワーがいません'}
            </Text>
            <Text style={styles.emptyDescription}>
              {activeTab === 'following' 
                ? '気になるママたちをフォローしてみましょう'
                : 'ポストを続けてフォロワーを増やしましょう'
              }
            </Text>
          </View>
        ) : (
          currentUsers.map((user) => (
            <View key={user.id} style={styles.userItem}>
              <View style={styles.userInfo}>
                <View style={styles.avatarContainer}>
                  <User size={32} color={theme.colors.primary} />
                  {user.isOnline && <View style={styles.onlineIndicator} />}
                </View>
                
                <View style={styles.userDetails}>
                  <View style={styles.userHeader}>
                    <Text style={styles.userName}>{user.name}</Text>
                    {user.mutualFollows && (
                      <View style={styles.mutualBadge}>
                        <Text style={styles.mutualText}>相互</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.lastActivity}>最終活動: {user.lastActivity}</Text>
                  
                  {user.recentPost && (
                    <Text style={styles.recentPost} numberOfLines={1}>
                      {user.recentPost}
                    </Text>
                  )}
                </View>
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => handleChatPress(user.id, user.name)}
                >
                  <MessageCircle size={20} color="#4a9eff" />
                </TouchableOpacity>
                
                {activeTab === 'following' ? (
                  <TouchableOpacity
                    style={[styles.followButton, user.isFollowing && styles.unfollowButton]}
                    onPress={() => handleFollowToggle(user.id)}
                  >
                    {user.isFollowing ? (
                      <UserMinus size={20} color="#fff" />
                    ) : (
                      <UserPlus size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.followerActions}>
                    {!user.isFollowing && (
                      <TouchableOpacity
                        style={styles.followButton}
                        onPress={() => handleFollowToggle(user.id)}
                      >
                        <UserPlus size={20} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveFollower(user.id)}
                    >
                      <Text style={styles.removeText}>削除</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Heart size={16} color={theme.colors.primary} />
            <Text style={styles.statText}>
              相互フォロー: {following.filter(u => u.mutualFollows).length}人
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

