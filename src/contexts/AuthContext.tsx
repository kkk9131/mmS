import React, { createContext, useContext, useState, useEffect } from 'react';
import { router } from 'expo-router';
import { AuthService } from '../services/api/auth';
import { FeatureFlagsManager } from '../services/featureFlags';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { signInWithMaternalBook, signOut, getCurrentUser } from '../store/slices/authSlice';

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
  };

  return (
    <AuthContext.Provider value={contextValue}>
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const featureFlags = FeatureFlagsManager.getInstance();
  const isReduxEnabled = featureFlags.isReduxEnabled();

  if (isReduxEnabled) {
    return <ReduxAuthProvider>{children}</ReduxAuthProvider>;
  }

  return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
};