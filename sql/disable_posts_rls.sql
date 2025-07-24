-- postsテーブルのRLSを完全に無効化
-- カスタム認証の問題を解決するための一時的な措置

-- Step 1: postsテーブルのRLSを無効化
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;

-- Step 2: 既存のRLSポリシーをすべて削除
DROP POLICY IF EXISTS "posts_insert_policy" ON posts;
DROP POLICY IF EXISTS "posts_select_policy" ON posts;
DROP POLICY IF EXISTS "posts_update_policy" ON posts;
DROP POLICY IF EXISTS "posts_delete_policy" ON posts;

-- Step 3: likesとcommentsテーブルも同様に処理（必要に応じて）
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- 既存のlikesポリシーを削除
DROP POLICY IF EXISTS "likes_insert_policy" ON likes;
DROP POLICY IF EXISTS "likes_select_policy" ON likes;
DROP POLICY IF EXISTS "likes_delete_policy" ON likes;

-- 既存のcommentsポリシーを削除
DROP POLICY IF EXISTS "comments_insert_policy" ON comments;
DROP POLICY IF EXISTS "comments_select_policy" ON comments;
DROP POLICY IF EXISTS "comments_update_policy" ON comments;
DROP POLICY IF EXISTS "comments_delete_policy" ON comments;

-- 確認用のクエリ（実行後に状態を確認）
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('posts', 'likes', 'comments');