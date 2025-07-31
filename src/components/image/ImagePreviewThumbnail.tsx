/**
 * 複数画像投稿用のサムネイルプレビューコンポーネント
 * 80x80dpサイズのサムネイル表示、削除ボタン、キャプション機能を提供
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { X, Edit3 } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ImagePreviewThumbnailProps } from '../../types/image';

export const ImagePreviewThumbnail: React.FC<ImagePreviewThumbnailProps> = ({
  image,
  caption,
  onRemove,
  onCaptionChange,
  onPress,
  editable = true,
  size = 'medium'
}) => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  // サイズ設定
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return { width: 60, height: 60, fontSize: 10 };
      case 'large':
        return { width: 120, height: 120, fontSize: 14 };
      default:
        return { width: 80, height: 80, fontSize: 12 };
    }
  };

  const sizeConfig = getSizeConfig();

  // 削除確認処理
  const handleRemove = () => {
    if (Platform.OS === 'web') {
      const shouldDelete = window.confirm('この画像を削除しますか？');
      if (shouldDelete) {
        onRemove();
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
            onPress: onRemove
          }
        ]
      );
    }
  };

  // キャプション編集処理
  const handleCaptionEdit = () => {
    if (Platform.OS === 'web') {
      const newCaption = window.prompt('キャプションを入力してください', caption || '');
      if (newCaption !== null) {
        onCaptionChange(newCaption);
      }
    } else {
      // モバイルではAlert.promptは使用できないため、外部コンポーネントに委譲
      onPress(); // 親コンポーネントでモーダルを開く処理を実行
    }
  };

  // アップロード状態の表示
  const getStatusIndicator = () => {
    switch (image.uploadStatus) {
      case 'uploading':
        return (
          <View style={[styles.statusIndicator, { backgroundColor: theme.colors.warning }]}>
            <Text style={styles.statusText}>
              {image.uploadProgress ? `${Math.round(image.uploadProgress)}%` : '...'}
            </Text>
          </View>
        );
      case 'failed':
        return (
          <View style={[styles.statusIndicator, { backgroundColor: theme.colors.error }]}>
            <Text style={styles.statusText}>!</Text>
          </View>
        );
      case 'completed':
        return (
          <View style={[styles.statusIndicator, { backgroundColor: theme.colors.success }]}>
            <Text style={styles.statusText}>✓</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* メイン画像エリア */}
      <TouchableOpacity
        style={[
          styles.imageContainer,
          {
            width: sizeConfig.width,
            height: sizeConfig.height,
            borderColor: theme.colors.border,
          }
        ]}
        onPress={onPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`画像プレビュー ${caption ? `キャプション: ${caption}` : ''}`}
        accessibilityHint="タップして拡大表示"
      >
        <Image
          source={{ uri: image.uri }}
          style={[
            styles.image,
            {
              width: sizeConfig.width,
              height: sizeConfig.height,
            }
          ]}
          resizeMode="cover"
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />

        {/* ローディング表示 */}
        {isLoading && (
          <View style={[
            styles.loadingOverlay,
            {
              width: sizeConfig.width,
              height: sizeConfig.height,
              backgroundColor: theme.colors.surface,
            }
          ]}>
            <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
              読込中...
            </Text>
          </View>
        )}

        {/* アップロード状態インジケーター */}
        {getStatusIndicator() && (
          <View style={styles.statusContainer}>
            {getStatusIndicator()}
          </View>
        )}
      </TouchableOpacity>

      {/* 削除ボタン */}
      {editable && (
        <TouchableOpacity
          style={[
            styles.removeButton,
            { backgroundColor: theme.colors.error }
          ]}
          onPress={handleRemove}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="画像を削除"
          accessibilityHint="この画像を選択から削除します"
        >
          <X size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* キャプション編集ボタン */}
      {editable && size !== 'small' && (
        <TouchableOpacity
          style={[
            styles.captionButton,
            { backgroundColor: theme.colors.primary }
          ]}
          onPress={handleCaptionEdit}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="キャプションを編集"
          accessibilityHint="この画像のキャプションを編集します"
        >
          <Edit3 size={12} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* キャプション表示 */}
      {caption && size !== 'small' && (
        <View style={[styles.captionContainer, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.captionText,
              {
                color: theme.colors.text.primary,
                fontSize: sizeConfig.fontSize,
              }
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {caption}
          </Text>
        </View>
      )}

      {/* 順序表示 */}
      <View style={[styles.orderBadge, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.orderText}>{image.order + 1}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: 4,
  },
  imageContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  image: {
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 10,
    fontWeight: '500',
  },
  statusContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  captionButton: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    opacity: 0.9,
  },
  captionText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  orderBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default ImagePreviewThumbnail;