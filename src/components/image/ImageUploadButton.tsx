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
  ScrollView,
  Image
} from 'react-native';
import { Camera, Image as ImageIcon, X, Plus } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import * as ImagePicker from 'expo-image-picker';

// シンプルな型定義
interface SimpleImage {
  id: string;
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string;
}

interface ImageUploadButtonProps {
  onImageSelected?: (images: SimpleImage[]) => void;
  onImageRemoved?: (imageId: string) => void;
  maxImages?: number;
  selectedImages?: SimpleImage[];
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
  const [isUploading, setIsUploading] = useState(false);

  const canAddMore = selectedImages.length < maxImages;

  // 画像選択処理
  const handleImageSelection = async () => {
    try {
      setIsUploading(true);
      console.log('🖼️ 画像選択処理開始');

      // 権限チェック
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'フォトライブラリへのアクセス権限が必要です');
        return;
      }

      // 画像を選択
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: maxImages > selectedImages.length,
        quality: 0.8,
        allowsEditing: false
      });

      if (!result.canceled && result.assets) {
        const newImages: SimpleImage[] = result.assets.map((asset, index) => ({
          id: `img_${Date.now()}_${index}`,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize || 0,
          mimeType: asset.mimeType || 'image/jpeg'
        }));

        console.log('✅ 画像選択完了:', newImages.length);
        onImageSelected?.(newImages);
      }

    } catch (error) {
      console.error('❌ 画像選択エラー:', error);
      const errorMessage = '画像の選択に失敗しました。もう一度お試しください。';
      
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('エラー', errorMessage, [{ text: 'OK' }]);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // カメラ撮影処理
  const handleCameraCapture = async () => {
    try {
      setIsUploading(true);
      console.log('📸 カメラ撮影開始');

      // 権限チェック
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'カメラへのアクセス権限が必要です');
        return;
      }

      // カメラで撮影
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false
      });

      if (!result.canceled && result.assets) {
        const newImage: SimpleImage = {
          id: `img_${Date.now()}`,
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
          fileSize: result.assets[0].fileSize || 0,
          mimeType: result.assets[0].mimeType || 'image/jpeg'
        };

        console.log('✅ カメラ撮影完了');
        onImageSelected?.([newImage]);
      }

    } catch (error) {
      console.error('❌ カメラ撮影エラー:', error);
      const errorMessage = 'カメラでの撮影に失敗しました。もう一度お試しください。';
      
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('エラー', errorMessage, [{ text: 'OK' }]);
      }
    } finally {
      setIsUploading(false);
    }
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
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.previewImage, { width: 100, height: 100, borderRadius: 12 }]}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
                  onPress={() => handleImageRemove(image.id)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="画像を削除"
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
                onPress={handleImageSelection}
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

      {/* シンプル化により、モーダルは不要 */}
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