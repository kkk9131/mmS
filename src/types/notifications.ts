export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
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

export interface NotificationData {
  userId?: string;
  userName?: string;
  userAvatar?: string;
  postId?: string;
  postContent?: string;
  commentId?: string;
  messageId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface NotificationList {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface NotificationSettings {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  mentions: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
}

export interface UnreadCountResponse {
  unreadCount: number;
  lastChecked: string;
}

export interface MarkAsReadRequest {
  notificationIds: string[];
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}