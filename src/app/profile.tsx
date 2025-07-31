import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Image } from 'react-native';
import { ArrowLeft, User, MessageCircle, UserPlus, UserMinus, Heart, Calendar, MapPin, Share, MoveHorizontal as MoreHorizontal, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { PostsService } from '../services/PostsService';
import { FeatureFlagsManager } from '../services/featureFlags';
import { User as UserType, UserProfile as UserProfileType } from '../types/users';
import { useTheme } from '../contexts/ThemeContext';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { FollowService } from '../services/FollowService';
import { UserStatsService } from '../services/UserStatsService';
import { postsApi } from '../store/api/postsApi';
import { LazyImage } from '../components/image/LazyImage';

// 画面表示用のプロフィールインターface（既存のUIとの互換性維持）
interface DisplayProfile {
  id: string;
  name: string;
  bio?: string;
  location?: string;
  joinDate: string;
  postCount: number;
  followingCount: number;
  followerCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  avatar?: string;
}

interface UserPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  isCommented: boolean;
  images?: string[]; // 複数画像フィールド
  tags: string[];
  aiResponse?: string;
}

// モックデータは削除 - Supabaseの実データを使用

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { logout, user } = useAuth();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  
  // Services
  const postsService = PostsService.getInstance();
  const featureFlags = FeatureFlagsManager.getInstance();
  const followService = FollowService.getInstance();
  const userStatsService = UserStatsService.getInstance();
  
  // 自分のプロフィールかどうかを判定
  const isOwnProfile = !userId || userId === 'own';
  
  // デバッグ: ユーザー情報を確認
  console.log('🔍 Debug - user from useAuth:', user);
  console.log('🔍 Debug - user.nickname:', user?.nickname);
  console.log('🔍 Debug - user.maternal_book_number:', user?.maternal_book_number);
  console.log('🔍 Debug - userId from params:', userId);
  console.log('🔍 Debug - isOwnProfile:', isOwnProfile);
  
  // 現在のニックネームが「かずと_修正」になっている原因調査
  if (user?.nickname?.includes('_修正')) {
    console.warn('⚠️ ユーザーニックネームに「_修正」が含まれています！');
    console.warn('⚠️ 調査が必要: ユーザーニックネーム =', user.nickname);
  }
  
  // 実際の認証済みユーザーIDを使用（フォールバックなし）
  const targetUserId = isOwnProfile 
    ? user?.id // 認証済みユーザーのIDのみ使用
    : userId;
    
  console.log('🔍 Debug - targetUserId:', targetUserId);
  
  // State
  const [refreshing, setRefreshing] = useState(false);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // コメントモーダル関連の状態
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<UserPost | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // RTK Query hooks for comments
  const [createComment] = postsApi.useCreateCommentMutation();
  const currentUserId = useAppSelector(state => state.auth?.profile?.id || state.auth?.user?.id);
  const {
    data: comments = [],
    isLoading: commentsLoading,
    refetch: refetchComments
  } = postsApi.useGetCommentsQuery(selectedPost?.id || '', {
    skip: !selectedPost?.id || !commentModalVisible
  });
  
  // Load user posts
  const loadUserPosts = async () => {
    console.log('🚀 loadUserPosts開始');
    console.log('🔍 targetUserId:', targetUserId);
    console.log('🔍 user:', user);
    
    if (!targetUserId) {
      console.log('❌ targetUserIdがありません');
      console.log('🔍 isOwnProfile:', isOwnProfile);
      console.log('🔍 user?.id:', user?.id);
      console.log('🔍 userId (params):', userId);
      setPostsLoading(false);
      setPostsError('ユーザーが認証されていません');
      return;
    }
    
    try {
      setPostsLoading(true);
      setPostsError(null);
      
      console.log('🔍 Loading posts for user:', targetUserId);
      
      // Supabaseを強制的に使用
      const originalSupabaseFlag = featureFlags.getFlag('USE_SUPABASE');
      featureFlags.setFlag('USE_SUPABASE', true);
      
      try {
        console.log('📞 PostsService.getUserPosts呼び出し開始');
        console.log('🔍 検索対象ユーザーID:', targetUserId);
        console.log('🔍 現在ログイン中のユーザー:', user);
        
        const response = await postsService.getUserPosts(targetUserId, {
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          order: 'desc'
        });
        
        console.log('📊 PostsServiceレスポンス:', response);
        console.log('📊 投稿数:', response.posts.length);
        console.log('📊 取得した投稿:', response.posts.map(p => ({ id: p.id, authorId: p.authorId, authorName: p.authorName, content: p.content.substring(0, 50) })));
        
        // PostsServiceの形式からUserPost形式に変換
        const transformedPosts: UserPost[] = response.posts.map(post => ({
          id: post.id,
          content: post.content,
          timestamp: formatTimestamp(post.createdAt),
          likes: post.likesCount,
          comments: post.commentsCount,
          isLiked: post.isLiked,
          isCommented: post.isCommented || false,
          images: post.images, // 複数画像フィールド
          tags: [], // タグ機能は後で実装
          aiResponse: undefined
        }));
        
        setUserPosts(transformedPosts);
        console.log('✅ User posts loaded:', transformedPosts.length);
        
        // プロフィール情報を設定（常にAuthContextのuser情報を使用）
        if (isOwnProfile && user) {
          // 自分のプロフィールの場合は、AuthContextから取得したユーザー情報を使用
          
          // 統計情報を取得
          let stats = { postCount: 0, followingCount: 0, followerCount: 0 };
          try {
            stats = await userStatsService.getUserStats(user.id);
          } catch (error) {
            console.log('統計情報取得エラー:', error);
          }
          
          setProfile({
            id: user.id,
            name: user.nickname || 'Unknown',
            bio: user.maternal_book_number ? `母子手帳番号: ${user.maternal_book_number}` : '',
            location: '',
            joinDate: formatJoinDate(user.created_at || new Date().toISOString()),
            postCount: stats.postCount,
            followingCount: stats.followingCount,
            followerCount: stats.followerCount,
            isFollowing: false,
            isOwnProfile: true,
            avatar: user.avatar_url
          });
        } else if (targetUserId && !isOwnProfile) {
          // 他のユーザーのプロフィールの場合
          
          // 統計情報を取得
          let stats = { postCount: 0, followingCount: 0, followerCount: 0 };
          try {
            stats = await userStatsService.getUserStats(targetUserId);
          } catch (error) {
            console.log('統計情報取得エラー:', error);
          }
          
          // フォロー状態を確認
          if (user) {
            try {
              const relationship = await followService.getFollowRelationship(targetUserId);
              setIsFollowing(relationship.isFollowing);
            } catch (error) {
              console.log('フォロー状態取得エラー:', error);
            }
          }
          
          // 投稿から基本情報を取得
          const userInfo = response.posts.length > 0 
            ? {
                name: response.posts[0].authorName,
                avatar: response.posts[0].authorAvatar
              }
            : {
                name: 'Unknown',
                avatar: undefined
              };
          
          setProfile({
            id: targetUserId,
            name: userInfo.name,
            bio: '',
            location: '',
            joinDate: formatJoinDate(new Date().toISOString()),
            postCount: stats.postCount,
            followingCount: stats.followingCount,
            followerCount: stats.followerCount,
            isFollowing: isFollowing,
            isOwnProfile,
            avatar: userInfo.avatar
          });
        }
      } finally {
        featureFlags.setFlag('USE_SUPABASE', originalSupabaseFlag);
      }
    } catch (err) {
      console.error('❌ Failed to load user posts:', err);
      console.error('❌ Error details:', JSON.stringify(err, null, 2));
      console.error('❌ Error type:', typeof err);
      console.error('❌ Error message:', (err as any)?.message);
      console.error('❌ Error stack:', (err as any)?.stack);
      setPostsError(`投稿の読み込みに失敗しました: ${(err as any)?.message || 'Unknown error'}`);
      setUserPosts([]);
    } finally {
      console.log('✅ loadUserPosts完了 - ローディング終了');
      setPostsLoading(false);
    }
  };
  
  // Helper functions
  const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return '1時間未満前';
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays === 1) return '1日前';
    return `${diffDays}日前`;
  };
  
  const formatJoinDate = (isoString: string): string => {
    const date = new Date(isoString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };
  
  // Load data on mount and focus
  useEffect(() => {
    console.log('🔄 useEffect実行 - targetUserId変更:', targetUserId);
    console.log('🔄 useEffect実行 - user.id:', user?.id);
    if (targetUserId) {
      loadUserPosts();
      loadFollowRelationship();
    } else {
      console.log('⚠️ targetUserIdがnull/undefinedのため読み込みをスキップ');
    }
  }, [targetUserId, user?.id]); // user.idも依存配列に追加
  
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 プロフィール画面にフォーカス - データ再読み込み');
      if (targetUserId) {
        loadUserPosts();
        loadFollowRelationship();
      }
    }, [targetUserId])
  );
  
  // Load follow relationship
  const loadFollowRelationship = async () => {
    if (!targetUserId || isOwnProfile) {
      setIsFollowing(false);
      return;
    }
    
    try {
      const relationship = await followService.getFollowRelationship(targetUserId);
      setIsFollowing(relationship.isFollowing);
    } catch (error) {
      console.error('フォロー関係の取得エラー:', error);
      setIsFollowing(false);
    }
  };

  // Data for rendering
  const posts: UserPost[] = userPosts;
  const loading = postsLoading;
  const error = postsError;

  const handleBack = () => {
    router.back();
  };

  const handleLike = async (postId: string) => {
    if (!user?.id) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    const post = userPosts.find(p => p.id === postId);
    if (!post) return;

    const wasLiked = post.isLiked;

    // Update local state for immediate UI feedback
    setUserPosts(prevPosts => 
      prevPosts.map(p => 
        p.id === postId 
          ? {
              ...p,
              isLiked: !wasLiked,
              likes: wasLiked ? p.likes - 1 : p.likes + 1
            }
          : p
      )
    );

    // 実際のSupabaseにいいね状態を送信
    try {
      console.log('📡 いいね処理開始:', { postId, wasLiked, userId: user.id });
      
      if (wasLiked) {
        await postsService.unlikePost(postId);
        console.log('✅ いいね解除成功');
      } else {
        await postsService.likePost(postId);
        console.log('✅ いいね成功');
      }
    } catch (err) {
      console.error('❌ いいね処理に失敗:', err);
      // エラー時は状態を元に戻す
      setUserPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === postId 
            ? {
                ...p,
                isLiked: wasLiked,
                likes: wasLiked ? p.likes : p.likes - 1
              }
            : p
        )
      );
      Alert.alert('エラー', 'いいね処理に失敗しました');
    }
  };

  const handleComment = (postId: string) => {
    const post = userPosts.find(p => p.id === postId);
    if (post) {
      setSelectedPost(post);
      setCommentModalVisible(true);
      // Comments will be loaded automatically via useGetCommentsQuery
    }
  };
  
  const handleCommentSubmit = async () => {
    if (!selectedPost || commentText.trim().length === 0 || !currentUserId) {
      if (!currentUserId) {
        Alert.alert('エラー', 'ログインが必要です');
      }
      return;
    }

    try {
      if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
        // RTK Query mutation を使用
        const result = await createComment({
          post_id: selectedPost.id,
          user_id: currentUserId,
          content: commentText.trim(),
          is_anonymous: false
        }).unwrap();
        
        console.log('✅ コメントを投稿しました:', result);
        
        // コメントリストを再取得
        await refetchComments();
        
        // ローカル状態も更新
        setUserPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === selectedPost.id 
              ? { ...post, comments: post.comments + 1, isCommented: true }
              : post
          )
        );
        
        setCommentText('');
        // モーダルは開いたままにする
      } else {
        // PostsService を直接使用
        await postsService.createComment(selectedPost.id, {
          content: commentText.trim()
        });
        
        // ローカル状態を更新
        setUserPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === selectedPost.id 
              ? { ...post, comments: post.comments + 1, isCommented: true }
              : post
          )
        );
        
        setCommentText('');
      }
    } catch (err) {
      console.error('コメント投稿に失敗:', err);
      Alert.alert('エラー', 'コメントの投稿に失敗しました');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserPosts();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('エラー', 'ログアウトに失敗しました');
            }
          },
        },
      ]
    );
  };
  
  const handleFollowToggle = async () => {
    console.log('🚀 [PROFILE] フォローボタンクリック!');
    console.log('🔍 [PROFILE] targetUserId:', targetUserId);
    console.log('🔍 [PROFILE] isOwnProfile:', isOwnProfile);
    console.log('🔍 [PROFILE] 現在のフォロー状態:', isFollowing);
    
    if (!targetUserId || isOwnProfile) {
      console.log('❌ [PROFILE] 早期リターン: targetUserId=', targetUserId, 'isOwnProfile=', isOwnProfile);
      return;
    }
    
    console.log('📊 [PROFILE] フォロー処理開始');
    setFollowLoading(true);
    const willFollow = !isFollowing;
    console.log('🎯 [PROFILE] 実行予定の操作:', willFollow ? 'フォロー' : 'フォロー解除');
    
    // 楽観的更新
    console.log('🔄 [PROFILE] UI楽観的更新実行');
    setIsFollowing(willFollow);
    if (profile) {
      setProfile({
        ...profile,
        followerCount: profile.followerCount + (willFollow ? 1 : -1)
      });
    }
    
    try {
      console.log('📡 [PROFILE] FollowService API呼び出し開始');
      
      if (willFollow) {
        console.log('➡️ [PROFILE] followUser API呼び出し:', targetUserId);
        const result = await followService.followUser(targetUserId);
        console.log('✅ [PROFILE] followUser API成功:', result);
      } else {
        console.log('➡️ [PROFILE] unfollowUser API呼び出し:', targetUserId);
        const result = await followService.unfollowUser(targetUserId);
        console.log('✅ [PROFILE] unfollowUser API成功:', result);
      }
      
      console.log('🎉 [PROFILE] フォロー操作完了');
    } catch (error) {
      console.error('❌ [PROFILE] フォロー処理エラー:', error);
      console.error('❌ [PROFILE] エラー詳細:', JSON.stringify(error, null, 2));
      console.error('❌ [PROFILE] エラータイプ:', typeof error);
      console.error('❌ [PROFILE] エラーメッセージ:', (error as any)?.message);
      console.error('❌ [PROFILE] エラースタック:', (error as any)?.stack);
      
      // エラー時は元に戻す
      console.log('🔄 [PROFILE] UIロールバック実行');
      setIsFollowing(!willFollow);
      if (profile) {
        setProfile({
          ...profile,
          followerCount: profile.followerCount + (willFollow ? -1 : 1)
        });
      }
      Alert.alert(
        'エラー', 
        `${willFollow ? 'フォロー' : 'フォロー解除'}に失敗しました\n\n詳細: ${(error as any)?.message || 'Unknown error'}`
      );
    } finally {
      console.log('🔄 [PROFILE] フォロー処理終了 - ローディング状態解除');
      setFollowLoading(false);
    }
  };

  // 動的スタイル
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
      color: theme.colors.primary,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    profileSection: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    avatarContainer: {
      position: 'relative',
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageButton: {
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followingButton: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followingText: {
      color: theme.colors.text.disabled,
    },
    editButton: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editButtonText: {
      color: theme.colors.text.primary,
      fontWeight: '600',
    },
    profileName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    profileBio: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 22,
      marginBottom: 12,
    },
    metaText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 4,
    },
    statNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
      marginRight: 4,
    },
    statLabel: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    activityButton: {
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      marginHorizontal: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activityButtonText: {
      fontSize: 11,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginTop: 4,
      fontWeight: '500',
    },
    postsTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
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
    postCard: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    postUserName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    postTimestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    postContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 24,
      marginBottom: 12,
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
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.text.disabled,
      marginLeft: 6,
    },
    likedText: {
      color: theme.colors.primary,
    },
    commentedText: {
      color: theme.colors.primary,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    commentModalContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: '80%',
      maxHeight: '80%',
    },
    commentModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    commentModalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    commentModalCloseText: {
      fontSize: 24,
      color: theme.colors.text.disabled,
    },
    originalPost: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    originalPostAuthor: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 8,
    },
    originalPostContent: {
      fontSize: 16,
      color: theme.colors.text.primary,
      lineHeight: 22,
    },
    commentItem: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      marginBottom: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    commentTimestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    commentContent: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
      marginBottom: 8,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    commentInput: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.colors.text.primary,
      maxHeight: 80,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    noCommentsText: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      textAlign: 'center',
    },
  });

  // ローディング状態の表示（投稿読み込み中のみ）
  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={dynamicStyles.headerTitle}>読み込み中...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={dynamicStyles.loadingText}>プロフィールを読み込んでいます...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // プロフィールが存在しない場合はデフォルトプロフィールを作成
  const displayProfile = profile || {
    id: targetUserId,
    name: isOwnProfile ? (user?.nickname || 'Unknown') : 'Unknown User',
    bio: isOwnProfile && user?.maternal_book_number ? `母子手帳番号: ${user.maternal_book_number}` : '',
    location: '',
    joinDate: formatJoinDate(user?.created_at || new Date().toISOString()),
    postCount: posts.length,
    followingCount: 0,
    followerCount: 0,
    isFollowing: false,
    isOwnProfile,
    avatar: isOwnProfile ? user?.avatar_url : undefined
  };

  const handleFollow = async () => {
    await handleFollowToggle();
  };

  const handleMessage = () => {
    router.push({
      pathname: '/chat',
      params: { userId: displayProfile?.id || '', userName: displayProfile?.name || '' }
    });
  };

  const handleShare = () => {
    Alert.alert('プロフィールを共有', 'プロフィールのリンクをコピーしました');
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={dynamicStyles.headerTitle}>プロフィール</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share size={24} color={theme.colors.text.disabled} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* プロフィール情報 */}
        <View style={dynamicStyles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.userSection}>
              <View style={dynamicStyles.avatarContainer}>
                <DefaultAvatar 
                  size={80}
                  name={displayProfile.name}
                  imageUrl={displayProfile.avatar}
                />
              </View>
              <View style={styles.userInfo}>
                <Text style={dynamicStyles.userName}>{displayProfile.name}</Text>
              </View>
            </View>

            <View style={styles.profileActions}>
              {displayProfile.isOwnProfile ? (
                <TouchableOpacity
                  style={dynamicStyles.editButton}
                  onPress={() => router.push('/profile-edit')}
                >
                  <Text style={dynamicStyles.editButtonText}>プロフィール編集</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={dynamicStyles.messageButton} onPress={handleMessage}>
                    <MessageCircle size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && dynamicStyles.followingButton]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <Text style={styles.followButtonText}>処理中...</Text>
                    ) : isFollowing ? (
                      <>
                        <UserMinus size={18} color={theme.colors.text.disabled} />
                        <Text style={[styles.followButtonText, dynamicStyles.followingText]}>フォロー中</Text>
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} color="#fff" />
                        <Text style={styles.followButtonText}>フォロー</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={dynamicStyles.profileName}>{displayProfile.name}</Text>
            <Text style={dynamicStyles.profileBio}>{displayProfile.bio}</Text>

            <View style={styles.profileMeta}>
              <View style={styles.metaItem}>
                <MapPin size={16} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.metaText}>{displayProfile.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Calendar size={16} color={theme.colors.text.disabled} />
                <Text style={dynamicStyles.metaText}>{displayProfile.joinDate}から利用</Text>
              </View>
            </View>

            {/* 統計情報 */}
            <View style={styles.statsRow}>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => displayProfile.isOwnProfile && router.push('/follow-list')}
              >
                <Text style={dynamicStyles.statNumber}>{displayProfile.postCount}</Text>
                <Text style={dynamicStyles.statLabel}>投稿</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => displayProfile.isOwnProfile && router.push('/follow-list')}
              >
                <Text style={dynamicStyles.statNumber}>{displayProfile.followerCount}</Text>
                <Text style={dynamicStyles.statLabel}>フォロワー</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => displayProfile.isOwnProfile && router.push('/follow-list')}
              >
                <Text style={dynamicStyles.statNumber}>{displayProfile.followingCount}</Text>
                <Text style={dynamicStyles.statLabel}>フォロー中</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
              {displayProfile.isOwnProfile && (
                <View style={styles.activityButtons}>
                  <TouchableOpacity
                    style={dynamicStyles.activityButton}
                    onPress={() => router.push('/liked-posts')}
                  >
                    <Heart size={16} color={theme.colors.primary} />
                    <Text style={dynamicStyles.activityButtonText}>共感履歴</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={dynamicStyles.activityButton}
                    onPress={() => router.push('/follow-list')}
                  >
                    <User size={16} color={theme.colors.primary} />
                    <Text style={dynamicStyles.activityButtonText}>フォロー管理</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dynamicStyles.activityButton, styles.logoutButton]}
                    onPress={handleLogout}
                  >
                    <LogOut size={16} color="#ff4444" />
                    <Text style={[styles.activityButtonText, styles.logoutButtonText]}>ログアウト</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ポスト一覧 */}
        <View style={styles.postsSection}>
          <Text style={dynamicStyles.postsTitle}>ポスト</Text>
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={48} color={theme.colors.text.disabled} />
              <Text style={dynamicStyles.emptyTitle}>まだポストがありません</Text>
              <Text style={dynamicStyles.emptyDescription}>
                {displayProfile.isOwnProfile ? '最初のポストを作成してみませんか？' : 'このユーザーはまだポストしていません'}
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={dynamicStyles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.postUser}>
                    <User size={32} color={theme.colors.primary} />
                    <View style={styles.postUserInfo}>
                      <Text style={dynamicStyles.postUserName}>{displayProfile.name}</Text>
                      <Text style={dynamicStyles.postTimestamp}>{post.timestamp}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.postMore}>
                    <MoreHorizontal size={20} color={theme.colors.text.disabled} />
                  </TouchableOpacity>
                </View>

                <Text style={dynamicStyles.postContent}>{post.content}</Text>

                {/* 画像表示 */}
                {post.images && post.images.length > 0 && (
                  <View style={styles.imageContainer}>
                    {post.images.length === 1 ? (
                      // 画像1枚の場合
                      <TouchableOpacity style={styles.singleImage}>
                        <LazyImage
                          uri={post.images[0]}
                          style={styles.imageStyle}
                          resizeMode="cover"
                          borderRadius={8}
                          priority="normal"
                          accessibilityLabel="投稿の画像"
                        />
                      </TouchableOpacity>
                    ) : (
                      // 複数枚の場合
                      <View style={styles.imageGrid}>
                        {post.images.slice(0, 4).map((imageUri, index) => (
                          <TouchableOpacity key={index} style={styles.gridImage}>
                            <LazyImage
                              uri={imageUri}
                              style={styles.imageStyle}
                              resizeMode="cover"
                              borderRadius={8}
                              priority="normal"
                              accessibilityLabel={`投稿の画像 ${index + 1}`}
                            />
                            {/* 4枚以上の場合のオーバーレイ */}
                            {index === 3 && post.images && post.images.length > 4 && (
                              <View style={styles.imageOverlay}>
                                <Text style={styles.overlayText}>
                                  +{post.images.length - 4}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.tagsContainer}>
                  {post.tags.map((tag, index) => (
                    <Text key={index} style={styles.tag}>#{tag}</Text>
                  ))}
                </View>

                {post.aiResponse && (
                  <View style={dynamicStyles.aiResponseContainer}>
                    <Text style={dynamicStyles.aiResponseLabel}>ママの味方</Text>
                    <Text style={dynamicStyles.aiResponseText}>{post.aiResponse}</Text>
                  </View>
                )}

                <View style={dynamicStyles.postActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && styles.likedButton]}
                    onPress={() => handleLike(post.id)}
                  >
                    <Heart size={20} color={post.isLiked ? theme.colors.primary : theme.colors.text.disabled} fill={post.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
                      {post.likes}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionButton, post.isCommented && styles.commentedButton]}
                    onPress={() => handleComment(post.id)}
                  >
                    <MessageCircle 
                      size={20} 
                      color={post.isCommented ? theme.colors.primary : theme.colors.text.disabled}
                      fill={post.isCommented ? theme.colors.primary : 'none'} 
                    />
                    <Text style={[dynamicStyles.actionText, post.isCommented && dynamicStyles.commentedText]}>
                      {post.comments}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* コメントモーダル */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={commentModalVisible}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.commentModalOverlay}>
          <KeyboardAvoidingView
            style={dynamicStyles.commentModalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={dynamicStyles.commentModalHeader}>
              <Text style={dynamicStyles.commentModalTitle}>コメント</Text>
              <TouchableOpacity
                onPress={() => setCommentModalVisible(false)}
                style={styles.commentModalClose}
              >
                <Text style={dynamicStyles.commentModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <>
                <View style={dynamicStyles.originalPost}>
                  <Text style={dynamicStyles.originalPostAuthor}>{profile?.name || 'Unknown'}</Text>
                  <Text style={dynamicStyles.originalPostContent}>{selectedPost.content}</Text>
                </View>

                {commentsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={dynamicStyles.loadingText}>コメントを読み込み中...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={comments}
                    keyExtractor={(comment) => comment.id}
                    style={styles.commentsList}
                    renderItem={({ item: comment }) => {
                      const user = (comment as any).users;
                      const authorName = user?.nickname || 'Unknown';
                      
                      return (
                        <View style={dynamicStyles.commentItem}>
                          <View style={styles.commentHeader}>
                            <Text style={dynamicStyles.commentAuthor}>{authorName.replace(/_修正$/, '')}</Text>
                            <Text style={dynamicStyles.commentTimestamp}>{new Date(comment.created_at || new Date()).toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</Text>
                          </View>
                          <Text style={dynamicStyles.commentContent}>{comment.content}</Text>
                        </View>
                      );
                    }}
                    ListEmptyComponent={() => (
                      <View style={styles.noCommentsContainer}>
                        <Text style={dynamicStyles.noCommentsText}>まだコメントがありません</Text>
                      </View>
                    )}
                  />
                )}

                <View style={dynamicStyles.commentInputContainer}>
                  <TextInput
                    style={dynamicStyles.commentInput}
                    placeholder="コメントを入力..."
                    placeholderTextColor={theme.colors.text.disabled}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={200}
                  />
                  <TouchableOpacity
                    style={[styles.commentSubmitButton, commentText.trim().length === 0 && styles.commentSubmitButtonDisabled]}
                    onPress={handleCommentSubmit}
                    disabled={commentText.trim().length === 0}
                  >
                    <Text style={styles.commentSubmitButtonText}>送信</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    justifyContent: 'center',
    marginLeft: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4ade80',
    borderWidth: 3,
    borderColor: '#121212',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageButton: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  followButton: {
    backgroundColor: '#ff6b9d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  followingText: {
    color: '#666',
  },
  editButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  editButtonText: {
    color: '#e0e0e0',
    fontWeight: '600',
  },
  profileInfo: {
    marginTop: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 22,
    marginBottom: 12,
  },
  profileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginRight: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
  },
  activityButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
  },
  activityButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  activityButtonText: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  postsSection: {
    padding: 20,
  },
  postsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
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
  postCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUserInfo: {
    marginLeft: 8,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b9d',
  },
  postTimestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  postMore: {
    padding: 4,
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
  // 画像表示用のスタイル
  imageContainer: {
    marginVertical: 12,
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridImage: {
    width: '48%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imageStyle: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  likedButton: {
    backgroundColor: '#ff6b9d20',
  },
  commentedButton: {
    backgroundColor: '#ff6b9d20',
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  likedText: {
    color: '#ff6b9d',
  },
  logoutButton: {
    borderColor: '#ff4444',
    backgroundColor: '#2a1f1f',
  },
  logoutButtonText: {
    color: '#ff4444',
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
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentModalClose: {
    padding: 8,
    borderRadius: 8,
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noCommentsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  commentSubmitButton: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#666',
  },
  commentSubmitButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});