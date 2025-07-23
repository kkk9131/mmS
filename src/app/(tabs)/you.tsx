import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { User, Settings, Heart, MessageCircle, Shield, LogOut, Bell, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function YouScreen() {
  const { handPreference, setHandPreference } = useHandPreference();
  const { theme, isLightMode, setThemeMode } = useTheme();
  const [aiEmpathyEnabled, setAiEmpathyEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [followCount, setFollowCount] = useState(67);
  const [followerCount, setFollowerCount] = useState(89);

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
        { text: 'ログアウト', style: 'destructive', onPress: () => console.log('Logout') }
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
      <View style={dynamicStyles.profileSection}>
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.profileInfo}>
            <TouchableOpacity 
              style={[styles.avatarContainer, { backgroundColor: theme.colors.card }]}
              onPress={() => router.push('/profile')}
            >
              <User size={40} color={theme.colors.primary} />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.colors.text.primary }]}>みさき</Text>
              <Text style={[styles.userStats, { color: theme.colors.text.secondary }]}>母子手帳番号: ****-****-123</Text>
              <Text style={[styles.joinDate, { color: theme.colors.text.secondary }]}>参加日: 2024年1月15日</Text>
            </View>
          </View>
          
          <View style={[styles.statsContainer, { borderTopColor: theme.colors.border }]}>
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
            <Text style={dynamicStyles.settingText}>通知</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: theme.colors.card, true: theme.colors.primary }}
            thumbColor={notificationsEnabled ? '#fff' : theme.colors.text.disabled}
          />
        </View>

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
});