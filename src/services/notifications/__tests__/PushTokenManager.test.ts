import { jest } from '@jest/globals';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Mock external dependencies
jest.mock('expo-notifications');
jest.mock('expo-device');
jest.mock('expo-constants');
jest.mock('../../supabase/client');

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockDevice = Device as jest.Mocked<typeof Device>;
const mockConstants = Constants as jest.Mocked<typeof Constants>;

describe('PushTokenManager', () => {
  let pushTokenManager: any;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock Device.isDevice
    Object.defineProperty(mockDevice, 'isDevice', {
      value: true,
      writable: true,
    });

    // Mock Constants
    Object.defineProperty(mockConstants, 'deviceId', {
      value: 'test-device-id',
      writable: true,
    });

    Object.defineProperty(mockConstants, 'expoConfig', {
      value: {
        extra: {
          eas: {
            projectId: 'test-project-id',
          },
        },
      },
      writable: true,
    });

    // Dynamic import to ensure mocks are set up
    const module = await import('../PushTokenManager');
    pushTokenManager = module.pushTokenManager;
  });

  describe('getExpoPushToken', () => {
    it('should get expo push token successfully', async () => {
      // Arrange
      const mockToken = 'ExponentPushToken[test-token]';
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      } as any);

      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: mockToken,
        type: 'expo',
      });

      // Act
      const result = await pushTokenManager.getExpoPushToken();

      // Assert
      expect(result).toBe(mockToken);
      expect(mockNotifications.getPermissionsAsync).toHaveBeenCalled();
      expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: 'test-project-id',
      });
    });

    it('should throw error when not on device', async () => {
      // Arrange
      Object.defineProperty(mockDevice, 'isDevice', {
        value: false,
        writable: true,
      });

      // Act & Assert
      await expect(pushTokenManager.getExpoPushToken()).rejects.toThrow(
        'プッシュ通知は実機でのみ動作します'
      );
    });

    it('should throw error when permission denied', async () => {
      // Arrange
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      } as any);

      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      } as any);

      // Act & Assert
      await expect(pushTokenManager.getExpoPushToken()).rejects.toThrow(
        'プッシュ通知の権限が拒否されました'
      );
    });

    it('should request permissions when not granted', async () => {
      // Arrange
      const mockToken = 'ExponentPushToken[test-token]';
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
      } as any);

      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      } as any);

      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: mockToken,
        type: 'expo',
      });

      // Act
      const result = await pushTokenManager.getExpoPushToken();

      // Assert
      expect(result).toBe(mockToken);
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('registerToken', () => {
    it('should register token successfully', async () => {
      // Arrange
      const userId = 'test-user-id';
      const token = 'ExponentPushToken[test-token]';
      
      // Mock supabase client
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
      };
      (mockSupabase.upsert as any).mockResolvedValue({ data: null, error: null });

      jest.doMock('../../supabase/client', () => ({
        supabase: mockSupabase,
      }));

      // Act
      await expect(pushTokenManager.registerToken(userId, token)).resolves.not.toThrow();

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
    });
  });

  describe('checkPermissions', () => {
    it('should check permissions', async () => {
      // Arrange
      const mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
      } as any;
      mockNotifications.getPermissionsAsync.mockResolvedValue(mockPermissions);

      // Act
      const result = await pushTokenManager.checkPermissions();

      // Assert
      expect(result).toBe(mockPermissions);
      expect(mockNotifications.getPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('requestPermissions', () => {
    it('should request permissions', async () => {
      // Arrange
      const mockPermissions = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
      } as any;
      mockNotifications.requestPermissionsAsync.mockResolvedValue(mockPermissions);

      // Act
      const result = await pushTokenManager.requestPermissions();

      // Assert
      expect(result).toBe(mockPermissions);
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledWith({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });
    });
  });
});