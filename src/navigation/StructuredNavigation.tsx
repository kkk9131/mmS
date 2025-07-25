import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Home, MessageCircle, User, Settings, Search, Heart, Bell, Plus } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { router } from 'expo-router';

interface NavigationItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route: string;
  category: 'primary' | 'secondary' | 'action';
  badge?: number;
  description?: string;
}

interface StructuredNavigationProps {
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

export const StructuredNavigation: React.FC<StructuredNavigationProps> = ({
  currentRoute,
  onNavigate
}) => {
  const navigationItems: NavigationItem[] = [
    // プライマリナビゲーション（主要機能）
    {
      id: 'home',
      title: 'ホーム',
      icon: <Home size={24} color={colors.primary.main} />,
      route: '/(tabs)',
      category: 'primary',
      description: 'タイムラインと最新の投稿を表示'
    },
    {
      id: 'chat',
      title: 'チャット',
      icon: <MessageCircle size={24} color={colors.primary.main} />,
      route: '/chat-list',
      category: 'primary',
      badge: 3,
      description: 'プライベートメッセージとグループチャット'
    },
    {
      id: 'profile',
      title: 'プロフィール',
      icon: <User size={24} color={colors.primary.main} />,
      route: '/profile',
      category: 'primary',
      description: 'あなたのプロフィールと投稿履歴'
    },
    
    // セカンダリナビゲーション（補助機能）
    {
      id: 'search',
      title: '検索',
      icon: <Search size={20} color={colors.secondary.main} />,
      route: '/search',
      category: 'secondary',
      description: '投稿やユーザーを検索'
    },
    {
      id: 'liked-posts',
      title: 'いいねした投稿',
      icon: <Heart size={20} color={colors.secondary.main} />,
      route: '/liked-posts',
      category: 'secondary',
      description: 'いいねした投稿の一覧'
    },
    {
      id: 'notifications',
      title: '通知',
      icon: <Bell size={20} color={colors.secondary.main} />,
      route: '/(tabs)/notifications',
      category: 'secondary',
      badge: 5,
      description: 'いいねやコメントなどの通知'
    },
    {
      id: 'settings',
      title: '設定',
      icon: <Settings size={20} color={colors.secondary.main} />,
      route: '/notifications/settings',
      category: 'secondary',
      description: 'アプリの設定とプライバシー'
    },
    
    // アクションナビゲーション（CTA）
    {
      id: 'create-post',
      title: '新しい投稿',
      icon: <Plus size={24} color={colors.neutral.white} />,
      route: '/create-post',
      category: 'action',
      description: '新しい投稿を作成'
    }
  ];

  const handleNavigation = (item: NavigationItem) => {
    onNavigate?.(item.route);
    router.push(item.route as any);
  };

  const renderNavigationItem = (item: NavigationItem) => {
    const isActive = currentRoute === item.route;
    const isPrimary = item.category === 'primary';
    const isAction = item.category === 'action';
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.navigationItem,
          isPrimary && styles.primaryItem,
          isAction && styles.actionItem,
          isActive && styles.activeItem
        ]}
        onPress={() => handleNavigation(item)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${item.description ? `: ${item.description}` : ''}`}
        accessibilityHint={`${item.title}画面に移動します`}
        accessibilityState={{ selected: isActive }}
      >
        <View style={styles.iconContainer}>
          {item.icon}
          {item.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[
            styles.itemTitle,
            isPrimary && styles.primaryTitle,
            isAction && styles.actionTitle,
            isActive && styles.activeTitle
          ]}>
            {item.title}
          </Text>
          
          {item.description && !isAction && (
            <Text style={[styles.itemDescription, isActive && styles.activeDescription]}>
              {item.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const primaryItems = navigationItems.filter(item => item.category === 'primary');
  const secondaryItems = navigationItems.filter(item => item.category === 'secondary');
  const actionItems = navigationItems.filter(item => item.category === 'action');

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      accessible={true}
      accessibilityLabel="メインナビゲーション"
    >
      {/* プライマリナビゲーション */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>メイン機能</Text>
        <View style={styles.itemsGrid}>
          {primaryItems.map(renderNavigationItem)}
        </View>
      </View>

      {/* アクションナビゲーション */}
      <View style={styles.section}>
        <View style={styles.actionSection}>
          {actionItems.map(renderNavigationItem)}
        </View>
      </View>

      {/* セカンダリナビゲーション */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>その他の機能</Text>
        <View style={styles.itemsList}>
          {secondaryItems.map(renderNavigationItem)}
        </View>
      </View>

      {/* ナビゲーション統計 */}
      <View 
        style={styles.statistics}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={`ナビゲーション統計: 合計${navigationItems.length}個の機能があります`}
      >
        <Text style={styles.statisticsText}>
          利用可能な機能: {navigationItems.length}個
        </Text>
        <Text style={styles.statisticsSubtext}>
          メイン機能 {primaryItems.length}個 | その他 {secondaryItems.length}個
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 16,
    paddingLeft: 4,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemsList: {
    gap: 8,
  },
  actionSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  navigationItem: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 80,
  },
  primaryItem: {
    width: '48%',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  actionItem: {
    backgroundColor: colors.primary.main,
    width: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  activeItem: {
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.semantic.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  primaryTitle: {
    fontSize: typography.fontSize.lg,
  },
  actionTitle: {
    color: colors.neutral.white,
    marginLeft: 8,
    marginBottom: 0,
  },
  activeTitle: {
    color: colors.primary.dark,
  },
  itemDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  activeDescription: {
    color: colors.primary.main,
  },
  statistics: {
    backgroundColor: colors.neutral.white,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  statisticsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  statisticsSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
});