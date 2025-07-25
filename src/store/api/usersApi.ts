import { supabaseApi } from './supabaseApi';
import { User, UserUpdate, UserInsert } from '../../types/supabase';

// Enhanced user profile interface
interface UserProfile extends User {
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  mutualFollowersCount?: number;
}

// User activity stats
interface UserStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  joinedDaysAgo: number;
  lastActiveAt?: string;
}

// Privacy settings interface
interface PrivacySettings {
  showEmail: boolean;
  showBio: boolean;
  allowMessages: boolean;
  allowMentions: boolean;
}

// Users API slice
export const usersApi = supabaseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get user profile
    getUser: builder.query<User, string>({
      query: (userId: string) => ({
        table: 'users',
        method: 'select',
        query: '*',
        options: {
          eq: { id: userId },
          single: true,
        },
      }),
      providesTags: (result, error, id) => [{ type: 'User' as const, id }],
    }),

    // Search users
    searchUsers: builder.query<User[], { query: string; limit?: number }>({
      query: ({ query, limit = 20 }) => ({
        table: 'users',
        method: 'select',
        query: 'id, nickname, avatar_url, bio',
        options: {
          // Note: This is a simplified search. In production, you'd want full-text search
          // For now, we'll search by nickname containing the query
          limit,
        },
      }),
      // Transform response to filter by nickname
      transformResponse: (response: User[], meta, { query }) => {
        return response.filter((user) =>
          user.nickname.toLowerCase().includes(query.toLowerCase())
        );
      },
      providesTags: [{ type: 'User' as const, id: 'SEARCH' }],
    }),

    // Update user profile
    updateUserProfile: builder.mutation<User, { userId: string; data: UserUpdate }>({
      query: ({ userId, data }) => ({
        table: 'users',
        method: 'update',
        data,
        options: {
          eq: { id: userId },
          single: true,
        },
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User' as const, id: userId },
        { type: 'User' as const, id: 'SEARCH' },
      ],
      onQueryStarted: async ({ userId, data }, { dispatch, queryFulfilled }) => {
        // Optimistic update
        const patchResult = dispatch(
          usersApi.util.updateQueryData('getUser', userId, (draft: any) => {
            Object.assign(draft, data);
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    // Get user's posts count
    getUserPostsCount: builder.query<number, string>({
      query: (userId: string) => ({
        table: 'posts',
        method: 'select',
        query: 'id',
        options: {
          eq: { user_id: userId },
        },
      }),
      transformResponse: (response: any[]) => response.length,
      providesTags: (result, error, userId) => [
        { type: 'User' as const, id: `POSTS_COUNT_${userId}` },
      ],
    }),

    // Get user's followers count
    getFollowersCount: builder.query<number, string>({
      query: (userId: string) => ({
        table: 'follows',
        method: 'select',
        query: 'id',
        options: {
          eq: { following_id: userId },
        },
      }),
      transformResponse: (response: any[]) => response.length,
      providesTags: (result, error, userId) => [
        { type: 'User' as const, id: `FOLLOWERS_COUNT_${userId}` },
      ],
    }),

    // Get user's following count
    getFollowingCount: builder.query<number, string>({
      query: (userId: string) => ({
        table: 'follows',
        method: 'select',
        query: 'id',
        options: {
          eq: { follower_id: userId },
        },
      }),
      transformResponse: (response: any[]) => response.length,
      providesTags: (result, error, userId) => [
        { type: 'User' as const, id: `FOLLOWING_COUNT_${userId}` },
      ],
    }),

    // Get user's complete profile with counts
    getUserProfileWithCounts: builder.query<
      User & { postsCount: number; followersCount: number; followingCount: number },
      string
    >({
      queryFn: async (userId: string, { dispatch }): Promise<any> => {
        try {
          const [userResult, postsCountResult, followersCountResult, followingCountResult]: any[] =
            await Promise.all([
              dispatch(usersApi.endpoints.getUser.initiate(userId)),
              dispatch(usersApi.endpoints.getUserPostsCount.initiate(userId)),
              dispatch(usersApi.endpoints.getFollowersCount.initiate(userId)),
              dispatch(usersApi.endpoints.getFollowingCount.initiate(userId)),
            ]);

          if (userResult.error) {
            return { error: userResult.error };
          }

          return {
            data: {
              ...userResult.data,
              postsCount: postsCountResult.data || 0,
              followersCount: followersCountResult.data || 0,
              followingCount: followingCountResult.data || 0,
            },
          };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
      providesTags: (result, error, userId) => [
        { type: 'User' as const, id: userId },
        { type: 'User' as const, id: `POSTS_COUNT_${userId}` },
        { type: 'User' as const, id: `FOLLOWERS_COUNT_${userId}` },
        { type: 'User' as const, id: `FOLLOWING_COUNT_${userId}` },
      ],
    }),

    // Check if maternal book number is available
    checkMaternalBookAvailability: builder.query<boolean, string>({
      query: (maternalBookNumber: string) => ({
        table: 'users',
        method: 'select',
        query: 'id',
        options: {
          eq: { maternal_book_number: maternalBookNumber },
          single: true,
        },
      }),
      transformResponse: (response) => !response, // true if available (no existing user)
    }),

    // Get user stats
    getUserStats: builder.query<UserStats, string>({
      queryFn: async (userId: string, { dispatch }): Promise<any> => {
        try {
          // Parallel queries for better performance
          const [postsResult, likesResult, commentsResult, userResult] = await Promise.all([
            // Direct Supabase query for posts
            (async () => {
              const client = await import('../../services/supabase/client');
              const { data } = await client.supabaseClient.getClient()
                .from('posts')
                .select('id')
                .eq('user_id', userId);
              return { data };
            })(),
            // Direct Supabase query for likes  
            (async () => {
              const client = await import('../../services/supabase/client');
              const { data } = await client.supabaseClient.getClient()
                .from('likes')
                .select('id')
                .eq('user_id', userId);
              return { data };
            })(),
            // Direct Supabase query for comments
            (async () => {
              const client = await import('../../services/supabase/client');
              const { data } = await client.supabaseClient.getClient()
                .from('comments')
                .select('id')
                .eq('user_id', userId);
              return { data };
            })(),
            dispatch(usersApi.endpoints.getUser.initiate(userId)),
          ]);

          const user = userResult.data;
          const joinedDate = user && user.created_at ? new Date(user.created_at) : new Date();
          const joinedDaysAgo = Math.floor(
            (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            data: {
              totalPosts: postsResult.data?.length || 0,
              totalLikes: likesResult.data?.length || 0,
              totalComments: commentsResult.data?.length || 0,
              joinedDaysAgo,
              lastActiveAt: user?.updated_at,
            },
          };
        } catch (error) {
          return {
            error: {
              message: error instanceof Error ? error.message : 'Failed to fetch user stats',
              status: 500,
            },
          };
        }
      },
      providesTags: (result, error, userId) => [
        { type: 'User' as const, id: `STATS_${userId}` },
      ],
    }),

    // Update privacy settings
    updatePrivacySettings: builder.mutation<User, { userId: string; settings: PrivacySettings }>({
      query: ({ userId, settings }) => ({
        table: 'users',
        method: 'update',
        data: {
          privacy_settings: settings,
          updated_at: new Date().toISOString(),
        },
        options: {
          eq: { id: userId },
          single: true,
        },
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User' as const, id: userId },
      ],
      onQueryStarted: async ({ userId, settings }, { dispatch, queryFulfilled }) => {
        // Optimistic update
        const patchResult = dispatch(
          usersApi.util.updateQueryData('getUser', userId, (draft: any) => {
            if (draft.privacy_settings) {
              Object.assign(draft.privacy_settings, settings);
            } else {
              draft.privacy_settings = settings as any;
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    // Upload avatar
    uploadAvatar: builder.mutation<{ url: string }, { userId: string; file: File }>({
      queryFn: async ({ userId, file }, { dispatch }) => {
        try {
          // In a real implementation, this would upload to Supabase Storage
          // For now, we'll simulate it
          const url = URL.createObjectURL(file);
          
          // Update user profile with new avatar URL
          await dispatch(
            usersApi.endpoints.updateUserProfile.initiate({
              userId,
              data: { avatar_url: url },
            })
          );

          return { data: { url } };
        } catch {
          return {
            error: {
              status: 500,
              message: 'Failed to upload avatar',
            },
          };
        }
      },
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User' as const, id: userId },
      ],
    }),

    // Get user suggestions (users to follow)
    getUserSuggestions: builder.query<UserProfile[], { userId: string; limit?: number }>({
      queryFn: async ({ userId, limit = 10 }, { dispatch }) => {
        try {
          // Get users that the current user is not following
          // This is a simplified implementation
          // Use supabase client directly for complex queries
          const { supabaseClient } = (await import('../../services/supabase/client'));
          const { data: allUsers } = await supabaseClient.getClient()
            .from('users')
            .select('id, nickname, avatar_url, bio')
            .neq('id', userId)
            .limit(limit || 10);

          if (!allUsers) {
            throw new Error('Failed to fetch users');
          }

          return {
            data: allUsers as UserProfile[],
          };
        } catch {
          return {
            error: {
              status: 500,
              message: 'Failed to fetch suggestions',
            },
          };
        }
      },
      providesTags: [{ type: 'User' as const, id: 'SUGGESTIONS' }],
    }),
  }),
  overrideExisting: false,
});

// Export hooks for usage in components
export const {
  useGetUserQuery,
  useSearchUsersQuery,
  useUpdateUserProfileMutation,
  useGetUserPostsCountQuery,
  useGetFollowersCountQuery,
  useGetFollowingCountQuery,
  useGetUserProfileWithCountsQuery,
  useCheckMaternalBookAvailabilityQuery,
  useGetUserStatsQuery,
  useUpdatePrivacySettingsMutation,
  useUploadAvatarMutation,
  useGetUserSuggestionsQuery,
} = usersApi;

// Export types
export type { UserProfile, UserStats, PrivacySettings };