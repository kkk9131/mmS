import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { ArrowLeft, Search, MessageCircle, Clock, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface ChatUser {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
}

const mockChatUsers: ChatUser[] = [
  {
    id: '1',
    name: 'ゆかちゃん',
    lastMessage: 'ありがとうございます！本当に助かりました',
    lastMessageTime: '5分前',
    unreadCount: 2,
    isOnline: true
  },
  {
    id: '2',
    name: 'さくら',
    lastMessage: '離乳食のレシピ教えてくれてありがとう',
    lastMessageTime: '1時間前',
    unreadCount: 0,
    isOnline: false
  },
  {
    id: '3',
    name: 'みさき',
    lastMessage: '今度また相談に乗ってください',
    lastMessageTime: '昨日',
    unreadCount: 1,
    isOnline: true
  },
  {
    id: '4',
    name: 'えみ',
    lastMessage: '夜泣きの件、どうでしたか？',
    lastMessageTime: '2日前',
    unreadCount: 0,
    isOnline: false
  },
  {
    id: '5',
    name: 'あい',
    lastMessage: 'お疲れ様でした！',
    lastMessageTime: '1週間前',
    unreadCount: 0,
    isOnline: false
  }
];

export default function ChatListScreen() {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>(mockChatUsers);
  const [refreshing, setRefreshing] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleChatPress = (userId: string, userName: string) => {
    // 未読数をリセット
    setChatUsers(chatUsers.map(user => 
      user.id === userId ? { ...user, unreadCount: 0 } : user
    ));
    
    // チャット画面に移動
    router.push({
      pathname: '/chat',
      params: { userId, userName }
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const totalUnread = chatUsers.reduce((sum, user) => sum + user.unreadCount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>チャット</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Search size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {totalUnread > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>
            未読メッセージ: {totalUnread}件
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.chatList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
        }
      >
        {chatUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageCircle size={48} color="#666" />
            <Text style={styles.emptyTitle}>チャットがありません</Text>
            <Text style={styles.emptyDescription}>
              ポストにコメントをすると、ママたちとチャットを始めることができます
            </Text>
          </View>
        ) : (
          chatUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.chatItem}
              onPress={() => handleChatPress(user.id, user.name)}
            >
              <View style={styles.avatarContainer}>
                <User size={32} color="#ff6b9d" />
                {user.isOnline && <View style={styles.onlineIndicator} />}
              </View>
              
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/profile', params: { userId: user.id } })}>
                    <Text style={styles.userName}>{user.name}</Text>
                  </TouchableOpacity>
                  <Text style={styles.lastMessageTime}>{user.lastMessageTime}</Text>
                </View>
                
                <View style={styles.messagePreview}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {user.lastMessage}
                  </Text>
                  {user.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>
                        {user.unreadCount > 99 ? '99+' : user.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ママたちと安心して個人的な相談ができます
        </Text>
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
  unreadBanner: {
    backgroundColor: '#ff6b9d',
    padding: 12,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  chatList: {
    flex: 1,
    backgroundColor: '#121212',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
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
    borderColor: '#fff',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#888',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#aaa',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#ff6b9d',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadCount: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});