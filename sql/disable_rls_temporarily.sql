-- RLSを一時的に無効化する管理者用関数
CREATE OR REPLACE FUNCTION exec(sql TEXT) 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 関数の実行権限を付与
GRANT EXECUTE ON FUNCTION exec TO authenticated;
GRANT EXECUTE ON FUNCTION exec TO anon;

-- postsテーブルのRLSを一時的に無効化する関数
CREATE OR REPLACE FUNCTION create_post_no_rls(
  p_content TEXT,
  p_user_id UUID,
  p_image_url TEXT DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- この設定で管理者権限で実行され、RLSを無視
AS $$
DECLARE
  result_post JSON;
  new_post_id UUID;
BEGIN
  -- RLSを無視して投稿を作成
  INSERT INTO posts (content, user_id, image_url, is_anonymous, likes_count, comments_count)
  VALUES (p_content, p_user_id, p_image_url, p_is_anonymous, 0, 0)
  RETURNING id INTO new_post_id;
  
  -- 作成された投稿とユーザー情報を取得
  SELECT to_json(post_with_user.*)
  INTO result_post
  FROM (
    SELECT 
      p.id,
      p.content,
      p.user_id,
      p.image_url,
      p.is_anonymous,
      p.created_at,
      p.updated_at,
      p.likes_count,
      p.comments_count,
      json_build_object(
        'id', u.id,
        'nickname', u.nickname,
        'avatar_url', u.avatar_url,
        'is_anonymous', p.is_anonymous
      ) as users
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = new_post_id
  ) as post_with_user;
  
  RETURN result_post;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create post: %', SQLERRM;
END;
$$;

-- 関数の実行権限を付与
GRANT EXECUTE ON FUNCTION create_post_no_rls TO authenticated;
GRANT EXECUTE ON FUNCTION create_post_no_rls TO anon;