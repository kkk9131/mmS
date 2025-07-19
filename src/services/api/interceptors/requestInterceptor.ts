import { AxiosRequestConfig } from 'axios';
import { FeatureFlagsManager } from '../../featureFlags';

export class RequestInterceptor {
  private featureFlags: FeatureFlagsManager;
  private authToken: string | null = null;

  constructor() {
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  public clearAuthToken(): void {
    this.authToken = null;
  }

  public handle = (config: AxiosRequestConfig): AxiosRequestConfig => {
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Request Interceptor:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.data,
        timestamp: new Date().toISOString(),
      });
    }

    if (this.authToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${this.authToken}`,
      };
    }

    config.headers = {
      ...config.headers,
      'X-Request-ID': this.generateRequestId(),
      'X-Timestamp': new Date().toISOString(),
    };

    if (this.featureFlags.isDebugModeEnabled()) {
      config.headers['X-Debug-Mode'] = 'true';
    }

    return config;
  };

  public handleError = (error: any): Promise<any> => {
    if (this.featureFlags.isDebugModeEnabled()) {
      console.error('Request Interceptor Error:', {
        message: error.message,
        config: error.config,
        timestamp: new Date().toISOString(),
      });
    }
    return Promise.reject(error);
  };

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}