import { supabaseApi } from './supabaseApi';
import { Notification, NotificationUpdate, NotificationInsert } from '../../types/supabase';
import { supabaseClient } from '../../services/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// Enhanced notification interface with user data
interface NotificationWithUser extends Notification {
  sender?: {
    id: string;
    nickname: string;
    avatar_url?: string;
  } | null;
}

// Notification types enum for better type safety
export enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  MENTION = 'mention',
  POST = 'post',
  SYSTEM = 'system',
}

// Real-time subscription manager
class NotificationRealtimeManager {
  private static instance: NotificationRealtimeManager;
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;

  static getInstance(): NotificationRealtimeManager {
    if (!NotificationRealtimeManager.instance) {
      NotificationRealtimeManager.instance = new NotificationRealtimeManager();
    }
    return NotificationRealtimeManager.instance;
  }

  subscribe(userId: string, onNotification: (notification: Notification) => void) {
    // Unsubscribe from previous channel if exists
    this.unsubscribe();

    this.userId = userId;
    const client = supabaseClient.getClient();

    this.channel = client
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotification(payload.new as Notification);
        }
      )
      .subscribe();

    return () => this.unsubscribe();
  }

  unsubscribe() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
  }
}

const realtimeManager = NotificationRealtimeManager.getInstance();

// Notifications API slice
export const notificationsApi = supabaseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get notifications for a user with enhanced features
    getNotifications: builder.query<NotificationWithUser[], { 
      userId: string; 
      limit?: number; 
      offset?: number;
      type?: NotificationType;
      unreadOnly?: boolean;
    }>({
      query: ({ userId, limit = 50, offset = 0, type, unreadOnly }) => ({
        table: 'notifications',
        method: 'select',
        query: `
          *,
          sender:data->sender_id (
            id,
            nickname,
            avatar_url
          )
        `,
        options: {
          eq: { 
            user_id: userId,
            ...(type && { type }),
            ...(unreadOnly && { is_read: false }),
          },
          order: { column: 'created_at', ascending: false },
          range: { from: offset, to: offset + limit - 1 },
        },
      }),
      providesTags: (result, error, { userId, type, unreadOnly }) => {
        const baseTags = result
          ? [
              ...result.map(({ id }) => ({ type: 'Notification' as const, id })),
              { type: 'Notification' as const, id: `USER_${userId}` },
            ]
          : [{ type: 'Notification' as const, id: `USER_${userId}` }];
        
        if (type) {
          baseTags.push({ type: 'Notification', id: `TYPE_${type}_${userId}` });
        }
        if (unreadOnly) {
          baseTags.push({ type: 'Notification', id: `UNREAD_${userId}` });
        }
        
        return baseTags;
      },
      // Subscribe to real-time updates
      onCacheEntryAdded: async (
        { userId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch }
      ) => {
        try {
          await cacheDataLoaded;

          const unsubscribe = realtimeManager.subscribe(userId, (notification) => {
            updateCachedData((draft) => {
              // Add new notification to the beginning
              (draft as any).unshift(notification as NotificationWithUser);
            });

            // Update unread count
            dispatch(
              notificationsApi.util.invalidateTags([
                { type: 'Notification', id: `UNREAD_${userId}` }
              ])
            );
          });

          await cacheEntryRemoved;
          unsubscribe();
        } catch (error) {
          console.error('Failed to subscribe to notifications:', error);
        }
      },
    }),

    // Get unread notification count
    getUnreadCount: builder.query<number, string>({
      query: (userId) => ({
        table: 'notifications',
        method: 'select',
        query: 'id',
        options: {
          eq: { user_id: userId, is_read: false },
        },
      }),
      transformResponse: (response: any[]) => response.length,
      providesTags: (result, error, userId) => [
        { type: 'Notification', id: `UNREAD_${userId}` },
      ],
    }),

    // Mark notification as read
    markAsRead: builder.mutation<Notification, string>({
      query: (notificationId) => ({
        table: 'notifications',
        method: 'update',
        data: { is_read: true },
        options: {
          eq: { id: notificationId },
          single: true,
        },
      }),
      invalidatesTags: (result, error, notificationId) => [
        { type: 'Notification', id: notificationId },
        { type: 'Notification', id: `UNREAD_${result?.user_id}` },
      ],
      onQueryStarted: async (notificationId, { dispatch, queryFulfilled, getState }) => {
        // Optimistic update
        const patchResults: any[] = [];

        // Update the notification in all relevant queries
        const state = getState() as any;
        const apiState = state.api;

        Object.keys(apiState.queries).forEach((queryKey) => {
          if (queryKey.includes('getNotifications')) {
            const patchResult = dispatch(
              notificationsApi.util.updateQueryData(
                'getNotifications' as any,
                JSON.parse(queryKey.split('(')[1].split(')')[0]),
                (draft: any) => {
                  const notification = draft.find((n: any) => n.id === notificationId);
                  if (notification) {
                    notification.is_read = true;
                  }
                }
              )
            );
            patchResults.push(patchResult);
          }
        });

        try {
          await queryFulfilled;
        } catch {
          patchResults.forEach((patchResult) => patchResult.undo());
        }
      },
    }),

    // Mark all notifications as read
    markAllAsRead: builder.mutation<void, string>({
      query: (userId) => ({
        table: 'notifications',
        method: 'update',
        data: { is_read: true },
        options: {
          eq: { user_id: userId },
        },
      }),
      invalidatesTags: (result, error, userId) => [
        { type: 'Notification', id: `USER_${userId}` },
        { type: 'Notification', id: `UNREAD_${userId}` },
      ],
      onQueryStarted: async (userId, { dispatch, queryFulfilled }) => {
        // Optimistic update
        const patchResult = dispatch(
          notificationsApi.util.updateQueryData(
            'getNotifications',
            { userId },
            (draft: any) => {
              draft.forEach((notification: any) => {
                notification.is_read = true;
              });
            }
          )
        );

        const unreadPatchResult = dispatch(
          notificationsApi.util.updateQueryData(
            'getUnreadCount',
            userId,
            () => 0
          )
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          unreadPatchResult.undo();
        }
      },
    }),

    // Delete notification
    deleteNotification: builder.mutation<void, string>({
      query: (notificationId) => ({
        table: 'notifications',
        method: 'delete',
        options: {
          eq: { id: notificationId },
        },
      }),
      invalidatesTags: (result, error, notificationId) => [
        { type: 'Notification', id: notificationId },
      ],
      onQueryStarted: async (notificationId, { dispatch, queryFulfilled, getState }) => {
        // Optimistic update - remove from all notification lists
        const patchResults: any[] = [];
        const state = getState() as any;
        const apiState = state.api;

        Object.keys(apiState.queries).forEach((queryKey) => {
          if (queryKey.includes('getNotifications')) {
            const patchResult = dispatch(
              notificationsApi.util.updateQueryData(
                'getNotifications' as any,
                JSON.parse(queryKey.split('(')[1].split(')')[0]),
                (draft: any) => {
                  const index = draft.findIndex((n: any) => n.id === notificationId);
                  if (index !== -1) {
                    draft.splice(index, 1);
                  }
                }
              )
            );
            patchResults.push(patchResult);
          }
        });

        try {
          await queryFulfilled;
        } catch {
          patchResults.forEach((patchResult) => patchResult.undo());
        }
      },
    }),

    // Clear all notifications for a user
    clearAllNotifications: builder.mutation<void, string>({
      query: (userId) => ({
        table: 'notifications',
        method: 'delete',
        options: {
          eq: { user_id: userId },
        },
      }),
      invalidatesTags: (result, error, userId) => [
        { type: 'Notification', id: `USER_${userId}` },
        { type: 'Notification', id: `UNREAD_${userId}` },
      ],
    }),

    // Create notification (typically used internally by other mutations)
    createNotification: builder.mutation<Notification, NotificationInsert>({
      query: (notification) => ({
        table: 'notifications',
        method: 'insert',
        data: notification,
      }),
      invalidatesTags: (result, error, notification) => [
        { type: 'Notification', id: `USER_${notification.user_id}` },
        { type: 'Notification', id: `UNREAD_${notification.user_id}` },
      ],
    }),

    // Batch mark notifications as read
    batchMarkAsRead: builder.mutation<void, { userId: string; notificationIds: string[] }>({
      query: ({ userId, notificationIds }) => ({
        table: 'notifications',
        method: 'update',
        data: { is_read: true },
        options: {
          in: { id: notificationIds },
          eq: { user_id: userId },
        },
      }),
      invalidatesTags: (result, error, { userId, notificationIds }) => [
        ...notificationIds.map((id) => ({ type: 'Notification' as const, id })),
        { type: 'Notification', id: `UNREAD_${userId}` },
      ],
      onQueryStarted: async ({ userId, notificationIds }, { dispatch, queryFulfilled }) => {
        // Optimistic updates for all notifications
        const patchResults: any[] = [];

        notificationIds.forEach((notificationId) => {
          const patchResult = dispatch(
            notificationsApi.util.updateQueryData(
              'getNotifications',
              { userId },
              (draft: any) => {
                const notification = draft.find((n: any) => n.id === notificationId);
                if (notification) {
                  notification.is_read = true;
                }
              }
            )
          );
          patchResults.push(patchResult);
        });

        try {
          await queryFulfilled;
        } catch {
          patchResults.forEach((patchResult) => patchResult.undo());
        }
      },
    }),

    // Alias for backward compatibility
    markNotificationsAsRead: builder.mutation<void, { userId: string; notificationIds: string[] }>({
      query: ({ userId, notificationIds }) => ({
        table: 'notifications',
        method: 'update',
        data: { is_read: true },
        options: {
          in: { id: notificationIds },
          eq: { user_id: userId },
        },
      }),
      invalidatesTags: (result, error, { userId, notificationIds }) => [
        ...notificationIds.map((id) => ({ type: 'Notification' as const, id })),
        { type: 'Notification', id: `UNREAD_${userId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

// Export hooks for usage in components
export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useClearAllNotificationsMutation,
  useCreateNotificationMutation,
  useBatchMarkAsReadMutation,
  useMarkNotificationsAsReadMutation,
} = notificationsApi;

// Export real-time manager for custom hooks
export { realtimeManager as notificationRealtimeManager };

// Export types
export type { NotificationWithUser };