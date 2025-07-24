import React, { createContext, useContext, useState, useEffect } from 'react';
import { router } from 'expo-router';
import { AuthService } from '../services/api/auth';
import { FeatureFlagsManager } from '../services/featureFlags';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { signInWithMaternalBook, signOut, getCurrentUser } from '../store/slices/authSlice';
import { JWTAuthService, createJWTAuthService } from '../services/jwt';

interface User {
  id: string;
  nickname: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (maternalBookNumber: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  // JWT認証機能
  isBiometricEnabled: boolean;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<void>;
  getSecurityMetrics: () => any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const ReduxAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const featureFlags = FeatureFlagsManager.getInstance();

  useEffect(() => {
    if (!auth.isInitialized) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, auth.isInitialized]);

  const login = async (maternalBookNumber: string, nickname: string) => {
    await dispatch(signInWithMaternalBook({ maternalBookNumber, nickname } as any));
  };

  const logout = async () => {
    await dispatch(signOut());
    router.replace('/login');
  };

  const contextValue: AuthContextType = {
    user: auth.profile ? {
      id: auth.profile.id,
      nickname: auth.profile.nickname,
      createdAt: auth.profile.created_at || '',
    } : null,
    isLoading: auth.isLoading || !auth.isInitialized,
    isAuthenticated: auth.isAuthenticated,
    login,
    logout,
    // Redux版ではJWT機能は未実装
    isBiometricEnabled: false,
    enableBiometric: async () => false,
    disableBiometric: async () => {},
    authenticateWithBiometric: async () => { throw new Error('Redux版では生体認証は利用できません'); },
    getSecurityMetrics: () => ({}),
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

const JWTEnhancedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [jwtAuthService] = useState(() => createJWTAuthService());
  const featureFlags = FeatureFlagsManager.getInstance();

  const checkAuthStatus = React.useCallback(async () => {
    try {
      setIsLoading(true);
      
      // JWT認証サービス初期化
      await jwtAuthService.initialize();
      
      // 認証状態確認
      const authState = jwtAuthService.getAuthenticationState();
      
      if (authState.isAuthenticated && authState.user) {
        setUser({
          id: authState.user.id,
          nickname: authState.user.email?.split('@')[0] || 'Unknown',
          createdAt: new Date().toISOString(),
        });
        
        if (featureFlags.isDebugModeEnabled()) {
          console.log('JWT Auto-login successful');
        }
      }
      
      // 生体認証状態確認
      const biometricEnabled = await jwtAuthService.isBiometricEnabled();
      setIsBiometricEnabled(biometricEnabled);
      
    } catch (error) {
      if (featureFlags.isDebugModeEnabled()) {
        console.error('JWT Auto-login failed:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jwtAuthService, featureFlags]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (maternalBookNumber: string, nickname: string) => {
    try {
      setIsLoading(true);
      
      // JWTサービスを使用した認証
      const authState = await jwtAuthService.authenticateWithCredentials(
        `${maternalBookNumber}@mamapace.app`, // 母子手帳番号をメール形式に変換
        maternalBookNumber, // パスワードとしても使用
        false // デフォルトでは生体認証は無効
      );
      
      if (authState.isAuthenticated && authState.user) {
        setUser({
          id: authState.user.id,
          nickname,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('JWT Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await jwtAuthService.logout();
      setUser(null);
      setIsBiometricEnabled(false);
      router.replace('/login');
    } catch (error) {
      console.error('JWT Logout failed:', error);
      // エラーが発生してもUIはログアウト状態にする
      setUser(null);
      setIsBiometricEnabled(false);
      router.replace('/login');
    }
  };

  const enableBiometric = async (): Promise<boolean> => {
    try {
      const success = await jwtAuthService.enableBiometric();
      setIsBiometricEnabled(success);
      return success;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  };

  const disableBiometric = async (): Promise<void> => {
    try {
      await jwtAuthService.disableBiometric();
      setIsBiometricEnabled(false);
    } catch (error) {
      console.error('Failed to disable biometric:', error);
    }
  };

  const authenticateWithBiometric = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const authState = await jwtAuthService.authenticateWithBiometric();
      
      if (authState.isAuthenticated && authState.user) {
        setUser({
          id: authState.user.id,
          nickname: authState.user.email?.split('@')[0] || 'Unknown',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getSecurityMetrics = () => {
    return jwtAuthService.getSecurityMetrics();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        isBiometricEnabled,
        enableBiometric,
        disableBiometric,
        authenticateWithBiometric,
        getSecurityMetrics,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const LegacyAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authService = AuthService.getInstance();
  const featureFlags = FeatureFlagsManager.getInstance();

  const checkAuthStatus = React.useCallback(async () => {
    try {
      const hasValidToken = await authService.checkAuthStatus();
      
      if (hasValidToken) {
        const storedUser = await authService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          if (featureFlags.isDebugModeEnabled()) {
            console.log('Auto-login successful');
          }
        }
      }
    } catch (error) {
      if (featureFlags.isDebugModeEnabled()) {
        console.error('Auto-login failed:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [authService, featureFlags]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (maternalBookNumber: string, nickname: string) => {
    const response = await authService.login({ maternalBookNumber, nickname });
    setUser(response.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        // JWT機能のフォールバック
        isBiometricEnabled: false,
        enableBiometric: async () => false,
        disableBiometric: async () => {},
        authenticateWithBiometric: async () => { throw new Error('生体認証は利用できません'); },
        getSecurityMetrics: () => ({}),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  try {
    const featureFlags = FeatureFlagsManager.getInstance();
    const isReduxEnabled = featureFlags.isReduxEnabled();
    const isJWTEnabled = true; // デフォルトで有効（featureFlagsのメソッドが未実装のため）

    if (isReduxEnabled) {
      return <ReduxAuthProvider>{children}</ReduxAuthProvider>;
    }

    if (isJWTEnabled) {
      return <JWTEnhancedAuthProvider>{children}</JWTEnhancedAuthProvider>;
    }

    return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
  } catch (error) {
    console.error('AuthProvider初期化エラー:', error);
    // フォールバック: 最小限のコンテキストを提供
    const fallbackValue: AuthContextType = {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: async () => {},
      logout: async () => {},
      isBiometricEnabled: false,
      enableBiometric: async () => false,
      disableBiometric: async () => {},
      authenticateWithBiometric: async () => { throw new Error('認証システムエラー'); },
      getSecurityMetrics: () => ({}),
    };
    
    return (
      <AuthContext.Provider value={fallbackValue}>
        {children}
      </AuthContext.Provider>
    );
  }
};