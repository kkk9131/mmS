import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
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

export class FollowService {
  private static instance: FollowService;
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;
  private followCache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10分間のキャッシュ

  private constructor() {
    this.httpClient = HttpClient.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.followCache = new Map();
  }

  public static getInstance(): FollowService {
    if (!FollowService.instance) {
      FollowService.instance = new FollowService();
    }
    return FollowService.instance;
  }

  /**
   * ユーザーをフォロー
   */
  public async followUser(userId: string): Promise<FollowRelationship> {
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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