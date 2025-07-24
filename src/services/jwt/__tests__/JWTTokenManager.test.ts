import { JWTTokenManager } from '../JWTTokenManager';
import { TokenPair } from '../types';

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('expo-crypto');

describe('JWTTokenManager', () => {
  let tokenManager: JWTTokenManager;
  
  beforeEach(() => {
    tokenManager = new JWTTokenManager({
      accessTokenExpiry: 60 * 60 * 1000, // 60分
      refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30日
      autoRefreshThreshold: 10 * 60 * 1000, // 10分前
      maxRetryAttempts: 3,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeTokens', () => {
    it('should store token pair successfully', async () => {
      const mockTokens: TokenPair = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      await expect(tokenManager.storeTokens(mockTokens)).resolves.not.toThrow();
    });
  });

  describe('getAccessToken', () => {
    it('should return valid access token', async () => {
      const mockToken = 'valid-access-token';
      
      // Mock the secure storage to return a token
      jest.spyOn(tokenManager as any, 'secureStorage')
        .mockReturnValue({
          getSecureItem: jest.fn().mockResolvedValue(mockToken),
        });

      const token = await tokenManager.getAccessToken();
      expect(token).toBe(mockToken);
    });

    it('should return null when no token exists', async () => {
      jest.spyOn(tokenManager as any, 'secureStorage')
        .mockReturnValue({
          getSecureItem: jest.fn().mockResolvedValue(null),
        });

      const token = await tokenManager.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      // Create expired token using JWTUtils mock
      const expiredPayload = JSON.stringify({
        exp: Math.floor(Date.now() / 1000) - 3600, // 1時間前に期限切れ
      });
      const mockToken = `header.${Buffer.from(expiredPayload).toString('base64')}.signature`;

      const isExpired = tokenManager.isTokenExpired(mockToken);
      expect(isExpired).toBe(true);
    });

    it('should return false for valid token', () => {
      const validPayload = JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 3600, // 1時間後に期限切れ
      });
      const mockToken = `header.${Buffer.from(validPayload).toString('base64')}.signature`;

      const isExpired = tokenManager.isTokenExpired(mockToken);
      expect(isExpired).toBe(false);
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true when token expires within threshold', () => {
      const soonExpirePayload = JSON.stringify({
        exp: Math.floor((Date.now() + 5 * 60 * 1000) / 1000), // 5分後に期限切れ
      });
      const mockToken = `header.${Buffer.from(soonExpirePayload).toString('base64')}.signature`;

      const shouldRefresh = tokenManager.shouldRefreshToken(mockToken);
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when token has enough time left', () => {
      const validPayload = JSON.stringify({
        exp: Math.floor((Date.now() + 30 * 60 * 1000) / 1000), // 30分後に期限切れ
      });
      const mockToken = `header.${Buffer.from(validPayload).toString('base64')}.signature`;

      const shouldRefresh = tokenManager.shouldRefreshToken(mockToken);
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('validateTokenFormat', () => {
    it('should return true for valid JWT format', () => {
      const validPayload = JSON.stringify({ sub: 'user123' });
      const validHeader = JSON.stringify({ typ: 'JWT', alg: 'HS256' });
      const mockToken = `${Buffer.from(validHeader).toString('base64')}.${Buffer.from(validPayload).toString('base64')}.signature`;

      const isValid = tokenManager.validateTokenFormat(mockToken);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid JWT format', () => {
      const isValid = tokenManager.validateTokenFormat('invalid-token');
      expect(isValid).toBe(false);
    });
  });

  describe('clearTokens', () => {
    it('should clear all stored tokens', async () => {
      const mockSecureStorage = {
        removeSecureItem: jest.fn().mockResolvedValue(undefined),
      };
      
      jest.spyOn(tokenManager as any, 'secureStorage', 'get')
        .mockReturnValue(mockSecureStorage);

      await expect(tokenManager.clearTokens()).resolves.not.toThrow();
      expect(mockSecureStorage.removeSecureItem).toHaveBeenCalledTimes(3);
    });
  });
});