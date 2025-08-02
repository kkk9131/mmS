import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Theme, ThemeMode, createTheme, darkTheme, lightTheme } from '../styles/colors';
import { FeatureFlagsManager } from '../services/featureFlags';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isLightMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_MODE_KEY = 'theme_mode';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [loading, setLoading] = useState(true);
  const featureFlags = FeatureFlagsManager.getInstance();

  // テーマ設定を読み込み
  useEffect(() => {
    if (featureFlags.isDebugModeEnabled()) {
      console.log('🎨 ThemeContext初期化開始 - Platform:', Platform.OS);
    }
    const loadThemeMode = async () => {
      try {
        if (featureFlags.isDebugModeEnabled()) {
          console.log('📖 テーマ設定を読み込み中...');
        }
        
        // Web版の場合、localStorageを優先
        if (Platform.OS === 'web') {
          try {
            const webStored = localStorage.getItem(THEME_MODE_KEY);
            console.log('🌐 Web localStorage テーマ値:', webStored);
            if (webStored && (webStored === 'light' || webStored === 'dark')) {
              setThemeModeState(webStored);
              console.log('✅ Web localStorage テーマ設定を復元:', webStored);
              setLoading(false);
              return;
            }
          } catch (webError) {
            console.log('⚠️ Web localStorage テーマ読み込み失敗:', webError);
          }
        }
        
        const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
        console.log('📖 AsyncStorage テーマ保存値:', stored);
        if (stored && (stored === 'light' || stored === 'dark')) {
          setThemeModeState(stored);
          console.log('✅ AsyncStorage テーマ設定を復元:', stored);
        } else {
          console.log('ℹ️ 保存されたテーマ設定がないため、デフォルト(dark)を使用');
        }
      } catch (error) {
        console.error('テーマ設定の読み込みに失敗:', error);
      } finally {
        setLoading(false);
        console.log('🏁 ThemeContext初期化完了');
      }
    };

    loadThemeMode();
  }, []);

  // テーマ設定を保存
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      console.log('🎨 テーマモードを変更:', mode, '- Platform:', Platform.OS);
      
      // Web版の場合、localStorageにも保存
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(THEME_MODE_KEY, mode);
          console.log('🌐 Web localStorage テーマ保存完了:', mode);
        } catch (webError) {
          console.log('⚠️ Web localStorage テーマ保存失敗:', webError);
        }
      }
      
      await AsyncStorage.setItem(THEME_MODE_KEY, mode);
      console.log('🎨 AsyncStorage テーマ保存完了:', mode);
      
      // 即座に状態を更新
      setThemeModeState(mode);
      console.log('🔄 テーマ状態を即座に更新:', mode);
      
    } catch (error) {
      console.error('テーマ設定の保存に失敗:', error);
    }
  };

  // テーマ切り替え
  const toggleTheme = async () => {
    const newMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    await setThemeMode(newMode);
  };

  // 現在のテーマオブジェクトを取得
  const theme = createTheme(themeMode);
  const isLightMode = themeMode === 'light';

  const value: ThemeContextType = {
    theme,
    themeMode,
    isLightMode,
    setThemeMode,
    toggleTheme,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};