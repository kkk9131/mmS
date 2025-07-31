-- アノニマスユーザーによる画像アップロードを許可するポリシー設定

-- postsバケットを公開に設定
UPDATE storage.buckets 
SET public = true 
WHERE id = 'posts';

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous upload allowed" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;

-- 公開読み取りポリシー（すべてのユーザーが画像を表示可能）
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'posts');

-- アノニマスユーザーのアップロード許可ポリシー
CREATE POLICY "Anonymous upload allowed" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'posts'
);

-- 削除は認証済みユーザーのみ許可
CREATE POLICY "Authenticated delete only" ON storage.objects
FOR DELETE USING (
  bucket_id = 'posts' AND 
  auth.role() = 'authenticated'
);

-- 確認クエリ
SELECT 
  bucket_id, 
  name as policy_name, 
  operation, 
  definition
FROM storage.policies 
WHERE bucket_id = 'posts'
ORDER BY operation, name;

-- バケットの設定確認
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets 
WHERE id = 'posts';