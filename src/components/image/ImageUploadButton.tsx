/**
 * 画像アップロードボタンコンポーネント
 * 投稿画面で使用する画像選択・アップロード機能
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
// import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { ImageSelectionModal } from './ImageSelectionModal';
import { ImageEditor } from './ImageEditor';
import { LazyImage } from './LazyImage';
import { ImageUploadManager } from '../../services/image/ImageUploadManager';
import { AccessibilityService } from '../../services/image/AccessibilityService';
import { InternationalizationService } from '../../services/image/InternationalizationService';
import { ImageAsset, ProcessedImage } from '../../types/image';

interface ImageUploadButtonProps {
  onImageSelected?: (images: ProcessedImage[]) => void;
  onImageRemoved?: (imageId: string) => void;
  maxImages?: number;
  selectedImages?: ProcessedImage[];
  disabled?: boolean;
  showPreview?: boolean;
}

export const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
  onImageSelected,
  onImageRemoved,
  maxImages = 4,
  selectedImages = [],
  disabled = false,
  showPreview = true
}) => {
  const { theme } = useTheme();
  // const { handPreference } = useHandPreference();
  const handPreference = 'right'; // デフォルト値
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // const accessibilityService = AccessibilityService.getInstance();
  // const i18nService = InternationalizationService.getInstance();
  const uploadManager = new ImageUploadManager();

  const canAddMore = selectedImages.length < maxImages;
  // const t = i18nService.getText();
  const t = {
    selectImage: '画像を選択',
    imageAlt: '画像'
  };

  // 画像選択処理
  const handleImageSelection = async (images: ImageAsset[]) => {
    try {
      setIsUploading(true);

      const processedImages: ProcessedImage[] = [];

      for (const image of images) {
        // 最初の画像のみエディターを表示（必要に応じて）
        if (images.length === 1) {
          setEditingImage(image);
          setShowImageEditor(true);
          setIsUploading(false);
          return;
        }

        // 複数画像の場合は自動処理
        const result = await uploadManager.processImage(image, {
          stripMetadata: true,
          generateThumbnail: true,
          compressionQuality: 0.8
        });

        const processedImage: ProcessedImage = {
          ...result,
          compressed: true,
          compressionRatio: 0.8,
          altText: `画像 ${processedImages.length + 1}`,
          processedAt: new Date()
        };
        
        processedImages.push(processedImage);
      }

      if (processedImages.length > 0) {
        onImageSelected?.(processedImages);
      }

    } catch (error) {
      console.error('❌ 画像選択エラー:', error);
      Alert.alert(
        'エラー',
        '画像の選択に失敗しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploading(false);
    }
  };

  // 画像編集完了処理
  const handleImageEditComplete = (editedImage: ProcessedImage) => {
    setShowImageEditor(false);
    setEditingImage(null);
    onImageSelected?.([editedImage]);
    setIsUploading(false);
  };

  // 画像編集キャンセル処理
  const handleImageEditCancel = () => {
    setShowImageEditor(false);
    setEditingImage(null);
    setIsUploading(false);
  };

  // 画像削除処理
  const handleImageRemove = (imageId: string) => {
    Alert.alert(
      '画像を削除',
      '選択した画像を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => onImageRemoved?.(imageId)
        }
      ]
    );
  };

  // アクセシビリティプロパティを生成
  const buttonAccessibilityProps = {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel: canAddMore ? t.selectImage : '画像上限に達しました',
    accessibilityHint: canAddMore ? '画像を選択して投稿に追加' : undefined
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
          },
          // handPreference === 'left' && styles.uploadButtonLeft
        ]}
        onPress={() => setShowSelectionModal(true)}
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
              <Camera size={20} color={theme.colors.primary} />
              <ImageIcon size={16} color={theme.colors.text.secondary} style={styles.overlayIcon} />
            </View>
            <Text style={[styles.buttonText, { color: theme.colors.text.primary }]}>
              {canAddMore ? t.selectImage : '上限達成'}
            </Text>
            <Text style={[styles.countText, { color: theme.colors.text.secondary }]}>
              {selectedImages.length}/{maxImages}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 選択済み画像のプレビュー */}
      {showPreview && selectedImages.length > 0 && (
        <View style={styles.previewContainer}>
          <Text style={[styles.previewTitle, { color: theme.colors.text.primary }]}>
            選択済み画像 ({selectedImages.length})
          </Text>
          <View style={styles.imageGrid}>
            {selectedImages.map((image, index) => (
              <View key={`${image.id}_${index}`} style={styles.imagePreview}>
                <LazyImage
                  uri={image.uri}
                  width={80}
                  height={80}
                  style={styles.previewImage}
                  resizeMode="cover"
                  borderRadius={8}
                  accessibilityLabel={image.altText || `画像 ${index + 1}`}
                  priority="normal"
                />
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
                  onPress={() => handleImageRemove(image.id)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="画像を削除"
                  accessibilityHint={`${image.altText || '画像'}を削除します`}
                >
                  <X size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 画像選択モーダル */}
      <ImageSelectionModal
        visible={showSelectionModal}
        onClose={() => setShowSelectionModal(false)}
        onImagesSelected={handleImageSelection}
        maxImages={maxImages - selectedImages.length}
        darkMode={theme.colors.background === '#121212'}
      />

      {/* 画像編集モーダル */}
      <ImageEditor
        visible={showImageEditor}
        image={editingImage}
        onSave={handleImageEditComplete}
        onCancel={handleImageEditCancel}
        darkMode={theme.colors.background === '#121212'}
      />
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
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80
  },
  uploadButtonLeft: {
    alignSelf: 'flex-start',
    minWidth: 120
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
    bottom: -2,
    right: -2
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  countText: {
    fontSize: 12,
    fontWeight: '500'
  },
  uploadingState: {
    alignItems: 'center'
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '500'
  },
  previewContainer: {
    marginTop: 12
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  imagePreview: {
    position: 'relative'
  },
  previewImage: {
    borderRadius: 8
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
  }
});

export default ImageUploadButton;