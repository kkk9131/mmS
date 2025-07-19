# Design Document

## Overview

HTTPクライアント設定は、Mamapaceアプリケーションの全API通信を統一管理する基盤システムです。Axiosベースのクライアントを構築し、認証、エラーハンドリング、ログ出力、機能フラグによるモック切り替えを提供します。

## Architecture

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                    HTTP Client Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   API Client    │  │ Feature Flags   │  │ Error Handler   │ │
│  │   (Axios)       │  │   System        │  │    System       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Interceptor Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    Request      │  │    Response     │  │     Auth        │ │
│  │  Interceptor    │  │  Interceptor    │  │  Interceptor    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Network Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Real API      │  │   Mock Data     │  │  Connection     │ │
│  │   Requests      │  │    System       │  │     Test        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. HTTP Client Configuration

```typescript
// src/services/api/config.ts
interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  retryAttempts: number;
  retryDelay: number;
}

interface FeatureFlags {
  USE_API: boolean;
  DEBUG_MODE: boolean;
  USE_AUTH: boolean;
  MOCK_DELAY: number;
}
```

### 2. HTTP Client Service

```typescript
// src/services/api/httpClient.ts
interface HttpClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
  testConnection(): Promise<ConnectionTestResult>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  timestamp: string;
}

interface ApiError {
  type: 'network' | 'http' | 'timeout' | 'unknown';
  status?: number;
  message: string;
  details?: any;
  timestamp: string;
}
```

### 3. Interceptor System

```typescript
// src/services/api/interceptors.ts
interface RequestInterceptor {
  onRequest(config: AxiosRequestConfig): AxiosRequestConfig;
  onRequestError(error: any): Promise<any>;
}

interface ResponseInterceptor {
  onResponse(response: AxiosResponse): AxiosResponse;
  onResponseError(error: any): Promise<any>;
}

interface AuthInterceptor {
  addAuthHeader(config: AxiosRequestConfig): AxiosRequestConfig;
  handleAuthError(error: any): Promise<any>;
  refreshToken(): Promise<string>;
}
```

### 4. Mock System

```typescript
// src/services/api/mockSystem.ts
interface MockResponse<T> {
  data: T;
  status: number;
  delay?: number;
}

interface MockEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  response: MockResponse<any>;
  condition?: (config: AxiosRequestConfig) => boolean;
}

interface MockSystem {
  registerEndpoint(endpoint: MockEndpoint): void;
  findMockResponse(method: string, url: string): MockResponse<any> | null;
  simulateNetworkDelay(delay: number): Promise<void>;
}
```

## Data Models

### Configuration Models

```typescript
// src/types/api.ts
export interface ApiConfiguration {
  development: {
    baseURL: string;
    timeout: number;
    useAPI: boolean;
    mockDelay: number;
  };
  production: {
    baseURL: string;
    timeout: number;
    useAPI: boolean;
  };
}

export interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipLogging?: boolean;
  retryAttempts?: number;
}
```

### Response Models

```typescript
export interface StandardResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends StandardResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## Error Handling

### Error Classification System

```typescript
// src/services/api/errorHandler.ts
export enum ApiErrorType {
  NETWORK = 'network',
  HTTP = 'http',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

export interface ApiErrorDetails {
  type: ApiErrorType;
  status?: number;
  code?: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  retryable: boolean;
}
```

### Error Handling Strategy

```typescript
export class ApiErrorHandler {
  static handleError(error: any): ApiErrorDetails {
    if (error.code === 'NETWORK_ERROR') {
      return this.createNetworkError(error);
    }
    
    if (error.response) {
      return this.createHttpError(error.response);
    }
    
    if (error.code === 'ECONNABORTED') {
      return this.createTimeoutError(error);
    }
    
    return this.createUnknownError(error);
  }
  
  static isRetryableError(error: ApiErrorDetails): boolean {
    return error.retryable && error.type !== ApiErrorType.AUTHENTICATION;
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/services/api/httpClient.test.ts
describe('HttpClient', () => {
  describe('Configuration', () => {
    it('should initialize with correct base configuration');
    it('should apply timeout settings correctly');
    it('should set default headers properly');
  });
  
  describe('Feature Flags', () => {
    it('should use mock data when USE_API is false');
    it('should make real requests when USE_API is true');
    it('should respect environment-based defaults');
  });
  
  describe('Error Handling', () => {
    it('should handle network errors correctly');
    it('should handle HTTP errors with proper status codes');
    it('should handle timeout errors appropriately');
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/api.integration.test.ts
describe('API Integration', () => {
  it('should successfully connect to health endpoint');
  it('should handle authentication flow correctly');
  it('should retry failed requests appropriately');
  it('should switch between mock and real API seamlessly');
});
```

### Mock Test Data

```typescript
// src/services/api/__mocks__/testData.ts
export const mockApiResponses = {
  healthCheck: {
    data: { status: 'ok', timestamp: '2024-01-01T00:00:00Z' },
    status: 200
  },
  authLogin: {
    data: { 
      token: 'mock-jwt-token',
      user: { id: 1, nickname: 'TestUser' }
    },
    status: 200
  }
};
```

## Implementation Details

### File Structure

```
src/services/api/
├── index.ts                 # Main export file
├── config.ts               # Configuration management
├── httpClient.ts           # Main HTTP client class
├── interceptors/
│   ├── index.ts
│   ├── requestInterceptor.ts
│   ├── responseInterceptor.ts
│   └── authInterceptor.ts
├── errorHandler.ts         # Error handling utilities
├── mockSystem.ts          # Mock data system
├── connectionTest.ts      # Connection testing
└── __mocks__/
    ├── endpoints.ts       # Mock endpoint definitions
    └── testData.ts       # Test data for mocks
```

### Configuration Management

```typescript
// src/services/api/config.ts
export class ApiConfig {
  private static instance: ApiConfig;
  private config: ApiConfiguration;
  
  private constructor() {
    this.config = this.loadConfiguration();
  }
  
  static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }
  
  private loadConfiguration(): ApiConfiguration {
    return {
      development: {
        baseURL: __DEV__ ? 'http://localhost:3000/api' : 'https://api.mamapace.com',
        timeout: 10000,
        useAPI: false, // Default to mock in development
        mockDelay: 1000
      },
      production: {
        baseURL: 'https://api.mamapace.com',
        timeout: 10000,
        useAPI: true
      }
    };
  }
}
```

### Performance Considerations

1. **Request Caching**: Implement intelligent caching for GET requests
2. **Connection Pooling**: Reuse connections for better performance
3. **Request Deduplication**: Prevent duplicate simultaneous requests
4. **Lazy Loading**: Load mock data only when needed
5. **Memory Management**: Clean up interceptors and listeners properly

### Security Considerations

1. **Token Storage**: Secure storage of authentication tokens
2. **Request Sanitization**: Sanitize all outgoing request data
3. **Response Validation**: Validate all incoming response data
4. **SSL Pinning**: Implement certificate pinning for production
5. **Logging Security**: Avoid logging sensitive information

## Deployment Strategy

### Environment Configuration

```typescript
// src/config/environment.ts
export const ENV_CONFIG = {
  development: {
    API_BASE_URL: 'http://localhost:3000/api',
    USE_MOCK_API: true,
    DEBUG_API: true
  },
  staging: {
    API_BASE_URL: 'https://staging-api.mamapace.com',
    USE_MOCK_API: false,
    DEBUG_API: true
  },
  production: {
    API_BASE_URL: 'https://api.mamapace.com',
    USE_MOCK_API: false,
    DEBUG_API: false
  }
};
```

### Feature Flag Management

```typescript
// src/services/featureFlags.ts
export class FeatureFlags {
  static get USE_API(): boolean {
    return __DEV__ ? false : true;
  }
  
  static get DEBUG_MODE(): boolean {
    return __DEV__;
  }
  
  static get MOCK_DELAY(): number {
    return __DEV__ ? 1000 : 0;
  }
}
```