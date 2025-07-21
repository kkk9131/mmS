import { HttpClient } from './api/httpClient';
import { FeatureFlagsManager } from './featureFlags';
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

  public static getInstance(): PostsService {
    if (!PostsService.instance) {
      PostsService.instance = new PostsService();
    }
    return PostsService.instance;
  }

  public async getPosts(params: PostsQueryParams = {}): Promise<PostsResponse> {
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
    if (this.featureFlags.isApiEnabled()) {
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
        id: `mock_post_${i + 1}`,
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
}