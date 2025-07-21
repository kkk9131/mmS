import { NotificationService } from '../../src/services/NotificationService';
import { HttpClient } from '../../src/services/api/httpClient';
import { FeatureFlagsManager } from '../../src/services/featureFlags';
import { Notification, NotificationListResponse } from '../../src/types/notifications';
import { ApiResponse } from '../../src/types/api';

jest.mock('../../src/services/api/httpClient');
jest.mock('../../src/services/featureFlags');
jest.mock('../../src/utils/apiUtils');
jest.mock('../../src/utils/errorUtils');

const MockedHttpClient = jest.mocked(HttpClient);
const MockedFeatureFlagsManager = jest.mocked(FeatureFlagsManager);

describe('NotificationService', () => {
  let notificationService: NotificationService;
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

    (NotificationService as any).instance = undefined;
    notificationService = NotificationService.getInstance();
  });

  afterEach(() => {
    notificationService.clearCache();
  });

  describe('getNotifications', () => {
    const mockNotifications: Notification[] = [
      {
        id: 'notif-1',
        type: 'like',
        title: 'いいねがつきました',
        content: 'ユーザーAがあなたの投稿にいいねしました',
        userId: 'user-a',
        userName: 'ユーザーA',
        userAvatar: 'https://example.com/avatar-a.jpg',
        isRead: false,
        createdAt: '2024-07-21T10:00:00Z',
        postId: 'post-123',
      },
      {
        id: 'notif-2',
        type: 'comment',
        title: 'コメントがつきました',
        content: 'ユーザーBがあなたの投稿にコメントしました',
        userId: 'user-b',
        userName: 'ユーザーB',
        userAvatar: 'https://example.com/avatar-b.jpg',
        isRead: true,
        createdAt: '2024-07-21T09:00:00Z',
        postId: 'post-124',
      },
    ];

    const mockResponse: NotificationListResponse = {
      notifications: mockNotifications,
      total: 25,
      unreadCount: 5,
      hasMore: true,
      nextCursor: 'cursor-2',
    };

    it('API有効時に通知一覧を正常に取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      const result = await notificationService.getNotifications(1, 20);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/notifications?page=1&limit=20');
      expect(result).toEqual(mockResponse);
    });

    it('API無効時にモック通知データを取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await notificationService.getNotifications(1, 10);

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('unreadCount');
      expect(result.notifications).toBeInstanceOf(Array);
    });

    it('キャッシュから通知一覧を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      await notificationService.getNotifications(1, 20);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      const result = await notificationService.getNotifications(1, 20);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('フィルタリングオプションが正しく適用されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      const options = {
        onlyUnread: true,
        types: ['like', 'comment'] as const,
      };

      await notificationService.getNotifications(1, 20, options);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/notifications?page=1&limit=20&onlyUnread=true&types=like,comment'
      );
    });
  });

  describe('markAsRead', () => {
    it('単一通知を既読に変更できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.put.mockResolvedValue({
        data: { success: true },
        message: 'success',
      } as ApiResponse<{ success: boolean }>);

      const notificationId = 'notif-1';
      const result = await notificationService.markAsRead(notificationId);

      expect(mockHttpClient.put).toHaveBeenCalledWith(`/notifications/${notificationId}/read`);
      expect(result).toEqual({ success: true });
    });

    it('複数通知を一括で既読に変更できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.put.mockResolvedValue({
        data: { updatedCount: 3 },
        message: 'success',
      } as ApiResponse<{ updatedCount: number }>);

      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      const result = await notificationService.markAsRead(notificationIds);

      expect(mockHttpClient.put).toHaveBeenCalledWith('/notifications/bulk-read', {
        notificationIds,
      });
      expect(result).toEqual({ updatedCount: 3 });
    });

    it('API無効時にモック処理が実行されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await notificationService.markAsRead('notif-1');

      expect(mockHttpClient.put).not.toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('markAllAsRead', () => {
    it('すべての通知を既読に変更できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.put.mockResolvedValue({
        data: { updatedCount: 10 },
        message: 'success',
      } as ApiResponse<{ updatedCount: number }>);

      const result = await notificationService.markAllAsRead();

      expect(mockHttpClient.put).toHaveBeenCalledWith('/notifications/read-all');
      expect(result).toEqual({ updatedCount: 10 });
    });

    it('既読後にキャッシュがクリアされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      
      // 初期通知取得
      mockHttpClient.get.mockResolvedValue({
        data: {
          notifications: [],
          total: 0,
          unreadCount: 5,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      await notificationService.getNotifications();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      // 全既読処理
      mockHttpClient.put.mockResolvedValue({
        data: { updatedCount: 5 },
        message: 'success',
      } as ApiResponse<{ updatedCount: number }>);

      await notificationService.markAllAsRead();

      // 再度通知取得時はAPIが呼ばれる（キャッシュクリアのため）
      await notificationService.getNotifications();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUnreadCount', () => {
    it('未読通知数を正常に取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { count: 7 },
        message: 'success',
      } as ApiResponse<{ count: number }>);

      const result = await notificationService.getUnreadCount();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/notifications/unread-count');
      expect(result).toBe(7);
    });

    it('API無効時にモック未読数を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(false);

      const result = await notificationService.getUnreadCount();

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('キャッシュから未読数を取得できること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: { count: 3 },
        message: 'success',
      } as ApiResponse<{ count: number }>);

      await notificationService.getUnreadCount();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      const result = await notificationService.getUnreadCount();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(result).toBe(3);
    });
  });

  describe('楽観的更新', () => {
    it('単一通知の楽観的更新が正常に動作すること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      
      // 初期通知データ
      const notifications: Notification[] = [
        {
          id: 'notif-1',
          type: 'like',
          title: 'いいねがつきました',
          content: 'テスト',
          userId: 'user-a',
          userName: 'ユーザーA',
          userAvatar: 'avatar.jpg',
          isRead: false,
          createdAt: '2024-07-21T10:00:00Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue({
        data: {
          notifications,
          total: 1,
          unreadCount: 1,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      // 初期データ取得
      const initialResult = await notificationService.getNotifications();
      expect(initialResult.notifications[0].isRead).toBe(false);
      expect(initialResult.unreadCount).toBe(1);

      // 楽観的更新実行
      mockHttpClient.put.mockResolvedValue({
        data: { success: true },
        message: 'success',
      } as ApiResponse<{ success: boolean }>);

      const optimisticUpdatePromise = notificationService.markAsReadOptimistic('notif-1');
      
      // 楽観的更新後の状態確認（API完了前）
      const optimisticResult = await notificationService.getNotifications();
      expect(optimisticResult.notifications[0].isRead).toBe(true);
      expect(optimisticResult.unreadCount).toBe(0);

      // API完了まで待機
      await optimisticUpdatePromise;
    });

    it('楽観的更新でAPI呼び出しが失敗した場合にロールバックされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      
      const notifications: Notification[] = [
        {
          id: 'notif-1',
          type: 'like',
          title: 'いいねがつきました',
          content: 'テスト',
          userId: 'user-a',
          userName: 'ユーザーA',
          userAvatar: 'avatar.jpg',
          isRead: false,
          createdAt: '2024-07-21T10:00:00Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue({
        data: {
          notifications,
          total: 1,
          unreadCount: 1,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      await notificationService.getNotifications();

      // API呼び出しを失敗させる
      mockHttpClient.put.mockRejectedValue(new Error('API Error'));

      // 楽観的更新を実行（エラーは期待される）
      await expect(
        notificationService.markAsReadOptimistic('notif-1')
      ).rejects.toThrow();

      // ロールバック後の状態確認
      const rolledBackResult = await notificationService.getNotifications();
      expect(rolledBackResult.notifications[0].isRead).toBe(false);
      expect(rolledBackResult.unreadCount).toBe(1);
    });
  });

  describe('キャッシュ管理', () => {
    it('clearCacheですべてのキャッシュがクリアされること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      mockHttpClient.get.mockResolvedValue({
        data: {
          notifications: [],
          total: 0,
          unreadCount: 0,
          hasMore: false,
        },
        message: 'success',
      } as ApiResponse<NotificationListResponse>);

      // キャッシュを作成
      await notificationService.getNotifications();
      await notificationService.getUnreadCount();

      // キャッシュクリア
      notificationService.clearCache();

      // 再度取得時はAPIが呼ばれる
      await notificationService.getNotifications();
      await notificationService.getUnreadCount();

      expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
    });

    it('refreshUnreadCountでキャッシュが強制更新されること', async () => {
      mockFeatureFlags.isApiEnabled.mockReturnValue(true);
      
      // 初回
      mockHttpClient.get.mockResolvedValueOnce({
        data: { count: 5 },
        message: 'success',
      } as ApiResponse<{ count: number }>);

      const count1 = await notificationService.getUnreadCount();
      expect(count1).toBe(5);

      // 2回目（更新された値）
      mockHttpClient.get.mockResolvedValueOnce({
        data: { count: 3 },
        message: 'success',
      } as ApiResponse<{ count: number }>);

      const count2 = await notificationService.refreshUnreadCount();
      expect(count2).toBe(3);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});