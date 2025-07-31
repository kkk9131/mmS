/**
 * 画像キャプション入力モーダルコンポーネント
 * 画像とともにキャプションを編集する機能を提供
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Save } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ImageCaptionInputProps } from '../../types/image';

export const ImageCaptionInput: React.FC<ImageCaptionInputProps> = ({
  visible,
  image,
  initialCaption = '',
  onSave,
  onCancel,
  maxLength = 100
}) => {
  const { theme } = useTheme();
  const [caption, setCaption] = useState(initialCaption);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルが開かれた時にキャプションを初期化
  useEffect(() => {
    if (visible) {
      setCaption(initialCaption);
    }
  }, [visible, initialCaption]);

  // キャプション保存処理
  const handleSave = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave(caption.trim());
    } catch (error) {
      console.error('キャプション保存エラー:', error);
      if (Platform.OS === 'web') {
        alert('キャプションの保存に失敗しました。もう一度お試しください。');
      } else {
        Alert.alert('エラー', 'キャプションの保存に失敗しました。もう一度お試しください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    if (isSubmitting) return;
    
    if (caption.trim() !== initialCaption) {
      if (Platform.OS === 'web') {
        const shouldDiscard = window.confirm('変更を破棄してよろしいですか？');
        if (!shouldDiscard) return;
      } else {
        Alert.alert(
          '変更を破棄',
          '編集中の内容が失われますが、よろしいですか？',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '破棄', style: 'destructive', onPress: onCancel }
          ]
        );
        return;
      }
    }
    onCancel();
  };

  // 文字数カウント表示の色
  const getCounterColor = () => {
    const length = caption.length;
    if (length > maxLength) {
      return theme.colors.error;
    } else if (length > maxLength * 0.8) {
      return theme.colors.warning;
    }
    return theme.colors.text.secondary;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ヘッダー */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCancel}
            disabled={isSubmitting}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="キャンセル"
          >
            <X size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            キャプションを編集
          </Text>
          
          <TouchableOpacity
            style={[
              styles.headerButton,
              { opacity: isSubmitting ? 0.5 : 1 }
            ]}
            onPress={handleSave}
            disabled={isSubmitting || caption.length > maxLength}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="保存"
          >
            <Save size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 画像プレビュー */}
          <View style={styles.imagePreviewSection}>
            <Image
              source={{ uri: image.uri }}
              style={[styles.imagePreview, { borderColor: theme.colors.border }]}
              resizeMode="cover"
            />
            <View style={styles.imageInfo}>
              <Text style={[styles.imageInfoText, { color: theme.colors.text.secondary }]}>
                {image.width} × {image.height}
              </Text>
              {image.fileSize && (
                <Text style={[styles.imageInfoText, { color: theme.colors.text.secondary }]}>
                  {(image.fileSize / (1024 * 1024)).toFixed(2)} MB
                </Text>
              )}
            </View>
          </View>

          {/* キャプション入力エリア */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: theme.colors.text.primary }]}>
              キャプション
            </Text>
            
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: caption.length > maxLength ? theme.colors.error : theme.colors.border,
                  color: theme.colors.text.primary,
                }
              ]}
              value={caption}
              onChangeText={setCaption}
              placeholder="画像の説明を入力してください（任意）"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              textAlignVertical="top"
              maxLength={maxLength + 20} // バッファを含めて入力可能
              editable={!isSubmitting}
              accessible={true}
              accessibilityLabel="キャプション入力"
              accessibilityHint={`最大${maxLength}文字まで入力できます`}
            />
            
            {/* 文字数カウンター */}
            <View style={styles.counterContainer}>
              <Text style={[styles.counterText, { color: getCounterColor() }]}>
                {caption.length} / {maxLength}
              </Text>
              {caption.length > maxLength && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  文字数が上限を超えています
                </Text>
              )}
            </View>
          </View>

          {/* ヒント */}
          <View style={styles.hintSection}>
            <Text style={[styles.hintTitle, { color: theme.colors.text.primary }]}>
              💡 キャプションのヒント
            </Text>
            <Text style={[styles.hintText, { color: theme.colors.text.secondary }]}>
              • 画像の内容を簡潔に説明しましょう{'\n'}
              • 子どもの成長や感想を記録できます{'\n'}
              • スクリーンリーダーでも読み上げられます
            </Text>
          </View>
        </ScrollView>

        {/* フッター（保存ボタン） */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: (isSubmitting || caption.length > maxLength) 
                  ? theme.colors.disabled 
                  : theme.colors.primary,
              }
            ]}
            onPress={handleSave}
            disabled={isSubmitting || caption.length > maxLength}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="キャプションを保存"
            accessibilityState={{ disabled: isSubmitting || caption.length > maxLength }}
          >
            <Text style={styles.saveButtonText}>
              {isSubmitting ? '保存中...' : 'キャプションを保存'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        paddingTop: 48, // Safe area対応
      },
    }),
  },
  headerButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  imagePreviewSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
  },
  imageInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  imageInfoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  counterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
  },
  hintSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        paddingBottom: 32, // Safe area対応
      },
    }),
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageCaptionInput;