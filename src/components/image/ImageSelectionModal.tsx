/**
 * 画像選択モーダルコンポーネント
 * カメラ・ギャラリー選択、片手操作対応、アクセシビリティ対応
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Dimensions
} from 'react-native';
import { Camera, Image, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { ImageAsset, ImageSelectionOptions } from '../../types/image';
import { ImageUploadManager } from '../../services/image/ImageUploadManager';

interface ImageSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onImagesSelected: (images: ImageAsset[]) => void;
  options?: ImageSelectionOptions;
  maxImages?: number;
  darkMode?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({
  visible,
  onClose,
  onImagesSelected,
  options = {},
  maxImages = 1,
  darkMode = false
}) => {
  const { theme } = useTheme();
  const { handPreference } = useHandPreference();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadManager] = useState(() => new ImageUploadManager());

  const handleCameraSelect = async () => {
    try {
      setIsLoading(true);
      console.log('📸 カメラ選択開始');
      
      const images = await uploadManager.selectImage('camera', {
        ...options,
        allowsMultipleSelection: false // カメラは常に単一選択
      });
      
      if (images.length > 0) {
        console.log('✅ カメラ画像選択完了:', images.length);
        onImagesSelected(images);
        onClose();
      }
    } catch (error) {
      console.error('❌ カメラ選択エラー:', error);
      Alert.alert(
        'カメラエラー',
        error instanceof Error ? error.message : 'カメラの起動に失敗しました',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGallerySelect = async () => {
    try {
      setIsLoading(true);
      console.log('🖼️ ギャラリー選択開始');
      
      const images = await uploadManager.selectImage('gallery', {
        ...options,
        allowsMultipleSelection: maxImages > 1
      });
      
      if (images.length > 0) {
        // 最大枚数チェック
        const selectedImages = images.slice(0, maxImages);
        console.log('✅ ギャラリー画像選択完了:', selectedImages.length);
        onImagesSelected(selectedImages);
        onClose();
      }
    } catch (error) {
      console.error('❌ ギャラリー選択エラー:', error);
      Alert.alert(
        'ギャラリーエラー',
        error instanceof Error ? error.message : 'ギャラリーのアクセスに失敗しました',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  // 片手操作に応じたレイアウト調整
  const getModalStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      maxHeight: screenHeight * 0.6
    };

    // 片手操作の場合、手の反対側にボタンを配置
    if (handPreference === 'left') {
      return {
        ...baseStyle,
        paddingLeft: 20,
        paddingRight: 60 // 右側に余裕を持たせる
      };
    } else {
      return {
        ...baseStyle,
        paddingLeft: 60, // 左側に余裕を持たせる
        paddingRight: 20
      };
    }
  };

  const getCloseButtonStyle = () => {
    // 利き手の反対側に配置
    if (handPreference === 'left') {
      return { position: 'absolute' as const, top: 15, right: 20 };
    } else {
      return { position: 'absolute' as const, top: 15, left: 20 };
    }
  };

  const getButtonContainerStyle = () => {
    // 片手操作しやすい位置に配置
    const baseStyle = {
      paddingHorizontal: 20,
      gap: 16
    };

    if (handPreference === 'left') {
      return {
        ...baseStyle,
        alignItems: 'flex-start' as const
      };
    } else {
      return {
        ...baseStyle,
        alignItems: 'flex-end' as const
      };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          onPress={handleClose}
          accessible={false}
        />
        
        <View style={[styles.modal, getModalStyle()]}>
          {/* 閉じるボタン */}
          <TouchableOpacity
            style={[styles.closeButton, getCloseButtonStyle()]}
            onPress={handleClose}
            disabled={isLoading}
            accessible={true}
            accessibilityLabel="モーダルを閉じる"
            accessibilityRole="button"
          >
            <X size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          {/* ヘッダー */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              画像を選択
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
              {maxImages > 1 ? `最大${maxImages}枚まで選択できます` : '画像を1枚選択してください'}
            </Text>
          </View>

          {/* 選択ボタン */}
          <View style={[styles.buttonContainer, getButtonContainerStyle()]}>
            {/* カメラボタン */}
            <TouchableOpacity
              style={[
                styles.selectionButton,
                styles.cameraButton,
                { backgroundColor: theme.colors.primary },
                isLoading && styles.disabledButton
              ]}
              onPress={handleCameraSelect}
              disabled={isLoading}
              accessible={true}
              accessibilityLabel="カメラで撮影"
              accessibilityHint="新しい写真を撮影します"
              accessibilityRole="button"
            >
              <Camera size={32} color="#FFFFFF" />
              <Text style={styles.buttonText}>カメラで撮影</Text>
            </TouchableOpacity>

            {/* ギャラリーボタン */}
            <TouchableOpacity
              style={[
                styles.selectionButton,
                styles.galleryButton,
                { 
                  backgroundColor: darkMode ? theme.colors.surface : theme.colors.card,
                  borderColor: darkMode ? theme.colors.primary : theme.colors.border,
                  borderWidth: 2
                },
                isLoading && styles.disabledButton
              ]}
              onPress={handleGallerySelect}
              disabled={isLoading}
              accessible={true}
              accessibilityLabel="ギャラリーから選択"
              accessibilityHint={maxImages > 1 ? "複数の画像を選択できます" : "ギャラリーから画像を選択します"}
              accessibilityRole="button"
            >
              <Image size={32} color={darkMode ? theme.colors.primary : theme.colors.text.primary} />
              <Text style={[styles.buttonText, { color: darkMode ? theme.colors.primary : theme.colors.text.primary }]}>
                ギャラリーから選択
              </Text>
            </TouchableOpacity>
          </View>

          {/* ローディング表示 */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
                処理中...
              </Text>
            </View>
          )}

          {/* 権限説明 */}
          <View style={styles.permissionInfo}>
            <Text style={[styles.permissionText, { color: theme.colors.text.secondary }]}>
              ※ 初回利用時にカメラとフォトライブラリへのアクセス許可が必要です
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  overlayTouchable: {
    flex: 1
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  header: {
    marginBottom: 30,
    alignItems: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center'
  },
  buttonContainer: {
    marginBottom: 20
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 200,
    minHeight: 56, // アクセシビリティ推奨サイズ
    gap: 12
  },
  cameraButton: {
    marginBottom: 12
  },
  galleryButton: {
    // スタイルは動的に適用
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  disabledButton: {
    opacity: 0.6
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 10
  },
  loadingText: {
    fontSize: 14
  },
  permissionInfo: {
    marginTop: 10,
    paddingHorizontal: 20
  },
  permissionText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16
  }
});

export default ImageSelectionModal;