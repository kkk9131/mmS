-- Storage Buckets Setup Script
-- このスクリプトをSupabaseダッシュボードのSQL Editorで実行してください

-- 1. postsバケットの作成（存在しない場合）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('posts', 'posts', true, 10485760, '{image/jpeg,image/jpg,image/png,image/webp,image/gif}')
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = '{image/jpeg,image/jpg,image/png,image/webp,image/gif}';

-- 2. avatarsバケットの作成（存在しない場合）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, '{image/jpeg,image/jpg,image/png,image/webp}')
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = '{image/jpeg,image/jpg,image/png,image/webp}';

-- 3. RLSポリシーの削除（既存のポリシーがある場合）
DROP POLICY IF EXISTS "Allow authenticated users to upload posts images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view posts images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own posts images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own posts images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own avatar" ON storage.objects;

-- 4. postsバケット用のRLSポリシー作成

-- 認証済みユーザーがpostsバケットに画像をアップロードできる
CREATE POLICY "Allow authenticated users to upload posts images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts'
);

-- 誰でもpostsバケットの画像を閲覧できる（publicバケット）
CREATE POLICY "Allow public to view posts images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'posts'
);

-- ユーザーが自分がアップロードした画像を更新できる
CREATE POLICY "Allow users to update their own posts images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'posts' AND
  (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'posts' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- ユーザーが自分がアップロードした画像を削除できる
CREATE POLICY "Allow users to delete their own posts images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'posts' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- 5. avatarsバケット用のRLSポリシー作成

-- 認証済みユーザーが自分のフォルダにアバターをアップロードできる
CREATE POLICY "Allow authenticated users to upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- 誰でもアバターを閲覧できる
CREATE POLICY "Allow public to view avatars"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'avatars'
);

-- ユーザーが自分のアバターを更新できる
CREATE POLICY "Allow users to update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- ユーザーが自分のアバターを削除できる
CREATE POLICY "Allow users to delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- 確認用クエリ
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name IN ('posts', 'avatars');

-- RLSポリシー確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;