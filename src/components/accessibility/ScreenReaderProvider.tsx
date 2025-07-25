import * as React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';

/**
 * スクリーンリーダー専用プロバイダー
 * スクリーンリーダーの詳細な制御と最適化
 */

export interface ScreenReaderContextType {
  isScreenReaderEnabled: boolean;
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void;
  setAccessibilityFocus: (element: any) => void;
  enableAccessibilityForElement: (element: any, label: string, hint?: string) => void;
}

const ScreenReaderContext = React.createContext<ScreenReaderContextType | undefined>(undefined);

export const ScreenReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = React.useState(false);
  const { settings, announceForScreenReader } = useAccessibility();

  // スクリーンリーダー状態の監視
  React.useEffect(() => {
    // 初期状態の取得
    AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled);

    // 状態変更の監視
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // メッセージのアナウンス
  const announceMessage = React.useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (!isScreenReaderEnabled) return;

    announceForScreenReader(message, priority);
  }, [isScreenReaderEnabled, announceForScreenReader]);

  // 要素にアクセシビリティフォーカスを設定
  const setAccessibilityFocus = React.useCallback((element: any) => {
    if (!isScreenReaderEnabled || !element) return;

    try {
      AccessibilityInfo.setAccessibilityFocus(element);
    } catch (error) {
      console.warn('ScreenReaderProvider: フォーカス設定に失敗:', error);
    }
  }, [isScreenReaderEnabled]);

  // 要素のアクセシビリティを有効化
  const enableAccessibilityForElement = React.useCallback((
    element: any, 
    label: string, 
    hint?: string
  ) => {
    if (!element) return;

    // 要素にアクセシビリティ属性を動的に設定
    if (element.setNativeProps) {
      element.setNativeProps({
        accessible: true,
        accessibilityLabel: label,
        accessibilityHint: hint
      });
    }
  }, []);

  const contextValue: ScreenReaderContextType = {
    isScreenReaderEnabled,
    announceMessage,
    setAccessibilityFocus,
    enableAccessibilityForElement
  };

  return (
    <ScreenReaderContext.Provider value={contextValue}>
      {children}
    </ScreenReaderContext.Provider>
  );
};

/**
 * スクリーンリーダーコンテキストを使用するフック
 */
export const useScreenReader = (): ScreenReaderContextType => {
  const context = React.useContext(ScreenReaderContext);
  
  if (context === undefined) {
    throw new Error('useScreenReader must be used within a ScreenReaderProvider');
  }
  
  return context;
};

/**
 * スクリーンリーダー専用のアナウンスフック
 */
export const useScreenReaderAnnouncements = () => {
  const { announceMessage, isScreenReaderEnabled } = useScreenReader();

  // ページ変更のアナウンス
  const announcePageChange = React.useCallback((pageName: string) => {
    announceMessage(`${pageName}画面に移動しました`, 'assertive');
  }, [announceMessage]);

  // 状態変更のアナウンス
  const announceStateChange = React.useCallback((message: string) => {
    announceMessage(message, 'polite');
  }, [announceMessage]);

  // エラーのアナウンス
  const announceError = React.useCallback((errorMessage: string) => {
    announceMessage(`エラー: ${errorMessage}`, 'assertive');
  }, [announceMessage]);

  // 成功のアナウンス
  const announceSuccess = React.useCallback((message: string) => {
    announceMessage(`完了: ${message}`, 'polite');
  }, [announceMessage]);

  // 警告のアナウンス
  const announceWarning = React.useCallback((message: string) => {
    announceMessage(`注意: ${message}`, 'assertive');
  }, [announceMessage]);

  // 読み込み状態のアナウンス
  const announceLoading = React.useCallback((isLoading: boolean, context?: string) => {
    const message = isLoading 
      ? `${context ? context + 'を' : ''}読み込み中`
      : `${context ? context + 'の' : ''}読み込み完了`;
    announceMessage(message, 'polite');
  }, [announceMessage]);

  return {
    isScreenReaderEnabled,
    announcePageChange,
    announceStateChange,
    announceError,
    announceSuccess,
    announceWarning,
    announceLoading
  };
};

/**
 * 自動アナウンス機能付きのカスタムフック
 */
export const useAutoAnnouncement = () => {
  const { announceMessage, isScreenReaderEnabled } = useScreenReader();
  const previousValues = React.useRef<Record<string, any>>({});

  // 値の変更を監視してアナウンス
  const announceChange = React.useCallback((
    key: string, 
    newValue: any, 
    getAnnouncementText: (oldValue: any, newValue: any) => string
  ) => {
    if (!isScreenReaderEnabled) return;

    const oldValue = previousValues.current[key];
    
    if (oldValue !== newValue) {
      const announcementText = getAnnouncementText(oldValue, newValue);
      if (announcementText) {
        announceMessage(announcementText, 'polite');
      }
      previousValues.current[key] = newValue;
    }
  }, [isScreenReaderEnabled, announceMessage]);

  return { announceChange };
};

export default ScreenReaderProvider;