import { supabaseApi } from './supabaseApi';
import { Follow, User as SupabaseUser } from '../../types/supabase';
import { supabaseClient } from '../../services/supabase/client';
import { 
  CACHE_TIMES, 
  TAG_TYPES, 
  createOptimisticUpdate,
  getRetryConfig,
  selectiveInvalidateTags
} from './cacheUtils';

// Enhanced Follow interface with user data
interface FollowWithUser {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
  updated_at: string;
  user?: SupabaseUser;
}

// Follow relationship interface
interface FollowRelationship {
  userId: string;
  targetUserId: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  followedAt?: string;
}

// Follow list response
interface FollowListResponse {
  users: FollowUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

interface FollowUser {
  id: string;
  nickname: string;
  avatar: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  mutualFollowersCount: number;
  followedAt?: string;
}

// User stats interface
interface UserStats {
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

// Query parameters
interface GetFollowListParams {
  userId?: string;
  page?: number;
  limit?: number;
}

interface GetFollowRelationshipParams {
  targetUserId: string;
}

interface ToggleFollowParams {
  targetUserId: string;
}

// Follow API slice
export const followApi = supabaseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get follow relationship between current user and target user
    getFollowRelationship: builder.query<FollowRelationship, GetFollowRelationshipParams>({
      queryFn: async ({ targetUserId }, { getState }) => {
        try {
          const state = getState() as any;
          const currentUserId = state.auth?.user?.id || state.auth?.profile?.id;
          
          if (!currentUserId) {
            throw new Error('User not authenticated');
          }

          const client = supabaseClient.getClient();
          const { data, error } = await client
            .rpc('get_follow_relationship', {
              p_user_id: currentUserId,
              p_target_user_id: targetUserId,
            })
            .single();

          if (error) {
            throw new Error(`Failed to get follow relationship: ${error.message}`);
          }

          return {
            data: {
              userId: currentUserId,
              targetUserId,
              isFollowing: data?.is_following || false,
              isFollowedBy: data?.is_followed_by || false,
              followedAt: data?.followed_at || undefined,
            }
          };
        } catch (error) {
          console.error('Failed to get follow relationship:', error);
          return { error: { message: 'Failed to get follow relationship', error } };
        }
      },
      providesTags: (result, error, { targetUserId }) => [
        { type: TAG_TYPES.Follow, id: `RELATIONSHIP_${targetUserId}` },
      ],
      keepUnusedDataFor: CACHE_TIMES.SHORT,
    }),

    // Get following list
    getFollowing: builder.query<FollowListResponse, GetFollowListParams>({
      queryFn: async ({ userId, page = 1, limit = 20 }, { getState }) => {
        try {
          const state = getState() as any;
          const currentUserId = userId || state.auth?.user?.id || state.auth?.profile?.id;
          
          if (!currentUserId) {
            throw new Error('User ID not provided and no authenticated user');
          }

          const client = supabaseClient.getClient();
          const offset = (page - 1) * limit;

          const { data, error } = await client
            .rpc('get_following_with_details', {
              p_user_id: currentUserId,
              p_limit: limit,
              p_offset: offset,
            });

          if (error) {
            throw new Error(`Failed to get following list: ${error.message}`);
          }

          const users: FollowUser[] = (data || []).map((user: any) => ({
            id: user.user_id,
            nickname: user.nickname || 'Unknown',
            avatar: user.avatar_url || '',
            bio: user.bio || '',
            followersCount: Number(user.followers_count) || 0,
            followingCount: Number(user.following_count) || 0,
            isFollowing: user.is_following || false,
            isFollowedBy: user.is_followed_by || false,
            mutualFollowersCount: 0, // Will be calculated if needed
            followedAt: user.followed_at,
          }));

          return {
            data: {
              users,
              total: users.length, // RPC doesn't return total count
              page,
              limit,
              hasMore: users.length === limit,
              nextCursor: users.length === limit ? `page-${page + 1}` : undefined,
            }
          };
        } catch (error) {
          console.error('Failed to get following list:', error);
          return { error: { message: 'Failed to get following list', error } };
        }
      },
      providesTags: (result, error, { userId }) => [
        { type: TAG_TYPES.Follow, id: `FOLLOWING_${userId || 'me'}` },
        ...(result?.users || []).map((user) => ({ 
          type: TAG_TYPES.Follow as const, 
          id: `RELATIONSHIP_${user.id}` 
        })),
      ],
      keepUnusedDataFor: CACHE_TIMES.MEDIUM,
    }),

    // Get followers list
    getFollowers: builder.query<FollowListResponse, GetFollowListParams>({
      queryFn: async ({ userId, page = 1, limit = 20 }, { getState }) => {
        try {
          const state = getState() as any;
          const currentUserId = userId || state.auth?.user?.id || state.auth?.profile?.id;
          
          if (!currentUserId) {
            throw new Error('User ID not provided and no authenticated user');
          }

          const client = supabaseClient.getClient();
          const offset = (page - 1) * limit;

          const { data, error } = await client
            .rpc('get_followers_with_details', {
              p_user_id: currentUserId,
              p_limit: limit,
              p_offset: offset,
            });

          if (error) {
            throw new Error(`Failed to get followers list: ${error.message}`);
          }

          const users: FollowUser[] = (data || []).map((user: any) => ({
            id: user.user_id,
            nickname: user.nickname || 'Unknown',
            avatar: user.avatar_url || '',
            bio: user.bio || '',
            followersCount: Number(user.followers_count) || 0,
            followingCount: Number(user.following_count) || 0,
            isFollowing: user.is_following || false,
            isFollowedBy: user.is_followed_by || false,
            mutualFollowersCount: 0, // Will be calculated if needed
            followedAt: user.followed_at,
          }));

          return {
            data: {
              users,
              total: users.length, // RPC doesn't return total count
              page,
              limit,
              hasMore: users.length === limit,
              nextCursor: users.length === limit ? `page-${page + 1}` : undefined,
            }
          };
        } catch (error) {
          console.error('Failed to get followers list:', error);
          return { error: { message: 'Failed to get followers list', error } };
        }
      },
      providesTags: (result, error, { userId }) => [
        { type: TAG_TYPES.Follow, id: `FOLLOWERS_${userId || 'me'}` },
        ...(result?.users || []).map((user) => ({ 
          type: TAG_TYPES.Follow as const, 
          id: `RELATIONSHIP_${user.id}` 
        })),
      ],
      keepUnusedDataFor: CACHE_TIMES.MEDIUM,
    }),

    // Get user stats
    getUserStats: builder.query<UserStats, { userId: string }>({
      queryFn: async ({ userId }) => {
        try {
          const client = supabaseClient.getClient();
          const { data, error } = await client
            .rpc('get_user_stats', { p_user_id: userId })
            .single();

          if (error) {
            throw new Error(`Failed to get user stats: ${error.message}`);
          }

          return {
            data: {
              postsCount: Number(data?.posts_count) || 0,
              followersCount: Number(data?.followers_count) || 0,
              followingCount: Number(data?.following_count) || 0,
            }
          };
        } catch (error) {
          console.error('Failed to get user stats:', error);
          return { error: { message: 'Failed to get user stats', error } };
        }
      },
      providesTags: (result, error, { userId }) => [
        { type: TAG_TYPES.User, id: `STATS_${userId}` },
      ],
      keepUnusedDataFor: CACHE_TIMES.SHORT,
    }),

    // Toggle follow/unfollow
    toggleFollow: builder.mutation<FollowRelationship, ToggleFollowParams>({
      queryFn: async ({ targetUserId }, { getState }) => {
        try {
          const state = getState() as any;
          const currentUserId = state.auth?.user?.id || state.auth?.profile?.id;
          
          if (!currentUserId) {
            throw new Error('User not authenticated');
          }

          if (currentUserId === targetUserId) {
            throw new Error('Cannot follow yourself');
          }

          const client = supabaseClient.getClient();

          // Check current relationship
          const { data: relationship } = await client
            .rpc('get_follow_relationship', {
              p_user_id: currentUserId,
              p_target_user_id: targetUserId,
            })
            .single();

          const isCurrentlyFollowing = relationship?.is_following || false;

          if (isCurrentlyFollowing) {
            // Unfollow
            const { error } = await client
              .from('follows')
              .delete()
              .eq('follower_id', currentUserId)
              .eq('following_id', targetUserId);

            if (error) {
              throw new Error(`Failed to unfollow: ${error.message}`);
            }

            return {
              data: {
                userId: currentUserId,
                targetUserId,
                isFollowing: false,
                isFollowedBy: relationship?.is_followed_by || false,
              }
            };
          } else {
            // Follow
            const { error } = await client
              .from('follows')
              .insert({
                follower_id: currentUserId,
                following_id: targetUserId,
              });

            if (error) {
              throw new Error(`Failed to follow: ${error.message}`);
            }

            return {
              data: {
                userId: currentUserId,
                targetUserId,
                isFollowing: true,
                isFollowedBy: relationship?.is_followed_by || false,
                followedAt: new Date().toISOString(),
              }
            };
          }
        } catch (error) {
          console.error('Failed to toggle follow:', error);
          return { error: { message: 'Failed to toggle follow', error } };
        }
      },
      invalidatesTags: (result, error, { targetUserId }) => [
        { type: TAG_TYPES.Follow, id: `RELATIONSHIP_${targetUserId}` },
        { type: TAG_TYPES.Follow, id: 'FOLLOWING_me' },
        { type: TAG_TYPES.Follow, id: `FOLLOWERS_${targetUserId}` },
        { type: TAG_TYPES.User, id: `STATS_me` },
        { type: TAG_TYPES.User, id: `STATS_${targetUserId}` },
      ],
      onQueryStarted: async ({ targetUserId }, { dispatch, queryFulfilled, getState }) => {
        // Optimistic updates
        const state = getState() as any;
        const currentUserId = state.auth?.user?.id || state.auth?.profile?.id;
        
        if (!currentUserId) return;

        const patchResults: any[] = [];

        // Update relationship cache
        const relationshipPatch = dispatch(
          followApi.util.updateQueryData('getFollowRelationship', { targetUserId }, (draft) => {
            draft.isFollowing = !draft.isFollowing;
            if (draft.isFollowing) {
              draft.followedAt = new Date().toISOString();
            }
          })
        );
        patchResults.push(relationshipPatch);

        // Update user stats
        const statsPatch = dispatch(
          followApi.util.updateQueryData('getUserStats', { userId: currentUserId }, (draft) => {
            draft.followingCount += draft.isFollowing ? 1 : -1;
          })
        );
        patchResults.push(statsPatch);

        try {
          await queryFulfilled;
        } catch (error) {
          // Rollback optimistic updates on error
          patchResults.forEach((patchResult) => {
            patchResult.undo();
          });
          console.error('Failed to toggle follow:', error);
        }
      },
    }),
  }),
  overrideExisting: true,
});

// Export hooks for usage in components
export const {
  useGetFollowRelationshipQuery,
  useGetFollowingQuery,
  useGetFollowersQuery,
  useGetUserStatsQuery,
  useToggleFollowMutation,
} = followApi;

// Type exports
export type { FollowRelationship, FollowListResponse, FollowUser, UserStats };