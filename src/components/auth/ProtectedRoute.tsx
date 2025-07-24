import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { AuthGuard, GuardResult } from '../../services/jwt/AuthGuard';
import { useNavigation } from '@react-navigation/native';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  fallback?: React.ComponentType;
  redirectTo?: string;
  allowAnonymous?: boolean;
  route?: string;
}

interface ProtectedRouteState {
  isChecking: boolean;
  guardResult: GuardResult | null;
  error: string | null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  fallback: Fallback,
  redirectTo = '/login',
  allowAnonymous = false,
  route,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigation = useNavigation();
  const [state, setState] = useState<ProtectedRouteState>({
    isChecking: true,
    guardResult: null,
    error: null,
  });

  const authGuard = React.useMemo(() => {
    return new AuthGuard({
      redirectTo,
      requiredPermissions,
      allowAnonymous,
      checkInterval: 30000,
    });
  }, [redirectTo, requiredPermissions, allowAnonymous]);

  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      try {
        setState(prev => ({ ...prev, isChecking: true, error: null }));

        // 現在のルートを取得（React Navigationから）
        const currentRoute = route || (navigation as any)?.getCurrentRoute?.()?.name || '/';

        // 認証ガードでアクセスチェック
        const result = await authGuard.checkAccess(currentRoute, user || undefined);

        if (isMounted) {
          setState({
            isChecking: false,
            guardResult: result,
            error: null,
          });

          // アクセスが拒否された場合のリダイレクト処理
          if (!result.allowed && result.redirectTo) {
            handleRedirect(result.redirectTo, result.requiredAction);
          }
        }
      } catch (error) {
        console.error('Protected route access check error:', error);
        if (isMounted) {
          setState({
            isChecking: false,
            guardResult: { allowed: false, reason: 'Access check failed' },
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    // 認証状態のロードが完了したらアクセスチェックを実行
    if (!isLoading) {
      checkAccess();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user, isLoading, route, authGuard, navigation]);

  const handleRedirect = (redirectTo: string, action?: string) => {
    console.log(`Redirecting to: ${redirectTo}, action: ${action}`);
    
    try {
      // React Navigationを使用したリダイレクト
      if (redirectTo.startsWith('/')) {
        // 絶対パスの場合
        const routeName = redirectTo.slice(1) || 'Home';
        navigation.navigate(routeName as never);
      } else {
        // 相対パスまたはルート名の場合
        navigation.navigate(redirectTo as never);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // フォールバック：ログイン画面に遷移
      navigation.navigate('Login' as never);
    }
  };

  // 認証状態ロード中
  if (isLoading || state.isChecking) {
    if (Fallback) {
      return <Fallback />;
    }
    return <LoadingComponent />;
  }

  // アクセスチェックエラー
  if (state.error) {
    return <ErrorComponent error={state.error} />;
  }

  // アクセス拒否
  if (state.guardResult && !state.guardResult.allowed) {
    return <AccessDeniedComponent guardResult={state.guardResult} />;
  }

  // アクセス許可
  return <>{children}</>;
};

// デフォルトのローディングコンポーネント
const LoadingComponent: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>認証を確認中...</Text>
  </View>
);

// デフォルトのエラーコンポーネント
const ErrorComponent: React.FC<{ error: string }> = ({ error }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>認証エラー</Text>
    <Text style={styles.errorText}>{error}</Text>
  </View>
);

// デフォルトのアクセス拒否コンポーネント
const AccessDeniedComponent: React.FC<{ guardResult: GuardResult }> = ({ guardResult }) => (
  <View style={styles.accessDeniedContainer}>
    <Text style={styles.accessDeniedTitle}>アクセスが拒否されました</Text>
    <Text style={styles.accessDeniedText}>
      {guardResult.reason || 'このページにアクセスする権限がありません'}
    </Text>
    {guardResult.requiredAction && (
      <Text style={styles.actionText}>
        必要なアクション: {getActionText(guardResult.requiredAction)}
      </Text>
    )}
  </View>
);

const getActionText = (action: string): string => {
  switch (action) {
    case 'login':
      return 'ログインが必要です';
    case 'permission':
      return '権限が不足しています';
    case 'verification':
      return '認証が必要です';
    default:
      return '不明なアクション';
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f57c00',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionText: {
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ProtectedRoute;

// Hooksスタイルの使用法をサポート
export const useAuthGuard = () => {
  const { user } = useAuth();
  const authGuard = React.useMemo(() => new AuthGuard(), []);

  const checkAccess = React.useCallback(
    async (route: string, permissions?: string[]) => {
      const guard = new AuthGuard({
        requiredPermissions: permissions,
      });
      return guard.checkAccess(route, user || undefined);
    },
    [user]
  );

  const checkPermissions = React.useCallback(
    async (permissions: string[]) => {
      if (!user) return false;
      return authGuard.checkPermissions(permissions, user);
    },
    [user, authGuard]
  );

  return {
    checkAccess,
    checkPermissions,
    authGuard,
  };
};