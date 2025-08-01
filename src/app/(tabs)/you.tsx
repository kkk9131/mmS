import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { User, Settings, Heart, MessageCircle, Shield, LogOut, Bell, Plus } from 'lucide-react-native';
import { DefaultAvatar } from '../../components/DefaultAvatar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { useTheme } from '../../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { PostsService } from '../../services/PostsService';
import { FeatureFlagsManager } from '../../services/featureFlags';
import { UserStatsService } from '../../services/UserStatsService';

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

interface NotificationSettings {
  pushEnabled: boolean;
  likesEnabled: boolean;
  commentsEnabled: boolean;
  followsEnabled: boolean;
  messagesEnabled: boolean;
  mentionsEnabled: boolean;
}

export default function YouScreen() {
  const { handPreference, setHandPreference } = useHandPreference();
  const { theme, isLightMode, setThemeMode } = useTheme();
  const { user, logout } = useAuth();
  const [aiEmpathyEnabled, setAiEmpathyEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [followCount, setFollowCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const postsService = PostsService.getInstance();
  const featureFlags = FeatureFlagsManager.getInstance();
  const userStatsService = UserStatsService.getInstance();

  // 画面フォーカス時に通知設定とユーザーデータを再読み込み
  useFocusEffect(
    React.useCallback(() => {
      loadNotificationSettings();
      loadUserData();
    }, [])
  );

  const loadNotificationSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        const settings: NotificationSettings = JSON.parse(savedSettings);
        setNotificationsEnabled(settings.pushEnabled ?? true);
      }
    } catch (error) {
      console.error('通知設定の読み込みに失敗:', error);
    }
  };

  const loadUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('📊 ユーザーデータ読み込み開始:', user.id);
      
      // Supabaseを強制的に有効化
      const originalSupabaseFlag = featureFlags.getFlag('USE_SUPABASE');
      featureFlags.setFlag('USE_SUPABASE', true);
      
      try {
        // UserStatsServiceで統計情報を一括取得
        const stats = await userStatsService.getUserStats(user.id);
        
        setPostCount(stats.postCount);
        setFollowCount(stats.followingCount);
        setFollowerCount(stats.followerCount);
        
        console.log('✅ ユーザー統計情報:', stats);
      } finally {
        featureFlags.setFlag('USE_SUPABASE', originalSupabaseFlag);
      }
      
    } catch (error) {
      console.error('❌ ユーザーデータ読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    
    try {
      // 既存の設定を読み込んで更新
      const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      let settings: Partial<NotificationSettings> = {};
      if (savedSettings) {
        settings = JSON.parse(savedSettings);
      }
      
      // pushEnabledのみ更新
      const updatedSettings: NotificationSettings = {
        ...settings,
        pushEnabled: enabled,
        // 無効化された場合は全ての通知を無効化
        likesEnabled: enabled ? (settings.likesEnabled ?? true) : false,
        commentsEnabled: enabled ? (settings.commentsEnabled ?? true) : false,
        followsEnabled: enabled ? (settings.followsEnabled ?? true) : false,
        messagesEnabled: enabled ? (settings.messagesEnabled ?? true) : false,
        mentionsEnabled: enabled ? (settings.mentionsEnabled ?? true) : false,
      };
      
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('通知設定の保存に失敗:', error);
    }
  };

  const handleThemeToggle = async (enabled: boolean) => {
    await setThemeMode(enabled ? 'light' : 'dark');
  };

  // テーマ対応の動的スタイル
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    profileSection: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingsSection: {
      backgroundColor: theme.colors.surface,
      marginTop: 20,
    },
    menuSection: {
      backgroundColor: theme.colors.surface,
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingText: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginLeft: 10,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuText: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginLeft: 15,
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
    handOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    handOptionActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    handOptionText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      fontWeight: '500',
    },
    handOptionTextActive: {
      color: '#fff',
    },
  });

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      '本当にログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログアウト', style: 'destructive', onPress: async () => {
          try {
            await logout();
            router.replace('/login');
          } catch (error) {
            console.error('ログアウトエラー:', error);
            Alert.alert('エラー', 'ログアウトに失敗しました');
          }
        }}
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウント削除',
      '本当にアカウントを削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => console.log('Delete account') }
      ]
    );
  };

  const handleCreatePost = () => {
    console.log('Create post');
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={dynamicStyles.headerTitle}>あなた</Text>
        <Text style={dynamicStyles.headerSubtitle}>プロフィールと設定</Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
            データを読み込んでいます...
          </Text>
        </View>
      ) : (
        <>
      <View style={dynamicStyles.profileSection}>
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.profileInfo}>
            <TouchableOpacity 
              style={[styles.avatarContainer, { backgroundColor: theme.colors.card }]}
              onPress={() => router.push('/profile')}
            >
              <DefaultAvatar 
                size={40}
                name={user?.nickname || 'ユーザー'}
                imageUrl={user?.avatar_url}
              />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.colors.text.primary }]}>{user?.nickname || 'ユーザー'}</Text>
              <Text style={[styles.userStats, { color: theme.colors.text.secondary }]}>
                母子手帳番号: {user?.maternal_book_number ? 
                  `****-****-${user.maternal_book_number.slice(-3)}` : 
                  '未設定'}
              </Text>
              <Text style={[styles.joinDate, { color: theme.colors.text.secondary }]}>
                参加日: {user?.created_at ? 
                  new Date(user.created_at).toLocaleDateString('ja-JP', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 
                  '不明'}
              </Text>
            </View>
          </View>
          
          <View style={[styles.statsContainer, { borderTopColor: theme.colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{postCount}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>投稿</Text>
            </View>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => router.push('/follow-list')}
            >
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{followCount}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>フォロー中</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => router.push('/follow-list')}
            >
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{followerCount}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>フォロワー</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={dynamicStyles.settingsSection}>
        <Text style={dynamicStyles.sectionTitle}>アプリ設定</Text>
        
        <View style={dynamicStyles.settingItem}>
          <View style={styles.settingLeft}>
            <Bell size={20} color={theme.colors.primary} />
            <View>
              <Text style={dynamicStyles.settingText}>すべての通知</Text>
              <Text style={[dynamicStyles.settingText, { fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }]}>
                いいね、コメント、フォロー、メッセージ
              </Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: theme.colors.card, true: theme.colors.primary }}
            thumbColor={notificationsEnabled ? '#fff' : theme.colors.text.disabled}
          />
        </View>
        
        <TouchableOpacity 
          style={[dynamicStyles.settingItem, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            console.log('通知詳細設定画面へ遷移');
            router.push('/notifications/settings');
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <Settings size={20} color={theme.colors.text.secondary} />
            <Text style={[dynamicStyles.settingText, { color: theme.colors.text.secondary }]}>
              詳細な通知設定
            </Text>
          </View>
          <Text style={{ color: theme.colors.text.secondary, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        <View style={dynamicStyles.settingItem}>
          <View style={styles.settingLeft}>
            <Settings size={20} color={theme.colors.primary} />
            <Text style={dynamicStyles.settingText}>育児でよく使う手</Text>
          </View>
          <View style={[styles.handToggleContainer, { backgroundColor: theme.colors.card }]}>
            <TouchableOpacity
              style={[dynamicStyles.handOption, handPreference === 'left' && dynamicStyles.handOptionActive]}
              onPress={() => {
                setHandPreference('left');
                Alert.alert('設定変更', '利き手を左手に変更しました\nホーム画面と通知画面のボタン配置が変更されます');
              }}
            >
              <Text style={[dynamicStyles.handOptionText, handPreference === 'left' && dynamicStyles.handOptionTextActive]}>左</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.handOption, handPreference === 'right' && dynamicStyles.handOptionActive]}
              onPress={() => {
                setHandPreference('right');
                Alert.alert('設定変更', '利き手を右手に変更しました\nホーム画面と通知画面のボタン配置が変更されます');
              }}
            >
              <Text style={[dynamicStyles.handOptionText, handPreference === 'right' && dynamicStyles.handOptionTextActive]}>右</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={dynamicStyles.settingItem}>
          <View style={styles.settingLeft}>
            <Settings size={20} color={theme.colors.primary} />
            <Text style={dynamicStyles.settingText}>ライトモード</Text>
          </View>
          <Switch
            value={isLightMode}
            onValueChange={handleThemeToggle}
            trackColor={{ false: theme.colors.card, true: theme.colors.primary }}
            thumbColor={isLightMode ? '#fff' : theme.colors.text.disabled}
          />
        </View>
      </View>

      <View style={dynamicStyles.menuSection}>
        <Text style={dynamicStyles.sectionTitle}>メニュー</Text>
        
        <TouchableOpacity style={dynamicStyles.menuItem}>
          <Shield size={20} color="#4a9eff" />
          <Text style={dynamicStyles.menuText}>ブロックリスト</Text>
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.menuItem}>
          <Settings size={20} color="#4a9eff" />
          <Text style={dynamicStyles.menuText}>プライバシー設定</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.supportSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>サポート</Text>
        <View style={[styles.handExplanation, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.explanationText, { color: theme.colors.text.secondary }]}>
            👶 片手操作モード: 育児でよく使う手を設定すると、ホーム画面のボタンが空いた手側に表示されます
          </Text>
        </View>
        <Text style={[styles.supportText, { color: theme.colors.text.secondary }]}>
          Mamapaceは24時間365日、ママたちの心の支えとなるコミュニティです。
          困ったことがあれば、いつでもお気軽にご相談ください。
        </Text>
        <TouchableOpacity style={[styles.supportButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}>
          <Text style={[styles.supportButtonText, { color: theme.colors.primary }]}>お問い合わせ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>アカウント削除</Text>
        </TouchableOpacity>
      </View>
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    flex: 1,
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
  profileSection: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  userStats: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  joinDate: {
    fontSize: 14,
    color: '#888',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff6b9d',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  settingsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#e0e0e0',
    marginLeft: 12,
  },
  menuSection: {
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  menuText: {
    fontSize: 16,
    color: '#e0e0e0',
    marginLeft: 12,
  },
  supportSection: {
    padding: 16,
  },
  supportText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 16,
  },
  supportButton: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff6b9d',
  },
  supportButtonText: {
    fontSize: 16,
    color: '#ff6b9d',
    fontWeight: '500',
  },
  actionSection: {
    padding: 16,
    marginTop: 'auto',
  },
  logoutButton: {
    backgroundColor: '#ff6b9d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    minHeight: 48,
  },
  logoutText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  handToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 2,
  },
  handOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    minWidth: 40,
    alignItems: 'center',
  },
  handOptionActive: {
    backgroundColor: '#ff6b9d',
  },
  handOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  handOptionTextActive: {
    color: '#fff',
  },
  handExplanation: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  explanationText: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});