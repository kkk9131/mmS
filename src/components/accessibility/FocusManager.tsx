import * as React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  AccessibilityInfo,
  findNodeHandle,
  Platform
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';

/**
 * フォーカス管理システム
 */

export interface FocusManagerProps {
  children: React.ReactNode;
  trapFocus?: boolean; // モーダル等でフォーカスをトラップ
  restoreFocus?: boolean; // コンポーネント終了時にフォーカスを復元
  initialFocusRef?: React.RefObject<any>; // 初期フォーカス要素
  style?: ViewStyle;
  testID?: string;
}

export interface FocusableElement {
  ref: React.RefObject<any>;
  accessibilityLabel?: string;
  disabled?: boolean;
  order?: number; // フォーカス順序
}

/**
 * フォーカス管理コンテナ
 */
export const FocusManager: React.FC<FocusManagerProps> = ({
  children,
  trapFocus = false,
  restoreFocus = false,
  initialFocusRef,
  style,
  testID
}) => {
  const containerRef = React.useRef<View>(null);
  const previousFocusRef = React.useRef<any>(null);
  const focusableElements = React.useRef<FocusableElement[]>([]);
  const currentFocusIndex = React.useRef(0);
  const { isScreenReaderActive } = useAccessibility();

  // フォーカス可能要素の登録
  const registerFocusableElement = React.useCallback((element: FocusableElement) => {
    focusableElements.current.push(element);
    // 順序でソート
    focusableElements.current.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, []);

  // フォーカス可能要素の登録解除
  const unregisterFocusableElement = React.useCallback((elementRef: React.RefObject<any>) => {
    focusableElements.current = focusableElements.current.filter(
      el => el.ref !== elementRef
    );
  }, []);

  // 次の要素にフォーカス移動
  const focusNext = React.useCallback(() => {
    const elements = focusableElements.current.filter(el => !el.disabled && el.ref.current);
    if (elements.length === 0) return false;

    currentFocusIndex.current = (currentFocusIndex.current + 1) % elements.length;
    const nextElement = elements[currentFocusIndex.current];
    
    if (nextElement?.ref.current) {
      const node = findNodeHandle(nextElement.ref.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
        return true;
      }
    }
    
    return false;
  }, []);

  // 前の要素にフォーカス移動
  const focusPrevious = React.useCallback(() => {
    const elements = focusableElements.current.filter(el => !el.disabled && el.ref.current);
    if (elements.length === 0) return false;

    currentFocusIndex.current = currentFocusIndex.current === 0 
      ? elements.length - 1 
      : currentFocusIndex.current - 1;
    
    const prevElement = elements[currentFocusIndex.current];
    
    if (prevElement?.ref.current) {
      const node = findNodeHandle(prevElement.ref.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
        return true;
      }
    }
    
    return false;
  }, []);

  // 特定の要素にフォーカス設定
  const focusElement = React.useCallback((elementRef: React.RefObject<any>) => {
    if (!elementRef.current) return false;

    const node = findNodeHandle(elementRef.current);
    if (node) {
      AccessibilityInfo.setAccessibilityFocus(node);
      
      // 現在のフォーカスインデックスを更新
      const elementIndex = focusableElements.current.findIndex(el => el.ref === elementRef);
      if (elementIndex !== -1) {
        currentFocusIndex.current = elementIndex;
      }
      
      return true;
    }
    
    return false;
  }, []);

  // 初期フォーカス設定
  React.useEffect(() => {
    if (initialFocusRef && isScreenReaderActive) {
      // 少し遅延させてDOM構築完了を待つ
      const timer = setTimeout(() => {
        focusElement(initialFocusRef);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [initialFocusRef, isScreenReaderActive, focusElement]);

  // フォーカス復元
  React.useEffect(() => {
    if (restoreFocus) {
      // 現在のフォーカス要素を保存
      // React Nativeでは直接的な方法がないため、参照として保存
      previousFocusRef.current = document.activeElement; // Web環境での例
    }

    return () => {
      if (restoreFocus && previousFocusRef.current) {
        // フォーカスを復元
        try {
          if (previousFocusRef.current.focus) {
            previousFocusRef.current.focus();
          }
        } catch (error) {
          console.warn('FocusManager: フォーカス復元に失敗:', error);
        }
      }
    };
  }, [restoreFocus]);

  // フォーカストラップ
  const handleKeyPress = React.useCallback((event: any) => {
    if (!trapFocus || !isScreenReaderActive) return;

    if (event.nativeEvent?.key === 'Tab') {
      event.preventDefault();
      
      if (event.nativeEvent.shiftKey) {
        focusPrevious();
      } else {
        focusNext();
      }
    }
    
    if (event.nativeEvent?.key === 'Escape') {
      // Escape キーでフォーカストラップを終了
      if (previousFocusRef.current) {
        try {
          previousFocusRef.current.focus?.();
        } catch (error) {
          console.warn('FocusManager: Escapeでのフォーカス復元に失敗:', error);
        }
      }
    }
  }, [trapFocus, isScreenReaderActive, focusNext, focusPrevious]);

  const contextValue = React.useMemo(() => ({
    registerFocusableElement,
    unregisterFocusableElement,
    focusNext,
    focusPrevious,
    focusElement,
    isFocusTrapped: trapFocus
  }), [registerFocusableElement, unregisterFocusableElement, focusNext, focusPrevious, focusElement, trapFocus]);

  return (
    <FocusManagerContext.Provider value={contextValue}>
      <View
        ref={containerRef}
        style={[styles.container, style]}
        testID={testID}
        // フォーカストラップ用のアクセシビリティ属性
        {...(trapFocus && {
          accessibilityViewIsModal: true,
          accessibilityRole: 'none'
        })}
      >
        {children}
      </View>
    </FocusManagerContext.Provider>
  );
};

/**
 * フォーカス管理コンテキスト
 */
interface FocusManagerContextType {
  registerFocusableElement: (element: FocusableElement) => void;
  unregisterFocusableElement: (elementRef: React.RefObject<any>) => void;
  focusNext: () => boolean;
  focusPrevious: () => boolean;
  focusElement: (elementRef: React.RefObject<any>) => boolean;
  isFocusTrapped: boolean;
}

const FocusManagerContext = React.createContext<FocusManagerContextType | undefined>(undefined);

/**
 * フォーカス管理フック
 */
export const useFocusManager = () => {
  const context = React.useContext(FocusManagerContext);
  return context; // undefinedでも動作するように
};

/**
 * フォーカス可能要素フック
 */
export const useFocusableElement = (
  accessibilityLabel?: string,
  disabled: boolean = false,
  order: number = 0
) => {
  const elementRef = React.useRef<any>(null);
  const focusManager = useFocusManager();

  React.useEffect(() => {
    if (focusManager) {
      const element: FocusableElement = {
        ref: elementRef,
        accessibilityLabel,
        disabled,
        order
      };
      
      focusManager.registerFocusableElement(element);
      
      return () => {
        focusManager.unregisterFocusableElement(elementRef);
      };
    }
  }, [focusManager, accessibilityLabel, disabled, order]);

  return {
    ref: elementRef,
    focusElement: () => focusManager?.focusElement(elementRef),
    disabled
  };
};

/**
 * フォーカスインジケーターコンポーネント
 */
export interface FocusIndicatorProps {
  children: React.ReactNode;
  visible?: boolean;
  style?: ViewStyle;
}

export const FocusIndicator: React.FC<FocusIndicatorProps> = ({
  children,
  visible = true,
  style
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const { settings } = useAccessibility();

  const handleFocus = React.useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = React.useCallback(() => {
    setIsFocused(false);
  }, []);

  const indicatorStyle = React.useMemo(() => {
    if (!visible || !isFocused) return {};

    return {
      borderWidth: 2,
      borderColor: settings.highContrastMode ? '#FFFFFF' : '#007AFF',
      borderRadius: 4,
      shadowColor: settings.highContrastMode ? '#000000' : '#007AFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 4 // Android
    };
  }, [visible, isFocused, settings.highContrastMode]);

  return (
    <View
      style={[style, indicatorStyle]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

export default FocusManager;