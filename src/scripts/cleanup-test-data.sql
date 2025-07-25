-- ===============================
-- テストデータクリーンアップスクリプト
-- ===============================
-- 実行前に必ずバックアップを取得してください！
-- このスクリプトは開発環境のテストデータを削除します

-- 1. 削除前のデータ数確認
DO $$
BEGIN
  RAISE NOTICE '=== 削除前のデータ数 ===';
  RAISE NOTICE 'users: %', (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'posts: %', (SELECT COUNT(*) FROM posts);
  RAISE NOTICE 'likes: %', (SELECT COUNT(*) FROM likes);
  RAISE NOTICE 'comments: %', (SELECT COUNT(*) FROM comments);
  RAISE NOTICE 'notifications: %', (SELECT COUNT(*) FROM notifications);
  RAISE NOTICE 'follows: %', (SELECT COUNT(*) FROM follows);
  RAISE NOTICE 'push_tokens: %', (SELECT COUNT(*) FROM push_tokens);
  RAISE NOTICE 'notification_settings: %', (SELECT COUNT(*) FROM notification_settings);
  RAISE NOTICE 'image_uploads: %', (SELECT COUNT(*) FROM image_uploads);
END $$;

-- 2. テストデータの削除（外部キー制約の順序に注意）
BEGIN;

-- 2.1 通知関連
DELETE FROM notification_settings WHERE created_at < NOW();
DELETE FROM push_tokens WHERE created_at < NOW();
DELETE FROM notifications WHERE created_at < NOW();

-- 2.2 投稿関連（コメント→いいね→投稿の順）
DELETE FROM comments WHERE created_at < NOW();
DELETE FROM likes WHERE created_at < NOW();
DELETE FROM posts WHERE created_at < NOW();

-- 2.3 フォロー関係
DELETE FROM follows WHERE created_at < NOW();

-- 2.4 画像アップロード
DELETE FROM image_uploads WHERE created_at < NOW();

-- 2.5 ユーザー（最後に削除）
-- 注意：auth.usersと連携している場合は慎重に
DELETE FROM users WHERE created_at < NOW() AND id NOT IN (
  -- 管理者やシステムユーザーを保持する場合はここに追加
  SELECT id FROM users WHERE nickname IN ('admin', 'system')
);

-- 3. 削除後のデータ数確認
DO $$
BEGIN
  RAISE NOTICE '=== 削除後のデータ数 ===';
  RAISE NOTICE 'users: %', (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'posts: %', (SELECT COUNT(*) FROM posts);
  RAISE NOTICE 'likes: %', (SELECT COUNT(*) FROM likes);
  RAISE NOTICE 'comments: %', (SELECT COUNT(*) FROM comments);
  RAISE NOTICE 'notifications: %', (SELECT COUNT(*) FROM notifications);
  RAISE NOTICE 'follows: %', (SELECT COUNT(*) FROM follows);
  RAISE NOTICE 'push_tokens: %', (SELECT COUNT(*) FROM push_tokens);
  RAISE NOTICE 'notification_settings: %', (SELECT COUNT(*) FROM notification_settings);
  RAISE NOTICE 'image_uploads: %', (SELECT COUNT(*) FROM image_uploads);
END $$;

-- 4. シーケンスのリセット（オプション）
-- IDカウンターをリセットする場合はコメントアウトを解除
-- ALTER SEQUENCE users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE posts_id_seq RESTART WITH 1;

-- トランザクションをコミット
COMMIT;

-- 5. VACUUM実行（データベースの最適化）
VACUUM ANALYZE;