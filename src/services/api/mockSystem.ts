import { MockEndpoint, ApiResponse } from '../../types/api';
import { FeatureFlagsManager } from '../featureFlags';

export class MockSystem {
  private static instance: MockSystem;
  private mockEndpoints: Map<string, MockEndpoint> = new Map();
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): MockSystem {
    if (!MockSystem.instance) {
      MockSystem.instance = new MockSystem();
    }
    return MockSystem.instance;
  }

  public registerEndpoint(endpoint: MockEndpoint): void {
    const key = this.createEndpointKey(endpoint.method, endpoint.url);
    this.mockEndpoints.set(key, endpoint);
    
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log(`Mock endpoint registered: ${endpoint.method} ${endpoint.url}`);
    }
  }

  public registerEndpoints(endpoints: MockEndpoint[]): void {
    endpoints.forEach(endpoint => this.registerEndpoint(endpoint));
  }

  public async handleRequest<T>(
    method: string, 
    url: string, 
    data?: any
  ): Promise<ApiResponse<T>> {
    const key = this.createEndpointKey(method, url);
    const mockEndpoint = this.mockEndpoints.get(key);

    if (!mockEndpoint) {
      throw new Error(`No mock endpoint found for ${method} ${url}`);
    }

    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Mock System: Handling request', {
        method,
        url,
        data,
        mockEndpoint,
        timestamp: new Date().toISOString(),
      });
    }

    const delay = mockEndpoint.delay ?? this.featureFlags.getMockDelay();
    if (delay > 0) {
      await this.simulateNetworkDelay(delay);
    }

    const status = mockEndpoint.status ?? 200;
    
    if (status >= 400) {
      throw {
        response: {
          status,
          data: mockEndpoint.response,
          statusText: this.getStatusText(status),
        },
        message: `Mock HTTP Error: ${status}`,
      };
    }

    return {
      data: this.processResponseData(mockEndpoint.response, data),
      status,
      statusText: this.getStatusText(status),
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-Response': 'true',
        'X-Mock-Timestamp': new Date().toISOString(),
      },
    };
  }

  private createEndpointKey(method: string, url: string): string {
    return `${method.toUpperCase()}:${url}`;
  }

  private async simulateNetworkDelay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  private processResponseData(responseData: any, requestData?: any): any {
    if (typeof responseData === 'function') {
      return responseData(requestData);
    }
    
    if (typeof responseData === 'object' && responseData !== null) {
      return {
        ...responseData,
        _mock: {
          timestamp: new Date().toISOString(),
          requestData,
        },
      };
    }
    
    return responseData;
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    
    return statusTexts[status] || 'Unknown';
  }

  public removeEndpoint(method: string, url: string): boolean {
    const key = this.createEndpointKey(method, url);
    return this.mockEndpoints.delete(key);
  }

  public clearAllEndpoints(): void {
    this.mockEndpoints.clear();
    
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Mock System: All endpoints cleared');
    }
  }

  public getRegisteredEndpoints(): MockEndpoint[] {
    return Array.from(this.mockEndpoints.values());
  }

  public hasEndpoint(method: string, url: string): boolean {
    const key = this.createEndpointKey(method, url);
    return this.mockEndpoints.has(key);
  }

  public setGlobalDelay(delay: number): void {
    this.featureFlags.setFlag('MOCK_DELAY', delay);
  }

  public getStats(): {
    totalEndpoints: number;
    endpointsByMethod: Record<string, number>;
    mockDelay: number;
  } {
    const endpoints = this.getRegisteredEndpoints();
    const endpointsByMethod: Record<string, number> = {};
    
    endpoints.forEach(endpoint => {
      const method = endpoint.method.toUpperCase();
      endpointsByMethod[method] = (endpointsByMethod[method] || 0) + 1;
    });
    
    return {
      totalEndpoints: endpoints.length,
      endpointsByMethod,
      mockDelay: this.featureFlags.getMockDelay(),
    };
  }
}