/**
 * フルスクリーン画像ビューワー
 * ズーム、パン、ジェスチャー操作対応
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  StatusBar
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  State
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { X, Download, Share, MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { LazyImage } from './LazyImage';

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  title?: string;
  altText?: string;
  enableDownload?: boolean;
  enableShare?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  imageUri,
  onClose,
  onDownload,
  onShare,
  title,
  altText,
  enableDownload = true,
  enableShare = true
}) => {
  const { theme } = useTheme();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [imageSize, setImageSize] = useState({ width: screenWidth, height: screenHeight });
  
  // アニメーション値
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  
  // ジェスチャー状態
  const [isZoomed, setIsZoomed] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // コントロール自動非表示
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setControlsVisible(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  };

  // ピンチジェスチャーハンドラー
  const pinchHandler = useAnimatedGestureHandler({
    onStart: () => {
      runOnJS(resetControlsTimeout)();
    },
    onActive: (event) => {
      scale.value = Math.max(0.5, Math.min(3, event.scale));
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        runOnJS(setIsZoomed)(false);
      } else if (scale.value > 1) {
        runOnJS(setIsZoomed)(true);
      }
    }
  });

  // パンジェスチャーハンドラー
  const panHandler = useAnimatedGestureHandler({
    onStart: () => {
      runOnJS(resetControlsTimeout)();
    },
    onActive: (event) => {
      if (scale.value > 1) {
        // ズーム時のパン制限
        const maxX = (imageSize.width * scale.value - screenWidth) / 2;
        const maxY = (imageSize.height * scale.value - screenHeight) / 2;
        
        translateX.value = Math.max(-maxX, Math.min(maxX, event.translationX));
        translateY.value = Math.max(-maxY, Math.min(maxY, event.translationY));
      } else {
        // 通常時は閉じるジェスチャー
        translateY.value = event.translationY;
        const progress = Math.abs(event.translationY) / screenHeight;
        opacity.value = 1 - progress * 0.5;
      }
    },
    onEnd: (event) => {
      if (scale.value <= 1) {
        // 閉じるジェスチャーの判定
        if (Math.abs(event.translationY) > 100 || Math.abs(event.velocityY) > 500) {
          runOnJS(handleClose)();
        } else {
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          opacity.value = withTiming(1);
        }
      }
    }
  });

  // ダブルタップでズーム
  const handleDoubleTap = () => {
    resetControlsTimeout();
    
    if (isZoomed) {
      // ズームアウト
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      setIsZoomed(false);
    } else {
      // ズームイン
      scale.value = withSpring(2);
      setIsZoomed(true);
    }
  };

  const handleClose = () => {
    // アニメーションをリセット
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    opacity.value = 1;
    setIsZoomed(false);
    onClose();
  };

  const handleImageLoad = (width: number, height: number) => {
    // 画像のアスペクト比を保持してスクリーンに収める
    const aspectRatio = width / height;
    const screenAspectRatio = screenWidth / screenHeight;
    
    let finalWidth, finalHeight;
    
    if (aspectRatio > screenAspectRatio) {
      // 横長の画像
      finalWidth = screenWidth;
      finalHeight = screenWidth / aspectRatio;
    } else {
      // 縦長の画像
      finalHeight = screenHeight;
      finalWidth = screenHeight * aspectRatio;
    }
    
    setImageSize({ width: finalWidth, height: finalHeight });
  };

  const toggleControls = () => {
    setControlsVisible(!controlsVisible);
    resetControlsTimeout();
  };

  // アニメーションスタイル
  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      
      <Animated.View style={[styles.container, backgroundAnimatedStyle]}>
        {/* 背景タップエリア */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={toggleControls}
          activeOpacity={1}
        />
        
        {/* 画像 */}
        <PanGestureHandler onGestureEvent={panHandler}>
          <Animated.View style={styles.imageContainer}>
            <PinchGestureHandler onGestureEvent={pinchHandler}>
              <Animated.View style={imageAnimatedStyle}>
                <TouchableOpacity
                  onPress={toggleControls}
                  onLongPress={handleDoubleTap}
                  activeOpacity={1}
                >
                  <LazyImage
                    uri={imageUri}
                    width={imageSize.width}
                    height={imageSize.height}
                    resizeMode="contain"
                    onLoad={() => {
                      // 実際の画像サイズを取得するためのより良い方法が必要
                      // ここでは簡易的な処理
                      handleImageLoad(imageSize.width, imageSize.height);
                    }}
                    accessibilityLabel={altText || title || '画像'}
                    priority="high"
                  />
                </TouchableOpacity>
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
        
        {/* トップコントロール */}
        {controlsVisible && (
          <Animated.View 
            style={[styles.topControls, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            entering="fadeIn"
            exiting="fadeOut"
          >
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleClose}
              accessible={true}
              accessibilityLabel="画像ビューワーを閉じる"
              accessibilityRole="button"
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              {title && (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {/* メニューの実装 */}}
              accessible={true}
              accessibilityLabel="メニュー"
              accessibilityRole="button"
            >
              <MoreHorizontal size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        )}
        
        {/* ボトムコントロール */}
        {controlsVisible && (
          <Animated.View 
            style={[styles.bottomControls, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            entering="fadeIn"
            exiting="fadeOut"
          >
            {enableShare && onShare && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onShare}
                accessible={true}
                accessibilityLabel="画像を共有"
                accessibilityRole="button"
              >
                <Share size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>共有</Text>
              </TouchableOpacity>
            )}
            
            {enableDownload && onDownload && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onDownload}
                accessible={true}
                accessibilityLabel="画像をダウンロード"
                accessibilityRole="button"
              >
                <Download size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>保存</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
        
        {/* ズーム状態インジケーター */}
        {isZoomed && controlsVisible && (
          <Animated.View 
            style={styles.zoomIndicator}
            entering="fadeIn"
            exiting="fadeOut"
          >
            <Text style={styles.zoomText}>
              {Math.round(scale.value * 100)}%
            </Text>
          </Animated.View>
        )}
        
        {/* ヘルプテキスト */}
        {controlsVisible && !isZoomed && (
          <Animated.View 
            style={styles.helpContainer}
            entering="fadeIn"
            exiting="fadeOut"
          >
            <Text style={styles.helpText}>
              ピンチでズーム • ダブルタップでズーム切替 • 下スワイプで閉じる
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 16
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 40,
    paddingBottom: 40
  },
  actionButton: {
    alignItems: 'center',
    gap: 4
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500'
  },
  zoomIndicator: {
    position: 'absolute',
    top: 120,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  zoomText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  helpContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: 'center'
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center'
  }
});

export default ImageViewer;