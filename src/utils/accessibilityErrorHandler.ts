/**
 * アクセシビリティエラーハンドリングとフォールバック機能
 * 
 * アクセシビリティ機能の障害に対するエラーハンドリング、
 * フォールバック機能、監査機能を提供します。
 */

import * as React from 'react';
import { AccessibilityInfo, Alert, Platform } from 'react-native';

/**
 * エラーレベル
 */
export type ErrorLevel = 'critical' | 'major' | 'minor' | 'warning' | 'info';

/**
 * アクセシビリティエラー
 */
export interface AccessibilityError {
  id: string;
  timestamp: number;
  level: ErrorLevel;
  category: 'screen-reader' | 'focus' | 'contrast' | 'tap-target' | 'audio' | 'navigation' | 'performance' | 'compatibility';
  component: string;
  message: string;
  stack?: string;
  userAgent?: string;
  screenReaderActive?: boolean;
  recoverable: boolean;
  recovery?: {
    attempted: boolean;
    successful: boolean;
    fallbackUsed?: string;
  };
}

/**
 * フォールバック設定
 */
export interface FallbackConfig {
  id: string;
  category: string;
  condition: (error: AccessibilityError) => boolean;
  fallback: () => void | Promise<void>;
  description: string;
  priority: number;
}

/**
 * 監査結果
 */
export interface AccessibilityAuditResult {
  timestamp: number;
  overallScore: number;
  issues: AccessibilityError[];
  recommendations: string[];
  compliance: {
    wcagLevel: 'A' | 'AA' | 'AAA' | 'Non-compliant';
    details: Record<string, boolean>;
  };
}

/**
 * アクセシビリティエラーハンドラー
 */
class AccessibilityErrorHandler {
  private static instance: AccessibilityErrorHandler;
  private errors: AccessibilityError[] = [];
  private fallbacks: Map<string, FallbackConfig> = new Map();
  private maxErrors = 1000; // 最大エラー保持数
  private auditHistory: AccessibilityAuditResult[] = [];
  private errorListeners: ((error: AccessibilityError) => void)[] = [];

  private constructor() {
    this.initializeDefaultFallbacks();
    this.startHealthMonitoring();
  }

  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(): AccessibilityErrorHandler {
    if (!AccessibilityErrorHandler.instance) {
      AccessibilityErrorHandler.instance = new AccessibilityErrorHandler();
    }
    return AccessibilityErrorHandler.instance;
  }

  /**
   * デフォルトフォールバック設定の初期化
   */
  private initializeDefaultFallbacks(): void {
    // スクリーンリーダー関連のフォールバック
    this.registerFallback({
      id: 'screen-reader-detection-failure',
      category: 'screen-reader',
      condition: (error) => error.category === 'screen-reader' && error.message.includes('detection'),
      fallback: async () => {
        console.log('スクリーンリーダー検出失敗: 手動確認モードに切り替え');
        // 手動でスクリーンリーダー状態を確認
        try {
          const isEnabled = await AccessibilityInfo.isScreenReaderEnabled();
          console.log(`手動確認結果: ${isEnabled ? '有効' : '無効'}`);
        } catch (e) {
          console.warn('手動確認も失敗しました');
        }
      },
      description: 'スクリーンリーダー検出失敗時の手動確認',
      priority: 1
    });

    // フォーカス管理のフォールバック
    this.registerFallback({
      id: 'focus-management-failure',
      category: 'focus',
      condition: (error) => error.category === 'focus',
      fallback: () => {
        console.log('フォーカス管理失敗: 基本的なフォーカス順序に切り替え');
        // DOM順序でのフォーカス移動に切り替え
        document.body.style.outline = '2px solid #007AFF';
      },
      description: 'フォーカス管理失敗時の基本フォーカス順序への切り替え',
      priority: 2
    });

    // コントラスト調整のフォールバック
    this.registerFallback({
      id: 'contrast-adjustment-failure',
      category: 'contrast',
      condition: (error) => error.category === 'contrast',
      fallback: () => {
        console.log('コントラスト調整失敗: 高コントラストテーマに切り替え');
        // 高コントラストCSSクラスを追加
        document.body.classList.add('high-contrast-fallback');
      },
      description: 'コントラスト調整失敗時の高コントラストテーマ適用',
      priority: 2
    });

    // 音声フィードバックのフォールバック
    this.registerFallback({
      id: 'audio-feedback-failure',
      category: 'audio',
      condition: (error) => error.category === 'audio',
      fallback: () => {
        console.log('音声フィードバック失敗: 視覚的フィードバックに切り替え');
        // 視覚的な通知システムに切り替え
        this.showVisualFallback('音声機能が利用できません。視覚的通知に切り替えました。');
      },
      description: '音声フィードバック失敗時の視覚的フィードバック代替',
      priority: 3
    });

    // パフォーマンス問題のフォールバック
    this.registerFallback({
      id: 'performance-degradation',
      category: 'performance',
      condition: (error) => error.category === 'performance',
      fallback: () => {
        console.log('パフォーマンス低下: 軽量モードに切り替え');
        // アニメーションや重い処理を無効化
        document.body.classList.add('reduced-motion');
        document.body.classList.add('performance-mode');
      },
      description: 'パフォーマンス低下時の軽量モード切り替え',
      priority: 4
    });
  }

  /**
   * 視覚的フォールバック通知
   */
  private showVisualFallback(message: string): void {
    if (Platform.OS === 'web') {
      // Web環境での視覚的通知
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #FF9500;
        color: white;
        padding: 16px;
        border-radius: 8px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      notification.textContent = message;
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'assertive');
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    } else {
      // React Native環境でのアラート
      Alert.alert('アクセシビリティ通知', message);
    }
  }

  /**
   * ヘルスモニタリング開始
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 30秒間隔
  }

  /**
   * ヘルスチェック実行
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // スクリーンリーダー状態確認
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      // 最近のエラー確認
      const recentErrors = this.errors.filter(error => 
        Date.now() - error.timestamp < 300000 // 5分以内
      );

      // 重大なエラーが続いている場合
      const criticalErrors = recentErrors.filter(error => error.level === 'critical');
      if (criticalErrors.length >= 3) {
        this.logError({
          id: `health-check-${Date.now()}`,
          timestamp: Date.now(),
          level: 'critical',
          category: 'compatibility',
          component: 'health-monitor',
          message: `重大なエラーが${criticalErrors.length}件連続して発生しています`,
          recoverable: true
        });

        // 緊急フォールバックモードに切り替え
        this.activateEmergencyMode();
      }

    } catch (error) {
      this.logError({
        id: `health-check-error-${Date.now()}`,
        timestamp: Date.now(),
        level: 'major',
        category: 'performance',
        component: 'health-monitor',
        message: `ヘルスチェック失敗: ${error}`,
        recoverable: true
      });
    }
  }

  /**
   * 緊急フォールバックモード
   */
  private activateEmergencyMode(): void {
    console.warn('🚨 アクセシビリティ緊急フォールバックモードを起動');
    
    // 全てのアニメーションを停止
    if (Platform.OS === 'web') {
      document.body.classList.add('emergency-accessibility-mode');
      
      const emergencyCSS = `
        .emergency-accessibility-mode * {
          animation: none !important;
          transition: none !important;
        }
        .emergency-accessibility-mode button {
          min-width: 48px !important;
          min-height: 48px !important;
          font-size: 16px !important;
        }
        .emergency-accessibility-mode {
          filter: contrast(150%) !important;
        }
      `;
      
      const styleSheet = document.createElement('style');
      styleSheet.textContent = emergencyCSS;
      document.head.appendChild(styleSheet);
    }

    this.showVisualFallback('アクセシビリティ緊急モードが起動しました。基本機能のみ利用可能です。');
  }

  /**
   * エラーログ記録
   */
  public logError(error: Omit<AccessibilityError, 'userAgent' | 'screenReaderActive'>): void {
    const fullError: AccessibilityError = {
      ...error,
      userAgent: Platform.OS === 'web' ? navigator.userAgent : `${Platform.OS} ${Platform.Version}`,
      screenReaderActive: false, // 実際の実装で取得
      recovery: {
        attempted: false,
        successful: false
      }
    };

    // エラー配列に追加
    this.errors.push(fullError);
    
    // 最大数を超えた場合は古いエラーを削除
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // リスナーに通知
    this.errorListeners.forEach(listener => {
      try {
        listener(fullError);
      } catch (e) {
        console.error('エラーリスナーで例外が発生:', e);
      }
    });

    // 自動回復を試行
    this.attemptRecovery(fullError);

    // 開発環境でのログ出力
    if (__DEV__) {
      const logLevel = fullError.level === 'critical' ? 'error' : 
                     fullError.level === 'major' ? 'warn' : 'log';
      console[logLevel](`[アクセシビリティエラー] ${fullError.component}: ${fullError.message}`);
    }
  }

  /**
   * 自動回復試行
   */
  private async attemptRecovery(error: AccessibilityError): Promise<void> {
    if (!error.recoverable) {
      return;
    }

    // 適用可能なフォールバックを検索
    const applicableFallbacks = Array.from(this.fallbacks.values())
      .filter(fallback => fallback.condition(error))
      .sort((a, b) => a.priority - b.priority);

    if (applicableFallbacks.length === 0) {
      return;
    }

    const fallback = applicableFallbacks[0];
    
    try {
      error.recovery!.attempted = true;
      console.log(`フォールバック実行: ${fallback.description}`);
      
      await fallback.fallback();
      
      error.recovery!.successful = true;
      error.recovery!.fallbackUsed = fallback.id;
      
      console.log(`フォールバック成功: ${fallback.description}`);
      
    } catch (recoveryError) {
      error.recovery!.successful = false;
      console.error(`フォールバック失敗: ${fallback.description}`, recoveryError);
      
      // フォールバック失敗を新しいエラーとして記録
      this.logError({
        id: `fallback-failure-${Date.now()}`,
        timestamp: Date.now(),
        level: 'major',
        category: error.category,
        component: `${error.component}-fallback`,
        message: `フォールバック失敗: ${fallback.description} - ${recoveryError}`,
        recoverable: false
      });
    }
  }

  /**
   * フォールバック登録
   */
  public registerFallback(config: FallbackConfig): void {
    this.fallbacks.set(config.id, config);
  }

  /**
   * エラーリスナー追加
   */
  public addErrorListener(listener: (error: AccessibilityError) => void): () => void {
    this.errorListeners.push(listener);
    
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * エラー統計取得
   */
  public getErrorStats(): {
    total: number;
    byLevel: Record<ErrorLevel, number>;
    byCategory: Record<string, number>;
    recent: number;
    recoveryRate: number;
  } {
    const byLevel: Record<ErrorLevel, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      warning: 0,
      info: 0
    };

    const byCategory: Record<string, number> = {};
    let recoveredCount = 0;
    const now = Date.now();
    let recentCount = 0;

    this.errors.forEach(error => {
      byLevel[error.level]++;
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      
      if (error.recovery?.successful) {
        recoveredCount++;
      }
      
      if (now - error.timestamp < 3600000) { // 1時間以内
        recentCount++;
      }
    });

    return {
      total: this.errors.length,
      byLevel,
      byCategory,
      recent: recentCount,
      recoveryRate: this.errors.length > 0 ? recoveredCount / this.errors.length : 0
    };
  }

  /**
   * アクセシビリティ監査実行
   */
  public async performAudit(): Promise<AccessibilityAuditResult> {
    console.log('アクセシビリティ監査を開始...');
    
    const issues = this.errors.filter(error => 
      Date.now() - error.timestamp < 86400000 // 24時間以内
    );

    // WCAG準拠レベルの判定
    const criticalIssues = issues.filter(error => error.level === 'critical').length;
    const majorIssues = issues.filter(error => error.level === 'major').length;
    
    let wcagLevel: 'A' | 'AA' | 'AAA' | 'Non-compliant';
    
    if (criticalIssues > 0) {
      wcagLevel = 'Non-compliant';
    } else if (majorIssues > 2) {
      wcagLevel = 'A';
    } else if (majorIssues > 0) {
      wcagLevel = 'AA';
    } else {
      wcagLevel = 'AAA';
    }

    // スコア計算（100点満点）
    const penaltyPoints = criticalIssues * 20 + majorIssues * 10 + issues.filter(e => e.level === 'minor').length * 2;
    const overallScore = Math.max(0, 100 - penaltyPoints);

    // 推奨事項生成
    const recommendations = this.generateRecommendations(issues);

    const auditResult: AccessibilityAuditResult = {
      timestamp: Date.now(),
      overallScore,
      issues,
      recommendations,
      compliance: {
        wcagLevel,
        details: {
          'スクリーンリーダー対応': !issues.some(i => i.category === 'screen-reader' && i.level === 'critical'),
          'フォーカス管理': !issues.some(i => i.category === 'focus' && i.level === 'critical'),
          'コントラスト比': !issues.some(i => i.category === 'contrast' && i.level === 'critical'),
          'タップターゲット': !issues.some(i => i.category === 'tap-target' && i.level === 'critical'),
          '音声アクセシビリティ': !issues.some(i => i.category === 'audio' && i.level === 'critical'),
          'ナビゲーション': !issues.some(i => i.category === 'navigation' && i.level === 'critical')
        }
      }
    };

    // 監査履歴に追加
    this.auditHistory.push(auditResult);
    if (this.auditHistory.length > 50) { // 最大50件保持
      this.auditHistory = this.auditHistory.slice(-50);
    }

    console.log(`監査完了: スコア ${overallScore}点, WCAG ${wcagLevel}`);
    
    return auditResult;
  }

  /**
   * 推奨事項生成
   */
  private generateRecommendations(issues: AccessibilityError[]): string[] {
    const recommendations: string[] = [];
    const categoryCount: Record<string, number> = {};

    issues.forEach(issue => {
      categoryCount[issue.category] = (categoryCount[issue.category] || 0) + 1;
    });

    // カテゴリ別推奨事項
    if (categoryCount['screen-reader'] > 0) {
      recommendations.push('スクリーンリーダー対応の改善が必要です。適切なアクセシビリティラベルとロールを設定してください。');
    }

    if (categoryCount['focus'] > 0) {
      recommendations.push('フォーカス管理の見直しが必要です。論理的なタブ順序と視覚的なフォーカスインジケーターを確保してください。');
    }

    if (categoryCount['contrast'] > 0) {
      recommendations.push('色のコントラスト比を改善してください。WCAG 2.1 AA基準（4.5:1）を満たすよう調整が必要です。');
    }

    if (categoryCount['tap-target'] > 0) {
      recommendations.push('タップターゲットのサイズを48×48px以上に調整してください。要素間の適切な間隔も確保してください。');
    }

    if (categoryCount['performance'] > 0) {
      recommendations.push('アクセシビリティ機能のパフォーマンスを最適化してください。遅延読み込みやメモリ使用量の改善を検討してください。');
    }

    // 一般的な推奨事項
    if (issues.length > 10) {
      recommendations.push('定期的なアクセシビリティテストとユーザビリティテストの実施を推奨します。');
    }

    if (issues.filter(i => i.level === 'critical').length > 0) {
      recommendations.push('重大な問題があります。即座に修正して再テストを実施してください。');
    }

    return recommendations;
  }

  /**
   * 問題レポート生成
   */
  public generateReport(): string {
    const stats = this.getErrorStats();
    const latestAudit = this.auditHistory[this.auditHistory.length - 1];
    
    let report = '# アクセシビリティ問題レポート\n\n';
    report += `生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
    
    report += '## 統計情報\n';
    report += `- 総エラー数: ${stats.total}\n`;
    report += `- 最近1時間のエラー数: ${stats.recent}\n`;
    report += `- 自動回復率: ${(stats.recoveryRate * 100).toFixed(1)}%\n\n`;
    
    report += '## エラーレベル別内訳\n';
    Object.entries(stats.byLevel).forEach(([level, count]) => {
      if (count > 0) {
        report += `- ${level}: ${count}件\n`;
      }
    });
    report += '\n';
    
    report += '## カテゴリ別内訳\n';
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      report += `- ${category}: ${count}件\n`;
    });
    report += '\n';
    
    if (latestAudit) {
      report += '## 最新監査結果\n';
      report += `- 総合スコア: ${latestAudit.overallScore}点\n`;
      report += `- WCAG準拠レベル: ${latestAudit.compliance.wcagLevel}\n`;
      report += `- 問題数: ${latestAudit.issues.length}件\n\n`;
      
      if (latestAudit.recommendations.length > 0) {
        report += '## 推奨事項\n';
        latestAudit.recommendations.forEach((rec, index) => {
          report += `${index + 1}. ${rec}\n`;
        });
      }
    }
    
    return report;
  }

  /**
   * エラー履歴クリア
   */
  public clearErrors(): void {
    this.errors = [];
    console.log('アクセシビリティエラー履歴をクリアしました');
  }

  /**
   * 監査履歴取得
   */
  public getAuditHistory(): AccessibilityAuditResult[] {
    return [...this.auditHistory];
  }
}

/**
 * エラーハンドリングフック
 */
export const useAccessibilityErrorHandler = () => {
  const errorHandler = AccessibilityErrorHandler.getInstance();
  const [errors, setErrors] = React.useState<AccessibilityError[]>([]);

  React.useEffect(() => {
    const unsubscribe = errorHandler.addErrorListener((error) => {
      setErrors(prev => [...prev.slice(-99), error]); // 最新100件まで表示
    });

    return unsubscribe;
  }, [errorHandler]);

  const logError = React.useCallback((error: Omit<AccessibilityError, 'userAgent' | 'screenReaderActive'>) => {
    errorHandler.logError(error);
  }, [errorHandler]);

  const getStats = React.useCallback(() => {
    return errorHandler.getErrorStats();
  }, [errorHandler]);

  const performAudit = React.useCallback(async () => {
    return await errorHandler.performAudit();
  }, [errorHandler]);

  const generateReport = React.useCallback(() => {
    return errorHandler.generateReport();
  }, [errorHandler]);

  return {
    errors,
    logError,
    getStats,
    performAudit,
    generateReport,
    clearErrors: errorHandler.clearErrors.bind(errorHandler)
  };
};

// シングルトンインスタンスをエクスポート
export const AccessibilityErrorHandlerInstance = AccessibilityErrorHandler.getInstance();

export default AccessibilityErrorHandler;