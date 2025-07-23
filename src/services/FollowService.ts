import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
import { supabaseClient } from './supabase/client';
import { NotificationService } from './NotificationService';
import {
  Follow as SupabaseFollow,
  FollowInsert,
  User as SupabaseUser,
} from '../types/supabase';
import {
  FollowRelationship,
  FollowUser,
  FollowListResponse,
  FollowRequest,
  FollowRequestsResponse,
  FollowStats,
  FollowSuggestion,
  FollowSuggestionsResponse,
  FollowRequestStatus,
  FollowSuggestionReason,
} from '../types/follow';
import { ApiResponse } from '../types/api';
import { NotificationType } from '../types/notifications';

export class FollowService {
  private static instance: FollowService;
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;
  private followCache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10分間のキャッシュ
  private notificationService: NotificationService;

  private constructor() {
    this.httpClient = HttpClient.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.followCache = new Map();
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): FollowService {
    if (!FollowService.instance) {
      FollowService.instance = new FollowService();
    }
    return FollowService.instance;
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
   * ユーザーをフォロー
   */
  public async followUser(userId: string): Promise<FollowRelationship> {
    if (this.shouldUseRTKQuery()) {
      console.info('RTK Query is available - consider using useFollowUserMutation hook');
    }

    if (this.featureFlags.isSupabaseEnabled()) {
      return this.followSupabaseUser(userId);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<FollowRelationship> = await this.httpClient.post<FollowRelationship>(`/users/${userId}/follow`);
        
        // 関連キャッシュをクリア
        this.clearFollowRelatedCache(userId);
        
        return response.data;
      } catch (error) {
        console.error(`Failed to follow user ${userId}:`, error);
        throw error;
      }
    } else {
      return this.getMockFollowRelationship(userId, true);
    }
  }

  /**
   * ユーザーのフォローを解除
   */
  public async unfollowUser(userId: string): Promise<FollowRelationship> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.unfollowSupabaseUser(userId);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<FollowRelationship> = await this.httpClient.delete<FollowRelationship>(`/users/${userId}/follow`);
        
        // 関連キャッシュをクリア
        this.clearFollowRelatedCache(userId);
        
        return response.data;
      } catch (error) {
        console.error(`Failed to unfollow user ${userId}:`, error);
        throw error;
      }
    } else {
      return this.getMockFollowRelationship(userId, false);
    }
  }

  /**
   * フォロー関係を確認
   */
  public async getFollowRelationship(userId: string): Promise<FollowRelationship> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseFollowRelationship(userId);
    } else if (this.featureFlags.isApiEnabled()) {
      const cacheKey = `relationship-${userId}`;
      const cached = this.getFromCache<FollowRelationship>(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const response: ApiResponse<FollowRelationship> = await this.httpClient.get<FollowRelationship>(`/users/${userId}/relationship`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error(`Failed to get follow relationship with user ${userId}:`, error);
        throw error;
      }
    } else {
      return this.getMockFollowRelationship(userId, Math.random() > 0.5);
    }
  }

  /**
   * フォロー中のユーザー一覧を取得
   */
  public async getFollowing(userId?: string, page: number = 1, limit: number = 20): Promise<FollowListResponse> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseFollowing(userId, page, limit);
    } else if (this.featureFlags.isApiEnabled()) {
      const targetUserId = userId || 'me';
      const cacheKey = `following-${targetUserId}-${page}-${limit}`;
      const cached = this.getFromCache<FollowListResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      try {
        const response: ApiResponse<FollowListResponse> = await this.httpClient.get<FollowListResponse>(`/users/${targetUserId}/following?${params.toString()}`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error(`Failed to get following list for user ${targetUserId}:`, error);
        throw error;
      }
    } else {
      return this.getMockFollowList('following', page, limit);
    }
  }

  /**
   * フォロワー一覧を取得
   */
  public async getFollowers(userId?: string, page: number = 1, limit: number = 20): Promise<FollowListResponse> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseFollowers(userId, page, limit);
    } else if (this.featureFlags.isApiEnabled()) {
      const targetUserId = userId || 'me';
      const cacheKey = `followers-${targetUserId}-${page}-${limit}`;
      const cached = this.getFromCache<FollowListResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      try {
        const response: ApiResponse<FollowListResponse> = await this.httpClient.get<FollowListResponse>(`/users/${targetUserId}/followers?${params.toString()}`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error(`Failed to get followers list for user ${targetUserId}:`, error);
        throw error;
      }
    } else {
      return this.getMockFollowList('followers', page, limit);
    }
  }

  /**
   * フォロー統計情報を取得
   */
  public async getFollowStats(userId?: string): Promise<FollowStats> {
    if (this.featureFlags.isApiEnabled()) {
      const targetUserId = userId || 'me';
      const cacheKey = `stats-${targetUserId}`;
      const cached = this.getFromCache<FollowStats>(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const response: ApiResponse<FollowStats> = await this.httpClient.get<FollowStats>(`/users/${targetUserId}/follow-stats`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error(`Failed to get follow stats for user ${targetUserId}:`, error);
        throw error;
      }
    } else {
      return this.getMockFollowStats();
    }
  }

  /**
   * フォロー推奨ユーザーを取得
   */
  public async getFollowSuggestions(limit: number = 10): Promise<FollowSuggestionsResponse> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseFollowSuggestions(limit);
    } else if (this.featureFlags.isApiEnabled()) {
      const cacheKey = `suggestions-${limit}`;
      const cached = this.getFromCache<FollowSuggestionsResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
      });

      try {
        const response: ApiResponse<FollowSuggestionsResponse> = await this.httpClient.get<FollowSuggestionsResponse>(`/follow/suggestions?${params.toString()}`);
        this.setCache(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to get follow suggestions:', error);
        throw error;
      }
    } else {
      return this.getMockFollowSuggestions(limit);
    }
  }

  /**
   * 楽観的更新: フォロー状態を即座に更新
   */
  public optimisticallyUpdateFollow(userId: string, isFollowing: boolean): void {
    // キャッシュ内のフォロー状態を即座に更新
    const relationshipKey = `relationship-${userId}`;
    const cached = this.followCache.get(relationshipKey);
    if (cached) {
      (cached.data as FollowRelationship).isFollowing = isFollowing;
      (cached.data as FollowRelationship).followedAt = isFollowing ? new Date().toISOString() : undefined;
    }

    // フォロー統計も更新
    const statsKey = 'stats-me';
    const statsCached = this.followCache.get(statsKey);
    if (statsCached) {
      const stats = statsCached.data as FollowStats;
      stats.followingCount += isFollowing ? 1 : -1;
    }
  }

  /**
   * バッチでフォロー関係を確認
   */
  public async getMultipleFollowRelationships(userIds: string[]): Promise<FollowRelationship[]> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseMultipleFollowRelationships(userIds);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<{ relationships: FollowRelationship[] }> = await this.httpClient.post<{ relationships: FollowRelationship[] }>('/users/relationships', { userIds });
        
        // 個別にキャッシュ
        response.data.relationships.forEach(relationship => {
          this.setCache(`relationship-${relationship.targetUserId}`, relationship);
        });
        
        return response.data.relationships;
      } catch (error) {
        console.error('Failed to get multiple follow relationships:', error);
        throw error;
      }
    } else {
      return userIds.map(userId => this.getMockFollowRelationship(userId, Math.random() > 0.5));
    }
  }

  /**
   * キャッシュから取得
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.followCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    if (cached) {
      this.followCache.delete(key);
    }
    return null;
  }

  /**
   * キャッシュに保存
   */
  private setCache(key: string, data: any): void {
    this.followCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * フォロー関連のキャッシュをクリア
   */
  private clearFollowRelatedCache(userId: string): void {
    const keysToDelete = Array.from(this.followCache.keys()).filter(key =>
      key.includes(`relationship-${userId}`) ||
      key.includes('following-') ||
      key.includes('followers-') ||
      key.includes('stats-') ||
      key.includes('suggestions-')
    );
    
    keysToDelete.forEach(key => this.followCache.delete(key));
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.followCache.clear();
  }

  // === Supabase機能 ===

  private async followSupabaseUser(userId: string): Promise<FollowRelationship> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    if (currentUser.id === userId) {
      throw new Error('Cannot follow yourself');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        // Check if already following
        const { data: existingFollow } = await client
          .from('follows')
          .select('id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .single();

        if (existingFollow) {
          // Already following, return current relationship
          return this.getSupabaseFollowRelationship(userId);
        }

        // Create follow relationship
        const { error: followError } = await client
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: userId,
          });

        if (followError) {
          throw new Error(`Failed to follow user: ${followError.message}`);
        }

        // Clear related cache
        this.clearFollowRelatedCache(userId);

        // Create notification for the followed user
        if (this.notificationService) {
          try {
            await this.notificationService.createNotification({
              userId: userId,
              type: 'follow' as any,
              title: 'New Follower',
              message: `${currentUser.user_metadata?.nickname || 'Someone'} started following you`,
              data: {
                sender_id: currentUser.id,
                sender_name: currentUser.user_metadata?.nickname || '',
                sender_avatar: currentUser.user_metadata?.avatar_url || '',
              },
            });
          } catch (notifError) {
            console.warn('Failed to create follow notification:', notifError);
            // Don't fail the whole operation for notification error
          }
        }

        return {
          userId: currentUser.id,
          targetUserId: userId,
          isFollowing: true,
          isFollowedBy: false, // We don't know yet
          followedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`Failed to follow user ${userId} in Supabase:`, error);
        throw error;
      }
    });
  }

  private async unfollowSupabaseUser(userId: string): Promise<FollowRelationship> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        // Remove follow relationship
        const { error: unfollowError } = await client
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId);

        if (unfollowError) {
          throw new Error(`Failed to unfollow user: ${unfollowError.message}`);
        }

        // Clear related cache
        this.clearFollowRelatedCache(userId);

        return {
          userId: currentUser.id,
          targetUserId: userId,
          isFollowing: false,
          isFollowedBy: false, // We don't know yet
        };
      } catch (error) {
        console.error(`Failed to unfollow user ${userId} in Supabase:`, error);
        throw error;
      }
    });
  }

  private async getSupabaseFollowRelationship(userId: string): Promise<FollowRelationship> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        // Check if current user is following target user
        const { data: following } = await client
          .from('follows')
          .select('created_at')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .single();

        // Check if target user is following current user
        const { data: followedBy } = await client
          .from('follows')
          .select('id')
          .eq('follower_id', userId)
          .eq('following_id', currentUser.id)
          .single();

        return {
          userId: currentUser.id,
          targetUserId: userId,
          isFollowing: !!following,
          isFollowedBy: !!followedBy,
          followedAt: following?.created_at,
        };
      } catch (error) {
        console.error(`Failed to get follow relationship for user ${userId}:`, error);
        throw error;
      }
    });
  }

  private async getSupabaseFollowing(userId?: string, page: number = 1, limit: number = 20): Promise<FollowListResponse> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();
    const targetUserId = userId || currentUser?.id;

    if (!targetUserId) {
      throw new Error('User ID not provided and no authenticated user');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      const offset = (page - 1) * limit;

      try {
        const { data: follows, error, count } = await client
          .from('follows')
          .select(`
            created_at,
            users!follows_following_id_fkey (
              id,
              nickname,
              avatar_url,
              bio
            )
          `, { count: 'exact' })
          .eq('follower_id', targetUserId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(`Failed to fetch following list: ${error.message}`);
        }

        const transformedUsers = await Promise.all(
          (follows || []).map(async (follow: any) => {
            const user = follow.users;
            
            // Get additional stats for each user
            const [postsCount, followersCount, followingCount, isFollowing, isFollowedBy, mutualCount] = await Promise.all([
              this.getSupabaseUserPostsCount(user.id),
              this.getSupabaseUserFollowersCount(user.id),
              this.getSupabaseUserFollowingCount(user.id),
              currentUser && currentUser.id !== user.id ? this.getSupabaseIsFollowing(currentUser.id, user.id) : Promise.resolve(true),
              currentUser && currentUser.id !== user.id ? this.getSupabaseIsFollowing(user.id, currentUser.id) : Promise.resolve(false),
              currentUser ? this.getSupabaseMutualFollowersCount(currentUser.id, user.id) : Promise.resolve(0),
            ]);

            return {
              id: user.id,
              nickname: user.nickname || 'Unknown',
              avatar: user.avatar_url || '',
              bio: user.bio || '',
              followersCount,
              followingCount,
              isFollowing,
              isFollowedBy,
              mutualFollowersCount: mutualCount,
              followedAt: follow.created_at,
            };
          })
        );

        const total = count || 0;
        const hasMore = offset + limit < total;

        return {
          users: transformedUsers,
          total,
          page,
          limit,
          hasMore,
          nextCursor: hasMore ? `page-${page + 1}` : undefined,
        };
      } catch (error) {
        console.error(`Failed to get following list from Supabase:`, error);
        throw error;
      }
    });
  }

  private async getSupabaseFollowers(userId?: string, page: number = 1, limit: number = 20): Promise<FollowListResponse> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();
    const targetUserId = userId || currentUser?.id;

    if (!targetUserId) {
      throw new Error('User ID not provided and no authenticated user');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      const offset = (page - 1) * limit;

      try {
        const { data: follows, error, count } = await client
          .from('follows')
          .select(`
            created_at,
            users!follows_follower_id_fkey (
              id,
              nickname,
              avatar_url,
              bio
            )
          `, { count: 'exact' })
          .eq('following_id', targetUserId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(`Failed to fetch followers list: ${error.message}`);
        }

        const transformedUsers = await Promise.all(
          (follows || []).map(async (follow: any) => {
            const user = follow.users;
            
            // Get additional stats for each user
            const [followersCount, followingCount, isFollowing, isFollowedBy, mutualCount] = await Promise.all([
              this.getSupabaseUserFollowersCount(user.id),
              this.getSupabaseUserFollowingCount(user.id),
              currentUser && currentUser.id !== user.id ? this.getSupabaseIsFollowing(currentUser.id, user.id) : Promise.resolve(false),
              currentUser && currentUser.id !== user.id ? this.getSupabaseIsFollowing(user.id, currentUser.id) : Promise.resolve(true),
              currentUser ? this.getSupabaseMutualFollowersCount(currentUser.id, user.id) : Promise.resolve(0),
            ]);

            return {
              id: user.id,
              nickname: user.nickname || 'Unknown',
              avatar: user.avatar_url || '',
              bio: user.bio || '',
              followersCount,
              followingCount,
              isFollowing,
              isFollowedBy,
              mutualFollowersCount: mutualCount,
              followedAt: follow.created_at,
            };
          })
        );

        const total = count || 0;
        const hasMore = offset + limit < total;

        return {
          users: transformedUsers,
          total,
          page,
          limit,
          hasMore,
          nextCursor: hasMore ? `page-${page + 1}` : undefined,
        };
      } catch (error) {
        console.error(`Failed to get followers list from Supabase:`, error);
        throw error;
      }
    });
  }

  private async getSupabaseFollowSuggestions(limit: number = 10): Promise<FollowSuggestionsResponse> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        // Get users that current user is not following
        // Start with users who have mutual followers
        const { data: suggestions, error } = await client
          .from('users')
          .select('id, nickname, avatar_url, bio, created_at')
          .neq('id', currentUser.id)
          .limit(limit * 3); // Get more to filter

        if (error) {
          throw new Error(`Failed to fetch user suggestions: ${error.message}`);
        }

        // Filter out users already being followed
        const { data: currentFollowing } = await client
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id);

        const followingIds = new Set(currentFollowing?.map(f => f.following_id) || []);
        const unfollowedUsers = (suggestions || []).filter(user => !followingIds.has(user.id));

        // Score and transform suggestions
        const scoredSuggestions = await Promise.all(
          unfollowedUsers.slice(0, limit).map(async (user) => {
            const [followersCount, followingCount, mutualFollowersCount] = await Promise.all([
              this.getSupabaseUserFollowersCount(user.id),
              this.getSupabaseUserFollowingCount(user.id),
              this.getSupabaseMutualFollowersCount(currentUser.id, user.id),
            ]);

            // Simple scoring algorithm
            let score = 0;
            let reason = 'popular_user' as any;

            if (mutualFollowersCount > 0) {
              score += mutualFollowersCount * 10;
              reason = 'mutual_followers';
            } else if (followersCount > 100) {
              score += 5;
              reason = 'popular_user';
            } else {
              score += Math.random() * 3;
              reason = 'suggested_for_you';
            }

            // Get mutual followers for display
            const { data: mutualFollowers } = await client
              .from('follows')
              .select(`
                users!follows_follower_id_fkey (
                  id,
                  nickname,
                  avatar_url
                )
              `)
              .eq('following_id', user.id)
              .in('follower_id', 
                currentFollowing?.map(f => f.following_id) || []
              )
              .limit(3);

            return {
              user: {
                id: user.id,
                nickname: user.nickname || 'Unknown',
                avatar: user.avatar_url || '',
                bio: user.bio || '',
                followersCount,
                followingCount,
                isFollowing: false,
                isFollowedBy: false,
                mutualFollowersCount,
              },
              reason,
              score,
              mutualFollowers: (mutualFollowers || []).map((mf: any) => ({
                id: mf?.users?.id || mf?.id,
                nickname: mf?.users?.nickname || mf?.nickname || 'Unknown',
                avatar: mf?.users?.avatar_url || mf?.avatar_url || '',
                bio: '',
                followersCount: 0,
                followingCount: 0,
                isFollowing: true,
                isFollowedBy: true,
              })),
            };
          })
        );

        // Sort by score
        scoredSuggestions.sort((a, b) => b.score - a.score);

        return {
          suggestions: scoredSuggestions,
          total: unfollowedUsers.length,
          hasMore: unfollowedUsers.length > limit,
        };
      } catch (error) {
        console.error('Failed to get follow suggestions from Supabase:', error);
        throw error;
      }
    });
  }

  private async getSupabaseMultipleFollowRelationships(userIds: string[]): Promise<FollowRelationship[]> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
        // Get all follows where current user is following any of the target users
        const { data: following } = await client
          .from('follows')
          .select('following_id, created_at')
          .eq('follower_id', currentUser.id)
          .in('following_id', userIds);

        // Get all follows where any of the target users are following current user
        const { data: followedBy } = await client
          .from('follows')
          .select('follower_id')
          .eq('following_id', currentUser.id)
          .in('follower_id', userIds);

        const followingMap = new Map(following?.map(f => [f.following_id, f.created_at]) || []);
        const followedBySet = new Set(followedBy?.map(f => f.follower_id) || []);

        return userIds.map(userId => ({
          userId: currentUser.id,
          targetUserId: userId,
          isFollowing: followingMap.has(userId),
          isFollowedBy: followedBySet.has(userId),
          followedAt: followingMap.get(userId),
        }));
      } catch (error) {
        console.error('Failed to get multiple follow relationships from Supabase:', error);
        throw error;
      }
    });
  }

  // Helper methods
  private async getSupabaseUserPostsCount(userId: string): Promise<number> {
    try {
      const client = supabaseClient.getClient();
      const { count } = await client
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 0;
    } catch {
      return 0;
    }
  }

  private async getSupabaseUserFollowersCount(userId: string): Promise<number> {
    try {
      const client = supabaseClient.getClient();
      const { count } = await client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      return count || 0;
    } catch {
      return 0;
    }
  }

  private async getSupabaseUserFollowingCount(userId: string): Promise<number> {
    try {
      const client = supabaseClient.getClient();
      const { count } = await client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      return count || 0;
    } catch {
      return 0;
    }
  }

  private async getSupabaseIsFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const client = supabaseClient.getClient();
      const { data } = await client
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();
      return !!data;
    } catch {
      return false;
    }
  }

  private async getSupabaseMutualFollowersCount(userId1: string, userId2: string): Promise<number> {
    try {
      const client = supabaseClient.getClient();
      
      // Get followers of user1
      const { data: user1Followers } = await client
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId1);

      // Get followers of user2
      const { data: user2Followers } = await client
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId2);

      if (!user1Followers || !user2Followers) return 0;

      const user1FollowerIds = new Set(user1Followers.map(f => f.follower_id));
      const mutualCount = user2Followers.filter(f => user1FollowerIds.has(f.follower_id)).length;
      
      return mutualCount;
    } catch {
      return 0;
    }
  }

  // === モック機能 ===

  private getMockFollowRelationship(userId: string, isFollowing: boolean): FollowRelationship {
    return {
      userId: 'current-user-id',
      targetUserId: userId,
      isFollowing,
      isFollowedBy: Math.random() > 0.7,
      followedAt: isFollowing ? new Date().toISOString() : undefined,
    };
  }

  private getMockFollowList(type: 'following' | 'followers', page: number, limit: number): FollowListResponse {
    const users: FollowUser[] = Array.from({ length: Math.min(limit, 20) }, (_, index) => {
      const globalIndex = (page - 1) * limit + index;
      return {
        id: `${type}-user-${globalIndex}`,
        nickname: `${type === 'following' ? 'フォロー中' : 'フォロワー'}${globalIndex + 1}`,
        avatar: `https://example.com/avatar${globalIndex % 10}.jpg`,
        bio: `${type === 'following' ? 'フォロー中の' : 'フォロワーの'}ユーザーです`,
        followersCount: Math.floor(Math.random() * 200),
        followingCount: Math.floor(Math.random() * 150),
        isFollowing: type === 'following' ? true : Math.random() > 0.5,
        isFollowedBy: type === 'followers' ? true : Math.random() > 0.5,
        mutualFollowersCount: Math.floor(Math.random() * 20),
        followedAt: new Date(Date.now() - globalIndex * 86400000).toISOString(), // 日数分古く
      };
    });

    return {
      users,
      total: Math.floor(Math.random() * 200) + 50,
      page,
      limit,
      hasMore: page < 5,
      nextCursor: page < 5 ? `page-${page + 1}` : undefined,
    };
  }

  private getMockFollowStats(): FollowStats {
    return {
      followersCount: Math.floor(Math.random() * 300) + 50,
      followingCount: Math.floor(Math.random() * 200) + 30,
      mutualFollowsCount: Math.floor(Math.random() * 50) + 10,
      pendingRequestsCount: Math.floor(Math.random() * 5),
    };
  }

  private getMockFollowSuggestions(limit: number): FollowSuggestionsResponse {
    const reasons = Object.values(FollowSuggestionReason);
    
    const suggestions: FollowSuggestion[] = Array.from({ length: Math.min(limit, 10) }, (_, index) => {
      const reason = reasons[index % reasons.length];
      
      return {
        user: {
          id: `suggested-user-${index}`,
          nickname: `おすすめユーザー${index + 1}`,
          avatar: `https://example.com/avatar${index}.jpg`,
          bio: '同じような投稿をしています',
          followersCount: Math.floor(Math.random() * 100),
          followingCount: Math.floor(Math.random() * 80),
          isFollowing: false,
          isFollowedBy: false,
          mutualFollowersCount: Math.floor(Math.random() * 10),
        },
        reason,
        score: Math.random() * 100,
        mutualFollowers: Array.from({ length: Math.min(3, Math.floor(Math.random() * 5)) }, (_, mIndex) => ({
          id: `mutual-${index}-${mIndex}`,
          nickname: `共通フォロワー${mIndex + 1}`,
          avatar: `https://example.com/avatar${mIndex}.jpg`,
          bio: '',
          followersCount: 0,
          followingCount: 0,
          isFollowing: true,
          isFollowedBy: true,
        })),
      };
    });

    return {
      suggestions,
      total: Math.floor(Math.random() * 50) + 20,
      hasMore: limit < 20,
    };
  }
}