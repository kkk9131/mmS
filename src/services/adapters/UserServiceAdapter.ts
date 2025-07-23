import { UserService } from '../UserService';
import { User } from '../../types';
import { FeatureFlagsManager } from '../featureFlags';
import { store, RootState } from '../../store';

/**
 * Adapter class that bridges the existing UserService interface with Supabase backend
 */
export class UserServiceAdapter {
  private static instance: UserServiceAdapter;
  private legacyService: UserService;
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.legacyService = UserService.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): UserServiceAdapter {
    if (!UserServiceAdapter.instance) {
      UserServiceAdapter.instance = new UserServiceAdapter();
    }
    return UserServiceAdapter.instance;
  }

  /**
   * Get user profile by ID
   */
  public async getUserProfile(userId: string): Promise<User> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getUser.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to fetch user from Supabase');
        }

        return this.transformSupabaseUserToLegacy(result.data);
      } catch (error) {
        console.error('Supabase user fetch failed, falling back to legacy:', error);
        return (this.legacyService as any).getUserProfile(userId);
      }
    }

    return (this.legacyService as any).getUserProfile(userId);
  }

  /**
   * Update user profile
   */
  public async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        // Transform legacy updates to Supabase format
        const supabaseUpdates = this.transformLegacyUserToSupabase(updates);
        
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.updateUserProfile.initiate({
            userId,
            data: supabaseUpdates,
          })
        );

        if (result.error) {
          throw new Error('Failed to update user in Supabase');
        }

        return this.transformSupabaseUserToLegacy(result.data);
      } catch (error) {
        console.error('Supabase user update failed, falling back to legacy:', error);
        return this.legacyService.updateProfile({ userId } as any) as any;
      }
    }

    return this.legacyService.updateProfile({ userId } as any) as any;
  }

  /**
   * Search users
   */
  public async searchUsers(query: string, limit = 20): Promise<User[]> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.searchUsers.initiate({ query, limit })
        );

        if (result.error) {
          throw new Error('Failed to search users in Supabase');
        }

        return result.data.map(this.transformSupabaseUserToLegacy);
      } catch (error) {
        console.error('Supabase user search failed, falling back to legacy:', error);
        return this.legacyService.searchUsers(query, limit) as any;
      }
    }

    return this.legacyService.searchUsers(query, limit) as any;
  }

  /**
   * Get user profile with statistics
   */
  public async getUserProfileWithStats(userId: string): Promise<User & { 
    postsCount: number; 
    followersCount: number; 
    followingCount: number; 
  }> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getUserProfileWithCounts.initiate(userId)
        );

        if (result.error) {
          throw new Error('Failed to fetch user profile with stats from Supabase');
        }

        return {
          ...this.transformSupabaseUserToLegacy(result.data),
          postsCount: result.data.postsCount,
          followersCount: result.data.followersCount,
          followingCount: result.data.followingCount,
        };
      } catch (error) {
        console.error('Supabase user profile with stats fetch failed, falling back to legacy:', error);
        // Fall back to legacy service (may not have stats)
        const user = await (this.legacyService as any).getUserProfile(userId);
        return {
          ...user,
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
        };
      }
    }

    // Legacy service fallback
    const user = await (this.legacyService as any).getUserProfile(userId);
    return {
      ...user,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
    };
  }

  /**
   * Check if maternal book number is available
   */
  public async isMaternalBookNumberAvailable(maternalBookNumber: string): Promise<boolean> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.checkMaternalBookAvailability.initiate(maternalBookNumber)
        );

        if (result.error) {
          throw new Error('Failed to check maternal book availability in Supabase');
        }

        return result.data;
      } catch (error) {
        console.error('Supabase maternal book check failed, falling back to legacy:', error);
        // Legacy service may not have this feature
        return true;
      }
    }

    // Legacy service may not have this feature
    return true;
  }

  /**
   * Transform Supabase user data to legacy format
   */
  private transformSupabaseUserToLegacy(supabaseUser: any): User {
    return {
      id: supabaseUser.id,
      nickname: supabaseUser.nickname,
      avatarUrl: supabaseUser.avatar_url,
      createdAt: supabaseUser.created_at,
      // Map additional fields as needed
    } as any;
  }

  /**
   * Transform legacy user data to Supabase format
   */
  private transformLegacyUserToSupabase(legacyUser: any): any {
    return {
      ...(legacyUser.nickname && { nickname: legacyUser.nickname }),
      ...(legacyUser.avatarUrl && { avatar_url: legacyUser.avatarUrl }),
    };
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
  public getLegacyService(): UserService {
    return this.legacyService;
  }
}