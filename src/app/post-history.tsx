import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { ArrowLeft, Heart, MessageCircle, Calendar, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

interface MyPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  tags: string[];
  aiResponse?: string;
}

const mockMyPosts: MyPost[] = [
  {
    id: '1',
    content: '今日は息子の夜泣きがひどくて、もう限界かも...😢 みんなはどうやって乗り切ってる？ #夜泣き #新生児 #しんどい',
    timestamp: '2024年1月20日 2:30',
    likes: 12,
    comments: 3,
    tags: ['夜泣き', '新生児', 'しんどい'],
    aiResponse: '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね ♡'
  },
  {
    id: '2',
    content: '保育園の送迎で他のママとの会話が苦手... 人見知りな性格で毎朝憂鬱になっちゃう #保育園 #人見知り #ママ友',
    timestamp: '2024年1月19日 8:15',
    likes: 8,
    comments: 5,
    tags: ['保育園', '人見知り', 'ママ友'],
    aiResponse: '人見知りは恥ずかしいことじゃないですよ。無理をしないで、自分らしくいることが一番です'
  },
  {
    id: '3',
    content: '今日は娘が初めて「ママ」って言ってくれました！涙が出るほど嬉しい瞬間でした 😭✨ #初めての言葉 #嬉しい #成長',
    timestamp: '2024年1月18日 14:22',
    likes: 45,
    comments: 12,
    tags: ['初めての言葉', '嬉しい', '成長'],
    aiResponse: '初めての「ママ」は本当に特別な瞬間ですね！お疲れ様でした、素敵な思い出ができましたね'
  },
  {
    id: '4',
    content: '離乳食を全然食べてくれなくて心配... 栄養は大丈夫なのかな？ #離乳食 #食べない #心配',
    timestamp: '2024年1月17日 12:45',
    likes: 23,
    comments: 8,
    tags: ['離乳食', '食べない', '心配'],
    aiResponse: '離乳食の悩み、よくわかります。無理をせず、お子さんのペースに合わせて大丈夫ですよ'
  },
  {
    id: '5',
    content: '深夜の授乳で眠すぎて意識朦朧... みんなどうやって乗り切ってるの？ #授乳 #睡眠不足 #新生児',
    timestamp: '2024年1月16日 3:10',
    likes: 34,
    comments: 15,
    tags: ['授乳', '睡眠不足', '新生児'],
    aiResponse: '深夜の授乳は本当に大変ですよね。無理をしないで、昼間に少しでも休んでくださいね'
  }
];

export default function PostHistoryScreen() {
  const { theme } = useTheme();
  const [posts, setPosts] = useState<MyPost[]>(mockMyPosts);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const handleBack = () => {
    router.back();
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今日';
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return timestamp.split(' ')[0];
    }
  };

  const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);

  const styles = StyleSheet.create({
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
    backButton: {
      padding: 8,
      borderRadius: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    headerRight: {
      width: 40,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    content: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    postContainer: {
      backgroundColor: theme.colors.surface,
      margin: 10,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    postHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    postDate: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6,
    },
    postTime: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6,
    },
    postContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 24,
      marginBottom: 12,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    tag: {
      fontSize: 14,
      color: '#4a9eff',
      marginRight: 8,
      marginBottom: 4,
    },
    aiResponseContainer: {
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    aiResponseLabel: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
      marginBottom: 4,
    },
    aiResponseText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
    },
    postStats: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    statGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 20,
    },
    statText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿履歴</Text>
        <Text style={styles.headerTitle}>ポスト履歴</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts.length}</Text>
          <Text style={styles.statLabel}>ポスト数</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalLikes}</Text>
          <Text style={styles.statLabel}>総共感数</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalComments}</Text>
          <Text style={styles.statLabel}>総コメント数</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageCircle size={48} color={theme.colors.text.disabled} />
            <Text style={styles.emptyTitle}>ポストがありません</Text>
            <Text style={styles.emptyDescription}>
              最初のポストを作成してみませんか？
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postContainer}>
              <View style={styles.postHeader}>
                <View style={styles.postDate}>
                  <Calendar size={16} color={theme.colors.text.disabled} />
                  <Text style={styles.dateText}>{formatDate(post.timestamp)}</Text>
                </View>
                <View style={styles.postTime}>
                  <Clock size={16} color={theme.colors.text.disabled} />
                  <Text style={styles.timeText}>{post.timestamp.split(' ')[1]}</Text>
                </View>
              </View>
              
              <Text style={styles.postContent}>{post.content}</Text>
              
              <View style={styles.tagsContainer}>
                {post.tags.map((tag, index) => (
                  <Text key={index} style={styles.tag}>#{tag}</Text>
                ))}
              </View>
              
              {post.aiResponse && (
                <View style={styles.aiResponseContainer}>
                  <Text style={styles.aiResponseLabel}>ママの味方</Text>
                  <Text style={styles.aiResponseText}>{post.aiResponse}</Text>
                </View>
              )}
              
              <View style={styles.postStats}>
                <View style={styles.statGroup}>
                  <Heart size={16} color={theme.colors.primary} />
                  <Text style={styles.statText}>{post.likes} 共感</Text>
                </View>
                <View style={styles.statGroup}>
                  <MessageCircle size={16} color="#4a9eff" />
                  <Text style={styles.statText}>{post.comments} コメント</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

