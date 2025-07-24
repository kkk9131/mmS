import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  useRequestPushPermissionsMutation,
} from '../../store/api/notificationsApi';
import { useAppSelector } from '../../store/hooks';
import { NotificationSettings } from '../../services/notifications/NotificationSettingsManager';

interface SettingRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}

const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  icon,
}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <View style={styles.settingHeader}>
        <Ionicons name={icon} size={20} color="#4F46E5" style={styles.settingIcon} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
      thumbColor={value ? '#4F46E5' : '#9CA3AF'}
    />
  </View>
);

interface TimePickerProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
}

const TimePicker: React.FC<TimePickerProps> = ({ label, value, onValueChange, icon }) => {
  const handlePress = () => {
    // TODO: 時刻選択モーダルの実装
    Alert.alert(
      '時刻設定',
      `${label}の時刻を設定してください\n現在: ${value}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定', onPress: () => console.log('時刻設定') },
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.timePickerRow} onPress={handlePress}>
      <View style={styles.settingInfo}>
        <View style={styles.settingHeader}>
          <Ionicons name={icon} size={20} color="#4F46E5" style={styles.settingIcon} />
          <Text style={styles.settingTitle}>{label}</Text>
        </View>
        <Text style={styles.timeValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
};

export const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const user = useAppSelector((state) => state.auth.user);
  
  const { data: settings, isLoading, refetch } = useGetNotificationSettingsQuery(user?.id || '');
  const [updateSettings, { isLoading: isUpdating }] = useUpdateNotificationSettingsMutation();
  const [requestPermissions] = useRequestPushPermissionsMutation();
  
  const [localSettings, setLocalSettings] = useState<NotificationSettings>({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    mentions: true,
    pushEnabled: true,
    emailEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  });

  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { Notifications } = await import('expo-notifications');
      const permissions = await Notifications.getPermissionsAsync();
      setHasPermission(permissions.status === 'granted');
    } catch (error) {
      console.error('権限チェックエラー:', error);
    }
  };

  const handlePermissionRequest = async () => {
    try {
      const result = await requestPermissions();
      if (result.data) {
        setHasPermission(true);
        Alert.alert('成功', 'プッシュ通知の権限が許可されました');
      } else {
        Alert.alert(
          '権限エラー',
          'プッシュ通知の権限が拒否されました。設定アプリから手動で許可してください。'
        );
      }
    } catch (error) {
      Alert.alert('エラー', '権限のリクエストに失敗しました');
    }
  };

  const handleSettingChange = async (key: keyof NotificationSettings, value: boolean | string) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);

    try {
      await updateSettings({
        userId: user?.id || '',
        settings: { [key]: value },
      });
    } catch (error) {
      console.error('設定更新エラー:', error);
      // ローカル設定を元に戻す
      setLocalSettings(localSettings);
      Alert.alert('エラー', '設定の更新に失敗しました');
    }
  };

  const validateSettings = () => {
    if (!localSettings.pushEnabled) {
      Alert.alert(
        '確認',
        'プッシュ通知を無効にすると、すべての通知が届かなくなります。よろしいですか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '無効にする', style: 'destructive', onPress: () => {} },
        ]
      );
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'デフォルト設定に戻す',
      'すべての通知設定をデフォルトに戻しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: async () => {
            const defaultSettings: NotificationSettings = {
              likes: true,
              comments: true,
              follows: true,
              messages: true,
              mentions: true,
              pushEnabled: true,
              emailEnabled: false,
              quietHoursStart: '22:00',
              quietHoursEnd: '07:00',
            };
            
            setLocalSettings(defaultSettings);
            
            try {
              await updateSettings({
                userId: user?.id || '',
                settings: defaultSettings,
              });
              Alert.alert('完了', '設定をデフォルトに戻しました');
            } catch (error) {
              Alert.alert('エラー', '設定のリセットに失敗しました');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>設定を読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通知設定</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetToDefaults}
          disabled={isUpdating}
        >
          <Text style={styles.resetButtonText}>リセット</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 権限状態 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>権限状態</Text>
          <View style={styles.permissionCard}>
            <View style={styles.permissionInfo}>
              <Ionicons
                name={hasPermission ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={hasPermission ? '#10B981' : '#EF4444'}
              />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>
                  プッシュ通知
                </Text>
                <Text style={styles.permissionStatus}>
                  {hasPermission ? '許可済み' : '許可が必要'}
                </Text>
              </View>
            </View>
            {!hasPermission && (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={handlePermissionRequest}
              >
                <Text style={styles.permissionButtonText}>許可する</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 基本設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本設定</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              title="プッシュ通知"
              description="アプリ外でも通知を受け取る"
              value={localSettings.pushEnabled}
              onValueChange={(value) => handleSettingChange('pushEnabled', value)}
              disabled={!hasPermission}
              icon="notifications"
            />
            <View style={styles.separator} />
            <SettingRow
              title="メール通知"
              description="重要な通知をメールでも受け取る"
              value={localSettings.emailEnabled}
              onValueChange={(value) => handleSettingChange('emailEnabled', value)}
              icon="mail"
            />
          </View>
        </View>

        {/* 通知タイプ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知タイプ</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              title="いいね"
              description="投稿やコメントにいいねがついた時"
              value={localSettings.likes}
              onValueChange={(value) => handleSettingChange('likes', value)}
              disabled={!localSettings.pushEnabled}
              icon="heart"
            />
            <View style={styles.separator} />
            <SettingRow
              title="コメント"
              description="投稿にコメントがついた時"
              value={localSettings.comments}
              onValueChange={(value) => handleSettingChange('comments', value)}
              disabled={!localSettings.pushEnabled}
              icon="chatbubble"
            />
            <View style={styles.separator} />
            <SettingRow
              title="フォロー"
              description="新しくフォローされた時"
              value={localSettings.follows}
              onValueChange={(value) => handleSettingChange('follows', value)}
              disabled={!localSettings.pushEnabled}
              icon="person-add"
            />
            <View style={styles.separator} />
            <SettingRow
              title="メッセージ"
              description="ダイレクトメッセージを受信した時"
              value={localSettings.messages}
              onValueChange={(value) => handleSettingChange('messages', value)}
              disabled={!localSettings.pushEnabled}
              icon="mail"
            />
            <View style={styles.separator} />
            <SettingRow
              title="メンション"
              description="投稿やコメントでメンションされた時"
              value={localSettings.mentions}
              onValueChange={(value) => handleSettingChange('mentions', value)}
              disabled={!localSettings.pushEnabled}
              icon="at"
            />
          </View>
        </View>

        {/* おやすみモード */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>おやすみモード</Text>
          <Text style={styles.sectionDescription}>
            指定した時間帯は通知を制限します（緊急通知は除く）
          </Text>
          <View style={styles.settingsCard}>
            <TimePicker
              label="開始時刻"
              value={localSettings.quietHoursStart}
              onValueChange={(value) => handleSettingChange('quietHoursStart', value)}
              icon="moon"
            />
            <View style={styles.separator} />
            <TimePicker
              label="終了時刻"
              value={localSettings.quietHoursEnd}
              onValueChange={(value) => handleSettingChange('quietHoursEnd', value)}
              icon="sunny"
            />
          </View>
        </View>

        {/* 詳細情報 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>詳細情報</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              • 緊急通知（システム通知など）はおやすみモード中でも配信されます{'\n'}
              • 設定変更は即座に反映されます{'\n'}
              • プッシュ通知を無効にしても、アプリ内通知は表示されます
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  resetButton: {
    padding: 8,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionText: {
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  permissionStatus: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  permissionButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginLeft: 28,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  timeValue: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '600',
    marginLeft: 28,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 44,
  },
  infoCard: {
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});