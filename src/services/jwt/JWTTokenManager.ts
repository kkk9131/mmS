import { TokenPair, TokenConfig, JWTAuthError } from './types';
import { SecureTokenStorage } from './SecureTokenStorage';
import { JWTUtils } from './JWTUtils';

export class JWTTokenManager {
  private config: TokenConfig;
  private secureStorage: SecureTokenStorage;
  private refreshPromise: Promise<TokenPair> | null = null;

  constructor(config?: Partial<TokenConfig>) {
    this.config = {
      accessTokenExpiry: 60 * 60 * 1000, // 60分
      refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30日
      autoRefreshThreshold: 10 * 60 * 1000, // 10分前
      maxRetryAttempts: 3,
      ...config,
    };
    this.secureStorage = new SecureTokenStorage();
  }

  async storeTokens(tokens: TokenPair): Promise<void> {
    try {
      await Promise.all([
        this.secureStorage.setSecureItem('access_token', tokens.accessToken, {
          expiresAt: tokens.expiresAt,
        }),
        this.secureStorage.setSecureItem('refresh_token', tokens.refreshToken, {
          expiresAt: tokens.refreshExpiresAt,
          requiresBiometric: true, // リフレッシュトークンは生体認証必須
        }),
        this.secureStorage.setSecureItem('token_metadata', JSON.stringify({
          expiresAt: tokens.expiresAt.toISOString(),
          refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
          issuedAt: new Date().toISOString(),
        })),
      ]);
    } catch (error) {
      throw new JWTAuthError(
        `トークンの保存に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const token = await this.secureStorage.getSecureItem('access_token');
      if (!token) {
        return null;
      }

      // トークンの有効性をチェック
      if (this.isTokenExpired(token)) {
        console.warn('Access token expired, attempting refresh...');
        const newTokens = await this.refreshTokens();
        return newTokens.accessToken;
      }

      // 自動リフレッシュが必要かチェック
      if (this.shouldRefreshToken(token)) {
        // バックグラウンドでリフレッシュ
        this.refreshTokens().catch(error => {
          console.warn('Background token refresh failed:', error);
        });
      }

      return token;
    } catch (error) {
      throw new JWTAuthError(
        `アクセストークンの取得に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.secureStorage.getSecureItem('refresh_token');
    } catch (error) {
      if (error instanceof JWTAuthError && error.code === 'BIOMETRIC_ERROR') {
        throw error; // 生体認証エラーはそのまま伝播
      }
      throw new JWTAuthError(
        `リフレッシュトークンの取得に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async refreshTokens(): Promise<TokenPair> {
    // 既にリフレッシュ中の場合は同じPromiseを返す
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<TokenPair> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new JWTAuthError('リフレッシュトークンが見つかりません', 'TOKEN_INVALID');
      }

      if (this.isTokenExpired(refreshToken)) {
        throw new JWTAuthError('リフレッシュトークンが期限切れです', 'TOKEN_EXPIRED');
      }

      // Supabaseのトークンリフレッシュエンドポイントを呼び出し
      const newTokens = await this.callRefreshEndpoint(refreshToken);
      
      // 新しいトークンを保存
      await this.storeTokens(newTokens);
      
      return newTokens;
    } catch (error) {
      if (error instanceof JWTAuthError) {
        throw error;
      }
      throw new JWTAuthError(
        `トークンリフレッシュに失敗しました: ${error}`,
        'REFRESH_FAILED'
      );
    }
  }

  private async callRefreshEndpoint(refreshToken: string): Promise<TokenPair> {
    // 実際のSupabaseトークンリフレッシュAPIを呼び出し
    // 現在はモック実装
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.accessTokenExpiry);
    const refreshExpiresAt = new Date(now.getTime() + this.config.refreshTokenExpiry);

    return {
      accessToken: `new_access_token_${Date.now()}`,
      refreshToken: `new_refresh_token_${Date.now()}`,
      expiresAt,
      refreshExpiresAt,
    };
  }

  async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        this.secureStorage.removeSecureItem('access_token'),
        this.secureStorage.removeSecureItem('refresh_token'),
        this.secureStorage.removeSecureItem('token_metadata'),
      ]);
    } catch (error) {
      throw new JWTAuthError(
        `トークンのクリアに失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  isTokenExpired(token: string): boolean {
    return JWTUtils.isExpired(token);
  }

  shouldRefreshToken(token: string): boolean {
    return JWTUtils.isNearExpiry(token, this.config.autoRefreshThreshold / 1000);
  }

  validateTokenFormat(token: string): boolean {
    return JWTUtils.validateFormat(token);
  }

  decodeTokenPayload(token: string): any {
    try {
      return JWTUtils.decodePayload(token);
    } catch (error) {
      throw new JWTAuthError(
        `トークンのデコードに失敗しました: ${error}`,
        'TOKEN_INVALID'
      );
    }
  }

  async getTokenMetadata(): Promise<{
    expiresAt: Date;
    refreshExpiresAt: Date;
    issuedAt: Date;
  } | null> {
    try {
      const metadata = await this.secureStorage.getSecureItem('token_metadata');
      if (!metadata) {
        return null;
      }
      
      const parsed = JSON.parse(metadata);
      return {
        expiresAt: new Date(parsed.expiresAt),
        refreshExpiresAt: new Date(parsed.refreshExpiresAt),
        issuedAt: new Date(parsed.issuedAt),
      };
    } catch (error) {
      console.warn('Failed to get token metadata:', error);
      return null;
    }
  }

  getConfig(): TokenConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<TokenConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}