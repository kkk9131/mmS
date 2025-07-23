import { Platform } from 'react-native';

// React Native の Vibration と Audio は実際の実装時に import する
// import { Vibration } from 'react-native';
// import { Audio } from 'expo-av';
// import * as Haptics from 'expo-haptics';

/**
 * 通知音とバイブレーションのユーティリティ
 */
export class NotificationUtils {
  private static soundInstance: any = null;
  private static isAudioEnabled = true;
  private static isVibrationEnabled = true;
  private static isHapticsEnabled = true;

  /**
   * 音声の有効/無効を設定
   */
  static setAudioEnabled(enabled: boolean) {
    this.isAudioEnabled = enabled;
  }

  /**
   * バイブレーションの有効/無効を設定
   */
  static setVibrationEnabled(enabled: boolean) {
    this.isVibrationEnabled = enabled;
  }

  /**
   * ハプティクスの有効/無効を設定
   */
  static setHapticsEnabled(enabled: boolean) {
    this.isHapticsEnabled = enabled;
  }

  /**
   * 通知音を再生
   * @param soundType - 通知音の種類
   */
  static async playNotificationSound(soundType: 'default' | 'like' | 'comment' | 'follow' = 'default') {
    if (!this.isAudioEnabled) return;

    try {
      // 実際の実装では以下のようになります:
      /*
      const { sound } = await Audio.Sound.createAsync(
        soundType === 'like' 
          ? require('../assets/sounds/like.mp3')
          : soundType === 'comment'
          ? require('../assets/sounds/comment.mp3') 
          : soundType === 'follow'
          ? require('../assets/sounds/follow.mp3')
          : require('../assets/sounds/notification.mp3'),
        { shouldPlay: true, volume: 0.5 }
      );

      this.soundInstance = sound;
      await sound.playAsync();
      
      // クリーンアップ
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
      */

      // 現在はモック実装
      console.log(`[NotificationUtils] Playing ${soundType} notification sound`);
    } catch (error) {
      console.warn('[NotificationUtils] Error playing notification sound:', error);
    }
  }

  /**
   * バイブレーションを実行
   * @param pattern - バイブレーションパターン
   */
  static async vibrate(pattern: 'default' | 'success' | 'error' | 'warning' = 'default') {
    if (!this.isVibrationEnabled) return;

    try {
      let vibrationPattern: number[] = [0, 250]; // デフォルト

      switch (pattern) {
        case 'success':
          vibrationPattern = [0, 100, 50, 100];
          break;
        case 'error':
          vibrationPattern = [0, 500, 100, 200, 100, 200];
          break;
        case 'warning':
          vibrationPattern = [0, 250, 250, 250];
          break;
        default:
          vibrationPattern = [0, 250];
      }

      // 実際の実装では以下のようになります:
      /*
      if (Platform.OS === 'ios') {
        // iOS では Haptics を使用
        switch (pattern) {
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'error':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          case 'warning':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          default:
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        // Android では Vibration を使用
        Vibration.vibrate(vibrationPattern);
      }
      */

      // 現在はモック実装
      console.log(`[NotificationUtils] Vibrating with ${pattern} pattern:`, vibrationPattern);
    } catch (error) {
      console.warn('[NotificationUtils] Error triggering vibration:', error);
    }
  }

  /**
   * ハプティクフィードバックを実行（iOS用）
   * @param intensity - フィードバックの強度
   */
  static async hapticFeedback(intensity: 'light' | 'medium' | 'heavy' = 'medium') {
    if (!this.isHapticsEnabled || Platform.OS !== 'ios') return;

    try {
      // 実際の実装では以下のようになります:
      /*
      switch (intensity) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      */

      // 現在はモック実装
      console.log(`[NotificationUtils] Haptic feedback with ${intensity} intensity`);
    } catch (error) {
      console.warn('[NotificationUtils] Error triggering haptic feedback:', error);
    }
  }

  /**
   * 通知音とバイブレーションを組み合わせて実行
   * @param options - 通知オプション
   */
  static async playNotification(options: {
    sound?: boolean;
    soundType?: 'default' | 'like' | 'comment' | 'follow';
    vibration?: boolean;
    vibrationPattern?: 'default' | 'success' | 'error' | 'warning';
    haptics?: boolean;
    hapticsIntensity?: 'light' | 'medium' | 'heavy';
  }) {
    const {
      sound = true,
      soundType = 'default',
      vibration = true,
      vibrationPattern = 'default',
      haptics = true,
      hapticsIntensity = 'medium'
    } = options;

    // 並行して実行
    const promises: Promise<void>[] = [];

    if (sound) {
      promises.push(this.playNotificationSound(soundType));
    }

    if (vibration) {
      promises.push(this.vibrate(vibrationPattern));
    }

    if (haptics && Platform.OS === 'ios') {
      promises.push(this.hapticFeedback(hapticsIntensity));
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn('[NotificationUtils] Error playing notification:', error);
    }
  }

  /**
   * アプリバッジ数を更新
   * @param count - バッジ数
   */
  static async updateBadgeCount(count: number) {
    try {
      // 実際の実装では以下のようになります:
      /*
      if (Platform.OS === 'ios') {
        const { PushNotificationIOS } = require('@react-native-community/push-notification-ios');
        PushNotificationIOS.setApplicationIconBadgeNumber(count);
      } else if (Platform.OS === 'android') {
        const ShortcutBadger = require('react-native-shortcut-badger');
        ShortcutBadger.applyCount(count);
      }
      */

      // 現在はモック実装
      console.log(`[NotificationUtils] Updating badge count to: ${count}`);
    } catch (error) {
      console.warn('[NotificationUtils] Error updating badge count:', error);
    }
  }

  /**
   * フォアグラウンド通知を表示
   * @param notification - 通知データ
   */
  static async showForegroundNotification(notification: {
    title: string;
    message: string;
    data?: any;
  }) {
    try {
      // 実際の実装では以下のようになります:
      /*
      // React Native用のin-app通知ライブラリを使用
      // 例: react-native-flash-message, react-native-notifee など
      
      import { showMessage } from 'react-native-flash-message';
      
      showMessage({
        message: notification.title,
        description: notification.message,
        type: 'info',
        duration: 4000,
        icon: 'auto',
        onPress: () => {
          // 通知タップ時の処理
          if (notification.data?.actionUrl) {
            // ナビゲーション処理
          }
        },
      });
      */

      // 現在はモック実装
      console.log('[NotificationUtils] Showing foreground notification:', notification);
    } catch (error) {
      console.warn('[NotificationUtils] Error showing foreground notification:', error);
    }
  }

  /**
   * 音声ファイルのクリーンアップ
   */
  static async cleanup() {
    try {
      if (this.soundInstance) {
        await this.soundInstance.unloadAsync();
        this.soundInstance = null;
      }
    } catch (error) {
      console.warn('[NotificationUtils] Error during cleanup:', error);
    }
  }

  /**
   * 通知設定の状態を取得
   */
  static getSettings() {
    return {
      audioEnabled: this.isAudioEnabled,
      vibrationEnabled: this.isVibrationEnabled,
      hapticsEnabled: this.isHapticsEnabled,
    };
  }

  /**
   * 通知設定をリセット（デフォルト値に戻す）
   */
  static resetSettings() {
    this.isAudioEnabled = true;
    this.isVibrationEnabled = true;
    this.isHapticsEnabled = true;
  }
}

/**
 * 通知タイプに応じた音とバイブレーションのプリセット
 */
export const NotificationPresets = {
  like: {
    sound: true,
    soundType: 'like' as const,
    vibration: true,
    vibrationPattern: 'default' as const,
    haptics: true,
    hapticsIntensity: 'light' as const,
  },
  comment: {
    sound: true,
    soundType: 'comment' as const,
    vibration: true,
    vibrationPattern: 'default' as const,
    haptics: true,
    hapticsIntensity: 'medium' as const,
  },
  follow: {
    sound: true,
    soundType: 'follow' as const,
    vibration: true,
    vibrationPattern: 'success' as const,
    haptics: true,
    hapticsIntensity: 'medium' as const,
  },
  message: {
    sound: true,
    soundType: 'default' as const,
    vibration: true,
    vibrationPattern: 'default' as const,
    haptics: true,
    hapticsIntensity: 'medium' as const,
  },
  error: {
    sound: false,
    vibration: true,
    vibrationPattern: 'error' as const,
    haptics: true,
    hapticsIntensity: 'heavy' as const,
  },
};