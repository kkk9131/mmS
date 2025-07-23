import { supabaseApi } from './supabaseApi';
import { Post, PostInsert, PostUpdate, Like, Comment, CommentInsert } from '../../types/supabase';
import { 
  CACHE_TIMES, 
  TAG_TYPES, 
  postTags, 
  createOptimisticUpdate,
  getRetryConfig,
  selectiveInvalidateTags
} from './cacheUtils';

// Enhanced Post interface with computed fields
interface PostWithExtras extends Omit<Post, 'likes_count' | 'comments_count'> {
  users?: {
    id: string;
    nickname: string;
    avatar_url?: string;
    is_anonymous?: boolean;
  } | null;
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

// Query parameters interface
interface GetPostsParams {
  limit?: number;
  offset?: number;
  userId?: string;
  sortBy?: 'created_at' | 'likes_count' | 'comments_count';
  order?: 'asc' | 'desc';
}

// Optimistic update helpers
const createOptimisticPost = (post: PostInsert, tempId: string): PostWithExtras => ({
  id: tempId,
  user_id: post.user_id,
  content: post.content,
  is_anonymous: post.is_anonymous || false,
  image_url: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  likes_count: 0,
  comments_count: 0,
  user_liked: false,
});

const createOptimisticComment = (comment: CommentInsert, tempId: string): Comment => ({
  id: tempId,
  post_id: comment.post_id,
  user_id: comment.user_id,
  content: comment.content,
  is_anonymous: comment.is_anonymous || false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Posts API slice
export const postsApi = supabaseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get posts with pagination and enhanced features using custom function
    getPosts: builder.query<PostWithExtras[], GetPostsParams>({
      queryFn: async ({ limit = 20, offset = 0, userId }, { getState }) => {
        try {
          // Get current user ID from auth state
          const state = getState() as any;
          const currentUserId = state.auth?.user?.id || null;
          
          console.log('🔍 投稿取得開始:', { 
            limit, 
            offset, 
            userId, 
            currentUserId,
            authState: state.auth?.isAuthenticated 
          });

          // Call custom database function
          const supabase = (await import('../../services/supabase/client')).supabaseClient.getClient();
          const { data, error } = await supabase
            .rpc('get_posts_with_like_status', {
              requesting_user_id: currentUserId,
              limit_count: limit,
              offset_count: offset
            });

          if (error) {
            console.error('❌ 投稿取得エラー:', error);
            throw error;
          }

          console.log('✅ 投稿取得成功:', data?.length || 0, '件');
          console.log('取得データサンプル:', data?.[0]);

          // Transform data to match expected interface
          const transformedData: PostWithExtras[] = (data || []).map((post: any) => ({
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            image_url: post.image_url,
            is_anonymous: post.is_anonymous,
            created_at: post.created_at,
            updated_at: post.updated_at,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            user_liked: post.is_liked_by_user || false,
            users: {
              id: post.user_id,
              nickname: post.user_nickname || 'Unknown User',
              avatar_url: post.user_avatar_url,
              is_anonymous: post.is_anonymous
            }
          }));

          return { data: transformedData };
        } catch (error) {
          console.error('💥 投稿取得で予期しないエラー:', error);
          return { error: { message: 'Failed to fetch posts', error } };
        }
      },
      providesTags: (result, error, params) => {
        const tags = postTags.list(params);
        if (result) {
          result.forEach(({ id }) => {
            tags.push(...postTags.detail(id));
          });
        }
        
        // Add user-specific cache tags
        if (params.userId) {
          tags.push({ type: TAG_TYPES.Post, id: `USER_${params.userId}` });
        }
        
        // Add pagination-specific cache tags
        tags.push({ 
          type: TAG_TYPES.Post, 
          id: `PAGE_${Math.floor((params.offset || 0) / (params.limit || 20))}_${params.limit || 20}` 
        });
        
        return tags;
      },
      // Enable background refetching
      keepUnusedDataFor: CACHE_TIMES.MEDIUM
    }),

    // Get single post
    getPost: builder.query<Post, string>({
      query: (postId) => ({
        table: 'posts',
        method: 'select',
        query: `
          *,
          users:user_id (
            id,
            nickname,
            avatar_url,
            is_anonymous
          )
        `,
        options: {
          eq: { id: postId },
          single: true,
        },
      }),
      providesTags: (result, error, id) => postTags.detail(id),
      keepUnusedDataFor: CACHE_TIMES.LONG,
    }),

    // Create post with enhanced optimistic updates
    createPost: builder.mutation<PostWithExtras, PostInsert>({
      query: (post) => ({
        table: 'posts',
        method: 'insert',
        data: post,
        query: `
          *,
          users:user_id (
            id,
            nickname,
            avatar_url,
            is_anonymous
          )
        `,
      }),
      invalidatesTags: (result, error, newPost) => [
        ...postTags.list(),
        { type: 'Post' as const, id: `USER_${newPost.user_id}` },
        { type: 'Post' as const, id: 'PAGE_0_20' },
      ],
      onQueryStarted: async (newPost, { dispatch, queryFulfilled, getState }) => {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticPost = createOptimisticPost(newPost, tempId);
        
        // Update multiple cache entries for different query parameters
        const patchResults: any[] = [];
        
        // Update main posts list
        patchResults.push(
          dispatch(
            postsApi.util.updateQueryData('getPosts', { limit: 20, offset: 0 }, (draft: any) => {
              draft.unshift(optimisticPost);
            })
          )
        );
        
        // Update user-specific posts if applicable
        patchResults.push(
          dispatch(
            postsApi.util.updateQueryData('getPosts', { userId: newPost.user_id }, (draft: any) => {
              draft.unshift(optimisticPost);
            })
          )
        );

        try {
          const { data: createdPost } = await queryFulfilled;
          
          // Update cache with real data
          patchResults.forEach((patchResult) => {
            patchResult.undo();
          });
          
          // Add real post to cache
          dispatch(
            postsApi.util.updateQueryData('getPosts', { limit: 20, offset: 0 }, (draft: any) => {
              const index = draft.findIndex((p: any) => p.id === tempId);
              if (index !== -1) {
                draft[index] = createdPost;
              } else {
                draft.unshift(createdPost);
              }
            })
          );
          
        } catch (error) {
          // Rollback optimistic updates on error
          patchResults.forEach((patchResult) => {
            patchResult.undo();
          });
          console.error('Failed to create post:', error);
        }
      },
    }),

    // Update post
    updatePost: builder.mutation<Post, { id: string; data: PostUpdate }>({
      query: ({ id, data }) => ({
        table: 'posts',
        method: 'update',
        data,
        options: {
          eq: { id },
          single: true,
        },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Post', id },
        { type: 'Post', id: 'LIST' },
      ],
    }),

    // Delete post
    deletePost: builder.mutation<void, string>({
      query: (postId) => ({
        table: 'posts',
        method: 'delete',
        options: {
          eq: { id: postId },
        },
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Post', id },
        { type: 'Post', id: 'LIST' },
      ],
    }),

    // Enhanced Like/Unlike post with better optimistic updates
    toggleLike: builder.mutation<
      { liked: boolean; likesCount: number }, 
      { postId: string; userId: string }
    >({
      queryFn: async ({ postId, userId }, { dispatch }) => {
        try {
          // Check if already liked
          const existingLikeResult = await dispatch(
            postsApi.endpoints.checkLike.initiate({ postId, userId })
          );
          const existingLike = (existingLikeResult as any).data;
          
          if (existingLike) {
            // Unlike
            await dispatch(
              postsApi.endpoints.deleteLike.initiate({ postId, userId })
            );
            
            return { data: { liked: false, likesCount: 0 } };
          } else {
            // Like
            await dispatch(
              postsApi.endpoints.createLike.initiate({ 
                post_id: postId, 
                user_id: userId 
              })
            );
            
            return { data: { liked: true, likesCount: 1 } };
          }
        } catch (error) {
          return { error: { message: 'Failed to toggle like', error } };
        }
      },
      onQueryStarted: async ({ postId, userId }, { dispatch, queryFulfilled }) => {
        // Optimistic updates for all relevant cache entries
        const patchResults: any[] = [];
        const tempLikeState = Math.random() > 0.5; // We'll correct this after the query
        
        // Function to apply optimistic update
        const applyOptimisticUpdate = (cacheKey: any, isLiked: boolean) => {
          return dispatch(
            postsApi.util.updateQueryData('getPosts', cacheKey, (draft: any) => {
              const post = draft.find((p: any) => p.id === postId);
              if (post) {
                const currentLikes = post.likes_count || 0;
                const currentUserLiked = post.user_liked || false;
                
                if (isLiked && !currentUserLiked) {
                  // Adding like
                  post.likes_count = currentLikes + 1;
                  post.user_liked = true;
                } else if (!isLiked && currentUserLiked) {
                  // Removing like
                  post.likes_count = Math.max(0, currentLikes - 1);
                  post.user_liked = false;
                }
              }
            })
          );
        };
        
        // Apply optimistic updates to different cache entries
        const cacheKeys = [
          { limit: 20, offset: 0 },
          { userId },
          { limit: 10, offset: 0 },
        ];
        
        try {
          const result = await queryFulfilled;
          const { liked } = result.data;
          
          // Apply correct optimistic updates
          cacheKeys.forEach((cacheKey) => {
            patchResults.push(applyOptimisticUpdate(cacheKey, liked));
          });
          
        } catch (error) {
          // Rollback all optimistic updates on error
          patchResults.forEach((patchResult) => {
            patchResult.undo();
          });
          console.error('Failed to toggle like:', error);
        }
      },
      invalidatesTags: (result, error, { postId }) => [
        { type: 'Post', id: postId },
        { type: 'Post', id: 'LIST' },
        { type: 'Like', id: `POST_${postId}` },
      ],
    }),

    // Check if user liked a post
    checkLike: builder.query<Like | null, { postId: string; userId: string }>({
      query: ({ postId, userId }) => ({
        table: 'likes',
        method: 'select',
        query: 'id, created_at',
        options: {
          eq: { post_id: postId, user_id: userId },
          single: true,
        },
      }),
      providesTags: (result, error, { postId }) => [
        { type: 'Like', id: `POST_${postId}` },
      ],
    }),

    // Create like
    createLike: builder.mutation<Like, { post_id: string; user_id: string }>({
      query: (like) => ({
        table: 'likes',
        method: 'insert',
        data: like,
      }),
      invalidatesTags: (result, error, { post_id }) => [
        { type: 'Post', id: post_id },
        { type: 'Post', id: 'LIST' },
      ],
    }),

    // Delete like
    deleteLike: builder.mutation<void, { postId: string; userId: string }>({
      query: ({ postId, userId }) => ({
        table: 'likes',
        method: 'delete',
        options: {
          eq: { post_id: postId, user_id: userId },
        },
      }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'Post', id: postId },
        { type: 'Post', id: 'LIST' },
      ],
    }),

    // Get comments for a post
    getComments: builder.query<Comment[], string>({
      query: (postId) => ({
        table: 'comments',
        method: 'select',
        query: `
          *,
          users:user_id (
            id,
            nickname,
            avatar_url,
            is_anonymous
          )
        `,
        options: {
          eq: { post_id: postId },
          order: { column: 'created_at', ascending: true },
        },
      }),
      providesTags: (result, error, postId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Comment', id } as const)),
              { type: 'Comment', id: `POST_${postId}` },
            ]
          : [{ type: 'Comment', id: `POST_${postId}` }],
    }),

    // Enhanced create comment with better optimistic updates
    createComment: builder.mutation<Comment, CommentInsert>({
      query: (comment) => ({
        table: 'comments',
        method: 'insert',
        data: comment,
        query: `
          *,
          users:user_id (
            id,
            nickname,
            avatar_url,
            is_anonymous
          )
        `,
      }),
      invalidatesTags: (result, error, { post_id }) => [
        { type: 'Comment', id: `POST_${post_id}` },
        { type: 'Post', id: post_id },
        { type: 'Post', id: 'LIST' },
      ],
      onQueryStarted: async (newComment, { dispatch, queryFulfilled }) => {
        const tempId = `temp-comment-${Date.now()}-${Math.random()}`;
        const optimisticComment = createOptimisticComment(newComment, tempId);
        const patchResults: any[] = [];

        // Optimistic update for comments list
        const commentsPatch = dispatch(
          postsApi.util.updateQueryData('getComments', newComment.post_id, (draft: any) => {
            draft.push(optimisticComment);
          })
        );
        patchResults.push(commentsPatch);

        // Optimistic update for posts list (increment comment count)
        const postsUpdateKeys = [
          { limit: 20, offset: 0 },
          { userId: newComment.user_id },
          { limit: 10, offset: 0 },
        ];

        postsUpdateKeys.forEach((cacheKey) => {
          const postsPatch = dispatch(
            postsApi.util.updateQueryData('getPosts', cacheKey, (draft: any) => {
              const post = draft.find((p: any) => p.id === newComment.post_id);
              if (post) {
                post.comments_count = (post.comments_count || 0) + 1;
              }
            })
          );
          patchResults.push(postsPatch);
        });

        try {
          const { data: createdComment } = await queryFulfilled;

          // Update comments cache with real data
          dispatch(
            postsApi.util.updateQueryData('getComments', newComment.post_id, (draft: any) => {
              const tempIndex = draft.findIndex((c: any) => c.id === tempId);
              if (tempIndex !== -1) {
                draft[tempIndex] = createdComment;
              }
            })
          );

        } catch (error) {
          // Rollback all optimistic updates on error
          patchResults.forEach((patchResult) => {
            patchResult.undo();
          });
          console.error('Failed to create comment:', error);
        }
      },
    }),

    // Update comment
    updateComment: builder.mutation<Comment, { id: string; data: Partial<Comment> }>({
      query: ({ id, data }) => ({
        table: 'comments',
        method: 'update',
        data,
        options: {
          eq: { id },
          single: true,
        },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Comment', id },
      ],
    }),

    // Enhanced delete comment with optimistic updates
    deleteComment: builder.mutation<void, { commentId: string; postId: string }>({
      query: ({ commentId }) => ({
        table: 'comments',
        method: 'delete',
        options: {
          eq: { id: commentId },
        },
      }),
      invalidatesTags: (result, error, { commentId, postId }) => [
        { type: 'Comment', id: commentId },
        { type: 'Comment', id: `POST_${postId}` },
        { type: 'Post', id: postId },
        { type: 'Post', id: 'LIST' },
      ],
      onQueryStarted: async ({ commentId, postId }, { dispatch, queryFulfilled }) => {
        const patchResults: any[] = [];

        // Store deleted comment for potential rollback
        let deletedComment: Comment | null = null;
        
        // Optimistic update for comments list
        const commentsPatch = dispatch(
          postsApi.util.updateQueryData('getComments', postId, (draft: any) => {
            const index = draft.findIndex((c: any) => c.id === commentId);
            if (index !== -1) {
              deletedComment = draft[index];
              draft.splice(index, 1);
            }
          })
        );
        patchResults.push(commentsPatch);

        // Optimistic update for posts list (decrement comment count)
        const postsUpdateKeys = [
          { limit: 20, offset: 0 },
          { limit: 10, offset: 0 },
        ];

        postsUpdateKeys.forEach((cacheKey) => {
          const postsPatch = dispatch(
            postsApi.util.updateQueryData('getPosts', cacheKey, (draft: any) => {
              const post = draft.find((p: any) => p.id === postId);
              if (post) {
                post.comments_count = Math.max(0, (post.comments_count || 1) - 1);
              }
            })
          );
          patchResults.push(postsPatch);
        });

        try {
          await queryFulfilled;
        } catch (error) {
          // Rollback optimistic updates and restore deleted comment
          patchResults.forEach((patchResult) => {
            patchResult.undo();
          });
          
          if (deletedComment) {
            dispatch(
              postsApi.util.updateQueryData('getComments', postId, (draft: any) => {
                // Re-insert the comment at its original position
                draft.push(deletedComment!);
                // Sort by created_at to maintain order
                draft.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              })
            );
          }
          
          console.error('Failed to delete comment:', error);
        }
      },
    }),

    // Bulk operations for better performance
    refreshPosts: builder.mutation<void, void>({
      queryFn: async (_, { dispatch }) => {
        // Force refetch of posts
        dispatch(postsApi.util.invalidateTags([{ type: 'Post', id: 'LIST' }]));
        return { data: undefined };
      },
    }),

    // Get posts count for a user
    getPostsCount: builder.query<{ count: number }, { userId?: string }>({
      query: ({ userId }) => ({
        table: 'posts',
        method: 'select',
        query: 'id',
        options: {
          ...(userId && { eq: { user_id: userId } }),
          count: 'exact',
          head: true,
        },
      }),
      providesTags: (result, error, { userId }) => [
        { type: 'Post', id: userId ? `COUNT_USER_${userId}` : 'COUNT_ALL' },
      ],
    }),
  }),
  overrideExisting: false,
});

// Export hooks for usage in components
export const {
  // Post queries
  useGetPostsQuery,
  useGetPostQuery,
  useGetPostsCountQuery,
  
  // Post mutations
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useRefreshPostsMutation,
  
  // Like functionality
  useToggleLikeMutation,
  useCheckLikeQuery,
  useCreateLikeMutation,
  useDeleteLikeMutation,
  
  // Comment functionality
  useGetCommentsQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
} = postsApi;

// Type exports for better developer experience
export type { PostWithExtras, GetPostsParams };