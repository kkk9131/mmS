/**
 * 投稿表示画面用の複数画像表示コンポーネント
 * 投稿に含まれる複数の画像を美しく表示する
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MultipleImageDisplayProps {
  images: string[];
  captions?: string[];
  containerStyle?: any;
  imageStyle?: any;
  maxDisplayImages?: number;
  showImageCount?: boolean;
}

export const MultipleImageDisplay: React.FC<MultipleImageDisplayProps> = ({
  images,
  captions = [],
  containerStyle,
  imageStyle,
  maxDisplayImages = 4,
  showImageCount = true
}) => {
  const { theme } = useTheme();
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<number, boolean>>({});
  
  // キャッシュバスター用のタイムスタンプを1回だけ生成
  const cacheTimestamp = useRef(cacheTimestamp).current;

  if (!images || images.length === 0) {
    return null;
  }


  // 画像読み込み状態管理
  const handleImageLoadStart = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: true }));
  };

  const handleImageLoadEnd = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  // フルスクリーン表示を開く
  const openFullScreen = (index: number) => {
    setCurrentImageIndex(index);
    setFullScreenVisible(true);
  };

  // フルスクリーン表示を閉じる
  const closeFullScreen = () => {
    setFullScreenVisible(false);
  };

  // 次の画像へ
  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  // 前の画像へ
  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // 画像レイアウトを決定
  const getImageLayout = () => {
    const count = Math.min(images.length, maxDisplayImages);
    
    if (count === 1) {
      return { type: 'single', displayCount: 1 };
    } else if (count === 2) {
      return { type: 'two-column', displayCount: 2 };
    } else if (count === 3) {
      return { type: 'three-mixed', displayCount: 3 };
    } else {
      return { type: 'grid', displayCount: 4 };
    }
  };

  const layout = getImageLayout();
  const displayImages = images.slice(0, layout.displayCount);
  const remainingCount = images.length - layout.displayCount;

  // 単一画像レイアウト
  const renderSingleImage = () => (
    <TouchableOpacity
      style={[styles.singleImageContainer, containerStyle]}
      onPress={() => openFullScreen(0)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`画像を表示 ${captions[0] ? `キャプション: ${captions[0]}` : ''}`}
    >
      <Image
        source={{ 
          uri: `${displayImages[0]}?cache=${cacheTimestamp}&index=0`,
          cache: 'reload'
        }}
        style={[styles.singleImage, imageStyle]}
        resizeMode="cover"
        onLoadStart={() => handleImageLoadStart(0)}
        onLoadEnd={() => handleImageLoadEnd(0)}
        onError={() => handleImageLoadEnd(0)}
      />
      {imageLoadingStates[0] && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
      {captions[0] && (
        <View style={[styles.captionContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.captionText, { color: theme.colors.text.primary }]}>
            {captions[0]}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // 2カラムレイアウト
  const renderTwoColumnLayout = () => (
    <View style={[styles.twoColumnContainer, containerStyle]}>
      {displayImages.map((imageUrl, index) => (
        <TouchableOpacity
          key={index}
          style={styles.twoColumnItem}
          onPress={() => openFullScreen(index)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`画像${index + 1}を表示 ${captions[index] ? `キャプション: ${captions[index]}` : ''}`}
        >
          <Image
            source={{ 
              uri: `${imageUrl}?cache=${cacheTimestamp}&index=${index}`,
              cache: 'reload'
            }}
            style={[styles.twoColumnImage, imageStyle]}
            resizeMode="cover"
            onLoadStart={() => handleImageLoadStart(index)}
            onLoadEnd={() => handleImageLoadEnd(index)}
            onError={() => handleImageLoadEnd(index)}
          />
          {imageLoadingStates[index] && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          )}
          {captions[index] && (
            <View style={[styles.miniCaptionContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.miniCaptionText, { color: theme.colors.text.primary }]} numberOfLines={2}>
                {captions[index]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  // 3画像混合レイアウト
  const renderThreeMixedLayout = () => (
    <View style={[styles.threeMixedContainer, containerStyle]}>
      <TouchableOpacity
        style={styles.threeMixedMainItem}
        onPress={() => openFullScreen(0)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`メイン画像を表示 ${captions[0] ? `キャプション: ${captions[0]}` : ''}`}
      >
        <Image
          source={{ 
            uri: `${displayImages[0]}?cache=${cacheTimestamp}&index=0`,
            cache: 'reload'
          }}
          style={[styles.threeMixedMainImage, imageStyle]}
          resizeMode="cover"
          onLoadStart={() => handleImageLoadStart(0)}
          onLoadEnd={() => handleImageLoadEnd(0)}
          onError={() => handleImageLoadEnd(0)}
        />
        {imageLoadingStates[0] && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.threeMixedSideContainer}>
        {displayImages.slice(1).map((imageUrl, index) => (
          <TouchableOpacity
            key={index + 1}
            style={styles.threeMixedSideItem}
            onPress={() => openFullScreen(index + 1)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`画像${index + 2}を表示`}
          >
            <Image
              source={{ 
                uri: `${imageUrl}?cache=${cacheTimestamp}&index=${index + 1}`,
                cache: 'reload'
              }}
              style={[styles.threeMixedSideImage, imageStyle]}
              resizeMode="cover"
              onLoadStart={() => handleImageLoadStart(index + 1)}
              onLoadEnd={() => handleImageLoadEnd(index + 1)}
              onError={() => handleImageLoadEnd(index + 1)}
            />
            {imageLoadingStates[index + 1] && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // グリッドレイアウト
  const renderGridLayout = () => (
    <View style={[styles.gridContainer, containerStyle]}>
      {displayImages.map((imageUrl, index) => (
            <TouchableOpacity
              key={`grid_${index}_${imageUrl}`}
              style={[
                styles.gridItem,
                index === 3 && remainingCount > 0 && styles.gridItemOverlay
              ]}
              onPress={() => openFullScreen(index)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`画像${index + 1}を表示`}
            >
              <Image
                source={{ 
                  uri: `${imageUrl}?cache=${cacheTimestamp}&index=${index}`,
                  cache: 'reload' 
                }}
                style={[styles.gridImage, imageStyle]}
                resizeMode="cover"
                onLoadStart={() => handleImageLoadStart(index)}
                onLoadEnd={() => handleImageLoadEnd(index)}
                onError={() => handleImageLoadEnd(index)}
              />
          {imageLoadingStates[index] && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          )}
          {index === 3 && remainingCount > 0 && (
            <View style={[styles.remainingCountOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
              <Text style={[styles.remainingCountText, { color: theme.colors.text.primary }]}>
                +{remainingCount}
              </Text>
            </View>
          )}
            </TouchableOpacity>
        ))}
    </View>
  );

  // フルスクリーンモーダル
  const renderFullScreenModal = () => (
    <Modal
      visible={fullScreenVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeFullScreen}
    >
      <View style={[styles.fullScreenContainer, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]}>
        {/* ヘッダー */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.fullScreenCounter, { color: theme.colors.text.primary }]}>
            {currentImageIndex + 1} / {images.length}
          </Text>
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={closeFullScreen}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
          >
            <X size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* 画像表示エリア */}
        <View style={styles.fullScreenImageContainer}>
          {images[currentImageIndex] ? (
            <Image
              source={{ 
                uri: `${images[currentImageIndex]}?cache=${cacheTimestamp}&index=${currentImageIndex}&fullscreen=true`,
                cache: 'reload'
              }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              onLoadStart={() => handleImageLoadStart(currentImageIndex)}
              onLoadEnd={() => handleImageLoadEnd(currentImageIndex)}
              onError={() => handleImageLoadEnd(currentImageIndex)}
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={[styles.noImageText, { color: theme.colors.text.secondary }]}>
                画像を読み込めません
              </Text>
            </View>
          )}
          
          {/* ローディングインジケーター */}
          {imageLoadingStates[currentImageIndex] && (
            <View style={[styles.fullScreenLoadingOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
          
          {/* ナビゲーションボタン */}
          {images.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.fullScreenNavButton, styles.fullScreenNavButtonLeft]}
                onPress={goToPrevImage}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="前の画像"
              >
                <ChevronLeft size={32} color={theme.colors.text.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.fullScreenNavButton, styles.fullScreenNavButtonRight]}
                onPress={goToNextImage}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="次の画像"
              >
                <ChevronRight size={32} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* キャプション表示 */}
        {captions[currentImageIndex] && (
          <View style={[styles.fullScreenCaptionContainer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.fullScreenCaptionText, { color: theme.colors.text.primary }]}>
              {captions[currentImageIndex]}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );

  // メインレンダリング
  return (
    <View>
      {layout.type === 'single' && renderSingleImage()}
      {layout.type === 'two-column' && renderTwoColumnLayout()}
      {layout.type === 'three-mixed' && renderThreeMixedLayout()}
      {layout.type === 'grid' && renderGridLayout()}
      
      {showImageCount && images.length > 1 && (
        <View style={styles.imageCountBadge}>
          <Text style={[styles.imageCountText, { color: theme.colors.text.secondary }]}>
            {images.length}枚の画像
          </Text>
        </View>
      )}

      {renderFullScreenModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  // 単一画像レイアウト
  singleImageContainer: {
    position: 'relative',
    marginVertical: 8,
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },

  // 2カラムレイアウト
  twoColumnContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  twoColumnItem: {
    flex: 1,
    position: 'relative',
  },
  twoColumnImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },

  // 3画像混合レイアウト
  threeMixedContainer: {
    flexDirection: 'row',
    gap: 8,
    height: 200,
    marginVertical: 8,
  },
  threeMixedMainItem: {
    flex: 2,
    position: 'relative',
  },
  threeMixedMainImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  threeMixedSideContainer: {
    flex: 1,
    gap: 8,
  },
  threeMixedSideItem: {
    flex: 1,
    position: 'relative',
  },
  threeMixedSideImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },

  // グリッドレイアウト
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 8,
  },
  gridItem: {
    width: '48.5%',
    height: 120,
    position: 'relative',
  },
  gridItemOverlay: {
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },

  // 共通スタイル
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
  },

  // キャプション
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    opacity: 0.9,
  },
  captionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  miniCaptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    opacity: 0.9,
  },
  miniCaptionText: {
    fontSize: 12,
    fontWeight: '400',
  },

  // 残り枚数表示
  remainingCountOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  remainingCountText: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  // 画像枚数バッジ
  imageCountBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  imageCountText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // フルスクリーンモーダル
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Safe area
  },
  fullScreenCounter: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenCloseButton: {
    padding: 8,
  },
  fullScreenImageContainer: {
    flex: 1,
    position: 'relative',
  },
  fullScreenImage: {
    width: screenWidth,
    height: '100%',
  },
  fullScreenNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -16 }],
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 32,
  },
  fullScreenNavButtonLeft: {
    left: 16,
  },
  fullScreenNavButtonRight: {
    right: 16,
  },
  fullScreenCaptionContainer: {
    padding: 16,
    paddingBottom: 32, // Safe area
  },
  fullScreenCaptionText: {
    fontSize: 16,
    lineHeight: 22,
  },
  fullScreenLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noImageText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MultipleImageDisplay;