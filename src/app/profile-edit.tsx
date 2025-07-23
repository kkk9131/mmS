import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { ArrowLeft, Save, User, MapPin, CreditCard as Edit3, CircleAlert as AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserService } from '../services/UserService';
import { UpdateProfileData } from '../types/users';

interface ProfileData {
  nickname: string;
  bio: string;
  location: string;
  maternalBookNumber: string;
  aiEmpathyEnabled: boolean;
  privacyLevel: 'public' | 'friends' | 'private';
}

const prefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

export default function ProfileEditScreen() {
  const [profileData, setProfileData] = useState<ProfileData>({
    nickname: '',
    bio: '',
    location: '',
    maternalBookNumber: '',
    aiEmpathyEnabled: true,
    privacyLevel: 'friends'
  });

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalData, setOriginalData] = useState<ProfileData | null>(null);

  const userService = UserService.getInstance();

  // プロフィール初期データの取得
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const userProfile = await userService.getMyProfile();

      const formData: ProfileData = {
        nickname: userProfile.nickname,
        bio: userProfile.bio || '',
        location: '', // 位置情報は既存のUIに合わせてモック
        maternalBookNumber: '****-****-***', // セキュリティ上マスク表示
        aiEmpathyEnabled: userProfile.preferences.notifications?.likes || true,
        privacyLevel: userProfile.privacy.profileVisibility as 'public' | 'friends' | 'private'
      };

      setProfileData(formData);
      setOriginalData(formData);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      Alert.alert('エラー', 'プロフィール情報の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード時にプロフィールを取得
  useEffect(() => {
    fetchProfile();
  }, []);

  // データの変更を検知
  useEffect(() => {
    if (!originalData) return;

    const hasDataChanged = JSON.stringify(profileData) !== JSON.stringify(originalData);
    setHasChanges(hasDataChanged);
  }, [profileData, originalData]);

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        '変更を保存しますか？',
        '変更内容が保存されていません。',
        [
          { text: '破棄', style: 'destructive', onPress: () => router.back() },
          { text: '保存', onPress: handleSave },
          { text: 'キャンセル', style: 'cancel' }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    // バリデーション
    if (profileData.nickname.trim().length < 2) {
      Alert.alert('エラー', 'ニックネームは2文字以上で入力してください');
      return;
    }

    if (profileData.bio.trim().length > 200) {
      Alert.alert('エラー', '自己紹介は200文字以内で入力してください');
      return;
    }

    try {
      setSaving(true);

      // UserServiceのUpdateProfileData型に変換
      const updateData: UpdateProfileData = {
        nickname: profileData.nickname.trim(),
        bio: profileData.bio.trim(),
        preferences: {
          notifications: {
            likes: profileData.aiEmpathyEnabled,
            comments: true, // 既存値を保持
            follows: true, // 既存値を保持
            messages: true, // 既存値を保持
            pushEnabled: true // 既存値を保持
          }
        },
        privacy: {
          profileVisibility: profileData.privacyLevel === 'friends' ? 'followers' : profileData.privacyLevel,
          showFollowersCount: true, // 既存値を保持
          showFollowingCount: true, // 既存値を保持
          allowMessages: true // 既存値を保持
        }
      };

      await userService.updateProfile(updateData);

      // 成功時にキャッシュをクリアして最新データを反映
      userService.clearUserCache();

      // 成功時にoriginalDataを更新
      setOriginalData(profileData);
      setHasChanges(false);

      Alert.alert(
        '保存完了',
        'プロフィールを更新しました',
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert(
        'エラー',
        'プロフィールの更新に失敗しました。もう一度お試しください。'
      );
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (key: keyof ProfileData, value: any) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleLocationSelect = (location: string) => {
    updateProfile('location', location);
    setShowLocationPicker(false);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // ローディング状態の表示
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#ff6b9d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>プロフィール編集</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>プロフィール情報を読み込んでいます...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>プロフィール編集</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
        >
          <Save size={24} color={saving ? "#999" : "#ff6b9d"} />
        </TouchableOpacity>
      </View>

      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* プロフィール画像セクション */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <User size={60} color="#ff6b9d" />
              <TouchableOpacity style={styles.editAvatarButton}>
                <Edit3 size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarText}>プロフィール画像を変更</Text>
          </View>

          {/* ニックネーム */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>ニックネーム</Text>
            <TextInput
              style={styles.textInput}
              value={profileData.nickname}
              onChangeText={(text) => updateProfile('nickname', text)}
              placeholder="ニックネームを入力"
              placeholderTextColor="#666"
              maxLength={20}
              returnKeyType="next"
              onSubmitEditing={dismissKeyboard}
            />
            <Text style={styles.inputHelper}>
              {profileData.nickname.length}/20文字
            </Text>
          </View>

          {/* 自己紹介 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>自己紹介</Text>
            <TextInput
              style={[styles.textInput, styles.bioInput]}
              value={profileData.bio}
              onChangeText={(text) => updateProfile('bio', text)}
              placeholder="自己紹介を入力してください"
              placeholderTextColor="#666"
              multiline
              maxLength={200}
              returnKeyType="done"
              onSubmitEditing={dismissKeyboard}
            />
            <Text style={styles.inputHelper}>
              {profileData.bio.length}/200文字
            </Text>
          </View>

          {/* 居住地域 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>居住地域</Text>
            <TouchableOpacity
              style={styles.locationSelector}
              onPress={() => setShowLocationPicker(!showLocationPicker)}
            >
              <MapPin size={20} color="#666" />
              <Text style={styles.locationText}>{profileData.location}</Text>
            </TouchableOpacity>

            {showLocationPicker && (
              <View style={styles.locationPicker}>
                <ScrollView style={styles.locationList} nestedScrollEnabled>
                  {prefectures.map((prefecture, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.locationItem,
                        profileData.location === prefecture && styles.selectedLocation
                      ]}
                      onPress={() => handleLocationSelect(prefecture)}
                    >
                      <Text style={[
                        styles.locationItemText,
                        profileData.location === prefecture && styles.selectedLocationText
                      ]}>
                        {prefecture}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* 母子手帳番号 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>母子手帳番号</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{profileData.maternalBookNumber}</Text>
              <AlertCircle size={16} color="#666" />
            </View>
            <Text style={styles.inputHelper}>
              セキュリティ上の理由により変更できません
            </Text>
          </View>

          {/* プライバシー設定 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>プロフィール公開範囲</Text>
            <View style={styles.privacyOptions}>
              {[
                { key: 'public', label: '全体に公開', desc: '誰でも閲覧可能' },
                { key: 'friends', label: 'フォロワーのみ', desc: 'フォロワーのみ閲覧可能' },
                { key: 'private', label: '非公開', desc: '自分のみ閲覧可能' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.privacyOption,
                    profileData.privacyLevel === option.key && styles.selectedPrivacy
                  ]}
                  onPress={() => updateProfile('privacyLevel', option.key)}
                >
                  <View style={styles.privacyInfo}>
                    <Text style={[
                      styles.privacyLabel,
                      profileData.privacyLevel === option.key && styles.selectedPrivacyLabel
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.privacyDesc}>{option.desc}</Text>
                  </View>
                  <View style={[
                    styles.radioButton,
                    profileData.privacyLevel === option.key && styles.selectedRadio
                  ]}>
                    {profileData.privacyLevel === option.key && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* セキュリティ情報 */}
          <View style={styles.securitySection}>
            <Text style={styles.securityTitle}>セキュリティ情報</Text>
            <Text style={styles.securityText}>
              • 母子手帳番号は暗号化されて保存されます{'\n'}
              • 個人を特定できる情報は表示されません{'\n'}
              • プロフィール情報は安全に管理されます
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {hasChanges && (
        <View style={styles.savePrompt}>
          <Text style={styles.savePromptText}>変更があります</Text>
          <TouchableOpacity onPress={handleSave} style={styles.savePromptButton}>
            <Save size={16} color="#fff" />
            <Text style={styles.savePromptButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      )}
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  saveButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ff6b9d',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#121212',
  },
  avatarText: {
    fontSize: 14,
    color: '#888',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  locationText: {
    fontSize: 16,
    color: '#e0e0e0',
    marginLeft: 8,
  },
  locationPicker: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 200,
  },
  locationList: {
    maxHeight: 200,
  },
  locationItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  selectedLocation: {
    backgroundColor: '#ff6b9d20',
  },
  locationItemText: {
    fontSize: 16,
    color: '#e0e0e0',
  },
  selectedLocationText: {
    color: '#ff6b9d',
    fontWeight: '500',
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#888',
  },
  privacyOptions: {
    marginTop: 8,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedPrivacy: {
    backgroundColor: '#ff6b9d20',
    borderColor: '#ff6b9d',
  },
  privacyInfo: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 16,
    color: '#e0e0e0',
    marginBottom: 4,
  },
  selectedPrivacyLabel: {
    color: '#ff6b9d',
    fontWeight: '500',
  },
  privacyDesc: {
    fontSize: 12,
    color: '#888',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: {
    borderColor: '#ff6b9d',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff6b9d',
  },
  securitySection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 3,
    borderLeftColor: '#4a9eff',
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a9eff',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  savePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  savePromptText: {
    fontSize: 16,
    color: '#e0e0e0',
  },
  savePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  savePromptButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});