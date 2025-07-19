import { MockEndpoint } from '../../../types/api';

export const healthCheckMock: MockEndpoint = {
  url: '/health',
  method: 'GET',
  response: {
    status: 'ok',
    timestamp: () => new Date().toISOString(),
    version: '1.0.0',
    environment: 'development',
    services: {
      database: 'connected',
      api: 'healthy',
      cache: 'available',
    },
  },
  delay: 100,
  status: 200,
};

export const authLoginMock: MockEndpoint = {
  url: '/auth/login',
  method: 'POST',
  response: (requestData: any) => ({
    success: true,
    user: {
      id: 'user_123',
      email: requestData?.email || 'test@example.com',
      name: 'テストユーザー',
      avatar: 'https://via.placeholder.com/150',
      role: 'user',
    },
    tokens: {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiresIn: 3600,
    },
    loginTime: new Date().toISOString(),
  }),
  delay: 800,
  status: 200,
};

export const authRefreshMock: MockEndpoint = {
  url: '/auth/refresh',
  method: 'POST',
  response: {
    success: true,
    tokens: {
      accessToken: () => 'mock_refreshed_token_' + Date.now(),
      expiresIn: 3600,
    },
    refreshTime: () => new Date().toISOString(),
  },
  delay: 300,
  status: 200,
};

export const userProfileMock: MockEndpoint = {
  url: '/user/profile',
  method: 'GET',
  response: {
    id: 'user_123',
    email: 'test@example.com',
    name: 'テストユーザー',
    avatar: 'https://via.placeholder.com/150',
    bio: 'これはテストユーザーのプロフィールです。',
    location: '東京, 日本',
    joinedAt: '2024-01-01T00:00:00Z',
    stats: {
      posts: 42,
      followers: 128,
      following: 56,
    },
    preferences: {
      theme: 'light',
      notifications: true,
      privacy: 'public',
    },
  },
  delay: 200,
  status: 200,
};

export const postsListMock: MockEndpoint = {
  url: '/posts',
  method: 'GET',
  response: {
    posts: [
      {
        id: 'post_1',
        title: 'テスト投稿1',
        content: 'これは最初のテスト投稿です。',
        author: {
          id: 'user_123',
          name: 'テストユーザー',
          avatar: 'https://via.placeholder.com/50',
        },
        createdAt: '2024-07-19T10:00:00Z',
        likes: 5,
        comments: 2,
        tags: ['テスト', '投稿'],
      },
      {
        id: 'post_2',
        title: 'テスト投稿2',
        content: 'これは2番目のテスト投稿です。',
        author: {
          id: 'user_456',
          name: '別のユーザー',
          avatar: 'https://via.placeholder.com/50',
        },
        createdAt: '2024-07-19T09:30:00Z',
        likes: 12,
        comments: 7,
        tags: ['サンプル', 'モック'],
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      hasNext: false,
    },
  },
  delay: 400,
  status: 200,
};

export const createPostMock: MockEndpoint = {
  url: '/posts',
  method: 'POST',
  response: (requestData: any) => ({
    success: true,
    post: {
      id: 'post_' + Date.now(),
      title: requestData?.title || '新しい投稿',
      content: requestData?.content || '',
      author: {
        id: 'user_123',
        name: 'テストユーザー',
        avatar: 'https://via.placeholder.com/50',
      },
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      tags: requestData?.tags || [],
    },
  }),
  delay: 600,
  status: 201,
};

export const errorMocks: MockEndpoint[] = [
  {
    url: '/error/400',
    method: 'GET',
    response: {
      error: 'Bad Request',
      message: 'リクエストが無効です',
      code: 'INVALID_REQUEST',
    },
    status: 400,
  },
  {
    url: '/error/401',
    method: 'GET',
    response: {
      error: 'Unauthorized',
      message: '認証が必要です',
      code: 'AUTHENTICATION_REQUIRED',
    },
    status: 401,
  },
  {
    url: '/error/404',
    method: 'GET',
    response: {
      error: 'Not Found',
      message: 'リソースが見つかりません',
      code: 'RESOURCE_NOT_FOUND',
    },
    status: 404,
  },
  {
    url: '/error/500',
    method: 'GET',
    response: {
      error: 'Internal Server Error',
      message: 'サーバー内部エラーが発生しました',
      code: 'INTERNAL_ERROR',
    },
    status: 500,
    delay: 1000,
  },
];

export const allMockEndpoints: MockEndpoint[] = [
  healthCheckMock,
  authLoginMock,
  authRefreshMock,
  userProfileMock,
  postsListMock,
  createPostMock,
  ...errorMocks,
];

export function initializeMockData(): MockEndpoint[] {
  return allMockEndpoints;
}