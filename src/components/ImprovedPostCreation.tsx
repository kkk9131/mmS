import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Send, Image, AlertCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { UserFriendlyError } from './UserFriendlyError';
import { reliableDataFetcher } from '../utils/reliableDataFetcher';

interface ImprovedPostCreationProps {
  onPostCreated?: (post: any) => void;
  onCancel?: () => void;
}

export const ImprovedPostCreation: React.FC<ImprovedPostCreationProps> = ({
  onPostCreated,
  onCancel
}) => {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageAttachments, setImageAttachments] = useState<string[]>([]);

  const validateContent = (text: string): string | null => {
    if (!text.trim()) {
      return '投稿内容を入力してください';
    }
    if (text.trim().length < 10) {
      return '投稿内容は10文字以上で入力してください';
    }
    if (text.length > 1000) {
      return '投稿内容は1000文字以内で入力してください';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateContent(content);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 信頼性の高いデータ送信を使用
      const result = await reliableDataFetcher.fetchWithRetry(async () => {
        // 実際のアプリでは PostsService を使用
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            isAnonymous,
            imageAttachments
          })
        });

        if (!response.ok) {
          throw new Error(`投稿作成に失敗しました (${response.status})`);
        }

        return response.json();
      }, {
        maxRetries: 2,
        initialDelay: 1000
      });

      // 成功時の処理
      setContent('');
      setImageAttachments([]);
      onPostCreated?.(result);
      
      Alert.alert(
        '投稿完了',
        '投稿が正常に作成されました！',
        [{ text: 'OK', style: 'default' }]
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '投稿作成中にエラーが発生しました';
      setError(errorMessage);
      console.error('投稿作成エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageAttachment = () => {
    // 画像添付機能（将来実装）
    Alert.alert(
      '画像添付',
      '画像添付機能は近日中に実装予定です',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const getCharacterCount = () => content.length;
  const getCharacterCountColor = () => {
    const count = getCharacterCount();
    if (count > 900) return colors.semantic.error;
    if (count > 800) return colors.semantic.warning;
    return colors.text.secondary;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>新しい投稿</Text>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <UserFriendlyError
          message={error}
          type="error"
          onRetry={() => setError(null)}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="何を共有しますか？"
          placeholderTextColor={colors.text.secondary}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          maxLength={1000}
          editable={!isLoading}
        />
        
        <View style={styles.inputFooter}>
          <Text style={[styles.characterCount, { color: getCharacterCountColor() }]}>
            {getCharacterCount()}/1000
          </Text>
        </View>
      </View>

      <View style={styles.options}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => setIsAnonymous(!isAnonymous)}
          disabled={isLoading}
        >
          <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
            {isAnonymous && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.optionText}>匿名で投稿</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.attachmentButton}
          onPress={handleImageAttachment}
          disabled={isLoading}
        >
          <Image size={20} color={colors.primary.main} />
          <Text style={styles.attachmentText}>画像を添付</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading || !content.trim() || !!validateContent(content)}
      >
        <Send size={18} color={colors.neutral.white} />
        <Text style={styles.submitText}>
          {isLoading ? '投稿中...' : '投稿する'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.neutral.background,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  characterCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  options: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.neutral.gray400,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  checkmark: {
    color: colors.neutral.white,
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },
  optionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primary.light,
  },
  attachmentText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
    marginLeft: 4,
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral.gray400,
  },
  submitText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.white,
    marginLeft: 8,
  },
});