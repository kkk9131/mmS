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
    
    // モバイルデバイスの場合はlocalhostではなくマシンのIPアドレスを使用
    const getBaseURL = () => {
      if (!isDevelopment) {
        return 'https://api.mamapace.com/api';
      }
      
      // Expoの開発環境では、モックAPIを使用
      // 実際のAPIサーバーがある場合は、開発マシンのIPアドレスに変更
      // 例: return 'http://192.168.1.100:3048/api';
      return 'http://localhost:3048/api';
    };
    
    return {
      baseURL: getBaseURL(),
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