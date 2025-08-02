-- TODO機能実装のためのデータベーススキーマ更新
-- 作成日: 2025-08-02

-- 1. エラーレポートテーブル
CREATE TABLE IF NOT EXISTS error_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  error_message TEXT NOT NULL,
  error_name TEXT NOT NULL,
  stack_trace TEXT,
  app_version TEXT,
  platform TEXT,
  additional_context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- エラーレポートのインデックス
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_created_at ON error_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_severity ON error_reports(severity);
CREATE INDEX IF NOT EXISTS idx_error_reports_resolved ON error_reports(resolved_at) WHERE resolved_at IS NOT NULL;

-- エラーレポートのRLS
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;

-- 管理者のみ全てのエラーレポートを閲覧可能
CREATE POLICY "Admin can view all error reports" ON error_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- ユーザーは自分のエラーレポートのみ閲覧可能
CREATE POLICY "Users can view own error reports" ON error_reports
  FOR SELECT USING (user_id = auth.uid());

-- システムによるエラーレポート作成を許可
CREATE POLICY "System can create error reports" ON error_reports
  FOR INSERT WITH CHECK (true);

-- 2. 通知キューテーブル（おやすみモード機能用）
CREATE TABLE IF NOT EXISTS notification_queue (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 通知キューのインデックス
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_sent ON notification_queue(sent);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(type);

-- 通知キューのRLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の通知キューのみ閲覧可能
CREATE POLICY "Users can view own notification queue" ON notification_queue
  FOR SELECT USING (user_id = auth.uid());

-- システムによる通知キューの作成・更新を許可
CREATE POLICY "System can manage notification queue" ON notification_queue
  FOR ALL USING (true);

-- 3. notification_settingsテーブルの拡張（おやすみモード設定）
DO $$
BEGIN
  -- おやすみモード関連のカラムを追加（既に存在する場合はスキップ）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_settings' 
                 AND column_name = 'quiet_hours_enabled') THEN
    ALTER TABLE notification_settings 
    ADD COLUMN quiet_hours_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_settings' 
                 AND column_name = 'quiet_hours_start') THEN
    ALTER TABLE notification_settings 
    ADD COLUMN quiet_hours_start TEXT DEFAULT '22:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notification_settings' 
                 AND column_name = 'quiet_hours_end') THEN
    ALTER TABLE notification_settings 
    ADD COLUMN quiet_hours_end TEXT DEFAULT '07:00';
  END IF;
END $$;

-- 4. パフォーマンス最適化のための関数
-- ユーザーのいいね・コメント状態を効率的に取得する関数
CREATE OR REPLACE FUNCTION get_user_post_interactions(
  p_user_id UUID,
  p_post_ids UUID[]
) RETURNS TABLE (
  post_id UUID,
  is_liked BOOLEAN,
  is_commented BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as post_id,
    EXISTS(
      SELECT 1 FROM likes l 
      WHERE l.post_id = p.id AND l.user_id = p_user_id
    ) as is_liked,
    EXISTS(
      SELECT 1 FROM comments c 
      WHERE c.post_id = p.id AND c.user_id = p_user_id
    ) as is_commented
  FROM unnest(p_post_ids) p(id);
END;
$$;

-- 5. クリーンアップ用の関数
-- 古いエラーレポートを削除する関数
CREATE OR REPLACE FUNCTION cleanup_old_error_reports(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM error_reports 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep
    AND (resolved_at IS NOT NULL OR severity IN ('low', 'medium'));
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- 送信済みの古い通知キューを削除する関数
CREATE OR REPLACE FUNCTION cleanup_old_notification_queue(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notification_queue 
  WHERE sent = true 
    AND sent_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- 6. トリガー関数（必要に応じて）
-- 通知キューの自動クリーンアップトリガー
CREATE OR REPLACE FUNCTION trigger_cleanup_notification_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 100件挿入されるごとにクリーンアップを実行
  IF (SELECT COUNT(*) FROM notification_queue WHERE sent = true) > 100 THEN
    PERFORM cleanup_old_notification_queue(7);
  END IF;
  
  RETURN NEW;
END;
$$;

-- トリガーが存在しない場合のみ作成
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_cleanup_notification_queue') THEN
    CREATE TRIGGER auto_cleanup_notification_queue
      AFTER INSERT ON notification_queue
      FOR EACH STATEMENT
      EXECUTE FUNCTION trigger_cleanup_notification_queue();
  END IF;
END $$;

-- 7. 権限設定
-- 匿名ユーザーはエラーレポートを作成可能（クラッシュレポート用）
GRANT INSERT ON error_reports TO anon;
GRANT USAGE ON SEQUENCE error_reports_id_seq TO anon;

-- 認証ユーザーは自分のデータを操作可能
GRANT SELECT, INSERT, UPDATE ON notification_queue TO authenticated;
GRANT SELECT ON error_reports TO authenticated;

-- コメント
COMMENT ON TABLE error_reports IS 'アプリケーションエラーレポートの保存';
COMMENT ON TABLE notification_queue IS 'おやすみモード中の通知キュー';
COMMENT ON FUNCTION get_user_post_interactions IS 'ユーザーの投稿に対するインタラクション状態を効率的に取得';
COMMENT ON FUNCTION cleanup_old_error_reports IS '古いエラーレポートを削除してストレージを節約';
COMMENT ON FUNCTION cleanup_old_notification_queue IS '古い通知キューエントリを削除';