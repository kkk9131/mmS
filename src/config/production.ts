/**
 * 本番環境設定
 * デバッグログの無効化とパフォーマンス最適化
 */

export const PRODUCTION_CONFIG = {
  // デバッグログを完全に無効化
  DEBUG_MODE: false,
  
  // 開発用機能を無効化
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_REPORTING: true,
  
  // ログレベル設定
  LOG_LEVEL: 'error', // error のみログ出力
  
  // その他の本番環境設定
  API_TIMEOUT: 10000, // 10秒
  CACHE_DURATION: 300000, // 5分
};

/**
 * 本番環境でのフィーチャーフラグ設定
 */
export const PRODUCTION_FEATURE_FLAGS = {
  USE_API: true,
  USE_SUPABASE: true,
  USE_REDUX: true,
  USE_NOTIFICATIONS: true,
  USE_ANALYTICS: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  DEBUG_MODE: false, // 本番環境では必ずfalse
};

/**
 * 環境変数をチェックして本番環境判定
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production' || 
         process.env.EXPO_PUBLIC_ENV === 'production';
};

/**
 * 本番環境設定を適用
 */
export const applyProductionConfig = () => {
  if (isProduction()) {
    // FeatureFlagsManagerに本番設定を適用
    const { FeatureFlagsManager } = require('../services/featureFlags');
    const flagManager = FeatureFlagsManager.getInstance();
    
    Object.keys(PRODUCTION_FEATURE_FLAGS).forEach(key => {
      flagManager.setFlag(key, PRODUCTION_FEATURE_FLAGS[key]);
    });
    
    console.log('✅ 本番環境設定を適用しました');
  }
};