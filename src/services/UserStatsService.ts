import { supabaseClient } from './supabase/client';
import { FeatureFlagsManager } from './featureFlags';

export interface UserStats {
  postCount: number;
  followingCount: number;
  followerCount: number;
}

export class UserStatsService {
  private static instance: UserStatsService;
  private featureFlags: FeatureFlagsManager;

  private constructor() {
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  public static getInstance(): UserStatsService {
    if (!UserStatsService.instance) {
      UserStatsService.instance = new UserStatsService();
    }
    return UserStatsService.instance;
  }

  public async getUserStats(userId: string): Promise<UserStats> {
    console.log('📊 UserStatsService.getUserStats開始:', userId);
    
    if (!this.featureFlags.isSupabaseEnabled()) {
      // モックデータを返す
      return {
        postCount: 0,
        followingCount: 0,
        followerCount: 0
      };
    }

    try {
      const client = supabaseClient.getClient();
      
      // まずRPC関数を使用して統計情報を取得
      try {
        const { data: stats, error: statsError } = await client
          .rpc('get_user_stats', { p_user_id: userId });
        
        if (!statsError && stats && stats.length > 0) {
          const stat = stats[0];
          console.log('📊 RPC関数の統計情報:', stat);
          return {
            postCount: Number(stat.posts_count) || 0,
            followingCount: Number(stat.following_count) || 0,
            followerCount: Number(stat.followers_count) || 0
          };
        } else {
          console.log('⚠️ RPC関数からデータを取得できませんでした:', statsError);
        }
      } catch (e) {
        console.log('⚠️ RPC関数エラー（フォールバック実行）:', e);
      }
      
      // フォールバック: 個別にカウントを取得
      console.log('🔄 フォールバックで個別カウント取得');
      
      // 1. 投稿数を取得
      let postCount = 0;
      try {
        const { count, error: postsError } = await client
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        if (!postsError && count !== null) {
          postCount = count;
        }
        console.log('✅ 投稿数:', postCount);
      } catch (e) {
        console.log('⚠️ 投稿数取得エラー:', e);
      }
      
      // 2. フォロー数を取得
      let followingCount = 0;
      try {
        const { count, error: followingError } = await client
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId);
        
        if (!followingError && count !== null) {
          followingCount = count;
        }
        console.log('✅ フォロー中:', followingCount);
      } catch (e) {
        console.log('⚠️ フォロー数取得エラー:', e);
      }
      
      // 3. フォロワー数を取得
      let followerCount = 0;
      try {
        const { count, error: followerError } = await client
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId);
        
        if (!followerError && count !== null) {
          followerCount = count;
        }
        console.log('✅ フォロワー:', followerCount);
      } catch (e) {
        console.log('⚠️ フォロワー数取得エラー:', e);
      }
      
      return {
        postCount,
        followingCount,
        followerCount
      };
      
    } catch (error) {
      console.error('❌ ユーザー統計情報取得エラー:', error);
      return {
        postCount: 0,
        followingCount: 0,
        followerCount: 0
      };
    }
  }
  
  // フォロー関係を作成
  public async followUser(followerId: string, followingId: string): Promise<boolean> {
    if (!this.featureFlags.isSupabaseEnabled()) {
      return false;
    }
    
    try {
      const client = supabaseClient.getClient();
      
      // RPC関数を使用してフォロー
      try {
        const { error } = await client
          .rpc('follow_user', {
            follower_user_id: followerId,
            following_user_id: followingId
          });
        
        if (error) {
          console.error('❌ フォローRPCエラー:', error);
          // 直接インサートを試行
          const { error: insertError } = await client
            .from('follows')
            .insert({
              follower_id: followerId,
              following_id: followingId
            });
          
          if (insertError) {
            console.error('❌ フォロー作成エラー:', insertError);
            return false;
          }
        }
        
        return true;
      } catch (e) {
        console.error('❌ フォロー処理エラー:', e);
        return false;
      }
    } catch (error) {
      console.error('❌ フォローエラー:', error);
      return false;
    }
  }
  
  // フォロー解除
  public async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    if (!this.featureFlags.isSupabaseEnabled()) {
      return false;
    }
    
    try {
      const client = supabaseClient.getClient();
      
      // RPC関数を使用してアンフォロー
      try {
        const { error } = await client
          .rpc('unfollow_user', {
            follower_user_id: followerId,
            following_user_id: followingId
          });
        
        if (error) {
          console.error('❌ アンフォローRPCエラー:', error);
          // 直接削除を試行
          const { error: deleteError } = await client
            .from('follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', followingId);
          
          if (deleteError) {
            console.error('❌ フォロー解除エラー:', deleteError);
            return false;
          }
        }
        
        return true;
      } catch (e) {
        console.error('❌ アンフォロー処理エラー:', e);
        return false;
      }
    } catch (error) {
      console.error('❌ アンフォローエラー:', error);
      return false;
    }
  }
}