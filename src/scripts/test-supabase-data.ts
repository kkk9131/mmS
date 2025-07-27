/**
 * Supabaseデータ取得テストスクリプト
 * プロフィール画面の投稿が表示されない問題の調査用
 */

import { createClient } from '@supabase/supabase-js';

// 直接Supabaseクライアントを作成（FeatureFlagsを回避）
const supabaseUrl = 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbXF4ZGtxcGV5dnN1cXl6dXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzMzNDIsImV4cCI6MjA2ODcwOTM0Mn0.BUE7K0TzIMVzQTk6fsDecYNY6s-ftH1UCsm6eOm4BCA';

export async function testSupabaseData() {
  console.log('🔍 === Supabaseデータ取得テスト開始 ===');
  
  try {
    console.log('🔍 Supabase URL:', supabaseUrl);
    console.log('🔍 Supabase Key:', supabaseKey.substring(0, 20) + '...');
    
    // 直接Supabaseクライアントを作成
    const client = createClient(supabaseUrl, supabaseKey);
    
    // 1. 全てのユーザーを取得
    console.log('\n1. 全ユーザー情報を取得:');
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, nickname, maternal_book_number, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (usersError) {
      console.error('❌ ユーザー取得エラー:', usersError);
    } else {
      console.log('✅ ユーザー一覧:');
      users?.forEach((user, index) => {
        console.log(`  ${index + 1}. ID: ${user.id}`);
        console.log(`     ニックネーム: ${user.nickname}`);
        console.log(`     母子手帳番号: ${user.maternal_book_number}`);
        console.log(`     作成日: ${user.created_at}`);
        console.log('');
      });
    }
    
    // 2. 全ての投稿を取得
    console.log('\n2. 全投稿情報を取得:');
    const { data: posts, error: postsError } = await client
      .from('posts')
      .select(`
        id,
        content,
        user_id,
        created_at,
        users!inner (
          id,
          nickname,
          maternal_book_number
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (postsError) {
      console.error('❌ 投稿取得エラー:', postsError);
    } else {
      console.log('✅ 投稿一覧:');
      posts?.forEach((post, index) => {
        const user = Array.isArray(post.users) ? post.users[0] : post.users;
        console.log(`  ${index + 1}. 投稿ID: ${post.id}`);
        console.log(`     投稿者ID: ${post.user_id}`);
        console.log(`     投稿者名: ${user?.nickname}`);
        console.log(`     母子手帳番号: ${user?.maternal_book_number}`);
        console.log(`     内容: ${post.content?.substring(0, 50)}...`);
        console.log(`     作成日: ${post.created_at}`);
        console.log('');
      });
    }
    
    // 3. 特定ユーザーの投稿を検索（ニックネームで）
    console.log('\n3. 「かずと」ユーザーの投稿を検索:');
    
    // まずユーザーを検索
    const { data: kazutoUsers, error: kazutoUsersError } = await client
      .from('users')
      .select('id, nickname, maternal_book_number')
      .or('nickname.ilike.%かずと%,nickname.ilike.%kazuto%');
    
    if (kazutoUsersError) {
      console.error('❌ かずとユーザー検索エラー:', kazutoUsersError);
    } else if (kazutoUsers && kazutoUsers.length > 0) {
      console.log('✅ 見つかったかずとユーザー:');
      kazutoUsers.forEach(user => {
        console.log(`  ID: ${user.id}, ニックネーム: ${user.nickname}, 母子手帳: ${user.maternal_book_number}`);
      });
      
      // 各ユーザーの投稿を検索
      for (const user of kazutoUsers) {
        console.log(`\n📋 ${user.nickname} (${user.id}) の投稿:`);
        const { data: userPosts, error: userPostsError } = await client
          .from('posts')
          .select(`
            id,
            content,
            user_id,
            created_at,
            users!inner (nickname)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (userPostsError) {
          console.error(`❌ ${user.nickname}の投稿取得エラー:`, userPostsError);
        } else if (userPosts && userPosts.length > 0) {
          console.log(`✅ ${user.nickname}の投稿 (${userPosts.length}件):`);
          userPosts.forEach((post, index) => {
            console.log(`  ${index + 1}. ${post.content?.substring(0, 100)}...`);
            console.log(`     作成日: ${post.created_at}`);
          });
        } else {
          console.log(`❌ ${user.nickname}の投稿が見つかりません`);
        }
      }
    } else {
      console.log('❌ かずとユーザーが見つかりません');
    }
    
    // 4. RPC関数をテスト
    console.log('\n4. RPC関数 get_posts_with_like_status をテスト:');
    try {
      const { data: rpcPosts, error: rpcError } = await client
        .rpc('get_posts_with_like_status', {
          requesting_user_id: null,
          limit_count: 5,
          offset_count: 0
        });
      
      if (rpcError) {
        console.error('❌ RPC関数エラー:', rpcError);
      } else {
        console.log('✅ RPC関数結果:', rpcPosts?.length, '件');
        rpcPosts?.slice(0, 3).forEach((post: any, index: number) => {
          console.log(`  ${index + 1}. ID: ${post.id}, ユーザー: ${post.user_nickname}, 内容: ${post.content?.substring(0, 30)}...`);
        });
      }
    } catch (rpcError) {
      console.error('❌ RPC関数実行エラー:', rpcError);
    }
    
  } catch (error) {
    console.error('💥 テスト実行エラー:', error);
  }
  
  console.log('\n🔍 === Supabaseデータ取得テスト完了 ===');
}

// スクリプトを直接実行
if (require.main === module) {
  testSupabaseData().catch(console.error);
}