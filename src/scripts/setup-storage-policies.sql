-- Supabase Storage公開アクセスポリシー設定
-- postsバケット用のRLSポリシー

-- 既存のポリシーがあれば削除
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload" ON storage.objects;

-- 公開読み取りポリシー（すべてのユーザーが画像を表示可能）
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'posts');

-- 認証済みユーザーのアップロードポリシー
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'posts' AND 
  auth.role() = 'authenticated'
);

-- サービスロールのフルアクセスポリシー（画像アップロード用）
CREATE POLICY "Service role can upload" ON storage.objects
FOR ALL USING (
  bucket_id = 'posts' AND 
  auth.role() = 'service_role'
);

-- postsバケットが存在しない場合は作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- 確認クエリ
SELECT 
  bucket_id, 
  name, 
  operation, 
  check_expression, 
  using_expression
FROM storage.policies 
WHERE bucket_id = 'posts'
ORDER BY name;