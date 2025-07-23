-- データベース最適化とインデックス管理
-- パフォーマンス向上のためのSQL設定

-- ==============================
-- パフォーマンス監視関数
-- ==============================

-- 遅いクエリを特定する関数
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE(
    query text,
    calls bigint,
    total_time double precision,
    mean_time double precision,
    rows bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE mean_time > 100  -- 100ms以上のクエリ
ORDER BY mean_time DESC
LIMIT 20;
$$;

-- テーブルサイズとインデックス使用状況を確認
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
    table_name text,
    table_size text,
    index_size text,
    total_size text,
    seq_scan bigint,
    idx_scan bigint,
    n_tup_ins bigint,
    n_tup_upd bigint,
    n_tup_del bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT 
    schemaname||'.'||tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) + pg_indexes_size(schemaname||'.'||tablename)) as total_size,
    seq_scan,
    idx_scan,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
$$;

-- 使用されていないインデックスを特定
CREATE OR REPLACE FUNCTION get_unused_indexes()
RETURNS TABLE(
    schema_name text,
    table_name text,
    index_name text,
    index_size text,
    idx_scan bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT 
    schemaname as schema_name,
    tablename as table_name,
    indexname as index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 
    AND NOT indexname LIKE '%_pkey'  -- 主キーは除外
ORDER BY pg_relation_size(indexrelid) DESC;
$$;

-- ==============================
-- パフォーマンス向上インデックス
-- ==============================

-- Posts テーブル最適化
-- 日付範囲検索用（最新投稿取得）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_created_at_desc 
ON posts (created_at DESC);

-- ユーザー別投稿検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_user_id_created_at 
ON posts (user_id, created_at DESC) WHERE NOT is_anonymous;

-- 匿名投稿検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_anonymous_created_at 
ON posts (created_at DESC) WHERE is_anonymous = true;

-- 全文検索用インデックス（日本語対応）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_gin 
ON posts USING gin(to_tsvector('japanese', content));

-- Likes テーブル最適化
-- ユーザーのいいね履歴用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_user_id_created_at 
ON likes (user_id, created_at DESC);

-- 投稿別いいね数集計用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_post_id_created_at 
ON likes (post_id, created_at);

-- 重複いいね防止用（ユニーク制約）
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_unique_user_post 
ON likes (user_id, post_id);

-- Comments テーブル最適化
-- 投稿別コメント取得用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_id_created_at 
ON comments (post_id, created_at ASC);

-- ユーザー別コメント履歴用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_user_id_created_at 
ON comments (user_id, created_at DESC);

-- Notifications テーブル最適化
-- 未読通知取得用（最重要）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread_created 
ON notifications (user_id, created_at DESC) WHERE is_read = false;

-- 通知タイプ別検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type_created 
ON notifications (user_id, type, created_at DESC);

-- Follows テーブル最適化
-- フォロワー一覧取得用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_followed_created 
ON follows (followed_id, created_at DESC);

-- フォロー一覧取得用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_created 
ON follows (follower_id, created_at DESC);

-- 重複フォロー防止用
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_unique 
ON follows (follower_id, followed_id);

-- Users テーブル最適化
-- ニックネーム検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_nickname_gin 
ON users USING gin(nickname gin_trgm_ops);

-- アクティブユーザー検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_updated_at 
ON users (updated_at DESC);

-- ==============================
-- パフォーマンス最適化設定
-- ==============================

-- 統計情報の自動更新設定
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'all';

-- クエリプランナー設定
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD用に最適化
ALTER SYSTEM SET effective_cache_size = '1GB';  -- 使用可能メモリに応じて調整

-- ログ設定（遅いクエリをログ出力）
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 1秒以上のクエリをログ
ALTER SYSTEM SET log_statement = 'mod';  -- INSERT/UPDATE/DELETEをログ

-- ==============================
-- 集計用マテリアライズドビュー
-- ==============================

-- 投稿統計ビュー
CREATE MATERIALIZED VIEW IF NOT EXISTS post_stats AS
SELECT 
    p.id as post_id,
    p.user_id,
    p.created_at,
    COUNT(DISTINCT l.id) as likes_count,
    COUNT(DISTINCT c.id) as comments_count,
    MAX(COALESCE(l.created_at, c.created_at)) as last_activity
FROM posts p
LEFT JOIN likes l ON p.id = l.post_id
LEFT JOIN comments c ON p.id = c.post_id
GROUP BY p.id, p.user_id, p.created_at;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_post_stats_post_id ON post_stats (post_id);
CREATE INDEX IF NOT EXISTS idx_post_stats_user_id ON post_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_post_stats_activity ON post_stats (last_activity DESC);

-- ユーザー統計ビュー
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.id as user_id,
    u.nickname,
    u.created_at,
    COUNT(DISTINCT p.id) as posts_count,
    COUNT(DISTINCT l.id) as likes_given,
    COUNT(DISTINCT f1.followed_id) as following_count,
    COUNT(DISTINCT f2.follower_id) as followers_count,
    MAX(p.created_at) as last_post_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id AND NOT p.is_anonymous
LEFT JOIN likes l ON u.id = l.user_id
LEFT JOIN follows f1 ON u.id = f1.follower_id
LEFT JOIN follows f2 ON u.id = f2.followed_id
GROUP BY u.id, u.nickname, u.created_at;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_posts_count ON user_stats (posts_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_followers ON user_stats (followers_count DESC);

-- ==============================
-- 自動統計更新関数
-- ==============================

-- マテリアライズドビュー更新関数
CREATE OR REPLACE FUNCTION refresh_stats_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 投稿統計を更新
    REFRESH MATERIALIZED VIEW CONCURRENTLY post_stats;
    
    -- ユーザー統計を更新
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
    
    -- 統計情報を更新
    ANALYZE posts;
    ANALYZE likes;
    ANALYZE comments;
    ANALYZE users;
    ANALYZE notifications;
    ANALYZE follows;
    
    RAISE NOTICE 'Statistics views refreshed successfully';
END;
$$;

-- 定期実行用（15分ごと）
SELECT cron.schedule(
    'refresh-stats',
    '*/15 * * * *',  -- 15分ごと
    'SELECT refresh_stats_views();'
);

-- ==============================
-- パフォーマンス監視トリガー
-- ==============================

-- 大量データ操作を監視する関数
CREATE OR REPLACE FUNCTION monitor_large_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    operation_size integer;
BEGIN
    -- INSERT/UPDATE/DELETEの対象行数をカウント
    GET DIAGNOSTICS operation_size = ROW_COUNT;
    
    -- 1000行以上の操作をログに記録
    IF operation_size > 1000 THEN
        RAISE NOTICE 'Large operation detected: % rows affected in table %', 
            operation_size, TG_TABLE_NAME;
    END IF;
    
    RETURN NULL;
END;
$$;

-- 各テーブルにトリガーを設定
CREATE TRIGGER monitor_posts_operations
    AFTER INSERT OR UPDATE OR DELETE ON posts
    FOR EACH STATEMENT
    EXECUTE FUNCTION monitor_large_operations();

CREATE TRIGGER monitor_likes_operations
    AFTER INSERT OR DELETE ON likes
    FOR EACH STATEMENT
    EXECUTE FUNCTION monitor_large_operations();

-- ==============================
-- データベース保守関数
-- ==============================

-- テーブル保守（VACUUM、REINDEX）を実行
CREATE OR REPLACE FUNCTION maintain_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_record record;
BEGIN
    -- 主要テーブルのVACUUM ANALYZE
    FOR table_record IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'posts', 'likes', 'comments', 'notifications', 'follows')
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || table_record.tablename;
        RAISE NOTICE 'Vacuumed table: %', table_record.tablename;
    END LOOP;
    
    -- 統計情報の更新
    ANALYZE;
    
    RAISE NOTICE 'Database maintenance completed';
END;
$$;

-- ==============================
-- パフォーマンスレポート関数
-- ==============================

-- 包括的なパフォーマンスレポートを生成
CREATE OR REPLACE FUNCTION generate_performance_report()
RETURNS TABLE(
    category text,
    metric text,
    value text,
    status text,
    recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    db_size bigint;
    slow_queries_count bigint;
    unused_indexes_count bigint;
    cache_hit_ratio numeric;
BEGIN
    -- データベースサイズ
    SELECT pg_database_size(current_database()) INTO db_size;
    
    -- 遅いクエリの数
    SELECT COUNT(*) INTO slow_queries_count
    FROM pg_stat_statements 
    WHERE mean_time > 100;
    
    -- 使用されていないインデックスの数
    SELECT COUNT(*) INTO unused_indexes_count
    FROM pg_stat_user_indexes 
    WHERE idx_scan = 0 AND NOT indexname LIKE '%_pkey';
    
    -- キャッシュヒット率
    SELECT 
        round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2)
    INTO cache_hit_ratio
    FROM pg_stat_database
    WHERE datname = current_database();
    
    -- レポート生成
    RETURN QUERY VALUES
        ('Database', 'Size', pg_size_pretty(db_size), 
         CASE WHEN db_size < 1000000000 THEN 'Good' ELSE 'Warning' END,
         'Monitor growth and consider archiving old data'),
        
        ('Queries', 'Slow Queries', slow_queries_count::text,
         CASE WHEN slow_queries_count < 10 THEN 'Good' ELSE 'Warning' END,
         'Review and optimize slow queries'),
        
        ('Indexes', 'Unused Indexes', unused_indexes_count::text,
         CASE WHEN unused_indexes_count < 5 THEN 'Good' ELSE 'Warning' END,
         'Consider dropping unused indexes'),
        
        ('Cache', 'Hit Ratio', cache_hit_ratio::text || '%',
         CASE WHEN cache_hit_ratio > 95 THEN 'Excellent' 
              WHEN cache_hit_ratio > 90 THEN 'Good' 
              ELSE 'Poor' END,
         'Increase shared_buffers if hit ratio is low');
END;
$$;

-- ==============================
-- 本番環境用設定確認
-- ==============================

-- 設定確認用ビュー
CREATE OR REPLACE VIEW production_config_check AS
SELECT 
    name,
    setting,
    CASE 
        WHEN name = 'shared_buffers' AND setting::numeric < 134217728 THEN 'Increase to at least 128MB'
        WHEN name = 'effective_cache_size' AND setting::numeric < 1073741824 THEN 'Increase to at least 1GB'
        WHEN name = 'random_page_cost' AND setting::numeric > 2.0 THEN 'Decrease to 1.1 for SSD'
        WHEN name = 'log_min_duration_statement' AND setting = '-1' THEN 'Enable slow query logging'
        ELSE 'OK'
    END as recommendation
FROM pg_settings 
WHERE name IN (
    'shared_buffers',
    'effective_cache_size', 
    'random_page_cost',
    'log_min_duration_statement',
    'track_activities',
    'track_counts'
);

-- 最終確認メッセージ
SELECT 'Database optimization completed. Run generate_performance_report() to check status.' as message;