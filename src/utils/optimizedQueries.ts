
import { supabaseClient } from '../services/supabase/client';

// 1. 必要なフィールドのみ選択（SELECT * を避ける）
const optimizedPostsQuery = async () => {
  const supabase = supabaseClient.getClient();
  return await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      is_anonymous,
      user_id,
      users!inner(
        nickname,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);
};

// 2. カウントクエリの最適化（別途実行を避ける）
const getPostsWithCounts = async () => {
  const supabase = supabaseClient.getClient();
  // 投稿データとカウントを一度に取得
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      user:users!inner(nickname, avatar_url),
      likes:likes(count),
      comments:comments(count)
    `)
    .order('created_at', { ascending: false })
    .limit(10);
    
  return posts;
};

// 3. ページネーション最適化（カーソルベース）
const getCursorPaginatedPosts = async (cursor?: string) => {
  const supabase = supabaseClient.getClient();
  let query = supabase
    .from('posts')
    .select('id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (cursor) {
    query = query.lt('created_at', cursor);
  }
  
  return await query;
};

// 4. リアルタイムサブスクリプション最適化
const optimizedRealtimeSubscription = () => {
  const supabase = supabaseClient.getClient();
  // 特定のテーブルとイベントのみ購読
  const subscription = supabase
    .channel('posts-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
      },
      (payload: any) => {
        // 新規投稿のみ処理
        console.log('New post received:', payload.new);
      }
    )
    .subscribe();
    
  return subscription;
};

// 5. バッチ処理最適化
const batchFetchUserData = async (userIds: string[]) => {
  const supabase = supabaseClient.getClient();
  // 複数ユーザーを一度に取得
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, avatar_url')
    .in('id', userIds);
    
  return data;
};
