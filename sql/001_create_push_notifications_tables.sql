-- プッシュ通知システム用のテーブル作成

-- 通知タイプの列挙型
CREATE TYPE notification_type AS ENUM (
  'like',
  'comment', 
  'follow',
  'message',
  'mention',
  'post_reply',
  'system'
);

-- プッシュトークンテーブル
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 一意制約：ユーザーとデバイスIDの組み合わせ
  UNIQUE(user_id, device_id)
);

-- プッシュトークンテーブルのインデックス
CREATE INDEX idx_push_tokens_user_id ON push_tokens (user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_push_tokens_platform ON push_tokens (platform);

-- 通知設定テーブル
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  likes_enabled BOOLEAN DEFAULT TRUE,
  comments_enabled BOOLEAN DEFAULT TRUE,
  follows_enabled BOOLEAN DEFAULT TRUE,
  messages_enabled BOOLEAN DEFAULT TRUE,
  mentions_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 通知設定テーブルのインデックス
CREATE INDEX idx_notification_settings_user_id ON notification_settings (user_id);

-- 既存のnotificationsテーブルにプッシュ通知関連の列を追加
-- （既存テーブルの場合はALTER TABLEを使用）
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS type notification_type DEFAULT 'system',
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 既存の通知テーブルにインデックスを追加
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);

-- RLS (Row Level Security) ポリシーを設定

-- プッシュトークンテーブルのRLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のプッシュトークンのみ閲覧可能
CREATE POLICY "Users can view their own push tokens"
ON push_tokens FOR SELECT
USING (user_id = auth.uid());

-- ユーザーは自分のプッシュトークンのみ挿入可能
CREATE POLICY "Users can insert their own push tokens"
ON push_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ユーザーは自分のプッシュトークンのみ更新可能
CREATE POLICY "Users can update their own push tokens"
ON push_tokens FOR UPDATE
USING (user_id = auth.uid());

-- ユーザーは自分のプッシュトークンのみ削除可能
CREATE POLICY "Users can delete their own push tokens"
ON push_tokens FOR DELETE
USING (user_id = auth.uid());

-- 通知設定テーブルのRLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の通知設定のみ閲覧可能
CREATE POLICY "Users can view their own notification settings"
ON notification_settings FOR SELECT
USING (user_id = auth.uid());

-- ユーザーは自分の通知設定のみ挿入可能
CREATE POLICY "Users can insert their own notification settings"
ON notification_settings FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ユーザーは自分の通知設定のみ更新可能
CREATE POLICY "Users can update their own notification settings"
ON notification_settings FOR UPDATE
USING (user_id = auth.uid());

-- 通知テーブルの既存RLSポリシーを確認・追加（既存の場合は適用済みの可能性）
-- CREATE POLICY IF NOT EXISTS "Users can view their own notifications"
-- ON notifications FOR SELECT
-- USING (user_id = auth.uid());

-- CREATE POLICY IF NOT EXISTS "Users can update their own notifications"
-- ON notifications FOR UPDATE
-- USING (user_id = auth.uid());

-- 自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- プッシュトークンテーブルの更新トリガー
CREATE TRIGGER update_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 通知設定テーブルの更新トリガー
CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 古い通知を削除する関数（7日以上経過）
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 無効なプッシュトークンを削除する関数
CREATE OR REPLACE FUNCTION cleanup_inactive_push_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM push_tokens 
    WHERE is_active = FALSE 
    AND updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;