import * as React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
  LayoutChangeEvent,
  Text
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { useHapticFeedback } from '../../hooks/useAccessibility';
import {
  MIN_TAP_TARGET_SIZE,
  validateTapTargetSize
} from '../../utils/accessibilityUtils';

/**
 * タップターゲット最適化プロパティ
 */
export interface TapTargetOptimizerProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  // 最小サイズ強制
  enforceMinSize?: boolean;
  // 拡張領域の設定
  hitSlop?: { top: number; bottom: number; left: number; right: number };
  // 誤タップ防止機能
  preventAccidentalTap?: boolean;
  // タップ間隔制限（ms）
  debounceMs?: number;
  // アクセシビリティ
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  testID?: string;
}

/**
 * タップターゲット最適化コンポーネント
 * 最小サイズ保証、誤タップ防止、デバウンス機能付き
 */
export const TapTargetOptimizer: React.FC<TapTargetOptimizerProps> = ({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  contentStyle,
  enforceMinSize = true,
  hitSlop,
  preventAccidentalTap = false,
  debounceMs = 300,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
  ...props
}) => {
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [lastTapTime, setLastTapTime] = React.useState(0);
  const [tapCount, setTapCount] = React.useState(0);
  const { settings } = useAccessibility();
  const { triggerHaptic } = useHapticFeedback();

  // レイアウト変更時のサイズ測定
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setDimensions({
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height
    });
  }, []);

  // 最適化されたスタイルの計算
  const optimizedStyle = React.useMemo(() => {
    if (!enforceMinSize) return style;

    const baseStyle = StyleSheet.flatten(style) || {};
    const { adjustedWidth, adjustedHeight } = validateTapTargetSize(
      dimensions.width || MIN_TAP_TARGET_SIZE,
      dimensions.height || MIN_TAP_TARGET_SIZE
    );

    return {
      ...baseStyle,
      minWidth: adjustedWidth,
      minHeight: adjustedHeight,
      justifyContent: 'center' as any,
      alignItems: 'center' as any
    };
  }, [style, enforceMinSize, dimensions]);

  // ヒットスロップの自動計算
  const calculatedHitSlop = React.useMemo(() => {
    if (hitSlop) return hitSlop;

    // タップターゲットが小さい場合は自動的にヒットスロップを追加
    const { isValid } = validateTapTargetSize(dimensions.width, dimensions.height);
    
    if (!isValid) {
      const padding = Math.max(0, (MIN_TAP_TARGET_SIZE - Math.max(dimensions.width, dimensions.height)) / 2);
      return {
        top: padding,
        bottom: padding,
        left: padding,
        right: padding
      };
    }

    return undefined;
  }, [hitSlop, dimensions]);

  // デバウンス付きタップ処理
  const handlePress = React.useCallback((event: GestureResponderEvent) => {
    if (disabled || !onPress) return;

    const currentTime = Date.now();
    
    // デバウンス処理
    if (currentTime - lastTapTime < debounceMs) {
      console.log('TapTargetOptimizer: デバウンスによりタップをスキップ');
      return;
    }

    // 誤タップ防止機能
    if (preventAccidentalTap) {
      setTapCount(prev => prev + 1);
      
      // 短時間内の連続タップを検出
      if (currentTime - lastTapTime < 1000 && tapCount >= 2) {
        console.log('TapTargetOptimizer: 誤タップ防止により処理をスキップ');
        return;
      }
      
      // カウントをリセット
      setTimeout(() => setTapCount(0), 1000);
    }

    setLastTapTime(currentTime);

    // ハプティックフィードバック
    triggerHaptic('light');

    // アクセシビリティアナウンス
    if (settings.screenReaderEnabled && accessibilityLabel) {
      setTimeout(() => {
        // ボタンが押されたことをアナウンス
      }, 100);
    }

    onPress(event);
  }, [
    disabled,
    onPress,
    lastTapTime,
    debounceMs,
    preventAccidentalTap,
    tapCount,
    triggerHaptic,
    settings.screenReaderEnabled,
    accessibilityLabel
  ]);

  // 長押し処理
  const handleLongPress = React.useCallback((event: GestureResponderEvent) => {
    if (disabled || !onLongPress) return;

    // 強めのハプティックフィードバック
    triggerHaptic('medium');

    onLongPress(event);
  }, [disabled, onLongPress, triggerHaptic]);

  // タッチ可能コンポーネントの場合
  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        style={optimizedStyle}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onLayout={handleLayout}
        disabled={disabled}
        hitSlop={calculatedHitSlop}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole as any}
        accessibilityState={{ disabled }}
        testID={testID}
        {...props}
      >
        <View style={contentStyle}>
          {children}
        </View>
      </TouchableOpacity>
    );
  }

  // 通常のビューコンポーネントの場合
  return (
    <View
      style={optimizedStyle}
      onLayout={handleLayout}
      testID={testID}
      {...props}
    >
      <View style={contentStyle}>
        {children}
      </View>
    </View>
  );
};

/**
 * タップターゲット検証表示コンポーネント（開発用）
 */
export interface TapTargetValidatorProps {
  children: React.ReactNode;
  showValidation?: boolean;
  style?: ViewStyle;
}

export const TapTargetValidator: React.FC<TapTargetValidatorProps> = ({
  children,
  showValidation = __DEV__,
  style
}) => {
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [isValid, setIsValid] = React.useState(true);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
    
    const validation = validateTapTargetSize(width, height);
    setIsValid(validation.isValid);
    
    if (!validation.isValid && __DEV__) {
      console.warn(
        `TapTargetValidator: サイズが不足 ${width}x${height}dp (最小: ${MIN_TAP_TARGET_SIZE}x${MIN_TAP_TARGET_SIZE}dp)`
      );
    }
  }, []);

  const validationStyle = React.useMemo(() => {
    if (!showValidation) return {};

    return {
      borderWidth: 2,
      borderColor: isValid ? '#00FF00' : '#FF0000',
      borderStyle: 'dashed' as const
    };
  }, [showValidation, isValid]);

  return (
    <View
      style={[style, validationStyle]}
      onLayout={handleLayout}
    >
      {children}
      {showValidation && !isValid && (
        <View style={styles.warningOverlay}>
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>
              {dimensions.width}×{dimensions.height}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * 間隔検証コンポーネント
 */
export interface SpacingValidatorProps {
  children: React.ReactNode;
  minSpacing?: number;
  showValidation?: boolean;
}

export const SpacingValidator: React.FC<SpacingValidatorProps> = ({
  children,
  minSpacing = 8,
  showValidation = __DEV__
}) => {
  // 実装は複雑になるため、基本的な構造のみ提供
  return (
    <View style={showValidation ? styles.spacingContainer : undefined}>
      {children}
    </View>
  );
};

/**
 * 使いやすさ評価フック
 */
export const useTapTargetUsability = () => {
  const [interactions, setInteractions] = React.useState<{
    taps: number;
    misses: number;
    accidentalTaps: number;
    averageAccuracy: number;
  }>({
    taps: 0,
    misses: 0,
    accidentalTaps: 0,
    averageAccuracy: 100
  });

  const recordTap = React.useCallback((successful: boolean, accidental: boolean = false) => {
    setInteractions(prev => {
      const newTaps = prev.taps + 1;
      const newMisses = successful ? prev.misses : prev.misses + 1;
      const newAccidental = accidental ? prev.accidentalTaps + 1 : prev.accidentalTaps;
      const accuracy = ((newTaps - newMisses - newAccidental) / newTaps) * 100;

      return {
        taps: newTaps,
        misses: newMisses,
        accidentalTaps: newAccidental,
        averageAccuracy: Math.max(0, accuracy)
      };
    });
  }, []);

  const resetStats = React.useCallback(() => {
    setInteractions({
      taps: 0,
      misses: 0,
      accidentalTaps: 0,
      averageAccuracy: 100
    });
  }, []);

  return {
    interactions,
    recordTap,
    resetStats
  };
};

const styles = StyleSheet.create({
  warningOverlay: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1000
  },
  warningBadge: {
    backgroundColor: '#FF0000',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  spacingContainer: {
    backgroundColor: 'rgba(255, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFFF00',
    borderStyle: 'dashed'
  }
});

export default TapTargetOptimizer;