import { HttpClient } from './httpClient';
import { MockSystem } from './mockSystem';
import { ConnectionTest } from './connectionTest';
import { ApiConfigManager } from './config';
import { FeatureFlagsManager } from '../featureFlags';
import { ApiErrorHandler } from './errorHandler';
import { RequestInterceptor } from './interceptors/requestInterceptor';
import { ResponseInterceptor } from './interceptors/responseInterceptor';
import { AuthInterceptor } from './interceptors/authInterceptor';
import { initializeMockData } from './__mocks__/testData';

export class ApiClient {
  private static instance: ApiClient;
  private httpClient: HttpClient;
  private mockSystem: MockSystem;
  private connectionTest: ConnectionTest;
  private configManager: ApiConfigManager;
  private featureFlags: FeatureFlagsManager;
  private errorHandler: ApiErrorHandler;
  private requestInterceptor: RequestInterceptor;
  private responseInterceptor: ResponseInterceptor;
  private authInterceptor: AuthInterceptor;
  private initialized: boolean = false;

  private constructor() {
    this.configManager = ApiConfigManager.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.errorHandler = new ApiErrorHandler();
    this.requestInterceptor = new RequestInterceptor();
    this.responseInterceptor = new ResponseInterceptor();
    this.authInterceptor = new AuthInterceptor();
    this.httpClient = new HttpClient();
    this.mockSystem = MockSystem.getInstance();
    this.connectionTest = new ConnectionTest();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('API Client: Already initialized');
      }
      return;
    }

    try {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('API Client: Initializing...');
      }

      this.setupInterceptors();
      this.initializeMockData();
      
      const connectionResult = await this.connectionTest.testConnection();
      
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('API Client: Connection test result:', connectionResult);
      }

      this.initialized = true;

      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('API Client: Initialization completed', {
          mode: this.featureFlags.isApiEnabled() ? 'API' : 'Mock',
          debugMode: this.featureFlags.isDebugModeEnabled(),
          mockDelay: this.featureFlags.getMockDelay(),
        });
      }
    } catch (error) {
      console.error('API Client: Initialization failed', error);
      throw error;
    }
  }

  private setupInterceptors(): void {
    const axiosInstance = this.httpClient.getAxiosInstance();

    axiosInstance.interceptors.request.use(
      this.requestInterceptor.handle,
      this.requestInterceptor.handleError
    );

    axiosInstance.interceptors.response.use(
      this.responseInterceptor.handle,
      this.responseInterceptor.handleError
    );

    axiosInstance.interceptors.response.use(
      this.authInterceptor.handle,
      this.authInterceptor.handleError
    );

    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('API Client: Interceptors setup completed');
    }
  }

  private initializeMockData(): void {
    if (!this.featureFlags.isApiEnabled()) {
      const mockData = initializeMockData();
      this.mockSystem.registerEndpoints(mockData);

      if (this.featureFlags.isDebugModeEnabled()) {
        console.log(`API Client: Registered ${mockData.length} mock endpoints`);
      }
    }
  }

  public setAuthToken(token: string): void {
    this.requestInterceptor.setAuthToken(token);
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('API Client: Auth token set');
    }
  }

  public clearAuthToken(): void {
    this.requestInterceptor.clearAuthToken();
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('API Client: Auth token cleared');
    }
  }

  public setRefreshToken(token: string): void {
    this.authInterceptor.setRefreshToken(token);
  }

  public clearRefreshToken(): void {
    this.authInterceptor.clearRefreshToken();
  }

  public onTokenRefreshed(callback: (newToken: string) => void): void {
    this.authInterceptor.onTokenRefreshed = callback;
  }

  public onAuthenticationFailure(callback: () => void): void {
    this.authInterceptor.onAuthenticationFailure = callback;
  }

  public async get<T>(url: string, config?: any): Promise<T> {
    if (!this.featureFlags.isApiEnabled()) {
      const response = await this.mockSystem.handleRequest<T>('GET', url);
      return response.data;
    }
    const response = await this.httpClient.get<T>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: any): Promise<T> {
    if (!this.featureFlags.isApiEnabled()) {
      const response = await this.mockSystem.handleRequest<T>('POST', url, data);
      return response.data;
    }
    const response = await this.httpClient.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: any): Promise<T> {
    if (!this.featureFlags.isApiEnabled()) {
      const response = await this.mockSystem.handleRequest<T>('PUT', url, data);
      return response.data;
    }
    const response = await this.httpClient.put<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: any): Promise<T> {
    if (!this.featureFlags.isApiEnabled()) {
      const response = await this.mockSystem.handleRequest<T>('DELETE', url);
      return response.data;
    }
    const response = await this.httpClient.delete<T>(url, config);
    return response.data;
  }

  public async testConnection() {
    return this.connectionTest.testConnection();
  }

  public async performHealthCheck() {
    return this.connectionTest.performHealthCheck();
  }

  public getStats() {
    return {
      connection: this.connectionTest.getConnectionStats(),
      mock: this.mockSystem.getStats(),
      config: this.configManager.getConfig(),
      flags: this.featureFlags.getAllFlags(),
    };
  }

  public enableApiMode(): void {
    this.featureFlags.enableApiMode();
    this.httpClient.updateConfig();
    this.mockSystem.clearAllEndpoints();
    
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('API Client: Switched to API mode');
    }
  }

  public enableMockMode(): void {
    this.featureFlags.enableMockMode();
    this.initializeMockData();
    
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('API Client: Switched to Mock mode');
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async reinitialize(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }
}

export const apiClient = ApiClient.getInstance();

export {
  ApiConfigManager,
  FeatureFlagsManager,
  HttpClient,
  MockSystem,
  ConnectionTest,
  ApiErrorHandler,
};