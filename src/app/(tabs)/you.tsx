import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { User, Settings, Heart, MessageCircle, Shield, LogOut, Bell, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function YouScreen() {
  const [aiEmpathyEnabled, setAiEmpathyEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [dominantHand, setDominantHand] = useState<'right' | 'left'>('right');
  const [followCount, setFollowCount] = useState(67);
  const [followerCount, setFollowerCount] = useState(89);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>あなた</Text>
        <Text style={styles.headerSubtitle}>プロフィールと設定</Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.profileSection}>
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={() => router.push('/profile')}
            >
              <User size={40} color="#ff6b9d" />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={styles.username}>みさき</Text>
              <Text style={styles.userStats}>母子手帳番号: ****-****-123</Text>
              <Text style={styles.joinDate}>参加日: 2024年1月15日</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => router.push('/follow-list')}
            >
              <Text style={styles.statNumber}>{followCount}</Text>
              <Text style={styles.statLabel}>フォロー中</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => router.push('/follow-list')}
            >
              <Text style={styles.statNumber}>{followerCount}</Text>
              <Text style={styles.statLabel}>フォロワー</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>アプリ設定</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Bell size={20} color="#ff6b9d" />
            <Text style={styles.settingText}>通知</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#333', true: '#ff6b9d' }}
            thumbColor={notificationsEnabled ? '#fff' : '#666'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Settings size={20} color="#ff6b9d" />
            <Text style={styles.settingText}>育児でよく使う手</Text>
          </View>
          <View style={styles.handToggleContainer}>
            <TouchableOpacity
              style={[styles.handOption, dominantHand === 'left' && styles.handOptionActive]}
              onPress={() => setDominantHand('left')}
            >
              <Text style={[styles.handOptionText, dominantHand === 'left' && styles.handOptionTextActive]}>左</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.handOption, dominantHand === 'right' && styles.handOptionActive]}
              onPress={() => setDominantHand('right')}
            >
              <Text style={[styles.handOptionText, dominantHand === 'right' && styles.handOptionTextActive]}>右</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Settings size={20} color="#ff6b9d" />
            <Text style={styles.settingText}>ダークモード</Text>
          </View>
          <Switch
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
            trackColor={{ false: '#333', true: '#ff6b9d' }}
            thumbColor={darkModeEnabled ? '#fff' : '#666'}
          />
        </View>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>メニュー</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <Shield size={20} color="#4a9eff" />
          <Text style={styles.menuText}>ブロックリスト</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Settings size={20} color="#4a9eff" />
          <Text style={styles.menuText}>プライバシー設定</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.supportSection}>
        <Text style={styles.sectionTitle}>サポート</Text>
        <View style={styles.handExplanation}>
          <Text style={styles.explanationText}>
            👶 片手操作モード: 育児でよく使う手を設定すると、ホーム画面のボタンが空いた手側に表示されます
          </Text>
        </View>
        <Text style={styles.supportText}>
          Mamapaceは24時間365日、ママたちの心の支えとなるコミュニティです。
          困ったことがあれば、いつでもお気軽にご相談ください。
        </Text>
        <TouchableOpacity style={styles.supportButton}>
          <Text style={styles.supportButtonText}>お問い合わせ</Text>
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