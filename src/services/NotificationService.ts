import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
import {
  Notification,
  NotificationList,
  NotificationSettings,
  UnreadCountResponse,
  MarkAsReadRequest,
  NotificationType,
} from '../types/notifications';
import { ApiResponse } from '../types/api';

export class NotificationService {
  private static instance: NotificationService;
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;
  private notificationCache: Map<string, { data: NotificationList; timestamp: number }>;
  private unreadCountCache: { count: number; timestamp: number } | null = null;
  private readonly CACHE_TTL = 60 * 1000; // 1分間のキャッシュ
  private readonly UNREAD_CACHE_TTL = 30 * 1000; // 未読数は30秒キャッシュ

  private constructor() {
    this.httpClient = HttpClient.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.notificationCache = new Map();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * 通知一覧を取得
   */
  public async getNotifications(page: number = 1, limit: number = 20): Promise<NotificationList> {
    if (this.featureFlags.isApiEnabled()) {
      const cacheKey = `notifications-${page}-${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      try {
        const response: ApiResponse<NotificationList> = await this.httpClient.get<NotificationList>(`/notifications?${params.toString()}`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        throw error;
      }
    } else {
      return this.getMockNotifications(page, limit);
    }
  }

  /**
   * 未読通知数を取得
   */
  public async getUnreadCount(): Promise<number> {
    if (this.featureFlags.isApiEnabled()) {
      // キャッシュチェック
      if (this.unreadCountCache && Date.now() - this.unreadCountCache.timestamp < this.UNREAD_CACHE_TTL) {
        return this.unreadCountCache.count;
      }

      try {
        const response: ApiResponse<UnreadCountResponse> = await this.httpClient.get<UnreadCountResponse>('/notifications/unread-count');

        // キャッシュを更新
        this.unreadCountCache = {
          count: response.data.unreadCount,
          timestamp: Date.now(),
        };

        return response.data.unreadCount;
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
        throw error;
      }
    } else {
      return this.getMockUnreadCount();
    }
  }

  /**
   * 通知を既読にマーク
   */
  public async markAsRead(notificationIds: string[]): Promise<void> {
    if (this.featureFlags.isApiEnabled()) {
      const request: MarkAsReadRequest = { notificationIds };

      try {
        await this.httpClient.put<void>('/notifications/read', request);

        // キャッシュをクリア（データが変更されたため）
        this.clearCache();
        this.unreadCountCache = null;
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        throw error;
      }
    } else {
      // モックの場合は何もしない（ログのみ）
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('Mock: Marked notifications as read:', notificationIds);
      }
    }
  }

  /**
   * 単一の通知を既読にマーク
   */
  public async markSingleAsRead(notificationId: string): Promise<void> {
    return this.markAsRead([notificationId]);
  }

  /**
   * 全ての通知を既読にマーク
   */
  public async markAllAsRead(): Promise<void> {
    if (this.featureFlags.isApiEnabled()) {
      try {
        await this.httpClient.put<void>('/notifications/read-all');

        // キャッシュをクリア
        this.clearCache();
        this.unreadCountCache = { count: 0, timestamp: Date.now() };
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        throw error;
      }
    } else {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('Mock: Marked all notifications as read');
      }
    }
  }

  /**
   * 通知設定を取得
   */
  public async getNotificationSettings(): Promise<NotificationSettings> {
    if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<NotificationSettings> = await this.httpClient.get<NotificationSettings>('/notifications/settings');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch notification settings:', error);
        throw error;
      }
    } else {
      return this.getMockNotificationSettings();
    }
  }

  /**
   * 通知設定を更新
   */
  public async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<NotificationSettings> = await this.httpClient.put<NotificationSettings>('/notifications/settings', settings);
        return response.data;
      } catch (error) {
        console.error('Failed to update notification settings:', error);
        throw error;
      }
    } else {
      return this.getMockUpdatedNotificationSettings(settings);
    }
  }

  /**
   * 楽観的更新: 通知を既読として即座に更新
   */
  public optimisticallyMarkAsRead(notificationIds: string[]): void {
    // キャッシュ内の通知を即座に既読に更新
    this.notificationCache.forEach((cached, key) => {
      cached.data.notifications.forEach(notification => {
        if (notificationIds.includes(notification.id) && !notification.isRead) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
        }
      });

      // 未読数を更新
      cached.data.unreadCount = Math.max(0, cached.data.unreadCount - notificationIds.length);
    });

    // 未読数キャッシュも更新
    if (this.unreadCountCache) {
      this.unreadCountCache.count = Math.max(0, this.unreadCountCache.count - notificationIds.length);
    }
  }

  /**
   * キャッシュから取得
   */
  private getFromCache(key: string): NotificationList | null {
    const cached = this.notificationCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    if (cached) {
      this.notificationCache.delete(key);
    }
    return null;
  }

  /**
   * キャッシュに保存
   */
  private setCache(key: string, data: NotificationList): void {
    this.notificationCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.notificationCache.clear();
  }

  // === モック機能 ===

  private getMockNotifications(page: number, limit: number): NotificationList {
    const notifications: Notification[] = Array.from({ length: Math.min(limit, 15) }, (_, index) => {
      const globalIndex = (page - 1) * limit + index;
      const types = Object.values(NotificationType);
      const type = types[globalIndex % types.length];

      return {
        id: `notification-${globalIndex}`,
        type,
        title: this.getMockNotificationTitle(type),
        message: this.getMockNotificationMessage(type),
        data: this.getMockNotificationData(type, globalIndex),
        isRead: globalIndex % 3 !== 0, // 3つに1つは未読
        createdAt: new Date(Date.now() - globalIndex * 3600000).toISOString(), // 1時間ずつ古く
        readAt: globalIndex % 3 !== 0 ? new Date(Date.now() - globalIndex * 1800000).toISOString() : undefined,
      };
    });

    const unreadCount = notifications.filter(n => !n.isRead).length + Math.floor(Math.random() * 5);

    return {
      notifications,
      total: Math.floor(Math.random() * 100) + 50,
      unreadCount,
      hasMore: page < 5,
      nextCursor: page < 5 ? `page-${page + 1}` : undefined,
    };
  }

  private getMockNotificationTitle(type: NotificationType): string {
    switch (type) {
      case NotificationType.LIKE:
        return '新しいいいね';
      case NotificationType.COMMENT:
        return '新しいコメント';
      case NotificationType.FOLLOW:
        return '新しいフォロワー';
      case NotificationType.MESSAGE:
        return '新しいメッセージ';
      case NotificationType.MENTION:
        return 'メンション';
      case NotificationType.POST_REPLY:
        return '投稿への返信';
      case NotificationType.SYSTEM:
        return 'システム通知';
      default:
        return '通知';
    }
  }

  private getMockNotificationMessage(type: NotificationType): string {
    switch (type) {
      case NotificationType.LIKE:
        return '田中さんがあなたの投稿にいいねしました';
      case NotificationType.COMMENT:
        return '佐藤さんがあなたの投稿にコメントしました';
      case NotificationType.FOLLOW:
        return '鈴木さんがあなたをフォローしました';
      case NotificationType.MESSAGE:
        return '山田さんからメッセージが届きました';
      case NotificationType.MENTION:
        return '高橋さんがあなたをメンションしました';
      case NotificationType.POST_REPLY:
        return '伊藤さんがあなたの投稿に返信しました';
      case NotificationType.SYSTEM:
        return 'アプリが更新されました';
      default:
        return '新しい通知があります';
    }
  }

  private getMockNotificationData(type: NotificationType, index: number): any {
    return {
      userId: `user-${index % 10}`,
      userName: ['田中', '佐藤', '鈴木', '山田', '高橋', '伊藤', '渡辺', '中村', '小林', '加藤'][index % 10],
      userAvatar: `https://example.com/avatar${index % 10}.jpg`,
      postId: type !== NotificationType.FOLLOW && type !== NotificationType.MESSAGE ? `post-${index}` : undefined,
      postContent: type !== NotificationType.FOLLOW && type !== NotificationType.MESSAGE ? '投稿の内容です...' : undefined,
      actionUrl: `/posts/post-${index}`,
      metadata: {},
    };
  }

  private getMockUnreadCount(): number {
    return Math.floor(Math.random() * 15) + 1;
  }

  private getMockNotificationSettings(): NotificationSettings {
    return {
      likes: true,
      comments: true,
      follows: true,
      messages: true,
      mentions: true,
      pushEnabled: true,
      emailEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };
  }

  private getMockUpdatedNotificationSettings(updates: Partial<NotificationSettings>): NotificationSettings {
    return {
      ...this.getMockNotificationSettings(),
      ...updates,
    };
  }
}