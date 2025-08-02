-- mamapace開発環境用：RLS無効化とサンプルデータ作成
-- 注意: 本番環境では絶対に実行しないでください

-- 1. 一時的にRLSポリシーを無効化（開発環境のみ）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;

-- 2. 既存データの削除（必要に応じて）
-- DELETE FROM likes;
-- DELETE FROM comments;
-- DELETE FROM posts;
-- DELETE FROM users;

-- 3. サンプルユーザーデータ挿入
INSERT INTO users (id, nickname, maternal_book_number, avatar_url, created_at) VALUES 
  ('f7a3031d-c8a6-4d21-8432-e9b0de4ec325', '田中ママ', 'MB001', 'https://via.placeholder.com/100/ff6b9d/ffffff?text=田中', '2024-01-15T00:00:00Z'),
  ('2771613f-c8d5-4bbd-9011-9f557793dfe3', '佐藤ママ', 'MB002', 'https://via.placeholder.com/100/4a9eff/ffffff?text=佐藤', '2024-01-20T00:00:00Z'),
  ('a21547da-56e3-4088-beaa-9aecc528df38', '鈴木ママ', 'MB003', 'https://via.placeholder.com/100/28a745/ffffff?text=鈴木', '2024-01-25T00:00:00Z'),
  ('d1234567-1234-4567-8901-123456789012', '高橋ママ', 'MB004', 'https://via.placeholder.com/100/ffc107/ffffff?text=高橋', '2024-02-01T00:00:00Z'),
  ('e2345678-2345-5678-9012-234567890123', '山田ママ', 'MB005', 'https://via.placeholder.com/100/17a2b8/ffffff?text=山田', '2024-02-05T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  nickname = EXCLUDED.nickname,
  maternal_book_number = EXCLUDED.maternal_book_number,
  avatar_url = EXCLUDED.avatar_url;

-- 4. サンプル投稿データ挿入
INSERT INTO posts (id, user_id, content, image_url, images, is_anonymous, likes_count, comments_count, created_at) VALUES 
  (
    'c95eb40b-e706-43ef-b4ec-ffc678c58ee8', 
    'f7a3031d-c8a6-4d21-8432-e9b0de4ec325',
    '今日は子供と公園に行きました！桜が咲き始めていて、とても綺麗でした。子供も大喜びで走り回っていました。ママ友と会えて楽しい時間を過ごせました。🌸',
    'https://via.placeholder.com/400x300/ff6b9d/ffffff?text=公園の写真',
    ARRAY['https://via.placeholder.com/400x300/ff6b9d/ffffff?text=公園の写真'],
    false,
    8,
    3,
    '2024-02-10T10:30:00Z'
  ),
  (
    'b5f1106d-a539-447e-9346-e3afb0657b34',
    '2771613f-c8d5-4bbd-9011-9f557793dfe3',
    '離乳食作りに挑戦中です。今日はかぼちゃのペーストを作りました。思ったより簡単で、子供もよく食べてくれました！明日は人参も試してみようと思います。',
    'https://via.placeholder.com/400x300/4a9eff/ffffff?text=離乳食',
    ARRAY['https://via.placeholder.com/400x300/4a9eff/ffffff?text=離乳食'],
    false,
    12,
    5,
    '2024-02-09T15:45:00Z'
  ),
  (
    'c4ac35c0-fb94-400f-ba4e-1cd874bac7c8',
    'a21547da-56e3-4088-beaa-9aecc528df38',
    'イヤイヤ期に入りました😅 朝の着替えだけで30分かかります。でも成長の証拠だと思って、気長に付き合おうと思います。同じ経験をされた方、アドバイスください！',
    NULL,
    NULL,
    false,
    15,
    8,
    '2024-02-08T08:20:00Z'
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    'd1234567-1234-4567-8901-123456789012',
    '保育園の入園準備が大変です💦 名前付けが終わらない...。明日から新学期なのに、まだやることがたくさん。みなさんはどうやって効率よく準備されましたか？',
    NULL,
    NULL,
    false,
    6,
    4,
    '2024-02-07T20:15:00Z'
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    'e2345678-2345-5678-9012-234567890123',
    'ママ友とランチしてきました♪ 久しぶりに子育ての話以外もできて、とてもリフレッシュできました。やっぱり大人の時間も大切ですね。子供は実家でお昼寝中です😊',
    'https://via.placeholder.com/400x300/17a2b8/ffffff?text=ランチ',
    ARRAY['https://via.placeholder.com/400x300/17a2b8/ffffff?text=ランチ'],
    false,
    10,
    2,
    '2024-02-06T14:30:00Z'
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    'f7a3031d-c8a6-4d21-8432-e9b0de4ec325',
    '子供の寝かしつけに苦労しています。なかなか寝てくれなくて、毎日夜が大変です。何か良い方法があれば教えてください🙏',
    NULL,
    NULL,
    false,
    18,
    12,
    '2024-02-05T21:00:00Z'
  )
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  image_url = EXCLUDED.image_url,
  images = EXCLUDED.images,
  likes_count = EXCLUDED.likes_count,
  comments_count = EXCLUDED.comments_count;

-- 5. サンプルコメントデータ挿入
INSERT INTO comments (id, post_id, user_id, content, is_anonymous, created_at) VALUES 
  ('comment-001', 'c95eb40b-e706-43ef-b4ec-ffc678c58ee8', '2771613f-c8d5-4bbd-9011-9f557793dfe3', '素敵な写真ですね！うちも今度公園に行ってみます。', false, '2024-02-10T11:15:00Z'),
  ('comment-002', 'c95eb40b-e706-43ef-b4ec-ffc678c58ee8', 'a21547da-56e3-4088-beaa-9aecc528df38', '桜の季節は特別ですよね🌸 子供と一緒だと余計に楽しいです。', false, '2024-02-10T12:30:00Z'),
  ('comment-003', 'b5f1106d-a539-447e-9346-e3afb0657b34', 'f7a3031d-c8a6-4d21-8432-e9b0de4ec325', '離乳食作り、お疲れさまです！かぼちゃは栄養価も高くて良いですね。', false, '2024-02-09T16:20:00Z'),
  ('comment-004', 'c4ac35c0-fb94-400f-ba4e-1cd874bac7c8', 'd1234567-1234-4567-8901-123456789012', 'イヤイヤ期、うちも通りました😅 時間に余裕を持つのが一番ですね。', false, '2024-02-08T09:45:00Z'),
  ('comment-005', 'c3333333-3333-4333-8333-333333333333', 'e2345678-2345-5678-9012-234567890123', 'うちは絵本を読んでから寝かしつけています。何冊か試してみてください📚', false, '2024-02-05T21:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- 6. サンプルいいねデータ挿入
INSERT INTO likes (id, post_id, user_id, created_at) VALUES 
  ('like-001', 'c95eb40b-e706-43ef-b4ec-ffc678c58ee8', '2771613f-c8d5-4bbd-9011-9f557793dfe3', '2024-02-10T11:00:00Z'),
  ('like-002', 'c95eb40b-e706-43ef-b4ec-ffc678c58ee8', 'a21547da-56e3-4088-beaa-9aecc528df38', '2024-02-10T12:00:00Z'),
  ('like-003', 'c95eb40b-e706-43ef-b4ec-ffc678c58ee8', 'd1234567-1234-4567-8901-123456789012', '2024-02-10T13:00:00Z'),
  ('like-004', 'b5f1106d-a539-447e-9346-e3afb0657b34', 'f7a3031d-c8a6-4d21-8432-e9b0de4ec325', '2024-02-09T16:00:00Z'),
  ('like-005', 'b5f1106d-a539-447e-9346-e3afb0657b34', 'a21547da-56e3-4088-beaa-9aecc528df38', '2024-02-09T17:00:00Z'),
  ('like-006', 'c4ac35c0-fb94-400f-ba4e-1cd874bac7c8', 'f7a3031d-c8a6-4d21-8432-e9b0de4ec325', '2024-02-08T09:00:00Z'),
  ('like-007', 'c4ac35c0-fb94-400f-ba4e-1cd874bac7c8', '2771613f-c8d5-4bbd-9011-9f557793dfe3', '2024-02-08T10:00:00Z'),
  ('like-008', 'c3333333-3333-4333-8333-333333333333', '2771613f-c8d5-4bbd-9011-9f557793dfe3', '2024-02-05T21:15:00Z'),
  ('like-009', 'c3333333-3333-4333-8333-333333333333', 'a21547da-56e3-4088-beaa-9aecc528df38', '2024-02-05T21:45:00Z'),
  ('like-010', 'c3333333-3333-4333-8333-333333333333', 'd1234567-1234-4567-8901-123456789012', '2024-02-05T22:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 7. データ作成確認
SELECT 'データ作成完了' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as post_count FROM posts;
SELECT COUNT(*) as comment_count FROM comments;
SELECT COUNT(*) as like_count FROM likes;

-- 8. RPC関数の存在確認と作成（まだ存在しない場合）
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

-- 9. RPC関数権限付与
GRANT EXECUTE ON FUNCTION get_posts_with_like_status TO anon;
GRANT EXECUTE ON FUNCTION get_posts_with_like_status TO authenticated;

-- 10. 最終確認クエリ
SELECT 'RPC関数テスト' as test_name;
SELECT COUNT(*) as result_count FROM get_posts_with_like_status(null, 10, 0);

-- 11. 完了メッセージ
SELECT '🎉 mamapaceサンプルデータ作成完了！アプリを起動して確認してください。' as final_message;