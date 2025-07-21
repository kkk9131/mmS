import { FollowService } from '../../src/services/FollowService';
import { HttpClient } from '../../src/services/api/httpClient';
import { FeatureFlagsManager } from '../../src/services/featureFlags';
import { FollowUser, FollowListResponse, FollowSuggestion } from '../../src/types/follow';
import { ApiResponse } from '../../src/types/api';

jest.mock('../../src/services/api/httpClient');
jest.mock('../../src/services/featureFlags');
jest.mock('../../src/utils/apiUtils');
jest.mock('../../src/utils/errorUtils');

const MockedHttpClient = jest.mocked(HttpClient);
const MockedFeatureFlagsManager = jest.mocked(FeatureFlagsManager);

describe('FollowService', () => {
  let followService: FollowService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockFeatureFlags: jest.Mocked<FeatureFlagsManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<HttpClient>;
    MockedHttpClient.getInstance.mockReturnValue(mockHttpClient);

    mockFeatureFlags = {
      isApiEnabled: jest.fn(),
    } as jest.Mocked<FeatureFlagsManager>;
    MockedFeatureFlagsManager.getInstance.mockReturnValue(mockFeatureFlags);

    (FollowService as any).instance = undefined;
    followService = FollowService.getInstance();
  });

  afterEach(() => {
    followService.clearCache();
  });

  describe('getFollowing', () => {
    const mockFollowing: FollowUser[] = [
      {
        id: 'user-1',
        nickname: 'フォローユーザー1',
        bio: 'よろしくお願いします',
        avatar: 'https://example.com/avatar1.jpg',
        followersCount: 100,
        followingCount: 50,
        postsCount: 25,
        isFollowing: true,
        followedAt: '2024-06-01T00:00:00Z',
      },
      {
        id: 'user-2',
        nickname: 'フォローユーザー2',
        bio: '育児について発信中',
        avatar: 'https://example.com/avatar2.jpg',
        followersCount: 200,
        followingCount: 75,
        postsCount: 40,
        isFollowing: true,
        followedAt: '2024-06-15T00:00:00Z',
      },
    ];

    const mockResponse: FollowListResponse = {
      users: mockFollowing,
      total: 25,
      hasMore: true,
      nextCursor: 'cursor-2',
    };

    it('API有効時にフォロー一覧を正常に取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      const result = await followService.getFollowing('user-123', 1, 20);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user-123/following?page=1&limit=20');
      expect(result).toEqual(mockResponse);
    });

    it('API無効時にモックフォロー一覧を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await followService.getFollowing('user-123', 1, 10);

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(result.users).toBeInstanceOf(Array);
    });

    it('キャッシュからフォロー一覧を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      await followService.getFollowing('user-123', 1, 20);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      const result = await followService.getFollowing('user-123', 1, 20);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getFollowers', () => {
    const mockFollowers: FollowUser[] = [
      {
        id: 'follower-1',
        nickname: 'フォロワー1',
        bio: 'フォロワーです',
        avatar: 'https://example.com/follower1.jpg',
        followersCount: 50,
        followingCount: 30,
        postsCount: 15,
        isFollowing: false,
        followedAt: '2024-05-01T00:00:00Z',
      },
    ];

    const mockResponse: FollowListResponse = {
      users: mockFollowers,
      total: 10,
      hasMore: false,
    };

    it('API有効時にフォロワー一覧を正常に取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      const result = await followService.getFollowers('user-123', 1, 20);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user-123/followers?page=1&limit=20');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('follow', () => {
    it('フォロー処理が正常に実行されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.post.mockResolvedValue({
        data: { success: true },
        message: 'success',
      } as ApiResponse<{ success: boolean }>);

      const userId = 'user-456';
      const result = await followService.follow(userId);

      expect(mockHttpClient.post).toHaveBeenCalledWith(`/users/${userId}/follow`);
      expect(result).toEqual({ success: true });
    });

    it('API無効時にモック処理が実行されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await followService.follow('user-456');

      expect(mockHttpClient.post).not.toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('unfollow', () => {
    it('フォロー解除処理が正常に実行されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.delete.mockResolvedValue({
        data: { success: true },
        message: 'success',
      } as ApiResponse<{ success: boolean }>);

      const userId = 'user-456';
      const result = await followService.unfollow(userId);

      expect(mockHttpClient.delete).toHaveBeenCalledWith(`/users/${userId}/follow`);
      expect(result).toEqual({ success: true });
    });
  });

  describe('楽観的更新', () => {
    it('フォロー操作の楽観的更新が正常に動作すること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);

      // 初期フォロー状態
      const followingUsers: FollowUser[] = [
        {
          id: 'user-1',
          nickname: 'ユーザー1',
          bio: 'テスト',
          avatar: 'avatar.jpg',
          followersCount: 100,
          followingCount: 50,
          postsCount: 25,
          isFollowing: true,
          followedAt: '2024-06-01T00:00:00Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue({
        data: {
          users: followingUsers,
          total: 1,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      // 初期データ取得
      const initialResult = await followService.getFollowing('current-user');
      expect(initialResult.users).toHaveLength(1);
      expect(initialResult.users[0].isFollowing).toBe(true);

      // フォロー解除の楽観的更新
      mockHttpClient.delete.mockResolvedValue({
        data: { success: true },
        message: 'success',
      } as ApiResponse<{ success: boolean }>);

      const optimisticPromise = followService.unfollowOptimistic('user-1');

      // 楽観的更新後の状態確認（API完了前）
      const optimisticResult = await followService.getFollowing('current-user');
      expect(optimisticResult.users).toHaveLength(0); // フォロー解除でリストから削除

      // API完了まで待機
      await optimisticPromise;
    });

    it('楽観的更新でAPI呼び出しが失敗した場合にロールバックされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);

      const followingUsers: FollowUser[] = [
        {
          id: 'user-1',
          nickname: 'ユーザー1',
          bio: 'テスト',
          avatar: 'avatar.jpg',
          followersCount: 100,
          followingCount: 50,
          postsCount: 25,
          isFollowing: true,
          followedAt: '2024-06-01T00:00:00Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue({
        data: {
          users: followingUsers,
          total: 1,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      await followService.getFollowing('current-user');

      // API呼び出しを失敗させる
      mockHttpClient.delete.mockRejectedValue(new Error('API Error'));

      // 楽観的更新を実行（エラーは期待される）
      await expect(
        followService.unfollowOptimistic('user-1')
      ).rejects.toThrow();

      // ロールバック後の状態確認
      const rolledBackResult = await followService.getFollowing('current-user');
      expect(rolledBackResult.users).toHaveLength(1);
      expect(rolledBackResult.users[0].isFollowing).toBe(true);
    });
  });

  describe('バッチ操作', () => {
    it('複数ユーザーを一括フォローできること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.post.mockResolvedValue({
        data: { successCount: 2, failedUserIds: [] },
        message: 'success',
      } as ApiResponse<{ successCount: number; failedUserIds: string[] }>);

      const userIds = ['user-1', 'user-2'];
      const result = await followService.batchFollow(userIds);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/users/batch-follow', {
        userIds,
      });
      expect(result).toEqual({ successCount: 2, failedUserIds: [] });
    });

    it('複数ユーザーを一括フォロー解除できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.delete.mockResolvedValue({
        data: { successCount: 3, failedUserIds: ['user-4'] },
        message: 'success',
      } as ApiResponse<{ successCount: number; failedUserIds: string[] }>);

      const userIds = ['user-1', 'user-2', 'user-3', 'user-4'];
      const result = await followService.batchUnfollow(userIds);

      expect(mockHttpClient.delete).toHaveBeenCalledWith('/users/batch-unfollow', {
        data: { userIds },
      });
      expect(result).toEqual({ successCount: 3, failedUserIds: ['user-4'] });
    });
  });

  describe('フォロー推奨', () => {
    const mockSuggestions: FollowSuggestion[] = [
      {
        id: 'suggested-1',
        nickname: '推奨ユーザー1',
        bio: '共通の興味があります',
        avatar: 'https://example.com/suggested1.jpg',
        followersCount: 150,
        followingCount: 80,
        postsCount: 30,
        mutualConnectionsCount: 5,
        reasonType: 'mutual_follows',
        reasonText: '共通のフォロー先が5人います',
      },
    ];

    it('フォロー推奨ユーザーを取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { suggestions: mockSuggestions },
        message: 'success',
      } as ApiResponse<{ suggestions: FollowSuggestion[] }>);

      const result = await followService.getSuggestions(10);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/follow-suggestions?limit=10');
      expect(result).toEqual(mockSuggestions);
    });

    it('推奨を却下できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.delete.mockResolvedValue({
        data: { success: true },
        message: 'success',
      } as ApiResponse<{ success: boolean }>);

      const userId = 'suggested-1';
      const result = await followService.dismissSuggestion(userId);

      expect(mockHttpClient.delete).toHaveBeenCalledWith(`/users/follow-suggestions/${userId}`);
      expect(result).toEqual({ success: true });
    });
  });

  describe('フォロー状態チェック', () => {
    it('単一ユーザーのフォロー状態を確認できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { isFollowing: true },
        message: 'success',
      } as ApiResponse<{ isFollowing: boolean }>);

      const result = await followService.checkFollowStatus('user-456');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user-456/follow-status');
      expect(result).toBe(true);
    });

    it('複数ユーザーのフォロー状態を一括確認できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.post.mockResolvedValue({
        data: {
          followStatus: {
            'user-1': true,
            'user-2': false,
            'user-3': true,
          },
        },
        message: 'success',
      } as ApiResponse<{ followStatus: Record<string, boolean> }>);

      const userIds = ['user-1', 'user-2', 'user-3'];
      const result = await followService.batchCheckFollowStatus(userIds);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/users/batch-follow-status', {
        userIds,
      });
      expect(result).toEqual({
        'user-1': true,
        'user-2': false,
        'user-3': true,
      });
    });
  });

  describe('キャッシュ管理', () => {
    it('clearCacheですべてのキャッシュがクリアされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: {
          users: [],
          total: 0,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      // キャッシュを作成
      await followService.getFollowing('user-123');
      await followService.getFollowers('user-123');

      // キャッシュクリア
      followService.clearCache();

      // 再度取得時はAPIが呼ばれる
      await followService.getFollowing('user-123');
      await followService.getFollowers('user-123');

      expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
    });

    it('特定ユーザーのキャッシュをクリアできること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: {
          users: [],
          total: 0,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<FollowListResponse>);

      const userId = 'user-123';
      
      await followService.getFollowing(userId);
      await followService.getFollowers(userId);

      // 特定ユーザーのキャッシュをクリア
      followService.clearUserCache(userId);

      // 再度取得時はAPIが呼ばれる
      await followService.getFollowing(userId);
      await followService.getFollowers(userId);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
    });
  });
});