import { supabase } from '../supabase/client';
import { NotificationType } from './NotificationHandler';

export interface NotificationSettings {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  mentions: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string; // "HH:MM" format
  quietHoursEnd: string;   // "HH:MM" format
}

export interface NotificationSettingsManager {
  getSettings(userId: string): Promise<NotificationSettings>;
  updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void>;
  isQuietHours(): boolean;
  isNotificationTypeEnabled(type: NotificationType): boolean;
  isEmergencyNotification(notification: any): boolean;
}

class NotificationSettingsManagerImpl implements NotificationSettingsManager {
  private static instance: NotificationSettingsManagerImpl;
  private settingsCache: Map<string, NotificationSettings> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  public static getInstance(): NotificationSettingsManagerImpl {
    if (!NotificationSettingsManagerImpl.instance) {
      NotificationSettingsManagerImpl.instance = new NotificationSettingsManagerImpl();
    }
    return NotificationSettingsManagerImpl.instance;
  }

  async getSettings(userId: string): Promise<NotificationSettings> {
    try {
      // キャッシュチェック
      const cached = this.getCachedSettings(userId);
      if (cached) {
        return cached;
      }

      // データベースから設定を取得
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // データが見つからない場合以外
        throw new Error(`設定取得失敗: ${error.message}`);
      }

      // デフォルト設定
      const defaultSettings: NotificationSettings = {
        likes: true,
        comments: true,
        follows: true,
        messages: true,
        mentions: true,
        pushEnabled: true,
        emailEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      };

      const settings: NotificationSettings = data ? {
        likes: data.likes_enabled,
        comments: data.comments_enabled,
        follows: data.follows_enabled,
        messages: data.messages_enabled,
        mentions: data.mentions_enabled,
        pushEnabled: data.push_enabled,
        emailEnabled: data.email_enabled,
        quietHoursStart: data.quiet_hours_start,
        quietHoursEnd: data.quiet_hours_end,
      } : defaultSettings;

      // データが存在しない場合はデフォルト設定で作成
      if (!data) {
        await this.createDefaultSettings(userId, defaultSettings);
      }

      // キャッシュに保存
      this.setCachedSettings(userId, settings);
      return settings;

    } catch (error) {
      console.error('通知設定取得エラー:', error);
      throw error;
    }
  }

  async updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    try {
      // データベース更新用のオブジェクトを作成
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (settings.likes !== undefined) updateData.likes_enabled = settings.likes;
      if (settings.comments !== undefined) updateData.comments_enabled = settings.comments;
      if (settings.follows !== undefined) updateData.follows_enabled = settings.follows;
      if (settings.messages !== undefined) updateData.messages_enabled = settings.messages;
      if (settings.mentions !== undefined) updateData.mentions_enabled = settings.mentions;
      if (settings.pushEnabled !== undefined) updateData.push_enabled = settings.pushEnabled;
      if (settings.emailEnabled !== undefined) updateData.email_enabled = settings.emailEnabled;
      if (settings.quietHoursStart !== undefined) updateData.quiet_hours_start = settings.quietHoursStart;
      if (settings.quietHoursEnd !== undefined) updateData.quiet_hours_end = settings.quietHoursEnd;

      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          ...updateData,
        });

      if (error) {
        throw new Error(`設定更新失敗: ${error.message}`);
      }

      // キャッシュを無効化
      this.invalidateCache(userId);

      console.log('通知設定が正常に更新されました');
    } catch (error) {
      console.error('通知設定更新エラー:', error);
      throw error;
    }
  }

  isQuietHours(): boolean {
    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // 分単位に変換

      // デフォルトのおやすみ時間（22:00-07:00）
      const defaultQuietStart = 22 * 60; // 22:00 = 1320分
      const defaultQuietEnd = 7 * 60;    // 07:00 = 420分

      // 22:00-07:00の場合（日をまたぐ）
      if (defaultQuietStart > defaultQuietEnd) {
        return currentTime >= defaultQuietStart || currentTime < defaultQuietEnd;
      } else {
        // 通常の時間範囲
        return currentTime >= defaultQuietStart && currentTime < defaultQuietEnd;
      }
    } catch (error) {
      console.error('おやすみモードチェックエラー:', error);
      return false;
    }
  }

  isNotificationTypeEnabled(type: NotificationType): boolean {
    try {
      // 現在のユーザーIDを取得（実装に応じて調整）
      // const userId = getCurrentUserId();
      // const settings = this.getCachedSettings(userId);
      
      // キャッシュがない場合はデフォルトでtrue
      // if (!settings) return true;

      const typeMapping = {
        [NotificationType.LIKE]: true, // settings.likes,
        [NotificationType.COMMENT]: true, // settings.comments,
        [NotificationType.FOLLOW]: true, // settings.follows,
        [NotificationType.MESSAGE]: true, // settings.messages,
        [NotificationType.MENTION]: true, // settings.mentions,
        [NotificationType.POST_REPLY]: true, // settings.comments,
        [NotificationType.SYSTEM]: true, // システム通知は常に有効
      };

      return typeMapping[type] ?? true;
    } catch (error) {
      console.error('通知タイプ有効チェックエラー:', error);
      return true; // エラー時はデフォルトで有効
    }
  }

  isEmergencyNotification(notification: any): boolean {
    try {
      // 緊急通知の判定ロジック
      const emergencyTypes = [NotificationType.SYSTEM];
      const emergencyKeywords = ['緊急', '重要', 'セキュリティ', '警告'];

      // 通知タイプで判定
      if (emergencyTypes.includes(notification.type)) {
        return true;
      }

      // タイトルやメッセージに緊急キーワードが含まれているかチェック
      const content = `${notification.title} ${notification.message}`.toLowerCase();
      return emergencyKeywords.some(keyword => content.includes(keyword));

    } catch (error) {
      console.error('緊急通知判定エラー:', error);
      return false;
    }
  }

  private async createDefaultSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_settings')
        .insert({
          user_id: userId,
          likes_enabled: settings.likes,
          comments_enabled: settings.comments,
          follows_enabled: settings.follows,
          messages_enabled: settings.messages,
          mentions_enabled: settings.mentions,
          push_enabled: settings.pushEnabled,
          email_enabled: settings.emailEnabled,
          quiet_hours_start: settings.quietHoursStart,
          quiet_hours_end: settings.quietHoursEnd,
        });

      if (error) {
        throw new Error(`デフォルト設定作成失敗: ${error.message}`);
      }
    } catch (error) {
      console.error('デフォルト設定作成エラー:', error);
      throw error;
    }
  }

  private getCachedSettings(userId: string): NotificationSettings | null {
    const expiry = this.cacheExpiry.get(userId);
    if (!expiry || Date.now() > expiry) {
      this.settingsCache.delete(userId);
      this.cacheExpiry.delete(userId);
      return null;
    }
    return this.settingsCache.get(userId) || null;
  }

  private setCachedSettings(userId: string, settings: NotificationSettings): void {
    this.settingsCache.set(userId, settings);
    this.cacheExpiry.set(userId, Date.now() + this.CACHE_DURATION);
  }

  private invalidateCache(userId: string): void {
    this.settingsCache.delete(userId);
    this.cacheExpiry.delete(userId);
  }

  // ユーザー設定に基づいておやすみモードかどうかをチェック
  async isQuietHoursForUser(userId: string): Promise<boolean> {
    try {
      const settings = await this.getSettings(userId);
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
      const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);

      const quietStart = startHour * 60 + startMin;
      const quietEnd = endHour * 60 + endMin;

      if (quietStart > quietEnd) {
        // 日をまたぐ場合
        return currentTime >= quietStart || currentTime < quietEnd;
      } else {
        return currentTime >= quietStart && currentTime < quietEnd;
      }
    } catch (error) {
      console.error('ユーザー別おやすみモードチェックエラー:', error);
      return false;
    }
  }

  // 通知タイプがユーザー設定で有効かどうかをチェック
  async isNotificationTypeEnabledForUser(userId: string, type: NotificationType): Promise<boolean> {
    try {
      const settings = await this.getSettings(userId);

      if (!settings.pushEnabled) {
        return false; // プッシュ通知が無効の場合
      }

      const typeMapping = {
        [NotificationType.LIKE]: settings.likes,
        [NotificationType.COMMENT]: settings.comments,
        [NotificationType.FOLLOW]: settings.follows,
        [NotificationType.MESSAGE]: settings.messages,
        [NotificationType.MENTION]: settings.mentions,
        [NotificationType.POST_REPLY]: settings.comments,
        [NotificationType.SYSTEM]: true, // システム通知は常に有効
      };

      return typeMapping[type] ?? true;
    } catch (error) {
      console.error('ユーザー別通知タイプ有効チェックエラー:', error);
      return true;
    }
  }
}

export const notificationSettingsManager = NotificationSettingsManagerImpl.getInstance();