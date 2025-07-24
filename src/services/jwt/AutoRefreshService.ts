import { AppState, AppStateStatus } from 'react-native';
import { JWTTokenManager } from './JWTTokenManager';
import { TokenPair, JWTAuthError } from './types';

interface RefreshConfig {
  checkInterval: number; // 1分
  retryDelay: number; // 5秒
  maxRetries: number; // 3回
  backgroundRefresh: boolean;
  pauseOnBackground: boolean;
}

interface RefreshEvent {
  type: 'success' | 'failed' | 'retry' | 'skipped';
  timestamp: Date;
  reason?: string;
  attempt?: number;
}

export class AutoRefreshService {
  private config: RefreshConfig;
  private tokenManager: JWTTokenManager;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing: boolean = false;
  private retryCount: number = 0;
  private appState: AppStateStatus = 'active';
  private refreshEvents: RefreshEvent[] = [];
  private listeners: ((event: RefreshEvent) => void)[] = [];

  constructor(
    tokenManager: JWTTokenManager,
    config?: Partial<RefreshConfig>
  ) {
    this.tokenManager = tokenManager;
    this.config = {
      checkInterval: 60 * 1000, // 1分
      retryDelay: 5 * 1000, // 5秒
      maxRetries: 3,
      backgroundRefresh: true,
      pauseOnBackground: false,
      ...config,
    };

    // AppStateの監視
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    this.appState = AppState.currentState;
  }

  startAutoRefresh(): void {
    if (this.refreshTimer) {
      this.stopAutoRefresh();
    }

    console.log('Auto refresh service started');
    this.scheduleNextRefresh();
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    console.log('Auto refresh service stopped');
  }

  async forceRefresh(): Promise<boolean> {
    try {
      this.logEvent({
        type: 'retry',
        timestamp: new Date(),
        reason: 'Force refresh requested',
      });

      const tokens = await this.tokenManager.refreshTokens();
      
      this.logEvent({
        type: 'success',
        timestamp: new Date(),
        reason: 'Force refresh completed',
      });

      this.retryCount = 0;
      return true;
    } catch (error) {
      this.logEvent({
        type: 'failed',
        timestamp: new Date(),
        reason: `Force refresh failed: ${error}`,
      });

      console.error('Force refresh failed:', error);
      return false;
    }
  }

  isRunning(): boolean {
    return this.refreshTimer !== null;
  }

  getRefreshHistory(): RefreshEvent[] {
    return [...this.refreshEvents];
  }

  addRefreshListener(listener: (event: RefreshEvent) => void): void {
    this.listeners.push(listener);
  }

  removeRefreshListener(listener: (event: RefreshEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private async checkAndRefreshTokens(): Promise<void> {
    // バックグラウンド時の処理
    if (this.appState !== 'active' && this.config.pauseOnBackground) {
      this.logEvent({
        type: 'skipped',
        timestamp: new Date(),
        reason: 'App in background',
      });
      this.scheduleNextRefresh();
      return;
    }

    // 既にリフレッシュ中の場合はスキップ
    if (this.isRefreshing) {
      this.logEvent({
        type: 'skipped',
        timestamp: new Date(),
        reason: 'Already refreshing',
      });
      this.scheduleNextRefresh();
      return;
    }

    try {
      const accessToken = await this.tokenManager.getAccessToken();
      
      if (!accessToken) {
        this.logEvent({
          type: 'skipped',
          timestamp: new Date(),
          reason: 'No access token found',
        });
        this.scheduleNextRefresh();
        return;
      }

      // リフレッシュが必要かチェック
      if (!this.tokenManager.shouldRefreshToken(accessToken)) {
        this.scheduleNextRefresh();
        return;
      }

      // リフレッシュ実行
      this.isRefreshing = true;
      
      try {
        const newTokens = await this.tokenManager.refreshTokens();
        
        this.logEvent({
          type: 'success',
          timestamp: new Date(),
          reason: 'Auto refresh completed',
        });

        this.notifyRefreshSuccess(newTokens);
        this.retryCount = 0;
      } catch (error) {
        await this.handleRefreshError(error as Error);
      }
    } catch (error) {
      console.error('Error during token check:', error);
      this.logEvent({
        type: 'failed',
        timestamp: new Date(),
        reason: `Token check error: ${error}`,
      });
    } finally {
      this.isRefreshing = false;
      this.scheduleNextRefresh();
    }
  }

  private async handleRefreshError(error: Error): Promise<void> {
    this.retryCount++;
    
    this.logEvent({
      type: 'failed',
      timestamp: new Date(),
      reason: error.message,
      attempt: this.retryCount,
    });

    if (error instanceof JWTAuthError) {
      if (error.code === 'TOKEN_EXPIRED' || error.code === 'TOKEN_INVALID') {
        // 回復不可能なエラー：ログアウト処理
        console.error('Unrecoverable token error, forcing logout:', error);
        this.notifyLogoutRequired(error);
        return;
      }

      if (error.code === 'BIOMETRIC_ERROR') {
        // 生体認証エラー：ユーザーの操作待ち
        console.warn('Biometric authentication required for refresh');
        this.notifyBiometricRequired();
        return;
      }
    }

    // リトライ可能なエラー
    if (this.retryCount < this.config.maxRetries) {
      console.warn(`Refresh failed, retrying in ${this.config.retryDelay}ms (attempt ${this.retryCount}/${this.config.maxRetries})`);
      
      setTimeout(() => {
        this.forceRefresh();
      }, this.config.retryDelay);
    } else {
      console.error('Max retry attempts reached, giving up');
      this.retryCount = 0;
      this.notifyRefreshFailed(error);
    }
  }

  private scheduleNextRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.checkAndRefreshTokens();
    }, this.config.checkInterval) as any;
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const previousState = this.appState;
    this.appState = nextAppState;

    console.log(`App state changed: ${previousState} -> ${nextAppState}`);

    if (nextAppState === 'active' && previousState !== 'active') {
      // アプリがフォアグラウンドに戻った時
      if (this.config.backgroundRefresh) {
        console.log('App became active, checking tokens immediately');
        this.forceRefresh();
      }
    }
  }

  private notifyRefreshSuccess(tokens: TokenPair): void {
    this.listeners.forEach(listener => {
      try {
        listener({
          type: 'success',
          timestamp: new Date(),
          reason: 'Token refresh successful',
        });
      } catch (error) {
        console.error('Error in refresh listener:', error);
      }
    });
  }

  private notifyRefreshFailed(error: Error): void {
    this.listeners.forEach(listener => {
      try {
        listener({
          type: 'failed',
          timestamp: new Date(),
          reason: error.message,
        });
      } catch (listenerError) {
        console.error('Error in refresh listener:', listenerError);
      }
    });
  }

  private notifyLogoutRequired(error: JWTAuthError): void {
    // AuthContextに通知してログアウト処理を実行
    console.error('Logout required due to token error:', error);
    // 実装では、EventEmitterやContextAPIを使用してログアウトを通知
  }

  private notifyBiometricRequired(): void {
    // 生体認証が必要な旨をユーザーに通知
    console.warn('Biometric authentication required for token refresh');
    // 実装では、UIに通知して生体認証を促す
  }

  private logEvent(event: RefreshEvent): void {
    this.refreshEvents.push(event);
    
    // 履歴が長くなりすぎないよう制限（最新100件）
    if (this.refreshEvents.length > 100) {
      this.refreshEvents = this.refreshEvents.slice(-100);
    }

    console.log(`Refresh event: ${event.type} - ${event.reason || 'No reason'}`);
  }

  // 設定の動的更新
  updateConfig(newConfig: Partial<RefreshConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // タイマーが動いている場合は再スケジュール
    if (this.refreshTimer) {
      this.stopAutoRefresh();
      this.startAutoRefresh();
    }
  }

  getConfig(): RefreshConfig {
    return { ...this.config };
  }

  getStats(): {
    isRunning: boolean;
    isRefreshing: boolean;
    retryCount: number;
    appState: AppStateStatus;
    lastEvent?: RefreshEvent;
    successCount: number;
    failureCount: number;
  } {
    const events = this.refreshEvents;
    const successCount = events.filter(e => e.type === 'success').length;
    const failureCount = events.filter(e => e.type === 'failed').length;
    const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;

    return {
      isRunning: this.isRunning(),
      isRefreshing: this.isRefreshing,
      retryCount: this.retryCount,
      appState: this.appState,
      lastEvent,
      successCount,
      failureCount,
    };
  }

  // クリーンアップ
  dispose(): void {
    this.stopAutoRefresh();
    // AppState.removeEventListener is deprecated, using modern subscription pattern
    this.listeners = [];
    this.refreshEvents = [];
  }
}