import * as React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import {
  calculateContrastRatio,
  generateHighContrastColor,
  simulateColorBlindness,
  isContrastCompliant,
  CONTRAST_RATIOS
} from '../../utils/accessibilityUtils';
import { AccessibleText } from './AccessibleText';

/**
 * 色覚アクセシビリティコンテキスト
 */
interface ColorAccessibilityContextType {
  adjustColorForContrast: (foreground: string, background?: string) => string;
  adjustColorForColorBlindness: (color: string) => string;
  validateContrast: (foreground: string, background: string) => boolean;
  getAccessibleColorScheme: () => ColorScheme;
}

interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
}

const ColorAccessibilityContext = React.createContext<ColorAccessibilityContextType | undefined>(undefined);

/**
 * 色覚アクセシビリティプロバイダー
 */
export const ColorAccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useAccessibility();

  // 基本カラースキーム
  const baseColorScheme: ColorScheme = {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#6D6D80',
    accent: '#FF9500',
    error: '#FF3B30',
    warning: '#FFCC00',
    success: '#34C759'
  };

  // 高コントラストカラースキーム
  const highContrastColorScheme: ColorScheme = {
    primary: '#0000FF',
    secondary: '#800080',
    background: '#FFFFFF',
    surface: '#F0F0F0',
    text: '#000000',
    textSecondary: '#000000',
    accent: '#FF6600',
    error: '#CC0000',
    warning: '#996600',
    success: '#006600'
  };

  // コントラスト調整
  const adjustColorForContrast = React.useCallback((
    foreground: string, 
    background: string = baseColorScheme.background
  ): string => {
    if (settings.highContrastMode) {
      return generateHighContrastColor(foreground, background);
    }

    const contrastRatio = calculateContrastRatio(foreground, background);
    if (contrastRatio >= CONTRAST_RATIOS.AA_NORMAL) {
      return foreground;
    }

    return generateHighContrastColor(foreground, background);
  }, [settings.highContrastMode, baseColorScheme.background]);

  // 色覚異常対応の色調整
  const adjustColorForColorBlindness = React.useCallback((color: string): string => {
    if (!settings.colorBlindnessType) return color;

    return simulateColorBlindness(color, settings.colorBlindnessType);
  }, [settings.colorBlindnessType]);

  // コントラスト検証
  const validateContrast = React.useCallback((foreground: string, background: string): boolean => {
    return isContrastCompliant(foreground, background, 'AA', false);
  }, []);

  // アクセシブルカラースキームの取得
  const getAccessibleColorScheme = React.useCallback((): ColorScheme => {
    const scheme = settings.highContrastMode ? highContrastColorScheme : baseColorScheme;
    
    if (settings.colorBlindnessType) {
      // 色覚異常対応の調整
      return Object.keys(scheme).reduce((adjusted, key) => {
        adjusted[key as keyof ColorScheme] = adjustColorForColorBlindness(
          scheme[key as keyof ColorScheme]
        );
        return adjusted;
      }, {} as ColorScheme);
    }

    return scheme;
  }, [settings.highContrastMode, settings.colorBlindnessType, adjustColorForColorBlindness]);

  const contextValue: ColorAccessibilityContextType = {
    adjustColorForContrast,
    adjustColorForColorBlindness,
    validateContrast,
    getAccessibleColorScheme
  };

  return (
    <ColorAccessibilityContext.Provider value={contextValue}>
      {children}
    </ColorAccessibilityContext.Provider>
  );
};

/**
 * 色覚アクセシビリティフック
 */
export const useColorAccessibility = (): ColorAccessibilityContextType => {
  const context = React.useContext(ColorAccessibilityContext);
  
  if (context === undefined) {
    throw new Error('useColorAccessibility must be used within a ColorAccessibilityProvider');
  }
  
  return context;
};

/**
 * アクセシブル色コンポーネント
 */
export interface AccessibleColorProps {
  children: React.ReactNode;
  foregroundColor?: string;
  backgroundColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  autoAdjustContrast?: boolean;
  testID?: string;
}

export const AccessibleColor: React.FC<AccessibleColorProps> = ({
  children,
  foregroundColor,
  backgroundColor,
  style,
  textStyle,
  autoAdjustContrast = true,
  testID
}) => {
  const { adjustColorForContrast, validateContrast } = useColorAccessibility();

  const adjustedColors = React.useMemo(() => {
    if (!foregroundColor || !backgroundColor) {
      return { foreground: foregroundColor, background: backgroundColor };
    }

    if (autoAdjustContrast) {
      const adjustedForeground = adjustColorForContrast(foregroundColor, backgroundColor);
      return {
        foreground: adjustedForeground,
        background: backgroundColor
      };
    }

    return { foreground: foregroundColor, background: backgroundColor };
  }, [foregroundColor, backgroundColor, autoAdjustContrast, adjustColorForContrast]);

  const finalStyle = React.useMemo(() => ({
    ...style,
    backgroundColor: adjustedColors.background
  }), [style, adjustedColors.background]);

  const finalTextStyle = React.useMemo(() => ({
    ...textStyle,
    color: adjustedColors.foreground
  }), [textStyle, adjustedColors.foreground]);

  // 開発環境でのコントラスト警告
  React.useEffect(() => {
    if (__DEV__ && adjustedColors.foreground && adjustedColors.background) {
      const isValid = validateContrast(adjustedColors.foreground, adjustedColors.background);
      if (!isValid) {
        console.warn(
          `AccessibleColor: コントラスト比不足 - 前景色: ${adjustedColors.foreground}, 背景色: ${adjustedColors.background}`
        );
      }
    }
  }, [adjustedColors, validateContrast]);

  return (
    <View style={finalStyle} testID={testID}>
      {typeof children === 'string' ? (
        <AccessibleText style={finalTextStyle}>
          {children}
        </AccessibleText>
      ) : (
        React.cloneElement(children as React.ReactElement, {
          style: [
            ((children as React.ReactElement).props as any)?.style,
            finalTextStyle
          ]
        } as any)
      )}
    </View>
  );
};

/**
 * 色覚シミュレーターコンポーネント（開発用）
 */
export interface ColorBlindnessSimulatorProps {
  children: React.ReactNode;
  type?: 'protanopia' | 'deuteranopia' | 'tritanopia';
  enabled?: boolean;
}

export const ColorBlindnessSimulator: React.FC<ColorBlindnessSimulatorProps> = ({
  children,
  type = 'protanopia',
  enabled = false
}) => {
  const { adjustColorForColorBlindness } = useColorAccessibility();

  // 実際の実装では、子コンポーネントの色を再帰的に変換する必要がある
  // ここでは簡易版として、コンテナに色覚異常シミュレーション用のフィルターを適用
  const filterStyle = React.useMemo(() => {
    // React NativeではCSSフィルターが直接使えないため、
    // 色変換は個別のコンポーネントレベルで行う必要がある
    return {};
  }, [type]);

  if (!enabled) return <>{children}</>;

  return (
    <View style={filterStyle}>
      {children}
    </View>
  );
};

/**
 * コントラストチェッカーコンポーネント（開発用）
 */
export interface ContrastCheckerProps {
  foregroundColor: string;
  backgroundColor: string;
  showResult?: boolean;
  targetLevel?: 'AA' | 'AAA';
  isLargeText?: boolean;
}

export const ContrastChecker: React.FC<ContrastCheckerProps> = ({
  foregroundColor,
  backgroundColor,
  showResult = __DEV__,
  targetLevel = 'AA',
  isLargeText = false
}) => {
  const contrastInfo = React.useMemo(() => {
    const ratio = calculateContrastRatio(foregroundColor, backgroundColor);
    const isCompliant = isContrastCompliant(foregroundColor, backgroundColor, targetLevel, isLargeText);
    
    return {
      ratio: Math.round(ratio * 100) / 100,
      isCompliant,
      targetRatio: targetLevel === 'AA' 
        ? (isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL)
        : (isLargeText ? CONTRAST_RATIOS.AAA_LARGE : CONTRAST_RATIOS.AAA_NORMAL)
    };
  }, [foregroundColor, backgroundColor, targetLevel, isLargeText]);

  if (!showResult) return null;

  return (
    <View style={styles.contrastChecker}>
      <AccessibleText style={styles.contrastText}>
        コントラスト比: {contrastInfo.ratio}:1
      </AccessibleText>
      <AccessibleText style={[
        styles.complianceText,
        { color: contrastInfo.isCompliant ? '#00AA00' : '#AA0000' }
      ] as any}>
        {contrastInfo.isCompliant ? `✅ ${targetLevel}準拠` : `❌ ${targetLevel}非準拠`}
      </AccessibleText>
      <AccessibleText style={styles.targetText}>
        必要比率: {contrastInfo.targetRatio}:1以上
      </AccessibleText>
    </View>
  );
};

/**
 * カラーパレット表示コンポーネント
 */
export const AccessibleColorPalette: React.FC = () => {
  const { getAccessibleColorScheme } = useColorAccessibility();
  const colorScheme = getAccessibleColorScheme();

  return (
    <View style={styles.palette}>
      <AccessibleText semanticLevel={2} style={styles.paletteTitle}>
        アクセシブルカラーパレット
      </AccessibleText>
      
      {Object.entries(colorScheme).map(([name, color]) => (
        <View key={name} style={styles.colorItem}>
          <View style={[styles.colorSwatch, { backgroundColor: color }]} />
          <AccessibleText style={styles.colorName}>
            {name}: {color}
          </AccessibleText>
          <ContrastChecker
            foregroundColor={colorScheme.text}
            backgroundColor={color}
            showResult={true}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  contrastChecker: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
    marginVertical: 4
  },
  contrastText: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  complianceText: {
    fontSize: 12,
    fontWeight: '600'
  },
  targetText: {
    fontSize: 10,
    color: '#666666'
  },
  palette: {
    padding: 16
  },
  paletteTitle: {
    marginBottom: 16
  },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    padding: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  colorName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace'
  }
});

export default ColorAccessibilityProvider;