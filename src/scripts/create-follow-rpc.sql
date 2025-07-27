-- フォロー機能用のRPC関数を作成
-- RLSポリシーを回避してフォロー関係を管理

-- フォローする関数
CREATE OR REPLACE FUNCTION follow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- 自分自身をフォローできない
  IF p_follower_id = p_following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  
  -- 既にフォローしているかチェック
  IF EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = p_follower_id
    AND following_id = p_following_id
  ) THEN
    RETURN TRUE; -- 既にフォロー済み
  END IF;
  
  -- フォロー関係を作成
  INSERT INTO follows (follower_id, following_id)
  VALUES (p_follower_id, p_following_id);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- フォロー解除する関数
CREATE OR REPLACE FUNCTION unfollow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM follows
  WHERE follower_id = p_follower_id
  AND following_id = p_following_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- フォロー関係を取得する関数
CREATE OR REPLACE FUNCTION get_follow_relationship(
  p_user_id UUID,
  p_target_user_id UUID
) RETURNS TABLE (
  is_following BOOLEAN,
  is_followed_by BOOLEAN,
  followed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = p_user_id
      AND following_id = p_target_user_id
    ) AS is_following,
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = p_target_user_id
      AND following_id = p_user_id
    ) AS is_followed_by,
    (
      SELECT created_at FROM follows
      WHERE follower_id = p_user_id
      AND following_id = p_target_user_id
      LIMIT 1
    ) AS followed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 権限を付与
GRANT EXECUTE ON FUNCTION follow_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unfollow_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_follow_relationship TO anon, authenticated;