/**
 * 複数画像アップロードメインコンポーネント
 * 既存のImageUploadButtonを拡張し、最大5枚の画像選択・プレビュー・管理機能を提供
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Camera, Image as ImageIcon, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { 
  MultipleImageUploadProps, 
  ImageAssetWithCaption,
  ImageAsset,
  ImageError,
  ImageErrorType 
} from '../../types/image';
import { ImagePreviewCarousel } from './ImagePreviewCarousel';

// SimpleImageをImageAssetWithCaptionに変換する関数
const convertSimpleImageToImageAssetWithCaption = (
  images: any[], 
  startOrder: number = 0
): ImageAssetWithCaption[] => {
  return images.map((image, index) => ({
    id: image.id,
    uri: image.uri,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize || 0,
    mimeType: image.mimeType || 'image/jpeg',
    fileName: image.fileName,
    caption: '',
    order: startOrder + index,
    uploadStatus: 'pending' as const,
    uploadProgress: 0,
  }));
};

export const MultipleImageUploadComponent: React.FC<MultipleImageUploadProps> = ({
  onImagesSelected,
  onImageRemoved,
  selectedImages = [],
  maxImages = 5,
  disabled = false,
  showPreview = true
}) => {
  const { theme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<ImageError[]>([]);

  const canAddMore = selectedImages.length < maxImages;

  // エラー処理関数
  const handleError = useCallback((error: ImageError) => {
    setErrors(prev => [...prev, error]);
    
    if (Platform.OS === 'web') {
      alert(error.userMessage);
    } else {
      Alert.alert('エラー', error.userMessage, [{ text: 'OK' }]);
    }
    
    // 3秒後にエラーを自動削除
    setTimeout(() => {
      setErrors(prev => prev.filter(e => e !== error));
    }, 3000);
  }, []);

  // 画像選択処理
  const handleImageSelection = async () => {
    try {
      setIsUploading(true);
      console.log('🖼️ 複数画像選択処理開始');

      // 権限チェック
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const error: ImageError = {
          type: ImageErrorType.PERMISSION_DENIED,
          message: 'Media library permission denied',
          recoverable: true,
          userMessage: 'フォトライブラリへのアクセス権限が必要です',
          retryAction: handleImageSelection
        };
        handleError(error);
        return;
      }

      // 選択可能な残り枚数を計算
      const remainingSlots = maxImages - selectedImages.length;
      if (remainingSlots <= 0) {
        const error: ImageError = {
          type: ImageErrorType.FILE_TOO_LARGE,
          message: 'Maximum images exceeded',
          recoverable: false,
          userMessage: `最大${maxImages}枚まで選択できます`
        };
        handleError(error);
        return;
      }

      // 画像を選択
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
        selectionLimit: remainingSlots, // 残り枚数分のみ選択可能
      });

      if (!result.canceled && result.assets) {
        // ファイルサイズチェック（10MB制限）
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const validAssets = result.assets.filter(asset => {
          if (asset.fileSize && asset.fileSize > maxFileSize) {
            const error: ImageError = {
              type: ImageErrorType.FILE_TOO_LARGE,
              message: `File too large: ${asset.fileName}`,
              recoverable: false,
              userMessage: `${asset.fileName || 'ファイル'}のサイズが大きすぎます（最大10MB）`
            };
            handleError(error);
            return false;
          }
          return true;
        });

        if (validAssets.length === 0) return;

        // SimpleImage形式からImageAssetWithCaption形式に変換
        const newImages = convertSimpleImageToImageAssetWithCaption(
          validAssets.map((asset, index) => ({
            id: `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            fileSize: asset.fileSize || 0,
            mimeType: asset.mimeType || 'image/jpeg',
            fileName: asset.fileName
          })),
          selectedImages.length
        );

        console.log('✅ 複数画像選択完了:', {
          count: newImages.length,
          images: newImages.map(img => ({
            id: img.id,
            uri: img.uri,
            order: img.order,
            fileName: img.fileName
          }))
        });
        onImagesSelected(newImages);
      }

    } catch (error) {
      console.error('❌ 複数画像選択エラー:', error);
      const imageError: ImageError = {
        type: ImageErrorType.PROCESSING_FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
        userMessage: '画像の選択に失敗しました。もう一度お試しください。',
        retryAction: handleImageSelection
      };
      handleError(imageError);
    } finally {
      setIsUploading(false);
    }
  };

  // 画像削除処理
  const handleImageRemove = useCallback((imageId: string) => {
    console.log('🗑️ 画像削除要求:', imageId);
    onImageRemoved(imageId);
  }, [onImageRemoved]);

  // 画像並び替え処理
  const handleImageReorder = useCallback((fromIndex: number, toIndex: number) => {
    console.log('🔄 画像並び替え:', fromIndex, '->', toIndex);
    
    const reorderedImages = [...selectedImages];
    const [movedImage] = reorderedImages.splice(fromIndex, 1);
    reorderedImages.splice(toIndex, 0, movedImage);
    
    // 並び替え後にorder値を再設定
    const updatedImages = reorderedImages.map((img, index) => ({
      ...img,
      order: index
    }));
    
    onImagesSelected(updatedImages);
  }, [selectedImages, onImagesSelected]);

  // キャプション変更処理
  const handleCaptionChange = useCallback((imageId: string, caption: string) => {
    console.log('✏️ キャプション変更:', imageId, caption);
    
    const updatedImages = selectedImages.map(img => 
      img.id === imageId ? { ...img, caption } : img
    );
    
    onImagesSelected(updatedImages);
  }, [selectedImages, onImagesSelected]);

  // アクセシビリティプロパティを生成
  const buttonAccessibilityProps = {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel: canAddMore ? '画像を選択' : '画像上限に達しました',
    accessibilityHint: canAddMore ? '複数の画像を選択して投稿に追加' : undefined
  };

  return (
    <View style={styles.container}>
      {/* 画像選択ボタン */}
      <TouchableOpacity
        style={[
          styles.uploadButton,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            opacity: disabled || !canAddMore ? 0.5 : 1
          }
        ]}
        onPress={handleImageSelection}
        disabled={disabled || !canAddMore || isUploading}
        {...buttonAccessibilityProps}
      >
        {isUploading ? (
          <View style={styles.uploadingState}>
            <Text style={[styles.uploadingText, { color: theme.colors.text.secondary }]}>
              処理中...
            </Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <View style={styles.iconContainer}>
              <Camera size={24} color={theme.colors.primary} />
              <ImageIcon size={18} color={theme.colors.text.secondary} style={styles.overlayIcon} />
            </View>
            <Text style={[styles.buttonText, { color: theme.colors.text.primary }]}>
              {selectedImages.length === 0 
                ? '画像を選択（最大5枚）' 
                : canAddMore 
                  ? '画像を追加' 
                  : '上限達成'
              }
            </Text>
            <Text style={[styles.countText, { color: theme.colors.text.secondary }]}>
              {selectedImages.length}/{maxImages}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* エラー表示 */}
      {errors.length > 0 && (
        <View style={styles.errorContainer}>
          {errors.map((error, index) => (
            <View key={index} style={[styles.errorItem, { backgroundColor: theme.colors.errorBackground }]}>
              <AlertCircle size={16} color={theme.colors.error} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error.userMessage}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 選択済み画像のプレビュー */}
      {showPreview && selectedImages.length > 0 && (
        <View style={styles.previewContainer}>
          <ImagePreviewCarousel
            images={selectedImages}
            onImageRemove={handleImageRemove}
            onImageReorder={handleImageReorder}
            onCaptionChange={handleCaptionChange}
            editable={!disabled}
          />
        </View>
      )}

      {/* ヘルプテキスト */}
      {selectedImages.length === 0 && (
        <View style={styles.helpContainer}>
          <Text style={[styles.helpText, { color: theme.colors.text.secondary }]}>
            • 最大5枚の画像を選択できます{'\n'}
            • 各画像にキャプションを追加できます{'\n'}
            • 長押しで画像の順序を変更できます
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100
  },
  buttonContent: {
    alignItems: 'center',
    gap: 8
  },
  iconContainer: {
    position: 'relative'
  },
  overlayIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  countText: {
    fontSize: 14,
    fontWeight: '500'
  },
  uploadingState: {
    alignItems: 'center'
  },
  uploadingText: {
    fontSize: 16,
    fontWeight: '500'
  },
  errorContainer: {
    marginTop: 12,
    gap: 8
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1
  },
  previewContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden'
  },
  helpContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.05)'
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  }
});

export default MultipleImageUploadComponent;