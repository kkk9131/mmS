import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Bell, Heart, MessageCircle, UserPlus, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
// import { notificationsApi } from '../../store/api/notificationsApi'; // Supabase無効時は使用しない
// import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'; // リアルタイム機能は一時無効
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Notification as NotificationTypeFromService } from '../../types/notifications';

// 既存UIとの互換性のために、表示用の型を定義
interface DisplayNotification {
  id: string;
  type: 'like' | 'comment' | 'mention' | 'follow' | 'room_join';
  user: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  postId?: string;
  roomId?: string;
}

const mockNotifications: DisplayNotification[] = [
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
  const dispatch = useAppDispatch();
  const { handPreference } = useHandPreference();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [localNotifications, setLocalNotifications] = useState(mockNotifications);

  // Mock data for now (Supabase is disabled)
  const notificationsData = localNotifications;
  const notificationsError = null;
  const notificationsLoading = false;
  const unreadCount = localNotifications.filter(n => !n.isRead).length;
  
  // Mock functions
  const refetchNotifications = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };
  
  // Real-time notifications (disabled for now)
  // const realtimeNotifications = useRealtimeNotifications({
  //   autoSubscribe: false,
  //   enableSound: true,
  //   enableVibration: true,
  //   showInForeground: false, // Don't show banner on notification screen
  //   debug: __DEV__,
  //   onError: (error, context) => {
  //     console.error(`[RealtimeNotifications] ${context}:`, error);
  //   }
  // });

  // タイムスタンプを相対的な時間表示に変換
  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return '今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  };
  
  // サービス層の通知データを表示用の形式に変換
  const convertToDisplayNotification = (serviceNotification: NotificationTypeFromService): DisplayNotification => {
    // 通知タイプのマッピング
    let type: DisplayNotification['type'] = 'like';
    switch (serviceNotification.type) {
      case 'like':
        type = 'like';
        break;
      case 'comment':
        type = 'comment';
        break;
      case 'mention':
        type = 'mention';
        break;
      case 'follow':
        type = 'follow';
        break;
      default:
        type = 'like';
        break;
    }

    return {
      id: serviceNotification.id,
      type,
      user: serviceNotification.data.userName || 'ユーザー',
      content: serviceNotification.message,
      timestamp: getRelativeTime(serviceNotification.createdAt),
      isRead: serviceNotification.isRead,
      postId: serviceNotification.data.postId,
    };
  };

  // Use local notifications directly
  const notifications = localNotifications;
  
  // Loading and error states
  const loading = false;
  const error = null;

  const onRefresh = async () => {
    await refetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    // Mock local update
    setLocalNotifications(prevNotifications =>
      prevNotifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = async () => {
    // Mock local update
    setLocalNotifications(prevNotifications =>
      prevNotifications.map(notification => ({ ...notification, isRead: true }))
    );
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

  // 動的スタイル
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    connectionStatus: {
      fontSize: 10,
      color: theme.colors.text.secondary,
      marginRight: 8,
    },
    markAllButton: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    markAllText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    unreadNotification: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    notificationUser: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    notificationText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
      marginBottom: 6,
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.text.disabled,
      marginLeft: 4,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginLeft: 8,
      marginTop: 8,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      textAlign: 'center',
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
    loadingText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
  });

  // ローディング状態を表示
  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>通知</Text>
          <View style={styles.headerRight}>
            <Text style={dynamicStyles.connectionStatus}>
              🔴 オフライン（開発モード）
            </Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={dynamicStyles.loadingText}>通知を読み込んでいます...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={[dynamicStyles.header, styles.headerContainer]}>
        {handPreference === 'right' ? (
          // 右利き：「すべて既読」を左、「通知」を右に配置
          <>
            {/* 左端：すべて既読ボタンエリア */}
            <View style={styles.headerAbsoluteLeft}>
              <Text style={dynamicStyles.connectionStatus}>
                🔴 オフライン（開発モード）
              </Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={dynamicStyles.markAllButton}>
                  <Text style={dynamicStyles.markAllText}>すべて既読</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* 右端：通知タイトル */}
            <View style={styles.headerAbsoluteRight}>
              <Text style={dynamicStyles.headerTitle}>通知</Text>
            </View>
          </>
        ) : (
          // 左利き：「通知」を左、「すべて既読」を右に配置（元の配置）
          <>
            {/* 左端：通知タイトル */}
            <View style={styles.headerAbsoluteLeft}>
              <Text style={dynamicStyles.headerTitle}>通知</Text>
            </View>
            {/* 右端：すべて既読ボタンエリア */}
            <View style={styles.headerAbsoluteRight}>
              <Text style={dynamicStyles.connectionStatus}>
                🔴 オフライン（開発モード）
              </Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={dynamicStyles.markAllButton}>
                  <Text style={dynamicStyles.markAllText}>すべて既読</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        renderItem={({ item: notification }) => (
          <TouchableOpacity
            style={[
              dynamicStyles.notificationItem,
              !notification.isRead && dynamicStyles.unreadNotification
            ]}
            onPress={() => markAsRead(notification.id)}
          >
            <View style={styles.notificationIcon}>
              {getNotificationIcon(notification.type)}
            </View>
            
            <View style={styles.notificationContent}>
              <Text style={dynamicStyles.notificationUser}>{notification.user}</Text>
              <Text style={dynamicStyles.notificationText}>{notification.content}</Text>
              <View style={styles.notificationFooter}>
                <Clock size={12} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.timestamp}>{notification.timestamp}</Text>
              </View>
            </View>
            
            {!notification.isRead && (
              <View style={dynamicStyles.unreadDot} />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Bell size={48} color={theme.colors.text.disabled} />
            <Text style={dynamicStyles.emptyTitle}>通知はありません</Text>
            <Text style={dynamicStyles.emptyDescription}>
              新しい共感やコメントが届くとここに表示されます
            </Text>
          </View>
        )}
      />

      {unreadCount > 0 && (
        <View style={dynamicStyles.footer}>
          <Text style={dynamicStyles.footerText}>
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
  headerContainer: {
    position: 'relative',
    minHeight: 60,
  },
  headerAbsoluteLeft: {
    position: 'absolute',
    left: 20,
    top: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  headerAbsoluteRight: {
    position: 'absolute',
    right: 20,
    top: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionStatus: {
    fontSize: 10,
    color: '#888',
    marginRight: 8,
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