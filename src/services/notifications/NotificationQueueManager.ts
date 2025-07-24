import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import { NotificationType } from './NotificationHandler';

export interface PendingNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  actionUrl: string;
  scheduledFor?: string; // ISO string
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
}

export interface QueueStats {
  totalPending: number;
  totalFailed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  successRate: number;
}

export interface NotificationQueueManager {
  enqueue(notification: Omit<PendingNotification, 'id' | 'attempts' | 'createdAt'>): Promise<void>;
  dequeue(): Promise<PendingNotification | null>;
  processBatch(batchSize: number): Promise<void>;
  retryFailedNotifications(): Promise<void>;
  clearQueue(): Promise<void>;
  getQueueStats(): Promise<QueueStats>;
  scheduleNotification(notification: Omit<PendingNotification, 'id' | 'attempts' | 'createdAt'>, scheduledFor: Date): Promise<void>;
}

class NotificationQueueManagerImpl implements NotificationQueueManager {
  private static instance: NotificationQueueManagerImpl;
  private readonly QUEUE_KEY = '@notification_queue';
  private readonly FAILED_QUEUE_KEY = '@notification_failed_queue';
  private readonly STATS_KEY = '@notification_stats';
  private readonly MAX_BATCH_SIZE = 10;
  private readonly DEFAULT_MAX_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

  private processingInterval: NodeJS.Timer | null = null;
  private isProcessing = false;

  public static getInstance(): NotificationQueueManagerImpl {
    if (!NotificationQueueManagerImpl.instance) {
      NotificationQueueManagerImpl.instance = new NotificationQueueManagerImpl();
    }
    return NotificationQueueManagerImpl.instance;
  }

  constructor() {
    this.startProcessing();
  }

  private startProcessing(): void {
    // 5秒ごとにキューを処理
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processBatch(this.MAX_BATCH_SIZE);
      }
    }, 5000);
  }

  async enqueue(notification: Omit<PendingNotification, 'id' | 'attempts' | 'createdAt'>): Promise<void> {
    try {
      const pendingNotification: PendingNotification = {
        ...notification,
        id: this.generateId(),
        attempts: 0,
        createdAt: new Date().toISOString(),
        maxAttempts: notification.maxAttempts || this.DEFAULT_MAX_ATTEMPTS,
      };

      const queue = await this.getQueue();
      queue.push(pendingNotification);
      await this.saveQueue(queue);

      console.log('通知をキューに追加:', pendingNotification.id);
    } catch (error) {
      console.error('通知キュー追加エラー:', error);
      throw error;
    }
  }

  async dequeue(): Promise<PendingNotification | null> {
    try {
      const queue = await this.getQueue();
      
      // スケジュール時刻が来ている通知を優先的に処理
      const now = new Date();
      const readyNotifications = queue.filter(notification => {
        if (notification.scheduledFor) {
          return new Date(notification.scheduledFor) <= now;
        }
        return true;
      });

      if (readyNotifications.length === 0) {
        return null;
      }

      // 優先度順でソート（作成日時の古い順）
      readyNotifications.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const notification = readyNotifications[0];
      
      // キューから削除
      const updatedQueue = queue.filter(n => n.id !== notification.id);
      await this.saveQueue(updatedQueue);

      return notification;
    } catch (error) {
      console.error('通知キュー取得エラー:', error);
      return null;
    }
  }

  async processBatch(batchSize: number): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    const processedCount = { success: 0, failed: 0 };

    try {
      console.log(`通知キューバッチ処理開始 (サイズ: ${batchSize})`);

      for (let i = 0; i < batchSize; i++) {
        const notification = await this.dequeue();
        if (!notification) break;

        const startTime = Date.now();
        
        try {
          await this.processNotification(notification);
          processedCount.success++;
          
          // 統計を更新
          await this.updateStats({
            processingTime: Date.now() - startTime,
            success: true,
          });

          console.log('通知処理成功:', notification.id);
        } catch (error) {
          console.error('通知処理失敗:', notification.id, error);
          
          notification.attempts++;
          notification.lastAttemptAt = new Date().toISOString();
          notification.error = error.message;

          if (notification.attempts < notification.maxAttempts) {
            // 再試行のためキューに戻す（指数バックオフ）
            const delay = this.RETRY_DELAYS[notification.attempts - 1] || 30000;
            notification.scheduledFor = new Date(Date.now() + delay).toISOString();
            await this.enqueue(notification);
          } else {
            // 失敗キューに移動
            await this.moveToFailedQueue(notification);
            processedCount.failed++;
          }

          // 統計を更新
          await this.updateStats({
            processingTime: Date.now() - startTime,
            success: false,
          });
        }
      }

      console.log(`バッチ処理完了 - 成功: ${processedCount.success}, 失敗: ${processedCount.failed}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNotification(notification: PendingNotification): Promise<void> {
    try {
      // NotificationServiceを使用して通知を送信
      const { notificationService } = await import('./NotificationService');
      
      await notificationService.createNotification({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        actionUrl: notification.actionUrl,
      });
    } catch (error) {
      // Edge Functionへの直接呼び出しもフォールバックとして試行
      const response = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          actionUrl: notification.actionUrl,
        },
      });

      if (response.error) {
        throw new Error(`プッシュ通知送信失敗: ${response.error.message}`);
      }
    }
  }

  async retryFailedNotifications(): Promise<void> {
    try {
      const failedQueue = await this.getFailedQueue();
      
      console.log(`失敗した通知の再試行開始 (${failedQueue.length}件)`);

      for (const notification of failedQueue) {
        // 最大試行回数をリセットして再キューイング
        const retryNotification = {
          ...notification,
          attempts: 0,
          maxAttempts: this.DEFAULT_MAX_ATTEMPTS,
          error: undefined,
          scheduledFor: undefined,
        };

        await this.enqueue(retryNotification);
      }

      // 失敗キューをクリア
      await this.clearFailedQueue();
      
      console.log('失敗した通知の再試行キューイング完了');
    } catch (error) {
      console.error('失敗通知再試行エラー:', error);
      throw error;
    }
  }

  async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.QUEUE_KEY);
      console.log('通知キューをクリアしました');
    } catch (error) {
      console.error('キュークリアエラー:', error);
      throw error;
    }
  }

  async scheduleNotification(
    notification: Omit<PendingNotification, 'id' | 'attempts' | 'createdAt'>, 
    scheduledFor: Date
  ): Promise<void> {
    await this.enqueue({
      ...notification,
      scheduledFor: scheduledFor.toISOString(),
    });
  }

  async getQueueStats(): Promise<QueueStats> {
    try {
      const stats = await this.getStats();
      const queue = await this.getQueue();
      const failedQueue = await this.getFailedQueue();

      return {
        totalPending: queue.length,
        totalFailed: failedQueue.length,
        totalProcessed: stats.totalProcessed || 0,
        averageProcessingTime: stats.averageProcessingTime || 0,
        successRate: stats.totalProcessed > 0 
          ? ((stats.totalProcessed - stats.totalFailed) / stats.totalProcessed) * 100 
          : 0,
      };
    } catch (error) {
      console.error('キュー統計取得エラー:', error);
      return {
        totalPending: 0,
        totalFailed: 0,
        totalProcessed: 0,
        averageProcessingTime: 0,
        successRate: 0,
      };
    }
  }

  // プライベートメソッド

  private async getQueue(): Promise<PendingNotification[]> {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('キュー取得エラー:', error);
      return [];
    }
  }

  private async saveQueue(queue: PendingNotification[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('キュー保存エラー:', error);
      throw error;
    }
  }

  private async getFailedQueue(): Promise<PendingNotification[]> {
    try {
      const queueData = await AsyncStorage.getItem(this.FAILED_QUEUE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('失敗キュー取得エラー:', error);
      return [];
    }
  }

  private async moveToFailedQueue(notification: PendingNotification): Promise<void> {
    try {
      const failedQueue = await this.getFailedQueue();
      failedQueue.push(notification);
      await AsyncStorage.setItem(this.FAILED_QUEUE_KEY, JSON.stringify(failedQueue));
      console.log('通知を失敗キューに移動:', notification.id);
    } catch (error) {
      console.error('失敗キュー移動エラー:', error);
    }
  }

  private async clearFailedQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.FAILED_QUEUE_KEY);
    } catch (error) {
      console.error('失敗キュークリアエラー:', error);
    }
  }

  private async getStats(): Promise<any> {
    try {
      const statsData = await AsyncStorage.getItem(this.STATS_KEY);
      return statsData ? JSON.parse(statsData) : {
        totalProcessed: 0,
        totalFailed: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
      };
    } catch (error) {
      console.error('統計取得エラー:', error);
      return {};
    }
  }

  private async updateStats(result: { processingTime: number; success: boolean }): Promise<void> {
    try {
      const stats = await this.getStats();
      
      stats.totalProcessed = (stats.totalProcessed || 0) + 1;
      stats.totalProcessingTime = (stats.totalProcessingTime || 0) + result.processingTime;
      stats.averageProcessingTime = stats.totalProcessingTime / stats.totalProcessed;
      
      if (!result.success) {
        stats.totalFailed = (stats.totalFailed || 0) + 1;
      }

      await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('統計更新エラー:', error);
    }
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // クリーンアップ
  public cleanup(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // キュー監視・管理機能

  async getQueueHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const stats = await this.getQueueStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 成功率が低い場合
    if (stats.successRate < 90 && stats.totalProcessed > 10) {
      issues.push(`成功率が低い: ${stats.successRate.toFixed(1)}%`);
      recommendations.push('エラーログを確認し、失敗原因を調査してください');
    }

    // キューに溜まりすぎている場合
    if (stats.totalPending > 100) {
      issues.push(`キューに多数の通知が蓄積: ${stats.totalPending}件`);
      recommendations.push('バッチサイズを増やすか、処理頻度を上げることを検討してください');
    }

    // 処理時間が長い場合
    if (stats.averageProcessingTime > 5000) { // 5秒以上
      issues.push(`平均処理時間が長い: ${stats.averageProcessingTime}ms`);
      recommendations.push('ネットワーク状況やサーバー負荷を確認してください');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  async generateReport(): Promise<{
    timestamp: string;
    stats: QueueStats;
    health: Awaited<ReturnType<typeof this.getQueueHealth>>;
    recentErrors: string[];
  }> {
    const failedQueue = await this.getFailedQueue();
    const recentErrors = failedQueue
      .filter(n => n.lastAttemptAt && 
        Date.now() - new Date(n.lastAttemptAt).getTime() < 24 * 60 * 60 * 1000) // 24時間以内
      .map(n => n.error || 'Unknown error')
      .slice(0, 10); // 最新10件

    return {
      timestamp: new Date().toISOString(),
      stats: await this.getQueueStats(),
      health: await this.getQueueHealth(),
      recentErrors,
    };
  }
}

export const notificationQueueManager = NotificationQueueManagerImpl.getInstance();