import { ApiClient } from '../../../src/services/api';
import { FeatureFlagsManager } from '../../../src/services/featureFlags';

describe('API Integration Tests', () => {
  let apiClient: ApiClient;
  let featureFlags: FeatureFlagsManager;

  beforeEach(async () => {
    apiClient = ApiClient.getInstance();
    featureFlags = FeatureFlagsManager.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mock Mode Integration', () => {
    beforeEach(async () => {
      featureFlags.enableMockMode();
      await apiClient.initialize();
    });

    it('should initialize successfully in mock mode', async () => {
      expect(apiClient.isInitialized()).toBe(true);
      expect(featureFlags.isApiEnabled()).toBe(false);
      expect(featureFlags.isDebugModeEnabled()).toBe(true);
    });

    it('should perform health check in mock mode', async () => {
      const result = await apiClient.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.responseTime).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle GET requests in mock mode', async () => {
      const response = await apiClient.get('/health');
      
      expect(response).toBeDefined();
      expect(response.status).toBe('ok');
      expect(response.timestamp).toBeDefined();
    });

    it('should handle POST requests in mock mode', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const response = await apiClient.post('/auth/login', loginData);
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.user.email).toBe(loginData.email);
      expect(response.tokens).toBeDefined();
    });

    it('should handle error responses in mock mode', async () => {
      await expect(apiClient.get('/error/404')).rejects.toMatchObject({
        response: {
          status: 404,
          data: expect.objectContaining({
            error: 'Not Found'
          })
        }
      });
    });

    it('should switch modes correctly', async () => {
      expect(featureFlags.isApiEnabled()).toBe(false);
      
      apiClient.enableApiMode();
      expect(featureFlags.isApiEnabled()).toBe(true);
      expect(featureFlags.isDebugModeEnabled()).toBe(false);
      
      apiClient.enableMockMode();
      expect(featureFlags.isApiEnabled()).toBe(false);
      expect(featureFlags.isDebugModeEnabled()).toBe(true);
    });
  });

  describe('Authentication Integration', () => {
    beforeEach(async () => {
      featureFlags.enableMockMode();
      await apiClient.initialize();
    });

    it('should set and clear auth tokens', () => {
      const token = 'test-token-123';
      
      apiClient.setAuthToken(token);
      expect(() => apiClient.setAuthToken(token)).not.toThrow();
      
      apiClient.clearAuthToken();
      expect(() => apiClient.clearAuthToken()).not.toThrow();
    });

    it('should set and clear refresh tokens', () => {
      const refreshToken = 'refresh-token-123';
      
      apiClient.setRefreshToken(refreshToken);
      expect(() => apiClient.setRefreshToken(refreshToken)).not.toThrow();
      
      apiClient.clearRefreshToken();
      expect(() => apiClient.clearRefreshToken()).not.toThrow();
    });

    it('should handle authentication callbacks', () => {
      const mockTokenCallback = jest.fn();
      const mockAuthFailureCallback = jest.fn();
      
      apiClient.onTokenRefreshed(mockTokenCallback);
      apiClient.onAuthenticationFailure(mockAuthFailureCallback);
      
      expect(() => {
        apiClient.onTokenRefreshed(mockTokenCallback);
        apiClient.onAuthenticationFailure(mockAuthFailureCallback);
      }).not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      featureFlags.enableMockMode();
      await apiClient.initialize();
    });

    it('should handle various error types', async () => {
      const errorTests = [
        { endpoint: '/error/400', expectedStatus: 400 },
        { endpoint: '/error/401', expectedStatus: 401 },
        { endpoint: '/error/404', expectedStatus: 404 },
        { endpoint: '/error/500', expectedStatus: 500 },
      ];

      for (const test of errorTests) {
        await expect(apiClient.get(test.endpoint)).rejects.toMatchObject({
          response: {
            status: test.expectedStatus
          }
        });
      }
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      featureFlags.enableMockMode();
      await apiClient.initialize();
    });

    it('should provide comprehensive stats', () => {
      const stats = apiClient.getStats();
      
      expect(stats).toHaveProperty('connection');
      expect(stats).toHaveProperty('mock');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('flags');
      
      expect(stats.connection.mode).toBe('mock');
      expect(stats.mock.totalEndpoints).toBeGreaterThan(0);
      expect(stats.config.baseURL).toBeDefined();
      expect(stats.flags.USE_API).toBe(false);
    });

    it('should perform health checks', async () => {
      const healthCheck = await apiClient.performHealthCheck();
      
      expect(healthCheck).toHaveProperty('api');
      expect(healthCheck.api.success).toBe(true);
      expect(healthCheck.api.timestamp).toBeDefined();
    });
  });

  describe('Reinitialization', () => {
    beforeEach(async () => {
      featureFlags.enableMockMode();
      await apiClient.initialize();
    });

    it('should reinitialize successfully', async () => {
      expect(apiClient.isInitialized()).toBe(true);
      
      await apiClient.reinitialize();
      expect(apiClient.isInitialized()).toBe(true);
    });

    it('should maintain functionality after reinitialization', async () => {
      await apiClient.reinitialize();
      
      const response = await apiClient.get('/health');
      expect(response).toBeDefined();
      expect(response.status).toBe('ok');
    });
  });
});