import { Dimensions, Platform } from 'react-native';

/**
 * アクセシビリティユーティリティ関数群
 */

/**
 * 最小タップターゲットサイズ（48dp）
 */
export const MIN_TAP_TARGET_SIZE = 48;

/**
 * WCAG準拠のコントラスト比
 */
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,      // WCAG AA 通常テキスト
  AA_LARGE: 3.0,       // WCAG AA 大きなテキスト
  AAA_NORMAL: 7.0,     // WCAG AAA 通常テキスト
  AAA_LARGE: 4.5       // WCAG AAA 大きなテキスト
} as const;

/**
 * 色をRGB値に変換
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * 相対輝度を計算
 */
export const getRelativeLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * コントラスト比を計算
 */
export const calculateContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 1;
  
  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * コントラスト比がWCAG基準を満たしているかチェック
 */
export const isContrastCompliant = (
  foreground: string, 
  background: string, 
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean => {
  const ratio = calculateContrastRatio(foreground, background);
  
  if (level === 'AA') {
    return isLargeText ? ratio >= CONTRAST_RATIOS.AA_LARGE : ratio >= CONTRAST_RATIOS.AA_NORMAL;
  } else {
    return isLargeText ? ratio >= CONTRAST_RATIOS.AAA_LARGE : ratio >= CONTRAST_RATIOS.AAA_NORMAL;
  }
};

/**
 * 高コントラスト色を生成
 */
export const generateHighContrastColor = (baseColor: string, backgroundColor: string = '#FFFFFF'): string => {
  const currentRatio = calculateContrastRatio(baseColor, backgroundColor);
  
  if (currentRatio >= CONTRAST_RATIOS.AAA_NORMAL) {
    return baseColor; // 既に十分なコントラスト
  }
  
  // 背景が明るい場合は黒、暗い場合は白にする簡易実装
  const bgRgb = hexToRgb(backgroundColor);
  if (!bgRgb) return baseColor;
  
  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
};

/**
 * タップターゲットサイズを検証
 */
export const validateTapTargetSize = (width: number, height: number): {
  isValid: boolean;
  adjustedWidth: number;
  adjustedHeight: number;
} => {
  const adjustedWidth = Math.max(width, MIN_TAP_TARGET_SIZE);
  const adjustedHeight = Math.max(height, MIN_TAP_TARGET_SIZE);
  
  return {
    isValid: width >= MIN_TAP_TARGET_SIZE && height >= MIN_TAP_TARGET_SIZE,
    adjustedWidth,
    adjustedHeight
  };
};

/**
 * 片手操作ゾーンを計算
 */
export const calculateOneHandedZones = () => {
  const { width, height } = Dimensions.get('window');
  
  // 一般的なスマートフォンでの親指の到達範囲
  const thumbReachRadius = Math.min(width, height) * 0.4;
  
  return {
    easy: {
      // 画面下部中央を中心とした円形領域
      centerX: width / 2,
      centerY: height - 100, // 下から100dp
      radius: thumbReachRadius * 0.7
    },
    medium: {
      centerX: width / 2,
      centerY: height - 100,
      radius: thumbReachRadius
    },
    hard: {
      // 画面上部領域
      top: 0,
      bottom: height - thumbReachRadius * 1.2,
      left: 0,
      right: width
    }
  };
};

/**
 * 座標が片手操作しやすいゾーンにあるかチェック
 */
export const isInOneHandedZone = (x: number, y: number, zone: 'easy' | 'medium' = 'medium'): boolean => {
  const zones = calculateOneHandedZones();
  const targetZone = zones[zone];
  
  if ('radius' in targetZone) {
    const distance = Math.sqrt(
      Math.pow(x - targetZone.centerX, 2) + Math.pow(y - targetZone.centerY, 2)
    );
    return distance <= targetZone.radius;
  }
  
  return false;
};

/**
 * 色覚異常シミュレーション
 */
export const simulateColorBlindness = (
  color: string, 
  type: 'protanopia' | 'deuteranopia' | 'tritanopia'
): string => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  let { r, g, b } = rgb;
  
  // 簡易的な色覚異常シミュレーション
  switch (type) {
    case 'protanopia': // 1型色覚（赤の感受性低下）
      r = 0.567 * r + 0.433 * g;
      g = 0.558 * r + 0.442 * g;
      b = 0.242 * g + 0.758 * b;
      break;
      
    case 'deuteranopia': // 2型色覚（緑の感受性低下）
      r = 0.625 * r + 0.375 * g;
      g = 0.7 * r + 0.3 * g;
      b = 0.3 * g + 0.7 * b;
      break;
      
    case 'tritanopia': // 3型色覚（青の感受性低下）
      r = 0.95 * r + 0.05 * g;
      g = 0.433 * g + 0.567 * b;
      b = 0.475 * g + 0.525 * b;
      break;
  }
  
  // RGB値を0-255の範囲に制限
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));
  
  // 16進数カラーコードに変換
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * テキストサイズを動的に調整
 */
export const adjustTextSize = (baseSize: number, multiplier: number): number => {
  return Math.round(baseSize * Math.max(1.0, Math.min(2.0, multiplier)));
};

/**
 * アクセシビリティ監査結果の型定義
 */
export interface AccessibilityAuditResult {
  componentName: string;
  issues: AccessibilityIssue[];
  score: number; // 0-100
  timestamp: Date;
}

export interface AccessibilityIssue {
  type: 'contrast' | 'tap-target' | 'label' | 'focus' | 'semantic';
  severity: 'error' | 'warning' | 'info';
  description: string;
  element: string;
  suggestion: string;
}

/**
 * アクセシビリティ監査を実行
 */
export const auditAccessibility = (
  componentName: string,
  elements: {
    type: string;
    props: any;
    dimensions?: { width: number; height: number };
  }[]
): AccessibilityAuditResult => {
  const issues: AccessibilityIssue[] = [];
  let score = 100;
  
  elements.forEach((element, index) => {
    const elementId = `${element.type}-${index}`;
    
    // アクセシビリティラベルのチェック
    if (!element.props.accessibilityLabel && !element.props.children) {
      issues.push({
        type: 'label',
        severity: 'error',
        description: 'アクセシビリティラベルが設定されていません',
        element: elementId,
        suggestion: 'accessibilityLabel プロパティを追加してください'
      });
      score -= 20;
    }
    
    // タップターゲットサイズのチェック
    if (element.dimensions) {
      const validation = validateTapTargetSize(element.dimensions.width, element.dimensions.height);
      if (!validation.isValid) {
        issues.push({
          type: 'tap-target',
          severity: 'warning',
          description: `タップターゲットが小さすぎます (${element.dimensions.width}x${element.dimensions.height}dp)`,
          element: elementId,
          suggestion: `最小サイズを${MIN_TAP_TARGET_SIZE}x${MIN_TAP_TARGET_SIZE}dpにしてください`
        });
        score -= 10;
      }
    }
  });
  
  return {
    componentName,
    issues,
    score: Math.max(0, score),
    timestamp: new Date()
  };
};

/**
 * プラットフォーム固有のアクセシビリティヘルパー
 */
export const platformAccessibilityHelpers = {
  /**
   * iOS固有のアクセシビリティ設定
   */
  ios: {
    enableAccessibilityEscape: () => ({
      accessibilityActions: [{ name: 'escape', label: '戻る' }],
      onAccessibilityAction: (event: any) => {
        if (event.nativeEvent.actionName === 'escape') {
          // 戻る処理
        }
      }
    })
  },
  
  /**
   * Android固有のアクセシビリティ設定
   */
  android: {
    enableAccessibilityLiveRegion: (politeness: 'none' | 'polite' | 'assertive' = 'polite') => ({
      accessibilityLiveRegion: politeness
    })
  },
  
  /**
   * クロスプラットフォーム設定
   */
  common: {
    createAccessibleComponent: (label: string, hint?: string, role?: string) => ({
      accessible: true,
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: role as any
    })
  }
};

/**
 * アクセシビリティデバッグ情報を出力
 */
export const debugAccessibility = (componentName: string, props: any) => {
  if (__DEV__) {
    console.group(`🔍 Accessibility Debug: ${componentName}`);
    console.log('Props:', {
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityHint: props.accessibilityHint,
      accessibilityRole: props.accessibilityRole,
      accessibilityState: props.accessibilityState
    });
    
    if (!props.accessibilityLabel && !props.children) {
      console.warn('⚠️  accessibilityLabel が設定されていません');
    }
    
    console.groupEnd();
  }
};