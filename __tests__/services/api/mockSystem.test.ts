import { MockSystem } from '../../../src/services/api/mockSystem';
import { FeatureFlagsManager } from '../../../src/services/featureFlags';
import { MockEndpoint } from '../../../src/types/api';

jest.mock('../../../src/services/featureFlags');

describe('MockSystem', () => {
  let mockSystem: MockSystem;
  let mockFeatureFlags: jest.Mocked<FeatureFlagsManager>;

  beforeEach(() => {
    mockFeatureFlags = {
      isDebugModeEnabled: jest.fn().mockReturnValue(false),
      getMockDelay: jest.fn().mockReturnValue(100),
    } as any;

    (FeatureFlagsManager.getInstance as jest.Mock).mockReturnValue(mockFeatureFlags);
    mockSystem = MockSystem.getInstance();
    mockSystem.clearAllEndpoints();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSystem.clearAllEndpoints();
  });

  describe('endpoint registration', () => {
    it('should register an endpoint', () => {
      const endpoint: MockEndpoint = {
        url: '/test',
        method: 'GET',
        response: { message: 'test' },
      };

      mockSystem.registerEndpoint(endpoint);
      expect(mockSystem.hasEndpoint('GET', '/test')).toBe(true);
    });

    it('should register multiple endpoints', () => {
      const endpoints: MockEndpoint[] = [
        { url: '/test1', method: 'GET', response: { message: 'test1' } },
        { url: '/test2', method: 'POST', response: { message: 'test2' } },
      ];

      mockSystem.registerEndpoints(endpoints);
      expect(mockSystem.hasEndpoint('GET', '/test1')).toBe(true);
      expect(mockSystem.hasEndpoint('POST', '/test2')).toBe(true);
    });

    it('should get registered endpoints', () => {
      const endpoint: MockEndpoint = {
        url: '/test',
        method: 'GET',
        response: { message: 'test' },
      };

      mockSystem.registerEndpoint(endpoint);
      const registered = mockSystem.getRegisteredEndpoints();
      expect(registered).toHaveLength(1);
      expect(registered[0]).toMatchObject(endpoint);
    });
  });

  describe('request handling', () => {
    beforeEach(() => {
      const endpoint: MockEndpoint = {
        url: '/test',
        method: 'GET',
        response: { message: 'success' },
        status: 200,
        delay: 0,
      };
      mockSystem.registerEndpoint(endpoint);
    });

    it('should handle successful requests', async () => {
      const response = await mockSystem.handleRequest('GET', '/test');
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('success');
      expect(response.headers['X-Mock-Response']).toBe('true');
    });

    it('should handle error responses', async () => {
      const errorEndpoint: MockEndpoint = {
        url: '/error',
        method: 'GET',
        response: { error: 'Not found' },
        status: 404,
      };
      
      mockSystem.registerEndpoint(errorEndpoint);

      await expect(mockSystem.handleRequest('GET', '/error')).rejects.toMatchObject({
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
      });
    });

    it('should throw error for unregistered endpoints', async () => {
      await expect(mockSystem.handleRequest('GET', '/nonexistent'))
        .rejects.toThrow('No mock endpoint found for GET /nonexistent');
    });

    it('should handle function responses', async () => {
      const dynamicEndpoint: MockEndpoint = {
        url: '/dynamic',
        method: 'POST',
        response: (data: any) => ({ 
          echo: data, 
          timestamp: new Date().toISOString() 
        }),
      };
      
      mockSystem.registerEndpoint(dynamicEndpoint);
      
      const testData = { test: 'data' };
      const response = await mockSystem.handleRequest('POST', '/dynamic', testData);
      
      expect(response.data.echo).toEqual(testData);
      expect(response.data.timestamp).toBeDefined();
    });
  });

  describe('endpoint management', () => {
    it('should remove endpoints', () => {
      const endpoint: MockEndpoint = {
        url: '/test',
        method: 'GET',
        response: { message: 'test' },
      };

      mockSystem.registerEndpoint(endpoint);
      expect(mockSystem.hasEndpoint('GET', '/test')).toBe(true);

      const removed = mockSystem.removeEndpoint('GET', '/test');
      expect(removed).toBe(true);
      expect(mockSystem.hasEndpoint('GET', '/test')).toBe(false);
    });

    it('should clear all endpoints', () => {
      const endpoints: MockEndpoint[] = [
        { url: '/test1', method: 'GET', response: { message: 'test1' } },
        { url: '/test2', method: 'POST', response: { message: 'test2' } },
      ];

      mockSystem.registerEndpoints(endpoints);
      expect(mockSystem.getRegisteredEndpoints()).toHaveLength(2);

      mockSystem.clearAllEndpoints();
      expect(mockSystem.getRegisteredEndpoints()).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should provide stats', () => {
      const endpoints: MockEndpoint[] = [
        { url: '/test1', method: 'GET', response: { message: 'test1' } },
        { url: '/test2', method: 'POST', response: { message: 'test2' } },
        { url: '/test3', method: 'GET', response: { message: 'test3' } },
      ];

      mockSystem.registerEndpoints(endpoints);
      const stats = mockSystem.getStats();

      expect(stats.totalEndpoints).toBe(3);
      expect(stats.endpointsByMethod.GET).toBe(2);
      expect(stats.endpointsByMethod.POST).toBe(1);
      expect(stats.mockDelay).toBe(100);
    });
  });
});