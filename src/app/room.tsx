import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { ArrowLeft, Send, Users, Settings, Hash, Info, Heart, MessageCircle, Clock, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

interface RoomMessage {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  tags: string[];
}

interface RoomMember {
  id: string;
  name: string;
  isOnline: boolean;
  role: 'admin' | 'member';
  joinDate: string;
}

const mockRoomMessages: RoomMessage[] = [
  {
    id: '1',
    content: 'うちの子も夜泣きがひどくて、今夜も2時間おきに起きてました😭 みんなどうしてる？',
    author: 'ゆかちゃん',
    timestamp: '23:45',
    likes: 3,
    comments: 2,
    isLiked: false,
    tags: ['夜泣き', '睡眠不足']
  },
  {
    id: '2',
    content: '私は夜中に軽くマッサージしてあげると少し落ち着くことがあります。足の裏をやさしく押してあげるとか...',
    author: 'みさき',
    timestamp: '23:47',
    likes: 5,
    comments: 1,
    isLiked: true,
    tags: ['マッサージ', 'アドバイス']
  },
  {
    id: '3',
    content: 'マッサージいいですね！試してみます。あと、私は授乳の後にげっぷをしっかり出させるようにしてから少し改善しました',
    author: 'えみ',
    timestamp: '23:50',
    likes: 2,
    comments: 0,
    isLiked: false,
    tags: ['げっぷ', 'コツ']
  },
  {
    id: '4',
    content: '夜泣きの原因って色々あるんですね...。今度小児科で相談してみようと思います',
    author: 'さくら',
    timestamp: '23:55',
    likes: 1,
    comments: 0,
    isLiked: false,
    tags: ['小児科', '相談']
  }
];

const mockRoomMembers: RoomMember[] = [
  { id: '1', name: 'ゆかちゃん', isOnline: true, role: 'admin', joinDate: '2024-01-10' },
  { id: '2', name: 'みさき', isOnline: true, role: 'member', joinDate: '2024-01-15' },
  { id: '3', name: 'えみ', isOnline: false, role: 'member', joinDate: '2024-01-12' },
  { id: '4', name: 'さくら', isOnline: true, role: 'member', joinDate: '2024-01-18' },
  { id: '5', name: 'あい', isOnline: false, role: 'member', joinDate: '2024-01-14' },
  { id: '6', name: 'りか', isOnline: true, role: 'member', joinDate: '2024-01-16' }
];

export default function RoomScreen() {
  const { theme } = useTheme();
  const { roomId = '1', roomName = '夜泣き対策' } = useLocalSearchParams<{ roomId: string; roomName: string }>();
  const [messages, setMessages] = useState<RoomMessage[]>(mockRoomMessages);
  const [inputText, setInputText] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const onlineMembers = mockRoomMembers.filter(member => member.isOnline);
  const offlineMembers = mockRoomMembers.filter(member => !member.isOnline);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleBack = () => {
    router.back();
  };

  const handleSend = () => {
    if (inputText.trim().length === 0) return;

    const newMessage: RoomMessage = {
      id: Date.now().toString(),
      content: inputText,
      author: 'あなた',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      likes: 0,
      comments: 0,
      isLiked: false,
      tags: []
    };

    setMessages([...messages, newMessage]);
    setInputText('');
  };

  const handleLike = (messageId: string) => {
    setMessages(messages.map(msg => 
      msg.id === messageId 
        ? { ...msg, isLiked: !msg.isLiked, likes: msg.isLiked ? msg.likes - 1 : msg.likes + 1 }
        : msg
    ));
  };

  const handleRoomSettings = () => {
    Alert.alert('ルーム設定', 'ルーム設定画面を開きます');
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
    roomName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginLeft: 8,
    },
    memberCount: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 4,
      marginRight: 8,
    },
    onlineCount: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    roomDescription: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    descriptionText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 8,
      flex: 1,
      lineHeight: 20,
    },
    messageItem: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    authorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginLeft: 6,
    },
    messageTime: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    messageContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 22,
      marginBottom: 8,
    },
    messageTag: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginRight: 8,
      marginBottom: 4,
    },
    messageActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    messageActionLiked: {
      backgroundColor: `${theme.colors.primary}20`,
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 4,
    },
    actionTextLiked: {
      color: theme.colors.primary,
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
      backgroundColor: theme.colors.card,
      opacity: 0.5,
    },
    membersPanel: {
      width: 200,
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
    },
    membersPanelTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text.primary,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    membersSectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text.secondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    memberAvatar: {
      position: 'relative',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    memberOnlineIndicator: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#4ade80',
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    memberName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text.primary,
    },
    memberNameOffline: {
      color: theme.colors.text.secondary,
      opacity: 0.7,
    },
    memberRole: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={styles.roomInfo}>
            <Hash size={20} color={theme.colors.primary} />
            <Text style={dynamicStyles.roomName}>{roomName}</Text>
          </View>
          <View style={styles.roomMeta}>
            <Users size={16} color={theme.colors.text.secondary} />
            <Text style={dynamicStyles.memberCount}>{mockRoomMembers.length}人</Text>
            <View style={styles.onlineIndicator} />
            <Text style={dynamicStyles.onlineCount}>{onlineMembers.length}人オンライン</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.membersButton}
            onPress={() => setShowMembers(!showMembers)}
          >
            <Users size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={handleRoomSettings}
          >
            <Settings size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={dynamicStyles.roomDescription}>
        <Info size={16} color={theme.colors.text.secondary} />
        <Text style={dynamicStyles.descriptionText}>
          夜泣きで悩むママたちの情報交換・相談ルーム。体験談やアドバイスを自由に共有しましょう！
        </Text>
      </View>

      <View style={styles.mainContent}>
        <KeyboardAvoidingView 
          style={styles.messagesContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((message) => (
              <View key={message.id} style={dynamicStyles.messageItem}>
                <View style={styles.messageHeader}>
                  <View style={styles.messageAuthor}>
                    <User size={16} color={theme.colors.primary} />
                    <Text style={dynamicStyles.authorName}>{message.author}</Text>
                  </View>
                  <Text style={dynamicStyles.messageTime}>{message.timestamp}</Text>
                </View>
                
                <Text style={dynamicStyles.messageContent}>{message.content}</Text>
                
                {message.tags.length > 0 && (
                  <View style={styles.messageTags}>
                    {message.tags.map((tag, index) => (
                      <Text key={index} style={dynamicStyles.messageTag}>#{tag}</Text>
                    ))}
                  </View>
                )}
                
                <View style={dynamicStyles.messageActions}>
                  <TouchableOpacity
                    style={[styles.messageAction, message.isLiked && dynamicStyles.messageActionLiked]}
                    onPress={() => handleLike(message.id)}
                  >
                    <Heart size={16} color={message.isLiked ? theme.colors.primary : theme.colors.text.disabled} fill={message.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, message.isLiked && dynamicStyles.actionTextLiked]}>
                      {message.likes}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.messageAction}>
                    <MessageCircle size={16} color={theme.colors.text.disabled} />
                    <Text style={dynamicStyles.actionText}>{message.comments}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={dynamicStyles.inputContainer}>
            <TextInput
              style={dynamicStyles.textInput}
              placeholder={`#${roomName} に投稿...`}
              placeholderTextColor={theme.colors.text.secondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={400}
            />
            <TouchableOpacity
              style={[dynamicStyles.sendButton, inputText.trim().length === 0 && dynamicStyles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={inputText.trim().length === 0}
            >
              <Send size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {showMembers && (
          <View style={dynamicStyles.membersPanel}>
            <Text style={dynamicStyles.membersPanelTitle}>メンバー ({mockRoomMembers.length})</Text>
            
            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {onlineMembers.length > 0 && (
                <View style={styles.membersSection}>
                  <Text style={dynamicStyles.membersSectionTitle}>オンライン - {onlineMembers.length}</Text>
                  {onlineMembers.map((member) => (
                    <TouchableOpacity key={member.id} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <View style={dynamicStyles.memberAvatar}>
                          <User size={20} color={theme.colors.primary} />
                          <View style={dynamicStyles.memberOnlineIndicator} />
                        </View>
                        <View style={styles.memberDetails}>
                          <Text style={dynamicStyles.memberName}>{member.name}</Text>
                          {member.role === 'admin' && (
                            <Text style={dynamicStyles.memberRole}>管理者</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {offlineMembers.length > 0 && (
                <View style={styles.membersSection}>
                  <Text style={dynamicStyles.membersSectionTitle}>オフライン - {offlineMembers.length}</Text>
                  {offlineMembers.map((member) => (
                    <TouchableOpacity key={member.id} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <View style={dynamicStyles.memberAvatar}>
                          <User size={20} color={theme.colors.primary} />
                        </View>
                        <View style={styles.memberDetails}>
                          <Text style={[dynamicStyles.memberName, dynamicStyles.memberNameOffline]}>{member.name}</Text>
                          {member.role === 'admin' && (
                            <Text style={dynamicStyles.memberRole}>管理者</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
    marginRight: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  messageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 48,
    minHeight: 32,
    justifyContent: 'center',
  },
  membersList: {
    flex: 1,
  },
  membersSection: {
    padding: 12,
  },
  memberItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberDetails: {
    flex: 1,
  },
});