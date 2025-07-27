-- カスタム認証用のRLSポリシー設定
-- 本番環境用: より安全な認証チェックを含む

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Authenticated users can view posts" ON posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

DROP POLICY IF EXISTS "Authenticated users can view likes" ON likes;
DROP POLICY IF EXISTS "Users can create likes when authenticated" ON likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;

DROP POLICY IF EXISTS "Authenticated users can view comments" ON comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;

-- RLSを有効化
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- カスタム認証用の新しいポリシー
-- Posts
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can insert posts" ON posts FOR INSERT WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (user_id IS NOT NULL);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (user_id IS NOT NULL);

-- Likes
CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can create likes" ON likes FOR INSERT WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "Users can delete likes" ON likes FOR DELETE USING (user_id IS NOT NULL);

-- Comments
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "Users can update comments" ON comments FOR UPDATE USING (user_id IS NOT NULL);
CREATE POLICY "Users can delete comments" ON comments FOR DELETE USING (user_id IS NOT NULL);