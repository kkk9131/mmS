-- 簡単なSupabase Storage公開アクセスポリシー設定

-- postsバケットを公開に設定
UPDATE storage.buckets 
SET public = true 
WHERE id = 'posts';

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;

-- 公開読み取りポリシー（すべてのユーザーが画像を表示可能）
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'posts');

-- 認証済みユーザーのアップロードポリシー（カスタム認証も含む）
CREATE POLICY "Authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'posts' AND 
  (auth.role() = 'authenticated' OR auth.jwt() IS NOT NULL)
);

-- 確認クエリ
SELECT 
  bucket_id, 
  name, 
  operation, 
  definition
FROM storage.policies 
WHERE bucket_id = 'posts';