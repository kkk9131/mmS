import * as React from 'react';
import { AccessibilityInfo, Dimensions, Platform } from 'react-native';
import { useAccessibility as useAccessibilityContext } from '../contexts/AccessibilityContext';

/**
 * フォーカス管理のためのカスタムフック
 */
export const useFocusManagement = () => {
  const focusOrderRef = React.useRef<React.RefObject<any>[]>([]);
  const currentFocusIndex = React.useRef(0);

  const setFocusOrder = React.useCallback((elements: React.RefObject<any>[]) => {
    focusOrderRef.current = elements.filter(el => el.current);
  }, []);

  const moveFocusToNext = React.useCallback(() => {
    const elements = focusOrderRef.current;
    if (elements.length === 0) return;

    currentFocusIndex.current = (currentFocusIndex.current + 1) % elements.length;
    const nextElement = elements[currentFocusIndex.current];
    
    if (nextElement?.current) {
      AccessibilityInfo.setAccessibilityFocus(nextElement.current);
    }
  }, []);

  const moveFocusToPrevious = React.useCallback(() => {
    const elements = focusOrderRef.current;
    if (elements.length === 0) return;

    currentFocusIndex.current = currentFocusIndex.current === 0 
      ? elements.length - 1 
      : currentFocusIndex.current - 1;
    
    const prevElement = elements[currentFocusIndex.current];
    
    if (prevElement?.current) {
      AccessibilityInfo.setAccessibilityFocus(prevElement.current);
    }
  }, []);

  const trapFocus = React.useCallback((container: React.RefObject<any>) => {
    // フォーカストラップの実装（モーダル用）
    if (container.current) {
      AccessibilityInfo.setAccessibilityFocus(container.current);
    }
  }, []);

  const releaseFocusTrap = React.useCallback(() => {
    // フォーカストラップの解除
    currentFocusIndex.current = 0;
  }, []);

  const announcePageChange = React.useCallback((pageName: string) => {
    AccessibilityInfo.announceForAccessibility(`${pageName}画面に移動しました`);
  }, []);

  return {
    setFocusOrder,
    moveFocusToNext,
    moveFocusToPrevious,
    trapFocus,
    releaseFocusTrap,
    announcePageChange
  };
};

/**
 * タップターゲットサイズ検証のためのカスタムフック
 */
export const useTapTargetValidation = () => {
  const validateTapTarget = React.useCallback((element: React.RefObject<any>): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!element.current) {
        resolve(false);
        return;
      }

      element.current.measure((x: number, y: number, width: number, height: number) => {
        const minSize = 48; // dp
        const isValid = width >= minSize && height >= minSize;
        
        if (!isValid) {
          console.warn(`タップターゲットサイズが不足: ${width}x${height}dp (最小: ${minSize}x${minSize}dp)`);
        }
        
        resolve(isValid);
      });
    });
  }, []);

  return { validateTapTarget };
};

/**
 * コントラスト比調整のためのカスタムフック
 */
export const useContrastAdjustment = () => {
  const { settings } = useAccessibilityContext();

  const adjustColorContrast = React.useCallback((baseColor: string, targetRatio: number = 4.5): string => {
    // 簡易的なコントラスト調整実装
    if (settings.highContrastMode) {
      // 高コントラストモード時は白黒に調整
      const hex = baseColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // 輝度計算 (簡易版)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }
    
    return baseColor;
  }, [settings.highContrastMode]);

  const getContrastAdjustedColor = React.useCallback((baseColor: string) => {
    const targetRatio = settings.highContrastMode ? 7.0 : 4.5; // AAA : AA
    return adjustColorContrast(baseColor, targetRatio);
  }, [settings.highContrastMode, adjustColorContrast]);

  return { getContrastAdjustedColor, adjustColorContrast };
};

/**
 * 片手操作ゾーン計算のためのカスタムフック
 */
export const useOneHandedZones = () => {
  const [screenDimensions, setScreenDimensions] = React.useState(() => Dimensions.get('window'));

  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const getOneHandedZones = React.useCallback(() => {
    const { height } = screenDimensions;
    
    return {
      EASY: {
        bottom: 0,
        height: height * 0.3, // 下30%は親指で簡単に届く
        top: height * 0.7
      },
      MEDIUM: {
        bottom: height * 0.3,
        height: height * 0.4, // 中央40%は少し伸ばせば届く
        top: height * 0.3
      },
      HARD: {
        bottom: height * 0.7,
        height: height * 0.3, // 上30%は届きにくい
        top: 0
      }
    };
  }, [screenDimensions]);

  const isInEasyZone = React.useCallback((elementY: number, elementHeight: number) => {
    const zones = getOneHandedZones();
    const elementBottom = elementY + elementHeight;
    
    return elementY >= zones.EASY.top || elementBottom <= zones.EASY.top + zones.EASY.height;
  }, [getOneHandedZones]);

  return {
    getOneHandedZones,
    isInEasyZone,
    screenDimensions
  };
};

/**
 * ハプティックフィードバック管理のためのカスタムフック
 */
export const useHapticFeedback = () => {
  const { settings } = useAccessibilityContext();

  const triggerHaptic = React.useCallback(async (type: 'light' | 'medium' | 'heavy' | 'selection' = 'light') => {
    if (!settings.hapticFeedbackEnabled) return;

    try {
      if (Platform.OS === 'ios') {
        const Haptics = await import('expo-haptics');
        
        switch (type) {
          case 'light':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'selection':
            Haptics.selectionAsync();
            break;
        }
      } else {
        // Android の場合は Vibration API を使用
        const { Vibration } = await import('react-native');
        
        switch (type) {
          case 'light':
            Vibration.vibrate(50);
            break;
          case 'medium':
            Vibration.vibrate(100);
            break;
          case 'heavy':
            Vibration.vibrate(200);
            break;
          case 'selection':
            Vibration.vibrate(25);
            break;
        }
      }
    } catch (error) {
      console.warn('useHapticFeedback: ハプティックフィードバックに失敗:', error);
    }
  }, [settings.hapticFeedbackEnabled]);

  return { triggerHaptic };
};

/**
 * アクセシビリティ統合フック
 */
export const useAccessibilityFeatures = () => {
  const accessibilityContext = useAccessibilityContext();
  const focusManagement = useFocusManagement();
  const tapTargetValidation = useTapTargetValidation();
  const contrastAdjustment = useContrastAdjustment();
  const oneHandedZones = useOneHandedZones();
  const hapticFeedback = useHapticFeedback();

  return {
    ...accessibilityContext,
    ...focusManagement,
    ...tapTargetValidation,
    ...contrastAdjustment,
    ...oneHandedZones,
    ...hapticFeedback
  };
};