import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { ArrowLeft, Send, User, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isOwnMessage: boolean;
  isRead: boolean;
}

const mockMessages: Message[] = [
  {
    id: '1',
    text: 'こんにちは！先日のポストを拝見させていただきました',
    timestamp: '14:30',
    isOwnMessage: false,
    isRead: true
  },
  {
    id: '2',
    text: 'ありがとうございます！',
    timestamp: '14:32',
    isOwnMessage: true,
    isRead: true
  },
  {
    id: '3',
    text: '夜泣きの件、本当に大変ですよね... 私も同じような経験をしました',
    timestamp: '14:33',
    isOwnMessage: false,
    isRead: true
  },
  {
    id: '4',
    text: 'そうなんですね！どうやって乗り越えられましたか？',
    timestamp: '14:35',
    isOwnMessage: true,
    isRead: true
  },
  {
    id: '5',
    text: '私の場合は、夜中に授乳した後、軽くマッサージをしてあげると落ち着いてくれることが多かったです',
    timestamp: '14:37',
    isOwnMessage: false,
    isRead: true
  },
  {
    id: '6',
    text: 'それと、疲れすぎないように、昼間に少しでも一緒に昼寝をするように心がけました',
    timestamp: '14:38',
    isOwnMessage: false,
    isRead: true
  },
  {
    id: '7',
    text: 'なるほど！マッサージは試したことがありませんでした。今度やってみます',
    timestamp: '14:40',
    isOwnMessage: true,
    isRead: true
  },
  {
    id: '8',
    text: '昼寝も意識してみます。本当にありがとうございます！',
    timestamp: '14:41',
    isOwnMessage: true,
    isRead: false
  }
];

export default function ChatScreen() {
  const { userId, userName } = useLocalSearchParams<{ userId: string; userName: string }>();
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // メッセージを既読にする
    setMessages(messages.map(msg => ({ ...msg, isRead: true })));
  }, []);

  const handleBack = () => {
    router.back();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSend = () => {
    if (inputText.trim().length === 0) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      isOwnMessage: true,
      isRead: false
    };

    setMessages([...messages, newMessage]);
    setInputText('');

    // 送信後にスクロール
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatDate = (timestamp: string) => {
    return timestamp;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <User size={24} color="#ff6b9d" />
          </View>
          <View style={styles.userInfo}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/profile', params: { userId } })}>
              <Text style={styles.userName}>{userName}</Text>
            </TouchableOpacity>
            <Text style={styles.userStatus}>オンライン</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton}>
          <MoreHorizontal size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                  {message.text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
                ]}>
                  {formatDate(message.timestamp)}
                </Text>
              </View>
            </View>
          ))}
          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="メッセージを入力..."
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, inputText.trim().length === 0 && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={inputText.trim().length === 0}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  userStatus: {
    fontSize: 12,
    color: '#4ade80',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    borderRadius: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  messagesContent: {
    padding: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  ownMessageRow: {
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ownMessageBubble: {
    backgroundColor: '#ff6b9d',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#e0e0e0',
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: '#888',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#e0e0e0',
    maxHeight: 100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  sendButton: {
    backgroundColor: '#ff6b9d',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
});