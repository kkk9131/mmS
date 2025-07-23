import { ConnectionTestResult } from '../../types/api';
import { HttpClient } from './httpClient';
import { MockSystem } from './mockSystem';
import { FeatureFlagsManager } from '../featureFlags';
import { ApiErrorHandler } from './errorHandler';

export class ConnectionTest {
  private httpClient: HttpClient;
  private mockSystem: MockSystem;
  private featureFlags: FeatureFlagsManager;
  private errorHandler: ApiErrorHandler;

  constructor() {
    this.httpClient = (HttpClient as any).getInstance();
    this.mockSystem = MockSystem.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.errorHandler = new ApiErrorHandler();
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('Connection Test: Starting connection test', {
          useApi: this.featureFlags.isApiEnabled(),
          timestamp,
        });
      }

      const result = this.featureFlags.isApiEnabled()
        ? await this.testApiConnection()
        : await this.testMockConnection();

      const responseTime = Date.now() - startTime;

      const successResult: ConnectionTestResult = {
        success: true,
        responseTime,
        timestamp,
        ...result,
      };

      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('Connection Test: Success', successResult);
      }

      return successResult;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const apiError = this.errorHandler.handleError(error);

      const failureResult: ConnectionTestResult = {
        success: false,
        responseTime,
        error: apiError,
        timestamp,
      };

      if (this.featureFlags.isDebugModeEnabled()) {
        console.error('Connection Test: Failed', failureResult);
      }

      return failureResult;
    }
  }

  private async testApiConnection(): Promise<Partial<ConnectionTestResult>> {
    try {
      const response = await this.httpClient.get('/health');
      
      return {
        success: true,
        type: 'api',
        endpoint: '/health',
        status: response.status,
        data: response.data,
      } as any;
    } catch (error) {
      throw error;
    }
  }

  private async testMockConnection(): Promise<Partial<ConnectionTestResult>> {
    try {
      const response = await this.mockSystem.handleRequest('GET', '/health');
      
      return {
        success: true,
        type: 'mock',
        endpoint: '/health',
        status: response.status,
        data: response.data,
      } as any;
    } catch (error) {
      throw error;
    }
  }

  public async testMultipleEndpoints(endpoints: string[]): Promise<{
    overall: ConnectionTestResult;
    individual: (ConnectionTestResult & { endpoint: string })[];
  }> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const individual: (ConnectionTestResult & { endpoint: string })[] = [];

    let overallSuccess = true;
    let totalResponseTime = 0;

    for (const endpoint of endpoints) {
      try {
        const testResult = await this.testSpecificEndpoint(endpoint);
        individual.push({
          ...testResult,
          endpoint,
        });
        
        if (testResult.responseTime) {
          totalResponseTime += testResult.responseTime;
        }
        
        if (!testResult.success) {
          overallSuccess = false;
        }
      } catch (error: any) {
        const apiError = this.errorHandler.handleError(error);
        individual.push({
          success: false,
          responseTime: Date.now() - startTime,
          error: apiError,
          timestamp: new Date().toISOString(),
          endpoint,
        });
        overallSuccess = false;
      }
    }

    const overall: ConnectionTestResult = {
      success: overallSuccess,
      responseTime: totalResponseTime,
      timestamp,
      details: {
        testedEndpoints: endpoints.length,
        successfulEndpoints: individual.filter(r => r.success).length,
        failedEndpoints: individual.filter(r => !r.success).length,
      },
    } as any;

    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Connection Test: Multiple endpoints test completed', {
        overall,
        individual,
      });
    }

    return { overall, individual };
  }

  private async testSpecificEndpoint(endpoint: string): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const response = this.featureFlags.isApiEnabled()
        ? await this.httpClient.get(endpoint)
        : await this.mockSystem.handleRequest('GET', endpoint);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        timestamp,
        endpoint,
        status: response.status,
        type: this.featureFlags.isApiEnabled() ? 'api' : 'mock',
      } as any;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const apiError = this.errorHandler.handleError(error);

      return {
        success: false,
        responseTime,
        error: apiError,
        timestamp,
      };
    }
  }

  public async performHealthCheck(): Promise<{
    api: ConnectionTestResult;
    database?: ConnectionTestResult;
    cache?: ConnectionTestResult;
    external?: ConnectionTestResult;
  }> {
    const results: any = {};

    results.api = await this.testConnection();

    if (this.featureFlags.isApiEnabled()) {
      try {
        const databaseTest = await this.testSpecificEndpoint('/health/database');
        results.database = databaseTest;
      } catch (error) {
        results.database = {
          success: false,
          timestamp: new Date().toISOString(),
          error: this.errorHandler.handleError(error),
        };
      }

      try {
        const cacheTest = await this.testSpecificEndpoint('/health/cache');
        results.cache = cacheTest;
      } catch (error) {
        results.cache = {
          success: false,
          timestamp: new Date().toISOString(),
          error: this.errorHandler.handleError(error),
        };
      }
    }

    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Connection Test: Health check completed', results);
    }

    return results;
  }

  public getConnectionStats(): {
    mode: 'api' | 'mock';
    debugMode: boolean;
    mockDelay: number;
    isHealthy: boolean;
  } {
    return {
      mode: this.featureFlags.isApiEnabled() ? 'api' : 'mock',
      debugMode: this.featureFlags.isDebugModeEnabled(),
      mockDelay: this.featureFlags.getMockDelay(),
      isHealthy: true,
    };
  }
}