import { AppState } from 'react-native';
import { store } from '../store';
import { SupabaseError } from '../utils/SupabaseErrorHandler';

export interface ErrorReport {
  error: Error | SupabaseError;
  errorInfo?: React.ErrorInfo;
  timestamp: string;
  userId?: string;
  appVersion: string;
  platform: string;
  stackTrace?: string;
  userAgent?: string;
  additionalContext?: Record<string, any>;
}

export interface ErrorReportingConfig {
  enabled: boolean;
  reportToSupabase: boolean;
  reportToConsole: boolean;
  maxReportsPerSession: number;
  minTimeBetweenReports: number; // milliseconds
}

class ErrorReportingService {
  private static instance: ErrorReportingService;
  private reportQueue: ErrorReport[] = [];
  private lastReportTime = 0;
  private sessionReportCount = 0;
  
  private config: ErrorReportingConfig = {
    enabled: !__DEV__, // 本番環境でのみ有効
    reportToSupabase: true,
    reportToConsole: true,
    maxReportsPerSession: 50,
    minTimeBetweenReports: 5000, // 5秒
  };

  private constructor() {
    this.initializeErrorReporting();
  }

  public static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  private initializeErrorReporting(): void {
    if (!this.config.enabled) {
      return;
    }

    // グローバルエラーハンドラーの設定
    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      this.reportError(error, {
        componentStack: 'Global Error Handler',
        isFatal: isFatal || false,
      } as React.ErrorInfo);
      
      // 元のハンドラーも呼び出し
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });

    // Unhandled Promise Rejection のハンドリング
    const originalRejectionHandler = require('react-native/Libraries/Core/ExceptionsManager').handleException;
    require('react-native/Libraries/Core/ExceptionsManager').handleException = (error: Error, isFatal?: boolean) => {
      this.reportError(error, {
        componentStack: 'Unhandled Promise Rejection',
        isFatal: isFatal || false,
      } as React.ErrorInfo);
      
      if (originalRejectionHandler) {
        originalRejectionHandler(error, isFatal);
      }
    };
  }

  public async reportError(
    error: Error | SupabaseError, 
    errorInfo?: React.ErrorInfo,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled || !this.shouldReportError()) {
      return;
    }

    try {
      const errorReport = await this.createErrorReport(error, errorInfo, additionalContext);
      
      if (this.config.reportToConsole) {
        this.logErrorToConsole(errorReport);
      }

      if (this.config.reportToSupabase) {
        await this.sendErrorToSupabase(errorReport);
      }

      this.updateReportingState();
    } catch (reportingError) {
      console.error('Error reporting failed:', reportingError);
    }
  }

  private shouldReportError(): boolean {
    const now = Date.now();
    
    // セッション内の最大レポート数をチェック
    if (this.sessionReportCount >= this.config.maxReportsPerSession) {
      return false;
    }

    // 最小時間間隔をチェック
    if (now - this.lastReportTime < this.config.minTimeBetweenReports) {
      return false;
    }

    return true;
  }

  private async createErrorReport(
    error: Error | SupabaseError,
    errorInfo?: React.ErrorInfo,
    additionalContext?: Record<string, any>
  ): Promise<ErrorReport> {
    const state = store.getState();
    const userId = state.auth?.user?.id || state.auth?.profile?.id;
    
    // アプリのバージョン情報を取得
    let appVersion = 'unknown';
    try {
      const Constants = await import('expo-constants');
      appVersion = Constants.default?.expoConfig?.version || 'unknown';
    } catch (error) {
      console.warn('Failed to get app version:', error);
    }

    // プラットフォーム情報を取得
    const { Platform } = await import('react-native');
    const platform = `${Platform.OS} ${Platform.Version}`;

    // スタックトレースの取得
    let stackTrace = error.stack;
    if ('componentStack' in error && typeof (error as any).componentStack === 'string') {
      stackTrace = `${stackTrace}\n\nComponent Stack:\n${(error as any).componentStack}`;
    }
    if (errorInfo?.componentStack) {
      stackTrace = `${stackTrace}\n\nReact Component Stack:\n${errorInfo.componentStack}`;
    }

    // アプリ状態の取得
    const appState = AppState.currentState;
    
    return {
      error,
      errorInfo,
      timestamp: new Date().toISOString(),
      userId,
      appVersion,
      platform,
      stackTrace,
      additionalContext: {
        appState,
        authState: state.auth ? {
          isAuthenticated: !!state.auth.user || !!state.auth.profile,
          authMethod: state.auth.session ? 'custom' : 'none',
        } : null,
        reduxState: {
          ui: state.ui ? {
            loading: state.ui.loading,
            error: state.ui.globalError ? 'present' : 'none',
          } : null,
        },
        ...additionalContext,
      },
    };
  }

  private logErrorToConsole(errorReport: ErrorReport): void {
    console.group('🚨 Error Report');
    console.error('Error:', errorReport.error);
    console.log('Timestamp:', errorReport.timestamp);
    console.log('User ID:', errorReport.userId || 'Anonymous');
    console.log('App Version:', errorReport.appVersion);
    console.log('Platform:', errorReport.platform);
    
    if (errorReport.errorInfo) {
      console.log('Error Info:', errorReport.errorInfo);
    }
    
    if (errorReport.stackTrace) {
      console.log('Stack Trace:', errorReport.stackTrace);
    }
    
    if (errorReport.additionalContext) {
      console.log('Additional Context:', errorReport.additionalContext);
    }
    
    console.groupEnd();
  }

  private async sendErrorToSupabase(errorReport: ErrorReport): Promise<void> {
    try {
      const { supabase } = await import('./supabase/client');
      
      // エラーデータをSupabaseに保存
      const { error } = await supabase
        .from('error_reports')
        .insert({
          user_id: errorReport.userId,
          error_message: errorReport.error.message,
          error_name: errorReport.error.name,
          stack_trace: errorReport.stackTrace,
          app_version: errorReport.appVersion,
          platform: errorReport.platform,
          additional_context: errorReport.additionalContext,
          created_at: errorReport.timestamp,
        });

      if (error) {
        throw error;
      }

      console.log('Error report sent to Supabase successfully');
    } catch (error) {
      console.error('Failed to send error report to Supabase:', error);
      // Supabaseへの送信に失敗した場合、ローカルキューに保存
      this.reportQueue.push(errorReport);
    }
  }

  private updateReportingState(): void {
    this.lastReportTime = Date.now();
    this.sessionReportCount++;
  }

  public updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ErrorReportingConfig {
    return { ...this.config };
  }

  public getSessionStats(): {
    reportCount: number;
    queueSize: number;
    lastReportTime: number;
  } {
    return {
      reportCount: this.sessionReportCount,
      queueSize: this.reportQueue.length,
      lastReportTime: this.lastReportTime,
    };
  }

  // キューにあるエラーレポートを再送信
  public async retryQueuedReports(): Promise<void> {
    if (this.reportQueue.length === 0) {
      return;
    }

    const reports = [...this.reportQueue];
    this.reportQueue = [];

    for (const report of reports) {
      try {
        await this.sendErrorToSupabase(report);
      } catch (error) {
        console.error('Failed to retry error report:', error);
        // 再試行に失敗した場合、キューに戻す
        this.reportQueue.push(report);
      }
    }
  }

  // クリーンアップ
  public cleanup(): void {
    this.reportQueue = [];
    this.sessionReportCount = 0;
    this.lastReportTime = 0;
  }
}

export const errorReportingService = ErrorReportingService.getInstance();