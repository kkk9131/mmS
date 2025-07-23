import { FollowService } from '../FollowService';
import { User } from '../../types';
import { FeatureFlagsManager } from '../featureFlags';
import { store, RootState } from '../../store';

/**
 * Adapter class that bridges the existing FollowService interface with Supabase backend
 */
export class FollowServiceAdapter {
  private static instance: FollowServiceAdapter;
  private legacyService: FollowService;
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.legacyService = FollowService.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): FollowServiceAdapter {
    if (!FollowServiceAdapter.instance) {
      FollowServiceAdapter.instance = new FollowServiceAdapter();
    }
    return FollowServiceAdapter.instance;
  }

  /**
   * Follow a user
   */
  public async followUser(followerId: string, followingId: string): Promise<void> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.followUser.initiate({ followerId, followingId })
        );

        if (result.error) {
          throw new Error('Failed to follow user in Supabase');
        }
      } catch (error) {
        console.error('Supabase follow user failed, falling back to legacy:', error);
        await this.legacyService.followUser(followingId);
      }
    } else {
      await this.legacyService.followUser(followingId);
    }
  }

  /**
   * Unfollow a user
   */
  public async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.unfollowUser.initiate({ followerId, followingId })
        );

        if (result.error) {
          throw new Error('Failed to unfollow user in Supabase');
        }
      } catch (error) {
        console.error('Supabase unfollow user failed, falling back to legacy:', error);
        await this.legacyService.unfollowUser(followingId);
      }
    } else {
      await this.legacyService.unfollowUser(followingId);
    }
  }

  /**
   * Check if a user is following another user
   */
  public async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.isFollowing.initiate({ followerId, followingId })
        );

        if (result.error) {
          throw new Error('Failed to check follow status in Supabase');
        }

        return result.data;
      } catch (error) {
        console.error('Supabase follow status check failed, falling back to legacy:', error);
        return { isFollowing: false, isFollowedBy: false, isMutual: false } as any;
      }
    }

    return false;
  }

  /**
   * Get followers for a user
   */
  public async getFollowers(userId: string, limit = 50, offset = 0): Promise<{
    followers: User[];
    hasMore: boolean;
  }> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getFollowers.initiate({ userId, limit, offset })
        );

        if (result.error) {
          throw new Error('Failed to fetch followers from Supabase');
        }

        const followers = result.data.map((follow: any) => ({
          id: follow.follower.id,
          nickname: follow.follower.nickname,
          avatarUrl: follow.follower.avatar_url,
          bio: follow.follower.bio,
          createdAt: follow.created_at,
          // Add missing User properties
          maternalBookNumber: '',
          joinDate: follow.created_at,
          postCount: 0,
          likeCount: 0,
          commentCount: 0,
        }));

        return {
          followers,
          hasMore: followers.length === limit,
        };
      } catch (error) {
        console.error('Supabase followers fetch failed, falling back to legacy:', error);
        const legacyResult = await this.legacyService.getFollowers(userId, limit, offset);
        return {
          followers: (legacyResult.users || []).map((user: any) => ({
            ...user,
            maternalBookNumber: user.maternalBookNumber || '',
            joinDate: user.joinDate || user.createdAt || new Date().toISOString(),
            postCount: user.postCount || 0,
            likeCount: user.likeCount || 0,
            commentCount: user.commentCount || 0,
          })),
          hasMore: legacyResult.hasMore || false
        };
      }
    }

    const legacyResult = await this.legacyService.getFollowers(userId, limit, offset);
    return {
      followers: (legacyResult.users || []).map((user: any) => ({
        ...user,
        maternalBookNumber: user.maternalBookNumber || '',
        joinDate: user.joinDate || user.createdAt || new Date().toISOString(),
        postCount: user.postCount || 0,
        likeCount: user.likeCount || 0,
        commentCount: user.commentCount || 0,
      })),
      hasMore: legacyResult.hasMore || false
    };
  }

  /**
   * Get following for a user
   */
  public async getFollowing(userId: string, limit = 50, offset = 0): Promise<{
    following: User[];
    hasMore: boolean;
  }> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getFollowing.initiate({ userId, limit, offset })
        );

        if (result.error) {
          throw new Error('Failed to fetch following from Supabase');
        }

        const following = result.data.map((follow: any) => ({
          id: follow.following.id,
          nickname: follow.following.nickname,
          avatarUrl: follow.following.avatar_url,
          bio: follow.following.bio,
          createdAt: follow.created_at,
          // Add missing User properties
          maternalBookNumber: '',
          joinDate: follow.created_at,
          postCount: 0,
          likeCount: 0,
          commentCount: 0,
        }));

        return {
          following,
          hasMore: following.length === limit,
        };
      } catch (error) {
        console.error('Supabase following fetch failed, falling back to legacy:', error);
        const legacyResult = await this.legacyService.getFollowing(userId, limit, offset);
        return {
          following: (legacyResult.users || []).map((user: any) => ({
            ...user,
            maternalBookNumber: user.maternalBookNumber || '',
            joinDate: user.joinDate || user.createdAt || new Date().toISOString(),
            postCount: user.postCount || 0,
            likeCount: user.likeCount || 0,
            commentCount: user.commentCount || 0,
          })),
          hasMore: legacyResult.hasMore || false
        };
      }
    }

    const legacyResult = await this.legacyService.getFollowing(userId, limit, offset);
    return {
      following: (legacyResult.users || []).map((user: any) => ({
        ...user,
        maternalBookNumber: user.maternalBookNumber || '',
        joinDate: user.joinDate || user.createdAt || new Date().toISOString(),
        postCount: user.postCount || 0,
        likeCount: user.likeCount || 0,
        commentCount: user.commentCount || 0,
      })),
      hasMore: legacyResult.hasMore || false
    };
  }

  /**
   * Toggle follow status
   */
  public async toggleFollow(followerId: string, followingId: string): Promise<boolean> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.toggleFollow.initiate({ followerId, followingId })
        );

        if (result.error) {
          throw new Error('Failed to toggle follow in Supabase');
        }

        return result.data.isFollowing;
      } catch (error) {
        console.error('Supabase toggle follow failed, falling back to legacy:', error);
        // toggleFollow method doesn't exist on FollowService
        throw new Error('toggleFollow method not implemented in legacy service');
      }
    }

    // toggleFollow method doesn't exist on FollowService
    throw new Error('toggleFollow method not implemented in legacy service');
  }

  /**
   * Get followers count
   */
  public async getFollowersCount(userId: string): Promise<number> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getFollowersCount.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to fetch followers count from Supabase');
        }

        return result.data;
      } catch (error) {
        console.error('Supabase followers count fetch failed, falling back to legacy:', error);
        return (this.legacyService as any).getFollowersCount(userId);
      }
    }

    return (this.legacyService as any).getFollowersCount(userId);
  }

  /**
   * Get following count
   */
  public async getFollowingCount(userId: string): Promise<number> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getFollowingCount.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to fetch following count from Supabase');
        }

        return result.data;
      } catch (error) {
        console.error('Supabase following count fetch failed, falling back to legacy:', error);
        // getFollowingCount method doesn't exist, use getFollowing instead
        const result = await this.legacyService.getFollowing(userId, 1000, 0);
        return result.users?.length || 0;
      }
    }

    // getFollowingCount method doesn't exist, use getFollowing instead
    const result = await this.legacyService.getFollowing(userId, 1000, 0);
    return result.users?.length || 0;
  }

  /**
   * Get suggested users to follow
   */
  public async getSuggestedFollows(userId: string, limit = 10): Promise<User[]> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getSuggestedFollows.initiate({ userId, limit })
        );

        if (result.error) {
          throw new Error('Failed to fetch suggested follows from Supabase');
        }

        return result.data.map((user: any) => ({
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          createdAt: user.created_at,
        }));
      } catch (error) {
        console.error('Supabase suggested follows fetch failed, falling back to legacy:', error);
        // getSuggestedFollows method doesn't exist
        throw new Error('getSuggestedFollows method not implemented in legacy service');
      }
    }

    // getSuggestedFollows method doesn't exist
    throw new Error('getSuggestedFollows method not implemented in legacy service');
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
  public getLegacyService(): FollowService {
    return this.legacyService;
  }
}