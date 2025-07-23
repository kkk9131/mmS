# 緊急時対応手順書

## 概要

このドキュメントは、本番環境で重大な問題が発生した際の緊急対応手順を定義します。

## 緊急時対応チーム

### 連絡先
- **技術責任者**: [連絡先を記載]
- **インフラ担当**: [連絡先を記載]
- **データベース管理者**: [連絡先を記載]

### エスカレーション手順
1. 初回対応者が問題を検知
2. 30分以内に技術責任者に報告
3. 重大な場合はインフラ担当とDBA に並行連絡

## 緊急時対応レベル

### Level 1: 軽微な問題
- ユーザーへの影響が限定的
- 特定機能の一時的な不具合
- **対応時間**: 4時間以内

### Level 2: 重要な問題
- 多数のユーザーに影響
- 主要機能の停止
- **対応時間**: 1時間以内

### Level 3: 重大な問題
- サービス全体の停止
- データ損失の可能性
- セキュリティ侵害
- **対応時間**: 30分以内

## 対応手順

### 1. 問題の検知と初期対応

#### 1.1 システム監視
```bash
# パフォーマンス監視の確認
npm run performance:test

# リアルタイム機能の確認
npm run performance:realtime

# セキュリティ監査の実行
npm run security:audit
```

#### 1.2 ログの確認
```bash
# アプリケーションログを確認
tail -f /var/log/application.log

# エラーログを確認
grep -i error /var/log/application.log

# Supabaseログの確認（MCP使用）
# SupabaseMCPツールでログを確認
```

### 2. 機能フラグによる緊急対応

#### 2.1 問題のある機能を無効化
```typescript
import { FeatureFlagsManager } from '../services/featureFlags';

// 緊急時機能無効化
const flagManager = FeatureFlagsManager.getInstance();
await flagManager.emergencyDisableFeature('problematic_feature', '緊急対応のため一時停止');
```

#### 2.2 影響範囲の特定
```typescript
// デバッグ情報を取得
const debugInfo = flagManager.getDebugInfo();
console.log('現在のフラグ状態:', debugInfo);

// 統計情報を確認
const stats = flagManager.getExtendedStats();
console.log('フラグ統計:', stats);
```

### 3. ロールバック実行

#### 3.1 ロールバック計画の作成
```typescript
import { createRollbackManager } from '../services/featureFlags';

const rollbackManager = createRollbackManager(flagManager);

const rollbackPlan = await rollbackManager.createRollbackPlan(
  'v1.2.0', // 安定版バージョン
  'データベース接続エラーによる緊急ロールバック',
  ['realtime_notifications', 'new_post_editor'] // 影響を受ける機能
);
```

#### 3.2 ロールバック実行
```typescript
const rollbackSuccess = await rollbackManager.executeRollback(rollbackPlan);

if (rollbackSuccess) {
  console.log('✅ ロールバック完了');
} else {
  console.log('❌ ロールバック失敗 - 手動対応が必要');
}
```

### 4. データベース緊急対応

#### 4.1 データベース状態確認
```sql
-- パフォーマンスレポート生成
SELECT * FROM generate_performance_report();

-- 遅いクエリの確認
SELECT * FROM get_slow_queries();

-- 接続数の確認
SELECT count(*) FROM pg_stat_activity;
```

#### 4.2 データベース最適化
```bash
# データベース最適化スクリプト実行
npm run db:optimize

# RLSポリシーの再設定
npm run db:setup-rls
```

### 5. Supabase緊急対応（MCPツール使用）

#### 5.1 プロジェクト状態確認
```javascript
// MCPツールでプロジェクト状態を確認
await mcp_supabase_get_project(PROJECT_ID);
```

#### 5.2 ログとアラート確認
```javascript
// エラーログを確認
await mcp_supabase_get_logs(PROJECT_ID, 'api');
await mcp_supabase_get_logs(PROJECT_ID, 'postgres');

// セキュリティアドバイザーを確認
await mcp_supabase_get_advisors(PROJECT_ID, 'security');
await mcp_supabase_get_advisors(PROJECT_ID, 'performance');
```

#### 5.3 緊急時プロジェクト一時停止
```javascript
// 必要に応じてプロジェクトを一時停止
await mcp_supabase_pause_project(PROJECT_ID);

// 復旧後にプロジェクトを再開
await mcp_supabase_restore_project(PROJECT_ID);
```

### 6. リアルタイム機能の緊急対応

#### 6.1 リアルタイム接続の監視
```typescript
import { performanceMonitor } from '../utils/performanceMonitor';

// リアルタイム接続数を確認
const connectionCount = performanceMonitor.getRealtimeSubscriptionCount();
console.log('現在のリアルタイム接続数:', connectionCount);

// パフォーマンス統計を確認
const performanceStats = performanceMonitor.getPerformanceStats();
console.log('リアルタイム統計:', performanceStats.realtimeStats);
```

#### 6.2 リアルタイム機能の一時停止
```typescript
// リアルタイム通知を無効化
await flagManager.emergencyDisableFeature('realtime_notifications', 'サーバー負荷対応');

// リアルタイム投稿更新を無効化
await flagManager.emergencyDisableFeature('realtime_posts', 'パフォーマンス問題対応');
```

### 7. キャッシュとセッション管理

#### 7.1 キャッシュクリア
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// アプリケーションキャッシュを全削除
await AsyncStorage.clear();

// 特定のキーのみクリア
await AsyncStorage.removeItem('feature_flags_config');
await AsyncStorage.removeItem('user_session');
```

#### 7.2 Redux状態のリセット
```typescript
// Redux storeをリセット（必要に応じて実装）
// store.dispatch({ type: 'RESET_ALL_STATE' });
```

## 復旧確認手順

### 1. 基本機能確認
```bash
# 基本的なAPIテスト
curl -X GET "https://your-supabase-url.supabase.co/rest/v1/posts?select=id&limit=1" \
     -H "apikey: YOUR_ANON_KEY"

# 認証テスト
npm run security:auth-test
```

### 2. パフォーマンステスト
```bash
# 包括的なパフォーマンステスト
npm run performance:test

# リアルタイム機能テスト
npm run performance:realtime
```

### 3. ユーザー影響の確認
- エラーレポートの収集
- ユーザーからの問い合わせ状況
- アクセス数とエラー率の監視

## 事後対応

### 1. インシデントレポート作成
```markdown
# インシデントレポート

## 概要
- **発生時刻**: 
- **検知時刻**: 
- **対応完了時刻**: 
- **影響範囲**: 
- **対応レベル**: 

## 根本原因
[原因の詳細]

## 対応内容
[実施した対応の詳細]

## 再発防止策
[今後の対策]
```

### 2. システム改善
- 監視アラートの調整
- フィーチャーフラグ設定の見直し
- パフォーマンス閾値の調整
- ドキュメントの更新

## 定期メンテナンス

### 月次
- パフォーマンステストの実行
- セキュリティ監査の実施
- フィーチャーフラグの棚卸し

### 四半期
- 緊急時対応手順の見直し
- チーム連絡先の更新
- 災害対策の確認

## 緊急時コマンド集

### 即座に実行可能なコマンド
```bash
# 1. システム状態確認
npm run performance:test
npm run security:audit

# 2. 機能無効化（特定機能名を指定）
npx tsx -e "
import { FeatureFlagsManager } from './src/services/featureFlags';
const manager = FeatureFlagsManager.getInstance();
await manager.emergencyDisableFeature('FEATURE_NAME', 'REASON');
"

# 3. キャッシュクリア
npx tsx -e "
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();
console.log('Cache cleared');
"

# 4. データベース状態確認
cat src/scripts/database-optimization.sql | head -50
```

### 監視コマンド
```bash
# リアルタイムでログを監視
tail -f /var/log/application.log | grep -E "(ERROR|CRITICAL|FATAL)"

# システムリソース監視
top -p $(pgrep -f "node")

# ネットワーク接続確認
netstat -an | grep :3000
```

## 注意事項

1. **緊急対応時の心構え**
   - 冷静に状況を把握する
   - 段階的にアプローチする
   - 変更内容を必ず記録する

2. **避けるべき行動**
   - パニックによる過度な変更
   - 検証なしでの本番環境操作
   - 一人での重要な判断

3. **コミュニケーション**
   - ステークホルダーへの迅速な報告
   - 進捗の定期的な更新
   - 復旧完了の確実な通知

---

**このドキュメントは定期的に更新し、チーム全員が最新版を参照できるようにしてください。**