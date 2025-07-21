import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
import {
  User,
  UserProfile,
  UpdateProfileData,
  UserSearchResult,
  UserListResponse,
} from '../types/users';
import { ApiResponse } from '../types/api';
import { ErrorUtils } from '../utils/errorUtils';
import { ApiUtils } from '../utils/apiUtils';

export class UserService {
  private static instance: UserService;
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;
  private userCache: Map<string, { data: User | UserProfile; timestamp: number }>;
  private mockUserProfile: UserProfile | null = null; // モック用のプロフィールストレージ
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分間のキャッシュ

  private constructor() {
    this.httpClient = HttpClient.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.userCache = new Map();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * 自分のプロフィール情報を取得
   */
  public async getMyProfile(): Promise<UserProfile> {
    if (this.featureFlags.isApiEnabled()) {
      const cacheKey = 'my-profile';
      const cached = this.getFromCache(cacheKey);
      if (cached && cached.data) {
        return cached.data as UserProfile;
      }

      return ApiUtils.withMonitoring(
        () => ApiUtils.withRetry(
          async () => {
            const response: ApiResponse<UserProfile> = await this.httpClient.get<UserProfile>('/users/me');
            this.setCache(cacheKey, response.data);
            return response.data;
          },
          { maxRetries: 2, baseDelay: 1000 },
          'UserService.getMyProfile'
        ),
        'UserService.getMyProfile'
      );
    } else {
      return this.getMockMyProfile();
    }
  }

  /**
   * プロフィール情報を更新
   */
  public async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<UserProfile> = await this.httpClient.put<UserProfile>('/users/me', data);

        // キャッシュを更新
        this.setCache('my-profile', response.data);

        return response.data;
      } catch (error) {
        console.error('Failed to update user profile:', error);
        throw error;
      }
    } else {
      return this.getMockUpdatedProfile(data);
    }
  }

  /**
   * 他ユーザーの情報を取得
   */
  public async getUserById(userId: string): Promise<User> {
    if (this.featureFlags.isApiEnabled()) {
      const cacheKey = `user-${userId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && cached.data) {
        return cached.data as User;
      }

      try {
        const response: ApiResponse<User> = await this.httpClient.get<User>(`/users/${userId}`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
        throw error;
      }
    } else {
      return this.getMockUser(userId);
    }
  }

  /**
   * ユーザー検索
   */
  public async searchUsers(query: string, page: number = 1, limit: number = 20): Promise<UserSearchResult> {
    if (this.featureFlags.isApiEnabled()) {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: limit.toString(),
      });

      try {
        const response: ApiResponse<UserSearchResult> = await this.httpClient.get<UserSearchResult>(`/users/search?${params.toString()}`);
        return response.data;
      } catch (error) {
        console.error('Failed to search users:', error);
        throw error;
      }
    } else {
      return this.getMockSearchUsers(query, page, limit);
    }
  }

  /**
   * キャッシュから取得
   */
  private getFromCache(key: string): { data: User | UserProfile; timestamp: number } | null {
    const cached = this.userCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached;
    }
    if (cached) {
      this.userCache.delete(key);
    }
    return null;
  }

  /**
   * キャッシュに保存
   */
  private setCache(key: string, data: User | UserProfile): void {
    this.userCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.userCache.clear();
  }

  /**
   * 特定ユーザーのキャッシュをクリア
   */
  public clearUserCache(userId?: string): void {
    if (userId) {
      this.userCache.delete(`user-${userId}`);
    } else {
      this.userCache.delete('my-profile');
    }
  }

  // === モック機能 ===

  private getMockMyProfile(): UserProfile {
    // 更新されたプロフィールがあればそれを返す
    if (this.mockUserProfile) {
      return this.mockUserProfile;
    }

    // デフォルトのモックプロフィール
    return {
      id: 'current-user-id',
      nickname: '田中花子',
      bio: '2歳の男の子のママです。育児について情報交換できればと思います！',
      avatar: 'https://example.com/avatar1.jpg',
      followersCount: 127,
      followingCount: 89,
      postsCount: 45,
      email: 'hanako@example.com',
      motherBookNumber: 'encrypted-book-number',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-07-15T00:00:00Z',
      preferences: {
        darkMode: false,
        handedness: 'right',
        language: 'ja',
        notifications: {
          likes: true,
          comments: true,
          follows: true,
          messages: true,
          pushEnabled: true,
        },
      },
      privacy: {
        profileVisibility: 'public',
        showFollowersCount: true,
        showFollowingCount: true,
        allowMessages: true,
      },
    };
  }

  private getMockUpdatedProfile(updateData: UpdateProfileData): UserProfile {
    const mockProfile = this.getMockMyProfile();
    const updatedProfile = {
      ...mockProfile,
      ...updateData,
      updatedAt: new Date().toISOString(),
      preferences: updateData.preferences ? { ...mockProfile.preferences, ...updateData.preferences } : mockProfile.preferences,
      privacy: updateData.privacy ? { ...mockProfile.privacy, ...updateData.privacy } : mockProfile.privacy,
    };

    // モックプロフィールを永続化
    this.mockUserProfile = updatedProfile;

    return updatedProfile;
  }

  private getMockUser(userId: string): User {
    return {
      id: userId,
      nickname: `ユーザー${userId.slice(-4)}`,
      bio: 'よろしくお願いします！',
      avatar: `https://example.com/avatar${userId.slice(-1)}.jpg`,
      followersCount: Math.floor(Math.random() * 200),
      followingCount: Math.floor(Math.random() * 150),
      postsCount: Math.floor(Math.random() * 100),
      isFollowing: Math.random() > 0.5,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-07-15T00:00:00Z',
    };
  }

  private getMockSearchUsers(query: string, page: number, limit: number): UserSearchResult {
    const mockUsers: User[] = Array.from({ length: Math.min(limit, 10) }, (_, index) => ({
      id: `search-user-${page}-${index}`,
      nickname: `${query}関連ユーザー${index + 1}`,
      bio: `${query}について投稿しています`,
      avatar: `https://example.com/avatar${index}.jpg`,
      followersCount: Math.floor(Math.random() * 100),
      followingCount: Math.floor(Math.random() * 80),
      postsCount: Math.floor(Math.random() * 50),
      isFollowing: Math.random() > 0.7,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-07-15T00:00:00Z',
    }));

    return {
      users: mockUsers,
      total: Math.floor(Math.random() * 100) + 50,
      hasMore: page < 5,
      nextCursor: page < 5 ? `page-${page + 1}` : undefined,
    };
  }
}