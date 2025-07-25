// Export all service adapters
import { PostsServiceAdapter } from './PostsServiceAdapter';
import { UserServiceAdapter } from './UserServiceAdapter';
import { NotificationServiceAdapter } from './NotificationServiceAdapter';
import { FollowServiceAdapter } from './FollowServiceAdapter';

// Service factory to get the appropriate service based on feature flags
import { FeatureFlagsManager } from '../featureFlags';
import { PostsService } from '../PostsService';
import { UserService } from '../UserService';
import { NotificationService } from '../NotificationService';
import { FollowService } from '../FollowService';

export { PostsServiceAdapter, UserServiceAdapter, NotificationServiceAdapter, FollowServiceAdapter };

export class ServiceFactory {
  private static featureFlags = FeatureFlagsManager.getInstance();

  /**
   * Get the appropriate PostsService based on feature flags
   */
  static getPostsService() {
    if (this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled()) {
      return PostsServiceAdapter.getInstance();
    }
    return PostsService.getInstance();
  }

  /**
   * Get the appropriate UserService based on feature flags
   */
  static getUserService() {
    if (this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled()) {
      return UserServiceAdapter.getInstance();
    }
    return UserService.getInstance();
  }

  /**
   * Get the appropriate NotificationService based on feature flags
   */
  static getNotificationService() {
    if (this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled()) {
      return NotificationServiceAdapter.getInstance();
    }
    return NotificationService.getInstance();
  }

  /**
   * Get the appropriate FollowService based on feature flags
   */
  static getFollowService() {
    if (this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled()) {
      return FollowServiceAdapter.getInstance();
    }
    return FollowService.getInstance();
  }

  /**
   * Check if Supabase integration is enabled
   */
  static isSupabaseEnabled(): boolean {
    return this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
  }
}