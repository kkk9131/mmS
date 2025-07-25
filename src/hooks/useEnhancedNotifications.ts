import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationsAsReadMutation,
  useRegisterPushTokenMutation,
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  notificationRealtimeManager,
} from '../store/api/notificationsApi';
import { notificationService } from '../services/notifications/NotificationService';
import { notificationQueueManager } from '../services/notifications/NotificationQueueManager';
import { badgeManager } from '../services/notifications/BadgeManager';
import { notificationErrorHandler } from '../services/notifications/ErrorHandler';
import { notificationPerformanceOptimizer } from '../services/notifications/PerformanceOptimizer';

// Timer型の定義
type Timer = ReturnType<typeof setInterval>;

interface UseEnhancedNotificationsOptions {
  autoInitialize?: boolean;
  enableRealtime?: boolean;
  enableQueueProcessing?: boolean;
  enablePerformanceOptimization?: boolean;
  cacheNotifications?: boolean;
  batchReadOperations?: boolean;
}

interface NotificationState {
  isInitialized: boolean;
  isOnline: boolean;
  lastSyncTime: string | null;
  queuedNotifications: number;
  pendingOperations: number;
}

export function useEnhancedNotifications(options: UseEnhancedNotificationsOptions = {}) {
  const {
    autoInitialize = true,
    enableRealtime = true,
    enableQueueProcessing = true,
    enablePerformanceOptimization = true,
    cacheNotifications = true,
    batchReadOperations = true,
  } = options;

  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  
  // Internal state
  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    isOnline: true,
    lastSyncTime: null,
    queuedNotifications: 0,
    pendingOperations: 0,
  });

  // Refs for cleanup
  const realtimeUnsubscribe = useRef<(() => void) | null>(null);
  const appStateSubscription = useRef<any>(null);
  const queueInterval = useRef<Timer | null>(null);

  // API hooks with performance optimization
  const {
    data: notifications,
    isLoading: notificationsLoading,
    error: notificationsError,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery(
    { userId: user?.id || '', offset: 0, limit: cacheNotifications ? 50 : 20 },
    {
      skip: !user?.id,
      pollingInterval: enableRealtime ? 0 : 30000, // 30秒ポーリング（リアルタイム無効時）
    }
  );

  const {
    data: unreadCount,
    isLoading: unreadCountLoading,
    refetch: refetchUnreadCount,
  } = useGetUnreadCountQuery(user?.id || '', {
    skip: !user?.id,
    pollingInterval: enableRealtime ? 0 : 15000, // 15秒ポーリング
  });

  const {
    data: settings,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = useGetNotificationSettingsQuery(user?.id || '', {
    skip: !user?.id,
  });

  // Mutations with error handling
  const [markAsRead] = useMarkNotificationsAsReadMutation();
  const [markAllAsRead] = useMarkNotificationsAsReadMutation();
  const [registerPushToken] = useRegisterPushTokenMutation();
  const [updateSettings] = useUpdateNotificationSettingsMutation();

  // Enhanced initialization
  const initializeNotifications = useCallback(async () => {
    if (!user?.id || state.isInitialized) return;

    try {
      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations + 1 }));

      // 1. プッシュ通知の初期化
      await notificationService.initializePushNotifications(user.id);

      // 2. プッシュトークンの登録
      await registerPushToken();

      // 3. バッジマネージャーの初期化
      await badgeManager.updateBadgeCount();

      // 4. パフォーマンス最適化の開始
      if (enablePerformanceOptimization) {
        await notificationPerformanceOptimizer.adjustConfigBasedOnPerformance();
      }

      // 5. キュー処理の開始
      if (enableQueueProcessing) {
        await startQueueProcessing();
      }

      // 6. リアルタイム接続の開始
      if (enableRealtime) {
        await startRealtimeSubscription();
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        lastSyncTime: new Date().toISOString(),
        pendingOperations: prev.pendingOperations - 1,
      }));

      console.log('拡張通知システムの初期化が完了しました');
    } catch (error) {
      console.error('通知システム初期化エラー:', error);
      
      // エラーハンドリング
      await notificationErrorHandler.handleError(error as Error, {
        userId: user.id,
        operation: 'initialization',
      });

      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations - 1 }));
    }
  }, [user?.id, state.isInitialized, enableRealtime, enableQueueProcessing, enablePerformanceOptimization]);

  // Realtime subscription management
  const startRealtimeSubscription = useCallback(async () => {
    if (!user?.id || realtimeUnsubscribe.current) return;

    try {
      realtimeUnsubscribe.current = notificationRealtimeManager.subscribe(
        user.id,
        async (notification) => {
          console.log('リアルタイム通知受信:', notification);

          // バッジ数を更新
          await badgeManager.handleNotificationReceived(notification.type);

          // キャッシュを無効化
          if (cacheNotifications) {
            await notificationPerformanceOptimizer.cacheInvalidate('notifications');
          }

          // 通知数をリフレッシュ
          refetchNotifications();
          refetchUnreadCount();

          // アプリがバックグラウンドの場合は何もしない（プッシュ通知で処理される）
          if (AppState.currentState !== 'active') {
            return;
          }

          // アプリ内通知の表示
          showInAppNotification(notification);
        }
      );

      console.log('リアルタイム通知の監視を開始しました');
    } catch (error) {
      console.error('リアルタイム購読エラー:', error);
    }
  }, [user?.id, cacheNotifications]);

  // Queue processing management
  const startQueueProcessing = useCallback(async () => {
    if (!enableQueueProcessing || queueInterval.current) return;

    queueInterval.current = setInterval(async () => {
      try {
        const stats = await notificationQueueManager.getQueueStats();
        setState(prev => ({ ...prev, queuedNotifications: stats.totalPending }));

        if (stats.totalPending > 0) {
          await notificationQueueManager.processBatch(5);
          console.log(`キュー処理完了: ${stats.totalPending}件処理`);
        }
      } catch (error) {
        console.error('キュー処理エラー:', error);
      }
    }, 10000); // 10秒ごと

    console.log('通知キュー処理を開始しました');
  }, [enableQueueProcessing]);

  // Enhanced notification reading with batching
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations + 1 }));

      if (batchReadOperations) {
        // バッチ処理のために少し遅延
        setTimeout(async () => {
          await markAsRead({ userId: user?.id || '', notificationIds: [notificationId] });
          await badgeManager.handleNotificationRead([notificationId]);
        }, 100);
      } else {
        await markAsRead({ userId: user?.id || '', notificationIds: [notificationId] });
        await badgeManager.handleNotificationRead([notificationId]);
      }

      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations - 1 }));
    } catch (error) {
      console.error('通知既読処理エラー:', error);
      
      await notificationErrorHandler.handleError(error as Error, {
        userId: user?.id,
        notificationId,
        operation: 'mark_as_read',
      });

      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations - 1 }));
    }
  }, [batchReadOperations, markAsRead, user?.id]);

  // Enhanced mark all as read
  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations + 1 }));

      await markAllAsRead({ userId: user?.id || '', notificationIds: [] });
      await badgeManager.handleAllNotificationsRead();

      // キャッシュを更新
      if (cacheNotifications) {
        await notificationPerformanceOptimizer.cacheInvalidate('notifications');
      }

      setState(prev => ({
        ...prev,
        pendingOperations: prev.pendingOperations - 1,
        lastSyncTime: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('全既読処理エラー:', error);
      
      await notificationErrorHandler.handleError(error as Error, {
        userId: user?.id,
        operation: 'mark_all_as_read',
      });

      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations - 1 }));
    }
  }, [markAllAsRead, user?.id, cacheNotifications]);

  // Enhanced settings update with validation
  const updateNotificationSettings = useCallback(async (newSettings: any) => {
    try {
      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations + 1 }));

      // レート制限チェック
      const canUpdate = await notificationPerformanceOptimizer.checkRateLimit(
        'settingsUpdate',
        user?.id
      );

      if (!canUpdate) {
        throw new Error('設定更新のレート制限に達しました。しばらく待ってから再試行してください。');
      }

      await updateSettings({
        userId: user?.id || '',
        settings: newSettings,
      });

      // 設定キャッシュを無効化
      await notificationPerformanceOptimizer.cacheInvalidate('settings');

      setState(prev => ({
        ...prev,
        pendingOperations: prev.pendingOperations - 1,
        lastSyncTime: new Date().toISOString(),
      }));

      console.log('通知設定を更新しました:', newSettings);
    } catch (error) {
      console.error('設定更新エラー:', error);
      
      await notificationErrorHandler.handleError(error as Error, {
        userId: user?.id,
        operation: 'update_settings',
        metadata: { newSettings },
      });

      setState(prev => ({ ...prev, pendingOperations: prev.pendingOperations - 1 }));
      throw error;
    }
  }, [updateSettings, user?.id]);

  // Network status monitoring
  const handleNetworkChange = useCallback((isConnected: boolean) => {
    setState(prev => {
      const wasOffline = !prev.isOnline;
      
      if (isConnected && wasOffline) {
        // オンラインに復帰した場合
        console.log('ネットワーク復帰 - データを同期中...');
        
        // データの再同期
        setTimeout(() => {
          refetchNotifications();
          refetchUnreadCount();
          refetchSettings();

          // 失敗したキューアイテムを再試行
          if (enableQueueProcessing) {
            notificationQueueManager.retryFailedNotifications();
          }

          setState(prev => ({ ...prev, lastSyncTime: new Date().toISOString() }));
        }, 0);
      }
      
      return { ...prev, isOnline: isConnected };
    });
  }, [enableQueueProcessing, refetchNotifications, refetchUnreadCount, refetchSettings]);

  // App state change handling
  const handleAppStateChange = useCallback(async (nextAppState: string) => {
    if (nextAppState === 'active') {
      // アプリがフォアグラウンドになった時
      console.log('アプリがアクティブになりました - 通知を同期中...');

      // バッジ数を更新
      await badgeManager.updateBadgeCount();

      // データを再同期
      refetchNotifications();
      refetchUnreadCount();

      setState(prev => ({ ...prev, lastSyncTime: new Date().toISOString() }));
    } else if (nextAppState === 'background') {
      // アプリがバックグラウンドになった時
      console.log('アプリがバックグラウンドになりました');

      // パフォーマンス最適化
      if (enablePerformanceOptimization) {
        await notificationPerformanceOptimizer.optimizeMemoryUsage();
      }
    }
  }, [enablePerformanceOptimization, refetchNotifications, refetchUnreadCount]);

  // アプリ内通知表示
  const showInAppNotification = useCallback((notification: any) => {
    // カスタムのアプリ内通知UIを表示
    // 実装はUIライブラリに依存
    console.log('アプリ内通知表示:', notification);
  }, []);

  // Effect for initialization
  useEffect(() => {
    if (autoInitialize && user?.id && !state.isInitialized) {
      initializeNotifications();
    }
  }, [autoInitialize, user?.id, state.isInitialized, initializeNotifications]);

  // Effect for app state monitoring
  useEffect(() => {
    appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
    };
  }, [handleAppStateChange]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // リアルタイム購読をクリーンアップ
      if (realtimeUnsubscribe.current) {
        realtimeUnsubscribe.current();
        realtimeUnsubscribe.current = null;
      }

      // キュー処理をクリーンアップ
      if (queueInterval.current) {
        clearInterval(queueInterval.current);
        queueInterval.current = null;
      }

      // バッジマネージャーをクリーンアップ
      badgeManager.cleanup();

      // パフォーマンス最適化をクリーンアップ
      if (enablePerformanceOptimization) {
        notificationPerformanceOptimizer.cleanup();
      }
    };
  }, [enablePerformanceOptimization]);

  // Performance metrics
  const getPerformanceMetrics = useCallback(async () => {
    if (!enablePerformanceOptimization) return null;
    return await notificationPerformanceOptimizer.getPerformanceMetrics();
  }, [enablePerformanceOptimization]);

  // Queue statistics
  const getQueueStats = useCallback(async () => {
    if (!enableQueueProcessing) return null;
    return await notificationQueueManager.getQueueStats();
  }, [enableQueueProcessing]);

  // Error statistics
  const getErrorStats = useCallback(async () => {
    return await notificationErrorHandler.getErrorStats();
  }, []);

  return {
    // Data
    notifications: Array.isArray(notifications) ? notifications : (notifications as any)?.data || [],
    unreadCount: unreadCount || 0,
    settings: settings || null,

    // Loading states
    isLoading: notificationsLoading || unreadCountLoading || settingsLoading,
    isInitialized: state.isInitialized,
    isOnline: state.isOnline,

    // Enhanced operations
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    updateSettings: updateNotificationSettings,
    
    // System operations
    initialize: initializeNotifications,
    refetch: () => {
      refetchNotifications();
      refetchUnreadCount();
      refetchSettings();
    },

    // Statistics and monitoring
    getPerformanceMetrics,
    getQueueStats,
    getErrorStats,

    // State information
    state,

    // Error information
    error: notificationsError,
  };
}

// Redux integration improvement
export function useNotificationSync() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const syncNotificationsWithRedux = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Redux storeの通知データと実際のデータを同期
      const freshNotifications = await notificationService.getNotifications(user.id);
      
      // Redux storeを更新（実装は具体的なstore構造に依存）
      dispatch({
        type: 'notifications/syncUpdate',
        payload: freshNotifications,
      });

      console.log('Redux storeと通知データを同期しました');
    } catch (error) {
      console.error('Redux同期エラー:', error);
    }
  }, [dispatch, user?.id]);

  return {
    syncNotificationsWithRedux,
  };
}

// Realtime integration improvement
export function useAdvancedRealtime() {
  const user = useAppSelector((state) => state.auth.user);
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  const subscribeToAdvancedRealtime = useCallback((callback: (data: any) => void) => {
    if (!user?.id) return () => {};

    setConnectionState('connecting');

    const unsubscribe = notificationRealtimeManager.subscribe(user.id, (notification) => {
      setConnectionState('connected');
      
      // 重複通知の防止
      const isDuplicate = checkForDuplicateNotification(notification);
      if (isDuplicate) {
        console.log('重複通知を検出してスキップしました:', notification.id);
        return;
      }

      // 通知の前処理
      const processedNotification = preprocessNotification(notification);
      
      callback(processedNotification);
    });

    return () => {
      setConnectionState('disconnected');
      unsubscribe();
    };
  }, [user?.id]);

  const checkForDuplicateNotification = (notification: any): boolean => {
    // 重複チェックロジック（実装に応じて調整）
    // 例：最近の通知IDを保持して重複をチェック
    return false;
  };

  const preprocessNotification = (notification: any): any => {
    // 通知の前処理（フィルタリング、変換など）
    return {
      ...notification,
      processedAt: new Date().toISOString(),
    };
  };

  return {
    subscribeToAdvancedRealtime,
    connectionState,
  };
}