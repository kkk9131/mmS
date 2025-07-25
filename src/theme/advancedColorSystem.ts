// 高度な色彩設計システム - 一貫性とアクセシビリティを向上

import { colors as baseColors } from './colors';

// コントラスト比計算
function calculateContrast(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const gamma = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    
    return 0.2126 * gamma(r) + 0.7152 * gamma(g) + 0.0722 * gamma(b);
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const bright = Math.max(lum1, lum2);
  const dark = Math.min(lum1, lum2);

  return (bright + 0.05) / (dark + 0.05);
}

// WCAG AAA準拠の色の組み合わせを検証
function validateColorCombination(foreground: string, background: string): {
  isValid: boolean;
  contrast: number;
  wcagLevel: 'AAA' | 'AA' | 'fail';
} {
  const contrast = calculateContrast(foreground, background);
  
  let wcagLevel: 'AAA' | 'AA' | 'fail';
  if (contrast >= 7) {
    wcagLevel = 'AAA';
  } else if (contrast >= 4.5) {
    wcagLevel = 'AA';
  } else {
    wcagLevel = 'fail';
  }

  return {
    isValid: contrast >= 4.5,
    contrast,
    wcagLevel
  };
}

// 色の統一性を保つためのユーティリティ
export const colorUtils = {
  // 色の明度調整
  adjustBrightness(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const amt = Math.round(2.55 * amount);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  },

  // 色の透明度調整
  addAlpha(color: string, alpha: number): string {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // 色のコントラスト比計算
  getContrast: calculateContrast,

  // WCAG準拠チェック
  validateAccessibility: validateColorCombination,

  // 色の補色計算
  getComplementary(color: string): string {
    const hex = color.replace('#', '');
    const r = (255 - parseInt(hex.substr(0, 2), 16)).toString(16).padStart(2, '0');
    const g = (255 - parseInt(hex.substr(2, 2), 16)).toString(16).padStart(2, '0');
    const b = (255 - parseInt(hex.substr(4, 2), 16)).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }
};

// 拡張色彩システム
export const advancedColors = {
  ...baseColors,
  
  // セマンティックカラーの拡張
  semantic: {
    ...baseColors.semantic,
    // より細かい状態表現
    successLight: colorUtils.addAlpha(baseColors.semantic.success, 0.1),
    successDark: colorUtils.adjustBrightness(baseColors.semantic.success, -20),
    warningLight: colorUtils.addAlpha(baseColors.semantic.warning, 0.1),
    warningDark: colorUtils.adjustBrightness(baseColors.semantic.warning, -20),
    errorLight: colorUtils.addAlpha(baseColors.semantic.error, 0.1),
    errorDark: colorUtils.adjustBrightness(baseColors.semantic.error, -20),
    infoLight: colorUtils.addAlpha(baseColors.semantic.info, 0.1),
    infoDark: colorUtils.adjustBrightness(baseColors.semantic.info, -20),
  },

  // 専用カラーパレット（一貫性向上）
  mama: {
    // 母子手帳をイメージした色合い
    softPink: '#FFE8E8',
    warmPink: '#FFCCCB',
    gentleBlue: '#E6F3FF',
    calmGreen: '#E8F5E8',
    nurturingYellow: '#FFF9E6',
    // より深い色調
    deepPink: '#FFB6C1',
    stableBlue: '#87CEEB',
    growthGreen: '#98FB98',
    joyfulYellow: '#FFFFE0',
  },

  // インタラクション状態の色
  interaction: {
    // ホバー状態
    hoverPrimary: colorUtils.adjustBrightness(baseColors.primary.main, -10),
    hoverSecondary: colorUtils.adjustBrightness(baseColors.secondary.main, -10),
    // フォーカス状態
    focusPrimary: colorUtils.addAlpha(baseColors.primary.main, 0.3),
    focusSecondary: colorUtils.addAlpha(baseColors.secondary.main, 0.3),
    // アクティブ状態
    activePrimary: colorUtils.adjustBrightness(baseColors.primary.main, -20),
    activeSecondary: colorUtils.adjustBrightness(baseColors.secondary.main, -20),
    // 無効状態
    disabled: baseColors.neutral.gray400,
    disabledText: baseColors.neutral.gray500,
  },

  // グラデーション
  gradients: {
    primaryGradient: `linear-gradient(135deg, ${baseColors.primary.light} 0%, ${baseColors.primary.main} 100%)`,
    secondaryGradient: `linear-gradient(135deg, ${baseColors.secondary.light} 0%, ${baseColors.secondary.main} 100%)`,
    neutralGradient: `linear-gradient(135deg, ${baseColors.neutral.gray100} 0%, ${baseColors.neutral.gray200} 100%)`,
    warmGradient: 'linear-gradient(135deg, #FFE8E8 0%, #E6F3FF 100%)',
  },

  // 影とエレベーション
  shadows: {
    low: {
      shadowColor: baseColors.neutral.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    medium: {
      shadowColor: baseColors.neutral.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    high: {
      shadowColor: baseColors.neutral.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    floating: {
      shadowColor: baseColors.neutral.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
    },
  }
};

// 色の組み合わせテンプレート（デザイン一貫性保証）
export const colorCombinations = {
  // カード系
  card: {
    background: advancedColors.neutral.white,
    border: advancedColors.neutral.gray200,
    shadow: advancedColors.shadows.medium,
    primaryText: advancedColors.text.primary,
    secondaryText: advancedColors.text.secondary,
  },
  
  // ボタン系
  primaryButton: {
    background: advancedColors.primary.main,
    text: advancedColors.neutral.white,
    hover: advancedColors.interaction.hoverPrimary,
    active: advancedColors.interaction.activePrimary,
    focus: advancedColors.interaction.focusPrimary,
  },
  
  secondaryButton: {
    background: advancedColors.secondary.main,
    text: advancedColors.neutral.white,
    hover: advancedColors.interaction.hoverSecondary,
    active: advancedColors.interaction.activeSecondary,
    focus: advancedColors.interaction.focusSecondary,
  },
  
  // 入力フィールド系
  input: {
    background: advancedColors.neutral.white,
    border: advancedColors.neutral.gray300,
    focusBorder: advancedColors.primary.main,
    errorBorder: advancedColors.semantic.error,
    placeholder: advancedColors.text.secondary,
    text: advancedColors.text.primary,
  },
  
  // 通知系
  notification: {
    success: {
      background: advancedColors.semantic.successLight,
      border: advancedColors.semantic.success,
      text: advancedColors.semantic.successDark,
      icon: advancedColors.semantic.success,
    },
    warning: {
      background: advancedColors.semantic.warningLight,
      border: advancedColors.semantic.warning,
      text: advancedColors.semantic.warningDark,
      icon: advancedColors.semantic.warning,
    },
    error: {
      background: advancedColors.semantic.errorLight,
      border: advancedColors.semantic.error,
      text: advancedColors.semantic.errorDark,
      icon: advancedColors.semantic.error,
    },
    info: {
      background: advancedColors.semantic.infoLight,
      border: advancedColors.semantic.info,
      text: advancedColors.semantic.infoDark,
      icon: advancedColors.semantic.info,
    },
  }
};

// アクセシビリティチェック関数
export const accessibilityChecker = {
  // 全ての色の組み合わせをチェック
  validateAllCombinations(): { passed: number; failed: number; results: any[] } {
    const results: any[] = [];
    let passed = 0;
    let failed = 0;

    // 主要な色の組み合わせをテスト
    const testCombinations = [
      { name: 'Primary on White', fg: advancedColors.primary.main, bg: advancedColors.neutral.white },
      { name: 'Text on White', fg: advancedColors.text.primary, bg: advancedColors.neutral.white },
      { name: 'Secondary Text on White', fg: advancedColors.text.secondary, bg: advancedColors.neutral.white },
      { name: 'White on Primary', fg: advancedColors.neutral.white, bg: advancedColors.primary.main },
      { name: 'White on Secondary', fg: advancedColors.neutral.white, bg: advancedColors.secondary.main },
      { name: 'Error on White', fg: advancedColors.semantic.error, bg: advancedColors.neutral.white },
      { name: 'Success on White', fg: advancedColors.semantic.success, bg: advancedColors.neutral.white },
    ];

    testCombinations.forEach(combo => {
      const validation = colorUtils.validateAccessibility(combo.fg, combo.bg);
      results.push({
        name: combo.name,
        foreground: combo.fg,
        background: combo.bg,
        ...validation
      });

      if (validation.isValid) {
        passed++;
      } else {
        failed++;
      }
    });

    return { passed, failed, results };
  },

  // 色の一貫性をチェック
  checkConsistency(): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // プライマリカラーのバリエーション一貫性
    const primaryColors = [
      advancedColors.primary.main,
      advancedColors.primary.light,
      advancedColors.primary.dark
    ];

    // より詳細な一貫性チェックロジックを実装
    if (primaryColors.length < 3) {
      issues.push('プライマリカラーのバリエーションが不足しています');
      score -= 10;
    }

    // セマンティックカラーの適切性
    const semanticColors = [
      advancedColors.semantic.success,
      advancedColors.semantic.warning,
      advancedColors.semantic.error,
      advancedColors.semantic.info
    ];

    if (semanticColors.some(color => !color || color === '#000000')) {
      issues.push('セマンティックカラーが適切に設定されていません');
      score -= 15;
    }

    return { score: Math.max(0, score), issues };
  }
};

// 動的テーマ生成（ユーザー設定対応）
export const createCustomTheme = (preferences: {
  primaryColor?: string;
  accentColor?: string;
  darkMode?: boolean;
}) => {
  const base = preferences.darkMode ? {
    background: advancedColors.neutral.gray900,
    surface: advancedColors.neutral.gray800,
    text: advancedColors.neutral.white,
  } : {
    background: advancedColors.neutral.white,
    surface: advancedColors.neutral.background,
    text: advancedColors.text.primary,
  };

  return {
    ...advancedColors,
    primary: {
      main: preferences.primaryColor || advancedColors.primary.main,
      light: colorUtils.adjustBrightness(preferences.primaryColor || advancedColors.primary.main, 20),
      dark: colorUtils.adjustBrightness(preferences.primaryColor || advancedColors.primary.main, -20),
    },
    secondary: {
      main: preferences.accentColor || advancedColors.secondary.main,
      light: colorUtils.adjustBrightness(preferences.accentColor || advancedColors.secondary.main, 20),
      dark: colorUtils.adjustBrightness(preferences.accentColor || advancedColors.secondary.main, -20),
    },
    theme: base,
  };
};