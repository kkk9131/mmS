export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  type: 'network' | 'http' | 'timeout' | 'parse' | 'unknown';
  details?: any;
  timestamp: string;
}

export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  retries?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  responseTime?: number;
  error?: ApiError;
  timestamp: string;
}

export interface MockEndpoint {
  url: string;
  method: string;
  response: any;
  delay?: number;
  status?: number;
}

export interface FeatureFlags {
  USE_API: boolean;
  DEBUG_MODE: boolean;
  MOCK_DELAY: number;
}

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  retries: number;
}