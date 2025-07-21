export interface User {
  id: string;
  nickname: string;
  bio?: string;
  avatar?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;
  motherBookNumber?: string; // 母子手帳番号（暗号化済み）
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  email?: string;
  birthDate?: string;
  preferences: UserPreferences;
  privacy: PrivacySettings;
}

export interface UserPreferences {
  darkMode: boolean;
  handedness: 'left' | 'right';
  notifications: NotificationPreferences;
  language: string;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'followers' | 'private';
  showFollowersCount: boolean;
  showFollowingCount: boolean;
  allowMessages: boolean;
}

export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  pushEnabled: boolean;
}

export interface UpdateProfileData {
  nickname?: string;
  bio?: string;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
  privacy?: Partial<PrivacySettings>;
}

export interface UserSearchResult {
  users: User[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}