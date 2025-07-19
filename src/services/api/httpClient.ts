import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, RequestConfig, ApiError } from '../../types/api';
import { ApiConfigManager } from './config';
import { FeatureFlagsManager } from '../featureFlags';

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private configManager: ApiConfigManager;
  private featureFlags: FeatureFlagsManager;

  constructor() {
    this.configManager = ApiConfigManager.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
    this.axiosInstance = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const config = this.configManager.getConfig();
    
    const instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: config.headers,
    });

    instance.interceptors.request.use((config: any) => {
      config.metadata = {
        requestStartTime: Date.now(),
      };
      return config;
    });

    return instance;
  }

  private async executeRequest<T>(
    requestConfig: AxiosRequestConfig,
    retries: number = 0
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request(requestConfig);
      
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('API Response:', {
          url: requestConfig.url,
          method: requestConfig.method,
          status: response.status,
          data: response.data,
        });
      }

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
      };
    } catch (error: any) {
      if (retries > 0 && this.shouldRetry(error)) {
        if (this.featureFlags.isDebugModeEnabled()) {
          console.log(`Retrying request. Attempts left: ${retries}`);
        }
        await this.delay(1000);
        return this.executeRequest<T>(requestConfig, retries - 1);
      }
      
      throw this.handleError(error);
    }
  }

  private shouldRetry(error: any): boolean {
    return (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNABORTED' ||
      (error.response && error.response.status >= 500)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleError(error: any): ApiError {
    const timestamp = new Date().toISOString();
    
    if (error.code === 'ECONNABORTED') {
      return {
        message: 'Request timeout',
        code: error.code,
        type: 'timeout',
        timestamp,
      };
    }
    
    if (!error.response) {
      return {
        message: error.message || 'Network error',
        code: error.code,
        type: 'network',
        timestamp,
      };
    }
    
    return {
      message: error.response.data?.message || error.message || 'HTTP error',
      code: error.response.data?.code,
      status: error.response.status,
      type: 'http',
      details: error.response.data,
      timestamp,
    };
  }

  public async get<T>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url,
      timeout: config?.timeout,
      headers: config?.headers,
    };

    const retries = config?.retries ?? this.configManager.getConfig().retries;
    return this.executeRequest<T>(requestConfig, retries);
  }

  public async post<T>(
    url: string, 
    data?: any, 
    config?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method: 'POST',
      url,
      data,
      timeout: config?.timeout,
      headers: config?.headers,
    };

    const retries = config?.retries ?? this.configManager.getConfig().retries;
    return this.executeRequest<T>(requestConfig, retries);
  }

  public async put<T>(
    url: string, 
    data?: any, 
    config?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method: 'PUT',
      url,
      data,
      timeout: config?.timeout,
      headers: config?.headers,
    };

    const retries = config?.retries ?? this.configManager.getConfig().retries;
    return this.executeRequest<T>(requestConfig, retries);
  }

  public async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method: 'DELETE',
      url,
      timeout: config?.timeout,
      headers: config?.headers,
    };

    const retries = config?.retries ?? this.configManager.getConfig().retries;
    return this.executeRequest<T>(requestConfig, retries);
  }

  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  public updateConfig(): void {
    this.axiosInstance = this.createAxiosInstance();
  }
}