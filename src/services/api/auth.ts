import { HttpClient } from './httpClient';
import { FeatureFlagsManager } from '../featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LoginRequest {
  maternalBookNumber: string;
  nickname: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nickname: string;
    createdAt: string;
  };
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_KEY = '@mamapace_auth_token';
const USER_KEY = '@mamapace_user';

export class AuthService {
  private httpClient: HttpClient;
  private featureFlags: FeatureFlagsManager;
  private static instance: AuthService;

  private constructor() {
    this.httpClient = HttpClient.getInstance();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('🔐 AuthService.login 開始');
      console.log('API有効:', this.featureFlags.isApiEnabled());
      console.log('ログインデータ:', data);
      
      if (!this.featureFlags.isApiEnabled()) {
        console.log('📱 モック認証を使用');
        return this.mockLogin(data);
      }

      console.log('🌐 実際のAPI認証を使用');
      const response = await this.httpClient.post<LoginResponse>('/auth/login', data);
      
      if (response.data.accessToken && response.data.refreshToken) {
        await this.saveTokens(response.data.accessToken, response.data.refreshToken);
        await this.saveUser(response.data.user);
      }

      return response.data;
    } catch (error) {
      console.error('💥 AuthService.login エラー:', error);
      console.error('エラータイプ:', typeof error);
      console.error('エラーメッセージ:', (error as any)?.message);
      throw error;
    }
  }

  private async mockLogin(data: LoginRequest): Promise<LoginResponse> {
    console.log('🎭 mockLogin 開始');
    console.log('遅延開始:', new Date().toISOString());
    
    await this.delay(1000);
    
    console.log('遅延完了:', new Date().toISOString());
    
    const mockResponse: LoginResponse = {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      user: {
        id: 'mock_user_' + Date.now(),
        nickname: data.nickname,
        createdAt: new Date().toISOString(),
      },
    };

    console.log('📦 モックレスポンス作成:', mockResponse);
    
    try {
      console.log('💾 トークン保存開始');
      await this.saveTokens(mockResponse.accessToken, mockResponse.refreshToken);
      console.log('✅ トークン保存完了');
      
      console.log('👤 ユーザー保存開始');
      await this.saveUser(mockResponse.user);
      console.log('✅ ユーザー保存完了');
    } catch (error) {
      console.error('💥 保存エラー:', error);
      throw error;
    }

    console.log('🎉 mockLogin 完了');
    return mockResponse;
  }

  public async logout(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      
      const authInterceptor = (this.httpClient.getAxiosInstance().interceptors.request as any).handlers?.find(
        (handler: any) => handler?.fulfilled?.name === 'addAuthToken'
      );
      if (authInterceptor) {
        this.httpClient.getAxiosInstance().interceptors.request.eject(authInterceptor as any);
      }
    } catch (error) {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.error('Logout error:', error);
      }
      throw error;
    }
  }

  public async getStoredTokens(): Promise<TokenData | null> {
    try {
      const tokenDataStr = await AsyncStorage.getItem(TOKEN_KEY);
      if (!tokenDataStr) {
        return null;
      }

      const tokenData: TokenData = JSON.parse(tokenDataStr);
      
      if (this.isTokenExpired(tokenData.expiresAt)) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        return null;
      }

      return tokenData;
    } catch (error) {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.error('Get stored tokens error:', error);
      }
      return null;
    }
  }

  public async getStoredUser(): Promise<any | null> {
    try {
      const userDataStr = await AsyncStorage.getItem(USER_KEY);
      return userDataStr ? JSON.parse(userDataStr) : null;
    } catch (error) {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.error('Get stored user error:', error);
      }
      return null;
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    const tokenData: TokenData = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };

    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    
    this.setupAuthInterceptor(accessToken);
  }

  private async saveUser(user: any): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private setupAuthInterceptor(token: string): void {
    const axiosInstance = this.httpClient.getAxiosInstance();
    
    axiosInstance.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private isTokenExpired(expiresAt: number): boolean {
    return Date.now() > expiresAt;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async checkAuthStatus(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    if (tokens) {
      this.setupAuthInterceptor(tokens.accessToken);
      return true;
    }
    return false;
  }
}