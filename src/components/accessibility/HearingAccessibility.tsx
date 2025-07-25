import * as React from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  Platform,
  Vibration
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { useHapticFeedback } from '../../hooks/useAccessibility';
import { AccessibleText } from './AccessibleText';

/**
 * 聴覚アクセシビリティの種類
 */
export type HearingNotificationType = 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'message' 
  | 'call'
  | 'alert';

/**
 * 視覚的通知設定
 */
export interface VisualNotificationConfig {
  type: HearingNotificationType;
  message: string;
  duration?: number;
  showIcon?: boolean;
  autoHide?: boolean;
  onDismiss?: () => void;
}

/**
 * 聴覚アクセシビリティコンテキスト
 */
interface HearingAccessibilityContextType {
  showVisualNotification: (config: VisualNotificationConfig) => void;
  triggerVisualAlert: (type: HearingNotificationType, intensity?: 'light' | 'medium' | 'strong') => void;
  enableClosedCaptions: (enabled: boolean) => void;
  isClosedCaptionsEnabled: boolean;
}

const HearingAccessibilityContext = React.createContext<HearingAccessibilityContextType | undefined>(undefined);

/**
 * 聴覚アクセシビリティプロバイダー
 */
export const HearingAccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = React.useState<(VisualNotificationConfig & { id: string })[]>([]);
  const [isClosedCaptionsEnabled, setIsClosedCaptionsEnabled] = React.useState(false);
  const { settings } = useAccessibility();
  const { triggerHaptic } = useHapticFeedback();

  // 視覚的通知の表示
  const showVisualNotification = React.useCallback((config: VisualNotificationConfig) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification = { ...config, id };
    
    setNotifications(prev => [...prev, notification]);

    // ハプティックフィードバック
    const hapticMap = {
      info: 'light' as const,
      success: 'light' as const,
      warning: 'medium' as const,
      error: 'heavy' as const,
      message: 'selection' as const,
      call: 'heavy' as const,
      alert: 'heavy' as const
    };
    
    triggerHaptic(hapticMap[config.type]);

    // バイブレーション（Android）
    if (Platform.OS === 'android') {
      const vibrationPatterns = {
        info: [100],
        success: [100, 50, 100],
        warning: [200, 100, 200],
        error: [300, 100, 300, 100, 300],
        message: [50],
        call: [500, 200, 500, 200, 500],
        alert: [1000]
      };
      
      Vibration.vibrate(vibrationPatterns[config.type]);
    }

    // 自動非表示
    if (config.autoHide !== false) {
      const duration = config.duration || 3000;
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        config.onDismiss?.();
      }, duration);
    }
  }, [triggerHaptic]);

  // 視覚的アラートのトリガー
  const triggerVisualAlert = React.useCallback((
    type: HearingNotificationType, 
    intensity: 'light' | 'medium' | 'strong' = 'medium'
  ) => {
    // 画面の点滅効果
    // React Nativeでは直接的な画面点滅は制限されるため、
    // 視覚的なフィードバックコンポーネントを表示

    const alertMessages = {
      info: 'お知らせがあります',
      success: '操作が完了しました',
      warning: '注意が必要です',
      error: 'エラーが発生しました',
      message: '新しいメッセージがあります',
      call: '着信があります',
      alert: '緊急アラート'
    };

    showVisualNotification({
      type,
      message: alertMessages[type],
      duration: intensity === 'strong' ? 5000 : intensity === 'medium' ? 3000 : 2000,
      autoHide: true
    });
  }, [showVisualNotification]);

  // 字幕機能の有効/無効切り替え
  const enableClosedCaptions = React.useCallback((enabled: boolean) => {
    setIsClosedCaptionsEnabled(enabled);
  }, []);

  const contextValue: HearingAccessibilityContextType = {
    showVisualNotification,
    triggerVisualAlert,
    enableClosedCaptions,
    isClosedCaptionsEnabled
  };

  return (
    <HearingAccessibilityContext.Provider value={contextValue}>
      {children}
      <VisualNotificationContainer notifications={notifications} />
    </HearingAccessibilityContext.Provider>
  );
};

/**
 * 聴覚アクセシビリティフック
 */
export const useHearingAccessibility = (): HearingAccessibilityContextType => {
  const context = React.useContext(HearingAccessibilityContext);
  
  if (context === undefined) {
    throw new Error('useHearingAccessibility must be used within a HearingAccessibilityProvider');
  }
  
  return context;
};

/**
 * 視覚的通知コンテナ
 */
interface VisualNotificationContainerProps {
  notifications: (VisualNotificationConfig & { id: string })[];
}

const VisualNotificationContainer: React.FC<VisualNotificationContainerProps> = ({ notifications }) => {
  return (
    <View style={styles.notificationContainer} pointerEvents="none">
      {notifications.map((notification) => (
        <VisualNotificationItem key={notification.id} notification={notification} />
      ))}
    </View>
  );
};

/**
 * 視覚的通知アイテム
 */
interface VisualNotificationItemProps {
  notification: VisualNotificationConfig & { id: string };
}

const VisualNotificationItem: React.FC<VisualNotificationItemProps> = ({ notification }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    // エントリーアニメーション
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();

    return () => {
      // 退場アニメーション
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    };
  }, [fadeAnim, slideAnim]);

  const notificationStyle = React.useMemo(() => {
    const typeStyles = {
      info: { backgroundColor: '#007AFF', borderColor: '#0051D0' },
      success: { backgroundColor: '#34C759', borderColor: '#248A3D' },
      warning: { backgroundColor: '#FFCC00', borderColor: '#D1AB00' },
      error: { backgroundColor: '#FF3B30', borderColor: '#D70015' },
      message: { backgroundColor: '#5856D6', borderColor: '#3634A3' },
      call: { backgroundColor: '#00C7BE', borderColor: '#009688' },
      alert: { backgroundColor: '#FF2D92', borderColor: '#E91E63' }
    };

    return [
      styles.notification,
      typeStyles[notification.type],
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }
    ];
  }, [notification.type, fadeAnim, slideAnim]);

  const iconMap = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    message: '💬',
    call: '📞',
    alert: '🚨'
  };

  return (
    <Animated.View style={notificationStyle}>
      {notification.showIcon !== false && (
        <AccessibleText style={styles.notificationIcon}>
          {iconMap[notification.type]}
        </AccessibleText>
      )}
      <AccessibleText
        style={styles.notificationText}
        accessibilityLabel={`${notification.type}通知: ${notification.message}`}
      >
        {notification.message}
      </AccessibleText>
    </Animated.View>
  );
};

/**
 * 画面点滅効果コンポーネント
 */
export interface ScreenFlashProps {
  color?: string;
  duration?: number;
  intensity?: 'light' | 'medium' | 'strong';
  pattern?: 'single' | 'double' | 'triple';
}

export const ScreenFlash: React.FC<ScreenFlashProps> = ({
  color = '#FFFFFF',
  duration = 200,
  intensity = 'medium',
  pattern = 'single'
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const flashAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const opacityMap = {
      light: 0.3,
      medium: 0.6,
      strong: 0.9
    };

    const patternMap = {
      single: [duration],
      double: [duration / 2, duration / 4, duration / 2],
      triple: [duration / 3, duration / 6, duration / 3, duration / 6, duration / 3]
    };

    const flash = (durations: number[], index = 0) => {
      if (index >= durations.length) {
        setIsVisible(false);
        return;
      }

      setIsVisible(true);
      
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: opacityMap[intensity],
          duration: durations[index] / 2,
          useNativeDriver: true
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: durations[index] / 2,
          useNativeDriver: true
        })
      ]).start(() => {
        if (index < durations.length - 1) {
          setTimeout(() => flash(durations, index + 1), 50);
        } else {
          setIsVisible(false);
        }
      });
    };

    flash(patternMap[pattern]);
  }, [color, duration, intensity, pattern, flashAnim]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.screenFlash,
        {
          backgroundColor: color,
          opacity: flashAnim
        }
      ]}
      pointerEvents="none"
    />
  );
};

/**
 * 字幕表示コンポーネント
 */
export interface ClosedCaptionsProps {
  text: string;
  visible?: boolean;
  position?: 'top' | 'bottom' | 'center';
  style?: ViewStyle;
}

export const ClosedCaptions: React.FC<ClosedCaptionsProps> = ({
  text,
  visible = true,
  position = 'bottom',
  style
}) => {
  const { isClosedCaptionsEnabled } = useHearingAccessibility();

  if (!visible || !isClosedCaptionsEnabled || !text) return null;

  const positionStyle = {
    top: { top: 60 },
    center: { top: '50%' as any, transform: [{ translateY: -25 }] },
    bottom: { bottom: 60 }
  };

  return (
    <View style={[styles.captionsContainer, positionStyle[position], style]}>
      <View style={styles.captionsBackground}>
        <AccessibleText
          style={styles.captionsText}
          accessibilityLabel={`字幕: ${text}`}
          accessibilityRole="text"
        >
          {text}
        </AccessibleText>
      </View>
    </View>
  );
};

/**
 * 音声内容の視覚化フック
 */
export const useAudioVisualization = () => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [waveform, setWaveform] = React.useState<number[]>([]);
  const { showVisualNotification } = useHearingAccessibility();

  const startAudioVisualization = React.useCallback((audioSource?: string) => {
    setIsPlaying(true);
    
    // 音声再生開始の視覚的通知
    showVisualNotification({
      type: 'info',
      message: '音声コンテンツが再生されています',
      duration: 1000
    });

    // 波形データの模擬生成（実際の実装では音声解析が必要）
    const generateWaveform = () => {
      const data = Array.from({ length: 50 }, () => Math.random() * 100);
      setWaveform(data);
    };

    const interval = setInterval(generateWaveform, 100);

    return () => {
      clearInterval(interval);
      setIsPlaying(false);
      setWaveform([]);
    };
  }, [showVisualNotification]);

  return {
    isPlaying,
    waveform,
    startAudioVisualization
  };
};

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12
  },
  notificationText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  screenFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999
  },
  captionsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 800
  },
  captionsBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '90%'
  },
  captionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22
  }
});

export default HearingAccessibilityProvider;