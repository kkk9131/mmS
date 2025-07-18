import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, Search, User, UserPlus, UserMinus, MessageCircle, Heart } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface FollowUser {
  id: string;
  name: string;
  lastActivity: string;
  isFollowing: boolean;
  isFollower: boolean;
  mutualFollows: boolean;
  recentPost?: string;
  isOnline: boolean;
}

const mockFollowing: FollowUser[] = [
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

const mockFollowers: FollowUser[] = [
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
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following');
  const [following, setFollowing] = useState<FollowUser[]>(mockFollowing);
  const [followers, setFollowers] = useState<FollowUser[]>(mockFollowers);
  const [refreshing, setRefreshing] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleFollowToggle = (userId: string) => {
    const updateUser = (users: FollowUser[]) =>
      users.map(user => 
        user.id === userId 
          ? { ...user, isFollowing: !user.isFollowing, mutualFollows: !user.isFollowing && user.isFollower }
          : user
      );

    setFollowing(updateUser(following));
    setFollowers(updateUser(followers));
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

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const currentUsers = activeTab === 'following' ? following : followers;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>フォロー管理</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Search size={24} color="#666" />
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
            <User size={48} color="#666" />
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
                  <User size={32} color="#ff6b9d" />
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
            <Heart size={16} color="#ff6b9d" />
            <Text style={styles.statText}>
              相互フォロー: {following.filter(u => u.mutualFollows).length}人
            </Text>
          </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  searchButton: {
    padding: 8,
    borderRadius: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b9d',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ff6b9d',
    fontWeight: '600',
  },
  userList: {
    flex: 1,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  userDetails: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
    marginRight: 8,
  },
  mutualBadge: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mutualText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  lastActivity: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  recentPost: {
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#ff6b9d',
    padding: 10,
    borderRadius: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unfollowButton: {
    backgroundColor: '#666',
  },
  followerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  removeText: {
    fontSize: 12,
    color: '#888',
  },
  footer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 16,
  },
  statsContainer: {
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
});