import { UserService } from '@/services/UserService';
import { HttpClient } from '@/services/api/httpClient';
import { FeatureFlagsManager } from '@/services/featureFlags';
import { UpdateProfileData, User, UserProfile } from '@/types/users';
import { ApiResponse } from '@/types/api';

// モックの設定
jest.mock('@/services/api/httpClient');
jest.mock('@/services/featureFlags');
jest.mock('@/utils/apiUtils');
jest.mock('@/utils/errorUtils');

const MockedHttpClient = jest.mocked(HttpClient);
const MockedFeatureFlagsManager = jest.mocked(FeatureFlagsManager);

describe('UserService', () => {
  let userService: UserService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockFeatureFlags: jest.Mocked<FeatureFlagsManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // HttpClientのモック
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      getAxiosInstance: jest.fn(),
      updateConfig: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;
    MockedHttpClient.getInstance.mockReturnValue(mockHttpClient);

    // FeatureFlagsManagerのモック
    mockFeatureFlags = {
      isApiEnabled: jest.fn(),
      initializeWithSupabase: jest.fn(),
      getFlag: jest.fn(),
      getAllFlags: jest.fn(),
      setFlag: jest.fn(),
      resetFlag: jest.fn(),
      resetAllFlags: jest.fn(),
      isSupabaseEnabled: jest.fn(),
      isReduxEnabled: jest.fn(),
      isRealtimeEnabled: jest.fn(),
      isPerformanceMonitoringEnabled: jest.fn(),
      isDebugModeEnabled: jest.fn(),
      isMockModeEnabled: jest.fn(),
      isFeatureFlagEnabled: jest.fn(),
      isAuthenticationEnabled: jest.fn(),
      isNotificationsEnabled: jest.fn(),
      getCacheTTL: jest.fn(),
      getMaxRetries: jest.fn(),
      getRequestTimeout: jest.fn(),
      getMaxConcurrentRequests: jest.fn(),
      getBatchSize: jest.fn(),
      getRealtimeHeartbeatInterval: jest.fn(),
      enableSupabaseIntegration: jest.fn(),
      disableSupabaseIntegration: jest.fn(),
      enableRedux: jest.fn(),
      disableRedux: jest.fn(),
      getDebugInfo: jest.fn(),
    } as unknown as jest.Mocked<FeatureFlagsManager>;
    MockedFeatureFlagsManager.getInstance.mockReturnValue(mockFeatureFlags);

    // UserServiceインスタンス作成（シングルトンをリセット）
    (UserService as any).instance = undefined;
    userService = UserService.getInstance();
  });

  afterEach(() => {
    userService.clearCache();
  });

  describe('getMyProfile', () => {
    const mockUserProfile: UserProfile = {
      id: 'user-123',
      nickname: 'テストユーザー',
      bio: 'テストユーザーです',
      avatar: 'https://example.com/avatar.jpg',
      followersCount: 100,
      followingCount: 50,
      postsCount: 25,
      email: 'test@example.com',
      motherBookNumber: 'encrypted-123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-07-01T00:00:00Z',
      preferences: {
        darkMode: false,
        handedness: 'right',
        language: 'ja',
        notifications: {
          likes: true,
          comments: true,
          follows: true,
          messages: true,
          pushEnabled: true,
        },
      },
      privacy: {
        profileVisibility: 'public',
        showFollowersCount: true,
        showFollowingCount: true,
        allowMessages: true,
      },
    };

    it('API有効時にプロフィール情報を正常に取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockUserProfile,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<UserProfile>);

      const result = await userService.getMyProfile();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/me');
      expect(result).toEqual(mockUserProfile);
    });

    it('API無効時にモックデータを取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await userService.getMyProfile();

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('nickname');
      expect(result).toHaveProperty('preferences');
      expect(result).toHaveProperty('privacy');
    });

    it('キャッシュからプロフィール情報を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockUserProfile,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<UserProfile>);

      // 初回取得
      await userService.getMyProfile();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      // 2回目はキャッシュから取得
      const result = await userService.getMyProfile();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserProfile);
    });

    it('API呼び出しエラー時に適切にエラーを投げること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      const error = new Error('API Error');
      mockHttpClient.get.mockRejectedValue(error);

      await expect(userService.getMyProfile()).rejects.toThrow();
      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/me');
    });
  });

  describe('updateProfile', () => {
    const updateData: UpdateProfileData = {
      nickname: '更新ユーザー',
      bio: '更新されたバイオ',
    };

    const updatedProfile: UserProfile = {
      id: 'user-123',
      nickname: '更新ユーザー',
      bio: '更新されたバイオ',
      avatar: 'https://example.com/avatar.jpg',
      followersCount: 100,
      followingCount: 50,
      postsCount: 25,
      email: 'test@example.com',
      motherBookNumber: 'encrypted-123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-07-21T00:00:00Z',
      preferences: {
        darkMode: false,
        handedness: 'right',
        language: 'ja',
        notifications: {
          likes: true,
          comments: true,
          follows: true,
          messages: true,
          pushEnabled: true,
        },
      },
      privacy: {
        profileVisibility: 'public',
        showFollowersCount: true,
        showFollowingCount: true,
        allowMessages: true,
      },
    };

    it('API有効時にプロフィール情報を正常に更新できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.put.mockResolvedValue({
        data: updatedProfile,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<UserProfile>);

      const result = await userService.updateProfile(updateData);

      expect(mockHttpClient.put).toHaveBeenCalledWith('/users/me', updateData);
      expect(result).toEqual(updatedProfile);
    });

    it('API無効時にモックでプロフィール更新を実行できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await userService.updateProfile(updateData);

      expect(mockHttpClient.put).not.toHaveBeenCalled();
      expect(result).toHaveProperty('nickname', updateData.nickname);
      expect(result).toHaveProperty('bio', updateData.bio);
    });

    it('更新後にキャッシュが更新されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.put.mockResolvedValue({
        data: updatedProfile,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<UserProfile>);

      await userService.updateProfile(updateData);

      // getMyProfileを実行してもAPIが呼ばれない（キャッシュから取得）
      mockHttpClient.get.mockResolvedValue({
        data: updatedProfile,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<UserProfile>);

      const cachedResult = await userService.getMyProfile();
      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(cachedResult).toEqual(updatedProfile);
    });
  });

  describe('getUserById', () => {
    const userId = 'user-456';
    const mockUser: User = {
      id: userId,
      nickname: '他ユーザー',
      bio: '他のユーザーです',
      avatar: 'https://example.com/avatar2.jpg',
      followersCount: 200,
      followingCount: 100,
      postsCount: 50,
      isFollowing: false,
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-07-01T00:00:00Z',
    };

    it('API有効時に他ユーザー情報を正常に取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockUser,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<User>);

      const result = await userService.getUserById(userId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/users/${userId}`);
      expect(result).toEqual(mockUser);
    });

    it('API無効時にモックユーザー情報を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await userService.getUserById(userId);

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('nickname');
    });

    it('キャッシュからユーザー情報を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockUser,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<User>);

      // 初回取得
      await userService.getUserById(userId);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      // 2回目はキャッシュから取得
      const result = await userService.getUserById(userId);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('searchUsers', () => {
    const query = 'テスト';
    const mockSearchResult = {
      users: [
        {
          id: 'search-user-1',
          nickname: 'テストユーザー1',
          bio: 'テストについて投稿しています',
          avatar: 'https://example.com/avatar1.jpg',
          followersCount: 50,
          followingCount: 30,
          postsCount: 20,
          isFollowing: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-07-01T00:00:00Z',
        },
      ],
      total: 10,
      hasMore: true,
      nextCursor: 'page-2',
    };

    it('API有効時にユーザー検索を正常に実行できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockSearchResult,
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<any>);

      const result = await userService.searchUsers(query, 1, 20);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `/users/search?q=${query}&page=1&limit=20`
      );
      expect(result).toEqual(mockSearchResult);
    });

    it('API無効時にモック検索結果を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await userService.searchUsers(query, 1, 10);

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(result.users).toBeInstanceOf(Array);
    });
  });

  describe('キャッシュ管理', () => {
    it('clearCacheですべてのキャッシュがクリアされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { id: 'user-123' },
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<any>);

      // キャッシュを作成
      await userService.getMyProfile();
      await userService.getUserById('user-456');

      // キャッシュクリア
      userService.clearCache();

      // 再度取得時はAPIが呼ばれる（キャッシュが無いため）
      await userService.getMyProfile();
      await userService.getUserById('user-456');

      expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
    });

    it('clearUserCacheで特定ユーザーのキャッシュがクリアされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { id: 'user-123' },
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<any>);

      const userId = 'user-456';
      await userService.getUserById(userId);

      // 特定ユーザーのキャッシュをクリア
      userService.clearUserCache(userId);

      // 再度取得時はAPIが呼ばれる
      await userService.getUserById(userId);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('clearUserCache（引数なし）で自分のプロフィールキャッシュがクリアされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { id: 'current-user' },
        message: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as ApiResponse<any>);

      await userService.getMyProfile();

      // 自分のプロフィールキャッシュをクリア
      userService.clearUserCache();

      // 再度取得時はAPIが呼ばれる
      await userService.getMyProfile();

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});