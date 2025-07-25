import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

export interface PushTokenManager {
  getExpoPushToken(): Promise<string>;
  registerToken(userId: string, token: string): Promise<void>;
  updateToken(userId: string, token: string): Promise<void>;
  removeToken(userId: string): Promise<void>;
  checkPermissions(): Promise<Notifications.NotificationPermissionsStatus>;
  requestPermissions(): Promise<Notifications.NotificationPermissionsStatus>;
}

class PushTokenManagerImpl implements PushTokenManager {
  private static instance: PushTokenManagerImpl;
  private currentToken: string | null = null;

  public static getInstance(): PushTokenManagerImpl {
    if (!PushTokenManagerImpl.instance) {
      PushTokenManagerImpl.instance = new PushTokenManagerImpl();
    }
    return PushTokenManagerImpl.instance;
  }

  async getExpoPushToken(): Promise<string> {
    try {
      // デバイスチェック
      if (!Device.isDevice) {
        throw new Error('プッシュ通知は実機でのみ動作します');
      }

      // 権限チェック
      const { status: existingStatus } = await this.checkPermissions();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await this.requestPermissions();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        throw new Error('プッシュ通知の権限が拒否されました');
      }

      // Androidの場合、通知チャンネルを設定
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Mamapace通知',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4F46E5',
        });
      }

      // プッシュトークンを取得
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      this.currentToken = token.data;
      return token.data;
    } catch (error) {
      console.error('プッシュトークン取得エラー:', error);
      throw error;
    }
  }

  async registerToken(userId: string, token: string): Promise<void> {
    try {
      const deviceId = Constants.deviceId || Constants.installationId;
      const platform = Platform.OS;

      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token,
          platform,
          device_id: deviceId,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
        throw new Error(`トークン登録失敗: ${error.message}`);
      }

      console.log('プッシュトークンが正常に登録されました');
    } catch (error) {
      console.error('トークン登録エラー:', error);
      throw error;
    }
  }

  async updateToken(userId: string, token: string): Promise<void> {
    try {
      const deviceId = Constants.deviceId || Constants.installationId;

      const { error } = await supabase
        .from('push_tokens')
        .update({
          token,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('device_id', deviceId);

      if (error) {
        throw new Error(`トークン更新失敗: ${error.message}`);
      }

      this.currentToken = token;
      console.log('プッシュトークンが正常に更新されました');
    } catch (error) {
      console.error('トークン更新エラー:', error);
      throw error;
    }
  }

  async removeToken(userId: string): Promise<void> {
    try {
      const deviceId = Constants.deviceId || Constants.installationId;

      const { error } = await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('device_id', deviceId);

      if (error) {
        throw new Error(`トークン削除失敗: ${error.message}`);
      }

      this.currentToken = null;
      console.log('プッシュトークンが正常に削除されました');
    } catch (error) {
      console.error('トークン削除エラー:', error);
      throw error;
    }
  }

  async checkPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
    return await Notifications.getPermissionsAsync();
  }

  async requestPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
    return await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }
}

export const pushTokenManager = PushTokenManagerImpl.getInstance();