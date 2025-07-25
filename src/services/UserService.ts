import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
import { supabaseClient } from './supabase/client';
import {
  User as SupabaseUser,
  UserUpdate,
  UserInsert,
} from '../types/supabase';
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
   * 自分のプロフィール情報を取得
   */
  public async getMyProfile(): Promise<UserProfile> {
    if (this.shouldUseRTKQuery()) {
      console.info('RTK Query is available - consider using useGetUserQuery hook for better caching');
    }

    try {
      if (this.featureFlags.isSupabaseEnabled()) {
        return this.getSupabaseMyProfile();
      } else if (this.featureFlags.isApiEnabled()) {
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
    } catch (error) {
      console.error('getMyProfile エラー:', error);
      // エラー時はモックプロフィールを返して画面が動作するようにする
      return this.getMockMyProfile();
    }
  }

  /**
   * プロフィール情報を更新
   */
  public async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    try {
      if (this.featureFlags.isSupabaseEnabled()) {
        return this.updateSupabaseProfile(data);
      } else if (this.featureFlags.isApiEnabled()) {
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
    } catch (error) {
      console.error('updateProfile エラー:', error);
      // エラー時はモック更新を返して画面が動作するようにする
      return this.getMockUpdatedProfile(data);
    }
  }

  /**
   * 他ユーザーの情報を取得
   */
  public async getUserById(userId: string): Promise<User> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseUserById(userId);
    } else if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.searchSupabaseUsers(query, page, limit);
    } else if (this.featureFlags.isApiEnabled()) {
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

  // === Supabase機能 ===

  private async getSupabaseMyProfile(): Promise<UserProfile> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        const { data: user, error } = await client
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          throw new Error(`Failed to fetch profile: ${error.message}`);
        }

        // Get counts
        const [postsCount, followersCount, followingCount] = await Promise.all([
          this.getSupabasePostsCount(currentUser.id),
          this.getSupabaseFollowersCount(currentUser.id),
          this.getSupabaseFollowingCount(currentUser.id),
        ]);

        const userProfile: UserProfile = {
          id: user.id,
          nickname: user.nickname,
          bio: user.bio || '',
          avatar: user.avatar_url || '',
          followersCount,
          followingCount,
          postsCount,
          email: currentUser.email || '',
          motherBookNumber: user.maternal_book_number,
          createdAt: user.created_at || new Date().toISOString(),
          updatedAt: user.updated_at || new Date().toISOString(),
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
          privacy: user.privacy_settings || {
            profileVisibility: 'public',
            showFollowersCount: true,
            showFollowingCount: true,
            allowMessages: true,
          },
        };

        this.setCache('my-profile', userProfile);
        return userProfile;
      } catch (error) {
        console.error('Failed to fetch profile from Supabase:', error);
        throw error;
      }
    });
  }

  private async updateSupabaseProfile(data: UpdateProfileData): Promise<UserProfile> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        const updateData: UserUpdate = {
          nickname: data.nickname,
          bio: data.bio,
          avatar_url: data.avatar,
          privacy_settings: data.privacy,
          updated_at: new Date().toISOString(),
        };

        const { data: updatedUsers, error } = await client
          .from('users')
          .update(updateData)
          .eq('id', currentUser.id)
          .select('*');

        if (error) {
          throw new Error(`Failed to update profile: ${error.message}`);
        }

        if (!updatedUsers || updatedUsers.length === 0) {
          throw new Error('No user found to update');
        }

        const updatedUser = updatedUsers[0];

        // Get updated counts
        const [postsCount, followersCount, followingCount] = await Promise.all([
          this.getSupabasePostsCount(currentUser.id),
          this.getSupabaseFollowersCount(currentUser.id),
          this.getSupabaseFollowingCount(currentUser.id),
        ]);

        const userProfile: UserProfile = {
          id: updatedUser.id,
          nickname: updatedUser.nickname,
          bio: updatedUser.bio || '',
          avatar: updatedUser.avatar_url || '',
          followersCount,
          followingCount,
          postsCount,
          email: currentUser.email || '',
          motherBookNumber: updatedUser.maternal_book_number,
          createdAt: updatedUser.created_at || new Date().toISOString(),
          updatedAt: updatedUser.updated_at || new Date().toISOString(),
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
          privacy: updatedUser.privacy_settings || {
            profileVisibility: 'public',
            showFollowersCount: true,
            showFollowingCount: true,
            allowMessages: true,
          },
        };

        // Update cache
        this.setCache('my-profile', userProfile);
        this.clearUserCache(currentUser.id);

        return userProfile;
      } catch (error) {
        console.error('Failed to update profile in Supabase:', error);
        throw error;
      }
    });
  }

  private async getSupabaseUserById(userId: string): Promise<User> {
    await this.ensureSupabaseConnection();
    const cacheKey = `user-${userId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && cached.data) {
      return cached.data as User;
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      const currentUser = await supabaseClient.getCurrentUser();

      try {
        const { data: user, error } = await client
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          throw new Error(`Failed to fetch user: ${error.message}`);
        }

        // Get counts and follow status
        const [postsCount, followersCount, followingCount, isFollowing] = await Promise.all([
          this.getSupabasePostsCount(userId),
          this.getSupabaseFollowersCount(userId),
          this.getSupabaseFollowingCount(userId),
          currentUser ? this.getSupabaseFollowStatus(currentUser.id, userId) : Promise.resolve(false),
        ]);

        const userData: User = {
          id: user.id,
          nickname: user.nickname,
          bio: user.bio || '',
          avatar: user.avatar_url || '',
          followersCount,
          followingCount,
          postsCount,
          isFollowing,
          createdAt: user.created_at || new Date().toISOString(),
          updatedAt: user.updated_at || new Date().toISOString(),
        };

        this.setCache(cacheKey, userData);
        return userData;
      } catch (error) {
        console.error(`Failed to fetch user ${userId} from Supabase:`, error);
        throw error;
      }
    });
  }

  private async searchSupabaseUsers(query: string, page: number, limit: number): Promise<UserSearchResult> {
    await this.ensureSupabaseConnection();

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      const currentUser = await supabaseClient.getCurrentUser();
      const offset = (page - 1) * limit;

      try {
        // Search users by nickname (case-insensitive)
        const { data: users, error, count } = await client
          .from('users')
          .select('*', { count: 'exact' })
          .ilike('nickname', `%${query}%`)
          .neq('id', currentUser?.id || '') // Exclude current user
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(`Failed to search users: ${error.message}`);
        }

        const searchResults = await Promise.all(
          (users || []).map(async (user) => {
            const [postsCount, followersCount, followingCount, isFollowing] = await Promise.all([
              this.getSupabasePostsCount(user.id),
              this.getSupabaseFollowersCount(user.id),
              this.getSupabaseFollowingCount(user.id),
              currentUser ? this.getSupabaseFollowStatus(currentUser.id, user.id) : Promise.resolve(false),
            ]);

            return {
              id: user.id,
              nickname: user.nickname,
              bio: user.bio || '',
              avatar: user.avatar_url || '',
              followersCount,
              followingCount,
              postsCount,
              isFollowing,
              createdAt: user.created_at || new Date().toISOString(),
              updatedAt: user.updated_at || new Date().toISOString(),
            };
          })
        );

        const total = count || 0;
        const hasMore = offset + limit < total;

        return {
          users: searchResults,
          total,
          hasMore,
          nextCursor: hasMore ? `page-${page + 1}` : undefined,
        };
      } catch (error) {
        console.error('Failed to search users in Supabase:', error);
        throw error;
      }
    });
  }

  private async getSupabasePostsCount(userId: string): Promise<number> {
    const client = supabaseClient.getClient();
    const { count, error } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.warn(`Failed to get posts count for user ${userId}:`, error);
      return 0;
    }

    return count || 0;
  }

  private async getSupabaseFollowersCount(userId: string): Promise<number> {
    const client = supabaseClient.getClient();
    const { count, error } = await client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (error) {
      console.warn(`Failed to get followers count for user ${userId}:`, error);
      return 0;
    }

    return count || 0;
  }

  private async getSupabaseFollowingCount(userId: string): Promise<number> {
    const client = supabaseClient.getClient();
    const { count, error } = await client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (error) {
      console.warn(`Failed to get following count for user ${userId}:`, error);
      return 0;
    }

    return count || 0;
  }

  private async getSupabaseFollowStatus(currentUserId: string, targetUserId: string): Promise<boolean> {
    const client = supabaseClient.getClient();
    const { data, error } = await client
      .from('follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .limit(1);

    if (error) {
      console.warn(`Failed to get follow status:`, error);
      return false;
    }

    return data && data.length > 0;
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