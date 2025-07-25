import { supabase } from '../supabase/client';
import { pushTokenManager } from './PushTokenManager';
import { notificationHandler, NotificationType } from './NotificationHandler';
import { notificationSettingsManager } from './NotificationSettingsManager';
import * as Notifications from 'expo-notifications';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl: string;
}

export interface NotificationWithData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface GetNotificationsResponse {
  notifications: NotificationWithData[];
  unreadCount: number;
  hasMore: boolean;
}

class NotificationService {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  constructor() {
    this.initializeNotificationHandler();
  }

  private initializeNotificationHandler(): void {
    // 通知ハンドラーの設定
    notificationHandler.setNotificationHandler({
      handleNotification: async (notification: Notifications.Notification) => {
        const data = notification.request.content.data;
        const type = data.type as NotificationType;

        // フォアグラウンドでの通知表示設定
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: this.getNotificationPriority(type),
        };
      },
      handleSuccess: (identifier: string) => {
        console.log('通知送信成功:', identifier);
      },
      handleError: (identifier: string, error: Error) => {
        console.error('通知送信エラー:', identifier, error);
      },
    });
  }

  // プッシュトークンの初期化と登録
  async initializePushNotifications(userId: string): Promise<void> {
    try {
      // 権限チェック
      const permissions = await pushTokenManager.checkPermissions();
      
      if (permissions.status !== 'granted') {
        console.log('プッシュ通知権限が必要です');
        return;
      }

      // プッシュトークンの取得と登録
      const token = await pushTokenManager.getExpoPushToken();
      await pushTokenManager.registerToken(userId, token);

      // 通知設定の初期化（まだない場合）
      await notificationSettingsManager.getSettings(userId);

      console.log('プッシュ通知の初期化が完了しました');
    } catch (error) {
      console.error('プッシュ通知初期化エラー:', error);
    }
  }

  // 通知の作成（データベースに保存 + プッシュ送信）
  async createNotification(params: CreateNotificationParams): Promise<void> {
    try {
      // ユーザーの通知設定をチェック
      const isTypeEnabled = await notificationSettingsManager.isNotificationTypeEnabledForUser(
        params.userId, 
        params.type
      );

      if (!isTypeEnabled) {
        console.log('通知タイプが無効なためスキップ:', params.type);
        return;
      }

      // おやすみモード中でかつ緊急通知でない場合はスキップ
      const isQuietHours = await notificationSettingsManager.isQuietHoursForUser(params.userId);
      const isEmergency = notificationSettingsManager.isEmergencyNotification(params);
      
      if (isQuietHours && !isEmergency) {
        console.log('おやすみモード中のため通知をスキップ');
        // TODO: おやすみモード後に送信するためキューに保存
        return;
      }

      // データベースに通知を保存
      const { data: notification, error: dbError } = await supabase
        .from('notifications')
        .insert({
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          data: params.data || {},
          is_read: false,
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`通知作成失敗: ${dbError.message}`);
      }

      // プッシュ通知の送信
      await this.sendPushNotification({
        ...params,
        notificationId: notification.id,
      });

      console.log('通知が正常に作成・送信されました:', notification.id);
    } catch (error) {
      console.error('通知作成エラー:', error);
      throw error;
    }
  }

  // プッシュ通知の送信
  private async sendPushNotification(params: CreateNotificationParams & { notificationId: string }): Promise<void> {
    try {
      // ユーザーのプッシュトークンを取得
      const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', params.userId)
        .eq('is_active', true);

      if (error) {
        throw new Error(`プッシュトークン取得失敗: ${error.message}`);
      }

      if (!tokens || tokens.length === 0) {
        console.log('プッシュトークンが見つかりません');
        return;
      }

      // 各トークンに対してプッシュ通知を送信
      const pushPromises = tokens.map(async (tokenData) => {
        const message = {
          to: tokenData.token,
          sound: 'default' as const,
          title: params.title,
          body: params.message,
          data: {
            notificationId: params.notificationId,
            type: params.type,
            actionUrl: params.actionUrl,
            userId: params.userId,
            ...params.data,
          },
          priority: this.getExpoPushPriority(params.type),
          channelId: 'default',
        };

        try {
          const ticket = await Notifications.scheduleNotificationAsync({
            content: {
              title: message.title,
              body: message.body,
              data: message.data,
              sound: message.sound,
            },
            trigger: null, // 即座に送信
          });

          console.log('プッシュ通知送信成功:', ticket);
          return { success: true, ticket };
        } catch (error) {
          console.error('プッシュ通知送信失敗:', error);
          return { success: false, error };
        }
      });

      await Promise.allSettled(pushPromises);
    } catch (error) {
      console.error('プッシュ通知送信エラー:', error);
      throw error;
    }
  }

  // 通知履歴の取得
  async getNotifications(userId: string, page = 0, limit = 20): Promise<GetNotificationsResponse> {
    try {
      const offset = page * limit;

      // 通知データの取得
      const { data: notifications, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`通知取得失敗: ${error.message}`);
      }

      // 未読数の取得
      const { count: unreadCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      const hasMore = (count || 0) > offset + limit;

      const formattedNotifications: NotificationWithData[] = (notifications || []).map(notification => ({
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        isRead: notification.is_read,
        createdAt: notification.created_at,
        readAt: notification.read_at,
      }));

      return {
        notifications: formattedNotifications,
        unreadCount: unreadCount || 0,
        hasMore,
      };
    } catch (error) {
      console.error('通知取得エラー:', error);
      throw error;
    }
  }

  // 通知を既読にマーク
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        throw new Error(`既読マーク失敗: ${error.message}`);
      }

      // バッジ数を更新
      await this.updateBadgeCount();
    } catch (error) {
      console.error('既読マークエラー:', error);
      throw error;
    }
  }

  // 全ての通知を既読にマーク
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        throw new Error(`全既読マーク失敗: ${error.message}`);
      }

      // バッジ数をクリア
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('全既読マークエラー:', error);
      throw error;
    }
  }

  // 通知の削除
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        throw new Error(`通知削除失敗: ${error.message}`);
      }

      // バッジ数を更新
      await this.updateBadgeCount();
    } catch (error) {
      console.error('通知削除エラー:', error);
      throw error;
    }
  }

  // バッジ数の更新
  private async updateBadgeCount(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      await Notifications.setBadgeCountAsync(count || 0);
    } catch (error) {
      console.error('バッジ数更新エラー:', error);
    }
  }

  // 通知の優先度を取得
  private getNotificationPriority(type: NotificationType): Notifications.AndroidNotificationPriority {
    const priorityMap = {
      [NotificationType.SYSTEM]: Notifications.AndroidNotificationPriority.MAX,
      [NotificationType.MESSAGE]: Notifications.AndroidNotificationPriority.HIGH,
      [NotificationType.MENTION]: Notifications.AndroidNotificationPriority.HIGH,
      [NotificationType.COMMENT]: Notifications.AndroidNotificationPriority.DEFAULT,
      [NotificationType.POST_REPLY]: Notifications.AndroidNotificationPriority.DEFAULT,
      [NotificationType.FOLLOW]: Notifications.AndroidNotificationPriority.DEFAULT,
      [NotificationType.LIKE]: Notifications.AndroidNotificationPriority.LOW,
    };

    return priorityMap[type] || Notifications.AndroidNotificationPriority.DEFAULT;
  }

  // Expo Push APIの優先度を取得
  private getExpoPushPriority(type: NotificationType): 'default' | 'normal' | 'high' {
    const priorityMap = {
      [NotificationType.SYSTEM]: 'high' as const,
      [NotificationType.MESSAGE]: 'high' as const,
      [NotificationType.MENTION]: 'high' as const,
      [NotificationType.COMMENT]: 'normal' as const,
      [NotificationType.POST_REPLY]: 'normal' as const,
      [NotificationType.FOLLOW]: 'normal' as const,
      [NotificationType.LIKE]: 'default' as const,
    };

    return priorityMap[type] || 'default';
  }

  // 権限リクエスト
  async requestPermissions(): Promise<boolean> {
    try {
      const permissions = await pushTokenManager.requestPermissions();
      return permissions.status === 'granted';
    } catch (error) {
      console.error('権限リクエストエラー:', error);
      return false;
    }
  }

  // クリーンアップ
  cleanup(): void {
    notificationHandler.cleanup();
  }
}

export const notificationService = NotificationService.getInstance();