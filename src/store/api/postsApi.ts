import { supabaseApi } from './supabaseApi';
import { Post, PostInsert, PostUpdate, Like, Comment, CommentInsert } from '../../types/supabase';
import { supabaseClient } from '../../services/supabase/client';
import { sql } from '@supabase/supabase-js';
import { 
  CACHE_TIMES, 
  TAG_TYPES, 
  postTags, 
  createOptimisticUpdate,
  getRetryConfig,
  selectiveInvalidateTags
} from './cacheUtils';
import { FeatureFlagsManager } from '../../services/featureFlags';

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
  user_commented?: boolean;
  liked_at?: string; // When the user liked this post (for liked posts screen)
  images?: string[] | null; // 複数画像フィールド
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
          
          console.log('🔍 RTK Query 投稿取得開始:', { 
            limit, 
            offset, 
            userId, 
            currentUserId,
            authState: state.auth?.isAuthenticated,
            supabaseInitialized: supabaseClient.isInitialized()
          });

          // RPC関数呼び出し前にSupabaseクライアントの状態を確認
          if (!supabaseClient.isInitialized()) {
            console.error('❌ Supabaseクライアントが初期化されていません');
            throw new Error('Supabase client not initialized');
          }

          // RPC関数の存在確認
          console.log('🔍 RPC関数呼び出し準備:', {
            functionName: 'get_posts_with_like_status',
            params: {
              req_user_id: currentUserId,
              limit_count: limit,
              offset_count: offset
            }
          });

          // Call custom database function
          const supabase = supabaseClient.getClient();
          
          // まずはRPC関数の存在確認を試行
          console.log('🧪 RPC関数の存在確認テスト中...');
          let rpcFunctionExists = false;
          try {
            const testResult = await supabase.rpc('get_posts_with_like_status', {
              req_user_id: null,
              limit_count: 1,
              offset_count: 0
            });
            
            rpcFunctionExists = !testResult.error || testResult.error.code !== '42883'; // 42883 = function not found
            console.log('✅ RPC関数存在確認結果:', {
              exists: rpcFunctionExists,
              testError: testResult.error?.message || 'なし',
              errorCode: testResult.error?.code || 'なし'
            });
          } catch (e) {
            console.error('❌ RPC関数存在確認テストエラー:', e);
          }

          if (!rpcFunctionExists) {
            console.warn('⚠️ RPC関数が存在しない可能性があります。代替クエリを使用します。');
            // フォールバック: 直接的なクエリ
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('posts')
              .select(`
                *,
                users:user_id (
                  id,
                  nickname,
                  avatar_url,
                  is_anonymous
                )
              `)
              .order('created_at', { ascending: false })
              .limit(limit);
              
            if (fallbackError) {
              console.error('❌ フォールバッククエリエラー:', fallbackError);
              throw fallbackError;
            }
            
            console.log('✅ フォールバッククエリ成功:', fallbackData?.length || 0, '件');
            
            // データを変換してRPC関数と同じ形式にする
            const transformedFallbackData = (fallbackData || []).map((post: any) => ({
              id: post.id,
              user_id: post.user_id,
              content: post.content,
              image_url: post.image_url,
              images: post.images,
              is_anonymous: post.is_anonymous,
              created_at: post.created_at,
              updated_at: post.updated_at,
              likes_count: 0, // フォールバックでは0
              comments_count: 0, // フォールバックでは0
              is_liked_by_user: false, // フォールバックでは false
              is_commented_by_user: false, // フォールバックでは false
              user_nickname: post.users?.nickname || 'Unknown User',
              user_avatar_url: post.users?.avatar_url
            }));
            
            return { data: transformedFallbackData };
          }

          // RPC関数が存在する場合は通常の呼び出し
          const { data, error } = await supabase
            .rpc('get_posts_with_like_status', {
              req_user_id: currentUserId,
              limit_count: limit,
              offset_count: offset
            });

          if (error) {
            console.error('❌ RPC関数呼び出しエラー:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            });
            
            // RPC関数が見つからない場合のフォールバック
            if (error.code === '42883') {
              console.warn('⚠️ RPC関数が見つかりません。フォールバッククエリを実行します。');
              
              const { data: fallbackData, error: fallbackError } = await supabase
                .from('posts')
                .select(`
                  *,
                  users:user_id (
                    id,
                    nickname,
                    avatar_url,
                    is_anonymous
                  )
                `)
                .order('created_at', { ascending: false })
                .limit(limit);
                
              if (fallbackError) {
                console.error('❌ フォールバッククエリも失敗:', fallbackError);
                throw fallbackError;
              }
              
              console.log('✅ フォールバッククエリ成功:', fallbackData?.length || 0, '件');
              
              // データを変換
              const transformedData = (fallbackData || []).map((post: any) => ({
                id: post.id,
                user_id: post.user_id,
                content: post.content,
                image_url: post.image_url,
                images: post.images,
                is_anonymous: post.is_anonymous,
                created_at: post.created_at,
                updated_at: post.updated_at,
                likes_count: 0,
                comments_count: 0,
                is_liked_by_user: false,
                is_commented_by_user: false,
                user_nickname: post.users?.nickname || 'Unknown User',
                user_avatar_url: post.users?.avatar_url
              }));
              
              return { data: transformedData };
            }
            
            throw error;
          }

          console.log('✅ RPC投稿取得成功:', data?.length || 0, '件');
          if (data && data.length > 0) {
            console.log('📋 取得データサンプル:', {
              id: data[0]?.id,
              content: data[0]?.content?.substring(0, 50) + '...',
              user_nickname: data[0]?.user_nickname,
              likes_count: data[0]?.likes_count,
              comments_count: data[0]?.comments_count,
              has_images: !!(data[0]?.images || data[0]?.image_url),
              is_liked_by_user: data[0]?.is_liked_by_user
            });
          } else {
            console.warn('⚠️ データが空です');
          }

          // Transform data to match expected interface
          const transformedData: PostWithExtras[] = (data || []).map((post: any) => {
            console.log('🔄 RTK投稿変換処理:', {
              post_id: post.id,
              images_raw: post.images,
              image_url_raw: post.image_url,
              images_is_array: Array.isArray(post.images),
              images_length: post.images?.length
            });
            
            // 画像配列の処理（新しいimagesフィールドを優先、旧image_urlフィールドをフォールバック）
            let imageUrls: string[] | null = null;
            if (post.images && Array.isArray(post.images) && post.images.length > 0) {
              // 新しいimagesフィールドが存在する場合
              imageUrls = post.images.filter((url: string) => url && url.trim() !== '');
              console.log('✅ imagesフィールドから取得:', imageUrls);
            } else if (post.image_url && typeof post.image_url === 'string' && post.image_url.trim() !== '') {
              // 旧image_urlフィールドをフォールバック
              imageUrls = [post.image_url];
              console.log('✅ image_urlフィールドから取得:', imageUrls);
            } else {
              console.log('⚠️ 画像データなし', {
                images: post.images,
                image_url: post.image_url
              });
              imageUrls = null;
            }
            
            console.log('🎯 最終的なimageUrls:', imageUrls);
            
            const transformedPost = {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            image_url: post.image_url,
            images: imageUrls, // 新しい複数画像フィールド
            is_anonymous: post.is_anonymous,
            created_at: post.created_at,
            updated_at: post.updated_at,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            user_liked: post.is_liked_by_user || false,
            user_commented: post.is_commented_by_user || false,
            users: {
              id: post.user_id,
              nickname: (post.user_nickname || 'Unknown User').replace(/_修正$/, ''),
              avatar_url: post.user_avatar_url,
              is_anonymous: post.is_anonymous
            }
          };
          
          console.log('📊 RTK変換後のデータ:', {
            post_id: transformedPost.id,
            images: transformedPost.images,
            images_count: transformedPost.images?.length
          });
          
          return transformedPost;
        });

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
      queryFn: async (post, { getState }) => {
        console.log('🔥🔥🔥 RTK Query createPost queryFn 開始 🔥🔥🔥');
        console.log('📝 投稿データ:', post);
        
        try {
          const client = supabaseClient.getClient();
          
          console.log('🔍 Supabase client取得完了');
          
          // RLS無効化後のシンプルな投稿作成処理
          console.log('🔧 カスタム認証での投稿作成（RLS無効化済み想定）');
          
          const { data, error } = await client
            .from('posts')
            .insert(post)
            .select(`
              *,
              users:user_id (
                id,
                nickname,
                avatar_url,
                is_anonymous
              )
            `)
            .single();
          
          console.log('✅ 投稿作成試行完了 - data:', data);
          console.log('❌ エラー（あれば）:', error);
            
          console.log('📤 Supabase INSERT実行完了');
          console.log('✅ data:', data);
          console.log('❌ error:', error);
          
          if (error) {
            console.error('💥💥💥 Supabase INSERT エラー詳細 💥💥💥');
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            console.error('Error hint:', error.hint);
            console.error('Error code:', error.code);
            console.error('Full error:', error);
            return { error: { message: error.message, details: error } };
          }
          
          console.log('✅ RTK Query createPost 成功');
          return { data };
        } catch (error) {
          console.error('💥💥💥 RTK Query createPost 例外 💥💥💥');
          console.error('Exception:', error);
          return { error: { message: 'Unexpected error', details: error } };
        }
      },
      invalidatesTags: (result, error, newPost) => [
        ...postTags.list(),
        { type: 'Post' as const, id: `USER_${newPost.user_id}` },
        { type: 'Post' as const, id: 'PAGE_0_20' },
      ],
      onQueryStarted: async (newPost, { dispatch, queryFulfilled, getState }) => {
        console.log('🚀🚀🚀 RTK Query createPost onQueryStarted 開始 🚀🚀🚀');
        console.log('📝 新規投稿データ:', newPost);
        console.log('🔍 現在のState:', getState());
        
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticPost = createOptimisticPost(newPost, tempId);
        console.log('🎯 作成されたOptimistic Post:', optimisticPost);
        
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
          console.log('⏳ queryFulfilled を待機中...');
          const { data: createdPost } = await queryFulfilled;
          console.log('✅ queryFulfilled 成功:', createdPost);
          
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
          console.log('✅ キャッシュ更新完了');
          
        } catch (error) {
          console.error('💥💥💥 RTK Query createPost エラー 💥💥💥');
          console.error('❌ Error type:', typeof error);
          console.error('❌ Error constructor:', error?.constructor?.name);
          console.error('❌ Error details:', error);
          console.error('❌ Error message:', (error as any)?.message);
          console.error('❌ Error stack:', (error as any)?.stack);
          console.error('❌ Full error object:', JSON.stringify(error, null, 2));
          
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
      queryFn: async ({ postId, userId }) => {
        try {
          const supabase = supabaseClient.getClient();
          
          // Check if already liked
          const { data: existingLike } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .maybeSingle();
          
          if (existingLike) {
            // Unlike - 削除のみ実行
            const { error } = await supabase
              .from('likes')
              .delete()
              .eq('post_id', postId)
              .eq('user_id', userId);
              
            if (error) throw error;
            
            return { data: { liked: false, likesCount: -1 } };
          } else {
            // Like - 挿入のみ実行
            const { error } = await supabase
              .from('likes')
              .insert({ post_id: postId, user_id: userId });
              
            if (error) throw error;
            
            return { data: { liked: true, likesCount: 1 } };
          }
        } catch (error) {
          console.error('❌ toggleLikeエラー:', error);
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
      queryFn: async ({ postId, userId }) => {
        try {
          const supabase = supabaseClient.getClient();
          const { data, error } = await supabase
            .from('likes')
            .select('id, created_at')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .maybeSingle();

          if (error) {
            console.error('❌ いいね状態確認エラー:', error);
            throw error;
          }

          return { data };
        } catch (error) {
          return { error: { message: 'Failed to check like', error } };
        }
      },
      providesTags: (result, error, { postId }) => [
        { type: 'Like', id: `POST_${postId}` },
      ],
    }),

    // Create like
    createLike: builder.mutation<Like, { post_id: string; user_id: string }>({
      queryFn: async (like) => {
        try {
          const supabase = supabaseClient.getClient();
          const { data, error } = await supabase
            .from('likes')
            .insert(like)
            .select()
            .single();

          if (error) {
            console.error('❌ いいね作成エラー:', error);
            throw error;
          }

          console.log('✅ いいね作成成功:', data);
          
          // likes_countの更新はトリガーまたはRPCで実装することを推奨
          // ここでは重複更新を避けるためコメントアウト
          
          return { data };
        } catch (error) {
          console.error('💥 いいね作成で例外:', error);
          return { error: { message: 'Failed to create like', error } };
        }
      },
      invalidatesTags: (result, error, { post_id }) => [
        { type: 'Post', id: post_id },
        { type: 'Post', id: 'LIST' },
      ],
    }),

    // Delete like
    deleteLike: builder.mutation<void, { postId: string; userId: string }>({
      queryFn: async ({ postId, userId }) => {
        try {
          const supabase = supabaseClient.getClient();
          const { error } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userId);

          if (error) {
            console.error('❌ いいね削除エラー:', error);
            throw error;
          }

          console.log('✅ いいね削除成功');
          
          // likes_countの更新はトリガーまたはRPCで実装することを推奨
          // ここでは重複更新を避けるためコメントアウト
          
          return { data: undefined };
        } catch (error) {
          console.error('💥 いいね削除で例外:', error);
          return { error: { message: 'Failed to delete like', error } };
        }
      },
      invalidatesTags: (result, error, { postId }) => [
        { type: 'Post', id: postId },
        { type: 'Post', id: 'LIST' },
      ],
    }),

    // Get comments for a post
    getComments: builder.query<Comment[], string>({
      queryFn: async (postId) => {
        try {
          const supabase = supabaseClient.getClient();
          const { data, error } = await supabase
            .from('comments')
            .select(`
              *,
              users!inner (
                id,
                nickname,
                avatar_url,
                is_anonymous
              )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

          if (error) {
            console.error('❌ コメント取得エラー:', error);
            throw error;
          }

          console.log('✅ コメント取得成功:', data);
          return { data: data || [] };
        } catch (error) {
          console.error('💥 コメント取得で例外:', error);
          return { error: { message: 'Failed to fetch comments', error } };
        }
      },
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
      queryFn: async (comment) => {
        try {
          const supabase = supabaseClient.getClient();
          const { data, error } = await supabase
            .from('comments')
            .insert(comment)
            .select(`
              *,
              users!inner (
                id,
                nickname,
                avatar_url,
                is_anonymous
              )
            `)
            .single();

          if (error) {
            console.error('❌ コメント作成エラー:', error);
            throw error;
          }

          console.log('✅ コメント作成成功:', data);
          return { data };
        } catch (error) {
          console.error('💥 コメント作成で例外:', error);
          return { error: { message: 'Failed to create comment', error } };
        }
      },
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

    // Get liked posts for a user
    getLikedPosts: builder.query<PostWithExtras[], { userId: string; limit?: number; offset?: number }>({
      queryFn: async ({ userId, limit = 20, offset = 0 }) => {
        try {
          const supabase = supabaseClient.getClient();
          
          console.log('🔍 いいねした投稿を取得中:', { userId, limit, offset });
          
          // SQLクエリと同等の直接的なアプローチ
          console.log('📝 直接SQLクエリで取得');
          
          const { data: rawData, error } = await supabase
            .from('likes')
            .select(`
              id,
              created_at,
              post_id,
              posts (
                id,
                content,
                created_at,
                updated_at,
                likes_count,
                comments_count,
                image_url,
                is_anonymous,
                user_id,
                users (
                  id,
                  nickname,
                  avatar_url,
                  is_anonymous
                )
              )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
          
          console.log('📝 取得したrawData:', rawData);
          console.log('📝 エラー:', error);
          
          if (error) {
            console.error('❌ データ取得エラー:', error);
            // エラーがあってもフォールバックを試す
          }
          
          // 強制的にフォールバック: 段階的取得（ネストクエリでusersがnullになるため）
          if (true) {
            console.log('🔄 フォールバック: 段階的取得');
            
            // 1. いいねデータだけ取得
            const { data: likes } = await supabase
              .from('likes')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(limit);
            
            console.log('📝 いいねデータ:', likes);
            
            if (!likes || likes.length === 0) {
              console.log('⚠️ いいねデータが見つかりません');
              return { data: [] };
            }
            
            // 2. 各いいねに対して投稿データを取得
            const transformedData: PostWithExtras[] = [];
            
            for (const like of likes) {
              // 投稿取得
              const { data: post, error: postError } = await supabase
                .from('posts')
                .select('*')
                .eq('id', like.post_id)
                .maybeSingle();
              
              if (postError) {
                console.error('❌ 投稿取得エラー:', postError);
                continue;
              }
              
              if (!post) {
                console.warn('⚠️ 投稿が見つかりません:', like.post_id);
                continue;
              }
              
              // ユーザー取得 - 単純なクエリで再試行
              console.log('🔍 ユーザー取得開始:', { post_user_id: post.user_id });
              let user = null;
              let userError = null;
              
              try {
                const result = await supabase
                  .from('users')
                  .select('id, nickname, avatar_url, is_anonymous')
                  .eq('id', post.user_id);
                
                console.log('🔍 ユーザー取得 raw result:', result);
                
                if (result.data && result.data.length > 0) {
                  user = result.data[0];
                } else {
                  userError = result.error || 'ユーザーが見つかりません';
                }
              } catch (e) {
                console.error('💥 ユーザー取得例外:', e);
                userError = e;
              }
              
              console.log('🔍 ユーザー取得結果:', { 
                user_id: post.user_id, 
                user_data: user, 
                error: userError 
              });
              
              if (userError) {
                console.error('❌ ユーザー取得エラー:', userError);
              }
              
              console.log('📊 取得データ:', { post: post.id, user: user?.nickname });
              
              transformedData.push({
                id: post.id,
                user_id: post.user_id,
                content: post.content || '',
                image_url: post.image_url,
                is_anonymous: post.is_anonymous || false,
                created_at: post.created_at,
                updated_at: post.updated_at,
                likes_count: post.likes_count || 0,
                comments_count: post.comments_count || 0,
                user_liked: true,
                users: user ? {
                  id: user.id,
                  nickname: (user.nickname || 'Unknown User').replace(/_修正$/, ''),
                  avatar_url: user.avatar_url,
                  is_anonymous: user.is_anonymous || false
                } : null,
                liked_at: like.created_at
              });
            }
            
            console.log('✅ フォールバック結果:', transformedData);
            return { data: transformedData };
          }
          
          // ネストクエリは使用せず、常にフォールバックを使用
          console.log('⚠️ ネストクエリはスキップ（usersがnullになるため）');
        } catch (error) {
          console.error('💥 いいねした投稿取得で予期しないエラー:', error);
          return { error: { message: 'Failed to fetch liked posts', error } };
        }
      },
      providesTags: (result, error, { userId }) => [
        { type: 'Post', id: `LIKED_USER_${userId}` },
        { type: 'Like', id: `USER_${userId}` },
        ...(result || []).map(post => ({ type: 'Post' as const, id: post.id }))
      ],
      keepUnusedDataFor: CACHE_TIMES.MEDIUM
    }),
  }),
  overrideExisting: true,
});

// Export hooks for usage in components
export const {
  // Post queries
  useGetPostsQuery,
  useGetPostQuery,
  useGetPostsCountQuery,
  useGetLikedPostsQuery,
  
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