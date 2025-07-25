import { JWTTokenManager } from './JWTTokenManager';
import { TokenValidator } from './TokenValidator';
import { AutoRefreshService } from './AutoRefreshService';
import { BiometricAuthManager } from './BiometricAuthManager';
import { TokenSecurityMonitor } from './TokenSecurityMonitor';
import { TokenPair, TokenConfig, AuthenticationState, JWTAuthError } from './types';
import { JWTUtils } from './JWTUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface JWTAuthConfig {
  tokenConfig: Partial<TokenConfig>;
  enableBiometric: boolean;
  enableAutoRefresh: boolean;
  enableSecurityMonitoring: boolean;
  deviceId: string;
}

export class JWTAuthService {
  private tokenManager: JWTTokenManager;
  private validator: TokenValidator;
  private autoRefreshService: AutoRefreshService;
  private biometricManager: BiometricAuthManager;
  private securityMonitor: TokenSecurityMonitor;
  private config: JWTAuthConfig;
  private currentUser: any = null;

  constructor(config: Partial<JWTAuthConfig> = {}) {
    this.config = {
      tokenConfig: {
        accessTokenExpiry: 60 * 60 * 1000, // 60分
        refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30日
        autoRefreshThreshold: 10 * 60 * 1000, // 10分前
        maxRetryAttempts: 3,
      },
      enableBiometric: true,
      enableAutoRefresh: true,
      enableSecurityMonitoring: true,
      deviceId: this.generateDeviceId(),
      ...config,
    };

    // コンポーネント初期化
    this.tokenManager = new JWTTokenManager(this.config.tokenConfig);
    this.validator = new TokenValidator();
    this.autoRefreshService = new AutoRefreshService(this.tokenManager);
    this.biometricManager = new BiometricAuthManager();
    this.securityMonitor = new TokenSecurityMonitor(this.config.deviceId);

    this.setupSecurityMonitoring();
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing JWT Auth Service...');

      // 既存のトークンを確認
      const existingTokens = await this.checkExistingTokens();
      if (existingTokens) {
        console.log('Found existing valid tokens');
        await this.loadUserFromToken(existingTokens.accessToken);
      }

      // 自動リフレッシュサービス開始
      if (this.config.enableAutoRefresh) {
        this.autoRefreshService.startAutoRefresh();
      }

      // 生体認証の可用性確認
      if (this.config.enableBiometric) {
        const biometricInfo = await this.biometricManager.getBiometricInfo();
        console.log('Biometric availability:', biometricInfo);
      }

      console.log('JWT Auth Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize JWT Auth Service:', error);
      throw new JWTAuthError(
        `認証サービスの初期化に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async authenticateWithCredentials(
    email: string, 
    password: string,
    enableBiometric: boolean = false
  ): Promise<AuthenticationState> {
    try {
      // Supabase認証API呼び出し（既存実装を利用）
      const authResult = await this.callSupabaseAuth(email, password);
      
      // トークンペアの作成
      const tokens = this.createTokenPair(authResult);
      
      // セキュアストレージに保存
      await this.tokenManager.storeTokens(tokens);
      
      // ユーザー情報設定
      this.currentUser = authResult.user;
      
      // 生体認証有効化
      if (enableBiometric && this.config.enableBiometric) {
        try {
          await this.biometricManager.enableBiometric();
          await AsyncStorage.setItem('biometric_enabled', 'true');
        } catch (error) {
          console.warn('Failed to enable biometric auth:', error);
        }
      }

      // セキュリティログ
      this.securityMonitor.logSecurityEvent({
        type: 'token_refresh',
        timestamp: new Date(),
        userId: this.currentUser?.id,
        deviceId: this.config.deviceId,
        details: { source: 'login', method: 'credentials' },
      });

      return this.getAuthenticationState();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.securityMonitor.logSecurityEvent({
        type: 'token_validation_failed',
        timestamp: new Date(),
        deviceId: this.config.deviceId,
        details: { source: 'login', error: errorMessage },
      });

      throw new JWTAuthError(
        `認証に失敗しました: ${errorMessage}`,
        'TOKEN_INVALID'
      );
    }
  }

  async authenticateWithBiometric(): Promise<AuthenticationState> {
    try {
      if (!this.config.enableBiometric) {
        throw new JWTAuthError('生体認証が無効です', 'BIOMETRIC_ERROR');
      }

      // 生体認証実行
      const biometricResult = await this.biometricManager.authenticate(
        'ママパースにアクセスするため認証してください'
      );

      if (!biometricResult.success) {
        throw new JWTAuthError(
          biometricResult.error || '生体認証に失敗しました',
          'BIOMETRIC_ERROR'
        );
      }

      // 保存されたトークンを取得
      const accessToken = await this.tokenManager.getAccessToken();
      if (!accessToken) {
        throw new JWTAuthError('保存されたトークンが見つかりません', 'TOKEN_INVALID');
      }

      // ユーザー情報を読み込み
      await this.loadUserFromToken(accessToken);

      // セキュリティログ
      this.securityMonitor.logSecurityEvent({
        type: 'token_refresh',
        timestamp: new Date(),
        userId: this.currentUser?.id,
        deviceId: this.config.deviceId,
        details: { source: 'biometric', type: biometricResult.biometricType },
      });

      return this.getAuthenticationState();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.securityMonitor.logSecurityEvent({
        type: 'token_validation_failed',
        timestamp: new Date(),
        deviceId: this.config.deviceId,
        details: { source: 'biometric', error: errorMessage },
      });

      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      // セキュリティログ
      this.securityMonitor.logSecurityEvent({
        type: 'suspicious_activity',
        timestamp: new Date(),
        userId: this.currentUser?.id,
        deviceId: this.config.deviceId,
        details: { source: 'logout', action: 'user_initiated' },
      });

      // 自動リフレッシュ停止
      this.autoRefreshService.stopAutoRefresh();

      // トークンクリア
      await this.tokenManager.clearTokens();

      // ユーザー情報クリア
      this.currentUser = null;

      console.log('Logout completed');
    } catch (error) {
      console.error('Error during logout:', error);
      throw new JWTAuthError(
        `ログアウトに失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async refreshTokens(): Promise<TokenPair> {
    try {
      const tokens = await this.tokenManager.refreshTokens();
      
      // セキュリティログ
      this.securityMonitor.logSecurityEvent({
        type: 'token_refresh',
        timestamp: new Date(),
        userId: this.currentUser?.id,
        deviceId: this.config.deviceId,
        details: { source: 'manual_refresh' },
      });

      return tokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.securityMonitor.logSecurityEvent({
        type: 'token_validation_failed',
        timestamp: new Date(),
        userId: this.currentUser?.id,
        deviceId: this.config.deviceId,
        details: { source: 'manual_refresh', error: errorMessage },
      });

      throw error;
    }
  }

  async getValidAccessToken(): Promise<string | null> {
    try {
      return await this.tokenManager.getAccessToken();
    } catch (error) {
      if (error instanceof JWTAuthError && error.code === 'BIOMETRIC_ERROR') {
        // 生体認証が必要な場合の処理
        throw error;
      }
      console.error('Error getting access token:', error);
      return null;
    }
  }

  getAuthenticationState(): AuthenticationState {
    return {
      isAuthenticated: this.currentUser !== null,
      user: this.currentUser,
      tokens: null, // セキュリティのため直接公開しない
      lastRefresh: null, // 実装で管理
      biometricEnabled: this.config.enableBiometric,
      autoRefreshEnabled: this.config.enableAutoRefresh,
    };
  }

  // Public methods for token management
  async getAccessToken(): Promise<string | null> {
    try {
      const token = await this.tokenManager.getAccessToken();
      if (!token) {
        return null;
      }

      // トークンの有効性を確認
      const validationResult = this.validator.validateAccessToken(token);
      if (!validationResult.isValid) {
        console.warn('Access token is invalid:', validationResult.errors);
        return null;
      }

      return token;
    } catch (error) {
      if (error instanceof JWTAuthError && error.code === 'BIOMETRIC_ERROR') {
        // 生体認証が必要な場合の処理
        throw error;
      }
      console.error('Error getting access token:', error);
      return null;
    }
  }

  async login(email: string, password: string): Promise<AuthenticationState> {
    return this.authenticateWithCredentials(email, password);
  }

  async isTokenExpired(token?: string): Promise<boolean> {
    try {
      const accessToken = token || await this.tokenManager.getAccessToken();
      if (!accessToken) {
        return true;
      }
      const validationResult = this.validator.validateAccessToken(accessToken);
      return !validationResult.isValid;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }

  async storeTokens(tokens: TokenPair): Promise<void> {
    await this.tokenManager.storeTokens(tokens);
  }

  async getTokens(): Promise<TokenPair | null> {
    try {
      const accessToken = await this.tokenManager.getAccessToken();
      const refreshToken = await this.tokenManager.getRefreshToken();
      
      if (!accessToken || !refreshToken) {
        return null;
      }
      
      return {
        accessToken,
        refreshToken,
        expiresAt: new Date(),
        refreshExpiresAt: new Date()
      };
    } catch (error) {
      console.error('Error getting tokens:', error);
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();
  }

  async createMockJWT(payload: any, expiresIn: number): Promise<string> {
    return JWTUtils.createMockJWT(payload, expiresIn);
  }

  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem('biometric_enabled');
      return enabled === 'true' && this.config.enableBiometric;
    } catch (error) {
      return false;
    }
  }

  async enableBiometric(): Promise<boolean> {
    try {
      const success = await this.biometricManager.enableBiometric();
      if (success) {
        await AsyncStorage.setItem('biometric_enabled', 'true');
      }
      return success;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  }

  async disableBiometric(): Promise<void> {
    try {
      await this.biometricManager.disableBiometric();
      await AsyncStorage.setItem('biometric_enabled', 'false');
    } catch (error) {
      console.error('Failed to disable biometric:', error);
    }
  }

  getSecurityMetrics() {
    return this.securityMonitor.getSecurityMetrics();
  }

  getSecurityAlerts() {
    return this.securityMonitor.getActiveAlerts();
  }

  private async checkExistingTokens(): Promise<TokenPair | null> {
    try {
      const accessToken = await this.tokenManager.getAccessToken();
      if (!accessToken) {
        return null;
      }

      // トークンの検証
      const validationResult = this.validator.validateAccessToken(accessToken);
      if (!validationResult.isValid) {
        console.warn('Existing token is invalid:', validationResult.errors);
        return null;
      }

      const refreshToken = await this.tokenManager.getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const metadata = await this.tokenManager.getTokenMetadata();
      if (!metadata) {
        return null;
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: metadata.expiresAt,
        refreshExpiresAt: metadata.refreshExpiresAt,
      };
    } catch (error) {
      console.warn('Error checking existing tokens:', error);
      return null;
    }
  }

  private async loadUserFromToken(accessToken: string): Promise<void> {
    try {
      const payload = this.tokenManager.decodeTokenPayload(accessToken);
      // ユーザー情報をペイロードから抽出またはAPIで取得
      this.currentUser = {
        id: payload.sub,
        email: payload.email,
        // その他のユーザー情報
      };
    } catch (error) {
      console.error('Failed to load user from token:', error);
      throw new JWTAuthError('ユーザー情報の読み込みに失敗しました', 'TOKEN_INVALID');
    }
  }

  public async createMockTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = await JWTUtils.createMockJWT({
      sub: userId,
      email: 'mock@example.com',
      scope: ['read', 'write'],
      token_type: 'access',
    }, 60 * 60);

    const refreshToken = await JWTUtils.createMockJWT({
      sub: userId,
      token_type: 'refresh',
      jti: `refresh_${Date.now()}`,
    }, 30 * 24 * 60 * 60);

    const now = new Date();
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(now.getTime() + this.config.tokenConfig.accessTokenExpiry!),
      refreshExpiresAt: new Date(now.getTime() + this.config.tokenConfig.refreshTokenExpiry!),
    };
  }

  private createTokenPair(authResult: any): TokenPair {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.tokenConfig.accessTokenExpiry!);
    const refreshExpiresAt = new Date(now.getTime() + this.config.tokenConfig.refreshTokenExpiry!);

    return {
      accessToken: authResult.access_token,
      refreshToken: authResult.refresh_token,
      expiresAt,
      refreshExpiresAt,
    };
  }

  private async callSupabaseAuth(email: string, password: string): Promise<any> {
    // 既存のSupabase認証実装を呼び出し
    // 実装では、実際のSupabaseクライアントを使用
    console.log('Calling Supabase auth...');
    
    // モック実装（実際の実装で置き換え）
    const accessToken = await JWTUtils.createMockJWT({
      sub: 'user_123',
      email,
      scope: ['read', 'write'],
      token_type: 'access',
    }, 60 * 60); // 60分

    const refreshToken = await JWTUtils.createMockJWT({
      sub: 'user_123',
      email,
      token_type: 'refresh',
      jti: `refresh_${Date.now()}`,
    }, 30 * 24 * 60 * 60); // 30日

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: 'user_123',
        email,
      },
    };
  }

  private setupSecurityMonitoring(): void {
    if (!this.config.enableSecurityMonitoring) {
      return;
    }

    // 自動リフレッシュイベントの監視
    this.autoRefreshService.addRefreshListener((event) => {
      this.securityMonitor.logSecurityEvent({
        type: event.type === 'success' ? 'token_refresh' : 'token_validation_failed',
        timestamp: event.timestamp,
        userId: this.currentUser?.id,
        deviceId: this.config.deviceId,
        details: { source: 'auto_refresh', reason: event.reason },
      });
    });

    // セキュリティアラートの処理
    this.securityMonitor.addAlertCallback((alert) => {
      console.warn(`Security Alert [${alert.level}]: ${alert.message}`);
      
      if (alert.level === 'critical' && alert.actionRequired) {
        // 重大なアラートの場合は自動ログアウト
        console.error('Critical security alert, forcing logout');
        this.logout().catch(error => {
          console.error('Failed to logout on security alert:', error);
        });
      }
    });
  }

  private generateDeviceId(): string {
    // デバイス固有IDの生成（実装では、expo-device等を使用）
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // クリーンアップ
  dispose(): void {
    this.autoRefreshService.dispose();
  }
}