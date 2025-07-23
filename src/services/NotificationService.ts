import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
import { supabaseClient } from './supabase/client';
import {
  Notification as SupabaseNotification,
  NotificationInsert,
  NotificationUpdate,
} from '../types/supabase';
import {
  Notification,
  NotificationList,
  NotificationSettings,
  UnreadCountResponse,
  MarkAsReadRequest,
  NotificationType,
} from '../types/notifications';
import { ApiResponse } from '../types/api';
import { RealtimeChannel } from '@supabase/supabase-js';

export class NotificationService {
  private static instance: NotificationService;
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;
  private notificationCache: Map<string, { data: NotificationList; timestamp: number }>;
  private unreadCountCache: { count: number; timestamp: number } | null = null;
  private readonly CACHE_TTL = 60 * 1000; // 1分間のキャッシュ
  private readonly UNREAD_CACHE_TTL = 30 * 1000; // 未読数は30秒キャッシュ
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeCallbacks: Set<(notification: Notification) => void> = new Set();

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

  // RTK Query integration helper
  public shouldUseRTKQuery(): boolean {
    return this.featureFlags.isReduxEnabled() && this.featureFlags.isSupabaseEnabled();
  }

  // Enhanced error handling with retry logic
  private async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          console.error(`Operation failed after ${maxRetries} attempts:`, lastError);
          throw lastError;
        }

        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async ensureSupabaseConnection(): Promise<void> {
    if (!supabaseClient.isInitialized()) {
      throw new Error('Supabase client is not initialized');
    }

    const status = await supabaseClient.testConnection();
    if (!status.isConnected) {
      throw new Error(`Supabase connection failed: ${status.error || 'Unknown error'}`);
    }
  }

  /**
   * 通知一覧を取得
   */
  public async getNotifications(page: number = 1, limit: number = 20): Promise<NotificationList> {
    if (this.shouldUseRTKQuery()) {
      console.info('RTK Query is available - consider using useGetNotificationsQuery hook for better caching');
    }

    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseNotifications(page, limit);
    } else if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseUnreadCount();
    } else if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.markSupabaseAsRead(notificationIds);
    } else if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.markSupabaseAllAsRead();
    } else if (this.featureFlags.isApiEnabled()) {
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

  // === Real-time notification system ===

  /**
   * Subscribe to real-time notifications
   */
  public subscribeToRealTimeNotifications(callback: (notification: Notification) => void): () => void {
    if (!this.featureFlags.isSupabaseEnabled()) {
      console.warn('Real-time notifications not available without Supabase');
      return () => {};
    }

    this.realtimeCallbacks.add(callback);

    // Initialize real-time subscription if not already active
    if (!this.realtimeChannel) {
      this.initializeRealtimeSubscription();
    }

    // Return unsubscribe function
    return () => {
      this.realtimeCallbacks.delete(callback);
      if (this.realtimeCallbacks.size === 0) {
        this.cleanupRealtimeSubscription();
      }
    };
  }

  private async initializeRealtimeSubscription(): Promise<void> {
    const currentUser = await supabaseClient.getCurrentUser();
    if (!currentUser) {
      console.warn('Cannot subscribe to real-time notifications: user not authenticated');
      return;
    }

    const client = supabaseClient.getClient();
    this.realtimeChannel = client
      .channel(`notifications:user_id=eq.${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const supabaseNotification = payload.new as SupabaseNotification;
          const transformedNotification = this.transformSupabaseNotification(supabaseNotification);
          
          // Clear cache since new notification arrived
          this.clearCache();
          this.unreadCountCache = null;

          // Notify all subscribers
          this.realtimeCallbacks.forEach(callback => {
            callback(transformedNotification);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          // Clear cache when notifications are updated (e.g., marked as read)
          this.clearCache();
          this.unreadCountCache = null;
        }
      )
      .subscribe();
  }

  private cleanupRealtimeSubscription(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
  }

  // === Supabase functions ===

  private async getSupabaseNotifications(page: number, limit: number): Promise<NotificationList> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      const offset = (page - 1) * limit;

      try {
        const { data: notifications, error, count } = await client
          .from('notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(`Failed to fetch notifications: ${error.message}`);
        }

        // Get unread count
        const { count: unreadCount } = await client
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id)
          .eq('is_read', false);

        const transformedNotifications = (notifications || []).map(n => 
          this.transformSupabaseNotification(n)
        );

        const result: NotificationList = {
          notifications: transformedNotifications,
          total: count || 0,
          unreadCount: unreadCount || 0,
          hasMore: offset + limit < (count || 0),
          nextCursor: offset + limit < (count || 0) ? `page-${page + 1}` : undefined,
        };

        // Cache the result
        this.setCache(`notifications-${page}-${limit}`, result);

        return result;
      } catch (error) {
        console.error('Failed to fetch notifications from Supabase:', error);
        throw error;
      }
    });
  }

  private async getSupabaseUnreadCount(): Promise<number> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      return 0;
    }

    // Check cache first
    if (this.unreadCountCache && Date.now() - this.unreadCountCache.timestamp < this.UNREAD_CACHE_TTL) {
      return this.unreadCountCache.count;
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        const { count, error } = await client
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id)
          .eq('is_read', false);

        if (error) {
          throw new Error(`Failed to fetch unread count: ${error.message}`);
        }

        const unreadCount = count || 0;

        // Update cache
        this.unreadCountCache = {
          count: unreadCount,
          timestamp: Date.now(),
        };

        return unreadCount;
      } catch (error) {
        console.error('Failed to fetch unread count from Supabase:', error);
        throw error;
      }
    });
  }

  private async markSupabaseAsRead(notificationIds: string[]): Promise<void> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Optimistic update first
    this.optimisticallyMarkAsRead(notificationIds);

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        const { error } = await client
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id)
          .in('id', notificationIds);

        if (error) {
          throw new Error(`Failed to mark notifications as read: ${error.message}`);
        }

        // Clear cache to force refresh
        this.clearCache();
        this.unreadCountCache = null;
      } catch (error) {
        console.error('Failed to mark notifications as read in Supabase:', error);
        // Revert optimistic update on error
        this.clearCache();
        this.unreadCountCache = null;
        throw error;
      }
    });
  }

  private async markSupabaseAllAsRead(): Promise<void> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        const { error } = await client
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id)
          .eq('is_read', false);

        if (error) {
          throw new Error(`Failed to mark all notifications as read: ${error.message}`);
        }

        // Update cache
        this.clearCache();
        this.unreadCountCache = { count: 0, timestamp: Date.now() };
      } catch (error) {
        console.error('Failed to mark all notifications as read in Supabase:', error);
        throw error;
      }
    });
  }

  /**
   * Transform Supabase notification to app notification format
   */
  private transformSupabaseNotification(supabaseNotification: SupabaseNotification): Notification {
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
      readAt: undefined, // Supabase doesn't track read timestamp
    };
  }

  /**
   * Create a notification (typically used internally)
   */
  public async createNotification(notification: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    if (!this.featureFlags.isSupabaseEnabled()) {
      console.warn('Cannot create notification: Supabase not enabled');
      return;
    }

    await this.ensureSupabaseConnection();

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      const notificationData: NotificationInsert = {
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || null,
        is_read: false,
      };

      try {
        const { error } = await client
          .from('notifications')
          .insert(notificationData);

        if (error) {
          throw new Error(`Failed to create notification: ${error.message}`);
        }
      } catch (error) {
        console.error('Failed to create notification in Supabase:', error);
        throw error;
      }
    });
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