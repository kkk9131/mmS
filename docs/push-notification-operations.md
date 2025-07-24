# プッシュ通知システム 運用マニュアル

## 概要
本マニュアルは、Mamapaceアプリのプッシュ通知システムの運用・保守に関する手順を記載します。

## 日常運用タスク

### デイリーチェック

#### 1. システムヘルスチェック
```typescript
// NotificationMonitoringManager を使用
const health = await notificationMonitoringManager.getSystemHealth();
console.log('システム状態:', health.status);
console.log('問題:', health.issues);
```

**確認項目:**
- [ ] 配信成功率 ≥ 95%
- [ ] 平均配信時間 ≤ 3秒
- [ ] エラー率 ≤ 5%  
- [ ] アクティブなアラート数

#### 2. メトリクス確認
```typescript
const metrics = await notificationMonitoringManager.getCurrentMetrics();
```

**重要指標:**
- **配信成功率**: 目標95%以上
- **ユーザーエンゲージメント率**: 目標30%以上
- **トークン無効化率**: 目標10%以下
- **キューサイズ**: 通常時50件以下

#### 3. データベース監視
```sql
-- 通知テーブルのサイズ確認
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'notifications';

-- 未処理通知の確認
SELECT COUNT(*) as pending_notifications
FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND is_read = false;
```

### ウィークリータスク

#### 1. パフォーマンスレポート生成
```typescript
const report = await notificationMonitoringManager.generatePerformanceReport('weekly');
console.log('週次レポート:', report);
```

#### 2. エラーログ分析
```typescript
const errorStats = await notificationErrorHandler.getErrorStats();
console.log('エラー統計:', errorStats);
```

#### 3. データベースメンテナンス
```sql
-- 古い通知の削除（3ヶ月以上前）
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '3 months';

-- 無効なプッシュトークンの削除
DELETE FROM push_tokens 
WHERE is_active = false 
  AND updated_at < NOW() - INTERVAL '1 week';

-- インデックスの再構築
REINDEX TABLE notifications;
REINDEX TABLE push_tokens;
```

## アラート対応

### 配信成功率低下（< 95%）

#### 原因調査
1. **プッシュトークンの状態確認**
```sql
SELECT 
  platform,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active,
  COUNT(*) FILTER (WHERE is_active = false) as inactive
FROM push_tokens 
GROUP BY platform;
```

2. **Expo Push API の状態確認**
```bash
curl -X GET "https://exp.host/--/api/v2/push/getReceipts" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json"
```

#### 対応手順
1. 無効トークンの一括削除
2. ユーザーにトークン再登録を促す
3. Edge Function のエラーログ確認
4. 必要に応じてExpo Push APIキーの更新

### 平均配信時間増加（> 5秒）

#### 原因調査
```typescript
// パフォーマンス最適化状況の確認
const metrics = await notificationPerformanceOptimizer.getPerformanceMetrics();
console.log('レスポンス時間:', metrics.averageResponseTime);
console.log('キャッシュヒット率:', metrics.cacheHitRate);
```

#### 対応手順
1. **バッチサイズの調整**
```typescript
await notificationPerformanceOptimizer.adjustConfigBasedOnPerformance();
```

2. **データベースクエリの最適化**
```sql
-- 遅いクエリの特定
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%notifications%'
ORDER BY mean_time DESC;
```

3. **キャッシュ設定の見直し**
```typescript
// キャッシュTTL延長
notificationPerformanceOptimizer.cacheConfigs.notifications.ttl *= 1.5;
```

### エラー率増加（> 5%）

#### エラー分析
```typescript
const errorStats = await notificationErrorHandler.getErrorStats();
console.log('エラー内訳:', errorStats.errorsByType);
```

#### 対応手順
1. **主要エラーの対応**
   - `DeviceNotRegistered`: トークン削除・再登録
   - `MessageRateExceeded`: レート制限の調整
   - `InvalidCredentials`: API認証情報の確認

2. **再送処理の確認**
```typescript
// 失敗した通知の再送
await notificationQueueManager.retryFailedNotifications();
```

## 緊急時対応

### 大量通知配信の停止

#### 即座の対応
```typescript
// キュー処理の一時停止
notificationQueueManager.pauseProcessing();

// 新規通知の受付停止（機能フラグ）
const FEATURE_FLAGS = {
  PUSH_NOTIFICATIONS_ENABLED: false
};
```

#### データベースレベルでの停止
```sql
-- 通知トリガーの無効化
ALTER TABLE notifications DISABLE TRIGGER notification_push_trigger;
```

### プッシュ通知の完全停止

#### Edge Function の無効化
```bash
# Supabase CLI を使用
supabase functions delete send-push-notification
```

#### アプリレベルでの無効化
```typescript
// NotificationService の緊急停止
notificationService.emergencyShutdown();
```

## データベース管理

### バックアップ・復旧

#### 定期バックアップ
```bash
# 通知関連テーブルのバックアップ
pg_dump -h [host] -U [user] -d [database] \
  --table=notifications \
  --table=push_tokens \
  --table=notification_settings \
  --no-owner --no-privileges \
  > notifications_backup_$(date +%Y%m%d).sql
```

#### 復旧手順
```bash
# バックアップからの復旧
psql -h [host] -U [user] -d [database] \
  < notifications_backup_20231201.sql
```

### マイグレーション管理

#### 新しいマイグレーションの適用
```bash
# Supabase CLI使用
supabase db push

# または直接SQL実行
supabase db reset --db-url [DATABASE_URL]
```

#### ロールバック
```sql
-- マイグレーション履歴の確認
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;

-- 特定バージョンへのロールバック
-- (実装依存)
```

## パフォーマンスチューニング

### データベース最適化

#### インデックスの確認・追加
```sql
-- 欠落インデックスの確認
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename IN ('notifications', 'push_tokens', 'notification_settings');

-- パフォーマンス改善のための複合インデックス
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications (user_id, is_read, created_at DESC) 
WHERE is_read = false;
```

#### クエリパフォーマンス分析
```sql
-- 遅いクエリの特定
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  (total_time/calls)::numeric(10,3) as avg_time_ms
FROM pg_stat_statements 
WHERE query LIKE '%notifications%'
ORDER BY mean_time DESC
LIMIT 10;
```

### アプリケーション最適化

#### キャッシュ戦略の調整
```typescript
// キャッシュ設定の動的調整
await notificationPerformanceOptimizer.adjustConfigBasedOnPerformance();

// キャッシュ統計の確認
const cacheStats = {
  hitRate: metrics.cacheHitRate,
  size: await notificationPerformanceOptimizer.getCacheSize(),
  evictionCount: await notificationPerformanceOptimizer.getEvictionCount()
};
```

#### バッチ処理の最適化
```typescript
// システム負荷に基づくバッチサイズ調整
const optimalBatchSize = await notificationPerformanceOptimizer.optimizeBatchSize(
  queueSize,
  averageProcessingTime,
  systemLoad
);
```

## セキュリティ管理

### プッシュトークンの暗号化

#### 暗号化キーのローテーション
```typescript
// 新しい暗号化キーの生成
const newEncryptionKey = await notificationSecurityManager.generateNewEncryptionKey();

// 既存データの再暗号化
await notificationSecurityManager.reencryptTokens(newEncryptionKey);
```

#### セキュリティ監査
```typescript
// アクセスログの確認
const auditLogs = await notificationSecurityManager.getAuditLogs({
  startDate: new Date(Date.now() - 24*60*60*1000), // 過去24時間
  endDate: new Date()
});
```

### RLSポリシーの更新

#### ポリシーの確認
```sql
-- 現在のRLSポリシー確認
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('notifications', 'push_tokens', 'notification_settings');
```

#### ポリシーの更新
```sql
-- より厳密なアクセス制御
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    auth.uid() = user_id 
    AND auth.jwt() ->> 'aud' = 'authenticated'
  );
```

## 容量管理

### ストレージ使用量監視

#### テーブルサイズの確認
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE tablename IN ('notifications', 'push_tokens', 'notification_settings');
```

#### データの削除・アーカイブ
```sql
-- 古いデータのアーカイブ（月次実行）
CREATE TABLE notifications_archive AS 
SELECT * FROM notifications 
WHERE created_at < NOW() - INTERVAL '6 months';

DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '6 months';
```

### ログ管理

#### アプリケーションログ
```typescript
// ログレベルの調整
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1, 
  INFO: 2,
  DEBUG: 3
};

// 本番環境ではINFO以上のみ記録
const currentLogLevel = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
```

#### データベースログ
```sql
-- ログ設定の確認
SHOW log_statement;
SHOW log_min_duration_statement;

-- 長時間実行クエリのログ有効化
ALTER SYSTEM SET log_min_duration_statement = '1000'; -- 1秒以上
SELECT pg_reload_conf();
```

## 災害対策

### バックアップ戦略

#### 自動バックアップ設置
```bash
#!/bin/bash
# daily_backup.sh - 日次バックアップスクリプト

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/notifications"

# データベースバックアップ
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --table=notifications \
  --table=push_tokens \
  --table=notification_settings \
  --no-owner --no-privileges \
  > "$BACKUP_DIR/notifications_$DATE.sql"

# 圧縮
gzip "$BACKUP_DIR/notifications_$DATE.sql"

# 古いバックアップの削除（30日以上前）
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

#### 復旧テスト
```bash
# 月次復旧テスト
# 1. テスト環境へのバックアップ復旧
# 2. データ整合性確認
# 3. アプリケーション動作確認
```

### 障害対策

#### 障害検知
```typescript
// ヘルスチェックエンドポイント
export async function healthCheck() {
  const checks = {
    database: await checkDatabaseConnection(),
    pushService: await checkExpoPushService(),
    queueService: await checkQueueService(),
    cacheService: await checkCacheService()
  };
  
  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  
  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  };
}
```

#### 自動復旧
```typescript
// 自動復旧処理
export async function autoRecovery() {
  try {
    // 1. キューの再開
    await notificationQueueManager.resumeProcessing();
    
    // 2. 失敗した通知の再送
    await notificationQueueManager.retryFailedNotifications();
    
    // 3. トークンの再検証
    await pushTokenManager.validateAllTokens();
    
    console.log('自動復旧処理が完了しました');
  } catch (error) {
    console.error('自動復旧処理に失敗しました:', error);
    // アラート送信
  }
}
```

## トラブルシューティング

### よくある問題と解決方法

#### 問題: プッシュ通知が特定のユーザーに届かない
**調査手順:**
1. ユーザーのプッシュトークン確認
2. 通知設定の確認
3. おやすみモード設定の確認
4. デバイスの通知権限確認

```typescript
// デバッグ用の詳細確認
const debugInfo = {
  pushToken: await pushTokenManager.getTokenForUser(userId),
  settings: await notificationSettingsManager.getSettings(userId),
  recentNotifications: await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
};
```

#### 問題: 通知の重複送信
**調査手順:**
1. 重複排除ロジックの確認
2. データベーストリガーの動作確認
3. リアルタイム接続の状態確認

```sql
-- 重複通知の確認
SELECT 
  user_id,
  type,
  title,
  message,
  COUNT(*) as duplicate_count
FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, type, title, message
HAVING COUNT(*) > 1;
```

#### 問題: キューの詰まり
**対応手順:**
```typescript
// キューの詳細状態確認
const queueStats = await notificationQueueManager.getDetailedQueueStats();

// 詰まったアイテムの処理
if (queueStats.oldestItemAge > 300000) { // 5分以上古い
  await notificationQueueManager.clearStaleItems();
}

// バッチサイズの調整
await notificationQueueManager.adjustBatchSize(queueStats);
```

### ログ分析

#### エラーパターンの分析
```bash
# Edge Function ログの分析
supabase functions logs send-push-notification | grep "ERROR" | tail -100

# アプリケーションログの分析
grep "NotificationError" app.log | cut -d' ' -f1-3,6- | sort | uniq -c | sort -nr
```

#### パフォーマンス分析
```sql
-- 処理時間の分析
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as notification_count,
  AVG(EXTRACT(EPOCH FROM (read_at - created_at))) as avg_read_time_seconds
FROM notifications 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND read_at IS NOT NULL
GROUP BY hour
ORDER BY hour;
```

---

**最終更新**: 2023年12月
**バージョン**: 1.0.0
**緊急連絡先**: [開発チーム連絡先]