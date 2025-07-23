import { AxiosResponse } from 'axios';
import { FeatureFlagsManager } from '../../featureFlags';

export class ResponseInterceptor {
  private featureFlags: FeatureFlagsManager;

  constructor() {
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public handle = (response: AxiosResponse): AxiosResponse => {
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Response Interceptor:', {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        responseTime: this.calculateResponseTime(response),
        timestamp: new Date().toISOString(),
      });
    }

    response.data = this.normalizeResponse(response.data);

    return response;
  };

  public handleError = (error: any): Promise<any> => {
    if (this.featureFlags.isDebugModeEnabled()) {
      console.error('Response Interceptor Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (error.response) {
      error.response.data = this.normalizeErrorResponse(error.response.data);
    }

    return Promise.reject(error);
  };

  private normalizeResponse(data: any): any {
    if (data && typeof data === 'object') {
      return {
        ...data,
        _meta: {
          timestamp: new Date().toISOString(),
          processed: true,
        },
      };
    }
    return data;
  }

  private normalizeErrorResponse(data: any): any {
    if (data && typeof data === 'object') {
      return {
        message: data.message || 'An error occurred',
        code: data.code || 'UNKNOWN_ERROR',
        details: data.details || data,
        _meta: {
          timestamp: new Date().toISOString(),
          processed: true,
          error: true,
        },
      };
    }
    return {
      message: 'An error occurred',
      code: 'UNKNOWN_ERROR',
      _meta: {
        timestamp: new Date().toISOString(),
        processed: true,
        error: true,
      },
    };
  }

  private calculateResponseTime(response: AxiosResponse): number | undefined {
    const requestStart = (response.config as any).metadata?.requestStartTime;
    if (requestStart) {
      return Date.now() - requestStart;
    }
    return undefined;
  }
}