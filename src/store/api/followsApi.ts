import { supabaseApi } from './supabaseApi';
import { Follow, User } from '../../types/supabase';
import { notificationsApi, NotificationType } from './notificationsApi';

// Enhanced follow interface with user data
interface FollowWithUser extends Follow {
  follower?: User;
  following?: User;
}

// Follow relationship status
interface FollowRelationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
}

// Follow stats interface
interface FollowStats {
  followersCount: number;
  followingCount: number;
  mutualCount: number;
  recentFollowers: User[];
  recentFollowing: User[];
}

// Batch follow operation
interface BatchFollowOperation {
  userIds: string[];
  action: 'follow' | 'unfollow';
}

// Follows API slice
export const followsApi: any = supabaseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get followers for a user
    getFollowers: builder.query<(Follow & { follower: User })[], { userId: string; limit?: number; offset?: number }>({
      query: ({ userId, limit = 50, offset = 0 }) => ({
        table: 'follows',
        method: 'select',
        query: `
          *,
          follower:follower_id (
            id,
            nickname,
            avatar_url,
            bio
          )
        `,
        options: {
          eq: { following_id: userId },
          order: { column: 'created_at', ascending: false },
          range: { from: offset, to: offset + limit - 1 },
        },
      }),
      providesTags: (result, error, { userId }) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Follow', id } as const)),
              { type: 'Follow', id: `FOLLOWERS_${userId}` },
            ]
          : [{ type: 'Follow', id: `FOLLOWERS_${userId}` }],
    }),

    // Get following for a user
    getFollowing: builder.query<(Follow & { following: User })[], { userId: string; limit?: number; offset?: number }>({
      query: ({ userId, limit = 50, offset = 0 }) => ({
        table: 'follows',
        method: 'select',
        query: `
          *,
          following:following_id (
            id,
            nickname,
            avatar_url,
            bio
          )
        `,
        options: {
          eq: { follower_id: userId },
          order: { column: 'created_at', ascending: false },
          range: { from: offset, to: offset + limit - 1 },
        },
      }),
      providesTags: (result, error, { userId }) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Follow', id } as const)),
              { type: 'Follow', id: `FOLLOWING_${userId}` },
            ]
          : [{ type: 'Follow', id: `FOLLOWING_${userId}` }],
    }),

    // Check if user is following another user
    isFollowing: builder.query<boolean, { followerId: string; followingId: string }>({
      query: ({ followerId, followingId }) => ({
        table: 'follows',
        method: 'select',
        query: 'id',
        options: {
          eq: { follower_id: followerId, following_id: followingId },
          single: true,
        },
      }),
      transformResponse: (response: any) => !!response,
      providesTags: (result, error, { followerId, followingId }) => [
        { type: 'Follow', id: `${followerId}_${followingId}` },
      ],
    }),

    // Follow a user
    followUser: builder.mutation<Follow, { followerId: string; followingId: string }>({
      query: ({ followerId, followingId }) => ({
        table: 'follows',
        method: 'insert',
        data: {
          follower_id: followerId,
          following_id: followingId,
        },
      }),
      invalidatesTags: (result, error, { followerId, followingId }) => [
        { type: 'Follow', id: `${followerId}_${followingId}` },
        { type: 'Follow', id: `FOLLOWERS_${followingId}` },
        { type: 'Follow', id: `FOLLOWING_${followerId}` },
        { type: 'User', id: `FOLLOWERS_COUNT_${followingId}` },
        { type: 'User', id: `FOLLOWING_COUNT_${followerId}` },
      ],
      onQueryStarted: async ({ followerId, followingId }, { dispatch, queryFulfilled }) => {
        // Optimistic update for isFollowing
        const patchResult = dispatch(
          followsApi.util.updateQueryData(
            'isFollowing',
            { followerId, followingId },
            () => true
          )
        );

        // Optimistic update for following list
        const followingPatchResult = dispatch(
          followsApi.util.updateQueryData(
            'getFollowing',
            { userId: followerId },
            (draft: any) => {
              const optimisticFollow = {
                id: `temp-${Date.now()}`,
                follower_id: followerId,
                following_id: followingId,
                created_at: new Date().toISOString(),
                following: {
                  id: followingId,
                  nickname: 'Loading...',
                  avatar_url: null,
                  bio: null,
                } as User,
              } as Follow & { following: User };
              draft.unshift(optimisticFollow);
            }
          )
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          followingPatchResult.undo();
        }
      },
    }),

    // Unfollow a user
    unfollowUser: builder.mutation<void, { followerId: string; followingId: string }>({
      query: ({ followerId, followingId }) => ({
        table: 'follows',
        method: 'delete',
        options: {
          eq: { follower_id: followerId, following_id: followingId },
        },
      }),
      invalidatesTags: (result, error, { followerId, followingId }) => [
        { type: 'Follow', id: `${followerId}_${followingId}` },
        { type: 'Follow', id: `FOLLOWERS_${followingId}` },
        { type: 'Follow', id: `FOLLOWING_${followerId}` },
        { type: 'User', id: `FOLLOWERS_COUNT_${followingId}` },
        { type: 'User', id: `FOLLOWING_COUNT_${followerId}` },
      ],
      onQueryStarted: async ({ followerId, followingId }, { dispatch, queryFulfilled }) => {
        // Optimistic update for isFollowing
        const patchResult = dispatch(
          followsApi.util.updateQueryData(
            'isFollowing',
            { followerId, followingId },
            () => false
          )
        );

        // Optimistic update for following list
        const followingPatchResult = dispatch(
          followsApi.util.updateQueryData(
            'getFollowing',
            { userId: followerId },
            (draft: any) => {
              const index = draft.findIndex(
                (follow: any) => follow.following_id === followingId
              );
              if (index !== -1) {
                draft.splice(index, 1);
              }
            }
          )
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          followingPatchResult.undo();
        }
      },
    }),

    // Toggle follow status
    toggleFollow: builder.mutation<{ isFollowing: boolean }, { followerId: string; followingId: string }>({
      queryFn: async ({ followerId, followingId }, { dispatch }): Promise<any> => {
        try {
          // Check current follow status
          const isFollowingResult = await dispatch(
            followsApi.endpoints.isFollowing.initiate({ followerId, followingId })
          );

          if (isFollowingResult.data) {
            // Currently following, so unfollow
            await dispatch(
              followsApi.endpoints.unfollowUser.initiate({ followerId, followingId })
            );
            return { data: { isFollowing: false } };
          } else {
            // Not following, so follow
            await dispatch(
              followsApi.endpoints.followUser.initiate({ followerId, followingId })
            );
            return { data: { isFollowing: true } };
          }
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
    }),

    // Get mutual followers (users who follow both target user and current user)
    getMutualFollowers: builder.query<User[], { userId: string; targetUserId: string }>({
      queryFn: async ({ userId, targetUserId }, { dispatch }): Promise<any> => {
        try {
          // Get followers of both users
          const [userFollowersResult, targetFollowersResult]: any[] = await Promise.all([
            dispatch(followsApi.endpoints.getFollowers.initiate({ userId })),
            dispatch(followsApi.endpoints.getFollowers.initiate({ userId: targetUserId })),
          ]);

          if (userFollowersResult.error || targetFollowersResult.error) {
            return { error: userFollowersResult.error || targetFollowersResult.error };
          }

          // Find mutual followers
          const userFollowerIds = new Set(
            userFollowersResult.data?.map((f: any) => f.follower_id) || []
          );
          const mutualFollowers = (targetFollowersResult.data || [])
            .filter((f: any) => userFollowerIds.has(f.follower_id))
            .map((f: any) => f.follower);

          return { data: mutualFollowers };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
      providesTags: (result, error, { userId, targetUserId }) => [
        { type: 'Follow', id: `MUTUAL_${userId}_${targetUserId}` },
      ],
    }),

    // Get suggested users to follow (users with mutual connections)
    getSuggestedFollows: builder.query<User[], { userId: string; limit?: number }>({
      queryFn: async ({ userId, limit = 10 }, { dispatch }): Promise<any> => {
        try {
          // Get users that the current user's following are following
          const followingResult = await dispatch(
            followsApi.endpoints.getFollowing.initiate({ userId })
          );

          if (followingResult.error) {
            return { error: followingResult.error };
          }

          // This is a simplified implementation
          // In production, you'd want a more sophisticated recommendation algorithm
          const suggestions: User[] = [];
          
          // For now, return empty array as this would require more complex queries
          return { data: suggestions };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
      providesTags: (result, error, { userId }) => [
        { type: 'Follow', id: `SUGGESTIONS_${userId}` },
      ],
    }),

    // Get follow relationship between two users
    getFollowRelationship: builder.query<FollowRelationship, { userId: string; targetUserId: string }>({
      queryFn: async ({ userId, targetUserId }, { dispatch }): Promise<any> => {
        try {
          const [followingResult, followedByResult] = await Promise.all([
            dispatch(
              followsApi.endpoints.isFollowing.initiate({
                followerId: userId,
                followingId: targetUserId,
              })
            ),
            dispatch(
              followsApi.endpoints.isFollowing.initiate({
                followerId: targetUserId,
                followingId: userId,
              })
            ),
          ]);

          const isFollowing = followingResult.data || false;
          const isFollowedBy = followedByResult.data || false;

          return {
            data: {
              isFollowing,
              isFollowedBy,
              isMutual: isFollowing && isFollowedBy,
            },
          };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'Failed to fetch follow relationship',
            },
          };
        }
      },
      providesTags: (result, error, { userId, targetUserId }) => [
        { type: 'Follow', id: `RELATIONSHIP_${userId}_${targetUserId}` },
      ],
    }),

    // Get follow stats
    getFollowStats: builder.query<FollowStats, string>({
      queryFn: async (userId, { dispatch }): Promise<any> => {
        try {
          const [followersResult, followingResult] = await Promise.all([
            dispatch(followsApi.endpoints.getFollowers.initiate({ userId, limit: 5 })),
            dispatch(followsApi.endpoints.getFollowing.initiate({ userId, limit: 5 })),
          ]);

          if (followersResult.error || followingResult.error) {
            return { error: followersResult.error || followingResult.error };
          }

          const followers = followersResult.data || [];
          const following = followingResult.data || [];

          // Count mutual follows
          const followingIds = new Set(following.map((f: any) => f.following_id));
          const mutualCount = followers.filter((f: any) => followingIds.has(f.follower_id)).length;

          return {
            data: {
              followersCount: followers.length,
              followingCount: following.length,
              mutualCount,
              recentFollowers: followers.slice(0, 5).map((f: any) => f.follower),
              recentFollowing: following.slice(0, 5).map((f: any) => f.following),
            },
          };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'Failed to fetch follow stats',
            },
          };
        }
      },
      providesTags: (result, error, userId) => [
        { type: 'Follow', id: `STATS_${userId}` },
      ],
    }),

    // Batch follow/unfollow users
    batchFollowOperation: builder.mutation<void, { userId: string; operations: BatchFollowOperation }>({
      queryFn: async ({ userId, operations }, { dispatch }): Promise<any> => {
        try {
          const promises = operations.userIds.map((targetUserId) => {
            if (operations.action === 'follow') {
              return dispatch(
                followsApi.endpoints.followUser.initiate({
                  followerId: userId,
                  followingId: targetUserId,
                })
              );
            } else {
              return dispatch(
                followsApi.endpoints.unfollowUser.initiate({
                  followerId: userId,
                  followingId: targetUserId,
                })
              );
            }
          });

          await Promise.all(promises);
          return { data: undefined };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'Batch operation failed',
            },
          };
        }
      },
      invalidatesTags: (result, error, { userId }) => [
        { type: 'Follow', id: `FOLLOWING_${userId}` },
        { type: 'Follow', id: `SUGGESTIONS_${userId}` },
      ],
    }),

    // Enhanced follow user with notification
    followUserWithNotification: builder.mutation<Follow, { followerId: string; followingId: string }>({
      queryFn: async ({ followerId, followingId }, { dispatch }): Promise<any> => {
        try {
          // Follow the user
          const followResult = await dispatch(
            followsApi.endpoints.followUser.initiate({ followerId, followingId })
          );

          // Create notification for the followed user
          await dispatch(
            notificationsApi.endpoints.createNotification.initiate({
              user_id: followingId,
              type: NotificationType.FOLLOW,
              title: '新しいフォロワー',
              message: 'あなたをフォローしました',
              data: { sender_id: followerId },
              is_read: false,
            })
          );

          return { data: (followResult as any).data };
        } catch (error) {
          return {
            error: {
              message: 'Failed to follow user',
              status: 500,
            },
          };
        }
      },
    }),
  }),
  overrideExisting: false,
});

// Export hooks for usage in components
export const {
  useGetFollowersQuery,
  useGetFollowingQuery,
  useIsFollowingQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
  useToggleFollowMutation,
  useGetMutualFollowersQuery,
  useGetSuggestedFollowsQuery,
  useGetFollowRelationshipQuery,
  useGetFollowStatsQuery,
  useBatchFollowOperationMutation,
  useFollowUserWithNotificationMutation,
} = followsApi;

// Export types
export type { FollowWithUser, FollowRelationship, FollowStats, BatchFollowOperation };