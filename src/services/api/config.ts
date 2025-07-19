import { ApiConfig } from '../../types/api';

export class ApiConfigManager {
  private static instance: ApiConfigManager;
  private config: ApiConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ApiConfigManager {
    if (!ApiConfigManager.instance) {
      ApiConfigManager.instance = new ApiConfigManager();
    }
    return ApiConfigManager.instance;
  }

  private loadConfig(): ApiConfig {
    const isDevelopment = __DEV__ ?? false;
    
    return {
      baseURL: isDevelopment 
        ? 'http://localhost:3048/api' 
        : 'https://api.mamapace.com/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      retries: 3,
    };
  }

  public getConfig(): ApiConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public resetConfig(): void {
    this.config = this.loadConfig();
  }

  public getDevelopmentConfig(): ApiConfig {
    return {
      baseURL: 'http://localhost:3048/api',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Debug-Mode': 'true',
      },
      retries: 1,
    };
  }

  public getProductionConfig(): ApiConfig {
    return {
      baseURL: 'https://api.mamapace.com/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      retries: 3,
    };
  }
}