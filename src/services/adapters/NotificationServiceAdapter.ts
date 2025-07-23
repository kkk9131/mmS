import { NotificationService } from '../NotificationService';
import { Notification } from '../../types';
import { FeatureFlagsManager } from '../featureFlags';
import { store, RootState } from '../../store';

/**
 * Adapter class that bridges the existing NotificationService interface with Supabase backend
 */
export class NotificationServiceAdapter {
  private static instance: NotificationServiceAdapter;
  private legacyService: NotificationService;
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.legacyService = NotificationService.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): NotificationServiceAdapter {
    if (!NotificationServiceAdapter.instance) {
      NotificationServiceAdapter.instance = new NotificationServiceAdapter();
    }
    return NotificationServiceAdapter.instance;
  }

  /**
   * Get notifications for a user
   */
  public async getNotifications(userId: string, limit = 50, offset = 0): Promise<{
    notifications: Notification[];
    hasMore: boolean;
  }> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getNotifications.initiate({ userId, limit, offset })
        );

        if (result.error) {
          throw new Error('Failed to fetch notifications from Supabase');
        }

        const transformedNotifications = result.data.map(this.transformSupabaseNotificationToLegacy);
        
        return {
          notifications: transformedNotifications,
          hasMore: transformedNotifications.length === limit,
        };
      } catch (error) {
        console.error('Supabase notifications fetch failed, falling back to legacy:', error);
        return (this.legacyService as any).getNotifications(userId, limit, offset);
      }
    }

    return (this.legacyService as any).getNotifications(userId, limit, offset);
  }

  /**
   * Get unread notifications count
   */
  public async getUnreadCount(userId: string): Promise<number> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getUnreadCount.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to fetch unread count from Supabase');
        }

        return result.data;
      } catch (error) {
        console.error('Supabase unread count fetch failed, falling back to legacy:', error);
        return (this.legacyService as any).getUnreadCount(userId);
      }
    }

    return (this.legacyService as any).getUnreadCount(userId);
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string): Promise<void> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.markAsRead.initiate(notificationId)
        );

        if (result.error) {
          throw new Error('Failed to mark notification as read in Supabase');
        }
      } catch (error) {
        console.error('Supabase mark as read failed, falling back to legacy:', error);
        await (this.legacyService as any).markAsRead([notificationId]);
      }
    } else {
      await (this.legacyService as any).markAsRead([notificationId]);
    }
  }

  /**
   * Mark all notifications as read
   */
  public async markAllAsRead(userId: string): Promise<void> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.markAllAsRead.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to mark all notifications as read in Supabase');
        }
      } catch (error) {
        console.error('Supabase mark all as read failed, falling back to legacy:', error);
        await (this.legacyService as any).markAllAsRead(userId);
      }
    } else {
      await (this.legacyService as any).markAllAsRead(userId);
    }
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(notificationId: string): Promise<void> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.deleteNotification.initiate(notificationId)
        );

        if (result.error) {
          throw new Error('Failed to delete notification in Supabase');
        }
      } catch (error) {
        console.error('Supabase notification deletion failed, falling back to legacy:', error);
        // deleteNotification method doesn't exist on NotificationService
        throw new Error('deleteNotification method not implemented in legacy service');
      }
    } else {
      // deleteNotification method doesn't exist on NotificationService
      throw new Error('deleteNotification method not implemented in legacy service');
    }
  }

  /**
   * Clear all notifications for a user
   */
  public async clearAllNotifications(userId: string): Promise<void> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.clearAllNotifications.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to clear all notifications in Supabase');
        }
      } catch (error) {
        console.error('Supabase clear all notifications failed, falling back to legacy:', error);
        await (this.legacyService as any).clearAllNotifications(userId);
      }
    } else {
      await (this.legacyService as any).clearAllNotifications(userId);
    }
  }

  /**
   * Create a notification (typically called by system)
   */
  public async createNotification(
    userId: string,
    type: string,
    title: string,
    message?: string,
    data?: any
  ): Promise<Notification> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        // Use Supabase RPC function to create notification
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.supabaseApi.initiate({
            table: 'create_notification',
            method: 'rpc',
            data: {
              target_user_id: userId,
              notification_type: type,
              notification_title: title,
              notification_message: message,
              notification_data: data,
            },
          })
        );

        if (result.error) {
          throw new Error('Failed to create notification in Supabase');
        }

        // Return a notification object (would need to fetch the created notification)
        return {
          id: result.data,
          type: type as any,
          title: title || '',
          message: message || '',
          data,
          isRead: false,
          createdAt: new Date().toISOString(),
        } as any;
      } catch (error) {
        console.error('Supabase notification creation failed, falling back to legacy:', error);
        return (this.legacyService as any).createNotification(userId, type, title, message, data);
      }
    }

    return (this.legacyService as any).createNotification(userId, type, title, message, data);
  }

  /**
   * Transform Supabase notification data to legacy format
   */
  private transformSupabaseNotificationToLegacy(supabaseNotification: any): Notification {
    return {
      id: supabaseNotification.id,
      type: supabaseNotification.type,
      title: supabaseNotification.title,
      message: supabaseNotification.message,
      data: supabaseNotification.data,
      isRead: supabaseNotification.is_read,
      createdAt: supabaseNotification.created_at,
    };
  }

  /**
   * Check if Supabase integration is available
   */
  public isSupabaseEnabled(): boolean {
    return this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
  }

  /**
   * Get the underlying legacy service
   */
  public getLegacyService(): NotificationService {
    return this.legacyService;
  }
}