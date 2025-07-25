import { AuthService } from '@/services/api/auth';
import { FeatureFlagsManager } from '@/services/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock HttpClient
jest.mock('../../src/services/api/httpClient', () => ({
  HttpClient: {
    getInstance: jest.fn(() => ({
      post: jest.fn(),
      getAxiosInstance: jest.fn(() => ({
        interceptors: {
          request: {
            use: jest.fn(),
            handlers: [],
            eject: jest.fn(),
          },
        },
      })),
    })),
  },
}));

describe('Authentication Flow Tests', () => {
  let authService: AuthService;
  let featureFlags: FeatureFlagsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = AuthService.getInstance();
    featureFlags = FeatureFlagsManager.getInstance();
    
    // Mock feature flags to use mock mode
    jest.spyOn(featureFlags, 'isApiEnabled').mockReturnValue(false);
    jest.spyOn(featureFlags, 'isDebugModeEnabled').mockReturnValue(true);
  });

  describe('正常フロー', () => {
    test('ログイン成功 - モックモード', async () => {
      const loginData = {
        maternalBookNumber: '1234567890',
        nickname: 'テストユーザー',
      };

      const result = await authService.login(loginData);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.nickname).toBe(loginData.nickname);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@mamapace_auth_token',
        expect.stringContaining('mock_access_token')
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@mamapace_user',
        expect.stringContaining(loginData.nickname)
      );
    });

    test('保存されたトークンの取得', async () => {
      const mockTokenData = {
        accessToken: 'test_token',
        refreshToken: 'test_refresh_token',
        expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour from now
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTokenData)
      );

      const tokens = await authService.getStoredTokens();

      expect(tokens).toEqual(mockTokenData);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@mamapace_auth_token');
    });

    test('有効なトークンでの認証状態確認', async () => {
      const mockTokenData = {
        accessToken: 'valid_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour from now
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTokenData)
      );

      const isAuthenticated = await authService.checkAuthStatus();

      expect(isAuthenticated).toBe(true);
    });

    test('ログアウト処理', async () => {
      await authService.logout();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@mamapace_auth_token',
        '@mamapace_user',
      ]);
    });
  });

  describe('期限切れトークンの処理', () => {
    test('期限切れトークンは無効として扱われる', async () => {
      const expiredTokenData = {
        accessToken: 'expired_token',
        refreshToken: 'expired_refresh_token',
        expiresAt: Date.now() - 1000, // 1 second ago
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(expiredTokenData)
      );

      const tokens = await authService.getStoredTokens();

      expect(tokens).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@mamapace_auth_token');
    });

    test('期限切れトークンでの認証状態確認は失敗', async () => {
      const expiredTokenData = {
        accessToken: 'expired_token',
        refreshToken: 'expired_refresh_token',
        expiresAt: Date.now() - 1000, // 1 second ago
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(expiredTokenData)
      );

      const isAuthenticated = await authService.checkAuthStatus();

      expect(isAuthenticated).toBe(false);
    });
  });

  describe('エラーケース', () => {
    test('不正なトークンデータの処理', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid_json');

      const tokens = await authService.getStoredTokens();

      expect(tokens).toBeNull();
    });

    test('AsyncStorageエラーの処理', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const tokens = await authService.getStoredTokens();

      expect(tokens).toBeNull();
    });

    test('存在しないトークンの処理', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const tokens = await authService.getStoredTokens();

      expect(tokens).toBeNull();
    });
  });
});