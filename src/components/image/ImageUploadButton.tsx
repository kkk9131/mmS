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
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import { Camera, Image as ImageIcon, X, Plus } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { ImageSelectionModal } from './ImageSelectionModal';
import { ImageEditor } from './ImageEditor';
import { LazyImage } from './LazyImage';
import { ImageUploadManager } from '../../services/image/ImageUploadManager';
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
  const { handPreference } = useHandPreference();
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadManager = new ImageUploadManager();
  const canAddMore = selectedImages.length < maxImages;

  // 画像選択処理
  const handleImageSelection = async (images: ImageAsset[]) => {
    try {
      setIsUploading(true);
      console.log('🖼️ 画像選択処理開始:', images.length);

      const processedImages: ProcessedImage[] = [];

      for (const image of images) {
        console.log('⚙️ 画像処理中:', image.id);
        
        // 画像を自動処理
        const processedImage: ProcessedImage = {
          ...image,
          compressed: true,
          compressionRatio: 0.2, // 仮の値
          altText: `画像 ${processedImages.length + 1}`,
          processedAt: new Date()
        };
        
        processedImages.push(processedImage);
      }

      if (processedImages.length > 0) {
        console.log('✅ 画像処理完了、コールバック実行:', processedImages.length);
        onImageSelected?.(processedImages);
      }

    } catch (error) {
      console.error('❌ 画像選択エラー:', error);
      const errorMessage = Platform.OS === 'web' 
        ? '画像の選択に失敗しました。もう一度お試しください。'
        : '画像の選択に失敗しました。もう一度お試しください。';
      
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('エラー', errorMessage, [{ text: 'OK' }]);
      }
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
    console.log('🗑️ 画像削除要求:', imageId);
    
    if (Platform.OS === 'web') {
      const shouldDelete = window.confirm('選択した画像を削除しますか？');
      if (shouldDelete) {
        onImageRemoved?.(imageId);
      }
    } else {
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
    }
  };

  // アクセシビリティプロパティを生成
  const buttonAccessibilityProps = {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel: canAddMore ? '画像を選択' : '画像上限に達しました',
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
              {canAddMore ? '画像を選択' : '上限達成'}
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
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: theme.colors.text.primary }]}>
              選択した画像
            </Text>
            <Text style={[styles.previewCount, { color: theme.colors.text.secondary }]}>
              {selectedImages.length}/{maxImages}
            </Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.imageScrollView}
            contentContainerStyle={styles.imageScrollContent}
          >
            {selectedImages.map((image, index) => (
              <View key={`${image.id}_${index}`} style={styles.imagePreviewCard}>
                <LazyImage
                  uri={image.uri}
                  width={100}
                  height={100}
                  style={styles.previewImage}
                  resizeMode="cover"
                  borderRadius={12}
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
                  <X size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            
            {/* 追加ボタン（最大枚数未満の場合） */}
            {canAddMore && (
              <TouchableOpacity
                style={[styles.addMoreButton, { 
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.card 
                }]}
                onPress={() => setShowSelectionModal(true)}
                disabled={disabled || isUploading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="画像を追加"
                accessibilityHint="さらに画像を選択します"
              >
                <Plus size={24} color={theme.colors.primary} />
                <Text style={[styles.addMoreText, { color: theme.colors.primary }]}>
                  追加
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
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
    marginTop: 16
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  previewCount: {
    fontSize: 14,
    fontWeight: '500'
  },
  imageScrollView: {
    flexGrow: 0
  },
  imageScrollContent: {
    paddingRight: 16
  },
  imagePreviewCard: {
    position: 'relative',
    marginRight: 12
  },
  previewImage: {
    borderRadius: 12
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  addMoreButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: '600'
  }
});

export default ImageUploadButton;