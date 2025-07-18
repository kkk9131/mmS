import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Bell, Heart, MessageCircle, UserPlus, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'mention' | 'follow' | 'room_join';
  user: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  postId?: string;
  roomId?: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'like',
    user: 'ゆかちゃん',
    content: 'あなたのポストに共感しました',
    timestamp: '2分前',
    isRead: false,
    postId: '123'
  },
  {
    id: '2',
    type: 'comment',
    user: 'みさき',
    content: '「私も同じ悩み持ってます！」とコメントしました',
    timestamp: '15分前',
    isRead: false,
    postId: '124'
  },
  {
    id: '3',
    type: 'room_join',
    user: 'えみ',
    content: '「夜泣き対策」ルームに参加しました',
    timestamp: '1時間前',
    isRead: true,
    roomId: 'room1'
  },
  {
    id: '4',
    type: 'like',
    user: 'さくら',
    content: 'あなたのポストに共感しました',
    timestamp: '3時間前',
    isRead: true,
    postId: '125'
  },
  {
    id: '5',
    type: 'comment',
    user: 'あい',
    content: '「参考になりました！」とコメントしました',
    timestamp: '1日前',
    isRead: true,
    postId: '126'
  }
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(notifications.map(notification => 
      notification.id === notificationId 
        ? { ...notification, isRead: true }
        : notification
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(notification => 
      ({ ...notification, isRead: true })
    ));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={20} color="#ff6b9d" fill="#ff6b9d" />;
      case 'comment':
        return <MessageCircle size={20} color="#4a9eff" />;
      case 'mention':
        return <MessageCircle size={20} color="#ffa500" />;
      case 'follow':
        return <UserPlus size={20} color="#4ade80" />;
      case 'room_join':
        return <UserPlus size={20} color="#8b5cf6" />;
      default:
        return <Bell size={20} color="#666" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>通知</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={styles.markAllText}>すべて既読</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#666" />
            <Text style={styles.emptyTitle}>通知はありません</Text>
            <Text style={styles.emptyDescription}>
              新しい共感やコメントが届くとここに表示されます
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationItem,
                !notification.isRead && styles.unreadNotification
              ]}
              onPress={() => markAsRead(notification.id)}
            >
              <View style={styles.notificationIcon}>
                {getNotificationIcon(notification.type)}
              </View>
              
              <View style={styles.notificationContent}>
                <Text style={styles.notificationUser}>{notification.user}</Text>
                <Text style={styles.notificationText}>{notification.content}</Text>
                <View style={styles.notificationFooter}>
                  <Clock size={12} color="#666" />
                  <Text style={styles.timestamp}>{notification.timestamp}</Text>
                </View>
              </View>
              
              {!notification.isRead && (
                <View style={styles.unreadDot} />
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {unreadCount > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            未読通知: {unreadCount}件
          </Text>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff6b9d',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 12,
    color: '#ff6b9d',
    fontWeight: '500',
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
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  unreadNotification: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b9d',
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b9d',
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b9d',
    marginLeft: 8,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});