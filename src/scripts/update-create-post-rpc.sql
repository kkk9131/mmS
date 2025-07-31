-- create_post_custom_auth関数を更新して複数画像をサポート
CREATE OR REPLACE FUNCTION create_post_custom_auth(
  p_content TEXT,
  p_user_id UUID,
  p_image_url TEXT DEFAULT NULL,
  p_images TEXT[] DEFAULT NULL,  -- 複数画像配列パラメータを追加
  p_is_anonymous BOOLEAN DEFAULT FALSE
)
RETURNS posts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_post posts;
BEGIN
  -- ユーザーの存在確認
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- 投稿を作成（imagesフィールドも含める）
  INSERT INTO posts (
    content,
    user_id,
    image_url,
    images,  -- 複数画像フィールドを追加
    is_anonymous,
    created_at,
    updated_at
  ) VALUES (
    p_content,
    p_user_id,
    p_image_url,
    p_images,  -- 複数画像配列を保存
    p_is_anonymous,
    NOW(),
    NOW()
  ) RETURNING * INTO new_post;

  RETURN new_post;
END;
$$;

-- 関数に実行権限を付与
GRANT EXECUTE ON FUNCTION create_post_custom_auth TO anon, authenticated;