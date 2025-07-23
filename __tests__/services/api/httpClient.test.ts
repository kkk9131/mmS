import { HttpClient } from '../../../src/services/api/httpClient';
import { ApiConfigManager } from '../../../src/services/api/config';
import { FeatureFlagsManager } from '../../../src/services/featureFlags';

jest.mock('../../../src/services/api/config');
jest.mock('../../../src/services/featureFlags');

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockConfigManager: jest.Mocked<ApiConfigManager>;
  let mockFeatureFlags: jest.Mocked<FeatureFlagsManager>;

  beforeEach(() => {
    // Reset the singleton instance
    (HttpClient as any).instance = null;

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        baseURL: 'http://localhost:3048/api',
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
        retries: 3,
      }),
    } as any;

    mockFeatureFlags = {
      isDebugModeEnabled: jest.fn().mockReturnValue(false),
    } as any;

    (ApiConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigManager);
    (FeatureFlagsManager.getInstance as jest.Mock).mockReturnValue(mockFeatureFlags);

    httpClient = HttpClient.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (HttpClient as any).instance = null;
  });

  describe('initialization', () => {
    it('should create an instance with correct config', () => {
      expect(ApiConfigManager.getInstance).toHaveBeenCalled();
      expect(FeatureFlagsManager.getInstance).toHaveBeenCalled();
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });

    it('should have an axios instance', () => {
      const axiosInstance = httpClient.getAxiosInstance();
      expect(axiosInstance).toBeDefined();
      expect(axiosInstance.defaults.baseURL).toBe('http://localhost:3048/api');
      expect(axiosInstance.defaults.timeout).toBe(10000);
    });
  });

  describe('error handling', () => {
    it('should classify timeout errors correctly', () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };

      const result = (httpClient as any).handleError(timeoutError);
      expect(result.type).toBe('timeout');
      expect(result.message).toBe('Request timeout');
    });

    it('should classify network errors correctly', () => {
      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error',
      };

      const result = (httpClient as any).handleError(networkError);
      expect(result.type).toBe('network');
      expect(result.message).toBe('Network Error');
    });

    it('should classify HTTP errors correctly', () => {
      const httpError = {
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
        message: 'Request failed with status code 404',
      };

      const result = (httpClient as any).handleError(httpError);
      expect(result.type).toBe('http');
      expect(result.status).toBe(404);
      expect(result.message).toBe('Not found');
    });
  });

  describe('retry logic', () => {
    it('should identify retryable errors', () => {
      const networkError = { code: 'NETWORK_ERROR' };
      const timeoutError = { code: 'ECONNABORTED' };
      const serverError = { response: { status: 500 } };
      const clientError = { response: { status: 400 } };

      expect((httpClient as any).shouldRetry(networkError)).toBe(true);
      expect((httpClient as any).shouldRetry(timeoutError)).toBe(true);
      expect((httpClient as any).shouldRetry(serverError)).toBe(true);
      expect((httpClient as any).shouldRetry(clientError)).toBe(false);
    });
  });
});