import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../PushTokenManager');
jest.mock('../NotificationHandler');
jest.mock('../NotificationSettingsManager');
jest.mock('../../supabase/client');
jest.mock('expo-notifications');

describe('NotificationService', () => {
  let notificationService: any;
  let mockPushTokenManager: any;
  let mockNotificationHandler: any;
  let mockNotificationSettingsManager: any;
  let mockSupabase: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock dependencies
    mockPushTokenManager = {
      checkPermissions: jest.fn(),
      getExpoPushToken: jest.fn(),
      registerToken: jest.fn(),
      requestPermissions: jest.fn(),
    };

    mockNotificationHandler = {
      setNotificationHandler: jest.fn(),
      cleanup: jest.fn(),
    };

    mockNotificationSettingsManager = {
      isNotificationTypeEnabledForUser: jest.fn(),
      isQuietHoursForUser: jest.fn(),
      isEmergencyNotification: jest.fn(),
      getSettings: jest.fn(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      auth: {
        getUser: jest.fn(),
      },
    };

    // Mock modules
    jest.doMock('../PushTokenManager', () => ({
      pushTokenManager: mockPushTokenManager,
    }));

    jest.doMock('../NotificationHandler', () => ({
      notificationHandler: mockNotificationHandler,
    }));

    jest.doMock('../NotificationSettingsManager', () => ({
      notificationSettingsManager: mockNotificationSettingsManager,
    }));

    jest.doMock('../../supabase/client', () => ({
      supabase: mockSupabase,
    }));

    // Dynamic import
    const module = await import('../NotificationService');
    notificationService = module.notificationService;
  });

  describe('initializePushNotifications', () => {
    it('should initialize push notifications successfully', async () => {
      // Arrange
      const userId = 'test-user-id';
      const mockToken = 'ExponentPushToken[test-token]';

      mockPushTokenManager.checkPermissions.mockResolvedValue({
        status: 'granted',
        granted: true,
      });
      mockPushTokenManager.getExpoPushToken.mockResolvedValue(mockToken);
      mockPushTokenManager.registerToken.mockResolvedValue(undefined);
      mockNotificationSettingsManager.getSettings.mockResolvedValue({
        pushEnabled: true,
        likes: true,
        comments: true,
      });

      // Act
      await notificationService.initializePushNotifications(userId);

      // Assert
      expect(mockPushTokenManager.checkPermissions).toHaveBeenCalled();
      expect(mockPushTokenManager.getExpoPushToken).toHaveBeenCalled();
      expect(mockPushTokenManager.registerToken).toHaveBeenCalledWith(userId, mockToken);
      expect(mockNotificationSettingsManager.getSettings).toHaveBeenCalledWith(userId);
    });

    it('should handle permission not granted', async () => {
      // Arrange
      const userId = 'test-user-id';

      mockPushTokenManager.checkPermissions.mockResolvedValue({
        status: 'denied',
        granted: false,
      });

      // Act
      await notificationService.initializePushNotifications(userId);

      // Assert
      expect(mockPushTokenManager.checkPermissions).toHaveBeenCalled();
      expect(mockPushTokenManager.getExpoPushToken).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const userId = 'test-user-id';
      const error = new Error('Token generation failed');

      mockPushTokenManager.checkPermissions.mockResolvedValue({
        status: 'granted',
        granted: true,
      });
      mockPushTokenManager.getExpoPushToken.mockRejectedValue(error);

      // Act & Assert
      await expect(notificationService.initializePushNotifications(userId)).resolves.not.toThrow();
    });
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      // Arrange
      const params = {
        userId: 'test-user-id',
        type: 'like' as any,
        title: 'Test Notification',
        message: 'Test message',
        data: { postId: '123' },
        actionUrl: '/posts/123',
      };

      const mockNotification = {
        id: 'notification-id',
        ...params,
      };

      mockNotificationSettingsManager.isNotificationTypeEnabledForUser.mockResolvedValue(true);
      mockNotificationSettingsManager.isQuietHoursForUser.mockResolvedValue(false);
      mockSupabase.insert.mockResolvedValue({
        data: mockNotification,
        error: null,
      });
      mockSupabase.select.mockResolvedValue({
        data: [{ token: 'test-token', platform: 'ios' }],
        error: null,
      });

      // Act
      await notificationService.createNotification(params);

      // Assert
      expect(mockNotificationSettingsManager.isNotificationTypeEnabledForUser).toHaveBeenCalledWith(
        params.userId,
        params.type
      );
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should skip notification when type is disabled', async () => {
      // Arrange
      const params = {
        userId: 'test-user-id',
        type: 'like' as any,
        title: 'Test Notification',
        message: 'Test message',
        actionUrl: '/posts/123',
      };

      mockNotificationSettingsManager.isNotificationTypeEnabledForUser.mockResolvedValue(false);

      // Act
      await notificationService.createNotification(params);

      // Assert
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should skip notification during quiet hours (non-emergency)', async () => {
      // Arrange
      const params = {
        userId: 'test-user-id',
        type: 'like' as any,
        title: 'Test Notification',
        message: 'Test message',
        actionUrl: '/posts/123',
      };

      mockNotificationSettingsManager.isNotificationTypeEnabledForUser.mockResolvedValue(true);
      mockNotificationSettingsManager.isQuietHoursForUser.mockResolvedValue(true);
      mockNotificationSettingsManager.isEmergencyNotification.mockReturnValue(false);

      // Act
      await notificationService.createNotification(params);

      // Assert
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should send emergency notification during quiet hours', async () => {
      // Arrange
      const params = {
        userId: 'test-user-id',
        type: 'system' as any,
        title: '緊急通知',
        message: 'Emergency message',
        actionUrl: '/emergency',
      };

      const mockNotification = {
        id: 'notification-id',
        ...params,
      };

      mockNotificationSettingsManager.isNotificationTypeEnabledForUser.mockResolvedValue(true);
      mockNotificationSettingsManager.isQuietHoursForUser.mockResolvedValue(true);
      mockNotificationSettingsManager.isEmergencyNotification.mockReturnValue(true);
      mockSupabase.insert.mockResolvedValue({
        data: mockNotification,
        error: null,
      });
      mockSupabase.select.mockResolvedValue({
        data: [{ token: 'test-token', platform: 'ios' }],
        error: null,
      });

      // Act
      await notificationService.createNotification(params);

      // Assert
      expect(mockSupabase.insert).toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('should get notifications with pagination', async () => {
      // Arrange
      const userId = 'test-user-id';
      const mockNotifications = [
        {
          id: '1',
          user_id: userId,
          type: 'like',
          title: 'Test 1',
          message: 'Message 1',
          data: {},
          is_read: false,
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockNotifications,
        error: null,
        count: 1,
      });

      mockSupabase.eq.mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: null,
          error: null,
          count: 0,
        }),
      });

      // Act
      const result = await notificationService.getNotifications(userId, 0, 20);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe('1');
      expect(result.unreadCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      const notificationId = 'test-notification-id';
      mockSupabase.update.mockResolvedValue({
        data: null,
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
      });

      // Act
      await notificationService.markAsRead(notificationId);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', notificationId);
    });
  });

  describe('requestPermissions', () => {
    it('should request permissions and return result', async () => {
      // Arrange
      mockPushTokenManager.requestPermissions.mockResolvedValue({
        status: 'granted',
        granted: true,
      });

      // Act
      const result = await notificationService.requestPermissions();

      // Assert
      expect(result).toBe(true);
      expect(mockPushTokenManager.requestPermissions).toHaveBeenCalled();
    });

    it('should return false when permissions denied', async () => {
      // Arrange
      mockPushTokenManager.requestPermissions.mockResolvedValue({
        status: 'denied',
        granted: false,
      });

      // Act
      const result = await notificationService.requestPermissions();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup notification handler', () => {
      // Act
      notificationService.cleanup();

      // Assert
      expect(mockNotificationHandler.cleanup).toHaveBeenCalled();
    });
  });
});