-- 認証フローの根本的な修正
-- ユーザビリティテストで特定された問題の解決

-- 1. 簡素化された認証関数（エラーハンドリング改善版）
CREATE OR REPLACE FUNCTION auth_with_maternal_book_improved(
  maternal_book_param TEXT,
  user_nickname_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  access_token TEXT,
  nickname TEXT,
  is_new_user BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_token TEXT;
  v_nickname TEXT;
  v_is_new BOOLEAN;
BEGIN
  -- 入力検証
  IF maternal_book_param IS NULL OR LENGTH(TRIM(maternal_book_param)) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::BOOLEAN,
      '母子手帳番号を入力してください'::TEXT;
    RETURN;
  END IF;

  -- ニックネームの処理（自動生成対応）
  IF user_nickname_param IS NULL OR LENGTH(TRIM(user_nickname_param)) < 2 THEN
    v_nickname := 'ママ' || SUBSTRING(MD5(maternal_book_param) FROM 1 FOR 6);
  ELSE
    v_nickname := TRIM(user_nickname_param);
  END IF;

  -- 既存ユーザーチェック
  SELECT id INTO v_user_id
  FROM users
  WHERE maternal_book_number = maternal_book_param
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- 新規ユーザー作成
    INSERT INTO users (
      maternal_book_number,
      nickname,
      is_anonymous,
      avatar_url
    ) VALUES (
      maternal_book_param,
      v_nickname,
      FALSE,
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_nickname
    )
    RETURNING id INTO v_user_id;
    
    v_is_new := TRUE;
  ELSE
    -- 既存ユーザーの場合、ニックネームを更新（必要に応じて）
    UPDATE users
    SET nickname = v_nickname
    WHERE id = v_user_id AND nickname IS DISTINCT FROM v_nickname;
    
    v_is_new := FALSE;
  END IF;

  -- アクセストークン生成
  v_token := encode(gen_random_bytes(32), 'hex');

  -- 成功レスポンス
  RETURN QUERY SELECT 
    v_user_id,
    v_token,
    v_nickname,
    v_is_new,
    NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- エラーハンドリング
  RETURN QUERY SELECT 
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::BOOLEAN,
    'システムエラーが発生しました。しばらく待ってからお試しください。'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. テスト用の簡易ログイン関数
CREATE OR REPLACE FUNCTION quick_test_login(
  test_user_number INT DEFAULT 1
)
RETURNS TABLE (
  user_id UUID,
  access_token TEXT,
  nickname TEXT
) AS $$
BEGIN
  -- テスト用の事前定義ユーザーでログイン
  RETURN QUERY
  SELECT 
    u.id,
    encode(gen_random_bytes(32), 'hex'),
    u.nickname
  FROM users u
  WHERE u.maternal_book_number = 'TEST_MB_00' || test_user_number::TEXT
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. サンプルデータの作成（改善版）
DO $$
BEGIN
  -- テスト用ユーザーを作成（存在しない場合のみ）
  INSERT INTO users (maternal_book_number, nickname, is_anonymous, avatar_url)
  VALUES 
    ('TEST_MB_001', 'テストママ1', false, 'https://api.dicebear.com/7.x/avataaars/svg?seed=testmama1'),
    ('TEST_MB_002', 'テストママ2', false, 'https://api.dicebear.com/7.x/avataaars/svg?seed=testmama2'),
    ('TEST_MB_003', 'テストママ3', false, 'https://api.dicebear.com/7.x/avataaars/svg?seed=testmama3'),
    ('DEMO_USER', 'デモユーザー', false, 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo')
  ON CONFLICT (maternal_book_number) DO NOTHING;

  -- サンプル投稿を作成
  INSERT INTO posts (user_id, content, is_anonymous)
  SELECT 
    u.id,
    'これはテスト投稿です。ユーザビリティテスト用のサンプルコンテンツです。',
    false
  FROM users u
  WHERE u.maternal_book_number IN ('TEST_MB_001', 'TEST_MB_002', 'DEMO_USER')
  AND NOT EXISTS (
    SELECT 1 FROM posts p WHERE p.user_id = u.id
  );
END $$;

-- 4. パフォーマンス改善のためのインデックス
CREATE INDEX IF NOT EXISTS idx_users_maternal_book ON users(maternal_book_number);
CREATE INDEX IF NOT EXISTS idx_posts_created_user ON posts(created_at DESC, user_id);

-- 5. RLSポリシーの簡素化（テスト環境用）
-- 注意: 本番環境では適切なセキュリティポリシーを使用してください
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 読み取り許可（全ユーザー）
CREATE POLICY "posts_read_all" ON posts
  FOR SELECT
  USING (true);

-- 作成許可（認証済みユーザー）
CREATE POLICY "posts_create_auth" ON posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 更新・削除許可（投稿者のみ）
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE
  USING (user_id = auth.uid());