import * as React from 'react';
import {
  Image,
  View,
  StyleSheet,
  ImageStyle,
  ViewStyle,
  ImageSourcePropType,
  ImageLoadEventData,
  NativeSyntheticEvent
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { debugAccessibility } from '../../utils/accessibilityUtils';
import { AccessibleText } from './AccessibleText';

export interface AccessibleImageProps {
  source: ImageSourcePropType;
  alt: string; // 必須の代替テキスト
  decorative?: boolean; // 装飾的画像の場合true
  accessibilityLabel?: string;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  onLoad?: (event: NativeSyntheticEvent<ImageLoadEventData>) => void;
  onError?: () => void;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  testID?: string;
  // 高コントラストモード用の代替画像
  highContrastSource?: ImageSourcePropType;
  // 画像が読み込めない場合の代替テキスト表示
  showAltTextOnError?: boolean;
}

/**
 * アクセシブル画像コンポーネント
 * 代替テキスト必須、装飾的画像の適切な処理、エラー時のフォールバック
 */
export const AccessibleImage: React.FC<AccessibleImageProps> = ({
  source,
  alt,
  decorative = false,
  accessibilityLabel,
  style,
  containerStyle,
  onLoad,
  onError,
  resizeMode = 'cover',
  testID,
  highContrastSource,
  showAltTextOnError = true,
  ...props
}) => {
  const [hasError, setHasError] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const { settings } = useAccessibility();

  // アクセシビリティデバッグ
  React.useEffect(() => {
    debugAccessibility('AccessibleImage', {
      accessible: !decorative,
      accessibilityLabel: decorative ? undefined : (accessibilityLabel || alt),
      accessibilityRole: 'image'
    });
  }, [decorative, accessibilityLabel, alt]);

  // 効果的なアクセシビリティラベル
  const effectiveAccessibilityLabel = React.useMemo(() => {
    if (decorative) return undefined;
    return accessibilityLabel || alt;
  }, [decorative, accessibilityLabel, alt]);

  // 高コントラストモード対応の画像ソース
  const effectiveSource = React.useMemo(() => {
    if (settings.highContrastMode && highContrastSource) {
      return highContrastSource;
    }
    return source;
  }, [settings.highContrastMode, highContrastSource, source]);

  // 画像読み込み処理
  const handleLoad = React.useCallback((event: NativeSyntheticEvent<ImageLoadEventData>) => {
    setIsLoaded(true);
    setHasError(false);
    
    // スクリーンリーダー使用時は画像読み込み完了をアナウンス
    if (settings.screenReaderEnabled && !decorative) {
      setTimeout(() => {
        // AccessibilityInfo.announceForAccessibility(`画像が読み込まれました: ${alt}`);
      }, 500);
    }
    
    onLoad?.(event);
  }, [settings.screenReaderEnabled, decorative, alt, onLoad]);

  // 画像エラー処理
  const handleError = React.useCallback(() => {
    setHasError(true);
    setIsLoaded(false);
    
    console.warn(`AccessibleImage: 画像の読み込みに失敗しました - ${alt}`);
    onError?.();
  }, [alt, onError]);

  // エラー時の代替コンテンツ
  const renderErrorFallback = () => {
    if (!showAltTextOnError) return null;

    return (
      <View style={[styles.errorContainer, style]}>
        <AccessibleText
          style={styles.errorText}
          accessibilityLabel={`画像読み込みエラー: ${alt}`}
        >
          📷 {alt}
        </AccessibleText>
      </View>
    );
  };

  // 読み込み中の表示
  const renderLoadingState = () => {
    return (
      <View style={[styles.loadingContainer, style]}>
        <AccessibleText
          style={styles.loadingText}
          accessibilityLabel="画像を読み込み中"
        >
          読み込み中...
        </AccessibleText>
      </View>
    );
  };

  // エラー状態の場合
  if (hasError) {
    return (
      <View style={containerStyle} testID={testID}>
        {renderErrorFallback()}
      </View>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      <Image
        source={effectiveSource}
        style={[style, !isLoaded && styles.loading]}
        onLoad={handleLoad}
        onError={handleError}
        resizeMode={resizeMode}
        // アクセシビリティ設定
        accessible={!decorative}
        accessibilityLabel={effectiveAccessibilityLabel}
        accessibilityRole={decorative ? undefined : 'image'}
        // 装飾的画像の場合はスクリーンリーダーから隠す
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
        {...props}
      />
      
      {/* 読み込み中の表示 */}
      {!isLoaded && !hasError && renderLoadingState()}
    </View>
  );
};

/**
 * アバター画像用のプリセットコンポーネント
 */
export const AccessibleAvatar: React.FC<Omit<AccessibleImageProps, 'alt'> & {
  userName: string;
  size?: number;
}> = ({ userName, size = 48, style, ...props }) => (
  <AccessibleImage
    {...props}
    alt={`${userName}さんのプロフィール画像`}
    style={[
      {
        width: size,
        height: size,
        borderRadius: size / 2
      } as ImageStyle,
      style
    ] as ImageStyle}
    accessibilityLabel={`${userName}さんのアバター`}
  />
);

/**
 * 投稿画像用のプリセットコンポーネント
 */
export const AccessiblePostImage: React.FC<Omit<AccessibleImageProps, 'alt'> & {
  description?: string;
  authorName: string;
}> = ({ description, authorName, ...props }) => (
  <AccessibleImage
    {...props}
    alt={description || `${authorName}さんの投稿画像`}
    accessibilityLabel={
      description 
        ? `${authorName}さんの投稿画像: ${description}`
        : `${authorName}さんの投稿画像`
    }
  />
);

/**
 * アイコン画像用のプリセットコンポーネント
 */
export const AccessibleIcon: React.FC<Omit<AccessibleImageProps, 'alt'> & {
  name: string;
  decorative?: boolean;
}> = ({ name, decorative = true, style, ...props }) => (
  <AccessibleImage
    {...props}
    alt={decorative ? '' : `${name}アイコン`}
    decorative={decorative}
    style={[{ width: 24, height: 24 } as ImageStyle, style] as ImageStyle}
  />
);

const styles = StyleSheet.create({
  loading: {
    opacity: 0.7
  },
  errorContainer: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed'
  },
  errorText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center'
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#666666',
    fontSize: 12
  }
});

export default AccessibleImage;