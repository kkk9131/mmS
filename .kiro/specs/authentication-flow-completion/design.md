# Design Document

## Overview

認証フロー完成システムは、JWT認証システムを基盤として、完全な認証体験を提供するシステムです。自動ログイン、認証ガード、ログアウト処理、アカウント削除、エラーハンドリングを統合し、React Native + Expo環境でシームレスな認証フローを実現します。

## Architecture

### 認証フローアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                Authentication Flow Layer                    │
├─────────────────────────────────────────────────────────────┤
│  Auto Login          │  Authentication Guards              │
│  - Token Check       │  - Route Protection                 │
│  - Biometric Auth    │  - Permission Check                 │
│  - Session Restore   │  - Redirect Logic                   │
├─────────────────────────────────────────────────────────────┤
│  Logout Management   │  Error Handling                     │
│  - Secure Logout     │  - User-Friendly Messages          │
│  - Token Cleanup     │  - Recovery Options                 │
│  - Account Deletion  │  - Fallback Mechanisms             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 自動ログインシステム

#### AutoLoginManager
```typescript
interface AutoLoginConfig {
  enableBiometric: boolean;
  enableTokenRestore: boolean;
  maxRetryAttempts: number;
  timeoutMs: number;
}

interface AutoLoginResult {
  success: boolean;
  method: 'token' | 'biometric' | 'none';
  user?: User;
  error?: string;
  requiresUserAction: boolean;
}

class AutoLoginManager {
  private config: AutoLoginConfig;
  private jwtAuthService: JWTAuthService;
  private isProcessing: boolean = false;
  
  async attemptAutoLogin(): Promise<AutoLoginResult>;
  async restoreFromToken(): Promise<AutoLoginResult>;
  async restoreFromBiometric(): Promise<AutoLoginResult>;
  
  private validateStoredSession(): Promise<boolean>;
  private handleAutoLoginError(error: Error): AutoLoginResult;
  private notifyAutoLoginResult(result: AutoLoginResult): void;
}
```

#### SessionRestoreService
```typescript
interface SessionData {
  userId: string;
  lastActivity: Date;
  deviceFingerprint: string;
  sessionFlags: string[];
}

class SessionRestoreService {
  private jwtAuthService: JWTAuthService;
  
  async saveSessionData(user: User): Promise<void>;
  async restoreSession(): Promise<User | null>;
  async validateSession(sessionData: SessionData): Promise<boolean>;
  async clearSessionData(): Promise<void>;
  
  private generateDeviceFingerprint(): string;
  private isSessionExpired(sessionData: SessionData): boolean;
}
```

### 2. 認証ガードシステム

#### AuthGuard
```typescript
interface GuardConfig {
  redirectTo: string;
  requiredPermissions?: string[];
  allowAnonymous: boolean;
  checkInterval: number;
}

interface GuardResult {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
  requiredAction?: 'login' | 'permission' | 'verification';
}

class AuthGuard {
  private config: GuardConfig;
  private authService: JWTAuthService;
  
  async checkAccess(route: string, user?: User): Promise<GuardResult>;
  async checkPermissions(permissions: string[], user: User): Promise<boolean>;
  
  private isProtectedRoute(route: string): boolean;
  private hasRequiredPermissions(user: User, permissions: string[]): boolean;
  private generateRedirectUrl(originalRoute: string): string;
}
```

#### ProtectedRoute
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  fallback?: React.ComponentType;
  redirectTo?: string;
  allowAnonymous?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  fallback: Fallback,
  redirectTo = '/login',
  allowAnonymous = false,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const authGuard = useAuthGuard();
  
  // 認証チェックロジック
  // アクセス制御ロジック
  // リダイレクト処理
};
```

### 3. ログアウト管理システム

#### LogoutManager
```typescript
interface LogoutConfig {
  confirmationRequired: boolean;
  clearBiometric: boolean;
  clearAllSessions: boolean;
  redirectTo: string;
}

interface LogoutResult {
  success: boolean;
  method: 'user' | 'auto' | 'force';
  clearedData: string[];
  error?: string;
}

class LogoutManager {
  private config: LogoutConfig;
  private jwtAuthService: JWTAuthService;
  private sessionService: SessionRestoreService;
  
  async logout(method: 'user' | 'auto' | 'force' = 'user'): Promise<LogoutResult>;
  async forceLogout(reason: string): Promise<LogoutResult>;
  
  private showLogoutConfirmation(): Promise<boolean>;
  private clearAllAuthData(): Promise<string[]>;
  private notifyLogoutComplete(result: LogoutResult): void;
}
```

#### AccountDeletionService
```typescript
interface DeletionConfig {
  confirmationSteps: number;
  gracePeriodDays: number;
  backupData: boolean;
}

interface DeletionResult {
  success: boolean;
  deletedData: string[];
  backupLocation?: string;
  error?: string;
}

class AccountDeletionService {
  private config: DeletionConfig;
  private apiClient: ApiClient;
  
  async requestAccountDeletion(): Promise<DeletionResult>;
  async confirmAccountDeletion(confirmationCode: string): Promise<DeletionResult>;
  async cancelAccountDeletion(): Promise<boolean>;
  
  private validateDeletionRequest(): Promise<boolean>;
  private backupUserData(): Promise<string>;
  private executeAccountDeletion(): Promise<DeletionResult>;
}
```

### 4. エラーハンドリングシステム

#### AuthErrorHandler
```typescript
interface ErrorConfig {
  showUserFriendlyMessages: boolean;
  enableRetry: boolean;
  maxRetryAttempts: number;
  supportContactInfo: string;
}

interface ErrorHandlingResult {
  handled: boolean;
  userMessage: string;
  actions: ErrorAction[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ErrorAction {
  label: string;
  action: () => Promise<void>;
  primary: boolean;
}

class AuthErrorHandler {
  private config: ErrorConfig;
  
  handleAuthError(error: Error, context: string): ErrorHandlingResult;
  handleNetworkError(error: NetworkError): ErrorHandlingResult;
  handleBiometricError(error: BiometricError): ErrorHandlingResult;
  handleTokenError(error: JWTAuthError): ErrorHandlingResult;
  
  private generateUserMessage(error: Error): string;
  private generateErrorActions(error: Error): ErrorAction[];
  private shouldShowRetryOption(error: Error): boolean;
}
```

#### ErrorRecoveryService
```typescript
interface RecoveryOption {
  type: 'retry' | 'fallback' | 'reset' | 'contact';
  label: string;
  description: string;
  action: () => Promise<boolean>;
}

class ErrorRecoveryService {
  private authService: JWTAuthService;
  private errorHandler: AuthErrorHandler;
  
  async getRecoveryOptions(error: Error): Promise<RecoveryOption[]>;
  async executeRecovery(option: RecoveryOption): Promise<boolean>;
  
  private createRetryOption(error: Error): RecoveryOption;
  private createFallbackOption(error: Error): RecoveryOption;
  private createResetOption(): RecoveryOption;
  private createContactOption(): RecoveryOption;
}
```

### 5. 認証状態管理システム

#### AuthStateManager
```typescript
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  permissions: string[];
  sessionInfo: SessionInfo;
  lastActivity: Date;
  error: AuthError | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

class AuthStateManager {
  private state: AuthState;
  private listeners: ((state: AuthState) => void)[] = [];
  private jwtAuthService: JWTAuthService;
  
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  dispatch(action: AuthAction): void;
  
  private updateState(updates: Partial<AuthState>): void;
  private notifyListeners(): void;
}
```

## Data Models

### AuthFlowConfig
```typescript
interface AuthFlowConfig {
  autoLogin: {
    enabled: boolean;
    preferBiometric: boolean;
    tokenValidationTimeout: number;
    maxRetryAttempts: number;
  };
  authGuard: {
    protectedRoutes: string[];
    defaultRedirect: string;
    permissionLevels: Record<string, string[]>;
  };
  logout: {
    confirmationRequired: boolean;
    clearAllData: boolean;
    redirectTo: string;
  };
  errorHandling: {
    showDetailedErrors: boolean;
    enableRecovery: boolean;
    supportContact: string;
  };
}
```

### AuthFlowState
```typescript
interface AuthFlowState {
  phase: 'initializing' | 'authenticating' | 'authenticated' | 'error';
  autoLoginAttempted: boolean;
  lastError: AuthError | null;
  recoveryOptions: RecoveryOption[];
  sessionData: SessionData | null;
}
```

## Error Handling

### 認証フローエラー処理

```typescript
class AuthFlowError extends Error {
  constructor(
    message: string,
    public code: 'AUTO_LOGIN_FAILED' | 'GUARD_DENIED' | 'LOGOUT_FAILED' | 'DELETION_FAILED',
    public recoverable: boolean = true,
    public userAction?: string
  ) {
    super(message);
    this.name = 'AuthFlowError';
  }
}

class AuthFlowErrorHandler {
  static handleAutoLoginError(error: AuthFlowError): void {
    console.warn('Auto login failed:', error);
    // フォールバック：手動ログイン画面表示
    this.showManualLogin();
  }
  
  static handleGuardError(error: AuthFlowError, route: string): void {
    console.error('Route access denied:', error);
    // リダイレクト処理
    this.redirectToLogin(route);
  }
  
  static handleLogoutError(error: AuthFlowError): void {
    console.error('Logout failed:', error);
    // 強制ログアウト
    this.forceLogout();
  }
  
  static handleDeletionError(error: AuthFlowError): void {
    console.error('Account deletion failed:', error);
    // エラー表示とサポート連絡先
    this.showDeletionError(error);
  }
}
```

## Testing Strategy

### 1. 自動ログインテスト

```typescript
describe('Auto Login Flow', () => {
  it('should auto login with valid token', async () => {
    const mockToken = createValidToken();
    await storeToken(mockToken);
    
    const result = await autoLoginManager.attemptAutoLogin();
    expect(result.success).toBe(true);
    expect(result.method).toBe('token');
  });
  
  it('should fallback to biometric when token expired', async () => {
    const expiredToken = createExpiredToken();
    await storeToken(expiredToken);
    mockBiometricAuth.mockResolvedValue({ success: true });
    
    const result = await autoLoginManager.attemptAutoLogin();
    expect(result.success).toBe(true);
    expect(result.method).toBe('biometric');
  });
  
  it('should fail gracefully when all methods fail', async () => {
    mockBiometricAuth.mockRejectedValue(new Error('Not available'));
    
    const result = await autoLoginManager.attemptAutoLogin();
    expect(result.success).toBe(false);
    expect(result.requiresUserAction).toBe(true);
  });
});
```

### 2. 認証ガードテスト

```typescript
describe('Authentication Guard', () => {
  it('should allow access to public routes', async () => {
    const result = await authGuard.checkAccess('/public');
    expect(result.allowed).toBe(true);
  });
  
  it('should deny access to protected routes when unauthenticated', async () => {
    const result = await authGuard.checkAccess('/protected');
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/login');
  });
  
  it('should check permissions for restricted routes', async () => {
    const user = createMockUser(['read']);
    const result = await authGuard.checkAccess('/admin', user);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('permission');
  });
});
```

### 3. ログアウトテスト

```typescript
describe('Logout Flow', () => {
  it('should logout successfully with confirmation', async () => {
    mockConfirmation.mockResolvedValue(true);
    
    const result = await logoutManager.logout();
    expect(result.success).toBe(true);
    expect(result.clearedData).toContain('tokens');
  });
  
  it('should force logout without confirmation', async () => {
    const result = await logoutManager.forceLogout('security');
    expect(result.success).toBe(true);
    expect(result.method).toBe('force');
  });
});
```

## Implementation Plan

### Phase 1: 自動ログイン実装 (2-3日)
1. AutoLoginManagerクラス実装
2. SessionRestoreServiceクラス実装
3. トークン検証・復元機能
4. 生体認証統合

### Phase 2: 認証ガード実装 (2-3日)
1. AuthGuardクラス実装
2. ProtectedRouteコンポーネント
3. 権限チェック機能
4. リダイレクト処理

### Phase 3: ログアウト管理 (1-2日)
1. LogoutManagerクラス実装
2. AccountDeletionServiceクラス実装
3. 確認ダイアログ
4. データクリーンアップ

### Phase 4: エラーハンドリング (1-2日)
1. AuthErrorHandlerクラス実装
2. ErrorRecoveryServiceクラス実装
3. ユーザーフレンドリーメッセージ
4. 復旧オプション

### Phase 5: 状態管理統合 (1-2日)
1. AuthStateManagerクラス実装
2. React Context統合
3. 状態同期機能
4. パフォーマンス最適化

### Phase 6: 統合テスト (1-2日)
1. 全フロー統合テスト
2. エラーケーステスト
3. パフォーマンステスト
4. セキュリティテスト

## Integration Points

### React Navigation統合
```typescript
// 認証ガードをナビゲーションに統合
const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AuthenticatedStack />
      ) : (
        <UnauthenticatedStack />
      )}
    </NavigationContainer>
  );
};
```

### Redux統合
```typescript
// 認証状態をReduxと同期
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState: (state, action) => {
      return { ...state, ...action.payload };
    },
    clearAuthState: () => initialState,
  },
});
```

## Security Considerations

- **自動ログイン**: 生体認証必須、デバイス固有情報確認
- **認証ガード**: 最小権限原則、定期的な権限チェック
- **ログアウト**: 完全なデータクリーンアップ、セッション無効化
- **エラー処理**: 機密情報の漏洩防止、ログ記録