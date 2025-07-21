export interface Post {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
  comments: number;
  tags: string[];
  isLiked: boolean;
  aiResponse?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  lastMessage: string;
  lastMessageTime: string;
  isActive: boolean;
}

export interface User {
  id: string;
  nickname: string;
  maternalBookNumber: string;
  joinDate: string;
  postCount: number;
  likeCount: number;
  commentCount: number;
}

export interface HashtagSuggestion {
  tag: string;
  count: number;
}

export interface AIEmpathyResponse {
  postId: string;
  response: string;
  timestamp: string;
}

export interface SafetyReport {
  postId: string;
  reporterId: string;
  reason: 'inappropriate' | 'spam' | 'harassment' | 'other';
  description?: string;
  timestamp: string;
}

export interface BlockedUser {
  userId: string;
  blockedAt: string;
}

// Re-export new type definitions
export * from './api';
export * from './posts';
export * from './users';
export * from './notifications';
export * from './follow';