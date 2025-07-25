import { JWTAuthService } from './JWTAuthService';
import { SecureTokenStorage } from './SecureTokenStorage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  userId: string;
  lastActivity: Date;
  deviceFingerprint: string;
  sessionFlags: string[];
}

export interface SessionConfig {
  maxSessionAge: number; // セッションの最大有効期間（ミリ秒）
  maxInactivityTime: number; // 最大非アクティブ時間（ミリ秒）
  requireDeviceMatch: boolean; // デバイス一致の必須性
  enableSessionValidation: boolean; // セッション検証の有効性
}

export class SessionRestoreService {
  private jwtAuthService: JWTAuthService;
  private secureStorage: SecureTokenStorage;
  private config: SessionConfig;

  constructor(
    jwtAuthService?: JWTAuthService,
    config: SessionConfig = {
      maxSessionAge: 30 * 24 * 60 * 60 * 1000, // 30日
      maxInactivityTime: 7 * 24 * 60 * 60 * 1000, // 7日
      requireDeviceMatch: true,
      enableSessionValidation: true,
    }
  ) {
    this.jwtAuthService = jwtAuthService || new JWTAuthService();
    this.secureStorage = new SecureTokenStorage();
    this.config = config;
  }

  async saveSessionData(user: User): Promise<void> {
    try {
      console.log('Saving session data for user:', user.id);

      const sessionData: SessionData = {
        userId: user.id,
        lastActivity: new Date(),
        deviceFingerprint: await this.generateDeviceFingerprint(),
        sessionFlags: ['restored', 'active'],
      };

      // セッションデータを暗号化して保存
      await this.secureStorage.setSecureItem(
        'session_data',
        JSON.stringify({
          ...sessionData,
          lastActivity: sessionData.lastActivity.toISOString(),
        })
      );

      // ユーザー情報も保存
      await this.secureStorage.setSecureItem(
        'cached_user',
        JSON.stringify({
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        })
      );

      console.log('Session data saved successfully');
    } catch (error) {
      console.error('Failed to save session data:', error);
      
      // unknownエラーの型ガード
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error : 
                          'Unknown error occurred';
      
      throw new Error(`Session save failed: ${errorMessage}`);
    }
  }

  async restoreSession(): Promise<User | null> {
    try {
      console.log('Attempting to restore session...');

      // セッションデータを取得
      const sessionDataStr = await this.secureStorage.getSecureItem('session_data');
      if (!sessionDataStr) {
        console.log('No session data found');
        return null;
      }

      const sessionData: SessionData = {
        ...JSON.parse(sessionDataStr),
        lastActivity: new Date(JSON.parse(sessionDataStr).lastActivity),
      };

      // セッションの有効性を検証
      if (this.config.enableSessionValidation) {
        const isValid = await this.validateSession(sessionData);
        if (!isValid) {
          console.log('Session validation failed');
          await this.clearSessionData();
          return null;
        }
      }

      // キャッシュされたユーザー情報を取得
      const cachedUserStr = await this.secureStorage.getSecureItem('cached_user');
      if (!cachedUserStr) {
        console.log('No cached user data found');
        return null;
      }

      const cachedUser = JSON.parse(cachedUserStr);
      const user: User = {
        ...cachedUser,
        createdAt: new Date(cachedUser.createdAt),
        updatedAt: new Date(cachedUser.updatedAt),
      };

      // セッションデータの最終アクティビティを更新
      await this.updateLastActivity(sessionData);

      console.log('Session restored successfully for user:', user.id);
      return user;
    } catch (error) {
      console.error('Failed to restore session:', error);
      await this.clearSessionData();
      return null;
    }
  }

  async validateSession(sessionData: SessionData): Promise<boolean> {
    try {
      console.log('Validating session...');

      // セッションの期限切れチェック
      if (this.isSessionExpired(sessionData)) {
        console.log('Session expired');
        return false;
      }

      // デバイスフィンガープリントの一致確認
      if (this.config.requireDeviceMatch) {
        const currentFingerprint = await this.generateDeviceFingerprint();
        if (sessionData.deviceFingerprint !== currentFingerprint) {
          console.log('Device fingerprint mismatch');
          return false;
        }
      }

      // JWTトークンの存在と有効性確認
      const accessToken = await this.jwtAuthService.getAccessToken();
      const tokens = await this.jwtAuthService.getTokens();
      const refreshToken = tokens?.refreshToken;

      if (!accessToken || !refreshToken) {
        console.log('Missing tokens');
        return false;
      }

      // リフレッシュトークンの有効性確認（アクセストークンは期限切れでも可）
      if (refreshToken && await this.jwtAuthService.isTokenExpired(refreshToken)) {
        console.log('Refresh token expired');
        return false;
      }

      // セッションフラグの確認
      if (!sessionData.sessionFlags.includes('active')) {
        console.log('Session not active');
        return false;
      }

      console.log('Session validation passed');
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  async clearSessionData(): Promise<void> {
    try {
      console.log('Clearing session data...');

      await Promise.all([
        this.secureStorage.removeSecureItem('session_data'),
        this.secureStorage.removeSecureItem('cached_user'),
      ]);

      console.log('Session data cleared successfully');
    } catch (error) {
      console.error('Failed to clear session data:', error);
      
      // unknownエラーの型ガード
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error : 
                          'Unknown error occurred';
      
      throw new Error(`Session clear failed: ${errorMessage}`);
    }
  }

  private async generateDeviceFingerprint(): Promise<string> {
    try {
      // デバイス固有の情報を収集
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        // expo-device を使わずに基本情報のみ使用
        osName: Platform.OS,
        timestamp: Date.now(),
      };

      // デバイス情報をハッシュ化してフィンガープリントを生成
      const fingerprint = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify(deviceInfo),
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      return fingerprint;
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      // フォールバック：プラットフォーム情報のみ使用
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Platform.OS}-${Platform.Version}`,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    }
  }

  private isSessionExpired(sessionData: SessionData): boolean {
    const now = new Date();
    
    // 最大セッション期間の確認
    const sessionAge = now.getTime() - sessionData.lastActivity.getTime();
    if (sessionAge > this.config.maxSessionAge) {
      console.log('Session exceeded max age');
      return true;
    }

    // 非アクティブ時間の確認
    if (sessionAge > this.config.maxInactivityTime) {
      console.log('Session exceeded max inactivity time');
      return true;
    }

    return false;
  }

  private async updateLastActivity(sessionData: SessionData): Promise<void> {
    try {
      const updatedSessionData = {
        ...sessionData,
        lastActivity: new Date(),
      };

      await this.secureStorage.setSecureItem(
        'session_data',
        JSON.stringify({
          ...updatedSessionData,
          lastActivity: updatedSessionData.lastActivity.toISOString(),
        })
      );
    } catch (error) {
      console.warn('Failed to update last activity:', error);
      // エラーは無視して続行（セッション復元の妨げにしない）
    }
  }

  // セッション情報の取得
  async getSessionInfo(): Promise<SessionData | null> {
    try {
      const sessionDataStr = await this.secureStorage.getSecureItem('session_data');
      if (!sessionDataStr) {
        return null;
      }

      const sessionData = JSON.parse(sessionDataStr);
      return {
        ...sessionData,
        lastActivity: new Date(sessionData.lastActivity),
      };
    } catch (error) {
      console.error('Failed to get session info:', error);
      return null;
    }
  }

  // セッション設定の更新
  updateConfig(config: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // セッションの手動無効化
  async invalidateSession(): Promise<void> {
    try {
      const sessionData = await this.getSessionInfo();
      if (sessionData) {
        sessionData.sessionFlags = sessionData.sessionFlags.filter(flag => flag !== 'active');
        sessionData.sessionFlags.push('invalidated');

        await this.secureStorage.setSecureItem(
          'session_data',
          JSON.stringify({
            ...sessionData,
            lastActivity: sessionData.lastActivity.toISOString(),
          })
        );
      }
    } catch (error) {
      console.error('Failed to invalidate session:', error);
    }
  }
}