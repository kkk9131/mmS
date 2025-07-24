import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, MessageCircle, Heart, UserPlus, AtSign, Moon, Sun } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { UserService } from '../../services/UserService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  icon,
}) => {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.settingInfo}>
        <View style={styles.settingHeader}>
          {icon}
          <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>{title}</Text>
        </View>
        {description && (
          <Text style={[styles.settingDescription, { color: theme.colors.text.secondary }]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}40` }}
        thumbColor={value ? theme.colors.primary : theme.colors.text.secondary}
        ios_backgroundColor={theme.colors.border}
      />
    </View>
  );
};

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const userService = UserService.getInstance();
  
  // 通知設定の状態
  const [pushEnabled, setPushEnabled] = useState(true);
  const [likesEnabled, setLikesEnabled] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [followsEnabled, setFollowsEnabled] = useState(true);
  const [messagesEnabled, setMessagesEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);
  
  // おやすみモード設定
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  
  // 保存状態
  const [isSaving, setIsSaving] = useState(false);

  // 設定を読み込み
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // ローカルストレージから設定を読み込み
      const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setPushEnabled(settings.pushEnabled ?? true);
        setLikesEnabled(settings.likesEnabled ?? true);
        setCommentsEnabled(settings.commentsEnabled ?? true);
        setFollowsEnabled(settings.followsEnabled ?? true);
        setMessagesEnabled(settings.messagesEnabled ?? true);
        setMentionsEnabled(settings.mentionsEnabled ?? true);
        setQuietHoursEnabled(settings.quietHoursEnabled ?? false);
        setQuietStart(settings.quietStart ?? '22:00');
        setQuietEnd(settings.quietEnd ?? '07:00');
      }
      
      // UserServiceから現在の設定を読み込み（利用可能な場合）
      try {
        const userProfile = await userService.getMyProfile();
        if (userProfile.preferences?.notifications) {
          const notificationPrefs = userProfile.preferences.notifications;
          setPushEnabled(notificationPrefs.pushEnabled ?? true);
          setLikesEnabled(notificationPrefs.likes ?? true);
          setCommentsEnabled(notificationPrefs.comments ?? true);
          setFollowsEnabled(notificationPrefs.follows ?? true);
          setMessagesEnabled(notificationPrefs.messages ?? true);
        }
      } catch (error) {
        console.log('UserService設定の読み込みに失敗（モックモードで続行）:', error);
      }
    } catch (error) {
      console.error('通知設定の読み込みに失敗:', error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      const settings = {
        pushEnabled,
        likesEnabled,
        commentsEnabled,
        followsEnabled,
        messagesEnabled,
        mentionsEnabled,
        quietHoursEnabled,
        quietStart,
        quietEnd,
      };

      // ローカルストレージに保存
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
      
      // UserServiceにも保存（利用可能な場合）
      try {
        await userService.updateProfile({
          preferences: {
            notifications: {
              pushEnabled,
              likes: likesEnabled,
              comments: commentsEnabled,
              follows: followsEnabled,
              messages: messagesEnabled,
            }
          }
        });
        console.log('UserServiceに通知設定を保存しました');
      } catch (error) {
        console.log('UserService保存に失敗（ローカル保存は成功）:', error);
      }

      Alert.alert(
        '設定保存完了',
        '通知設定を保存しました',
        [
          {
            text: 'OK',
            onPress: () => {
              // 「あなた」画面の通知設定も同期
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      console.error('通知設定の保存に失敗:', error);
      Alert.alert(
        'エラー',
        '設定の保存に失敗しました。もう一度お試しください。'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimePress = (type: 'start' | 'end') => {
    const currentTime = type === 'start' ? quietStart : quietEnd;
    Alert.alert(
      '時刻設定',
      `おやすみモード${type === 'start' ? '開始' : '終了'}時刻を設定してください\n現在: ${currentTime}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定', onPress: () => console.log('時刻設定') },
      ]
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginLeft: 16,
    },
    section: {
      backgroundColor: theme.colors.surface,
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text.primary,
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    timeText: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginLeft: 12,
    },
    timeValue: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      margin: 20,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>通知設定</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 基本設定 */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>基本設定</Text>
          
          <SettingRow
            title="プッシュ通知"
            description="アプリが閉じていても通知を受け取る"
            value={pushEnabled}
            onValueChange={setPushEnabled}
            icon={<Bell size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
        </View>

        {/* 通知カテゴリ */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>通知カテゴリ</Text>
          
          <SettingRow
            title="いいね"
            description="投稿にいいねされたとき"
            value={likesEnabled}
            onValueChange={setLikesEnabled}
            disabled={!pushEnabled}
            icon={<Heart size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
          
          <SettingRow
            title="コメント"
            description="投稿にコメントされたとき"
            value={commentsEnabled}
            onValueChange={setCommentsEnabled}
            disabled={!pushEnabled}
            icon={<MessageCircle size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
          
          <SettingRow
            title="フォロー"
            description="新しいフォロワーがいるとき"
            value={followsEnabled}
            onValueChange={setFollowsEnabled}
            disabled={!pushEnabled}
            icon={<UserPlus size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
          
          <SettingRow
            title="メッセージ"
            description="新しいメッセージを受信したとき"
            value={messagesEnabled}
            onValueChange={setMessagesEnabled}
            disabled={!pushEnabled}
            icon={<MessageCircle size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
          
          <SettingRow
            title="メンション"
            description="投稿で@メンションされたとき"
            value={mentionsEnabled}
            onValueChange={setMentionsEnabled}
            disabled={!pushEnabled}
            icon={<AtSign size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
        </View>

        {/* おやすみモード */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>おやすみモード</Text>
          
          <SettingRow
            title="おやすみモード"
            description="指定した時間帯は通知を無効にする"
            value={quietHoursEnabled}
            onValueChange={setQuietHoursEnabled}
            disabled={!pushEnabled}
            icon={<Moon size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />}
          />
          
          {quietHoursEnabled && (
            <>
              <TouchableOpacity
                style={dynamicStyles.timeRow}
                onPress={() => handleTimePress('start')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Moon size={20} color={theme.colors.text.secondary} />
                  <Text style={dynamicStyles.timeText}>開始時刻</Text>
                </View>
                <Text style={dynamicStyles.timeValue}>{quietStart}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={dynamicStyles.timeRow}
                onPress={() => handleTimePress('end')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Sun size={20} color={theme.colors.text.secondary} />
                  <Text style={dynamicStyles.timeText}>終了時刻</Text>
                </View>
                <Text style={dynamicStyles.timeValue}>{quietEnd}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity 
          style={[dynamicStyles.saveButton, isSaving && { opacity: 0.6 }]} 
          onPress={handleSaveSettings}
          disabled={isSaving}
        >
          <Text style={dynamicStyles.saveButtonText}>
            {isSaving ? '保存中...' : '設定を保存'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    marginLeft: 32,
  },
});