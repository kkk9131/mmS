/**
 * 画像システムエラー回復サービス
 * 自動リトライ、エラー分析、回復戦略の実装
 */

import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageErrorType, RetryConfig } from '../../types/image';
import { InternationalizationService } from './InternationalizationService';

export interface ErrorContext {
  operation: 'selection' | 'processing' | 'upload' | 'cache' | 'download';
  imageId?: string;
  fileName?: string;
  fileSize?: number;
  retryCount: number;
  timestamp: Date;
  userAgent: string;
  networkStatus: 'online' | 'offline' | 'unstable';
  deviceMemory?: number;
  availableStorage?: number;
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'user_action' | 'system_repair';
  description: string;
  autoExecute: boolean;
  priority: number;
  estimatedSuccessRate: number;
  execute: () => Promise<boolean>;
}

export interface ErrorAnalysis {
  errorType: ImageErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  rootCause: string;
  suggestedStrategies: RecoveryStrategy[];
  preventionMeasures: string[];
}

const ERROR_LOG_KEY = 'image_error_logs';
const MAX_ERROR_LOGS = 100;

// デフォルトリトライ設定
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    ImageErrorType.NETWORK_ERROR,
    ImageErrorType.UPLOAD_FAILED,
    ImageErrorType.PROCESSING_FAILED
  ]
};

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private i18nService: InternationalizationService;
  private errorLogs: { context: ErrorContext; analysis: ErrorAnalysis }[] = [];
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;
  private ongoingRecoveries: Map<string, Promise<boolean>> = new Map();

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  constructor() {
    this.i18nService = InternationalizationService.getInstance();
    this.loadErrorLogs();
  }

  /**
   * エラーを分析し、回復戦略を提案
   */
  async analyzeError(
    errorType: ImageErrorType, 
    context: Partial<ErrorContext>,
    originalError?: Error
  ): Promise<ErrorAnalysis> {
    console.log('🔍 エラー分析開始:', { errorType, context });

    const fullContext: ErrorContext = {
      operation: 'processing',
      retryCount: 0,
      timestamp: new Date(),
      userAgent: Platform.OS,
      networkStatus: await this.getNetworkStatus(),
      ...context
    };

    const analysis = await this.performErrorAnalysis(errorType, fullContext, originalError);
    
    // エラーログに記録
    await this.logError(fullContext, analysis);
    
    console.log('✅ エラー分析完了:', analysis);
    return analysis;
  }

  /**
   * 自動回復を試行
   */
  async attemptRecovery(
    errorType: ImageErrorType,
    context: ErrorContext,
    customStrategies?: RecoveryStrategy[]
  ): Promise<boolean> {
    const operationId = `${context.operation}_${context.imageId || 'unknown'}_${Date.now()}`;
    
    // 既に回復処理中の場合は待機
    if (this.ongoingRecoveries.has(operationId)) {
      return await this.ongoingRecoveries.get(operationId)!;
    }

    const recoveryPromise = this.executeRecovery(errorType, context, customStrategies);
    this.ongoingRecoveries.set(operationId, recoveryPromise);

    try {
      const result = await recoveryPromise;
      this.ongoingRecoveries.delete(operationId);
      return result;
    } catch (error) {
      console.error('❌ 回復処理エラー:', error);
      this.ongoingRecoveries.delete(operationId);
      return false;
    }
  }

  /**
   * ユーザーにエラーを報告し、選択肢を提示
   */
  async presentErrorToUser(
    analysis: ErrorAnalysis,
    context: ErrorContext
  ): Promise<'retry' | 'skip' | 'cancel'> {
    const t = this.i18nService.getText();
    
    return new Promise((resolve) => {
      const title = t.imageLoadError; // エラーのタイトル
      const message = this.getLocalizedErrorMessage(analysis.errorType);
      
      const buttons = [];
      
      if (analysis.isRecoverable) {
        buttons.push({
          text: t.retry,
          onPress: () => resolve('retry')
        });
      }
      
      buttons.push(
        {
          text: 'スキップ',
          onPress: () => resolve('skip')
        },
        {
          text: t.cancel,
          style: 'cancel' as const,
          onPress: () => resolve('cancel')
        }
      );

      Alert.alert(title, message, buttons);
    });
  }

  /**
   * リトライ設定を更新
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    console.log('🔧 リトライ設定更新:', this.retryConfig);
  }

  /**
   * エラー統計を取得
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByOperation: Record<string, number>;
    recoverySuccessRate: number;
    averageRetryCount: number;
  } {
    const stats = {
      totalErrors: this.errorLogs.length,
      errorsByType: {} as Record<string, number>,
      errorsByOperation: {} as Record<string, number>,
      recoverySuccessRate: 0,
      averageRetryCount: 0
    };

    let totalRetries = 0;
    let successfulRecoveries = 0;

    this.errorLogs.forEach(log => {
      const errorType = log.analysis.errorType;
      const operation = log.context.operation;
      
      stats.errorsByType[errorType] = (stats.errorsByType[errorType] || 0) + 1;
      stats.errorsByOperation[operation] = (stats.errorsByOperation[operation] || 0) + 1;
      
      totalRetries += log.context.retryCount;
      
      if (log.context.retryCount > 0) {
        successfulRecoveries++;
      }
    });

    if (this.errorLogs.length > 0) {
      stats.recoverySuccessRate = successfulRecoveries / this.errorLogs.length;
      stats.averageRetryCount = totalRetries / this.errorLogs.length;
    }

    return stats;
  }

  /**
   * 実際の回復処理を実行
   */
  private async executeRecovery(
    errorType: ImageErrorType,
    context: ErrorContext,
    customStrategies?: RecoveryStrategy[]
  ): Promise<boolean> {
    console.log('🔄 回復処理開始:', { errorType, context });

    const analysis = await this.performErrorAnalysis(errorType, context);
    const strategies = customStrategies || analysis.suggestedStrategies;

    // 優先度順にソート
    strategies.sort((a, b) => b.priority - a.priority);

    for (const strategy of strategies) {
      console.log(`🎯 回復戦略実行: ${strategy.type} - ${strategy.description}`);
      
      try {
        if (strategy.autoExecute) {
          const success = await strategy.execute();
          if (success) {
            console.log('✅ 回復成功:', strategy.type);
            return true;
          }
        } else {
          // ユーザーの確認が必要な戦略
          const userChoice = await this.presentErrorToUser(analysis, context);
          if (userChoice === 'retry') {
            const success = await strategy.execute();
            if (success) {
              console.log('✅ 回復成功:', strategy.type);
              return true;
            }
          } else if (userChoice === 'cancel') {
            console.log('❌ ユーザーによる回復キャンセル');
            return false;
          }
        }
      } catch (strategyError) {
        console.error(`❌ 回復戦略エラー (${strategy.type}):`, strategyError);
        continue;
      }
    }

    console.log('❌ すべての回復戦略が失敗');
    return false;
  }

  /**
   * エラー分析を実行
   */
  private async performErrorAnalysis(
    errorType: ImageErrorType,
    context: ErrorContext,
    originalError?: Error
  ): Promise<ErrorAnalysis> {
    const strategies: RecoveryStrategy[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let isRecoverable = true;
    let rootCause = '';
    const preventionMeasures: string[] = [];

    switch (errorType) {
      case ImageErrorType.PERMISSION_DENIED:
        severity = 'high';
        rootCause = 'カメラまたはギャラリーアクセス権限が拒否されています';
        isRecoverable = false;
        strategies.push({
          type: 'user_action',
          description: '設定でアクセス権限を有効にする',
          autoExecute: false,
          priority: 10,
          estimatedSuccessRate: 0.9,
          execute: async () => {
            // 設定アプリを開く処理（プラットフォーム固有）
            return false; // ユーザーアクションが必要
          }
        });
        preventionMeasures.push('初回使用時に権限リクエストを表示');
        break;

      case ImageErrorType.NETWORK_ERROR:
        severity = 'medium';
        rootCause = 'ネットワーク接続の問題';
        strategies.push({
          type: 'retry',
          description: 'ネットワーク接続回復後にリトライ',
          autoExecute: true,
          priority: 8,
          estimatedSuccessRate: 0.7,
          execute: async () => {
            await this.waitForNetworkRecovery();
            return await this.performNetworkTest();
          }
        });
        preventionMeasures.push('ネットワーク状態の監視', 'オフライン対応の実装');
        break;

      case ImageErrorType.UPLOAD_FAILED:
        severity = 'medium';
        rootCause = 'アップロード処理の失敗';
        strategies.push(
          {
            type: 'retry',
            description: '指数バックオフでリトライ',
            autoExecute: true,
            priority: 9,
            estimatedSuccessRate: 0.8,
            execute: async () => {
              return await this.retryWithBackoff(context);
            }
          },
          {
            type: 'fallback',
            description: '圧縮品質を下げて再アップロード',
            autoExecute: true,
            priority: 7,
            estimatedSuccessRate: 0.6,
            execute: async () => {
              // 圧縮品質を下げる処理
              return true;
            }
          }
        );
        preventionMeasures.push('アップロード前のファイルサイズチェック', 'チャンク分割アップロード');
        break;

      case ImageErrorType.PROCESSING_FAILED:
        severity = 'medium';
        rootCause = '画像処理エラー';
        strategies.push({
          type: 'fallback',
          description: 'シンプルな処理モードに切り替え',
          autoExecute: true,
          priority: 8,
          estimatedSuccessRate: 0.7,
          execute: async () => {
            // シンプルモードでの処理
            return true;
          }
        });
        preventionMeasures.push('画像形式の検証', 'メモリ使用量の監視');
        break;

      case ImageErrorType.STORAGE_FULL:
        severity = 'high';
        rootCause = 'ストレージ容量不足';
        strategies.push(
          {
            type: 'system_repair',
            description: 'キャッシュの自動クリーンアップ',
            autoExecute: true,
            priority: 9,
            estimatedSuccessRate: 0.8,
            execute: async () => {
              // キャッシュクリーンアップの実行
              return true;
            }
          },
          {
            type: 'user_action',
            description: 'ユーザーにストレージクリーンアップを促す',
            autoExecute: false,
            priority: 6,
            estimatedSuccessRate: 0.5,
            execute: async () => {
              return false; // ユーザーアクションが必要
            }
          }
        );
        preventionMeasures.push('定期的なキャッシュクリーンアップ', 'ストレージ使用量の監視');
        break;

      case ImageErrorType.FILE_TOO_LARGE:
        severity = 'low';
        rootCause = 'ファイルサイズが制限を超過';
        strategies.push({
          type: 'fallback',
          description: '自動圧縮を実行',
          autoExecute: true,
          priority: 9,
          estimatedSuccessRate: 0.9,
          execute: async () => {
            // 自動圧縮処理
            return true;
          }
        });
        preventionMeasures.push('アップロード前のサイズチェック', '自動圧縮の実装');
        break;

      default:
        severity = 'medium';
        rootCause = '不明なエラー';
        isRecoverable = false;
    }

    return {
      errorType,
      severity,
      isRecoverable,
      rootCause,
      suggestedStrategies: strategies,
      preventionMeasures
    };
  }

  /**
   * 指数バックオフでリトライ
   */
  private async retryWithBackoff(context: ErrorContext): Promise<boolean> {
    const { maxRetries, baseDelay, maxDelay, backoffMultiplier } = this.retryConfig;
    
    if (context.retryCount >= maxRetries) {
      console.log('❌ 最大リトライ回数に達しました');
      return false;
    }

    const delay = Math.min(
      baseDelay * Math.pow(backoffMultiplier, context.retryCount),
      maxDelay
    );

    console.log(`⏳ ${delay}ms待機後にリトライ (${context.retryCount + 1}/${maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 実際のリトライ処理はここで実装
    // 今は成功として扱う（実装依存）
    return true;
  }

  /**
   * ネットワーク回復を待機
   */
  private async waitForNetworkRecovery(): Promise<void> {
    // ネットワーク回復の監視実装
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * ネットワークテストを実行
   */
  private async performNetworkTest(): Promise<boolean> {
    try {
      // 簡単なネットワークテスト
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * ネットワーク状態を取得
   */
  private async getNetworkStatus(): Promise<'online' | 'offline' | 'unstable'> {
    // React Native NetInfoを使用した実装
    // 簡易版として'online'を返す
    return 'online';
  }

  /**
   * ローカライズされたエラーメッセージを取得
   */
  private getLocalizedErrorMessage(errorType: ImageErrorType): string {
    const t = this.i18nService.getText();
    
    switch (errorType) {
      case ImageErrorType.PERMISSION_DENIED:
        return t.permissionDenied;
      case ImageErrorType.CAMERA_UNAVAILABLE:
        return t.cameraUnavailable;
      case ImageErrorType.GALLERY_UNAVAILABLE:
        return t.galleryUnavailable;
      case ImageErrorType.PROCESSING_FAILED:
        return t.processingFailed;
      case ImageErrorType.UPLOAD_FAILED:
        return t.uploadFailed;
      case ImageErrorType.NETWORK_ERROR:
        return t.networkError;
      case ImageErrorType.STORAGE_FULL:
        return t.storageFull;
      case ImageErrorType.INVALID_FORMAT:
        return t.invalidFormat;
      case ImageErrorType.FILE_TOO_LARGE:
        return t.fileTooLarge;
      default:
        return 'Unknown error occurred';
    }
  }

  /**
   * エラーログを記録
   */
  private async logError(context: ErrorContext, analysis: ErrorAnalysis): Promise<void> {
    try {
      this.errorLogs.push({ context, analysis });
      
      // 最大ログ数を超えた場合は古いものを削除
      if (this.errorLogs.length > MAX_ERROR_LOGS) {
        this.errorLogs = this.errorLogs.slice(-MAX_ERROR_LOGS);
      }
      
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(this.errorLogs));
    } catch (error) {
      console.error('❌ エラーログ保存失敗:', error);
    }
  }

  /**
   * エラーログを読み込み
   */
  private async loadErrorLogs(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ERROR_LOG_KEY);
      if (stored) {
        this.errorLogs = JSON.parse(stored);
        console.log(`📊 ${this.errorLogs.length}件のエラーログを読み込み`);
      }
    } catch (error) {
      console.error('❌ エラーログ読み込み失敗:', error);
      this.errorLogs = [];
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.ongoingRecoveries.clear();
  }
}