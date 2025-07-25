import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

export interface BadgeSettings {
  enabled: boolean;
  maxCount: number;
  showZero: boolean;
  syncAcrossDevices: boolean;
}

export interface BadgeManager {
  updateBadgeCount(): Promise<void>;
  setBadgeCount(count: number): Promise<void>;
  clearBadge(): Promise<void>;
  getBadgeCount(): Promise<number>;
  syncBadgeAcrossDevices(userId: string): Promise<void>;
  handleBadgeSync(userId: string, count: number): Promise<void>;
}

class BadgeManagerImpl implements BadgeManager {
  private static instance: BadgeManagerImpl;
  private readonly MAX_BADGE_COUNT = 99;
  private currentBadgeCount = 0;
  private realtimeSubscription: any = null;

  public static getInstance(): BadgeManagerImpl {
    if (!BadgeManagerImpl.instance) {
      BadgeManagerImpl.instance = new BadgeManagerImpl();
    }
    return BadgeManagerImpl.instance;
  }

  constructor() {
    this.initializeBadgeSync();
  }

  private async initializeBadgeSync(): Promise<void> {
    try {
      // 現在のバッジ数を取得
      if (Platform.OS === 'ios') {
        this.currentBadgeCount = await Notifications.getBadgeCountAsync();
      }

      // リアルタイムバッジ同期の開始
      await this.startBadgeSync();
    } catch (error) {
      console.error('バッジ同期初期化エラー:', error);
    }
  }

  private async startBadgeSync(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 通知の変更を監視してバッジを自動更新
      this.realtimeSubscription = supabase
        .channel(`badge_sync_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('通知変更検知 - バッジ更新:', payload);
            await this.updateBadgeCount();
          }
        )
        .subscribe();

    } catch (error) {
      console.error('バッジ同期開始エラー:', error);
    }
  }

  async updateBadgeCount(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 未読通知数を取得
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      const unreadCount = count || 0;
      const displayCount = Math.min(unreadCount, this.MAX_BADGE_COUNT);

      await this.setBadgeCount(displayCount);

      // 他のデバイスにバッジ数を同期
      await this.syncBadgeAcrossDevices(user.id);

      console.log(`バッジ数更新: ${displayCount} (実際の未読数: ${unreadCount})`);
    } catch (error) {
      console.error('バッジ数更新エラー:', error);
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    try {
      const displayCount = Math.max(0, Math.min(count, this.MAX_BADGE_COUNT));
      
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(displayCount);
      } else if (Platform.OS === 'android') {
        // Androidの場合、ショートカットバッジAPIを使用
        // または通知の一部として設定
        await this.setAndroidBadge(displayCount);
      }

      this.currentBadgeCount = displayCount;
    } catch (error) {
      console.error('バッジ数設定エラー:', error);
    }
  }

  private async setAndroidBadge(count: number): Promise<void> {
    try {
      // Android用のバッジ設定
      // 実際の実装では、使用している通知ライブラリに応じて調整
      if (count > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Mamapace',
            body: `${count}件の未読通知があります`,
            data: { badge: count },
            badge: count,
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error('Androidバッジ設定エラー:', error);
    }
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  async getBadgeCount(): Promise<number> {
    try {
      if (Platform.OS === 'ios') {
        return await Notifications.getBadgeCountAsync();
      } else {
        return this.currentBadgeCount;
      }
    } catch (error) {
      console.error('バッジ数取得エラー:', error);
      return 0;
    }
  }

  async syncBadgeAcrossDevices(userId: string): Promise<void> {
    try {
      const currentCount = await this.getBadgeCount();
      
      // Supabaseのリアルタイム機能を使用してバッジ数を他のデバイスに送信
      const channel = supabase.channel(`badge_broadcast_${userId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'badge_update',
        payload: {
          userId,
          badgeCount: currentCount,
          timestamp: Date.now(),
          deviceId: await this.getDeviceId(),
        },
      });

      console.log(`バッジ数を他のデバイスに同期: ${currentCount}`);
    } catch (error) {
      console.error('バッジ同期エラー:', error);
    }
  }

  async handleBadgeSync(userId: string, count: number): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) return;

      // 他のデバイスからのバッジ数更新を受信
      const currentDeviceId = await this.getDeviceId();
      
      // 自分のデバイスからの更新は無視
      const channel = supabase.channel(`badge_receive_${userId}`);
      
      channel
        .on('broadcast', { event: 'badge_update' }, async (payload: any) => {
          if (payload.payload.deviceId !== currentDeviceId) {
            console.log('他のデバイスからバッジ数更新を受信:', payload.payload.badgeCount);
            await this.setBadgeCount(payload.payload.badgeCount);
          }
        })
        .subscribe();

    } catch (error) {
      console.error('バッジ同期処理エラー:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      const Constants = await import('expo-constants');
      return Constants.default.deviceId || Constants.default.installationId || 'unknown';
    } catch (error) {
      console.error('デバイスID取得エラー:', error);
      return 'unknown';
    }
  }

  // バッジの増減操作

  async incrementBadge(amount: number = 1): Promise<void> {
    const currentCount = await this.getBadgeCount();
    await this.setBadgeCount(currentCount + amount);
  }

  async decrementBadge(amount: number = 1): Promise<void> {
    const currentCount = await this.getBadgeCount();
    await this.setBadgeCount(Math.max(0, currentCount - amount));
  }

  // 通知タイプ別のバッジ管理

  async handleNotificationReceived(notificationType: string): Promise<void> {
    try {
      // 通知タイプに応じてバッジを増加
      const increments: Record<string, number> = {
        'message': 1,
        'mention': 1,
        'comment': 1,
        'like': 1,
        'follow': 1,
        'system': 1,
      };

      const increment = increments[notificationType] || 1;
      await this.incrementBadge(increment);
    } catch (error) {
      console.error('通知受信時バッジ処理エラー:', error);
    }
  }

  async handleNotificationRead(notificationIds: string[]): Promise<void> {
    try {
      // 読まれた通知の数だけバッジを減少
      await this.decrementBadge(notificationIds.length);
    } catch (error) {
      console.error('通知既読時バッジ処理エラー:', error);
    }
  }

  async handleAllNotificationsRead(): Promise<void> {
    await this.clearBadge();
  }

  // バッジ制御設定

  private badgeSettings: BadgeSettings = {
    enabled: true,
    maxCount: 99,
    showZero: false,
    syncAcrossDevices: true,
  };

  updateBadgeSettings(settings: Partial<BadgeSettings>): void {
    this.badgeSettings = { ...this.badgeSettings, ...settings };
  }

  getBadgeSettings(): BadgeSettings {
    return { ...this.badgeSettings };
  }

  // バッジ統計

  async getBadgeStats(): Promise<{
    currentCount: number;
    maxCount: number;
    isAtMax: boolean;
    lastUpdated: Date;
    syncEnabled: boolean;
  }> {
    const currentCount = await this.getBadgeCount();
    
    return {
      currentCount,
      maxCount: this.MAX_BADGE_COUNT,
      isAtMax: currentCount >= this.MAX_BADGE_COUNT,
      lastUpdated: new Date(),
      syncEnabled: this.badgeSettings.syncAcrossDevices,
    };
  }

  // クリーンアップ

  cleanup(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
  }

  // デバッグ用

  async debugBadgeInfo(): Promise<{
    platform: string;
    currentCount: number;
    maxCount: number;
    settings: BadgeSettings;
    deviceId: string;
  }> {
    return {
      platform: Platform.OS,
      currentCount: await this.getBadgeCount(),
      maxCount: this.MAX_BADGE_COUNT,
      settings: this.badgeSettings,
      deviceId: await this.getDeviceId(),
    };
  }
}

export const badgeManager = BadgeManagerImpl.getInstance();