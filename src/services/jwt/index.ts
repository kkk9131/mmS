// JWT認証システムのメインエクスポート
export { JWTAuthService } from './JWTAuthService';
export { JWTTokenManager } from './JWTTokenManager';
export { TokenValidator } from './TokenValidator';
export { AutoRefreshService } from './AutoRefreshService';
export { BiometricAuthManager } from './BiometricAuthManager';
export { TokenSecurityMonitor } from './TokenSecurityMonitor';
export { SecureTokenStorage } from './SecureTokenStorage';

// 型定義のエクスポート
export type {
  TokenPair,
  TokenConfig,
  TokenData,
  AuthenticationState,
  ValidationResult,
  ValidationRules,
  SecurityEvent,
  SecurityMetrics,
} from './types';

export { JWTAuthError } from './types';

// デフォルト設定
export const DEFAULT_JWT_CONFIG = {
  tokenConfig: {
    accessTokenExpiry: 60 * 60 * 1000, // 60分
    refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30日
    autoRefreshThreshold: 10 * 60 * 1000, // 10分前
    maxRetryAttempts: 3,
  },
  enableBiometric: true,
  enableAutoRefresh: true,
  enableSecurityMonitoring: true,
};

// ユーティリティ関数
export const createJWTAuthService = (config?: any) => {
  // JWTAuthServiceを遅延インポートして循環依存を回避
  const { JWTAuthService: Service } = require('./JWTAuthService');
  return new Service({
    ...DEFAULT_JWT_CONFIG,
    ...config,
  });
};