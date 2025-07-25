import { useEffect, useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import { useRegisterPushTokenMutation, useRequestPushPermissionsMutation } from '../store/api/notificationsApi';
import { notificationService } from '../services/notifications/NotificationService';
import * as Notifications from 'expo-notifications';

interface UseNotificationsOptions {
  autoInitialize?: boolean;
  requestPermissionsOnMount?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoInitialize = true, requestPermissionsOnMount = false } = options;
  
  const user = useAppSelector((state) => state.auth.user);
  const [registerPushToken, { isLoading: isRegistering }] = useRegisterPushTokenMutation();
  const [requestPermissions, { isLoading: isRequestingPermissions }] = useRequestPushPermissionsMutation();

  // プッシュ通知の初期化
  const initializeNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      // プッシュ通知の初期化
      await notificationService.initializePushNotifications(user.id);
      console.log('プッシュ通知システムが初期化されました');
    } catch (error) {
      console.error('プッシュ通知初期化エラー:', error);
    }
  }, [user?.id]);

  // 権限のリクエスト
  const requestNotificationPermissions = useCallback(async () => {
    try {
      const result = await requestPermissions();
      return result.data || false;
    } catch (error) {
      console.error('権限リクエストエラー:', error);
      return false;
    }
  }, [requestPermissions]);

  // プッシュトークンの登録
  const registerToken = useCallback(async () => {
    if (!user?.id) return;

    try {
      await registerPushToken();
      console.log('プッシュトークンが登録されました');
    } catch (error) {
      console.error('プッシュトークン登録エラー:', error);
    }
  }, [user?.id, registerPushToken]);

  // 通知の作成
  const createNotification = useCallback(async (params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    actionUrl: string;
  }) => {
    try {
      await notificationService.createNotification(params as any);
    } catch (error) {
      console.error('通知作成エラー:', error);
      throw error;
    }
  }, []);

  // 権限状態の取得
  const getPermissionStatus = useCallback(async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      return permissions.status;
    } catch (error) {
      console.error('権限状態取得エラー:', error);
      return 'undetermined';
    }
  }, []);

  // 初期化処理
  useEffect(() => {
    if (!user?.id || !autoInitialize) return;

    const init = async () => {
      // 権限をリクエスト（オプション）
      if (requestPermissionsOnMount) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          console.log('プッシュ通知権限が拒否されました');
          return;
        }
      }

      // プッシュ通知の初期化
      await initializeNotifications();
    };

    init();
  }, [user?.id, autoInitialize, requestPermissionsOnMount, initializeNotifications, requestNotificationPermissions]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return {
    // Methods
    initializeNotifications,
    requestNotificationPermissions,
    registerToken,
    createNotification,
    getPermissionStatus,
    
    // State
    isRegistering,
    isRequestingPermissions,
    
    // User state
    user,
  };
}

// 通知設定管理用のhook
export function useNotificationSettings() {
  const user = useAppSelector((state) => state.auth.user);
  
  const getSettings = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const { notificationSettingsManager } = await import('../services/notifications/NotificationSettingsManager');
      return await notificationSettingsManager.getSettings(user.id);
    } catch (error) {
      console.error('通知設定取得エラー:', error);
      return null;
    }
  }, [user?.id]);

  const updateSettings = useCallback(async (settings: any) => {
    if (!user?.id) return;

    try {
      const { notificationSettingsManager } = await import('../services/notifications/NotificationSettingsManager');
      await notificationSettingsManager.updateSettings(user.id, settings);
    } catch (error) {
      console.error('通知設定更新エラー:', error);
      throw error;
    }
  }, [user?.id]);

  const isQuietHours = useCallback(async () => {
    if (!user?.id) return false;

    try {
      const { notificationSettingsManager } = await import('../services/notifications/NotificationSettingsManager');
      return await notificationSettingsManager.isQuietHoursForUser(user.id);
    } catch (error) {
      console.error('おやすみモードチェックエラー:', error);
      return false;
    }
  }, [user?.id]);

  return {
    getSettings,
    updateSettings,
    isQuietHours,
    user,
  };
}

// リアルタイム通知用のhook
export function useRealtimeNotifications() {
  const user = useAppSelector((state) => state.auth.user);

  const subscribeToNotifications = useCallback((callback: (notification: any) => void) => {
    if (!user?.id) return () => {};

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { notificationRealtimeManager } = require('../store/api/notificationsApi');
      return notificationRealtimeManager.subscribe(user.id, callback);
    } catch (error) {
      console.error('リアルタイム通知購読エラー:', error);
      return () => {};
    }
  }, [user?.id]);

  return {
    subscribeToNotifications,
    user,
  };
}