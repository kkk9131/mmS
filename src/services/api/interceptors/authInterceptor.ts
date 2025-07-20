import { AxiosResponse } from 'axios';
import { FeatureFlagsManager } from '../../featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class AuthInterceptor {
  private featureFlags: FeatureFlagsManager;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  public clearRefreshToken(): void {
    this.refreshToken = null;
  }

  public handle = (response: AxiosResponse): AxiosResponse => {
    return response;
  };

  public handleError = async (error: any): Promise<any> => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('Auth Interceptor: 401 error detected, attempting token refresh');
      }

      originalRequest._retry = true;

      try {
        const newToken = await this.refreshAuthToken();
        
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return Promise.resolve(originalRequest);
        }
      } catch (refreshError) {
        if (this.featureFlags.isDebugModeEnabled()) {
          console.error('Auth Interceptor: Token refresh failed', refreshError);
        }
        this.handleAuthenticationFailure();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  };

  private async refreshAuthToken(): Promise<string | null> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      this.isRefreshing = false;
      this.refreshPromise = null;
      return newToken;
    } catch (error) {
      this.isRefreshing = false;
      this.refreshPromise = null;
      throw error;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    try {
      const tokenDataStr = await AsyncStorage.getItem('@mamapace_auth_token');
      if (!tokenDataStr) {
        throw new Error('No stored token data');
      }

      const tokenData = JSON.parse(tokenDataStr);
      if (!tokenData.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.refreshToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken || tokenData.refreshToken;

      if (!newAccessToken) {
        throw new Error('No access token in refresh response');
      }

      // Update stored tokens
      const updatedTokenData = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      await AsyncStorage.setItem('@mamapace_auth_token', JSON.stringify(updatedTokenData));

      if (this.featureFlags.isDebugModeEnabled()) {
        console.log('Auth Interceptor: Token refreshed successfully');
      }

      this.onTokenRefreshed?.(newAccessToken);
      return newAccessToken;
    } catch (error) {
      if (this.featureFlags.isDebugModeEnabled()) {
        console.error('Auth Interceptor: Token refresh request failed', error);
      }
      throw error;
    }
  }

  private async handleAuthenticationFailure(): Promise<void> {
    if (this.featureFlags.isDebugModeEnabled()) {
      console.log('Auth Interceptor: Authentication failure, clearing tokens');
    }

    this.refreshToken = null;
    await AsyncStorage.multiRemove(['@mamapace_auth_token', '@mamapace_user']);
    this.onAuthenticationFailure?.();
  }

  public onTokenRefreshed?: (newToken: string) => void;
  public onAuthenticationFailure?: () => void;
}