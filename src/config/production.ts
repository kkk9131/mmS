/**
 * 本番環境設定管理
 * セキュリティとパフォーマンスを重視した設定
 */

import { FeatureFlagsManager } from '../services/featureFlags';

export interface ProductionConfig {
  supabase: {
    url: string;
    anonKey: string;
    maxConnections: number;
    timeout: number;
    retryAttempts: number;
  };
  security: {
    enableRLS: boolean;
    requireAuth: boolean;
    maxLoginAttempts: number;
    sessionTimeoutMs: number;
    csrfProtection: boolean;
  };
  performance: {
    enableCaching: boolean;
    cacheTimeoutMs: number;
    maxCacheSize: number;
    batchSize: number;
    debounceMs: number;
  };
  monitoring: {
    enableErrorReporting: boolean;
    enablePerformanceTracking: boolean;
    enableUserAnalytics: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  features: {
    realtimeEnabled: boolean;
    pushNotificationsEnabled: boolean;
    offlineModeEnabled: boolean;
    imageUploadEnabled: boolean;
  };
}

/**
 * 本番環境設定
 */
export const productionConfig: ProductionConfig = {
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    maxConnections: 10,
    timeout: 30000, // 30秒
    retryAttempts: 3,
  },
  security: {
    enableRLS: true,
    requireAuth: true,
    maxLoginAttempts: 5,
    sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24時間
    csrfProtection: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeoutMs: 5 * 60 * 1000, // 5分
    maxCacheSize: 100,
    batchSize: 20,
    debounceMs: 300,
  },
  monitoring: {
    enableErrorReporting: true,
    enablePerformanceTracking: true,
    enableUserAnalytics: false, // プライバシー重視
    logLevel: 'error',
  },
  features: {
    realtimeEnabled: true,
    pushNotificationsEnabled: true,
    offlineModeEnabled: true,
    imageUploadEnabled: true,
  },
};

/**
 * 開発環境設定
 */
export const developmentConfig: ProductionConfig = {
  ...productionConfig,
  supabase: {
    ...productionConfig.supabase,
    timeout: 10000, // 10秒（開発時は短く）
    retryAttempts: 1,
  },
  security: {
    ...productionConfig.security,
    maxLoginAttempts: 10, // 開発時は制限緩く
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1000, // 7日間
  },
  monitoring: {
    ...productionConfig.monitoring,
    enableUserAnalytics: true, // 開発時はデバッグ用
    logLevel: 'debug',
  },
};

/**
 * テスト環境設定
 */
export const testConfig: ProductionConfig = {
  ...productionConfig,
  supabase: {
    url: 'http://localhost:54321', // ローカルSupabase
    anonKey: 'test-anon-key',
    maxConnections: 5,
    timeout: 5000, // 5秒
    retryAttempts: 1,
  },
  security: {
    ...productionConfig.security,
    requireAuth: false, // テスト時は認証不要
    maxLoginAttempts: 999,
  },
  performance: {
    ...productionConfig.performance,
    enableCaching: false, // テスト時はキャッシュ無効
  },
  monitoring: {
    enableErrorReporting: false,
    enablePerformanceTracking: false,
    enableUserAnalytics: false,
    logLevel: 'debug',
  },
  features: {
    ...productionConfig.features,
    realtimeEnabled: false, // テスト時は簡略化
    pushNotificationsEnabled: false,
  },
};

/**
 * 環境別設定取得
 */
export function getConfig(): ProductionConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return developmentConfig;
  }
}

/**
 * 設定バリデーター
 */
export class ConfigValidator {
  private config: ProductionConfig;

  constructor(config: ProductionConfig) {
    this.config = config;
  }

  /**
   * 設定の妥当性をチェック
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Supabase設定チェック
    if (!this.config.supabase.url) {
      errors.push('Supabase URL が設定されていません');
    }
    
    if (!this.config.supabase.url.startsWith('https://') && !this.config.supabase.url.startsWith('http://localhost')) {
      errors.push('Supabase URL はHTTPS経由である必要があります');
    }

    if (!this.config.supabase.anonKey) {
      errors.push('Supabase Anonymous Key が設定されていません');
    }

    if (this.config.supabase.anonKey.length < 50) {
      errors.push('Supabase Anonymous Key が短すぎます');
    }

    // セキュリティ設定チェック
    if (process.env.NODE_ENV === 'production') {
      if (!this.config.security.enableRLS) {
        errors.push('本番環境ではRLSを有効にしてください');
      }

      if (!this.config.security.requireAuth) {
        errors.push('本番環境では認証を必須にしてください');
      }

      if (!this.config.security.csrfProtection) {
        errors.push('本番環境ではCSRF保護を有効にしてください');
      }
    }

    // パフォーマンス設定チェック
    if (this.config.performance.batchSize > 100) {
      errors.push('バッチサイズが大きすぎます（推奨: 100以下）');
    }

    if (this.config.performance.cacheTimeoutMs < 60000) {
      errors.push('キャッシュタイムアウトが短すぎます（推奨: 1分以上）');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * セキュリティレベルを評価
   */
  assessSecurityLevel(): 'low' | 'medium' | 'high' {
    let score = 0;

    if (this.config.security.enableRLS) score += 25;
    if (this.config.security.requireAuth) score += 25;
    if (this.config.security.csrfProtection) score += 20;
    if (this.config.security.maxLoginAttempts <= 5) score += 15;
    if (this.config.supabase.url.startsWith('https://')) score += 15;

    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }
}

/**
 * 環境設定初期化
 */
export async function initializeProductionEnvironment(): Promise<void> {
  console.log('🚀 本番環境設定を初期化中...');

  const config = getConfig();
  const validator = new ConfigValidator(config);
  const validation = validator.validate();

  if (!validation.isValid) {
    console.error('❌ 設定エラー:');
    validation.errors.forEach(error => console.error(`  • ${error}`));
    throw new Error('設定が不正です');
  }

  const securityLevel = validator.assessSecurityLevel();
  console.log(`🔐 セキュリティレベル: ${securityLevel}`);

  if (process.env.NODE_ENV === 'production' && securityLevel !== 'high') {
    console.warn('⚠️  本番環境ではセキュリティレベル「high」が推奨されます');
  }

  // フィーチャーフラグの設定
  const featureFlags = FeatureFlagsManager.getInstance();
  (featureFlags as any).setSupabaseEnabled(config.features.realtimeEnabled);

  console.log('✅ 本番環境設定の初期化が完了しました');
}

/**
 * 設定を環境変数にエクスポート
 */
export function exportToEnvironmentVariables(config: ProductionConfig): Record<string, string> {
  return {
    EXPO_PUBLIC_SUPABASE_URL: config.supabase.url,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: config.supabase.anonKey,
    SUPABASE_MAX_CONNECTIONS: config.supabase.maxConnections.toString(),
    SUPABASE_TIMEOUT: config.supabase.timeout.toString(),
    SUPABASE_RETRY_ATTEMPTS: config.supabase.retryAttempts.toString(),
    
    ENABLE_RLS: config.security.enableRLS.toString(),
    REQUIRE_AUTH: config.security.requireAuth.toString(),
    MAX_LOGIN_ATTEMPTS: config.security.maxLoginAttempts.toString(),
    SESSION_TIMEOUT: config.security.sessionTimeoutMs.toString(),
    
    ENABLE_CACHING: config.performance.enableCaching.toString(),
    CACHE_TIMEOUT: config.performance.cacheTimeoutMs.toString(),
    BATCH_SIZE: config.performance.batchSize.toString(),
    
    LOG_LEVEL: config.monitoring.logLevel,
    ENABLE_REALTIME: config.features.realtimeEnabled.toString(),
  };
}

/**
 * 設定情報をマスクして表示
 */
export function displayConfigSafely(config: ProductionConfig): Record<string, any> {
  return {
    supabase: {
      url: config.supabase.url,
      anonKey: `${config.supabase.anonKey.substring(0, 10)}...`, // 最初の10文字のみ
      maxConnections: config.supabase.maxConnections,
      timeout: config.supabase.timeout,
    },
    security: config.security,
    performance: config.performance,
    monitoring: {
      ...config.monitoring,
      // 個人情報関連は非表示
    },
    features: config.features,
  };
}