-- フォローテーブルとRPC関数の作成
-- 実行方法: Supabase SQL Editorでこのスクリプトを実行

-- 1. フォローテーブルの作成
CREATE TABLE IF NOT EXISTS follows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    -- 制約: 同じユーザーペアは1回のみフォロー可能
    CONSTRAINT unique_follow_relationship UNIQUE (follower_id, following_id),
    -- 制約: 自分自身をフォローできない
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- 2. インデックスの作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at);

-- 3. RLSポリシーの有効化
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- 4. RLSポリシーの作成
-- フォロー関係の表示: 自分が関わるフォロー関係のみ表示
CREATE POLICY "Users can view follow relationships involving them" ON follows
    FOR SELECT USING (
        follower_id = auth.uid() OR 
        following_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND (
                follower_id IN (SELECT id FROM users WHERE is_anonymous = false) OR
                following_id IN (SELECT id FROM users WHERE is_anonymous = false)
            )
        )
    );

-- フォロー関係の作成: 認証されたユーザーのみが自分のフォロー関係を作成可能
CREATE POLICY "Users can create their own follow relationships" ON follows
    FOR INSERT WITH CHECK (
        follower_id = auth.uid() AND
        follower_id != following_id
    );

-- フォロー関係の削除: 自分のフォロー関係のみ削除可能
CREATE POLICY "Users can delete their own follow relationships" ON follows
    FOR DELETE USING (follower_id = auth.uid());

-- 5. updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_follows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_follows_updated_at_trigger
    BEFORE UPDATE ON follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follows_updated_at();

-- 6. フォロー関係取得のRPC関数
CREATE OR REPLACE FUNCTION get_follow_relationship(
    p_user_id uuid,
    p_target_user_id uuid
)
RETURNS TABLE (
    is_following boolean,
    is_followed_by boolean,
    followed_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = p_user_id 
            AND following_id = p_target_user_id
        ) as is_following,
        EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = p_target_user_id 
            AND following_id = p_user_id
        ) as is_followed_by,
        (
            SELECT created_at FROM follows 
            WHERE follower_id = p_user_id 
            AND following_id = p_target_user_id
            LIMIT 1
        ) as followed_at;
END;
$$;

-- 7. ユーザー統計情報取得のRPC関数
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
RETURNS TABLE (
    posts_count bigint,
    followers_count bigint,
    following_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM posts WHERE user_id = p_user_id) as posts_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = p_user_id) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = p_user_id) as following_count;
END;
$$;

-- 8. フォロワー一覧取得のRPC関数（詳細情報付き）
CREATE OR REPLACE FUNCTION get_followers_with_details(
    p_user_id uuid,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    user_id uuid,
    nickname text,
    avatar_url text,
    bio text,
    followers_count bigint,
    following_count bigint,
    is_following boolean,
    is_followed_by boolean,
    followed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.nickname,
        u.avatar_url,
        u.bio,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
        EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = auth.uid() 
            AND following_id = u.id
        ) as is_following,
        true as is_followed_by, -- このユーザーは現在のユーザーをフォローしている
        f.created_at as followed_at
    FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = p_user_id
    ORDER BY f.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 9. フォロー中一覧取得のRPC関数（詳細情報付き）
CREATE OR REPLACE FUNCTION get_following_with_details(
    p_user_id uuid,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    user_id uuid,
    nickname text,
    avatar_url text,
    bio text,
    followers_count bigint,
    following_count bigint,
    is_following boolean,
    is_followed_by boolean,
    followed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.nickname,
        u.avatar_url,
        u.bio,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
        true as is_following, -- このユーザーを現在のユーザーがフォローしている
        EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = u.id 
            AND following_id = auth.uid()
        ) as is_followed_by,
        f.created_at as followed_at
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = p_user_id
    ORDER BY f.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 10. フォロー推奨ユーザー取得のRPC関数
CREATE OR REPLACE FUNCTION get_follow_suggestions(
    p_user_id uuid,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    user_id uuid,
    nickname text,
    avatar_url text,
    bio text,
    followers_count bigint,
    following_count bigint,
    mutual_followers_count bigint,
    score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH current_following AS (
        SELECT following_id FROM follows WHERE follower_id = p_user_id
    ),
    mutual_followers AS (
        SELECT 
            u.id,
            COUNT(DISTINCT f2.follower_id) as mutual_count
        FROM users u
        LEFT JOIN follows f1 ON u.id = f1.following_id
        LEFT JOIN follows f2 ON f1.follower_id = f2.follower_id
        LEFT JOIN current_following cf ON f2.following_id = cf.following_id
        WHERE u.id != p_user_id
        AND u.id NOT IN (SELECT following_id FROM current_following)
        GROUP BY u.id
    )
    SELECT 
        u.id as user_id,
        u.nickname,
        u.avatar_url,
        u.bio,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
        COALESCE(mf.mutual_count, 0) as mutual_followers_count,
        (
            CASE 
                WHEN COALESCE(mf.mutual_count, 0) > 0 THEN COALESCE(mf.mutual_count, 0) * 10
                ELSE (SELECT COUNT(*) FROM follows WHERE following_id = u.id) / 10
            END
        )::integer as score
    FROM users u
    LEFT JOIN mutual_followers mf ON u.id = mf.id
    WHERE u.id != p_user_id
    AND u.id NOT IN (SELECT following_id FROM current_following)
    ORDER BY score DESC, u.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 完了メッセージ
SELECT 'フォローテーブルとRPC関数の作成が完了しました' as message;