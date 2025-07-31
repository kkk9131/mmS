/**
 * Supabase Storage自動セットアップスクリプト
 * 
 * 使用方法:
 * 1. Supabaseダッシュボードから Service Role Key を取得
 * 2. 以下のコマンドを実行:
 *    SUPABASE_SERVICE_KEY="your-service-key" node setup-storage.js
 */

const { createClient } = require('@supabase/supabase-js');

// 環境変数から設定を読み込み
const SUPABASE_URL = 'https://jikjfizabtmvogijjspn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ エラー: SUPABASE_SERVICE_KEY環境変数が設定されていません');
  console.log('使用方法: SUPABASE_SERVICE_KEY="your-service-key" node setup-storage.js');
  console.log('Service Role KeyはSupabaseダッシュボードの Settings > API から取得できます');
  process.exit(1);
}

// Supabaseクライアントの作成（Service Role Key使用）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('🚀 Supabase Storageセットアップを開始します...\n');

  try {
    // 1. 既存のバケットを確認
    console.log('📦 既存のバケットを確認中...');
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ バケット一覧取得エラー:', listError);
      return;
    }

    const existingBucketNames = existingBuckets.map(b => b.name);
    console.log('既存のバケット:', existingBucketNames.length > 0 ? existingBucketNames.join(', ') : 'なし');

    // 2. postsバケットの作成
    if (!existingBucketNames.includes('posts')) {
      console.log('\n📤 postsバケットを作成中...');
      const { error: createPostsError } = await supabase.storage.createBucket('posts', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      });

      if (createPostsError) {
        console.error('❌ postsバケット作成エラー:', createPostsError);
      } else {
        console.log('✅ postsバケットを作成しました');
      }
    } else {
      console.log('✅ postsバケットは既に存在します');
    }

    // 3. avatarsバケットの作成
    if (!existingBucketNames.includes('avatars')) {
      console.log('\n📤 avatarsバケットを作成中...');
      const { error: createAvatarsError } = await supabase.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      });

      if (createAvatarsError) {
        console.error('❌ avatarsバケット作成エラー:', createAvatarsError);
      } else {
        console.log('✅ avatarsバケットを作成しました');
      }
    } else {
      console.log('✅ avatarsバケットは既に存在します');
    }

    // 4. RLSポリシーの設定
    console.log('\n🔐 RLSポリシーを設定中...');
    
    // setup-storage-buckets.sqlの内容を実行
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        -- RLSポリシーの削除（既存のポリシーがある場合）
        DROP POLICY IF EXISTS "Allow authenticated users to upload posts images" ON storage.objects;
        DROP POLICY IF EXISTS "Allow public to view posts images" ON storage.objects;
        DROP POLICY IF EXISTS "Allow users to update their own posts images" ON storage.objects;
        DROP POLICY IF EXISTS "Allow users to delete their own posts images" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
        DROP POLICY IF EXISTS "Allow public to view avatars" ON storage.objects;
        DROP POLICY IF EXISTS "Allow users to update their own avatar" ON storage.objects;
        DROP POLICY IF EXISTS "Allow users to delete their own avatar" ON storage.objects;

        -- postsバケット用のRLSポリシー作成
        CREATE POLICY "Allow authenticated users to upload posts images"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'posts');

        CREATE POLICY "Allow public to view posts images"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'posts');

        CREATE POLICY "Allow users to update their own posts images"
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'posts' AND (auth.uid())::text = (storage.foldername(name))[1])
        WITH CHECK (bucket_id = 'posts' AND (auth.uid())::text = (storage.foldername(name))[1]);

        CREATE POLICY "Allow users to delete their own posts images"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'posts' AND (auth.uid())::text = (storage.foldername(name))[1]);

        -- avatarsバケット用のRLSポリシー作成
        CREATE POLICY "Allow authenticated users to upload avatars"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

        CREATE POLICY "Allow public to view avatars"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'avatars');

        CREATE POLICY "Allow users to update their own avatar"
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text)
        WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

        CREATE POLICY "Allow users to delete their own avatar"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);
      `
    });

    if (policyError) {
      console.log('⚠️  RLSポリシー設定はSQL Editorから手動で実行してください');
      console.log('   src/scripts/setup-storage-buckets.sql を使用してください');
    } else {
      console.log('✅ RLSポリシーを設定しました');
    }

    // 5. 確認
    console.log('\n📋 セットアップ結果の確認...');
    const { data: finalBuckets } = await supabase.storage.listBuckets();
    console.log('作成されたバケット:');
    finalBuckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (Public: ${bucket.public})`);
    });

    console.log('\n✅ Storageセットアップが完了しました！');
    console.log('📱 アプリから画像アップロードができるようになりました。');

  } catch (error) {
    console.error('❌ セットアップ中にエラーが発生しました:', error);
  }
}

// スクリプトを実行
setupStorage();