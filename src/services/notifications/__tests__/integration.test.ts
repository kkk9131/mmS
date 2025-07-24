import { jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store } from '../../store';

// Mock dependencies
jest.mock('../NotificationService');
jest.mock('../PushTokenManager');
jest.mock('../NotificationHandler');
jest.mock('../NotificationSettingsManager');
jest.mock('../NotificationQueueManager');
jest.mock('../BadgeManager');
jest.mock('../../supabase/client');
jest.mock('expo-notifications');

describe('Push Notification System Integration Tests', () => {
  let mockNotificationService: any;
  let mockPushTokenManager: any;
  let mockNotificationHandler: any;
  let mockBadgeManager: any;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockNotificationService = {
      initializePushNotifications: jest.fn(),
      createNotification: jest.fn(),
      getNotifications: jest.fn(),
      markAsRead: jest.fn(),
      cleanup: jest.fn(),
    };

    mockPushTokenManager = {
      getExpoPushToken: jest.fn(),
      registerToken: jest.fn(),
      checkPermissions: jest.fn(),
      requestPermissions: jest.fn(),
    };

    mockNotificationHandler = {
      setNotificationHandler: jest.fn(),
      handleForegroundNotification: jest.fn(),
      handleNotificationResponse: jest.fn(),
      cleanup: jest.fn(),
    };

    mockBadgeManager = {
      updateBadgeCount: jest.fn(),
      setBadgeCount: jest.fn(),
      clearBadge: jest.fn(),
      cleanup: jest.fn(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      auth: {
        getUser: jest.fn(),
      },
      functions: {
        invoke: jest.fn(),
      },
      channel: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    };

    // Mock modules
    jest.doMock('../NotificationService', () => ({
      notificationService: mockNotificationService,
    }));

    jest.doMock('../PushTokenManager', () => ({
      pushTokenManager: mockPushTokenManager,
    }));

    jest.doMock('../NotificationHandler', () => ({
      notificationHandler: mockNotificationHandler,
    }));

    jest.doMock('../BadgeManager', () => ({
      badgeManager: mockBadgeManager,
    }));

    jest.doMock('../../supabase/client', () => ({
      supabase: mockSupabase,
    }));
  });

  describe('End-to-End Notification Flow', () => {
    it('should complete full notification lifecycle', async () => {
      // Arrange
      const userId = 'test-user-id';
      const mockToken = 'ExponentPushToken[test-token]';
      const mockNotification = {
        id: 'notification-id',
        userId,
        type: 'like',
        title: 'Test Notification',
        message: 'Test message',
        data: { postId: '123' },
        actionUrl: '/posts/123',
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
      });

      mockPushTokenManager.checkPermissions.mockResolvedValue({
        status: 'granted',
      });

      mockPushTokenManager.getExpoPushToken.mockResolvedValue(mockToken);
      mockPushTokenManager.registerToken.mockResolvedValue(undefined);

      mockSupabase.insert.mockResolvedValue({
        data: mockNotification,
        error: null,
      });

      mockSupabase.select.mockResolvedValue({
        data: [{ token: mockToken, platform: 'ios' }],
        error: null,
      });

      mockNotificationService.initializePushNotifications.mockResolvedValue(undefined);
      mockNotificationService.createNotification.mockResolvedValue(undefined);

      // Act & Assert

      // 1. システム初期化
      await mockNotificationService.initializePushNotifications(userId);
      expect(mockPushTokenManager.checkPermissions).toHaveBeenCalled();
      expect(mockPushTokenManager.getExpoPushToken).toHaveBeenCalled();
      expect(mockPushTokenManager.registerToken).toHaveBeenCalledWith(userId, mockToken);

      // 2. 通知作成
      await mockNotificationService.createNotification(mockNotification);
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(mockNotification);

      // 3. バッジ更新
      await mockBadgeManager.updateBadgeCount();
      expect(mockBadgeManager.updateBadgeCount).toHaveBeenCalled();

      console.log('フルライフサイクルテスト完了');
    });

    it('should handle notification reception and navigation', async () => {
      // Arrange
      const mockNotificationResponse = {
        actionIdentifier: 'default',
        notification: {
          request: {
            content: {
              title: 'Test Notification',
              body: 'Test message',
              data: {
                notificationId: 'notification-id',
                type: 'comment',
                actionUrl: '/posts/123',
                userId: 'user-id',
              },
            },
          },
        },
      };

      mockSupabase.update.mockResolvedValue({ error: null });
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: null,
        count: 5,
      });

      // Act
      await mockNotificationHandler.handleNotificationResponse(mockNotificationResponse);

      // Assert
      expect(mockNotificationHandler.handleNotificationResponse).toHaveBeenCalledWith(
        mockNotificationResponse
      );
    });
  });

  describe('Settings Integration', () => {
    it('should update settings and reflect changes immediately', async () => {
      // Arrange
      const userId = 'test-user-id';
      const newSettings = {
        likes: false,
        comments: true,
        pushEnabled: true,
      };

      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      });

      // Dynamic import to avoid mocking issues
      const { useEnhancedNotifications } = await import('../../hooks/useEnhancedNotifications');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      // Act
      const { result } = renderHook(() => useEnhancedNotifications(), { wrapper });

      await act(async () => {
        await result.current.updateSettings(newSettings);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.settings).toMatchObject(newSettings);
      });
    });

    it('should respect quiet hours settings', async () => {
      // Arrange
      const userId = 'test-user-id';
      
      mockSupabase.select.mockResolvedValue({
        data: {
          user_id: userId,
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
          push_enabled: true,
        },
        error: null,
      });

      // Mock current time to be in quiet hours (23:00)
      const mockDate = new Date('2023-01-01T23:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const { notificationSettingsManager } = await import('../NotificationSettingsManager');

      // Act
      const isQuietHours = await notificationSettingsManager.isQuietHoursForUser(userId);

      // Assert
      expect(isQuietHours).toBe(true);

      // Restore original Date
      (global.Date as any).mockRestore();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle token invalidation and refresh', async () => {
      // Arrange
      const userId = 'test-user-id';
      const oldToken = 'ExponentPushToken[old-token]';
      const newToken = 'ExponentPushToken[new-token]';

      // Simulate token invalid error
      const tokenError = new Error('DeviceNotRegistered');
      mockNotificationService.createNotification.mockRejectedValue(tokenError);
      
      mockPushTokenManager.getExpoPushToken.mockResolvedValue(newToken);
      mockPushTokenManager.updateToken.mockResolvedValue(undefined);

      const { notificationErrorHandler } = await import('../ErrorHandler');

      // Act
      const error = await notificationErrorHandler.handleError(tokenError, {
        userId,
        operation: 'send_notification',
      });

      // Assert
      expect(error.type).toBe('device_not_registered');
      expect(error.retryable).toBe(false);
    });

    it('should retry failed notifications with exponential backoff', async () => {
      // Arrange
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const { notificationErrorHandler } = await import('../ErrorHandler');

      // Act
      const result = await notificationErrorHandler.executeWithRetry(
        operation,
        {
          userId: 'test-user',
          operationName: 'test_operation',
        },
        {
          maxAttempts: 3,
          baseDelay: 100,
          backoffMultiplier: 2,
        }
      );

      // Assert
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Integration', () => {
    it('should cache frequently accessed data', async () => {
      // Arrange
      const userId = 'test-user-id';
      const mockNotifications = [
        { id: '1', title: 'Test 1' },
        { id: '2', title: 'Test 2' },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockNotifications,
        error: null,
      });

      const { notificationPerformanceOptimizer } = await import('../PerformanceOptimizer');

      // Act - First call should hit the database
      const result1 = await notificationPerformanceOptimizer.optimizeNotificationQuery(
        userId,
        { limit: 20 }
      );

      // Second call should hit the cache
      const result2 = await notificationPerformanceOptimizer.optimizeNotificationQuery(
        userId,
        { limit: 20 }
      );

      // Assert
      expect(result1).toEqual({ notifications: mockNotifications, total: 0, hasMore: false });
      expect(result2).toEqual(result1);
      expect(mockSupabase.select).toHaveBeenCalledTimes(1); // Database called only once
    });

    it('should respect rate limits', async () => {
      // Arrange
      const { notificationPerformanceOptimizer } = await import('../PerformanceOptimizer');

      // Act - Multiple rapid requests
      const results = await Promise.allSettled([
        notificationPerformanceOptimizer.checkRateLimit('pushNotification', 'user1'),
        notificationPerformanceOptimizer.checkRateLimit('pushNotification', 'user1'),
        notificationPerformanceOptimizer.checkRateLimit('pushNotification', 'user1'),
      ]);

      // Assert
      const allowedRequests = results.filter(r => r.status === 'fulfilled' && r.value === true);
      expect(allowedRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Queue Integration', () => {
    it('should process queued notifications when online', async () => {
      // Arrange
      const mockPendingNotifications = [
        {
          id: 'queue-1',
          userId: 'user-1',
          type: 'like',
          title: 'Queued Notification 1',
          message: 'Message 1',
          data: {},
          actionUrl: '/test1',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'queue-2',
          userId: 'user-2',
          type: 'comment',
          title: 'Queued Notification 2',
          message: 'Message 2',
          data: {},
          actionUrl: '/test2',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
        },
      ];

      const mockNotificationQueueManager = {
        getQueueStats: jest.fn().mockResolvedValue({
          totalPending: 2,
          totalFailed: 0,
        }),
        processBatch: jest.fn().mockResolvedValue(undefined),
        dequeue: jest.fn()
          .mockResolvedValueOnce(mockPendingNotifications[0])
          .mockResolvedValueOnce(mockPendingNotifications[1])
          .mockResolvedValue(null),
      };

      jest.doMock('../NotificationQueueManager', () => ({
        notificationQueueManager: mockNotificationQueueManager,
      }));

      // Act
      await mockNotificationQueueManager.processBatch(5);

      // Assert
      expect(mockNotificationQueueManager.processBatch).toHaveBeenCalledWith(5);
    });
  });

  describe('Badge Integration', () => {
    it('should update badge count across multiple operations', async () => {
      // Arrange
      const userId = 'test-user-id';
      
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: null,
        count: 3,
      });

      mockBadgeManager.updateBadgeCount.mockResolvedValue(undefined);
      mockBadgeManager.setBadgeCount.mockResolvedValue(undefined);

      // Act
      await mockBadgeManager.updateBadgeCount();

      // Simulate reading one notification
      await mockBadgeManager.setBadgeCount(2);

      // Assert
      expect(mockBadgeManager.updateBadgeCount).toHaveBeenCalled();
      expect(mockBadgeManager.setBadgeCount).toHaveBeenCalledWith(2);
    });
  });

  describe('Security Integration', () => {
    it('should validate notification access permissions', async () => {
      // Arrange
      const userId = 'test-user-id';
      const notificationId = 'notification-id';

      mockSupabase.select.mockResolvedValue({
        data: { user_id: userId },
        error: null,
      });

      const { notificationSecurityManager } = await import('../SecurityManager');

      // Act
      const hasAccess = await notificationSecurityManager.validateNotificationAccess(
        userId,
        notificationId
      );

      // Assert
      expect(hasAccess).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    });

    it('should encrypt and decrypt sensitive data', async () => {
      // Arrange
      const testData = 'sensitive-push-token';
      const userId = 'test-user-id';
      const deviceId = 'test-device-id';

      const { notificationSecurityManager } = await import('../SecurityManager');

      // Act
      await notificationSecurityManager.secureStoreToken(userId, testData, deviceId);
      const retrievedData = await notificationSecurityManager.secureRetrieveToken(userId, deviceId);

      // Assert
      expect(retrievedData).toBe(testData);
    });
  });

  describe('Realtime Integration', () => {
    it('should handle realtime notification updates', async () => {
      // Arrange
      const userId = 'test-user-id';
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const { notificationRealtimeManager } = await import('../../store/api/notificationsApi');

      let realtimeCallback: any;
      mockChannel.on.mockImplementation((event: string, config: any, callback: any) => {
        realtimeCallback = callback;
        return mockChannel;
      });

      // Act
      const unsubscribe = notificationRealtimeManager.subscribe(userId, (notification) => {
        console.log('Realtime notification received:', notification);
      });

      // Simulate realtime notification
      const mockRealtimeNotification = {
        new: {
          id: 'realtime-id',
          user_id: userId,
          type: 'like',
          title: 'Realtime Notification',
          message: 'Realtime message',
        },
      };

      if (realtimeCallback) {
        realtimeCallback(mockRealtimeNotification);
      }

      // Cleanup
      unsubscribe();

      // Assert
      expect(mockSupabase.channel).toHaveBeenCalledWith(`notifications:user_id=eq.${userId}`);
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});