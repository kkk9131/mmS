import { JWTAuthService } from './JWTAuthService';
import { AutoLoginManager, AutoLoginResult } from './AutoLoginManager';
import { LogoutManager } from './LogoutManager';
import { AuthErrorHandler } from './AuthErrorHandler';
import { ErrorRecoveryService } from './ErrorRecoveryService';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: User | null;
  permissions: string[];
  sessionInfo: SessionInfo;
  lastActivity: Date;
  error: AuthError | null;
  autoLoginResult?: AutoLoginResult;
}

export interface SessionInfo {
  loginMethod: 'password' | 'biometric' | 'token' | 'auto';
  loginTime: Date;
  expiresAt: Date;
  deviceId: string;
  sessionId: string;
}

export interface AuthError {
  code: string;
  message: string;
  recoverable: boolean;
  timestamp: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<boolean>;
}

export type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: { user: User; sessionInfo: SessionInfo } }
  | { type: 'SET_UNAUTHENTICATED' }
  | { type: 'SET_ERROR'; payload: AuthError }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'UPDATE_PERMISSIONS'; payload: string[] }
  | { type: 'UPDATE_LAST_ACTIVITY' }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_AUTO_LOGIN_RESULT'; payload: AutoLoginResult };

export type AuthStateListener = (state: AuthState) => void;

export class AuthStateManager {
  private state: AuthState;
  private listeners: AuthStateListener[] = [];
  private jwtAuthService: JWTAuthService;
  private autoLoginManager: AutoLoginManager;
  private logoutManager: LogoutManager;
  private errorHandler: AuthErrorHandler;
  private recoveryService: ErrorRecoveryService;
  private initializationPromise?: Promise<void>;

  constructor(
    jwtAuthService?: JWTAuthService,
    autoLoginManager?: AutoLoginManager,
    logoutManager?: LogoutManager,
    errorHandler?: AuthErrorHandler,
    recoveryService?: ErrorRecoveryService
  ) {
    this.jwtAuthService = jwtAuthService || new JWTAuthService();
    this.autoLoginManager = autoLoginManager || new AutoLoginManager();
    this.logoutManager = logoutManager || new LogoutManager();
    this.errorHandler = errorHandler || new AuthErrorHandler();
    this.recoveryService = recoveryService || new ErrorRecoveryService();

    this.state = this.getInitialState();
    this.setupActivityTracking();
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('Initializing auth state manager...');
      this.dispatch({ type: 'SET_LOADING', payload: true });

      // 自動ログインを試行
      const autoLoginResult = await this.autoLoginManager.attemptAutoLogin();
      this.dispatch({ type: 'SET_AUTO_LOGIN_RESULT', payload: autoLoginResult });

      if (autoLoginResult.success && autoLoginResult.user) {
        const sessionInfo: SessionInfo = {
          loginMethod: autoLoginResult.method as 'token' | 'biometric' | 'auto',
          loginTime: new Date(),
          expiresAt: await this.getTokenExpiryDate(),
          deviceId: await this.getDeviceId(),
          sessionId: this.generateSessionId(),
        };

        this.dispatch({
          type: 'SET_AUTHENTICATED',
          payload: {
            user: autoLoginResult.user,
            sessionInfo,
          },
        });

        await this.loadUserPermissions(autoLoginResult.user);
      } else {
        this.dispatch({ type: 'SET_UNAUTHENTICATED' });
      }

      this.dispatch({ type: 'SET_INITIALIZED', payload: true });
      console.log('Auth state manager initialized successfully');

    } catch (error) {
      console.error('Auth state manager initialization failed:', error);
      this.handleError(error as Error, 'initialization');
    } finally {
      this.dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  getState(): AuthState {
    return { ...this.state };
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.push(listener);
    
    // 初回呼び出し
    listener(this.getState());

    // アンサブスクライブ関数を返す
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  dispatch(action: AuthAction): void {
    console.log('Auth action dispatched:', action.type);
    const previousState = { ...this.state };
    this.state = this.reducer(this.state, action);
    
    // 状態変更があった場合のみリスナーに通知
    if (this.hasStateChanged(previousState, this.state)) {
      this.notifyListeners();
    }
  }

  // 認証アクション
  async login(credentials: LoginCredentials): Promise<void> {
    try {
      this.dispatch({ type: 'SET_LOADING', payload: true });
      this.dispatch({ type: 'CLEAR_ERROR' });

      console.log('Attempting login for:', credentials.email);

      // JWTAuthServiceを使用してログイン
      const result = await this.jwtAuthService.login(credentials.email, credentials.password);
      
      if (result.success && result.user) {
        const sessionInfo: SessionInfo = {
          loginMethod: 'password',
          loginTime: new Date(),
          expiresAt: await this.getTokenExpiryDate(),
          deviceId: await this.getDeviceId(),
          sessionId: this.generateSessionId(),
        };

        this.dispatch({
          type: 'SET_AUTHENTICATED',
          payload: {
            user: result.user,
            sessionInfo,
          },
        });

        await this.loadUserPermissions(result.user);
        console.log('Login successful');
      } else {
        throw new Error('Login failed');
      }

    } catch (error) {
      console.error('Login error:', error);
      this.handleError(error as Error, 'login');
    } finally {
      this.dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  async logout(): Promise<void> {
    try {
      this.dispatch({ type: 'SET_LOADING', payload: true });
      console.log('Attempting logout...');

      const result = await this.logoutManager.logout('user');
      
      if (result.success) {
        this.dispatch({ type: 'SET_UNAUTHENTICATED' });
        console.log('Logout successful');
      } else {
        throw new Error(result.error || 'Logout failed');
      }

    } catch (error) {
      console.error('Logout error:', error);
      this.handleError(error as Error, 'logout');
      // ログアウトエラーでも強制的に未認証状態にする
      this.dispatch({ type: 'SET_UNAUTHENTICATED' });
    } finally {
      this.dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  async refresh(): Promise<void> {
    try {
      console.log('Refreshing auth state...');
      
      await this.jwtAuthService.refreshTokens();
      this.dispatch({ type: 'UPDATE_LAST_ACTIVITY' });
      
      // セッション情報を更新
      if (this.state.user) {
        const updatedSessionInfo: SessionInfo = {
          ...this.state.sessionInfo,
          expiresAt: await this.getTokenExpiryDate(),
        };

        this.dispatch({
          type: 'SET_AUTHENTICATED',
          payload: {
            user: this.state.user,
            sessionInfo: updatedSessionInfo,
          },
        });
      }

      console.log('Auth refresh successful');

    } catch (error) {
      console.error('Auth refresh error:', error);
      this.handleError(error as Error, 'refresh');
    }
  }

  updateUser(userUpdates: Partial<User>): void {
    console.log('Updating user:', userUpdates);
    this.dispatch({ type: 'UPDATE_USER', payload: userUpdates });
  }

  clearError(): void {
    this.dispatch({ type: 'CLEAR_ERROR' });
  }

  async enableBiometric(): Promise<boolean> {
    try {
      console.log('Enabling biometric authentication...');
      const result = await this.jwtAuthService.enableBiometric();
      return result;
    } catch (error) {
      console.error('Enable biometric error:', error);
      this.handleError(error as Error, 'enable_biometric');
      return false;
    }
  }

  async disableBiometric(): Promise<boolean> {
    try {
      console.log('Disabling biometric authentication...');
      await this.jwtAuthService.disableBiometric();
      return true;
    } catch (error) {
      console.error('Disable biometric error:', error);
      this.handleError(error as Error, 'disable_biometric');
      return false;
    }
  }

  // プライベートメソッド
  private reducer(state: AuthState, action: AuthAction): AuthState {
    switch (action.type) {
      case 'SET_LOADING':
        return { ...state, isLoading: action.payload };

      case 'SET_AUTHENTICATED':
        return {
          ...state,
          isAuthenticated: true,
          user: action.payload.user,
          sessionInfo: action.payload.sessionInfo,
          error: null,
          lastActivity: new Date(),
        };

      case 'SET_UNAUTHENTICATED':
        return {
          ...state,
          isAuthenticated: false,
          user: null,
          permissions: [],
          sessionInfo: this.getEmptySessionInfo(),
          error: null,
        };

      case 'SET_ERROR':
        return { ...state, error: action.payload, isLoading: false };

      case 'CLEAR_ERROR':
        return { ...state, error: null };

      case 'UPDATE_USER':
        if (!state.user) return state;
        return {
          ...state,
          user: { ...state.user, ...action.payload },
        };

      case 'UPDATE_PERMISSIONS':
        return { ...state, permissions: action.payload };

      case 'UPDATE_LAST_ACTIVITY':
        return { ...state, lastActivity: new Date() };

      case 'SET_INITIALIZED':
        return { ...state, isInitialized: action.payload };

      case 'SET_AUTO_LOGIN_RESULT':
        return { ...state, autoLoginResult: action.payload };

      default:
        return state;
    }
  }

  private getInitialState(): AuthState {
    return {
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      user: null,
      permissions: [],
      sessionInfo: this.getEmptySessionInfo(),
      lastActivity: new Date(),
      error: null,
    };
  }

  private getEmptySessionInfo(): SessionInfo {
    return {
      loginMethod: 'password',
      loginTime: new Date(),
      expiresAt: new Date(),
      deviceId: '',
      sessionId: '',
    };
  }

  private async handleError(error: Error, context: string): Promise<void> {
    const errorResult = this.errorHandler.handleAuthError(error, context);
    
    const authError: AuthError = {
      code: (error as any).code || 'UNKNOWN_ERROR',
      message: errorResult.userMessage,
      recoverable: errorResult.shouldRetry || false,
      timestamp: new Date(),
    };

    this.dispatch({ type: 'SET_ERROR', payload: authError });

    // 自動復旧を試行
    if (errorResult.shouldRetry) {
      try {
        const recoveryResult = await this.recoveryService.attemptAutoRecovery(error);
        if (recoveryResult.success) {
          this.dispatch({ type: 'CLEAR_ERROR' });
          console.log('Auto recovery successful');
        }
      } catch (recoveryError) {
        console.error('Auto recovery failed:', recoveryError);
      }
    }

    // ログアウトが必要な場合
    if (errorResult.shouldLogout) {
      console.log('Error requires logout, forcing logout...');
      await this.logoutManager.forceLogout(context);
      this.dispatch({ type: 'SET_UNAUTHENTICATED' });
    }
  }

  private async loadUserPermissions(user: User): Promise<void> {
    try {
      // ユーザーの権限を取得（モック実装）
      const permissions = await this.getUserPermissions(user);
      this.dispatch({ type: 'UPDATE_PERMISSIONS', payload: permissions });
    } catch (error) {
      console.warn('Failed to load user permissions:', error);
    }
  }

  private async getUserPermissions(user: User): Promise<string[]> {
    // モック実装：実際のアプリではAPIから取得
    const userRole = (user as any).role || 'user';
    const permissionMap: Record<string, string[]> = {
      user: ['read'],
      premium: ['read', 'write'],
      moderator: ['read', 'write', 'moderate'],
      admin: ['read', 'write', 'moderate', 'admin'],
    };

    return permissionMap[userRole] || ['read'];
  }

  private async getTokenExpiryDate(): Promise<Date> {
    try {
      const accessToken = await this.jwtAuthService.getAccessToken();
      if (accessToken) {
        // JWTから有効期限を取得
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        return new Date(payload.exp * 1000);
      }
    } catch (error) {
      console.warn('Failed to get token expiry:', error);
    }
    
    // デフォルト：1時間後
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);
    return expiryDate;
  }

  private async getDeviceId(): Promise<string> {
    // デバイスIDの取得（モック実装）
    return 'mock_device_id';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupActivityTracking(): void {
    // アクティビティの定期的な更新
    setInterval(() => {
      if (this.state.isAuthenticated) {
        this.dispatch({ type: 'UPDATE_LAST_ACTIVITY' });
      }
    }, 60000); // 1分間隔
  }

  private hasStateChanged(prev: AuthState, current: AuthState): boolean {
    // 簡単な変更検知（より詳細な比較が必要な場合は実装を拡張）
    return (
      prev.isAuthenticated !== current.isAuthenticated ||
      prev.isLoading !== current.isLoading ||
      prev.isInitialized !== current.isInitialized ||
      prev.user?.id !== current.user?.id ||
      prev.error !== current.error
    );
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Auth state listener error:', error);
      }
    });
  }

  // クリーンアップ
  destroy(): void {
    this.listeners = [];
    console.log('Auth state manager destroyed');
  }

  // 開発/デバッグ用メソッド
  getDebugInfo(): any {
    return {
      state: this.getState(),
      listenerCount: this.listeners.length,
      isInitialized: this.state.isInitialized,
    };
  }
}