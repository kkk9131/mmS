import * as React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * アクセシビリティ設定の型定義
 */
export interface AccessibilitySettings {
  screenReaderEnabled: boolean;
  highContrastMode: boolean;
  largeTextMode: boolean;
  oneHandedMode: boolean;
  reducedMotion: boolean;
  hapticFeedbackEnabled: boolean;
  textSizeMultiplier: number; // 1.0 - 2.0
  colorBlindnessType?: 'protanopia' | 'deuteranopia' | 'tritanopia';
}

/**
 * アクセシビリティコンテキストの型定義
 */
export interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  isScreenReaderActive: boolean;
  announceForScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  resetToDefaults: () => void;
}

/**
 * デフォルトのアクセシビリティ設定
 */
const defaultSettings: AccessibilitySettings = {
  screenReaderEnabled: false,
  highContrastMode: false,
  largeTextMode: false,
  oneHandedMode: false,
  reducedMotion: false,
  hapticFeedbackEnabled: true,
  textSizeMultiplier: 1.0,
  colorBlindnessType: undefined
};

/**
 * アクセシビリティコンテキスト
 */
const AccessibilityContext = React.createContext<AccessibilityContextType | undefined>(undefined);

/**
 * アクセシビリティコンテキストプロバイダー
 */
export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = React.useState<AccessibilitySettings>(defaultSettings);
  const [isScreenReaderActive, setIsScreenReaderActive] = React.useState(false);

  /**
   * アクセシビリティ設定を読み込み
   */
  const loadSettings = React.useCallback(async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('@accessibility_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.warn('AccessibilityProvider: 設定の読み込みに失敗:', error);
    }
  }, []);

  /**
   * アクセシビリティ設定を保存
   */
  const saveSettings = React.useCallback(async (newSettings: AccessibilitySettings) => {
    try {
      await AsyncStorage.setItem('@accessibility_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.warn('AccessibilityProvider: 設定の保存に失敗:', error);
    }
  }, []);

  /**
   * スクリーンリーダーの状態を検出
   */
  const detectScreenReader = React.useCallback(async () => {
    try {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderActive(screenReaderEnabled);
      
      if (screenReaderEnabled !== settings.screenReaderEnabled) {
        const updatedSettings = { ...settings, screenReaderEnabled };
        setSettings(updatedSettings);
        await saveSettings(updatedSettings);
      }
    } catch (error) {
      console.warn('AccessibilityProvider: スクリーンリーダー検出に失敗:', error);
    }
  }, [settings, saveSettings]);

  /**
   * アクセシビリティ設定を更新
   */
  const updateSettings = React.useCallback(async (newSettings: Partial<AccessibilitySettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
    
    console.log('AccessibilityProvider: 設定を更新:', newSettings);
  }, [settings, saveSettings]);

  /**
   * スクリーンリーダー用のアナウンス
   */
  const announceForScreenReader = React.useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (!isScreenReaderActive) return;

    try {
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(message);
      } else {
        // Android用の実装
        AccessibilityInfo.announceForAccessibility(message);
      }
      
      console.log(`AccessibilityProvider: スクリーンリーダーアナウンス (${priority}): ${message}`);
    } catch (error) {
      console.warn('AccessibilityProvider: アナウンスに失敗:', error);
    }
  }, [isScreenReaderActive]);

  /**
   * デフォルト設定にリセット
   */
  const resetToDefaults = React.useCallback(async () => {
    setSettings(defaultSettings);
    await saveSettings(defaultSettings);
    console.log('AccessibilityProvider: 設定をデフォルトにリセット');
  }, [saveSettings]);

  // 初期化処理
  React.useEffect(() => {
    loadSettings();
    detectScreenReader();

    // スクリーンリーダー状態の変更を監視
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderActive
    );

    return () => {
      subscription?.remove();
    };
  }, [loadSettings, detectScreenReader]);

  // 設定変更時の通知
  React.useEffect(() => {
    if (settings.screenReaderEnabled) {
      announceForScreenReader('アクセシビリティ設定が変更されました');
    }
  }, [settings, announceForScreenReader]);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSettings,
    isScreenReaderActive,
    announceForScreenReader,
    resetToDefaults
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

/**
 * アクセシビリティコンテキストを使用するカスタムフック
 */
export const useAccessibility = (): AccessibilityContextType => {
  const context = React.useContext(AccessibilityContext);
  
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  
  return context;
};

/**
 * スクリーンリーダー専用のカスタムフック
 */
export const useScreenReader = () => {
  const { isScreenReaderActive, announceForScreenReader } = useAccessibility();
  
  return {
    isActive: isScreenReaderActive,
    announce: announceForScreenReader
  };
};

/**
 * 片手操作モード専用のカスタムフック
 */
export const useOneHandedMode = () => {
  const { settings, updateSettings } = useAccessibility();
  
  const toggleOneHandedMode = React.useCallback(() => {
    updateSettings({ oneHandedMode: !settings.oneHandedMode });
  }, [settings.oneHandedMode, updateSettings]);
  
  return {
    enabled: settings.oneHandedMode,
    toggle: toggleOneHandedMode
  };
};

/**
 * 高コントラストモード専用のカスタムフック
 */
export const useHighContrast = () => {
  const { settings, updateSettings } = useAccessibility();
  
  const toggleHighContrast = React.useCallback(() => {
    updateSettings({ highContrastMode: !settings.highContrastMode });
  }, [settings.highContrastMode, updateSettings]);
  
  return {
    enabled: settings.highContrastMode,
    toggle: toggleHighContrast
  };
};