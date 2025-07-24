import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
import { supabaseClient } from './supabase/client';
import {
  Post as SupabasePost,
  Comment as SupabaseComment,
  User,
  PostInsert,
  CommentInsert,
} from '../types/supabase';
import {
  Post,
  Comment,
  PostsResponse,
  CommentsResponse,
  CreatePostRequest,
  CreateCommentRequest,
  PostsQueryParams,
  CommentsQueryParams,
} from '../types/posts';
import { ApiResponse } from '../types/api';

export class PostsService {
  private static instance: PostsService;
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.httpClient = HttpClient.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  // RTK Query integration helper
  public shouldUseRTKQuery(): boolean {
    return this.featureFlags.isReduxEnabled() && this.featureFlags.isSupabaseEnabled();
  }

  // Get preferred data source based on feature flags
  public getDataSourceInfo(): { source: 'rtk-query' | 'supabase' | 'http' | 'mock'; priority: number } {
    if (this.featureFlags.isReduxEnabled() && this.featureFlags.isSupabaseEnabled()) {
      return { source: 'rtk-query', priority: 1 };
    } else if (this.featureFlags.isSupabaseEnabled()) {
      return { source: 'supabase', priority: 2 };
    } else if (this.featureFlags.isApiEnabled()) {
      return { source: 'http', priority: 3 };
    } else {
      return { source: 'mock', priority: 4 };
    }
  }

  public static getInstance(): PostsService {
    if (!PostsService.instance) {
      PostsService.instance = new PostsService();
    }
    return PostsService.instance;
  }

  public async getPosts(params: PostsQueryParams = {}): Promise<PostsResponse> {
    // Note: If RTK Query is enabled, components should use hooks directly
    // This method serves as fallback or for direct service usage
    if (this.shouldUseRTKQuery()) {
      console.info('RTK Query is available - consider using useGetPostsQuery hook for better caching');
    }

    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabasePosts(params);
    } else if (this.featureFlags.isApiEnabled()) {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.order) queryParams.append('order', params.order);

      const url = `/posts?${queryParams.toString()}`;

      try {
        const response: ApiResponse<PostsResponse> = await this.httpClient.get<PostsResponse>(url);
        return response.data;
      } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw error;
      }
    } else {
      return this.getMockPosts(params);
    }
  }

  public async createPost(data: CreatePostRequest): Promise<Post> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.createSupabasePost(data);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<Post> = await this.httpClient.post<Post>('/posts', data);
        return response.data;
      } catch (error) {
        console.error('Failed to create post:', error);
        throw error;
      }
    } else {
      return this.createMockPost(data);
    }
  }

  public async likePost(postId: string): Promise<void> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.supabaseLikePost(postId);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        await this.httpClient.post(`/posts/${postId}/like`);
      } catch (error) {
        console.error('Failed to like post:', error);
        throw error;
      }
    } else {
      await this.delay(this.featureFlags.getMockDelay());
    }
  }

  public async unlikePost(postId: string): Promise<void> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.supabaseUnlikePost(postId);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        await this.httpClient.delete(`/posts/${postId}/like`);
      } catch (error) {
        console.error('Failed to unlike post:', error);
        throw error;
      }
    } else {
      await this.delay(this.featureFlags.getMockDelay());
    }
  }

  public async getComments(postId: string, params: CommentsQueryParams = {}): Promise<CommentsResponse> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getSupabaseComments(postId, params);
    } else if (this.featureFlags.isApiEnabled()) {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.order) queryParams.append('order', params.order);

      const url = `/posts/${postId}/comments?${queryParams.toString()}`;

      try {
        const response: ApiResponse<CommentsResponse> = await this.httpClient.get<CommentsResponse>(url);
        return response.data;
      } catch (error) {
        console.error('Failed to fetch comments:', error);
        throw error;
      }
    } else {
      return this.getMockComments(postId, params);
    }
  }

  public async createComment(postId: string, data: CreateCommentRequest): Promise<Comment> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.createSupabaseComment(postId, data);
    } else if (this.featureFlags.isApiEnabled()) {
      try {
        const response: ApiResponse<Comment> = await this.httpClient.post<Comment>(`/posts/${postId}/comments`, data);
        return response.data;
      } catch (error) {
        console.error('Failed to create comment:', error);
        throw error;
      }
    } else {
      return this.createMockComment(postId, data);
    }
  }

  private async getMockPosts(params: PostsQueryParams = {}): Promise<PostsResponse> {
    await this.delay(this.featureFlags.getMockDelay());

    const page = params.page || 1;
    const limit = params.limit || 10;
    const sortBy = params.sortBy || 'createdAt';
    const order = params.order || 'desc';

    let posts = this.generateMockPosts();

    if (sortBy === 'createdAt') {
      posts = posts.sort((a, b) => {
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);
        return order === 'desc' ? bDate.getTime() - aDate.getTime() : aDate.getTime() - bDate.getTime();
      });
    } else if (sortBy === 'likesCount') {
      posts = posts.sort((a, b) => {
        return order === 'desc' ? b.likesCount - a.likesCount : a.likesCount - b.likesCount;
      });
    }

    const totalItems = posts.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    return {
      posts: paginatedPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private async createMockPost(data: CreatePostRequest): Promise<Post> {
    await this.delay(this.featureFlags.getMockDelay());

    return {
      id: `mock_post_${Date.now()}`,
      content: data.content,
      authorId: 'mock_user_1',
      authorName: 'ユーザー',
      authorAvatar: 'https://via.placeholder.com/40',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      images: data.images,
    };
  }

  private async getMockComments(postId: string, params: CommentsQueryParams = {}): Promise<CommentsResponse> {
    await this.delay(this.featureFlags.getMockDelay());

    const page = params.page || 1;
    const limit = params.limit || 20;

    const mockComments = this.generateMockComments(postId);
    const totalItems = mockComments.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = mockComments.slice(startIndex, endIndex);

    return {
      comments: paginatedComments,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private async createMockComment(postId: string, data: CreateCommentRequest): Promise<Comment> {
    await this.delay(this.featureFlags.getMockDelay());

    return {
      id: `mock_comment_${Date.now()}`,
      postId,
      authorId: 'mock_user_1',
      authorName: 'ユーザー',
      authorAvatar: 'https://via.placeholder.com/40',
      content: data.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private generateMockPosts(): Post[] {
    const posts: Post[] = [];
    const authors = [
      { id: 'user1', name: '田中さん', avatar: 'https://via.placeholder.com/40' },
      { id: 'user2', name: '佐藤さん', avatar: 'https://via.placeholder.com/40' },
      { id: 'user3', name: '鈴木さん', avatar: 'https://via.placeholder.com/40' },
    ];

    const contents = [
      '今日は子供と公園に行きました。とても楽しかったです！',
      '離乳食のレシピを試してみました。意外と簡単でした。',
      'イヤイヤ期が大変ですが、成長を感じています。',
      '保育園の準備が大変。明日から新学期です。',
      'ママ友とランチしました。リフレッシュできました♪',
    ];

    for (let i = 0; i < 15; i++) {
      const author = authors[i % authors.length];
      const content = contents[i % contents.length];
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();

      posts.push({
        id: `mock_post_${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        createdAt,
        updatedAt: createdAt,
        likesCount: Math.floor(Math.random() * 20),
        commentsCount: Math.floor(Math.random() * 10),
        isLiked: Math.random() > 0.7,
      });
    }

    return posts;
  }

  private generateMockComments(postId: string): Comment[] {
    const comments: Comment[] = [];
    const authors = [
      { id: 'user1', name: '田中さん', avatar: 'https://via.placeholder.com/40' },
      { id: 'user2', name: '佐藤さん', avatar: 'https://via.placeholder.com/40' },
      { id: 'user3', name: '鈴木さん', avatar: 'https://via.placeholder.com/40' },
    ];

    const commentContents = [
      'とても素敵ですね！',
      '私も同じ経験があります。',
      'お疲れさまです！',
      'いいですね♪',
      '参考になります。',
    ];

    for (let i = 0; i < Math.floor(Math.random() * 8) + 1; i++) {
      const author = authors[i % authors.length];
      const content = commentContents[i % commentContents.length];
      const createdAt = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString();

      comments.push({
        id: `mock_comment_${postId}_${i + 1}`,
        postId,
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        content,
        createdAt,
        updatedAt: createdAt,
      });
    }

    return comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enhanced error handling with retry logic
  private async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          console.error(`Operation failed after ${maxRetries} attempts:`, lastError);
          throw lastError;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  // Enhanced Supabase connection check
  private async ensureSupabaseConnection(): Promise<void> {
    if (!supabaseClient.isInitialized()) {
      throw new Error('Supabase client is not initialized');
    }

    const status = await supabaseClient.testConnection();
    if (!status.isConnected) {
      throw new Error(`Supabase connection failed: ${status.error || 'Unknown error'}`);
    }
  }

  // Supabase methods
  private async getSupabasePosts(params: PostsQueryParams = {}): Promise<PostsResponse> {
    await this.ensureSupabaseConnection();

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      const page = params.page || 1;
      const limit = params.limit || 10;
      const sortBy = params.sortBy || 'created_at';
      const order = params.order || 'desc';

      try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = client
        .from('posts')
        .select(`
          *,
          users!inner (
            id,
            nickname,
            avatar_url
          )
        `, { count: 'exact' })
        .order(sortBy, { ascending: order === 'asc' })
        .range(from, to);

      const { data: posts, error, count } = await query;

      if (error) {
        console.error('Supabase posts fetch error:', error);
        throw new Error(`Failed to fetch posts: ${error.message}`);
      }

      const transformedPosts = await Promise.all(
        (posts || []).map(async (post) => {
          const user = Array.isArray(post.users) ? post.users[0] : post.users;
          
          // Get user's like status for this post
          const currentUser = await supabaseClient.getCurrentUser();
          let isLiked = false;
          
          if (currentUser) {
            const { data: like } = await client
              .from('likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .single();
            isLiked = !!like;
          }

          return {
            id: post.id,
            content: post.content,
            authorId: post.user_id,
            authorName: user?.nickname || 'Unknown',
            authorAvatar: user?.avatar_url || 'https://via.placeholder.com/40',
            createdAt: post.created_at || new Date().toISOString(),
            updatedAt: post.updated_at || new Date().toISOString(),
            likesCount: post.likes_count || 0,
            commentsCount: post.comments_count || 0,
            isLiked,
            images: post.image_url ? [post.image_url] : undefined,
          };
        })
      );

      const totalItems = count || transformedPosts.length;
      const totalPages = Math.ceil(totalItems / limit);

      return {
        posts: transformedPosts,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
      } catch (error) {
        console.error('Failed to fetch posts from Supabase:', error);
        throw error;
      }
    });
  }

  private async createSupabasePost(data: CreatePostRequest): Promise<Post> {
    console.log('🚀 createSupabasePost開始');
    await this.ensureSupabaseConnection();
    
    // Supabaseの現在のセッション状態を確認
    const client = supabaseClient.getClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    console.log('🔍 Supabase session:', sessionData);
    if (sessionError) {
      console.error('❌ Supabase session error:', sessionError);
    }
    
    // For custom auth, get user ID from Redux state instead of Supabase client
    let currentUserId: string | null = null;
    
    // Use Redux store to get current user (for custom auth)
    try {
      const { store } = await import('../store');
      const state = store.getState();
      currentUserId = state.auth?.user?.id || null;
      console.log('🔍 Current user ID from Redux:', currentUserId);
      console.log('🔍 Full auth state:', state.auth);
    } catch (error) {
      console.error('❌ Failed to get user ID from Redux:', error);
    }

    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();
      
      try {
        // カスタム認証の場合、投稿作成前にSupabaseセッションを設定
        const { store } = await import('../store');
        const state = store.getState();
        const session = state.auth?.session;
        
        console.log('=================== カスタム認証状態確認 ===================');
        console.log('🔍 Session exists:', !!session);
        console.log('🔍 Session details:', session);
        console.log('🔍 Access token exists:', !!(session && session.access_token));
        console.log('==========================================================');
        
        if (session && session.access_token) {
          console.log('🔧 カスタム認証セッションを設定中...');
          try {
            // Supabaseにカスタム認証のセッションを設定
            const { error: setSessionError } = await client.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token || session.access_token, // Fallback
            });
            
            if (setSessionError) {
              console.warn('⚠️ セッション設定エラー:', setSessionError);
              console.warn('⚠️ セッション設定エラー詳細:', JSON.stringify(setSessionError, null, 2));
            } else {
              console.log('✅ Supabaseセッション設定完了');
              
              // セッション設定後の状態を確認
              const { data: currentSession } = await client.auth.getSession();
              console.log('🔍 設定後のSupabaseセッション:', currentSession);
            }
          } catch (sessionSetError) {
            console.warn('⚠️ セッション設定で例外:', sessionSetError);
          }
        } else {
          console.warn('⚠️ カスタム認証セッションまたはアクセストークンが見つかりません');
        }
        
        const postData: PostInsert = {
          content: data.content,
          user_id: currentUserId,
          image_url: data.images?.[0] || null,
          is_anonymous: false,
          likes_count: 0,
          comments_count: 0,
        };

        console.log('🔍 Creating post with data:', postData);
        
        // Supabase接続テストを追加
        console.log('=================== Supabase接続テスト ===================');
        try {
          const { data: testData, error: testError } = await client
            .from('users')
            .select('id')
            .limit(1);
          
          if (testError) {
            console.error('❌ Supabase接続テストエラー:', testError);
          } else {
            console.log('✅ Supabase接続テスト成功:', testData);
          }
        } catch (testConnectionError) {
          console.error('❌ Supabase接続テスト例外:', testConnectionError);
        }
        console.log('=======================================================');

        // 投稿を作成 - カスタム認証の場合はRPCファンクションを使用
        console.log('💡 投稿作成処理を開始します');
        
        // まず通常の方法を試す
        let post, error;
        try {
          const result = await client
            .from('posts')
            .insert(postData)
            .select()
            .single();
          post = result.data;
          error = result.error;
        } catch (insertError) {
          console.error('直接INSERT失敗:', insertError);
          error = insertError;
        }
        
        // 直接INSERTが失敗した場合、RPC関数を試す
        if (error) {
          console.log('🔄 直接INSERT失敗、RPC関数を試します');
          try {
            const rpcResult = await client.rpc('create_post_custom_auth', {
              p_content: postData.content,
              p_user_id: postData.user_id,
              p_image_url: postData.image_url,
              p_is_anonymous: postData.is_anonymous
            });
            
            if (rpcResult.error) {
              console.error('RPC関数エラー:', rpcResult.error);
              error = rpcResult.error;
            } else {
              console.log('✅ RPC関数で投稿作成成功');
              post = rpcResult.data[0] || rpcResult.data;
              error = null;
            }
          } catch (rpcError) {
            console.error('RPC関数例外:', rpcError);
            // RPC関数が存在しない場合はそのまま元のエラーを使用
          }
        }

      if (error) {
        console.error('=================== Supabase投稿作成エラー詳細 ===================');
        console.error('❌ Supabase post creation error:', error);
        console.error('❌ Error type:', typeof error);
        console.error('❌ Error constructor:', error.constructor.name);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          status: error.status,
          statusCode: error.statusCode,
          full_error: error
        });
        console.error('❌ Error JSON:', JSON.stringify(error, null, 2));
        console.error('===============================================================');
        throw new Error(`Failed to create post: ${error.message || 'Unknown Supabase error'}`);
      }

      console.log('✅ Post created successfully:', post);

      // 投稿作成後、ユーザー情報を別途取得
      let user = null;
      try {
        const { data: userData, error: userError } = await client
          .from('users')
          .select('id, nickname, avatar_url')
          .eq('id', currentUserId)
          .single();

        if (userError) {
          console.warn('Failed to fetch user data:', userError);
          user = {
            id: currentUserId,
            nickname: 'Unknown',
            avatar_url: 'https://via.placeholder.com/40'
          };
        } else {
          user = userData;
        }
      } catch (userFetchError) {
        console.warn('Error fetching user data:', userFetchError);
        user = {
          id: currentUserId,
          nickname: 'Unknown',
          avatar_url: 'https://via.placeholder.com/40'
        };
      }

      return {
        id: post.id,
        content: post.content,
        authorId: post.user_id,
        authorName: user?.nickname || 'Unknown',
        authorAvatar: user?.avatar_url || 'https://via.placeholder.com/40',
        createdAt: post.created_at || new Date().toISOString(),
        updatedAt: post.updated_at || new Date().toISOString(),
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
        images: post.image_url ? [post.image_url] : undefined,
      };
      } catch (error) {
        console.error('Failed to create post in Supabase:', error);
        throw error;
      }
    });
  }

  private async supabaseLikePost(postId: string): Promise<void> {
    await this.ensureSupabaseConnection();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    return this.withRetry(async () => {
      const client = supabaseClient.getClient();

      try {
      // Check if already liked
      const { data: existingLike } = await client
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      if (existingLike) {
        return; // Already liked
      }

      // Create like
      const { error: likeError } = await client
        .from('likes')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
        });

      if (likeError) {
        throw new Error(`Failed to like post: ${likeError.message}`);
      }

      // Update likes count
      const { data: post } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single();

      await client
        .from('posts')
        .update({ likes_count: (post?.likes_count || 0) + 1 })
        .eq('id', postId);
      } catch (error) {
        console.error('Failed to like post in Supabase:', error);
        throw error;
      }
    });
  }

  private async supabaseUnlikePost(postId: string): Promise<void> {
    const client = supabaseClient.getClient();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      // Remove like
      const { error: deleteError } = await client
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUser.id);

      if (deleteError) {
        throw new Error(`Failed to unlike post: ${deleteError.message}`);
      }

      // Update likes count
      const { data: post } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single();

      await client
        .from('posts')
        .update({ likes_count: Math.max((post?.likes_count || 1) - 1, 0) })
        .eq('id', postId);
    } catch (error) {
      console.error('Failed to unlike post in Supabase:', error);
      throw error;
    }
  }

  private async getSupabaseComments(postId: string, params: CommentsQueryParams = {}): Promise<CommentsResponse> {
    const client = supabaseClient.getClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const sortBy = params.sortBy || 'created_at';
    const order = params.order || 'asc'; // Comments usually ascending by time

    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: comments, error, count } = await client
        .from('comments')
        .select(`
          *,
          users!inner (
            id,
            nickname,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('post_id', postId)
        .order(sortBy, { ascending: order === 'asc' })
        .range(from, to);

      if (error) {
        console.error('Supabase comments fetch error:', error);
        throw new Error(`Failed to fetch comments: ${error.message}`);
      }

      const transformedComments = (comments || []).map((comment) => {
        const user = Array.isArray(comment.users) ? comment.users[0] : comment.users;
        
        return {
          id: comment.id,
          postId: comment.post_id,
          authorId: comment.user_id,
          authorName: user?.nickname || 'Unknown',
          authorAvatar: user?.avatar_url || 'https://via.placeholder.com/40',
          content: comment.content,
          createdAt: comment.created_at || new Date().toISOString(),
          updatedAt: comment.updated_at || new Date().toISOString(),
        };
      });

      const totalItems = count || transformedComments.length;
      const totalPages = Math.ceil(totalItems / limit);

      return {
        comments: transformedComments,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error) {
      console.error('Failed to fetch comments from Supabase:', error);
      throw error;
    }
  }

  private async createSupabaseComment(postId: string, data: CreateCommentRequest): Promise<Comment> {
    const client = supabaseClient.getClient();
    const currentUser = await supabaseClient.getCurrentUser();

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const commentData: CommentInsert = {
        content: data.content,
        post_id: postId,
        user_id: currentUser.id,
        is_anonymous: false,
      };

      const { data: comment, error } = await client
        .from('comments')
        .insert(commentData)
        .select(`
          *,
          users!inner (
            id,
            nickname,
            avatar_url
          )
        `)
        .single();

      if (error) {
        console.error('Supabase comment creation error:', error);
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      // Update comments count
      const { data: post } = await client
        .from('posts')
        .select('comments_count')
        .eq('id', postId)
        .single();

      await client
        .from('posts')
        .update({ comments_count: (post?.comments_count || 0) + 1 })
        .eq('id', postId);

      const user = Array.isArray(comment.users) ? comment.users[0] : comment.users;

      return {
        id: comment.id,
        postId: comment.post_id,
        authorId: comment.user_id,
        authorName: user?.nickname || 'Unknown',
        authorAvatar: user?.avatar_url || 'https://via.placeholder.com/40',
        content: comment.content,
        createdAt: comment.created_at || new Date().toISOString(),
        updatedAt: comment.updated_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to create comment in Supabase:', error);
      throw error;
    }
  }
}