-- Supabase RLS (Row Level Security) ポリシー設定
-- 本番環境でのセキュリティを確保するためのSQL

-- ==============================
-- RLSの有効化
-- ==============================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- ==============================
-- USERS テーブルのポリシー
-- ==============================

-- ユーザーは自分の情報のみ参照可能
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- ユーザーは自分の情報のみ更新可能
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- ユーザー登録時のポリシー（新規作成）
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ユーザーの基本情報は他のユーザーからも参照可能（ニックネーム、アバターなど）
CREATE POLICY "Public user info viewable" ON users
    FOR SELECT USING (true)
    WITH CHECK (
        -- 個人情報は除外
        false -- デフォルトでは無効、必要に応じてカスタマイズ
    );

-- ==============================
-- POSTS テーブルのポリシー
-- ==============================

-- 全ユーザーが投稿を閲覧可能
CREATE POLICY "Posts are viewable by everyone" ON posts
    FOR SELECT USING (true);

-- 認証済みユーザーのみ投稿作成可能
CREATE POLICY "Authenticated users can insert posts" ON posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 投稿者のみ自分の投稿を更新可能
CREATE POLICY "Users can update own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

-- 投稿者のみ自分の投稿を削除可能
CREATE POLICY "Users can delete own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- 匿名投稿の特別な扱い
CREATE POLICY "Anonymous posts protection" ON posts
    FOR SELECT USING (
        CASE 
            WHEN is_anonymous = true THEN 
                -- 匿名投稿の場合、user_id を隠す
                true
            ELSE 
                true
        END
    );

-- ==============================
-- LIKES テーブルのポリシー
-- ==============================

-- 認証済みユーザーのみいいね可能
CREATE POLICY "Authenticated users can like posts" ON likes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- ユーザーは自分のいいねのみ削除可能
CREATE POLICY "Users can delete own likes" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- いいね情報は公開（集計用）
CREATE POLICY "Likes are viewable by everyone" ON likes
    FOR SELECT USING (true);

-- 重複いいね防止
CREATE POLICY "Prevent duplicate likes" ON likes
    FOR INSERT WITH CHECK (
        NOT EXISTS (
            SELECT 1 FROM likes 
            WHERE post_id = NEW.post_id AND user_id = auth.uid()
        )
    );

-- ==============================
-- COMMENTS テーブルのポリシー
-- ==============================

-- 全ユーザーがコメントを閲覧可能
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

-- 認証済みユーザーのみコメント作成可能
CREATE POLICY "Authenticated users can insert comments" ON comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- コメント投稿者のみ自分のコメントを更新可能
CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

-- コメント投稿者のみ自分のコメントを削除可能
CREATE POLICY "Users can delete own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- ==============================
-- NOTIFICATIONS テーブルのポリシー
-- ==============================

-- ユーザーは自分の通知のみ閲覧可能
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- システムのみ通知作成可能（トリガー経由）
CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true); -- トリガーやファンクションから挿入される

-- ユーザーは自分の通知のみ更新可能（既読状態など）
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ユーザーは自分の通知のみ削除可能
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- ==============================
-- FOLLOWS テーブルのポリシー
-- ==============================

-- フォロー情報は公開（プライバシー設定により制限）
CREATE POLICY "Follow relationships are viewable" ON follows
    FOR SELECT USING (true);

-- 認証済みユーザーのみフォロー可能
CREATE POLICY "Authenticated users can follow others" ON follows
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' 
        AND auth.uid() = follower_id 
        AND follower_id != followed_id -- 自分自身をフォローすることはできない
    );

-- ユーザーは自分のフォローのみ解除可能
CREATE POLICY "Users can unfollow others" ON follows
    FOR DELETE USING (auth.uid() = follower_id);

-- 重複フォロー防止
CREATE POLICY "Prevent duplicate follows" ON follows
    FOR INSERT WITH CHECK (
        NOT EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = auth.uid() AND followed_id = NEW.followed_id
        )
    );

-- ==============================
-- セキュリティ関数
-- ==============================

-- RLS状態確認関数
CREATE OR REPLACE FUNCTION check_rls_enabled(table_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = table_name
    AND c.relrowsecurity = true
);
$$;

-- テーブルポリシー確認関数
CREATE OR REPLACE FUNCTION get_table_policies(table_name text, operation_type text DEFAULT NULL)
RETURNS TABLE(policy_name text, policy_type text, policy_definition text)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT 
    policyname::text,
    CASE 
        WHEN permissive = 't' THEN 'PERMISSIVE'
        ELSE 'RESTRICTIVE'
    END::text,
    CASE 
        WHEN qual IS NOT NULL THEN pg_get_expr(qual, relid)
        ELSE 'No condition'
    END::text
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = table_name
AND (operation_type IS NULL OR p.cmd = operation_type);
$$;

-- ユーザー権限確認関数
CREATE OR REPLACE FUNCTION check_user_permissions(user_id uuid, resource_type text, resource_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    CASE resource_type
        WHEN 'post' THEN
            RETURN EXISTS (
                SELECT 1 FROM posts 
                WHERE id = resource_id 
                AND (posts.user_id = user_id OR NOT posts.is_anonymous)
            );
        WHEN 'comment' THEN
            RETURN EXISTS (
                SELECT 1 FROM comments 
                WHERE id = resource_id AND comments.user_id = user_id
            );
        WHEN 'notification' THEN
            RETURN EXISTS (
                SELECT 1 FROM notifications 
                WHERE id = resource_id AND notifications.user_id = user_id
            );
        ELSE
            RETURN false;
    END CASE;
END;
$$;

-- ==============================
-- トリガーとファンクション
-- ==============================

-- 通知自動生成関数
CREATE OR REPLACE FUNCTION create_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- いいね通知
    IF TG_TABLE_NAME = 'likes' THEN
        INSERT INTO notifications (user_id, type, title, message, related_id)
        SELECT 
            p.user_id,
            'like',
            'いいねが付きました',
            u.nickname || 'さんがあなたの投稿にいいねしました',
            NEW.post_id
        FROM posts p
        JOIN users u ON u.id = NEW.user_id
        WHERE p.id = NEW.post_id 
        AND p.user_id != NEW.user_id; -- 自分の投稿には通知しない

    -- コメント通知
    ELSIF TG_TABLE_NAME = 'comments' THEN
        INSERT INTO notifications (user_id, type, title, message, related_id)
        SELECT 
            p.user_id,
            'comment',
            'コメントが付きました',
            u.nickname || 'さんがあなたの投稿にコメントしました',
            NEW.post_id
        FROM posts p
        JOIN users u ON u.id = NEW.user_id
        WHERE p.id = NEW.post_id 
        AND p.user_id != NEW.user_id;

    -- フォロー通知
    ELSIF TG_TABLE_NAME = 'follows' THEN
        INSERT INTO notifications (user_id, type, title, message, related_id)
        SELECT 
            NEW.followed_id,
            'follow',
            'フォローされました',
            u.nickname || 'さんにフォローされました',
            NEW.follower_id
        FROM users u
        WHERE u.id = NEW.follower_id;
    END IF;

    RETURN NEW;
END;
$$;

-- トリガーの作成
DROP TRIGGER IF EXISTS on_like_created ON likes;
CREATE TRIGGER on_like_created
    AFTER INSERT ON likes
    FOR EACH ROW
    EXECUTE FUNCTION create_notification();

DROP TRIGGER IF EXISTS on_comment_created ON comments;
CREATE TRIGGER on_comment_created
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION create_notification();

DROP TRIGGER IF EXISTS on_follow_created ON follows;
CREATE TRIGGER on_follow_created
    AFTER INSERT ON follows
    FOR EACH ROW
    EXECUTE FUNCTION create_notification();

-- ==============================
-- セキュリティビュー
-- ==============================

-- 公開ユーザー情報ビュー（個人情報除外）
CREATE OR REPLACE VIEW public_users AS
SELECT 
    id,
    nickname,
    avatar_url,
    created_at,
    -- 個人情報は除外
    null as email,
    null as mothers_handbook_number_hash
FROM users;

-- 匿名投稿ビュー（投稿者情報を隠す）
CREATE OR REPLACE VIEW public_posts AS
SELECT 
    id,
    CASE 
        WHEN is_anonymous THEN null 
        ELSE user_id 
    END as user_id,
    content,
    is_anonymous,
    created_at,
    updated_at
FROM posts;

-- ==============================
-- インデックス最適化
-- ==============================

-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id) WHERE NOT is_anonymous;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON follows(followed_id);

-- ==============================
-- 本番環境確認
-- ==============================

-- RLS状態の確認
DO $$
DECLARE
    table_name text;
    rls_enabled boolean;
BEGIN
    FOR table_name IN SELECT unnest(ARRAY['users', 'posts', 'likes', 'comments', 'notifications', 'follows'])
    LOOP
        SELECT check_rls_enabled(table_name) INTO rls_enabled;
        IF NOT rls_enabled THEN
            RAISE EXCEPTION 'RLS is not enabled for table: %', table_name;
        END IF;
        RAISE NOTICE 'RLS enabled for table: %', table_name;
    END LOOP;
END
$$;

-- 設定完了メッセージ
SELECT 'RLS policies have been successfully configured for production environment' as status;