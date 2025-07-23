// カラーパレット定義
export const Colors = {
  // ブランドカラー（両モード共通）
  primary: '#ff6b9d',
  primaryLight: '#ff8fb3',
  primaryDark: '#e0527d',
  
  // ダークモード
  dark: {
    background: '#121212',
    surface: '#1a1a1a',
    card: '#2a2a2a',
    border: '#333333',
    text: {
      primary: '#e0e0e0',
      secondary: '#888888',
      disabled: '#666666',
    },
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#ef4444',
  },
  
  // ライトモード（明るいが明るすぎない）
  light: {
    background: '#faf8f5',      // クリーム色寄りのオフホワイト
    surface: '#f4f1eb',        // カード背景（少し暗めのクリーム色）
    card: '#a8a29e',           // グレージュ（カード内部のグレー部分）
    border: '#d6d3d1',         // ボーダー（薄めのグレージュ）
    text: {
      primary: '#1c1917',      // ダークブラウン系（読みやすい）
      secondary: '#57534e',    // ミディアムブラウングレー
      disabled: '#a8a29e',     // グレージュ
    },
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#dc2626',
  },
} as const;

// テーマタイプ定義
export type ThemeMode = 'light' | 'dark';

export interface Theme {
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    background: string;
    surface: string;
    card: string;
    border: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
    success: string;
    warning: string;
    error: string;
  };
}

// テーマオブジェクト生成関数
export const createTheme = (mode: ThemeMode): Theme => ({
  colors: {
    primary: Colors.primary,
    primaryLight: Colors.primaryLight,
    primaryDark: Colors.primaryDark,
    ...Colors[mode],
  },
});

// デフォルトテーマ
export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');