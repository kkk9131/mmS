import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

export interface NotificationHandlerConfig {
  handleNotification: (notification: Notifications.Notification) => Promise<Notifications.NotificationBehavior>;
  handleSuccess?: (identifier: string) => void;
  handleError?: (identifier: string, error: Error) => void;
}

export interface NotificationHandler {
  setNotificationHandler(handler: NotificationHandlerConfig): void;
  handleForegroundNotification(notification: Notifications.Notification): Promise<void>;
  handleBackgroundNotification(notification: Notifications.Notification): Promise<void>;
  handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void>;
  playNotificationEffects(type: NotificationType): Promise<void>;
}

export enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  MESSAGE = 'message',
  MENTION = 'mention',
  POST_REPLY = 'post_reply',
  SYSTEM = 'system'
}

interface NotificationData {
  notificationId: string;
  type: NotificationType;
  actionUrl: string;
  userId: string;
  postId?: string;
  userName?: string;
  [key: string]: any;
}

class NotificationHandlerImpl implements NotificationHandler {
  private static instance: NotificationHandlerImpl;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  public static getInstance(): NotificationHandlerImpl {
    if (!NotificationHandlerImpl.instance) {
      NotificationHandlerImpl.instance = new NotificationHandlerImpl();
    }
    return NotificationHandlerImpl.instance;
  }

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    // フォアグラウンド通知リスナー
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleForegroundNotification.bind(this)
    );

    // 通知レスポンスリスナー
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  setNotificationHandler(handler: NotificationHandlerConfig): void {
    Notifications.setNotificationHandler({
      handleNotification: handler.handleNotification,
      handleSuccess: handler.handleSuccess,
      handleError: handler.handleError,
    });
  }

  async handleForegroundNotification(notification: Notifications.Notification): Promise<void> {
    try {
      console.log('フォアグラウンド通知受信:', notification);
      
      const data = notification.request.content.data as NotificationData;
      
      // 通知エフェクトを再生
      if (data.type) {
        await this.playNotificationEffects(data.type);
      }

      // カスタムUI通知を表示（必要に応じて）
      this.showInAppNotification(notification);
      
      // バッジ数を更新
      await this.updateBadgeCount();
      
    } catch (error) {
      console.error('フォアグラウンド通知処理エラー:', error);
    }
  }

  async handleBackgroundNotification(notification: Notifications.Notification): Promise<void> {
    try {
      console.log('バックグラウンド通知受信:', notification);
      
      // バッジ数を更新
      await this.updateBadgeCount();
      
      // 必要に応じて背景処理を実行
      const data = notification.request.content.data as NotificationData;
      await this.processBackgroundNotification(data);
      
    } catch (error) {
      console.error('バックグラウンド通知処理エラー:', error);
    }
  }

  async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      console.log('通知レスポンス受信:', response);
      
      const data = response.notification.request.content.data as NotificationData;
      
      // 通知を既読にマーク
      if (data.notificationId) {
        await this.markNotificationAsRead(data.notificationId);
      }

      // ディープリンク処理
      await this.handleDeepLink(data);
      
      // バッジ数を更新
      await this.updateBadgeCount();
      
    } catch (error) {
      console.error('通知レスポンス処理エラー:', error);
    }
  }

  async playNotificationEffects(type: NotificationType): Promise<void> {
    try {
      // 通知タイプに応じたサウンドとバイブレーション
      const effects = this.getNotificationEffects(type);
      
      if (Platform.OS === 'ios') {
        // iOSの場合のハプティクフィードバック
        // import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
        // await impactAsync(effects.haptic);
      } else {
        // Androidの場合のバイブレーション
        // import { vibrate } from 'expo-haptics';
        // vibrate(effects.vibration);
      }
      
    } catch (error) {
      console.error('通知エフェクト再生エラー:', error);
    }
  }

  private getNotificationEffects(type: NotificationType) {
    const effectsMap = {
      [NotificationType.LIKE]: {
        sound: 'default',
        haptic: 'light' as const,
        vibration: [100, 50, 100],
      },
      [NotificationType.COMMENT]: {
        sound: 'default',
        haptic: 'medium' as const,
        vibration: [200, 100, 200],
      },
      [NotificationType.FOLLOW]: {
        sound: 'default',
        haptic: 'medium' as const,
        vibration: [150, 75, 150],
      },
      [NotificationType.MESSAGE]: {
        sound: 'default',
        haptic: 'heavy' as const,
        vibration: [300, 150, 300],
      },
      [NotificationType.MENTION]: {
        sound: 'default',
        haptic: 'heavy' as const,
        vibration: [250, 125, 250],
      },
      [NotificationType.POST_REPLY]: {
        sound: 'default',
        haptic: 'medium' as const,
        vibration: [200, 100, 200],
      },
      [NotificationType.SYSTEM]: {
        sound: 'default',
        haptic: 'light' as const,
        vibration: [100],
      },
    };

    return effectsMap[type] || effectsMap[NotificationType.SYSTEM];
  }

  private showInAppNotification(notification: Notifications.Notification): void {
    // カスタムのアプリ内通知UI表示ロジック
    // React Context や State Management を使用して通知を表示
    console.log('アプリ内通知表示:', notification.request.content);
  }

  private async processBackgroundNotification(data: NotificationData): Promise<void> {
    // バックグラウンドでの追加処理
    // データの事前読み込み、キャッシュ更新など
    console.log('バックグラウンド処理実行:', data);
  }

  private async handleDeepLink(data: NotificationData): Promise<void> {
    try {
      const { actionUrl, type, postId, userId } = data;
      
      // 通知タイプに応じたナビゲーション
      switch (type) {
        case NotificationType.COMMENT:
        case NotificationType.LIKE:
        case NotificationType.POST_REPLY:
          if (postId) {
            router.push(`/posts/${postId}`);
          }
          break;
          
        case NotificationType.FOLLOW:
          if (userId) {
            router.push(`/profile/${userId}`);
          }
          break;
          
        case NotificationType.MESSAGE:
          if (actionUrl.includes('/rooms/')) {
            router.push(actionUrl);
          }
          break;
          
        case NotificationType.MENTION:
          if (postId) {
            router.push(`/posts/${postId}`);
          }
          break;
          
        case NotificationType.SYSTEM:
          router.push('/notifications');
          break;
          
        default:
          if (actionUrl) {
            router.push(actionUrl);
          }
      }
      
    } catch (error) {
      console.error('ディープリンク処理エラー:', error);
      // フォールバック: 通知画面に遷移
      router.push('/notifications');
    }
  }

  private async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      // Supabaseで通知を既読にマーク
      const { supabase } = await import('../supabase/client');
      
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        console.error('通知既読マークエラー:', error);
      }
    } catch (error) {
      console.error('通知既読処理エラー:', error);
    }
  }

  private async updateBadgeCount(): Promise<void> {
    try {
      // 未読通知数を取得してバッジを更新
      const { supabase } = await import('../supabase/client');
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

  public cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
}

export const notificationHandler = NotificationHandlerImpl.getInstance();