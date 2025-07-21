export interface FollowRelationship {
  userId: string;
  targetUserId: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  followedAt?: string;
  unfollowedAt?: string;
}

export interface FollowUser {
  id: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  mutualFollowersCount?: number;
  followedAt?: string;
}

export interface FollowListResponse {
  users: FollowUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface FollowRequest {
  id: string;
  fromUser: {
    id: string;
    nickname: string;
    avatar?: string;
  };
  toUser: {
    id: string;
    nickname: string;
    avatar?: string;
  };
  status: FollowRequestStatus;
  requestedAt: string;
  respondedAt?: string;
}

export enum FollowRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export interface FollowRequestsResponse {
  requests: FollowRequest[];
  total: number;
  hasMore: boolean;
}

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  mutualFollowsCount: number;
  pendingRequestsCount: number;
}

export interface FollowSuggestion {
  user: FollowUser;
  reason: FollowSuggestionReason;
  score: number;
  mutualFollowers: FollowUser[];
}

export enum FollowSuggestionReason {
  MUTUAL_FOLLOWERS = 'mutual_followers',
  SIMILAR_INTERESTS = 'similar_interests',
  LOCATION = 'location',
  RECENT_ACTIVITY = 'recent_activity',
  SYSTEM_RECOMMENDATION = 'system_recommendation'
}

export interface FollowSuggestionsResponse {
  suggestions: FollowSuggestion[];
  total: number;
  hasMore: boolean;
}