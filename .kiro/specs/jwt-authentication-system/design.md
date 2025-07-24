# Design Document

## Overview

JWT認証システムは、React Native + Expo環境でのセキュアな認証を実現するシステムです。アクセストークンとリフレッシュトークンの二重構造、セキュアストレージ、生体認証連携により、堅牢で使いやすい認証体験を提供します。

## Architecture

### JWT認証アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT Authentication Layer                 │
├─────────────────────────────────────────────────────────────┤
│  Token Management    │  Secure Storage                      │
│  - Access Token      │  - Encrypted Storage                 │
│  - Refresh Token     │  - Keychain/Keystore                │
│  - Auto Refresh      │  - Biometric Auth                   │
├─────────────────────────────────────────────────────────────┤
│  Token Validation    │  Security Monitoring                │
│  - Expiry Check      │  - Usage Tracking                   │
│  - Format Validation │  - Anomaly Detection                │
│  - Signature Verify  │  - Emergency Controls               │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. JWT トークン管理システム

#### JWTTokenManager
```typescript
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

interface TokenConfig {
  accessTokenExpiry: number; // 15 minutes
  refreshTokenExpiry: number; // 30 days
  autoRefreshThreshold: number; // 5 minutes before expiry
  maxRetryAttempts: number;
}

class JWTTokenManager {
  private config: TokenConfig;
  private secureStorage: SecureStorage;
  private refreshPromise: Promise<TokenPair> | null = null;
  
  async storeTokens(tokens: TokenPair): Promise<void>;
  async getAccessToken(): Promise<string | null>;
  async getRefreshToken(): Promise<string | null>;
  async refreshTokens(): Promise<TokenPair>;
  async clearTokens(): Promise<void>;
  
  isTokenExpired(token: string): boolean;
  shouldRefreshToken(token: string): boolean;
  validateTokenFormat(token: string): boolean;
  decodeTokenPayload(token: string): any;
}
```

#### AutoRefreshService
```typescript
interface RefreshConfig {
  checkInterval: number; // 1 minute
  retryDelay: number; // 5 seconds
  maxRetries: number; // 3 attempts
  backgroundRefresh: boolean;
}

class AutoRefreshService {
  private config: RefreshConfig;
  private tokenManager: JWTTokenManager;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
  forceRefresh(): Promise<boolean>;
  
  private scheduleNextRefresh(): void;
  private handleRefreshError(error: Error): void;
  private notifyRefreshSuccess(tokens: TokenPair): void;
}
```

### 2. セキュアストレージシステム

#### SecureTokenStorage
```typescript
interface StorageConfig {
  encryptionAlgorithm: 'AES-256-GCM';
  keyDerivation: 'PBKDF2';
  biometricPrompt: string;
  accessGroup?: string; // iOS Keychain
}

interface StorageItem {
  value: string;
  encrypted: boolean;
  createdAt: Date;
  expiresAt?: Date;
  requiresBiometric: boolean;
}

class SecureTokenStorage {
  private config: StorageConfig;
  
  async setSecureItem(key: string, value: string, options?: {
    requiresBiometric?: boolean;
    expiresAt?: Date;
  }): Promise<void>;
  
  async getSecureItem(key: string): Promise<string | null>;
  async removeSecureItem(key: string): Promise<void>;
  async clearAllItems(): Promise<void>;
  
  async enableBiometricAuth(): Promise<boolean>;
  async isBiometricAvailable(): Promise<boolean>;
  
  private encrypt(data: string): Promise<string>;
  private decrypt(encryptedData: string): Promise<string>;
  private generateEncryptionKey(): Promise<string>;
}
```

### 3. 生体認証システム

#### BiometricAuthManager
```typescript
interface BiometricConfig {
  enableFingerprint: boolean;
  enableFaceID: boolean;
  fallbackToPassword: boolean;
  promptMessage: string;
  cancelButtonText: string;
}

interface BiometricResult {
  success: boolean;
  error?: string;
  biometricType?: 'fingerprint' | 'faceID' | 'none';
}

class BiometricAuthManager {
  private config: BiometricConfig;
  
  async isAvailable(): Promise<boolean>;
  async getSupportedTypes(): Promise<string[]>;
  async authenticate(reason: string): Promise<BiometricResult>;
  async enableBiometric(): Promise<boolean>;
  async disableBiometric(): Promise<void>;
  
  private handleAuthenticationError(error: any): BiometricResult;
  private showFallbackAuth(): Promise<boolean>;
}
```

### 4. トークン検証システム

#### TokenValidator
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  payload?: any;
  expiresAt?: Date;
}

interface ValidationRules {
  checkExpiry: boolean;
  checkFormat: boolean;
  checkSignature: boolean;
  checkIssuer: boolean;
  checkAudience: boolean;
}

class TokenValidator {
  private rules: ValidationRules;
  private publicKey: string;
  
  validateToken(token: string): ValidationResult;
  validateAccessToken(token: string): ValidationResult;
  validateRefreshToken(token: string): ValidationResult;
  
  private validateJWTFormat(token: string): boolean;
  private validateExpiry(payload: any): boolean;
  private validateSignature(token: string): boolean;
  private validateClaims(payload: any): boolean;
}
```

### 5. セキュリティ監視システム

#### TokenSecurityMonitor
```typescript
interface SecurityEvent {
  type: 'token_refresh' | 'token_validation_failed' | 'suspicious_activity' | 'token_expired';
  timestamp: Date;
  userId?: string;
  deviceId: string;
  ipAddress?: string;
  details: any;
}

interface SecurityMetrics {
  totalRefreshes: number;
  failedValidations: number;
  suspiciousActivities: number;
  averageTokenLifetime: number;
}

class TokenSecurityMonitor {
  private events: SecurityEvent[] = [];
  private alertThresholds: Map<string, number> = new Map();
  
  logSecurityEvent(event: SecurityEvent): void;
  getSecurityMetrics(): SecurityMetrics;
  detectAnomalousActivity(userId: string): boolean;
  
  private analyzeRefreshPatterns(userId: string): boolean;
  private checkRapidTokenUsage(userId: string): boolean;
  private triggerSecurityAlert(event: SecurityEvent): void;
}
```

## Data Models

### TokenData
```typescript
interface TokenData {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
  scope: string[];
  issuedAt: Date;
  deviceId: string;
}
```

### AuthenticationState
```typescript
interface AuthenticationState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: TokenData | null;
  lastRefresh: Date | null;
  biometricEnabled: boolean;
  autoRefreshEnabled: boolean;
}
```

### SecurityConfig
```typescript
interface SecurityConfig {
  tokenManagement: {
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
    autoRefreshEnabled: boolean;
    maxConcurrentSessions: number;
  };
  storage: {
    encryptionEnabled: boolean;
    biometricRequired: boolean;
    keyRotationInterval: number;
  };
  monitoring: {
    enableSecurityLogging: boolean;
    anomalyDetectionEnabled: boolean;
    alertThresholds: {
      failedValidations: number;
      rapidRefreshes: number;
    };
  };
}
```

## Error Handling

### JWT認証エラー処理

```typescript
class JWTAuthError extends Error {
  constructor(
    message: string,
    public code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'REFRESH_FAILED' | 'STORAGE_ERROR' | 'BIOMETRIC_ERROR',
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'JWTAuthError';
  }
}

class JWTErrorHandler {
  static handleTokenExpired(error: JWTAuthError): void {
    console.warn('Access token expired, attempting refresh...');
    // 自動リフレッシュ試行
    this.attemptTokenRefresh();
  }
  
  static handleRefreshFailed(error: JWTAuthError): void {
    console.error('Token refresh failed:', error);
    // ログアウト処理
    this.forceLogout();
  }
  
  static handleStorageError(error: JWTAuthError): void {
    console.error('Secure storage error:', error);
    // ストレージクリアとフォールバック
    this.clearStorageAndFallback();
  }
  
  static handleBiometricError(error: JWTAuthError): void {
    console.warn('Biometric authentication failed:', error);
    // パスワード認証フォールバック
    this.showPasswordFallback();
  }
}
```

## Testing Strategy

### 1. トークン管理テスト

```typescript
describe('JWT Token Management', () => {
  it('should store and retrieve tokens securely', async () => {
    const tokens = createMockTokenPair();
    await tokenManager.storeTokens(tokens);
    
    const accessToken = await tokenManager.getAccessToken();
    expect(accessToken).toBe(tokens.accessToken);
  });
  
  it('should automatically refresh expired tokens', async () => {
    const expiredTokens = createExpiredTokenPair();
    await tokenManager.storeTokens(expiredTokens);
    
    const refreshedTokens = await tokenManager.refreshTokens();
    expect(refreshedTokens.accessToken).not.toBe(expiredTokens.accessToken);
  });
  
  it('should handle refresh failures gracefully', async () => {
    mockRefreshEndpoint.mockRejectedValue(new Error('Refresh failed'));
    
    await expect(tokenManager.refreshTokens())
      .rejects.toThrow('Refresh failed');
  });
});
```

### 2. セキュアストレージテスト

```typescript
describe('Secure Token Storage', () => {
  it('should encrypt tokens before storage', async () => {
    const token = 'test-token';
    await secureStorage.setSecureItem('access_token', token);
    
    // 直接ストレージから読み取り（暗号化されているはず）
    const rawValue = await AsyncStorage.getItem('access_token');
    expect(rawValue).not.toBe(token);
    expect(rawValue).toMatch(/^encrypted:/);
  });
  
  it('should require biometric auth for sensitive data', async () => {
    await secureStorage.setSecureItem('refresh_token', 'token', {
      requiresBiometric: true
    });
    
    // 生体認証なしでアクセス試行
    await expect(secureStorage.getSecureItem('refresh_token'))
      .rejects.toThrow('Biometric authentication required');
  });
});
```

### 3. 生体認証テスト

```typescript
describe('Biometric Authentication', () => {
  it('should authenticate with fingerprint', async () => {
    mockBiometricAuth.mockResolvedValue({ success: true });
    
    const result = await biometricManager.authenticate('Access tokens');
    expect(result.success).toBe(true);
  });
  
  it('should fallback to password on biometric failure', async () => {
    mockBiometricAuth.mockRejectedValue(new Error('Biometric failed'));
    
    const result = await biometricManager.authenticate('Access tokens');
    expect(result.success).toBe(false);
    // フォールバック認証が呼ばれることを確認
    expect(mockPasswordAuth).toHaveBeenCalled();
  });
});
```

## Implementation Plan

### Phase 1: JWT基盤構築 (2-3日)
1. JWTTokenManagerクラス実装
2. TokenValidatorクラス実装
3. 基本的なトークン管理機能
4. トークン形式検証機能

### Phase 2: セキュアストレージ (2-3日)
1. SecureTokenStorageクラス実装
2. 暗号化・復号化機能
3. Keychain/Keystore連携
4. データ保護機能

### Phase 3: 自動リフレッシュ (1-2日)
1. AutoRefreshServiceクラス実装
2. バックグラウンドリフレッシュ
3. エラーハンドリング
4. リトライ機能

### Phase 4: 生体認証連携 (1-2日)
1. BiometricAuthManagerクラス実装
2. 指紋・顔認証機能
3. フォールバック認証
4. 設定管理機能

### Phase 5: セキュリティ監視 (1-2日)
1. TokenSecurityMonitorクラス実装
2. 異常検知機能
3. セキュリティログ
4. アラートシステム

### Phase 6: 統合テスト (1日)
1. 全機能統合テスト
2. セキュリティテスト
3. パフォーマンステスト
4. エラーケーステスト

## Security Standards

- **JWT署名**: RS256 (RSA + SHA-256)
- **暗号化**: AES-256-GCM
- **キー導出**: PBKDF2 (10,000回以上)
- **アクセストークン**: 15分有効期限
- **リフレッシュトークン**: 30日有効期限
- **生体認証**: Touch ID / Face ID / Fingerprint