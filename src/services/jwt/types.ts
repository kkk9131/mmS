export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface TokenConfig {
  accessTokenExpiry: number; // 15 minutes in milliseconds
  refreshTokenExpiry: number; // 30 days in milliseconds
  autoRefreshThreshold: number; // 5 minutes before expiry in milliseconds
  maxRetryAttempts: number;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
  scope: string[];
  issuedAt: Date;
  deviceId: string;
}

export interface AuthenticationState {
  isAuthenticated: boolean;
  user: any | null;
  tokens: TokenData | null;
  lastRefresh: Date | null;
  biometricEnabled: boolean;
  autoRefreshEnabled: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  payload?: any;
  expiresAt?: Date;
}

export interface ValidationRules {
  checkExpiry: boolean;
  checkFormat: boolean;
  checkSignature: boolean;
  checkIssuer: boolean;
  checkAudience: boolean;
}

export interface SecurityEvent {
  type: 'token_refresh' | 'token_validation_failed' | 'suspicious_activity' | 'token_expired';
  timestamp: Date;
  userId?: string;
  deviceId: string;
  ipAddress?: string;
  details: any;
}

export interface SecurityMetrics {
  totalRefreshes: number;
  failedValidations: number;
  suspiciousActivities: number;
  averageTokenLifetime: number;
}

export class JWTAuthError extends Error {
  constructor(
    message: string,
    public code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'REFRESH_FAILED' | 'STORAGE_ERROR' | 'BIOMETRIC_ERROR',
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'JWTAuthError';
  }
}