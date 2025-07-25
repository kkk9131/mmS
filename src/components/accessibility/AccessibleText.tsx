import * as React from 'react';
import {
  Text as RNText,
  StyleSheet,
  TextStyle,
  AccessibilityRole
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { 
  generateHighContrastColor,
  adjustTextSize,
  debugAccessibility 
} from '../../utils/accessibilityUtils';
import { SEMANTIC_LEVELS } from '../../constants/accessibilityLabels';

export interface AccessibleTextProps {
  children: string | React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'text' | 'header';
  semanticLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  highContrast?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  testID?: string;
}

/**
 * アクセシブルテキストコンポーネント
 * 高コントラスト、大きなテキスト、セマンティックレベルに対応
 */
export const AccessibleText: React.FC<AccessibleTextProps> = ({
  children,
  accessibilityLabel,
  accessibilityRole = 'text',
  semanticLevel,
  highContrast,
  style,
  numberOfLines,
  adjustsFontSizeToFit = false,
  testID,
  ...props
}) => {
  const { settings } = useAccessibility();

  // アクセシビリティデバッグ
  React.useEffect(() => {
    debugAccessibility('AccessibleText', {
      accessible: true,
      accessibilityLabel: accessibilityLabel || (typeof children === 'string' ? children : 'テキスト'),
      accessibilityRole,
      semanticLevel
    });
  }, [accessibilityLabel, children, accessibilityRole, semanticLevel]);

  // セマンティックレベルに基づくスタイル調整
  const semanticStyle = React.useMemo(() => {
    if (!semanticLevel) return {};

    const baseFontSizes = {
      1: 28, // H1
      2: 24, // H2
      3: 20, // H3
      4: 18, // H4
      5: 16, // H5
      6: 14  // H6
    };

    const fontWeights = {
      1: '700' as const,
      2: '700' as const,
      3: '600' as const,
      4: '600' as const,
      5: '500' as const,
      6: '500' as const
    };

    return {
      fontSize: baseFontSizes[semanticLevel],
      fontWeight: fontWeights[semanticLevel],
      marginBottom: semanticLevel <= 2 ? 16 : 12
    };
  }, [semanticLevel]);

  // テキストサイズ調整
  const adjustedStyle = React.useMemo(() => {
    const baseStyle = StyleSheet.flatten([styles.text, semanticStyle, style]);
    const baseFontSize = baseStyle.fontSize || 16;

    let adjustedFontSize = baseFontSize;

    // 大きなテキストモード
    if (settings.largeTextMode) {
      adjustedFontSize = adjustTextSize(baseFontSize, 1.2);
    }

    // テキストサイズ倍率
    adjustedFontSize = adjustTextSize(adjustedFontSize, settings.textSizeMultiplier);

    return {
      ...baseStyle,
      fontSize: adjustedFontSize
    };
  }, [style, semanticStyle, settings.largeTextMode, settings.textSizeMultiplier]);

  // 高コントラストモード対応
  const contrastAdjustedStyle = React.useMemo(() => {
    const shouldApplyHighContrast = highContrast || settings.highContrastMode;
    
    if (!shouldApplyHighContrast) return adjustedStyle;

    const currentColor = (adjustedStyle as any).color || '#000000';
    const backgroundColor = '#FFFFFF'; // デフォルト背景色

    return {
      ...adjustedStyle,
      color: generateHighContrastColor(currentColor.toString(), backgroundColor)
    };
  }, [adjustedStyle, highContrast, settings.highContrastMode]);

  // アクセシビリティラベルの生成
  const effectiveAccessibilityLabel = React.useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    
    if (typeof children === 'string') {
      // セマンティックレベルがある場合はヘッダーとして読み上げ
      if (semanticLevel) {
        return `見出しレベル${semanticLevel}、${children}`;
      }
      return children;
    }
    
    return 'テキスト';
  }, [accessibilityLabel, children, semanticLevel]);

  // セマンティックレベルに基づくアクセシビリティロール
  const effectiveAccessibilityRole = React.useMemo(() => {
    if (semanticLevel) return 'header';
    return accessibilityRole;
  }, [accessibilityRole, semanticLevel]);

  return (
    <RNText
      style={contrastAdjustedStyle}
      accessible={true}
      accessibilityLabel={effectiveAccessibilityLabel}
      accessibilityRole={effectiveAccessibilityRole}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      testID={testID}
      // セマンティックレベルに基づくアクセシビリティ属性
      {...(semanticLevel && {
        accessibilityLevel: semanticLevel,
        // iOS固有のヘッダー属性
        accessibilityTraits: ['header']
      })}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000000'
  }
});

/**
 * 見出し用のプリセットコンポーネント
 */
export const AccessibleHeading: React.FC<Omit<AccessibleTextProps, 'accessibilityRole' | 'semanticLevel'> & {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}> = ({ level, ...props }) => (
  <AccessibleText
    {...props}
    accessibilityRole="header"
    semanticLevel={level}
  />
);

/**
 * 本文用のプリセットコンポーネント
 */
export const AccessibleBody: React.FC<Omit<AccessibleTextProps, 'accessibilityRole'>> = (props) => (
  <AccessibleText
    {...props}
    accessibilityRole="text"
  />
);

/**
 * ラベル用のプリセットコンポーネント
 */
export const AccessibleLabel: React.FC<Omit<AccessibleTextProps, 'accessibilityRole'> & {
  htmlFor?: string; // フォーム要素との関連付け用
}> = ({ htmlFor, ...props }) => (
  <AccessibleText
    {...props}
    accessibilityRole="text"
    style={StyleSheet.flatten([{ fontWeight: '600' }, props.style])}
  />
);

export default AccessibleText;