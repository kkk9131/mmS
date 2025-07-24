/**
 * 遅延読み込み画像コンポーネント
 * ビューポート検出、プログレッシブローディング、キャッシュ統合
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Text
} from 'react-native';
import { ImageOff, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { CacheManager } from '../../services/image/CacheManager';

interface LazyImageProps {
  uri: string;
  width?: number;
  height?: number;
  style?: any;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: any) => void;
  onPress?: () => void;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  borderRadius?: number;
  cacheKey?: string;
  priority?: 'low' | 'normal' | 'high';
  accessibilityLabel?: string;
  enableCache?: boolean;
}

interface LoadState {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  retryCount: number;
}

const { width: screenWidth } = Dimensions.get('window');

export const LazyImage: React.FC<LazyImageProps> = ({
  uri,
  width,
  height,
  style,
  placeholder,
  onLoad,
  onError,
  onPress,
  resizeMode = 'cover',
  borderRadius = 0,
  cacheKey,
  priority = 'normal',
  accessibilityLabel,
  enableCache = true
}) => {
  const { theme } = useTheme();
  const [loadState, setLoadState] = useState<LoadState>({
    loading: true,
    loaded: false,
    error: false,
    retryCount: 0
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const imageRef = useRef<Image>(null);
  const cacheManager = useRef(CacheManager.getInstance()).current;
  const mountedRef = useRef(true);

  // ビューポート検出
  useEffect(() => {
    const timer = setTimeout(() => {
      // 簡易的なビューポート検出（実際の実装では Intersection Observer や onLayout を使用）
      setIsInViewport(true);
    }, priority === 'high' ? 0 : priority === 'normal' ? 100 : 300);

    return () => clearTimeout(timer);
  }, [priority]);

  // 画像読み込み処理
  useEffect(() => {
    if (!isInViewport || !uri) return;

    loadImage();

    return () => {
      mountedRef.current = false;
    };
  }, [isInViewport, uri]);

  const loadImage = async () => {
    if (!mountedRef.current) return;

    try {
      setLoadState(prev => ({ ...prev, loading: true, error: false }));

      let finalUri = uri;

      // キャッシュから取得を試行
      if (enableCache && cacheKey) {
        const cachedImage = await cacheManager.retrieve(cacheKey);
        if (cachedImage && typeof cachedImage.data === 'string') {
          finalUri = cachedImage.data;
          console.log('🎯 キャッシュから画像読み込み:', cacheKey);
        }
      }

      setImageUri(finalUri);
    } catch (error) {
      console.error('❌ 画像読み込み準備エラー:', error);
      if (mountedRef.current) {
        setLoadState(prev => ({ 
          ...prev, 
          loading: false, 
          error: true 
        }));
        onError?.(error);
      }
    }
  };

  const handleImageLoad = async () => {
    if (!mountedRef.current) return;

    try {
      setLoadState(prev => ({ 
        ...prev, 
        loading: false, 
        loaded: true, 
        error: false 
      }));

      // キャッシュに保存
      if (enableCache && cacheKey && imageUri && imageUri !== uri) {
        // すでにキャッシュされている場合はスキップ
      } else if (enableCache && cacheKey && imageUri === uri) {
        // 元のURIの場合はキャッシュに保存
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const size = blob.size;
          
          if (size < 10 * 1024 * 1024) { // 10MB未満の場合のみキャッシュ
            await cacheManager.store(cacheKey, {
              data: uri,
              metadata: {
                size,
                lastAccessed: new Date(),
                cacheKey
              }
            });
            console.log('💾 画像をキャッシュに保存:', cacheKey);
          }
        } catch (cacheError) {
          console.warn('⚠️ 画像キャッシュ保存失敗:', cacheError);
        }
      }

      onLoad?.();
    } catch (error) {
      console.error('❌ 画像読み込み完了処理エラー:', error);
    }
  };

  const handleImageError = (error: any) => {
    if (!mountedRef.current) return;

    console.error('❌ 画像読み込みエラー:', error);
    setLoadState(prev => ({ 
      ...prev, 
      loading: false, 
      error: true 
    }));
    onError?.(error);
  };

  const handleRetry = () => {
    if (loadState.retryCount < 3) {
      setLoadState(prev => ({ 
        ...prev, 
        retryCount: prev.retryCount + 1,
        error: false
      }));
      loadImage();
    }
  };

  const getImageStyle = () => {
    const baseStyle = {
      width: width || '100%',
      height: height || 200,
      borderRadius
    };

    return [baseStyle, style];
  };

  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <View style={[
        styles.placeholder,
        {
          width: width || '100%',
          height: height || 200,
          backgroundColor: theme.colors.card,
          borderRadius
        }
      ]}>
        {loadState.loading && (
          <ActivityIndicator 
            size="large" 
            color={theme.colors.primary}
            accessibilityLabel="画像読み込み中"
          />
        )}
        {loadState.error && (
          <View style={styles.errorContainer}>
            <ImageOff size={32} color={theme.colors.text.secondary} />
            <Text style={[styles.errorText, { color: theme.colors.text.secondary }]}>
              画像を読み込めません
            </Text>
            {loadState.retryCount < 3 && (
              <TouchableOpacity
                style={[styles.retryButton, { borderColor: theme.colors.border }]}
                onPress={handleRetry}
                accessible={true}
                accessibilityLabel="再読み込み"
                accessibilityRole="button"
              >
                <RotateCcw size={16} color={theme.colors.text.primary} />
                <Text style={[styles.retryText, { color: theme.colors.text.primary }]}>
                  再試行
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderImage = () => {
    if (!imageUri || !isInViewport) {
      return renderPlaceholder();
    }

    return (
      <View>
        <Image
          ref={imageRef}
          source={{ uri: imageUri }}
          style={getImageStyle()}
          resizeMode={resizeMode}
          onLoad={handleImageLoad}
          onError={handleImageError}
          accessible={true}
          accessibilityLabel={accessibilityLabel || '画像'}
        />
        
        {/* ローディングオーバーレイ */}
        {loadState.loading && (
          <View style={[
            styles.loadingOverlay,
            {
              width: width || '100%',
              height: height || 200,
              borderRadius
            }
          ]}>
            <ActivityIndicator 
              size="large" 
              color={theme.colors.primary}
              accessibilityLabel="画像読み込み中"
            />
          </View>
        )}
        
        {/* エラーオーバーレイ */}
        {loadState.error && (
          <View style={[
            styles.errorOverlay,
            {
              width: width || '100%',
              height: height || 200,
              backgroundColor: theme.colors.card,
              borderRadius
            }
          ]}>
            {renderPlaceholder()}
          </View>
        )}
      </View>
    );
  };

  const ImageComponent = onPress ? TouchableOpacity : View;

  return (
    <ImageComponent
      onPress={onPress}
      accessible={!!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `${accessibilityLabel || '画像'}をタップして拡大` : undefined}
    >
      {renderImage()}
    </ImageComponent>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center'
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    gap: 4,
    marginTop: 4
  },
  retryText: {
    fontSize: 12,
    fontWeight: '500'
  }
});

export default LazyImage;