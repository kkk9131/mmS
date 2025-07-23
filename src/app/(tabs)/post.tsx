import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, ScrollView, Keyboard, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { Send, Heart, Bot } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PostsService } from '../../services/PostsService';
import { useTheme } from '../../contexts/ThemeContext';

export default function PostScreen() {
  const { theme } = useTheme();
  const [postText, setPostText] = useState('');
  const [aiEmpathyEnabled, setAiEmpathyEnabled] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  const maxCharacters = 600;
  const characterCount = postText.length;
  const isOverLimit = characterCount > maxCharacters;
  const postsService = PostsService.getInstance();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handlePost = async () => {
    if (postText.trim().length === 0) {
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }
    
    if (isOverLimit) {
      Alert.alert('エラー', `文字数が上限を超えています (${characterCount}/${maxCharacters})`);
      return;
    }

    const empathyMessage = aiEmpathyEnabled ? '\n\n※ ママの味方からの共感メッセージが届きます' : '';
    
    Alert.alert(
      '投稿確認',
      `投稿しますか？${empathyMessage}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '投稿する', 
          onPress: async () => {
            setIsPosting(true);
            try {
              await postsService.createPost({
                content: postText.trim()
              });
              
              Alert.alert('投稿完了', '投稿が正常に送信されました', [
                { 
                  text: 'OK', 
                  onPress: () => {
                    setPostText('');
                    router.back();
                  }
                }
              ]);
            } catch (error) {
              Alert.alert('エラー', '投稿の送信に失敗しました。もう一度お試しください。');
            } finally {
              setIsPosting(false);
            }
          }
        }
      ]
    );
  };

  // Dynamic styles with theme colors
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginTop: 4,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text.primary,
      minHeight: 200,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    textInputError: {
      borderColor: theme.colors.error,
    },
    charCount: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    charCountError: {
      color: theme.colors.error,
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
      marginLeft: 12,
      flex: 1,
    },
    optionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginLeft: 8,
      flex: 1,
    },
    optionDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
      marginLeft: 28,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    postButton: {
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 8,
      minHeight: 48,
    },
    postButtonDisabled: {
      backgroundColor: theme.colors.text.secondary,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>新規ポスト</Text>
        <Text style={dynamicStyles.headerSubtitle}>今の気持ちを共有しませんか？</Text>
      </View>

      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
        <TextInput
          style={[dynamicStyles.textInput, isOverLimit && dynamicStyles.textInputError]}
          placeholder="今日はどんな一日でしたか？ママたちと共有しませんか..."
          placeholderTextColor={theme.colors.text.secondary}
          multiline
          value={postText}
          onChangeText={setPostText}
          maxLength={maxCharacters}
          returnKeyType="done"
          onSubmitEditing={dismissKeyboard}
        />
        
        <View style={styles.inputFooter}>
          <Text style={[
            dynamicStyles.charCount,
            isOverLimit && dynamicStyles.charCountError
          ]}>
            {characterCount}/{maxCharacters}
          </Text>
        </View>

        <View style={dynamicStyles.optionCard}>
          <View style={styles.optionHeader}>
            <Bot size={20} color={theme.colors.primary} />
            <Text style={dynamicStyles.optionTitle}>ママの味方</Text>
            <Switch
              value={aiEmpathyEnabled}
              onValueChange={setAiEmpathyEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={aiEmpathyEnabled ? '#fff' : theme.colors.text.secondary}
            />
          </View>
          <Text style={dynamicStyles.optionDescription}>
            {aiEmpathyEnabled 
              ? 'ポスト後に温かい共感メッセージが届きます' 
              : '今回は共感メッセージを受け取りません'}
          </Text>
        </View>

        <View style={dynamicStyles.infoCard}>
          <Heart size={20} color={theme.colors.primary} />
          <Text style={dynamicStyles.infoText}>
            あなたの気持ちや体験を自由に共有してください。ママたちがあなたの投稿に共感してくれます。
          </Text>
          </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={dynamicStyles.footer}>
        <TouchableOpacity
          style={[
            dynamicStyles.postButton, 
            (isOverLimit || isPosting) && dynamicStyles.postButtonDisabled
          ]}
          onPress={handlePost}
          disabled={isOverLimit || isPosting}
        >
          {isPosting ? (
            <>
              <ActivityIndicator size={20} color="#fff" />
              <Text style={styles.postButtonText}>投稿中...</Text>
            </>
          ) : (
            <>
              <Send size={20} color="#fff" />
              <Text style={styles.postButtonText}>投稿する</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputFooter: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});