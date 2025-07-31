/**
 * 複数画像プレビューカルーセルコンポーネント
 * 水平スクロール表示、ドラッグ&ドロップ並び替え、キャプション機能を提供
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State as GestureState,
} from 'react-native-gesture-handler';
import { useTheme } from '../../contexts/ThemeContext';
import { ImagePreviewCarouselProps, ImageAssetWithCaption } from '../../types/image';
import { ImagePreviewThumbnail } from './ImagePreviewThumbnail';
import { ImageCaptionInput } from './ImageCaptionInput';

const { width: screenWidth } = Dimensions.get('window');

export const ImagePreviewCarousel: React.FC<ImagePreviewCarouselProps> = ({
  images,
  onImageRemove,
  onImageReorder,
  onCaptionChange,
  editable = true
}) => {
  const { theme } = useTheme();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [selectedImageForCaption, setSelectedImageForCaption] = useState<ImageAssetWithCaption | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // ドラッグ&ドロップ用のアニメーション値
  const draggedImagePosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const draggedImageScale = useRef(new Animated.Value(1)).current;

  // ドラッグ開始処理
  const onDragStart = (index: number) => {
    if (!editable) return;
    
    setDraggingIndex(index);
    
    // ドラッグ開始アニメーション
    Animated.parallel([
      Animated.spring(draggedImageScale, {
        toValue: 1.1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ドラッグ中の処理
  const onDragMove = (gestureState: any) => {
    if (draggingIndex === null) return;
    
    draggedImagePosition.setValue({
      x: gestureState.translationX || 0,
      y: gestureState.translationY || 0,
    });
  };

  // ドラッグ終了処理
  const onDragEnd = (gestureState: any) => {
    if (draggingIndex === null) return;
    
    const draggedDistance = gestureState.translationX || 0;
    const imageWidth = 96; // サムネイル幅 + マージン
    const newIndex = Math.round(draggingIndex + draggedDistance / imageWidth);
    
    // 範囲チェック
    const clampedNewIndex = Math.max(0, Math.min(images.length - 1, newIndex));
    
    // 位置が変わった場合のみ並び替え実行
    if (clampedNewIndex !== draggingIndex) {
      onImageReorder(draggingIndex, clampedNewIndex);
    }
    
    // アニメーションリセット
    Animated.parallel([
      Animated.spring(draggedImagePosition, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }),
      Animated.spring(draggedImageScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDraggingIndex(null);
    });
  };

  // PanResponderの設定（フォールバック用）
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return editable && Math.abs(gestureState.dx) > 10;
    },
    
    onPanResponderGrant: (evt, gestureState) => {
      // タッチ位置から画像インデックスを計算
      const touchX = evt.nativeEvent.locationX;
      const index = Math.floor(touchX / 96);
      if (index >= 0 && index < images.length) {
        onDragStart(index);
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      onDragMove(gestureState);
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      onDragEnd(gestureState);
    },
  });

  // 画像タップ処理（キャプション編集）
  const handleImagePress = (image: ImageAssetWithCaption) => {
    if (!editable) return;
    
    setSelectedImageForCaption(image);
    setCaptionModalVisible(true);
  };

  // キャプション保存処理
  const handleCaptionSave = (caption: string) => {
    if (selectedImageForCaption) {
      onCaptionChange(selectedImageForCaption.id, caption);
    }
    setCaptionModalVisible(false);
    setSelectedImageForCaption(null);
  };

  // キャプション編集キャンセル
  const handleCaptionCancel = () => {
    setCaptionModalVisible(false);
    setSelectedImageForCaption(null);
  };

  // 画像削除確認
  const handleImageRemove = (imageId: string) => {
    if (Platform.OS === 'web') {
      const shouldDelete = window.confirm('この画像を削除しますか？');
      if (shouldDelete) {
        onImageRemove(imageId);
      }
    } else {
      Alert.alert(
        '画像を削除',
        'この画像を削除しますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除',
            style: 'destructive',
            onPress: () => onImageRemove(imageId)
          }
        ]
      );
    }
  };

  // 画像が空の場合
  if (images.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
          画像が選択されていません
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          選択した画像
        </Text>
        <Text style={[styles.imageCount, { color: theme.colors.text.secondary }]}>
          {images.length}枚
        </Text>
      </View>

      {/* ドラッグ&ドロップ説明 */}
      {editable && images.length > 1 && (
        <Text style={[styles.instructionText, { color: theme.colors.text.secondary }]}>
          長押しして並び替えができます
        </Text>
      )}

      {/* 画像カルーセル */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={draggingIndex === null}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      >
        {images.map((image, index) => {
          const isDragging = draggingIndex === index;
          
          return (
            <Animated.View
              key={`${image.id}_${index}`}
              style={[
                styles.imageItem,
                isDragging && {
                  transform: [
                    { translateX: draggedImagePosition.x },
                    { translateY: draggedImagePosition.y },
                    { scale: draggedImageScale },
                  ],
                  zIndex: 1000,
                },
              ]}
            >
              <ImagePreviewThumbnail
                image={image}
                caption={image.caption}
                onRemove={() => handleImageRemove(image.id)}
                onCaptionChange={(caption) => onCaptionChange(image.id, caption)}
                onPress={() => handleImagePress(image)}
                editable={editable}
                size="medium"
              />
              
              {/* 長押しハンドル（視覚的なヒント） */}
              {editable && images.length > 1 && (
                <View style={[styles.dragHandle, { backgroundColor: theme.colors.surface }]}>
                  <View style={[styles.dragDots, { backgroundColor: theme.colors.text.secondary }]} />
                  <View style={[styles.dragDots, { backgroundColor: theme.colors.text.secondary }]} />
                  <View style={[styles.dragDots, { backgroundColor: theme.colors.text.secondary }]} />
                </View>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* 投稿順序説明 */}
      <View style={styles.orderInfo}>
        <Text style={[styles.orderInfoText, { color: theme.colors.text.secondary }]}>
          左から順番に投稿に表示されます
        </Text>
      </View>

      {/* キャプション入力モーダル */}
      {selectedImageForCaption && (
        <ImageCaptionInput
          visible={captionModalVisible}
          image={selectedImageForCaption}
          initialCaption={selectedImageForCaption.caption || ''}
          onSave={handleCaptionSave}
          onCancel={handleCaptionCancel}
          maxLength={100}
        />
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  imageCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  imageItem: {
    marginRight: 12,
    position: 'relative',
  },
  dragHandle: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dragDots: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  orderInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  orderInfoText: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    margin: 16,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ImagePreviewCarousel;