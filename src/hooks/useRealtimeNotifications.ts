import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { notificationsApi } from '../store/api/notificationsApi';
import { supabaseClient } from '../services/supabase/client';
import { FeatureFlagsManager } from '../services/featureFlags';
import { Notification as SupabaseNotification } from '../types/supabase';
import { Notification, NotificationType } from '../types/notifications';
import { NotificationUtils, NotificationPresets } from '../utils/notificationUtils';

export interface UseRealtimeNotificationsOptions {
  /**
   * 自動でサブスクライブするかどうか
   */
  autoSubscribe?: boolean;
  
  /**
   * 通知音を有効にするか
   */
  enableSound?: boolean;
  
  /**
   * バイブレーションを有効にするか
   */
  enableVibration?: boolean;
  
  /**
   * フォアグラウンドでも通知を表示するか
   */
  showInForeground?: boolean;
  
  /**
   * 最大未読通知バッジ数
   */
  maxBadgeCount?: number;
  
  /**
   * エラーハンドラー
   */
  onError?: (error: Error, context: string) => void;
  
  /**
   * 新しい通知が届いた時のコールバック
   */
  onNewNotification?: (notification: Notification) => void;
  
  /**
   * デバッグモード
   */
  debug?: boolean;
}

/**
 * 通知のリアルタイム更新を管理するフック
 */
export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const dispatch = useAppDispatch();
  const featureFlags = FeatureFlagsManager.getInstance();
  
  const {
    autoSubscribe = true,
    enableSound = true,
    enableVibration = true,
    showInForeground = true,
    maxBadgeCount = 99,
    onError,
    onNewNotification,
    debug = false
  } = options;
  
  // Local state for unread count and badge
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);
  
  /**
   * ログ出力（デバッグモード時のみ）
   */
  const debugLog = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[RealtimeNotifications] ${message}`, ...args);
    }
  }, [debug]);
  
  /**
   * Supabase通知をアプリ形式に変換
   */
  const transformSupabaseNotification = useCallback((supabaseNotification: SupabaseNotification): Notification => {
    const data = supabaseNotification.data as any || {};
    
    return {
      id: supabaseNotification.id,
      type: supabaseNotification.type as NotificationType,
      title: supabaseNotification.title,
      message: supabaseNotification.message || '',
      data: {
        userId: data.sender_id || '',
        userName: data.sender_name || '',
        userAvatar: data.sender_avatar || '',
        postId: data.post_id || '',
        postContent: data.post_content || '',
        actionUrl: data.action_url || '',
        metadata: data.metadata || {},
      },
      isRead: supabaseNotification.is_read || false,
      createdAt: supabaseNotification.created_at || new Date().toISOString(),
    };
  }, []);
  
  /**
   * 通知音を再生
   */
  const playNotificationSound = useCallback(async (notificationType?: NotificationType) => {
    if (!enableSound) return;
    
    try {
      let preset = NotificationPresets.message; // デフォルト
      
      switch (notificationType) {
        case 'like':
          preset = NotificationPresets.like as any;
          break;
        case 'comment':
          preset = NotificationPresets.comment as any;
          break;
        case 'follow':
          preset = NotificationPresets.follow as any;
          break;
        default:
          preset = NotificationPresets.message;
      }
      
      await NotificationUtils.playNotification({
        sound: enableSound,
        soundType: preset.soundType,
        vibration: false, // バイブレーションは別途実行
        haptics: false,
      });
      
      debugLog(`Playing ${notificationType || 'default'} notification sound`);
    } catch (error) {
      debugLog('Error playing notification sound:', error);
    }
  }, [enableSound, debugLog]);
  
  /**
   * バイブレーション実行
   */
  const triggerVibration = useCallback(async (notificationType?: NotificationType) => {
    if (!enableVibration) return;
    
    try {
      let preset = NotificationPresets.message; // デフォルト
      
      switch (notificationType) {
        case 'like':
          preset = NotificationPresets.like as any;
          break;
        case 'comment':
          preset = NotificationPresets.comment as any;
          break;
        case 'follow':
          preset = NotificationPresets.follow as any;
          break;
        default:
          preset = NotificationPresets.message;
      }
      
      await NotificationUtils.playNotification({
        sound: false, // 音は別途実行
        vibration: enableVibration,
        vibrationPattern: preset.vibrationPattern,
        haptics: enableVibration,
        hapticsIntensity: preset.hapticsIntensity,
      });
      
      debugLog(`Triggering ${notificationType || 'default'} vibration`);
    } catch (error) {
      debugLog('Error triggering vibration:', error);
    }
  }, [enableVibration, debugLog]);
  
  /**
   * フォアグラウンド通知表示
   */
  const showForegroundNotification = useCallback(async (notification: Notification) => {
    if (!showInForeground) return;
    
    try {
      await NotificationUtils.showForegroundNotification({
        title: notification.title,
        message: notification.message,
        data: notification.data,
      });
      
      debugLog('Showing foreground notification:', notification.title);
    } catch (error) {
      debugLog('Error showing foreground notification:', error);
    }
  }, [showInForeground, debugLog]);
  
  /**
   * アプリバッジ更新
   */
  const updateAppBadge = useCallback(async (count: number) => {
    const badgeCount = Math.min(count, maxBadgeCount);
    debugLog('Updating app badge:', badgeCount);
    
    try {
      await NotificationUtils.updateBadgeCount(badgeCount);
      setUnreadCount(badgeCount);
    } catch (error) {
      debugLog('Error updating app badge:', error);
    }
  }, [maxBadgeCount, debugLog]);
  
  /**
   * キャッシュの無効化
   */
  const invalidateNotificationsCache = useCallback(() => {
    debugLog('Invalidating notifications cache');
    dispatch(notificationsApi.util.invalidateTags(['Notification']));
  }, [dispatch, debugLog]);
  
  /**
   * 未読数の更新
   */
  const updateUnreadCount = useCallback(async () => {
    try {
      const currentUser = await supabaseClient.getCurrentUser();
      if (!currentUser) return;
      
      const client = supabaseClient.getClient();
      const { count, error } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
      
      if (error) {
        debugLog('Error fetching unread count:', error);
        return;
      }
      
      const unreadCount = count || 0;
      await updateAppBadge(unreadCount);
      
      // Update Redux cache
      const user = await supabaseClient.getCurrentUser();
      if (user) {
        (dispatch as any)(
          notificationsApi.util.updateQueryData('getUnreadCount', user.id, (draft) => unreadCount)
        );
      }
    } catch (error) {
      debugLog('Error updating unread count:', error);
    }
  }, [updateAppBadge, dispatch, debugLog]);
  
  /**
   * 通知挿入処理
   */
  const handleNotificationInsert = useCallback(async (payload: any) => {
    const supabaseNotification = payload.new as SupabaseNotification;
    debugLog('New notification received:', supabaseNotification.id);
    
    try {
      const notification = transformSupabaseNotification(supabaseNotification);
      setLastNotification(notification);
      
      // Update cache - add to beginning of notifications list
      const currentUser = await supabaseClient.getCurrentUser();
      if (currentUser) {
        (dispatch as any)(
          (notificationsApi.util.updateQueryData as any)(
            'getNotifications', 
            { userId: currentUser.id }, 
            (draft: any) => {
              draft.unshift(notification as any);
            }
          )
        );
      }
      
      // Update unread count
      await updateUnreadCount();
      
      // Trigger notification effects
      if (showInForeground) {
        await Promise.all([
          playNotificationSound(notification.type),
          triggerVibration(notification.type),
          showForegroundNotification(notification)
        ]);
      }
      
      // Call user callback
      onNewNotification?.(notification);
      
    } catch (error) {
      onError?.(error as Error, 'notification-insert');
    }
  }, [transformSupabaseNotification, dispatch, updateUnreadCount, showInForeground, playNotificationSound, triggerVibration, showForegroundNotification, onNewNotification, onError, debugLog]);
  
  /**
   * 通知更新処理（主に既読状態の変更）
   */
  const handleNotificationUpdate = useCallback(async (payload: any) => {
    const supabaseNotification = payload.new as SupabaseNotification;
    debugLog('Notification updated:', supabaseNotification.id);
    
    try {
      const notification = transformSupabaseNotification(supabaseNotification);
      
      // Update cache
      const currentUser = await supabaseClient.getCurrentUser();
      if (currentUser) {
        (dispatch as any)(
          notificationsApi.util.updateQueryData(
            'getNotifications', 
            { userId: currentUser.id }, 
            (draft: any) => {
              const index = draft.findIndex((n: any) => n.id === notification.id);
              if (index !== -1) {
                draft[index] = notification as any;
              }
            }
          )
        );
      }
      
      // Update unread count
      await updateUnreadCount();
      
    } catch (error) {
      onError?.(error as Error, 'notification-update');
    }
  }, [transformSupabaseNotification, dispatch, updateUnreadCount, onError, debugLog]);
  
  /**
   * 通知削除処理
   */
  const handleNotificationDelete = useCallback(async (payload: any) => {
    const deletedNotification = payload.old as SupabaseNotification;
    debugLog('Notification deleted:', deletedNotification.id);
    
    try {
      // Remove from cache
      const currentUser = await supabaseClient.getCurrentUser();
      if (currentUser) {
        (dispatch as any)(
          notificationsApi.util.updateQueryData(
            'getNotifications', 
            { userId: currentUser.id }, 
            (draft: any) => {
              const index = draft.findIndex((n: any) => n.id === deletedNotification.id);
              if (index !== -1) {
                draft.splice(index, 1);
              }
            }
          )
        );
      }
      
      // Update unread count
      await updateUnreadCount();
      
    } catch (error) {
      onError?.(error as Error, 'notification-delete');
    }
  }, [dispatch, updateUnreadCount, onError, debugLog]);
  
  // Setup realtime subscription
  const subscription = useRealtimeSubscription('notifications-realtime', {
    table: 'notifications',
    // Filter will be set dynamically when subscription starts
    onInsert: handleNotificationInsert,
    onUpdate: handleNotificationUpdate,
    onDelete: handleNotificationDelete,
    onError: (error) => onError?.(error, 'notifications-subscription'),
    autoReconnect: true,
    maxReconnectAttempts: 5,
  });
  
  // Initialize unread count on mount
  useEffect(() => {
    if (featureFlags.isSupabaseEnabled()) {
      updateUnreadCount();
    }
  }, [featureFlags, updateUnreadCount]);
  
  // Auto-subscribe if enabled
  useEffect(() => {
    if (autoSubscribe && featureFlags.isSupabaseEnabled()) {
      debugLog('Auto-subscribing to realtime notifications');
      subscription.subscribe();
    }
    
    return () => {
      debugLog('Cleaning up realtime notifications subscription');
      subscription.unsubscribe();
      // Cleanup NotificationUtils
      NotificationUtils.cleanup();
    };
  }, [autoSubscribe, featureFlags, subscription.subscribe, subscription.unsubscribe, debugLog]);
  
  /**
   * 手動で通知を既読にマーク（楽観的更新付き）
   */
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    debugLog('Marking notifications as read:', notificationIds);
    
    // Optimistic update
    try {
      const currentUser = await supabaseClient.getCurrentUser();
      if (currentUser) {
        (dispatch as any)(
          notificationsApi.util.updateQueryData(
            'getNotifications', 
            { userId: currentUser.id }, 
            (draft: any) => {
              draft.forEach((notification: any) => {
                if (notificationIds.includes(notification.id)) {
                  (notification as any).is_read = true;
                }
              });
            }
          )
        );
      }
    } catch (error) {
      debugLog('Error in optimistic update for markAsRead:', error);
    }
    
    // Update app badge immediately
    const newUnreadCount = Math.max(0, unreadCount - notificationIds.length);
    await updateAppBadge(newUnreadCount);
    
    try {
      const currentUser = await supabaseClient.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');
      
      const client = supabaseClient.getClient();
      const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .in('id', notificationIds);
      
      if (error) {
        throw new Error(error.message);
      }
      
      debugLog('Successfully marked notifications as read');
    } catch (error) {
      debugLog('Error marking notifications as read:', error);
      
      // Revert optimistic update
      const currentUser = await supabaseClient.getCurrentUser();
      if (currentUser) {
        (dispatch as any)(
          notificationsApi.util.updateQueryData(
            'getNotifications', 
            { userId: currentUser.id }, 
            (draft: any) => {
              draft.forEach((notification: any) => {
                if (notificationIds.includes(notification.id)) {
                  (notification as any).is_read = false;
                }
              });
            }
          )
        );
      }
      
      // Revert badge update
      await updateAppBadge(unreadCount);
      
      onError?.(error as Error, 'mark-as-read');
    }
  }, [dispatch, unreadCount, updateAppBadge, onError, debugLog]);
  
  /**
   * 全ての通知を既読にマーク
   */
  const markAllAsRead = useCallback(async () => {
    debugLog('Marking all notifications as read');
    
    // Optimistic update
    try {
      const currentUser = await supabaseClient.getCurrentUser();
      if (currentUser) {
        (dispatch as any)(
          notificationsApi.util.updateQueryData(
            'getNotifications', 
            { userId: currentUser.id }, 
            (draft: any) => {
              draft.forEach((notification: any) => {
                (notification as any).is_read = true;
              });
            }
          )
        );
      }
    } catch (error) {
      debugLog('Error in optimistic update for markAllAsRead:', error);
    }
    
    await updateAppBadge(0);
    
    try {
      const currentUser = await supabaseClient.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');
      
      const client = supabaseClient.getClient();
      const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
      
      if (error) {
        throw new Error(error.message);
      }
      
      debugLog('Successfully marked all notifications as read');
    } catch (error) {
      debugLog('Error marking all notifications as read:', error);
      
      // Revert optimistic update and fetch fresh data
      invalidateNotificationsCache();
      await updateUnreadCount();
      
      onError?.(error as Error, 'mark-all-as-read');
    }
  }, [dispatch, updateAppBadge, invalidateNotificationsCache, updateUnreadCount, onError, debugLog]);
  
  return {
    // Subscription management
    subscription,
    isConnected: subscription.connectionStatus.isConnected,
    isConnecting: subscription.connectionStatus.isConnecting,
    connectionError: subscription.connectionStatus.error,
    subscribe: subscription.subscribe,
    unsubscribe: subscription.unsubscribe,
    reconnect: subscription.reconnect,
    
    // Notification state
    unreadCount,
    lastNotification,
    
    // Actions
    markAsRead,
    markAllAsRead,
    updateUnreadCount,
    invalidateCache: invalidateNotificationsCache,
    
    // Settings and utilities
    playSound: playNotificationSound,
    vibrate: triggerVibration,
    updateBadge: updateAppBadge,
    showForeground: showForegroundNotification,
  };
}