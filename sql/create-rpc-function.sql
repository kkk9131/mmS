-- mamapace用RPC関数作成
-- Supabaseダッシュボードの SQL Editor で実行してください

-- 1. 既存の関数を削除（存在する場合）
DROP FUNCTION IF EXISTS get_posts_with_like_status(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_posts_with_like_status(INTEGER, INTEGER, UUID);

-- 2. RPC関数を作成
CREATE OR REPLACE FUNCTION get_posts_with_like_status(
  req_user_id UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  image_url TEXT,
  images TEXT[],
  is_anonymous BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  is_liked_by_user BOOLEAN,
  is_commented_by_user BOOLEAN,
  user_nickname TEXT,
  user_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.content,
    p.image_url,
    p.images,
    p.is_anonymous,
    p.created_at,
    p.updated_at,
    p.likes_count,
    p.comments_count,
    CASE 
      WHEN req_user_id IS NULL THEN FALSE
      ELSE COALESCE(
        (SELECT TRUE FROM likes l WHERE l.post_id = p.id AND l.user_id = req_user_id LIMIT 1),
        FALSE
      )
    END as is_liked_by_user,
    CASE 
      WHEN req_user_id IS NULL THEN FALSE
      ELSE COALESCE(
        (SELECT TRUE FROM comments c WHERE c.post_id = p.id AND c.user_id = req_user_id LIMIT 1),
        FALSE
      )
    END as is_commented_by_user,
    u.nickname as user_nickname,
    u.avatar_url as user_avatar_url
  FROM posts p
  INNER JOIN users u ON p.user_id = u.id
  ORDER BY p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 3. 権限付与
GRANT EXECUTE ON FUNCTION get_posts_with_like_status TO anon;
GRANT EXECUTE ON FUNCTION get_posts_with_like_status TO authenticated;

-- 4. テスト実行
SELECT 'RPC関数作成完了' as status;
SELECT * FROM get_posts_with_like_status(null, 5, 0);