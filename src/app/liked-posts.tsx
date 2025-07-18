import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { ArrowLeft, Heart, MessageCircle, Calendar, Clock, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface LikedPost {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
  comments: number;
  tags: string[];
  likedAt: string;
  aiResponse?: string;
}

const mockLikedPosts: LikedPost[] = [
  {
    id: '1',
    content: '今日は息子の夜泣きがひどくて、もう限界かも...😢 みんなはどうやって乗り切ってる？',
    author: 'ゆかちゃん',
    timestamp: '2024年1月20日 2:30',
    likes: 12,
    comments: 3,
    tags: ['夜泣き', '新生児', 'しんどい'],
    likedAt: '2024年1月20日 2:35',
    aiResponse: '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね ♡'
  },
  {
    id: '2',
    content: '離乳食を全然食べてくれない... 栄養面が心配で毎日不安です。何かいい方法はないでしょうか？',
    author: 'さくら',
    timestamp: '2024年1月19日 12:15',
    likes: 8,
    comments: 5,
    tags: ['離乳食', '食べない', '心配'],
    likedAt: '2024年1月19日 12:20',
    aiResponse: '離乳食の悩み、よくわかります。無理をせず、お子さんのペースに合わせて大丈夫ですよ'
  },
  {
    id: '3',
    content: '保育園の送迎で他のママとの会話が苦手... 人見知りな性格で毎朝憂鬱になっちゃう',
    author: 'あい',
    timestamp: '2024年1月18日 8:45',
    likes: 15,
    comments: 7,
    tags: ['保育園', '人見知り', 'ママ友'],
    likedAt: '2024年1月18日 9:00',
    aiResponse: '人見知りは恥ずかしいことじゃないですよ。無理をしないで、自分らしくいることが一番です'
  },
  {
    id: '4',
    content: '深夜の授乳で眠すぎて意識朦朧... みんなどうやって乗り切ってるの？',
    author: 'まり',
    timestamp: '2024年1月17日 3:20',
    likes: 34,
    comments: 15,
    tags: ['授乳', '睡眠不足', '新生児'],
    likedAt: '2024年1月17日 3:25',
    aiResponse: '深夜の授乳は本当に大変ですよね。無理をしないで、昼間に少しでも休んでくださいね'
  },
  {
    id: '5',
    content: '娘が初めて「ママ」って言ってくれました！涙が出るほど嬉しい瞬間でした 😭✨',
    author: 'りか',
    timestamp: '2024年1月16日 14:30',
    likes: 45,
    comments: 12,
    tags: ['初めての言葉', '嬉しい', '成長'],
    likedAt: '2024年1月16日 14:35',
    aiResponse: '初めての「ママ」は本当に特別な瞬間ですね！お疲れ様でした、素敵な思い出ができましたね'
  }
];

export default function LikedPostsScreen() {
  const [likedPosts, setLikedPosts] = useState<LikedPost[]>(mockLikedPosts);
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

  const totalLikes = likedPosts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = likedPosts.reduce((sum, post) => sum + post.comments, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ff6b9d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>共感したポスト</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{likedPosts.length}</Text>
          <Text style={styles.statLabel}>共感したポスト</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b9d" />
        }
      >
        {likedPosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Heart size={48} color="#666" />
            <Text style={styles.emptyTitle}>共感したポストがありません</Text>
            <Text style={styles.emptyDescription}>
              気になるポストに共感してみませんか？
            </Text>
          </View>
        ) : (
          likedPosts.map((post) => (
            <View key={post.id} style={styles.postContainer}>
              <View style={styles.postHeader}>
                <View style={styles.authorInfo}>
                  <User size={16} color="#ff6b9d" />
                  <Text style={styles.authorName}>{post.author}</Text>
                </View>
                <View style={styles.postDate}>
                  <Calendar size={14} color="#666" />
                  <Text style={styles.dateText}>{formatDate(post.timestamp)}</Text>
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
                  <Heart size={16} color="#ff6b9d" fill="#ff6b9d" />
                  <Text style={styles.statTextLiked}>{post.likes} 共感</Text>
                </View>
                <View style={styles.statGroup}>
                  <MessageCircle size={16} color="#4a9eff" />
                  <Text style={styles.statText}>{post.comments} コメント</Text>
                </View>
              </View>
              
              <View style={styles.likedAtContainer}>
                <Clock size={12} color="#666" />
                <Text style={styles.likedAtText}>
                  {formatDate(post.likedAt)} に共感
                </Text>
              </View>
            </View>
          ))
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
  headerRight: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b9d',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
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
    color: '#e0e0e0',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  postContainer: {
    backgroundColor: '#1a1a1a',
    margin: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b9d',
    marginLeft: 6,
  },
  postDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  postContent: {
    fontSize: 16,
    color: '#e0e0e0',
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
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b9d',
  },
  aiResponseLabel: {
    fontSize: 12,
    color: '#ff6b9d',
    fontWeight: '500',
    marginBottom: 4,
  },
  aiResponseText: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginBottom: 8,
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
  },
  statTextLiked: {
    fontSize: 14,
    color: '#ff6b9d',
    marginLeft: 6,
  },
  likedAtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  likedAtText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontStyle: 'italic',
  },
});