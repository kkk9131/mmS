import { JWTAuthService } from './JWTAuthService';
import { User } from '../../types/users';

export interface GuardConfig {
  redirectTo: string;
  requiredPermissions?: string[];
  allowAnonymous: boolean;
  checkInterval: number;
  protectedRoutes: string[];
  publicRoutes: string[];
  permissionLevels: Record<string, string[]>;
}

export interface GuardResult {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
  requiredAction?: 'login' | 'permission' | 'verification';
}

export interface RoutePermissions {
  [route: string]: string[];
}

export class AuthGuard {
  private config: GuardConfig;
  private authService: JWTAuthService;
  private checkTimer?: ReturnType<typeof setInterval>;

  constructor(
    config: Partial<GuardConfig> = {},
    authService?: JWTAuthService
  ) {
    this.config = {
      redirectTo: '/login',
      allowAnonymous: false,
      checkInterval: 30000, // 30秒間隔でチェック
      protectedRoutes: [
        '/profile',
        '/settings',
        '/dashboard',
        '/admin',
      ],
      publicRoutes: [
        '/',
        '/login',
        '/register',
        '/forgot-password',
        '/about',
        '/terms',
        '/privacy',
      ],
      permissionLevels: {
        user: ['read'],
        premium: ['read', 'write'],
        moderator: ['read', 'write', 'moderate'],
        admin: ['read', 'write', 'moderate', 'admin'],
      },
      ...config,
    };

    this.authService = authService || new JWTAuthService();
  }

  async checkAccess(route: string, user?: User): Promise<GuardResult> {
    try {
      console.log(`Checking access for route: ${route}`);

      // パブリックルートは常にアクセス許可
      if (this.isPublicRoute(route)) {
        return {
          allowed: true,
        };
      }

      // ユーザーが未認証の場合
      if (!user) {
        if (this.config.allowAnonymous) {
          return {
            allowed: true,
          };
        }

        return {
          allowed: false,
          redirectTo: this.generateRedirectUrl(route),
          reason: 'Authentication required',
          requiredAction: 'login',
        };
      }

      // 保護されたルートの場合、権限チェック
      if (this.isProtectedRoute(route)) {
        const requiredPermissions = this.getRequiredPermissions(route);
        
        if (requiredPermissions.length > 0) {
          const hasPermissions = await this.checkPermissions(requiredPermissions, user);
          if (!hasPermissions) {
            return {
              allowed: false,
              redirectTo: '/unauthorized',
              reason: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
              requiredAction: 'permission',
            };
          }
        }
      }

      // トークンの有効性確認
      const isTokenValid = await this.validateUserToken(user);
      if (!isTokenValid) {
        return {
          allowed: false,
          redirectTo: this.generateRedirectUrl(route),
          reason: 'Invalid or expired session',
          requiredAction: 'login',
        };
      }

      console.log(`Access granted for route: ${route}`);
      return {
        allowed: true,
      };

    } catch (error) {
      console.error('Auth guard error:', error);
      
      // unknownエラーの型ガード
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error : 
                          'Unknown error occurred';
      
      return {
        allowed: false,
        redirectTo: this.config.redirectTo,
        reason: `Authentication check failed: ${errorMessage}`,
        requiredAction: 'login',
      };
    }
  }

  async checkPermissions(permissions: string[], user: User): Promise<boolean> {
    try {
      console.log(`Checking permissions: ${permissions.join(', ')} for user: ${user.id}`);

      // ユーザーの権限レベルを取得
      const userPermissions = await this.getUserPermissions(user);
      
      // 必要な権限がすべて含まれているかチェック
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      console.log(`Permission check result: ${hasAllPermissions}`);
      return hasAllPermissions;

    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  private isProtectedRoute(route: string): boolean {
    // 保護されたルートのパターンマッチング
    return this.config.protectedRoutes.some(protectedRoute => {
      // 完全一致またはプレフィックスマッチング
      return route === protectedRoute || route.startsWith(protectedRoute + '/');
    });
  }

  private isPublicRoute(route: string): boolean {
    // パブリックルートのパターンマッチング
    return this.config.publicRoutes.some(publicRoute => {
      // 完全一致またはプレフィックスマッチング
      return route === publicRoute || route.startsWith(publicRoute + '/');
    });
  }

  private getRequiredPermissions(route: string): string[] {
    // ルート固有の権限要件を定義
    const routePermissions: RoutePermissions = {
      '/admin': ['admin'],
      '/admin/*': ['admin'],
      '/moderator': ['moderate'],
      '/moderator/*': ['moderate'],
      '/premium': ['write'],
      '/premium/*': ['write'],
      // 通常の保護されたルートは基本読み取り権限のみ
    };

    // ルートに対応する権限を検索
    for (const [routePattern, permissions] of Object.entries(routePermissions)) {
      if (routePattern.endsWith('/*')) {
        const baseRoute = routePattern.slice(0, -2);
        if (route.startsWith(baseRoute)) {
          return permissions;
        }
      } else if (route === routePattern) {
        return permissions;
      }
    }

    // 設定で指定された権限またはデフォルト権限
    return this.config.requiredPermissions || ['read'];
  }

  private async getUserPermissions(user: User): Promise<string[]> {
    try {
      // ユーザーのロールに基づいて権限を取得
      // 実際の実装では、APIまたはデータベースから取得
      
      // モック実装：ユーザーオブジェクトからロールを取得
      const userRole = (user as any).role || 'user';
      const permissions = this.config.permissionLevels[userRole] || ['read'];

      console.log(`User ${user.id} has role: ${userRole}, permissions: ${permissions.join(', ')}`);
      return permissions;

    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return ['read']; // デフォルト権限
    }
  }

  private generateRedirectUrl(originalRoute: string): string {
    // 元のルートをクエリパラメータとして保存
    const redirectUrl = new URL(this.config.redirectTo, 'http://localhost');
    redirectUrl.searchParams.set('returnTo', originalRoute);
    return redirectUrl.pathname + redirectUrl.search;
  }

  private async validateUserToken(user: User): Promise<boolean> {
    try {
      // アクセストークンの有効性確認
      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        return false;
      }

      // トークンの期限確認
      if (await this.authService.isTokenExpired(accessToken)) {
        // リフレッシュトークンを試行
        try {
          await this.authService.refreshTokens();
          return true;
        } catch (refreshError) {
          console.error('Token refresh failed during guard check:', refreshError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // 定期的な認証チェックの開始
  startPeriodicCheck(user: User, onAuthenticationLost: () => void): void {
    if (this.checkTimer) {
      this.stopPeriodicCheck();
    }

    this.checkTimer = setInterval(async () => {
      try {
        const isValid = await this.validateUserToken(user);
        if (!isValid) {
          console.warn('Authentication lost during periodic check');
          this.stopPeriodicCheck();
          onAuthenticationLost();
        }
      } catch (error) {
        console.error('Periodic auth check error:', error);
      }
    }, this.config.checkInterval);

    console.log('Started periodic authentication check');
  }

  // 定期チェックの停止
  stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      console.log('Stopped periodic authentication check');
    }
  }

  // 設定の更新
  updateConfig(config: Partial<GuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 権限レベルの動的更新
  updatePermissionLevels(permissionLevels: Record<string, string[]>): void {
    this.config.permissionLevels = { ...this.config.permissionLevels, ...permissionLevels };
  }

  // 保護されたルートの動的追加
  addProtectedRoute(route: string): void {
    if (!this.config.protectedRoutes.includes(route)) {
      this.config.protectedRoutes.push(route);
    }
  }

  // 保護されたルートの削除
  removeProtectedRoute(route: string): void {
    this.config.protectedRoutes = this.config.protectedRoutes.filter(r => r !== route);
  }

  // パブリックルートの動的追加
  addPublicRoute(route: string): void {
    if (!this.config.publicRoutes.includes(route)) {
      this.config.publicRoutes.push(route);
    }
  }

  // 現在の設定を取得
  getConfig(): GuardConfig {
    return { ...this.config };
  }

  // ガードの破棄
  destroy(): void {
    this.stopPeriodicCheck();
  }
}