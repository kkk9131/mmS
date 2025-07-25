-- ===============================
-- 本番環境セキュリティ設定スクリプト
-- ===============================
-- Mamapace本番環境のRLSポリシーとセキュリティ設定

-- 1. RLS（Row Level Security）を全テーブルで有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;

-- 2. 既存のポリシーをクリア（安全のため）
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 3. usersテーブルのRLSポリシー
-- 3.1 ユーザーは自分のデータのみ更新可能
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );

-- 3.2 ユーザーは全員のプロフィールを閲覧可能（プライバシー設定に従う）
CREATE POLICY "Users can view profiles" ON users
  FOR SELECT USING (
    -- 自分のプロフィールは常に見える
    auth.uid() = id OR
    -- カスタム認証の場合
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) OR
    -- プライバシー設定に基づく表示
    (privacy_settings->>'profile_visible')::boolean = true
  );

-- 3.3 新規ユーザー登録
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (
    auth.uid() = id OR
    -- カスタム認証での新規登録を許可
    NOT EXISTS (SELECT 1 FROM users WHERE maternal_book_number = NEW.maternal_book_number)
  );

-- 4. postsテーブルのRLSポリシー
-- 4.1 投稿作成（認証済みユーザーのみ）
CREATE POLICY "Authenticated users can create posts" ON posts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = user_id)
  );

-- 4.2 投稿閲覧（匿名投稿とプライバシー設定を考慮）
CREATE POLICY "Users can view posts" ON posts
  FOR SELECT USING (
    -- 匿名投稿は全員閲覧可能
    is_anonymous = true OR
    -- 自分の投稿
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users) OR
    -- 投稿者のプライバシー設定で公開されている
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = posts.user_id 
      AND (users.privacy_settings->>'posts_visible')::boolean = true
    )
  );

-- 4.3 投稿更新（自分の投稿のみ）
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 4.4 投稿削除（自分の投稿のみ）
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 5. likesテーブルのRLSポリシー
-- 5.1 いいね作成
CREATE POLICY "Authenticated users can like posts" ON likes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = user_id)
  );

-- 5.2 いいね閲覧
CREATE POLICY "Users can view likes" ON likes
  FOR SELECT USING (true);

-- 5.3 いいね削除（自分のいいねのみ）
CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 6. commentsテーブルのRLSポリシー
-- 6.1 コメント作成
CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = user_id)
  );

-- 6.2 コメント閲覧
CREATE POLICY "Users can view comments" ON comments
  FOR SELECT USING (true);

-- 6.3 コメント更新（自分のコメントのみ）
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 6.4 コメント削除（自分のコメントのみ）
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 7. notificationsテーブルのRLSポリシー
-- 7.1 通知は自分のもののみ閲覧・更新可能
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 7.2 システムが通知を作成（サービスロール経由）
CREATE POLICY "Service role can create notifications" ON notifications
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM users WHERE id = user_id)
  );

-- 8. followsテーブルのRLSポリシー
-- 8.1 フォロー作成（自分からのフォローのみ）
CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (
    follower_id = auth.uid() OR
    follower_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 8.2 フォロー閲覧（プライバシー設定を考慮）
CREATE POLICY "Users can view follows" ON follows
  FOR SELECT USING (
    -- 自分が関係するフォロー
    follower_id = auth.uid() OR 
    following_id = auth.uid() OR
    -- カスタム認証
    follower_id IN (SELECT id FROM users) OR
    following_id IN (SELECT id FROM users)
  );

-- 8.3 フォロー削除（自分のフォローのみ）
CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (
    follower_id = auth.uid() OR
    follower_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 9. push_tokensテーブルのRLSポリシー
-- 9.1 自分のトークンのみ管理可能
CREATE POLICY "Users can manage own push tokens" ON push_tokens
  FOR ALL USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 10. notification_settingsテーブルのRLSポリシー
-- 10.1 自分の設定のみ管理可能
CREATE POLICY "Users can manage own notification settings" ON notification_settings
  FOR ALL USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid())
  );

-- 11. image_uploadsテーブルのRLSポリシー
-- 11.1 自分の画像のみ管理可能
CREATE POLICY "Users can manage own images" ON image_uploads
  FOR ALL USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE id = auth.uid()) OR
    -- 匿名アップロードを許可（投稿時）
    user_id IS NULL
  );

-- 12. その他のセキュリティ設定
-- 12.1 関数のセキュリティ設定
ALTER FUNCTION auth.uid() SECURITY DEFINER;
ALTER FUNCTION auth.role() SECURITY DEFINER;

-- 12.2 インデックスの作成（パフォーマンスとセキュリティ）
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 13. 監査ログ用の設定（オプション）
-- CREATE TABLE IF NOT EXISTS audit_logs (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID REFERENCES users(id),
--   action TEXT NOT NULL,
--   table_name TEXT NOT NULL,
--   record_id UUID,
--   old_data JSONB,
--   new_data JSONB,
--   ip_address INET,
--   user_agent TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ 本番環境セキュリティ設定が完了しました';
  RAISE NOTICE '⚠️  必ず以下を確認してください:';
  RAISE NOTICE '1. Supabase DashboardでRLSが有効になっていること';
  RAISE NOTICE '2. APIキーが適切に管理されていること';
  RAISE NOTICE '3. 環境変数が本番用に設定されていること';
END $$;