import { PostsService } from '../PostsService';
import { Post, User } from '../../types';
import { FeatureFlagsManager } from '../featureFlags';
// Import store type instead of instance to avoid circular dependency
import type { AppStore, RootState } from '../../store';
import { store } from '../../store';
import { 
  useGetPostsQuery, 
  useCreatePostMutation, 
  useToggleLikeMutation,
  useGetCommentsQuery,
  useCreateCommentMutation 
} from '../../store/api/postsApi';

/**
 * Adapter class that bridges the existing PostsService interface with Supabase backend
 * This allows existing components to work without changes while using Supabase
 */
export class PostsServiceAdapter {
  private static instance: PostsServiceAdapter;
  private legacyService: PostsService;
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.legacyService = PostsService.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): PostsServiceAdapter {
    if (!PostsServiceAdapter.instance) {
      PostsServiceAdapter.instance = new PostsServiceAdapter();
    }
    return PostsServiceAdapter.instance;
  }

  /**
   * Get posts - adapts between legacy interface and Supabase API
   */
  public async getPosts(limit = 20, offset = 0): Promise<{ posts: Post[]; hasMore: boolean }> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        // Use RTK Query endpoint
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getPosts.initiate({ limit, offset })
        );

        if (result.error) {
          throw new Error('Failed to fetch posts from Supabase');
        }

        // Transform Supabase data to legacy format
        const transformedPosts: Post[] = result.data.map(this.transformSupabasePostToLegacy);
        
        return {
          posts: transformedPosts,
          hasMore: transformedPosts.length === limit,
        };
      } catch (error) {
        console.error('Supabase posts fetch failed, falling back to legacy:', error);
        // Fall back to legacy service
        const legacyResult = await this.legacyService.getPosts({ limit } as any);
        return { posts: legacyResult.posts as any, hasMore: legacyResult.posts.length === limit };
      }
    }

    const legacyResult = await this.legacyService.getPosts({ limit } as any);
    return { posts: legacyResult.posts as any, hasMore: legacyResult.posts.length === limit };
  }

  /**
   * Create a new post
   */
  public async createPost(content: string, isAnonymous = false, imageUrl?: string): Promise<Post> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const authState = (store.getState() as RootState).auth;
        if (!authState.user) {
          throw new Error('User not authenticated');
        }

        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.createPost.initiate({
            content,
            is_anonymous: isAnonymous,
            image_url: imageUrl,
            user_id: authState.user.id,
          })
        );

        if (result.error) {
          throw new Error('Failed to create post in Supabase');
        }

        return this.transformSupabasePostToLegacy(result.data);
      } catch (error) {
        console.error('Supabase post creation failed, falling back to legacy:', error);
        return this.legacyService.createPost({ content } as any) as any;
      }
    }

    return this.legacyService.createPost({ content } as any) as any;
  }

  /**
   * Toggle like on a post
   */
  public async toggleLike(postId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const authState = (store.getState() as RootState).auth;
        if (!authState.user) {
          throw new Error('User not authenticated');
        }

        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.toggleLike.initiate({
            postId,
            userId: authState.user.id,
          })
        );

        if (result.error) {
          throw new Error('Failed to toggle like in Supabase');
        }

        return {
          isLiked: result.data.liked,
          likesCount: result.data.likesCount,
        };
      } catch (error) {
        console.error('Supabase like toggle failed, falling back to legacy:', error);
        return (this.legacyService as any).toggleLike(postId);
      }
    }

    return (this.legacyService as any).toggleLike(postId);
  }

  /**
   * Get comments for a post
   */
  public async getComments(postId: string): Promise<any[]> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.getComments.initiate(postId)
        );

        if (result.error) {
          throw new Error('Failed to fetch comments from Supabase');
        }

        // Transform Supabase comments to legacy format
        return result.data.map((comment: any) => ({
          id: comment.id,
          postId: comment.post_id,
          userId: comment.user_id,
          content: comment.content,
          isAnonymous: comment.is_anonymous,
          createdAt: comment.created_at,
          user: {
            id: comment.users?.id,
            nickname: comment.users?.nickname,
            avatarUrl: comment.users?.avatar_url,
          },
        }));
      } catch (error) {
        console.error('Supabase comments fetch failed, falling back to legacy:', error);
        return this.legacyService.getComments(postId) as any;
      }
    }

    return this.legacyService.getComments(postId) as any;
  }

  /**
   * Add a comment to a post
   */
  public async addComment(postId: string, content: string, isAnonymous = false): Promise<any> {
    const useSupabase = this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
    
    if (useSupabase) {
      try {
        const authState = (store.getState() as RootState).auth;
        if (!authState.user) {
          throw new Error('User not authenticated');
        }

        const result = await store.dispatch(
          (store.getState() as RootState & any).api.endpoints.createComment.initiate({
            post_id: postId,
            content,
            is_anonymous: isAnonymous,
            user_id: authState.user.id,
          })
        );

        if (result.error) {
          throw new Error('Failed to create comment in Supabase');
        }

        // Transform to legacy format
        return {
          id: result.data.id,
          postId: result.data.post_id,
          userId: result.data.user_id,
          content: result.data.content,
          isAnonymous: result.data.is_anonymous,
          createdAt: result.data.created_at,
        };
      } catch (error) {
        console.error('Supabase comment creation failed, falling back to legacy:', error);
        return this.legacyService.createComment(postId, { 
          content, 
          userId: 'current-user-id' 
        } as any);
      }
    }

    return this.legacyService.createComment(postId, { 
      content, 
      userId: 'current-user-id' 
    } as any) as any;
  }

  /**
   * Transform Supabase post data to legacy format
   */
  private transformSupabasePostToLegacy(supabasePost: any): Post {
    return {
      id: supabasePost.id,
      userId: supabasePost.user_id,
      content: supabasePost.content,
      imageUrl: supabasePost.image_url,
      isAnonymous: supabasePost.is_anonymous,
      likesCount: supabasePost.likes_count || 0,
      commentsCount: supabasePost.comments_count || 0,
      createdAt: supabasePost.created_at,
      updatedAt: supabasePost.updated_at,
      author: supabasePost.users?.nickname || 'Anonymous',
      timestamp: new Date(supabasePost.created_at).getTime(),
      likes: [],
      comments: [],
      tags: [],
      user: supabasePost.users ? {
        id: supabasePost.users.id,
        nickname: supabasePost.users.nickname,
        avatarUrl: supabasePost.users.avatar_url,
        createdAt: supabasePost.users.created_at,
      } : undefined,
    } as any;
  }

  /**
   * Check if Supabase integration is available
   */
  public isSupabaseEnabled(): boolean {
    return this.featureFlags.isSupabaseEnabled() && this.featureFlags.isReduxEnabled();
  }

  /**
   * Get the underlying legacy service (for direct access if needed)
   */
  public getLegacyService(): PostsService {
    return this.legacyService;
  }
}