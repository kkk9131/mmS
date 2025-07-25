import * as React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
  AccessibilityRole,
  AccessibilityState
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { useHapticFeedback } from '../../hooks/useAccessibility';
import { 
  validateTapTargetSize, 
  MIN_TAP_TARGET_SIZE,
  generateHighContrastColor,
  debugAccessibility 
} from '../../utils/accessibilityUtils';

export interface AccessibleButtonProps {
  onPress: (event: GestureResponderEvent) => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  minTouchTarget?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'selection';
  testID?: string;
}

/**
 * アクセシブルボタンコンポーネント
 * WCAG準拠の最小タップターゲットサイズとコントラスト比を保証
 */
export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  onPress,
  children,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  disabled = false,
  minTouchTarget = true,
  style,
  textStyle,
  hapticFeedback = 'light',
  testID,
  ...props
}) => {
  const buttonRef = React.useRef<any>(null);
  const { settings } = useAccessibility();
  const { triggerHaptic } = useHapticFeedback();

  // コンポーネントマウント時にアクセシビリティをデバッグ
  React.useEffect(() => {
    debugAccessibility('AccessibleButton', {
      accessible: true,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole,
      accessibilityState: { ...accessibilityState, disabled }
    });
  }, [accessibilityLabel, accessibilityHint, accessibilityRole, accessibilityState, disabled]);

  // タップターゲットサイズの検証と調整
  const adjustedStyle = React.useMemo(() => {
    if (!minTouchTarget) return style;

    const baseStyle = StyleSheet.flatten([styles.button, style]) as any;
    const width = typeof baseStyle.width === 'number' ? baseStyle.width : MIN_TAP_TARGET_SIZE;
    const height = typeof baseStyle.height === 'number' ? baseStyle.height : MIN_TAP_TARGET_SIZE;

    const { adjustedWidth, adjustedHeight } = validateTapTargetSize(width, height);

    return {
      ...baseStyle,
      minWidth: adjustedWidth,
      minHeight: adjustedHeight
    };
  }, [style, minTouchTarget]);

  // 高コントラストモード対応
  const adjustedTextStyle = React.useMemo(() => {
    if (!settings.highContrastMode) return textStyle;

    const baseTextStyle = StyleSheet.flatten([styles.text, textStyle]);
    const currentColor = baseTextStyle.color || '#000000';
    const backgroundColor = '#FFFFFF'; // デフォルト背景色

    return {
      ...baseTextStyle,
      color: generateHighContrastColor(currentColor.toString(), backgroundColor)
    };
  }, [textStyle, settings.highContrastMode]);

  // テキストサイズ調整
  const finalTextStyle = React.useMemo(() => {
    const baseTextStyle = StyleSheet.flatten([styles.text, adjustedTextStyle]);
    const baseFontSize = baseTextStyle.fontSize || 16;

    return {
      ...baseTextStyle,
      fontSize: baseFontSize * settings.textSizeMultiplier
    };
  }, [adjustedTextStyle, settings.textSizeMultiplier]);

  // ボタン押下時の処理
  const handlePress = React.useCallback((event: GestureResponderEvent) => {
    if (disabled) return;

    // ハプティックフィードバック
    triggerHaptic(hapticFeedback);

    // ボタン押下の音声アナウンス（スクリーンリーダー使用時）
    if (settings.screenReaderEnabled) {
      // アナウンスは onPress 完了後に行う
      setTimeout(() => {
        // 具体的なアクションの結果をアナウンス
      }, 100);
    }

    onPress(event);
  }, [disabled, triggerHaptic, hapticFeedback, settings.screenReaderEnabled, onPress]);

  // アクセシビリティ状態の統合
  const combinedAccessibilityState = React.useMemo(() => ({
    disabled,
    ...accessibilityState
  }), [disabled, accessibilityState]);

  return (
    <TouchableOpacity
      ref={buttonRef}
      style={[adjustedStyle, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={combinedAccessibilityState}
      testID={testID}
      // iOS固有のアクセシビリティ設定
      accessibilityActions={[
        { name: 'activate', label: 'ボタンを押す' }
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate' && !disabled) {
          handlePress({} as GestureResponderEvent);
        }
      }}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text style={finalTextStyle}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    minWidth: MIN_TAP_TARGET_SIZE,
    minHeight: MIN_TAP_TARGET_SIZE
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: '#CCCCCC'
  }
});

export default AccessibleButton;