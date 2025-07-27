// いいね・コメント機能のテストスクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLikeComment() {
  console.log('🧪 いいね・コメント機能のテスト開始...\n');

  // テストユーザーとポストのID
  const testUserId = '1f8c084d-de05-4ffc-9a83-3e988e5502dc';
  const testPostId = '53ba063d-bfc0-4718-8e4c-aabed6158d95';

  try {
    // 1. 現在のいいね数を確認
    console.log('📊 現在の状態を確認...');
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, content, likes_count, comments_count')
      .eq('id', testPostId)
      .single();

    if (postError) throw postError;
    console.log('投稿の現在の状態:', post);

    // 2. いいねをテスト
    console.log('\n💗 いいねを追加...');
    const { data: newLike, error: likeError } = await supabase
      .from('likes')
      .insert({ post_id: testPostId, user_id: testUserId })
      .select();

    if (likeError) {
      console.error('いいねエラー:', likeError);
    } else {
      console.log('いいね追加成功:', newLike);
    }

    // 3. いいね数を再確認
    const { data: updatedPost } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', testPostId)
      .single();
    
    console.log('更新後のいいね数:', updatedPost?.likes_count);

    // 4. コメントをテスト
    console.log('\n💬 コメントを追加...');
    const { data: newComment, error: commentError } = await supabase
      .from('comments')
      .insert({
        post_id: testPostId,
        user_id: testUserId,
        content: 'テストコメント ' + new Date().toISOString(),
        is_anonymous: false
      })
      .select(`
        *,
        users!inner (
          id,
          nickname,
          avatar_url
        )
      `);

    if (commentError) {
      console.error('コメントエラー:', commentError);
    } else {
      console.log('コメント追加成功:', newComment);
    }

    // 5. トリガーの動作確認
    console.log('\n🔧 トリガーの動作確認...');
    const { data: triggers } = await supabase.rpc('get_triggers_info', {});
    console.log('アクティブなトリガー:', triggers);

  } catch (error) {
    console.error('テストエラー:', error);
  }
}

// トリガー情報を取得する関数を作成
async function createGetTriggersFunction() {
  const query = `
    CREATE OR REPLACE FUNCTION get_triggers_info()
    RETURNS TABLE(trigger_name text, table_name text, function_name text)
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        t.tgname::text,
        t.tgrelid::regclass::text,
        p.proname::text
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgrelid::regclass::text IN ('likes', 'comments')
        AND t.tgname LIKE '%count%'
      ORDER BY t.tgrelid::regclass::text, t.tgname;
    END;
    $$ LANGUAGE plpgsql;
  `;

  const { error } = await supabase.rpc('query', { sql: query });
  if (error) console.error('Function creation error:', error);
}

testLikeComment();