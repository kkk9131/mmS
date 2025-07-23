import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { ArrowLeft, Send, User, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

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
  const { theme } = useTheme();
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

  // Dynamic styles with theme colors
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
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
      backgroundColor: theme.colors.card,
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
      color: theme.colors.text.primary,
    },
    userStatus: {
      fontSize: 12,
      color: theme.colors.success,
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
      backgroundColor: theme.colors.background,
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
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 4,
    },
    otherMessageBubble: {
      backgroundColor: theme.colors.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      color: theme.colors.text.primary,
    },
    messageTime: {
      fontSize: 11,
      alignSelf: 'flex-end',
    },
    ownMessageTime: {
      color: 'rgba(255, 255, 255, 0.8)',
    },
    otherMessageTime: {
      color: theme.colors.text.secondary,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text.primary,
      maxHeight: 100,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sendButton: {
      backgroundColor: theme.colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.text.disabled,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={dynamicStyles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <View style={dynamicStyles.headerContent}>
          <View style={dynamicStyles.avatarContainer}>
            <User size={24} color={theme.colors.primary} />
          </View>
          <View style={dynamicStyles.userInfo}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/profile', params: { userId } })}>
              <Text style={dynamicStyles.userName}>{userName}</Text>
            </TouchableOpacity>
            <Text style={dynamicStyles.userStatus}>オンライン</Text>
          </View>
        </View>
        
        <TouchableOpacity style={dynamicStyles.moreButton}>
          <MoreHorizontal size={24} color={theme.colors.text.disabled} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={dynamicStyles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <ScrollView
            ref={scrollViewRef}
            style={dynamicStyles.messagesContainer}
            contentContainerStyle={dynamicStyles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                dynamicStyles.messageRow,
                message.isOwnMessage ? dynamicStyles.ownMessageRow : dynamicStyles.otherMessageRow
              ]}
            >
              <View
                style={[
                  dynamicStyles.messageBubble,
                  message.isOwnMessage ? dynamicStyles.ownMessageBubble : dynamicStyles.otherMessageBubble
                ]}
              >
                <Text style={[
                  dynamicStyles.messageText,
                  message.isOwnMessage ? dynamicStyles.ownMessageText : dynamicStyles.otherMessageText
                ]}>
                  {message.text}
                </Text>
                <Text style={[
                  dynamicStyles.messageTime,
                  message.isOwnMessage ? dynamicStyles.ownMessageTime : dynamicStyles.otherMessageTime
                ]}>
                  {formatDate(message.timestamp)}
                </Text>
              </View>
            </View>
          ))}
          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={dynamicStyles.inputContainer}>
          <TextInput
            style={dynamicStyles.textInput}
            placeholder="メッセージを入力..."
            placeholderTextColor={theme.colors.text.secondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[dynamicStyles.sendButton, inputText.trim().length === 0 && dynamicStyles.sendButtonDisabled]}
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

