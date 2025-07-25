#!/usr/bin/env tsx
/**
 * UI/UX改善スクリプト
 * データ構造・ナビゲーション設計・色彩設計の改善
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// 本番環境変数を読み込み
config({ path: path.join(process.cwd(), '.env.production') });

// カラーパレット定義（一貫性のある色彩設計）
const COLOR_PALETTE = {
  primary: {
    main: '#FF6B6B',      // メインカラー（暖かいピンク）
    light: '#FFE0E0',     // 薄いピンク（背景用）
    dark: '#E85555',      // 濃いピンク（ボタンホバー用）
  },
  secondary: {
    main: '#4ECDC4',      // セカンダリカラー（ミントグリーン）
    light: '#E0F7F6',     // 薄いミント（背景用）
    dark: '#3BA59E',      // 濃いミント（アクティブ状態）
  },
  neutral: {
    white: '#FFFFFF',
    background: '#F8F9FA',
    gray100: '#F5F5F5',
    gray200: '#E9ECEF',
    gray300: '#DEE2E6',
    gray400: '#CED4DA',
    gray500: '#ADB5BD',
    gray600: '#6C757D',
    gray700: '#495057',
    gray800: '#343A40',
    gray900: '#212529',
    black: '#000000',
  },
  semantic: {
    success: '#52C41A',
    warning: '#FAAD14',
    error: '#F5222D',
    info: '#1890FF',
  },
  text: {
    primary: '#212529',
    secondary: '#6C757D',
    disabled: '#ADB5BD',
    inverse: '#FFFFFF',
  }
};

// タイポグラフィ定義（一貫性のあるテキストスタイル）
const TYPOGRAPHY = {
  fontFamily: {
    primary: 'Noto Sans JP, sans-serif',
    secondary: 'Roboto, sans-serif',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  }
};

// 改善されたナビゲーション構造
const NAVIGATION_STRUCTURE = {
  tabBar: {
    items: [
      {
        name: 'ホーム',
        icon: 'home',
        route: 'Home',
        active: true,
      },
      {
        name: '投稿',
        icon: 'edit',
        route: 'CreatePost',
        badge: null,
      },
      {
        name: 'チャット',
        icon: 'message-circle',
        route: 'Chat',
        badge: 'new',
      },
      {
        name: 'プロフィール',
        icon: 'user',
        route: 'Profile',
        badge: null,
      }
    ]
  },
  homeHeader: {
    title: 'Mamapace',
    rightIcons: [
      {
        icon: 'bell',
        badge: true,
        action: 'notifications',
      },
      {
        icon: 'search',
        badge: false,
        action: 'search',
      }
    ]
  }
};

// コンポーネントスタイル定義
const COMPONENT_STYLES = {
  button: {
    primary: {
      backgroundColor: COLOR_PALETTE.primary.main,
      color: COLOR_PALETTE.neutral.white,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      hover: {
        backgroundColor: COLOR_PALETTE.primary.dark,
      },
      disabled: {
        backgroundColor: COLOR_PALETTE.neutral.gray400,
        color: COLOR_PALETTE.neutral.gray600,
      }
    },
    secondary: {
      backgroundColor: 'transparent',
      color: COLOR_PALETTE.primary.main,
      borderWidth: 2,
      borderColor: COLOR_PALETTE.primary.main,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 22,
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
    }
  },
  card: {
    backgroundColor: COLOR_PALETTE.neutral.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLOR_PALETTE.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    backgroundColor: COLOR_PALETTE.neutral.gray100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLOR_PALETTE.neutral.gray300,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLOR_PALETTE.text.primary,
    focus: {
      borderColor: COLOR_PALETTE.primary.main,
      backgroundColor: COLOR_PALETTE.neutral.white,
    }
  }
};

// UIコンポーネントの改善例を生成
function generateImprovedComponents() {
  console.log('🎨 UI/UXコンポーネント改善ファイルを生成中...\n');

  // 1. カラーテーマファイルの生成
  const colorThemeContent = `// Mamapace統一カラーテーマ
export const colors = ${JSON.stringify(COLOR_PALETTE, null, 2)};

export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = colors;
  for (const key of keys) {
    value = value[key];
  }
  return value || '#000000';
};

// 使用例:
// getColor('primary.main') => '#FF6B6B'
// getColor('neutral.gray500') => '#ADB5BD'
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/theme/colors.ts'),
    colorThemeContent
  );
  console.log('✅ カラーテーマファイル生成完了: src/theme/colors.ts');

  // 2. タイポグラフィファイルの生成
  const typographyContent = `// Mamapace統一タイポグラフィ
export const typography = ${JSON.stringify(TYPOGRAPHY, null, 2)};

export const textStyles = {
  h1: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
  },
  h2: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
  },
  h3: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.normal,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  caption: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  }
};
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/theme/typography.ts'),
    typographyContent
  );
  console.log('✅ タイポグラフィファイル生成完了: src/theme/typography.ts');

  // 3. 改善されたボタンコンポーネントの生成
  const improvedButtonContent = `import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface ImprovedButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export const ImprovedButton: React.FC<ImprovedButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
}) => {
  const isDisabled = disabled || loading;
  
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'primary' ? colors.neutral.white : colors.primary.main} 
        />
      ) : (
        <Text style={[
          styles.text,
          variant === 'secondary' && styles.secondaryText,
          isDisabled && styles.disabledText,
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary.main,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  disabled: {
    backgroundColor: colors.neutral.gray400,
    borderColor: colors.neutral.gray400,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.white,
  },
  secondaryText: {
    color: colors.primary.main,
  },
  disabledText: {
    color: colors.neutral.gray600,
  },
});
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/components/ImprovedButton.tsx'),
    improvedButtonContent
  );
  console.log('✅ 改善されたボタンコンポーネント生成完了: src/components/ImprovedButton.tsx');

  // 4. 改善されたカードコンポーネントの生成
  const improvedCardContent = `import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface ImprovedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  onPress?: () => void;
}

export const ImprovedCard: React.FC<ImprovedCardProps> = ({
  children,
  style,
  padding = 16,
}) => {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 8,
  },
});
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/components/ImprovedCard.tsx'),
    improvedCardContent
  );
  console.log('✅ 改善されたカードコンポーネント生成完了: src/components/ImprovedCard.tsx');

  // 5. ユーザーフレンドリーなエラーメッセージコンポーネント
  const errorMessageContent = `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface UserFriendlyErrorProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
}

export const UserFriendlyError: React.FC<UserFriendlyErrorProps> = ({
  message,
  type = 'error',
  onRetry,
}) => {
  const iconName = type === 'error' ? 'alert-circle' : 
                   type === 'warning' ? 'alert-triangle' : 'info';
  const iconColor = type === 'error' ? colors.semantic.error :
                    type === 'warning' ? colors.semantic.warning : colors.semantic.info;

  return (
    <View style={[styles.container, styles[type]]}>
      <Feather name={iconName} size={20} color={iconColor} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>再試行</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  error: {
    backgroundColor: '#FFF1F0',
    borderColor: '#FFCCC7',
    borderWidth: 1,
  },
  warning: {
    backgroundColor: '#FFFBE6',
    borderColor: '#FFE58F',
    borderWidth: 1,
  },
  info: {
    backgroundColor: '#E6F7FF',
    borderColor: '#91D5FF',
    borderWidth: 1,
  },
  message: {
    flex: 1,
    marginLeft: 8,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
  },
  retryText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral.white,
    fontWeight: typography.fontWeight.medium,
  },
});
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/components/UserFriendlyError.tsx'),
    errorMessageContent
  );
  console.log('✅ ユーザーフレンドリーエラーコンポーネント生成完了: src/components/UserFriendlyError.tsx');

  console.log('\n📊 UI/UX改善ファイル生成完了！');
  console.log('   生成されたファイル:');
  console.log('   - src/theme/colors.ts');
  console.log('   - src/theme/typography.ts');
  console.log('   - src/components/ImprovedButton.tsx');
  console.log('   - src/components/ImprovedCard.tsx');
  console.log('   - src/components/UserFriendlyError.tsx');
}

// ディレクトリ作成
function ensureDirectories() {
  const dirs = [
    'src/theme',
    'src/components'
  ];
  
  dirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
}

// メイン実行
function main() {
  console.log('🎨 UI/UX改善実装を開始します...\n');
  
  ensureDirectories();
  generateImprovedComponents();
  
  console.log('\n✅ UI/UX改善実装が完了しました！');
  console.log('\n📝 次のステップ:');
  console.log('   1. 生成されたコンポーネントを既存のコードに統合');
  console.log('   2. カラーパレットとタイポグラフィの一貫した適用');
  console.log('   3. ユーザビリティテストの再実行');
}

if (require.main === module) {
  main();
}