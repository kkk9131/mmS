import { supabase } from '../supabase/client';
import { CreateNotificationParams } from './NotificationService';

export interface QueuedNotification extends CreateNotificationParams {
  id: string;
  queuedAt: string;
  scheduledFor?: string; // おやすみモード終了後の配信予定時刻
}

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string; // "HH:MM" format
  endTime: string; // "HH:MM" format
  allowEmergency: boolean;
  queueNotifications: boolean; // おやすみモード中の通知をキューに保存するか
}

class QuietHoursManager {
  private static instance: QuietHoursManager;
  private notificationQueue = new Map<string, QueuedNotification>();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.startQuietHoursCheck();
  }

  public static getInstance(): QuietHoursManager {
    if (!QuietHoursManager.instance) {
      QuietHoursManager.instance = new QuietHoursManager();
    }
    return QuietHoursManager.instance;
  }

  // ユーザーがおやすみモード中かチェック
  public async isUserInQuietHours(userId: string): Promise<boolean> {
    try {
      const settings = await this.getUserQuietHoursConfig(userId);
      if (!settings.enabled) {
        return false;
      }

      return this.isCurrentTimeInQuietHours(settings.startTime, settings.endTime);
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  // 現在時刻がおやすみモード時間内かチェック
  private isCurrentTimeInQuietHours(startTime: string, endTime: string): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 同日内の場合（例: 22:00 - 23:59）
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    }
    
    // 日をまたぐ場合（例: 22:00 - 07:00）
    return currentTime >= startTime || currentTime <= endTime;
  }

  // ユーザーのおやすみモード設定を取得
  private async getUserQuietHoursConfig(userId: string): Promise<QuietHoursConfig> {
    try {
      const { data: settings, error } = await supabase
        .from('notification_settings')
        .select('quiet_hours_start, quiet_hours_end, quiet_hours_enabled')
        .eq('user_id', userId)
        .single();

      if (error) {
        throw error;
      }

      return {
        enabled: settings?.quiet_hours_enabled ?? true,
        startTime: settings?.quiet_hours_start ?? '22:00',
        endTime: settings?.quiet_hours_end ?? '07:00',
        allowEmergency: true, // 緊急通知は常に許可
        queueNotifications: true, // おやすみモード中の通知をキューに保存
      };
    } catch (error) {
      console.error('Error fetching quiet hours config:', error);
      // デフォルト設定を返す
      return {
        enabled: true,
        startTime: '22:00',
        endTime: '07:00',
        allowEmergency: true,
        queueNotifications: true,
      };
    }
  }

  // 通知をキューに追加
  public async queueNotification(params: CreateNotificationParams): Promise<void> {
    const queueId = `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedNotification: QueuedNotification = {
      ...params,
      id: queueId,
      queuedAt: new Date().toISOString(),
      scheduledFor: await this.getNextAvailableTime(params.userId),
    };

    this.notificationQueue.set(queueId, queuedNotification);

    // データベースにもキューを保存（アプリが終了しても保持するため）
    try {
      await supabase
        .from('notification_queue')
        .insert({
          id: queueId,
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          data: params.data || {},
          action_url: params.actionUrl,
          queued_at: queuedNotification.queuedAt,
          scheduled_for: queuedNotification.scheduledFor,
        });

      console.log(`Notification queued for user ${params.userId}: ${queueId}`);
    } catch (error) {
      console.error('Failed to save queued notification to database:', error);
    }
  }

  // 次回配信可能時刻を計算
  private async getNextAvailableTime(userId: string): Promise<string> {
    const config = await this.getUserQuietHoursConfig(userId);
    const now = new Date();
    
    if (!this.isCurrentTimeInQuietHours(config.startTime, config.endTime)) {
      // おやすみモード中でなければ即座に配信
      return now.toISOString();
    }

    // おやすみモード終了時刻を計算
    const [endHours, endMinutes] = config.endTime.split(':').map(Number);
    const nextDelivery = new Date();
    
    // 日をまたぐかどうかをチェック
    const [startHours] = config.startTime.split(':').map(Number);
    if (endHours < startHours || (endHours <= now.getHours() && endMinutes <= now.getMinutes())) {
      // 翌日のおやすみモード終了時刻
      nextDelivery.setDate(nextDelivery.getDate() + 1);
    }
    
    nextDelivery.setHours(endHours, endMinutes, 0, 0);
    return nextDelivery.toISOString();
  }

  // キューの処理を開始
  private startQuietHoursCheck(): void {
    // 1分ごとにチェック
    this.checkInterval = setInterval(() => {
      this.processQueuedNotifications();
    }, 60000);

    // 起動時にも一度処理
    this.processQueuedNotifications();
  }

  // キューに溜まった通知を処理
  private async processQueuedNotifications(): Promise<void> {
    const now = new Date();
    const notificationsToSend: QueuedNotification[] = [];

    // メモリ内のキューをチェック
    for (const [id, notification] of this.notificationQueue.entries()) {
      if (notification.scheduledFor && new Date(notification.scheduledFor) <= now) {
        notificationsToSend.push(notification);
        this.notificationQueue.delete(id);
      }
    }

    // データベースからもキューを取得
    try {
      const { data: dbQueue, error } = await supabase
        .from('notification_queue')
        .select('*')
        .lte('scheduled_for', now.toISOString())
        .eq('sent', false);

      if (error) {
        throw error;
      }

      if (dbQueue) {
        for (const item of dbQueue) {
          notificationsToSend.push({
            id: item.id,
            userId: item.user_id,
            type: item.type,
            title: item.title,
            message: item.message,
            data: item.data || {},
            actionUrl: item.action_url,
            queuedAt: item.queued_at,
            scheduledFor: item.scheduled_for,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching queued notifications from database:', error);
    }

    // 配信処理
    for (const notification of notificationsToSend) {
      try {
        await this.sendQueuedNotification(notification);
        await this.markNotificationAsSent(notification.id);
        console.log(`Queued notification sent: ${notification.id}`);
      } catch (error) {
        console.error(`Failed to send queued notification ${notification.id}:`, error);
      }
    }
  }

  // キューから通知を送信
  private async sendQueuedNotification(notification: QueuedNotification): Promise<void> {
    const { NotificationService } = await import('./NotificationService');
    const notificationService = NotificationService.getInstance();

    await notificationService.createNotification({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
    });
  }

  // 通知を送信済みとしてマーク
  private async markNotificationAsSent(queueId: string): Promise<void> {
    try {
      await supabase
        .from('notification_queue')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', queueId);
    } catch (error) {
      console.error('Failed to mark notification as sent:', error);
    }
  }

  // キューの状態を取得
  public getQueueStatus(): {
    memoryQueue: number;
    pendingCount: number;
  } {
    return {
      memoryQueue: this.notificationQueue.size,
      pendingCount: Array.from(this.notificationQueue.values())
        .filter(n => n.scheduledFor && new Date(n.scheduledFor) > new Date()).length,
    };
  }

  // 特定ユーザーのキューを取得
  public async getUserQueuedNotifications(userId: string): Promise<QueuedNotification[]> {
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('sent', false)
        .order('scheduled_for', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        type: item.type,
        title: item.title,
        message: item.message,
        data: item.data || {},
        actionUrl: item.action_url,
        queuedAt: item.queued_at,
        scheduledFor: item.scheduled_for,
      }));
    } catch (error) {
      console.error('Error fetching user queued notifications:', error);
      return [];
    }
  }

  // クリーンアップ
  public cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.notificationQueue.clear();
  }
}

export const quietHoursManager = QuietHoursManager.getInstance();