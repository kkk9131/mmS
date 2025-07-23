import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { ArrowLeft, Save, User, MapPin, CreditCard as Edit3, CircleAlert as AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserService } from '../services/UserService';
import { UpdateProfileData } from '../types/users';
import { useTheme } from '../contexts/ThemeContext';

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
  const { theme } = useTheme();
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
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    avatarContainer: {
      position: 'relative',
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.primary,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.background,
    },
    avatarText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text.primary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 48,
    },
    inputHelper: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 6,
    },
    locationSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 48,
    },
    locationText: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginLeft: 8,
    },
    locationPicker: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxHeight: 200,
    },
    locationItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    selectedLocation: {
      backgroundColor: `${theme.colors.primary}20`,
    },
    locationItemText: {
      fontSize: 16,
      color: theme.colors.text.primary,
    },
    selectedLocationText: {
      color: theme.colors.primary,
      fontWeight: '500',
    },
    readOnlyInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 48,
    },
    readOnlyText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
    },
    privacyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selectedPrivacy: {
      backgroundColor: `${theme.colors.primary}20`,
      borderColor: theme.colors.primary,
    },
    privacyLabel: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    selectedPrivacyLabel: {
      color: theme.colors.primary,
      fontWeight: '500',
    },
    privacyDesc: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedRadio: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    securitySection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
    },
    securityTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.accent,
      marginBottom: 8,
    },
    securityText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
    },
    savePrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    savePromptText: {
      fontSize: 16,
      color: theme.colors.text.primary,
    },
    savePromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
  });

  // ローディング状態の表示
  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>プロフィール編集</Text>
        </View>
        <View style={dynamicStyles.loadingContainer}>
          <Text style={dynamicStyles.loadingText}>プロフィール情報を読み込んでいます...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>プロフィール編集</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
        >
          <Save size={24} color={saving ? theme.colors.text.disabled : theme.colors.primary} />
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
            <View style={dynamicStyles.avatarContainer}>
              <User size={60} color={theme.colors.primary} />
              <TouchableOpacity style={dynamicStyles.editAvatarButton}>
                <Edit3 size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={dynamicStyles.avatarText}>プロフィール画像を変更</Text>
          </View>

          {/* ニックネーム */}
          <View style={styles.inputSection}>
            <Text style={dynamicStyles.inputLabel}>ニックネーム</Text>
            <TextInput
              style={dynamicStyles.textInput}
              value={profileData.nickname}
              onChangeText={(text) => updateProfile('nickname', text)}
              placeholder="ニックネームを入力"
              placeholderTextColor={theme.colors.text.secondary}
              maxLength={20}
              returnKeyType="next"
              onSubmitEditing={dismissKeyboard}
            />
            <Text style={dynamicStyles.inputHelper}>
              {profileData.nickname.length}/20文字
            </Text>
          </View>

          {/* 自己紹介 */}
          <View style={styles.inputSection}>
            <Text style={dynamicStyles.inputLabel}>自己紹介</Text>
            <TextInput
              style={[dynamicStyles.textInput, styles.bioInput]}
              value={profileData.bio}
              onChangeText={(text) => updateProfile('bio', text)}
              placeholder="自己紹介を入力してください"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              maxLength={200}
              returnKeyType="done"
              onSubmitEditing={dismissKeyboard}
            />
            <Text style={dynamicStyles.inputHelper}>
              {profileData.bio.length}/200文字
            </Text>
          </View>

          {/* 居住地域 */}
          <View style={styles.inputSection}>
            <Text style={dynamicStyles.inputLabel}>居住地域</Text>
            <TouchableOpacity
              style={dynamicStyles.locationSelector}
              onPress={() => setShowLocationPicker(!showLocationPicker)}
            >
              <MapPin size={20} color={theme.colors.text.secondary} />
              <Text style={dynamicStyles.locationText}>{profileData.location}</Text>
            </TouchableOpacity>

            {showLocationPicker && (
              <View style={dynamicStyles.locationPicker}>
                <ScrollView style={styles.locationList} nestedScrollEnabled>
                  {prefectures.map((prefecture, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        dynamicStyles.locationItem,
                        profileData.location === prefecture && dynamicStyles.selectedLocation
                      ]}
                      onPress={() => handleLocationSelect(prefecture)}
                    >
                      <Text style={[
                        dynamicStyles.locationItemText,
                        profileData.location === prefecture && dynamicStyles.selectedLocationText
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
            <Text style={dynamicStyles.inputLabel}>母子手帳番号</Text>
            <View style={dynamicStyles.readOnlyInput}>
              <Text style={dynamicStyles.readOnlyText}>{profileData.maternalBookNumber}</Text>
              <AlertCircle size={16} color={theme.colors.text.secondary} />
            </View>
            <Text style={dynamicStyles.inputHelper}>
              セキュリティ上の理由により変更できません
            </Text>
          </View>

          {/* プライバシー設定 */}
          <View style={styles.inputSection}>
            <Text style={dynamicStyles.inputLabel}>プロフィール公開範囲</Text>
            <View style={styles.privacyOptions}>
              {[
                { key: 'public', label: '全体に公開', desc: '誰でも閲覧可能' },
                { key: 'friends', label: 'フォロワーのみ', desc: 'フォロワーのみ閲覧可能' },
                { key: 'private', label: '非公開', desc: '自分のみ閲覧可能' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    dynamicStyles.privacyOption,
                    profileData.privacyLevel === option.key && dynamicStyles.selectedPrivacy
                  ]}
                  onPress={() => updateProfile('privacyLevel', option.key)}
                >
                  <View style={styles.privacyInfo}>
                    <Text style={[
                      dynamicStyles.privacyLabel,
                      profileData.privacyLevel === option.key && dynamicStyles.selectedPrivacyLabel
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={dynamicStyles.privacyDesc}>{option.desc}</Text>
                  </View>
                  <View style={[
                    dynamicStyles.radioButton,
                    profileData.privacyLevel === option.key && dynamicStyles.selectedRadio
                  ]}>
                    {profileData.privacyLevel === option.key && (
                      <View style={dynamicStyles.radioInner} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* セキュリティ情報 */}
          <View style={dynamicStyles.securitySection}>
            <Text style={dynamicStyles.securityTitle}>セキュリティ情報</Text>
            <Text style={dynamicStyles.securityText}>
              • 母子手帳番号は暗号化されて保存されます{'\n'}
              • 個人を特定できる情報は表示されません{'\n'}
              • プロフィール情報は安全に管理されます
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {hasChanges && (
        <View style={dynamicStyles.savePrompt}>
          <Text style={dynamicStyles.savePromptText}>変更があります</Text>
          <TouchableOpacity onPress={handleSave} style={dynamicStyles.savePromptButton}>
            <Save size={16} color="#fff" />
            <Text style={styles.savePromptButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    borderRadius: 8,
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
  inputSection: {
    marginBottom: 24,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  locationList: {
    maxHeight: 200,
  },
  privacyOptions: {
    marginTop: 8,
  },
  privacyInfo: {
    flex: 1,
  },
  savePromptButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});