import { Tabs } from 'expo-router';
import { Chrome as Home, Bell, User } from 'lucide-react-native';
import { View, Text } from 'react-native';
// import { useNotificationBadge } from '../../hooks/useNotificationBadge';
import { useTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  // const { unreadCount } = useNotificationBadge();
  const unreadCount = 0; // 通知機能を一時的に無効化
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.disabled,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          minHeight: 48,
        },
      }}>
      <Tabs.Screen
        name="you"
        options={{
          title: 'あなた',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'あなたタブ',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '通知',
          tabBarIcon: ({ size, color }) => (
            <View style={{ position: 'relative' }} accessible={true} accessibilityLabel={unreadCount > 0 ? `通知、${unreadCount}件の未読` : '通知'}>
              <Bell size={size} color={color} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: '#ff6b9d',
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 6,
                  }}
                  accessibilityElementsHidden={true}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 'bold',
                      textAlign: 'center',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount.toString()}
                  </Text>
                </View>
              )}
            </View>
          ),
          tabBarAccessibilityLabel: unreadCount > 0 ? `通知タブ、${unreadCount}件の未読通知があります` : '通知タブ',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'ホームタブ',
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          href: null, // タブナビゲーションから非表示
        }}
      />
    </Tabs>
  );
}