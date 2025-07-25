/**
 * プッシュ通知システム機能フラグ設定
 * 段階的ロールアウトとA/Bテストに使用
 */

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

// Supabaseクライアントの初期化
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 環境タイプの定義
type Environment = 'development' | 'test' | 'staging' | 'production';

export interface FeatureFlags {
  // 基本機能制御
  PUSH_NOTIFICATIONS_ENABLED: boolean;
  REALTIME_NOTIFICATIONS_ENABLED: boolean;
  NOTIFICATION_SETTINGS_UI_ENABLED: boolean;
  BADGE_MANAGEMENT_ENABLED: boolean;
  
  // 高度な機能
  ADVANCED_ANALYTICS_ENABLED: boolean;
  PERFORMANCE_MONITORING_ENABLED: boolean;
  QUEUE_MANAGEMENT_ENABLED: boolean;
  ERROR_RECOVERY_ENABLED: boolean;
  
  // セキュリティ機能
  TOKEN_ENCRYPTION_ENABLED: boolean;
  AUDIT_LOGGING_ENABLED: boolean;
  RLS_ENFORCEMENT_ENABLED: boolean;
  
  // ユーザーターゲティング
  TARGET_USER_PERCENTAGE: number;
  ALPHA_USERS_ONLY: boolean;
  BETA_TESTING: boolean;
  
  // A/Bテスト
  AB_TESTING_ENABLED: boolean;
  NOTIFICATION_TIMING_TEST: 'A' | 'B' | 'OFF';
  NOTIFICATION_CONTENT_TEST: 'concise' | 'detailed' | 'OFF';
  UI_VARIANT_TEST: 'v1' | 'v2' | 'OFF';
  
  // デバッグ・開発
  DEBUG_LOGGING_ENABLED: boolean;
  MOCK_NOTIFICATIONS_ENABLED: boolean;
  BYPASS_RATE_LIMITS: boolean;
}

// 環境別デフォルト設定
export const FEATURE_FLAGS_DEVELOPMENT: FeatureFlags = {
  // 基本機能 - 開発環境では全て有効
  PUSH_NOTIFICATIONS_ENABLED: true,
  REALTIME_NOTIFICATIONS_ENABLED: true,
  NOTIFICATION_SETTINGS_UI_ENABLED: true,
  BADGE_MANAGEMENT_ENABLED: true,
  
  // 高度な機能
  ADVANCED_ANALYTICS_ENABLED: true,
  PERFORMANCE_MONITORING_ENABLED: true,
  QUEUE_MANAGEMENT_ENABLED: true,
  ERROR_RECOVERY_ENABLED: true,
  
  // セキュリティ機能
  TOKEN_ENCRYPTION_ENABLED: true,
  AUDIT_LOGGING_ENABLED: true,
  RLS_ENFORCEMENT_ENABLED: true,
  
  // ユーザーターゲティング
  TARGET_USER_PERCENTAGE: 100,
  ALPHA_USERS_ONLY: false,
  BETA_TESTING: false,
  
  // A/Bテスト
  AB_TESTING_ENABLED: true,
  NOTIFICATION_TIMING_TEST: 'A',
  NOTIFICATION_CONTENT_TEST: 'concise',
  UI_VARIANT_TEST: 'v1',
  
  // デバッグ・開発
  DEBUG_LOGGING_ENABLED: true,
  MOCK_NOTIFICATIONS_ENABLED: true,
  BYPASS_RATE_LIMITS: true,
};

export const FEATURE_FLAGS_STAGING: FeatureFlags = {
  // 基本機能
  PUSH_NOTIFICATIONS_ENABLED: true,
  REALTIME_NOTIFICATIONS_ENABLED: true,
  NOTIFICATION_SETTINGS_UI_ENABLED: true,
  BADGE_MANAGEMENT_ENABLED: true,
  
  // 高度な機能
  ADVANCED_ANALYTICS_ENABLED: true,
  PERFORMANCE_MONITORING_ENABLED: true,
  QUEUE_MANAGEMENT_ENABLED: true,
  ERROR_RECOVERY_ENABLED: true,
  
  // セキュリティ機能
  TOKEN_ENCRYPTION_ENABLED: true,
  AUDIT_LOGGING_ENABLED: true,
  RLS_ENFORCEMENT_ENABLED: true,
  
  // ユーザーターゲティング
  TARGET_USER_PERCENTAGE: 100,
  ALPHA_USERS_ONLY: false,
  BETA_TESTING: true,
  
  // A/Bテスト
  AB_TESTING_ENABLED: true,
  NOTIFICATION_TIMING_TEST: 'A',
  NOTIFICATION_CONTENT_TEST: 'detailed',
  UI_VARIANT_TEST: 'v2',
  
  // デバッグ・開発
  DEBUG_LOGGING_ENABLED: false,
  MOCK_NOTIFICATIONS_ENABLED: false,
  BYPASS_RATE_LIMITS: false,
};

export const FEATURE_FLAGS_PRODUCTION_INITIAL: FeatureFlags = {
  // 基本機能 - 初期は全て無効
  PUSH_NOTIFICATIONS_ENABLED: false,
  REALTIME_NOTIFICATIONS_ENABLED: false,
  NOTIFICATION_SETTINGS_UI_ENABLED: false,
  BADGE_MANAGEMENT_ENABLED: false,
  
  // 高度な機能
  ADVANCED_ANALYTICS_ENABLED: false,
  PERFORMANCE_MONITORING_ENABLED: true, // 監視のみ有効
  QUEUE_MANAGEMENT_ENABLED: false,
  ERROR_RECOVERY_ENABLED: true, // エラー処理は有効
  
  // セキュリティ機能
  TOKEN_ENCRYPTION_ENABLED: true,
  AUDIT_LOGGING_ENABLED: true,
  RLS_ENFORCEMENT_ENABLED: true,
  
  // ユーザーターゲティング
  TARGET_USER_PERCENTAGE: 0,
  ALPHA_USERS_ONLY: false,
  BETA_TESTING: false,
  
  // A/Bテスト
  AB_TESTING_ENABLED: false,
  NOTIFICATION_TIMING_TEST: 'OFF',
  NOTIFICATION_CONTENT_TEST: 'OFF',
  UI_VARIANT_TEST: 'OFF',
  
  // デバッグ・開発
  DEBUG_LOGGING_ENABLED: false,
  MOCK_NOTIFICATIONS_ENABLED: false,
  BYPASS_RATE_LIMITS: false,
};

export const FEATURE_FLAGS_PRODUCTION_ALPHA: FeatureFlags = {
  ...FEATURE_FLAGS_PRODUCTION_INITIAL,
  // 基本機能を有効化
  PUSH_NOTIFICATIONS_ENABLED: true,
  REALTIME_NOTIFICATIONS_ENABLED: true,
  NOTIFICATION_SETTINGS_UI_ENABLED: true,
  BADGE_MANAGEMENT_ENABLED: true,
  
  // 高度な機能も有効化
  ADVANCED_ANALYTICS_ENABLED: true,
  QUEUE_MANAGEMENT_ENABLED: true,
  
  // Alpha版設定
  TARGET_USER_PERCENTAGE: 5,
  ALPHA_USERS_ONLY: true,
  
  // A/Bテスト開始
  AB_TESTING_ENABLED: true,
  NOTIFICATION_TIMING_TEST: 'A',
  NOTIFICATION_CONTENT_TEST: 'concise',
  UI_VARIANT_TEST: 'v1',
};

export const FEATURE_FLAGS_PRODUCTION_BETA: FeatureFlags = {
  ...FEATURE_FLAGS_PRODUCTION_ALPHA,
  // Beta版設定
  TARGET_USER_PERCENTAGE: 15,
  ALPHA_USERS_ONLY: false,
  BETA_TESTING: true,
  
  // A/Bテストバリエーション
  NOTIFICATION_TIMING_TEST: 'B',
  NOTIFICATION_CONTENT_TEST: 'detailed',
  UI_VARIANT_TEST: 'v2',
};

export const FEATURE_FLAGS_PRODUCTION_25: FeatureFlags = {
  ...FEATURE_FLAGS_PRODUCTION_BETA,
  TARGET_USER_PERCENTAGE: 25,
  BETA_TESTING: false,
};

export const FEATURE_FLAGS_PRODUCTION_50: FeatureFlags = {
  ...FEATURE_FLAGS_PRODUCTION_25,
  TARGET_USER_PERCENTAGE: 50,
};

export const FEATURE_FLAGS_PRODUCTION_75: FeatureFlags = {
  ...FEATURE_FLAGS_PRODUCTION_50,
  TARGET_USER_PERCENTAGE: 75,
};

export const FEATURE_FLAGS_PRODUCTION_FULL: FeatureFlags = {
  ...FEATURE_FLAGS_PRODUCTION_75,
  TARGET_USER_PERCENTAGE: 100,
};

// 緊急時ロールバック用設定
export const FEATURE_FLAGS_EMERGENCY_ROLLBACK: FeatureFlags = {
  // 全機能を無効化
  PUSH_NOTIFICATIONS_ENABLED: false,
  REALTIME_NOTIFICATIONS_ENABLED: false,
  NOTIFICATION_SETTINGS_UI_ENABLED: false,
  BADGE_MANAGEMENT_ENABLED: false,
  
  // 最小限の機能のみ有効
  ADVANCED_ANALYTICS_ENABLED: false,
  PERFORMANCE_MONITORING_ENABLED: true,
  QUEUE_MANAGEMENT_ENABLED: false,
  ERROR_RECOVERY_ENABLED: true,
  
  // セキュリティ機能は維持
  TOKEN_ENCRYPTION_ENABLED: true,
  AUDIT_LOGGING_ENABLED: true,
  RLS_ENFORCEMENT_ENABLED: true,
  
  // 全ユーザーから無効化
  TARGET_USER_PERCENTAGE: 0,
  ALPHA_USERS_ONLY: false,
  BETA_TESTING: false,
  
  // テスト停止
  AB_TESTING_ENABLED: false,
  NOTIFICATION_TIMING_TEST: 'OFF',
  NOTIFICATION_CONTENT_TEST: 'OFF',
  UI_VARIANT_TEST: 'OFF',
  
  // デバッグは有効（問題解析のため）
  DEBUG_LOGGING_ENABLED: true,
  MOCK_NOTIFICATIONS_ENABLED: false,
  BYPASS_RATE_LIMITS: false,
};

// 機能フラグ管理クラス
export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private currentFlags: FeatureFlags;
  private flagOverrides: Partial<FeatureFlags> = {};
  
  private constructor() {
    this.currentFlags = this.getDefaultFlags();
    this.loadRemoteFlags();
  }
  
  public static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }
  
  private getDefaultFlags(): FeatureFlags {
    const environment = (process.env.NODE_ENV as Environment) || 'development';
    
    switch (environment) {
      case 'development':
        return FEATURE_FLAGS_DEVELOPMENT;
      case 'staging':
        return FEATURE_FLAGS_STAGING;
      case 'production':
        return FEATURE_FLAGS_PRODUCTION_INITIAL;
      default:
        return FEATURE_FLAGS_DEVELOPMENT;
    }
  }
  
  public async loadRemoteFlags(): Promise<void> {
    try {
      // Supabaseから最新の機能フラグを取得
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('environment', process.env.NODE_ENV || 'development')
        .single();
      
      if (error) {
        console.warn('機能フラグのリモート取得に失敗:', error.message);
        return;
      }
      
      if (data) {
        this.currentFlags = { ...this.currentFlags, ...data.flags };
        console.log('機能フラグを更新しました');
      }
    } catch (error) {
      console.error('機能フラグの取得エラー:', error);
    }
  }
  
  public getFlag<K extends keyof FeatureFlags>(flagName: K): FeatureFlags[K] {
    // オーバーライドがあればそれを返す
    if (flagName in this.flagOverrides) {
      return this.flagOverrides[flagName] as FeatureFlags[K];
    }
    
    return this.currentFlags[flagName];
  }
  
  public getAllFlags(): FeatureFlags {
    return { ...this.currentFlags, ...this.flagOverrides };
  }
  
  public setFlagOverride<K extends keyof FeatureFlags>(
    flagName: K, 
    value: FeatureFlags[K]
  ): void {
    this.flagOverrides[flagName] = value;
    console.log(`機能フラグをオーバーライド: ${flagName} = ${value}`);
  }
  
  public clearFlagOverride<K extends keyof FeatureFlags>(flagName: K): void {
    delete this.flagOverrides[flagName];
    console.log(`機能フラグオーバーライドを削除: ${flagName}`);
  }
  
  public clearAllOverrides(): void {
    this.flagOverrides = {};
    console.log('全ての機能フラグオーバーライドを削除');
  }
  
  public async updateRemoteFlag<K extends keyof FeatureFlags>(
    flagName: K, 
    value: FeatureFlags[K]
  ): Promise<void> {
    try {
      const environment = (process.env.NODE_ENV as Environment) || 'development';
      
      // 現在のフラグを取得
      const { data: currentData } = await supabase
        .from('feature_flags')
        .select('flags')
        .eq('environment', environment)
        .single();
      
      const updatedFlags = {
        ...currentData?.flags,
        [flagName]: value
      };
      
      // フラグを更新
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          environment,
          flags: updatedFlags,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      // ローカルフラグも更新
      this.currentFlags[flagName] = value;
      
      console.log(`リモート機能フラグを更新: ${flagName} = ${value}`);
    } catch (error) {
      console.error('リモート機能フラグの更新エラー:', error);
      throw error;
    }
  }
  
  public isUserInTargetGroup(userId: string): boolean {
    const targetPercentage = this.getFlag('TARGET_USER_PERCENTAGE');
    
    if (targetPercentage === 0) return false;
    if (targetPercentage === 100) return true;
    
    // ユーザーIDベースの一貫したハッシュ生成
    const hash = this.simpleHash(userId);
    const userPercentile = (hash % 100) + 1;
    
    return userPercentile <= targetPercentage;
  }
  
  public isAlphaUser(userId: string): boolean {
    if (!this.getFlag('ALPHA_USERS_ONLY')) return false;
    
    // Alpha ユーザーリストをチェック（実装に応じて調整）
    return this.isUserInTargetGroup(userId);
  }
  
  public isBetaUser(userId: string): boolean {
    if (!this.getFlag('BETA_TESTING')) return false;
    
    return this.isUserInTargetGroup(userId);
  }
  
  public getABTestVariant<K extends keyof Pick<FeatureFlags, 
    'NOTIFICATION_TIMING_TEST' | 'NOTIFICATION_CONTENT_TEST' | 'UI_VARIANT_TEST'>>(
    testName: K,
    userId: string
  ): FeatureFlags[K] {
    const testEnabled = this.getFlag('AB_TESTING_ENABLED');
    if (!testEnabled) return 'OFF' as FeatureFlags[K];
    
    const currentVariant = this.getFlag(testName);
    if (currentVariant === 'OFF') return currentVariant;
    
    // ユーザーIDベースでバリアント決定
    const hash = this.simpleHash(`${testName}_${userId}`);
    const variants = this.getTestVariants(testName);
    const variantIndex = hash % variants.length;
    
    return variants[variantIndex] as FeatureFlags[K];
  }
  
  private getTestVariants<K extends keyof Pick<FeatureFlags, 
    'NOTIFICATION_TIMING_TEST' | 'NOTIFICATION_CONTENT_TEST' | 'UI_VARIANT_TEST'>>(
    testName: K
  ): string[] {
    switch (testName) {
      case 'NOTIFICATION_TIMING_TEST':
        return ['A', 'B'];
      case 'NOTIFICATION_CONTENT_TEST':
        return ['concise', 'detailed'];
      case 'UI_VARIANT_TEST':
        return ['v1', 'v2'];
      default:
        return ['OFF'];
    }
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash);
  }
  
  // 緊急ロールバック
  public async emergencyRollback(): Promise<void> {
    try {
      console.warn('緊急ロールバックを実行中...');
      
      // ローカルフラグを緊急設定に変更
      this.currentFlags = FEATURE_FLAGS_EMERGENCY_ROLLBACK;
      
      // リモートフラグも更新
      const environment = (process.env.NODE_ENV as Environment) || 'development';
      await supabase
        .from('feature_flags')
        .upsert({
          environment,
          flags: FEATURE_FLAGS_EMERGENCY_ROLLBACK,
          updated_at: new Date().toISOString(),
          emergency_rollback: true
        });
      
      console.warn('緊急ロールバックが完了しました');
    } catch (error) {
      console.error('緊急ロールバックエラー:', error);
    }
  }
}

// グローバルインスタンス
export const featureFlagManager = FeatureFlagManager.getInstance();

// React Hook for feature flags
export function useFeatureFlag<K extends keyof FeatureFlags>(
  flagName: K
): FeatureFlags[K] {
  const [flagValue, setFlagValue] = useState<FeatureFlags[K]>(
    featureFlagManager.getFlag(flagName)
  );
  
  useEffect(() => {
    // 機能フラグの変更を監視
    const interval = setInterval(async () => {
      await featureFlagManager.loadRemoteFlags();
      const newValue = featureFlagManager.getFlag(flagName);
      if (newValue !== flagValue) {
        setFlagValue(newValue);
      }
    }, 30000); // 30秒ごとにチェック
    
    return () => clearInterval(interval);
  }, [flagName, flagValue]);
  
  return flagValue;
}

// React Hook for user targeting
export function useUserTargeting(userId: string) {
  return {
    isInTargetGroup: featureFlagManager.isUserInTargetGroup(userId),
    isAlphaUser: featureFlagManager.isAlphaUser(userId),
    isBetaUser: featureFlagManager.isBetaUser(userId),
    getABTestVariant: <K extends keyof Pick<FeatureFlags, 
      'NOTIFICATION_TIMING_TEST' | 'NOTIFICATION_CONTENT_TEST' | 'UI_VARIANT_TEST'>>(
      testName: K
    ) => featureFlagManager.getABTestVariant(testName, userId)
  };
}

// React Hook for feature flags with user context
export function useFeatureFlagWithUser<K extends keyof FeatureFlags>(
  flagName: K,
  userId: string
): FeatureFlags[K] {
  const flagValue = useFeatureFlag(flagName);
  const { isInTargetGroup } = useUserTargeting(userId);
  
  // ユーザーターゲティングが有効な場合はそれも考慮
  if (flagName === 'PUSH_NOTIFICATIONS_ENABLED' || 
      flagName === 'REALTIME_NOTIFICATIONS_ENABLED' ||
      flagName === 'NOTIFICATION_SETTINGS_UI_ENABLED') {
    return (flagValue && isInTargetGroup) as FeatureFlags[K];
  }
  
  return flagValue;
}

// データベーススキーマ（参考）
/*
CREATE TABLE feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  flags JSONB NOT NULL,
  emergency_rollback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(environment)
);

-- 初期データ挿入
INSERT INTO feature_flags (environment, flags) VALUES 
('development', '{}'),
('staging', '{}'),
('production', '{}');
*/