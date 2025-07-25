 
import * as CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase/client';

export interface SecurityConfig {
  encryptTokens: boolean;
  anonymizeUserData: boolean;
  enableAuditLog: boolean;
  dataRetentionDays: number;
  maxTokensPerUser: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface DataAnonymizer {
  anonymizeNotificationData(data: Record<string, any>): Record<string, any>;
  anonymizeUserInfo(userInfo: any): any;
  hashSensitiveData(data: string): string;
}

class NotificationSecurityManager implements DataAnonymizer {
  private static instance: NotificationSecurityManager;
  private readonly ENCRYPTION_KEY = 'mamapace_notification_key_2024';
  private readonly SECURE_TOKEN_KEY = 'secure_push_tokens';
  private readonly AUDIT_LOG_KEY = '@notification_audit_log';
  
  private readonly config: SecurityConfig = {
    encryptTokens: true,
    anonymizeUserData: true,
    enableAuditLog: true,
    dataRetentionDays: 30,
    maxTokensPerUser: 5,
  };

  public static getInstance(): NotificationSecurityManager {
    if (!NotificationSecurityManager.instance) {
      NotificationSecurityManager.instance = new NotificationSecurityManager();
    }
    return NotificationSecurityManager.instance;
  }

  // プッシュトークンの暗号化保存
  async secureStoreToken(userId: string, token: string, deviceId: string): Promise<void> {
    try {
      if (this.config.encryptTokens) {
        const encryptedToken = this.encryptData(token);
        
        // Expo SecureStoreを使用して安全に保存
        await SecureStore.setItemAsync(
          `${this.SECURE_TOKEN_KEY}_${userId}_${deviceId}`,
          JSON.stringify({
            encryptedToken,
            userId,
            deviceId,
            createdAt: new Date().toISOString(),
          }),
          {
            requireAuthentication: false, // 生体認証は通知には重すぎるため無効
            keychainService: 'mamapace-notifications',
          }
        );
      } else {
        // 暗号化なしの場合はAsyncStorageに保存
        await AsyncStorage.setItem(
          `${this.SECURE_TOKEN_KEY}_${userId}_${deviceId}`,
          JSON.stringify({
            token,
            userId,
            deviceId,
            createdAt: new Date().toISOString(),
          })
        );
      }

      // 監査ログに記録
      await this.logAuditEvent({
        userId,
        action: 'token_stored',
        resource: 'push_token',
        metadata: { deviceId },
      });

      console.log('プッシュトークンを安全に保存しました');
    } catch (error) {
      console.error('トークン暗号化保存エラー:', error);
      throw error;
    }
  }

  async secureRetrieveToken(userId: string, deviceId: string): Promise<string | null> {
    try {
      const key = `${this.SECURE_TOKEN_KEY}_${userId}_${deviceId}`;
      
      let storedData: string | null = null;
      
      if (this.config.encryptTokens) {
        storedData = await SecureStore.getItemAsync(key);
      } else {
        storedData = await AsyncStorage.getItem(key);
      }

      if (!storedData) {
        return null;
      }

      const parsed = JSON.parse(storedData);
      
      if (this.config.encryptTokens) {
        return this.decryptData(parsed.encryptedToken);
      } else {
        return parsed.token;
      }
    } catch (error) {
      console.error('トークン復号化取得エラー:', error);
      return null;
    }
  }

  async secureDeleteToken(userId: string, deviceId: string): Promise<void> {
    try {
      const key = `${this.SECURE_TOKEN_KEY}_${userId}_${deviceId}`;
      
      if (this.config.encryptTokens) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }

      // 監査ログに記録
      await this.logAuditEvent({
        userId,
        action: 'token_deleted',
        resource: 'push_token',
        metadata: { deviceId },
      });

      console.log('プッシュトークンを安全に削除しました');
    } catch (error) {
      console.error('トークン削除エラー:', error);
      throw error;
    }
  }

  // データ暗号化・復号化
  private encryptData(data: string): string {
    try {
      return CryptoJS.AES.encrypt(data, this.ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error('データ暗号化エラー:', error);
      throw error;
    }
  }

  private decryptData(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('データ復号化エラー:', error);
      throw error;
    }
  }

  // データ匿名化
  anonymizeNotificationData(data: Record<string, any>): Record<string, any> {
    if (!this.config.anonymizeUserData) {
      return data;
    }

    const anonymized = { ...data };

    // 個人を特定可能な情報を匿名化
    const sensitiveFields = ['email', 'phone', 'address', 'fullName', 'realName'];
    
    for (const field of sensitiveFields) {
      if (anonymized[field]) {
        anonymized[field] = this.hashSensitiveData(anonymized[field]);
      }
    }

    // ネストされたオブジェクトも処理
    for (const key in anonymized) {
      if (typeof anonymized[key] === 'object' && anonymized[key] !== null) {
        anonymized[key] = this.anonymizeNotificationData(anonymized[key]);
      }
    }

    return anonymized;
  }

  anonymizeUserInfo(userInfo: any): any {
    if (!this.config.anonymizeUserData) {
      return userInfo;
    }

    return {
      ...userInfo,
      id: userInfo.id, // IDは保持
      nickname: userInfo.nickname, // ニックネームは保持
      email: userInfo.email ? this.hashSensitiveData(userInfo.email) : undefined,
      phone: userInfo.phone ? this.hashSensitiveData(userInfo.phone) : undefined,
      avatar_url: userInfo.avatar_url, // アバターURLは保持
    };
  }

  hashSensitiveData(data: string): string {
    try {
      return CryptoJS.SHA256(data + this.ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error('データハッシュ化エラー:', error);
      return '[ANONYMIZED]';
    }
  }

  // 監査ログ機能
  async logAuditEvent(event: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enableAuditLog) {
      return;
    }

    try {
      const auditEntry: AuditLogEntry = {
        id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        ...event,
      };

      // ローカルログに保存
      await this.saveAuditLogLocally(auditEntry);

      // Supabaseにも送信（本番環境のみ）
      if (!__DEV__) {
        await this.sendAuditLogToSupabase(auditEntry);
      }

    } catch (error) {
      console.error('監査ログ記録エラー:', error);
    }
  }

  private async saveAuditLogLocally(entry: AuditLogEntry): Promise<void> {
    try {
      const logs = await this.getLocalAuditLogs();
      logs.unshift(entry);

      // 保持期間を超えた古いログを削除
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);

      const filteredLogs = logs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );

      await AsyncStorage.setItem(this.AUDIT_LOG_KEY, JSON.stringify(filteredLogs));
    } catch (error) {
      console.error('ローカル監査ログ保存エラー:', error);
    }
  }

  private async getLocalAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const logsData = await AsyncStorage.getItem(this.AUDIT_LOG_KEY);
      return logsData ? JSON.parse(logsData) : [];
    } catch (error) {
      console.error('ローカル監査ログ取得エラー:', error);
      return [];
    }
  }

  private async sendAuditLogToSupabase(entry: AuditLogEntry): Promise<void> {
    try {
      await supabase.functions.invoke('log-audit-event', {
        body: {
          ...entry,
          anonymized: this.config.anonymizeUserData,
        },
      });
    } catch (error) {
      console.error('Supabase監査ログ送信エラー:', error);
    }
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // アクセス制御とRLSポリシーの強化
  async validateNotificationAccess(userId: string, notificationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('id', notificationId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        await this.logAuditEvent({
          userId,
          action: 'access_denied',
          resource: 'notification',
          metadata: { notificationId, reason: 'not_found_or_unauthorized' },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('通知アクセス検証エラー:', error);
      return false;
    }
  }

  async validateTokenOwnership(userId: string, tokenId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('push_tokens')
        .select('user_id')
        .eq('id', tokenId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        await this.logAuditEvent({
          userId,
          action: 'access_denied',
          resource: 'push_token',
          metadata: { tokenId, reason: 'not_found_or_unauthorized' },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('トークン所有権検証エラー:', error);
      return false;
    }
  }

  // データ最小化処理
  minimizeNotificationData(notification: any): any {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      // 個人を特定可能な詳細データは除外
      data: this.minimizeDataObject(notification.data || {}),
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  private minimizeDataObject(data: Record<string, any>): Record<string, any> {
    const minimized: Record<string, any> = {};
    const allowedFields = ['postId', 'actionUrl', 'type', 'notificationId'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        minimized[field] = data[field];
      }
    }

    return minimized;
  }

  // セキュリティ監査とレポート
  async generateSecurityReport(): Promise<{
    timestamp: string;
    config: SecurityConfig;
    auditLogCount: number;
    recentSecurityEvents: AuditLogEntry[];
    recommendations: string[];
  }> {
    const auditLogs = await this.getLocalAuditLogs();
    const recentEvents = auditLogs.slice(0, 10);
    
    const recommendations: string[] = [];

    // セキュリティ推奨事項の生成
    if (!this.config.encryptTokens) {
      recommendations.push('プッシュトークンの暗号化を有効にすることを推奨します');
    }

    if (!this.config.anonymizeUserData) {
      recommendations.push('ユーザーデータの匿名化を有効にすることを推奨します');
    }

    if (!this.config.enableAuditLog) {
      recommendations.push('監査ログの有効化を推奨します');
    }

    const accessDeniedCount = recentEvents.filter(e => e.action === 'access_denied').length;
    if (accessDeniedCount > 5) {
      recommendations.push('アクセス拒否が多発しています。不正アクセスの可能性を調査してください');
    }

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      auditLogCount: auditLogs.length,
      recentSecurityEvents: recentEvents,
      recommendations,
    };
  }

  // トークン制限とクリーンアップ
  async enforceTokenLimits(userId: string): Promise<void> {
    try {
      const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (tokens && tokens.length > this.config.maxTokensPerUser) {
        // 古いトークンを無効化
        const tokensToDisable = tokens.slice(this.config.maxTokensPerUser);
        
        for (const token of tokensToDisable) {
          await supabase
            .from('push_tokens')
            .update({ is_active: false })
            .eq('id', token.id);
        }

        await this.logAuditEvent({
          userId,
          action: 'tokens_limited',
          resource: 'push_token',
          metadata: { 
            disabledCount: tokensToDisable.length,
            maxAllowed: this.config.maxTokensPerUser 
          },
        });

        console.log(`ユーザー ${userId} の古いトークン ${tokensToDisable.length}個を無効化しました`);
      }
    } catch (error) {
      console.error('トークン制限適用エラー:', error);
    }
  }

  // 設定管理
  updateSecurityConfig(newConfig: Partial<SecurityConfig>): void {
    Object.assign(this.config, newConfig);
    console.log('セキュリティ設定を更新しました:', this.config);
  }

  getSecurityConfig(): SecurityConfig {
    return { ...this.config };
  }

  // クリーンアップ
  async clearSecurityData(): Promise<void> {
    try {
      // ローカル監査ログをクリア
      await AsyncStorage.removeItem(this.AUDIT_LOG_KEY);
      
      // 保存されているトークンをクリア
      const keys = await AsyncStorage.getAllKeys();
      const tokenKeys = keys.filter(key => key.startsWith(this.SECURE_TOKEN_KEY));
      
      for (const key of tokenKeys) {
        await AsyncStorage.removeItem(key);
      }

      console.log('セキュリティデータをクリアしました');
    } catch (error) {
      console.error('セキュリティデータクリアエラー:', error);
    }
  }
}

export const notificationSecurityManager = NotificationSecurityManager.getInstance();