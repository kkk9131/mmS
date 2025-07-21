import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, ScrollView, Keyboard, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { Send, Heart, Bot } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PostsService } from '../../services/PostsService';

export default function PostScreen() {
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新規ポスト</Text>
        <Text style={styles.headerSubtitle}>今の気持ちを共有しませんか？</Text>
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
          style={[styles.textInput, isOverLimit && styles.textInputError]}
          placeholder="今日はどんな一日でしたか？ママたちと共有しませんか..."
          placeholderTextColor="#666"
          multiline
          value={postText}
          onChangeText={setPostText}
          maxLength={maxCharacters}
          returnKeyType="done"
          onSubmitEditing={dismissKeyboard}
        />
        
        <View style={styles.inputFooter}>
          <Text style={[
            styles.charCount,
            isOverLimit && styles.charCountError
          ]}>
            {characterCount}/{maxCharacters}
          </Text>
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <Bot size={20} color="#ff6b9d" />
            <Text style={styles.optionTitle}>ママの味方</Text>
            <Switch
              value={aiEmpathyEnabled}
              onValueChange={setAiEmpathyEnabled}
              trackColor={{ false: '#333', true: '#ff6b9d' }}
              thumbColor={aiEmpathyEnabled ? '#fff' : '#666'}
            />
          </View>
          <Text style={styles.optionDescription}>
            {aiEmpathyEnabled 
              ? 'ポスト後に温かい共感メッセージが届きます' 
              : '今回は共感メッセージを受け取りません'}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Heart size={20} color="#ff6b9d" />
          <Text style={styles.infoText}>
            あなたの気持ちや体験を自由に共有してください。ママたちがあなたの投稿に共感してくれます。
          </Text>
          </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.postButton, 
            (isOverLimit || isPosting) && styles.postButtonDisabled
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
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff6b9d',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#e0e0e0',
    minHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  textInputError: {
    borderColor: '#ff4444',
  },
  inputFooter: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  charCount: {
    fontSize: 14,
    color: '#888',
  },
  charCountError: {
    color: '#ff4444',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b9d',
  },
  infoText: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  optionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
    marginLeft: 8,
    flex: 1,
  },
  optionDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginLeft: 28,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  postButton: {
    backgroundColor: '#ff6b9d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    minHeight: 48,
  },
  postButtonDisabled: {
    backgroundColor: '#666',
  },
  postButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});