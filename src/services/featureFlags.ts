import { FeatureFlags } from '../types/api';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 拡張機能フラグインターface
export interface ExtendedFeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  userGroups?: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
  version?: string;
}

export interface FeatureFlagConfig {
  flags: Record<string, ExtendedFeatureFlag>;
  lastSync: string;
  userId?: string;
}

export interface RollbackConfig {
  targetVersion: string;
  reason: string;
  affectedFeatures: string[];
  timestamp: string;
  rollbackSteps: RollbackStep[];
}

export interface RollbackStep {
  id: string;
  description: string;
  action: 'disable_feature' | 'revert_database' | 'switch_api_version' | 'clear_cache';
  params: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export class FeatureFlagsManager {
  private static instance: FeatureFlagsManager;
  private flags: FeatureFlags;
  private extendedConfig: FeatureFlagConfig;
  private supabase?: any;
  private readonly CACHE_KEY = 'feature_flags_config';
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5分
  private syncTimer?: ReturnType<typeof setInterval>;

  private constructor() {
    this.flags = this.loadFlags();
    this.extendedConfig = {
      flags: {},
      lastSync: new Date().toISOString()
    };
  }

  public static getInstance(): FeatureFlagsManager {
    if (!FeatureFlagsManager.instance) {
      FeatureFlagsManager.instance = new FeatureFlagsManager();
    }
    return FeatureFlagsManager.instance;
  }

  /**
   * Supabase連携の初期化
   */
  public async initializeWithSupabase(supabaseUrl: string, supabaseKey: string, userId?: string): Promise<void> {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
    this.extendedConfig.userId = userId;
    
    try {
      // キャッシュから設定を読み込み
      const cachedConfig = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cachedConfig) {
        this.extendedConfig = JSON.parse(cachedConfig);
      }
    } catch (error) {
      console.warn('Failed to load cached feature flags:', error);
    }

    // 最新の設定を同期
    await this.syncExtendedFlags();

    // 定期同期を開始
    this.startPeriodicSync();
  }

  private loadFlags(): FeatureFlags {
    const isDevelopment = __DEV__ ?? false;
    
    // Load from environment variables if available
    const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';
    const useRedux = process.env.EXPO_PUBLIC_USE_REDUX !== 'false'; // default true
    const debugMode = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || isDevelopment;
    
    return {
      USE_API: !isDevelopment || useSupabase,
      USE_SUPABASE: useSupabase,
      USE_REDUX: useRedux,
      DEBUG_MODE: debugMode,
      MOCK_DELAY: isDevelopment ? 500 : 0,
    };
  }

  public getFlag<K extends keyof FeatureFlags>(flagName: K): FeatureFlags[K] {
    return this.flags[flagName];
  }

  public getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public setFlag<K extends keyof FeatureFlags>(flagName: K, value: FeatureFlags[K]): void {
    this.flags[flagName] = value;
  }

  public updateFlags(updates: Partial<FeatureFlags>): void {
    this.flags = { ...this.flags, ...updates };
  }

  public resetFlags(): void {
    this.flags = this.loadFlags();
  }

  public enableApiMode(): void {
    this.flags.USE_API = true;
    this.flags.DEBUG_MODE = false;
    this.flags.MOCK_DELAY = 0;
  }

  public enableMockMode(): void {
    this.flags.USE_API = false;
    this.flags.DEBUG_MODE = true;
    this.flags.MOCK_DELAY = 500;
  }

  public enableDebugMode(): void {
    this.flags.DEBUG_MODE = true;
  }

  public disableDebugMode(): void {
    this.flags.DEBUG_MODE = false;
  }

  public isApiEnabled(): boolean {
    return this.flags.USE_API;
  }

  public isDebugModeEnabled(): boolean {
    return this.flags.DEBUG_MODE;
  }

  public getMockDelay(): number {
    return this.flags.MOCK_DELAY;
  }

  public enableSupabaseMode(): void {
    this.flags.USE_SUPABASE = true;
    this.flags.USE_API = true;
  }

  public disableSupabaseMode(): void {
    this.flags.USE_SUPABASE = false;
  }

  public enableReduxMode(): void {
    this.flags.USE_REDUX = true;
  }

  public disableReduxMode(): void {
    this.flags.USE_REDUX = false;
  }

  public isSupabaseEnabled(): boolean {
    return this.flags.USE_SUPABASE;
  }

  public isReduxEnabled(): boolean {
    return this.flags.USE_REDUX;
  }

  /**
   * 拡張機能フラグの状態をチェック
   */
  public isExtendedFeatureEnabled(featureName: string, userContext?: Record<string, any>): boolean {
    const flag = this.extendedConfig.flags[featureName];
    
    if (!flag) {
      console.warn(`Extended feature flag '${featureName}' not found, defaulting to false`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // ロールアウト割合に基づく判定
    if (flag.rolloutPercentage < 100) {
      const hash = this.getUserHash(this.extendedConfig.userId || 'anonymous', featureName);
      if (hash > flag.rolloutPercentage) {
        return false;
      }
    }

    // ユーザーグループ制限チェック
    if (flag.userGroups && flag.userGroups.length > 0) {
      const userGroup = userContext?.group || 'default';
      if (!flag.userGroups.includes(userGroup)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 全ての拡張機能フラグ状態を取得
   */
  public getAllExtendedFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    
    Object.keys(this.extendedConfig.flags).forEach(featureName => {
      result[featureName] = this.isExtendedFeatureEnabled(featureName);
    });

    return result;
  }

  /**
   * 拡張機能フラグの詳細情報を取得
   */
  public getExtendedFeatureDetails(featureName: string): ExtendedFeatureFlag | null {
    return this.extendedConfig.flags[featureName] || null;
  }

  /**
   * サーバーから最新の設定を同期
   */
  private async syncExtendedFlags(): Promise<void> {
    if (!this.supabase) return;

    try {
      // 実際の実装では適切なテーブル構造に合わせて調整
      const { data, error } = await this.supabase
        .from('feature_flags_extended')
        .select('*');

      if (error) {
        console.warn('Failed to sync extended feature flags:', error);
        return;
      }

      if (data) {
        const flags: Record<string, ExtendedFeatureFlag> = {};
        data.forEach((flag: any) => {
          flags[flag.name] = {
            name: flag.name,
            enabled: flag.enabled,
            rolloutPercentage: flag.rollout_percentage || 100,
            userGroups: flag.user_groups ? JSON.parse(flag.user_groups) : undefined,
            description: flag.description,
            createdAt: flag.created_at,
            updatedAt: flag.updated_at,
            version: flag.version
          };
        });

        this.extendedConfig.flags = flags;
        this.extendedConfig.lastSync = new Date().toISOString();
        
        await this.saveToCache();
        
        console.log(`Synced ${Object.keys(flags).length} extended feature flags`);
      }
    } catch (error) {
      console.error('Error syncing extended feature flags:', error);
    }
  }

  /**
   * ローカルキャッシュに保存
   */
  private async saveToCache(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(this.extendedConfig));
    } catch (error) {
      console.warn('Failed to cache extended feature flags:', error);
    }
  }

  /**
   * 定期同期開始
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      this.syncExtendedFlags().catch(console.error);
    }, this.SYNC_INTERVAL);
  }

  /**
   * 定期同期停止
   */
  public stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * ユーザーハッシュ生成（一貫性のあるロールアウト用）
   */
  private getUserHash(userId: string, featureName: string): number {
    const str = `${userId}-${featureName}`;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer
    }
    
    return Math.abs(hash) % 100;
  }

  /**
   * 緊急時機能無効化
   */
  public async emergencyDisableFeature(featureName: string, reason: string): Promise<void> {
    console.warn(`Emergency disabling feature: ${featureName}. Reason: ${reason}`);
    
    if (this.extendedConfig.flags[featureName]) {
      this.extendedConfig.flags[featureName].enabled = false;
      this.extendedConfig.flags[featureName].updatedAt = new Date().toISOString();
      await this.saveToCache();
      
      // 緊急無効化をサーバーに通知
      if (this.supabase) {
        try {
          await this.supabase
            .from('feature_flags_extended')
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq('name', featureName);
        } catch (error) {
          console.error('Failed to update extended feature flag on server:', error);
        }
      }
    }
    
    // 基本機能フラグも確認
    if (featureName in this.flags) {
      (this.flags as any)[featureName] = false;
    }
  }

  /**
   * 拡張統計情報を取得
   */
  public getExtendedStats(): {
    totalFlags: number;
    enabledFlags: number;
    lastSync: string;
    cacheAge: number;
    basicFlags: FeatureFlags;
  } {
    const totalFlags = Object.keys(this.extendedConfig.flags).length;
    const enabledFlags = Object.values(this.extendedConfig.flags).filter(flag => flag.enabled).length;
    const cacheAge = Date.now() - new Date(this.extendedConfig.lastSync).getTime();

    return {
      totalFlags,
      enabledFlags,
      lastSync: this.extendedConfig.lastSync,
      cacheAge: Math.round(cacheAge / 1000), // seconds
      basicFlags: this.getAllFlags()
    };
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    config: FeatureFlagConfig;
    userContext: Record<string, any>;
    activeExtendedFlags: Record<string, boolean>;
    basicFlags: FeatureFlags;
  } {
    return {
      config: { ...this.extendedConfig },
      userContext: {
        userId: this.extendedConfig.userId,
        timestamp: new Date().toISOString()
      },
      activeExtendedFlags: this.getAllExtendedFlags(),
      basicFlags: this.getAllFlags()
    };
  }
}

/**
 * ロールバック管理クラス
 */
export class RollbackManager {
  private supabase?: any;
  private featureFlagManager: FeatureFlagsManager;

  constructor(featureFlagManager: FeatureFlagsManager, supabase?: any) {
    this.supabase = supabase;
    this.featureFlagManager = featureFlagManager;
  }

  /**
   * ロールバック計画を作成
   */
  public async createRollbackPlan(
    targetVersion: string,
    reason: string,
    affectedFeatures: string[]
  ): Promise<RollbackConfig> {
    const rollbackSteps: RollbackStep[] = [];

    // 影響を受ける機能を無効化
    affectedFeatures.forEach(feature => {
      rollbackSteps.push({
        id: `disable-${feature}`,
        description: `機能 ${feature} を無効化`,
        action: 'disable_feature',
        params: { featureName: feature },
        status: 'pending'
      });
    });

    // キャッシュクリア
    rollbackSteps.push({
      id: 'clear-cache',
      description: 'アプリケーションキャッシュをクリア',
      action: 'clear_cache',
      params: {},
      status: 'pending'
    });

    const rollbackConfig: RollbackConfig = {
      targetVersion,
      reason,
      affectedFeatures,
      timestamp: new Date().toISOString(),
      rollbackSteps
    };

    return rollbackConfig;
  }

  /**
   * ロールバックを実行
   */
  public async executeRollback(rollbackConfig: RollbackConfig): Promise<boolean> {
    console.log(`Starting rollback to version ${rollbackConfig.targetVersion}`);
    console.log(`Reason: ${rollbackConfig.reason}`);

    let allStepsSuccessful = true;

    for (const step of rollbackConfig.rollbackSteps) {
      try {
        console.log(`Executing step: ${step.description}`);
        
        switch (step.action) {
          case 'disable_feature':
            await this.featureFlagManager.emergencyDisableFeature(
              step.params.featureName,
              rollbackConfig.reason
            );
            break;
          
          case 'clear_cache':
            await this.clearApplicationCache();
            break;
          
          case 'revert_database':
            console.log('Database revert not implemented');
            break;
          
          case 'switch_api_version':
            console.log('API version switch not implemented');
            break;
        }

        step.status = 'completed';
        console.log(`✅ Step completed: ${step.description}`);
        
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        allStepsSuccessful = false;
        
        console.error(`❌ Step failed: ${step.description}`, error);
      }
    }

    // ロールバック結果をログに記録
    await this.logRollbackResult(rollbackConfig, allStepsSuccessful);

    return allStepsSuccessful;
  }

  /**
   * アプリケーションキャッシュをクリア
   */
  private async clearApplicationCache(): Promise<void> {
    try {
      await AsyncStorage.clear();
      console.log('Application cache cleared');
    } catch (error) {
      console.error('Failed to clear application cache:', error);
      throw error;
    }
  }

  /**
   * ロールバック結果をログに記録
   */
  private async logRollbackResult(
    rollbackConfig: RollbackConfig,
    success: boolean
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      rollback_version: rollbackConfig.targetVersion,
      reason: rollbackConfig.reason,
      affected_features: rollbackConfig.affectedFeatures,
      success,
      steps: rollbackConfig.rollbackSteps,
      completed_at: new Date().toISOString()
    };

    try {
      if (this.supabase) {
        await this.supabase
          .from('rollback_logs')
          .insert(logEntry);
        
        console.log('Rollback result logged successfully');
      } else {
        console.warn('Supabase not initialized, rollback log saved locally only');
      }
    } catch (error) {
      console.error('Failed to log rollback result:', error);
    }
  }
}

// 拡張機能フラグ定数
export const ExtendedFeatureFlags = {
  // リアルタイム機能関連
  REALTIME_NOTIFICATIONS: 'realtime_notifications',
  REALTIME_POSTS: 'realtime_posts',
  REALTIME_COMMENTS: 'realtime_comments',
  
  // Redux機能関連
  REDUX_DEVTOOLS: 'redux_devtools',
  REDUX_PERSISTENCE: 'redux_persistence',
  REDUX_MIDDLEWARE_LOGGING: 'redux_middleware_logging',
  
  // UI機能関連
  NEW_POST_EDITOR: 'new_post_editor',
  ENHANCED_PROFILE: 'enhanced_profile',
  DARK_MODE: 'dark_mode',
  
  // 実験的機能
  EXPERIMENTAL_FEATURES: 'experimental_features',
  BETA_API: 'beta_api',
  
  // パフォーマンス関連
  PERFORMANCE_MONITORING: 'performance_monitoring',
  CACHING_OPTIMIZATION: 'caching_optimization'
} as const;

export type ExtendedFeatureFlagName = typeof ExtendedFeatureFlags[keyof typeof ExtendedFeatureFlags];

// ファクトリー関数
export function createRollbackManager(featureFlagManager: FeatureFlagsManager, supabase?: any) {
  return new RollbackManager(featureFlagManager, supabase);
}