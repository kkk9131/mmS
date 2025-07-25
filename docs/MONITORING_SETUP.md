# 🔍 Mamapace 監視システムセットアップガイド

## 📋 概要

Mamapace本番環境の基本監視システムの設定と使用方法を説明します。
Supabaseの標準機能を活用したシンプルで効果的な監視システムです。

## ✅ 実装完了（2025-01-25）

### 基本監視システム ✅
- **ヘルスチェック**: 全サービス（DB, API, Auth, Storage, Realtime）の状態監視
- **パフォーマンス監視**: 応答時間測定・記録
- **レポート生成**: JSON形式での監視結果保存
- **継続監視**: 定期的な自動監視とアラート機能

---

# 🔧 監視システムの使用方法

## 基本コマンド

### 1. 単発ヘルスチェック
```bash
# 現在の状態を即座に確認
npm run monitoring:check

# または環境変数を指定して実行
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" npm run monitoring:check
```

### 2. 継続監視（本番環境推奨）
```bash
# 継続監視開始（5分間隔）
npm run monitoring:start

# 監視統計表示
npm run monitoring:stats

# 使用方法確認
npm run monitoring:help
```

### 3. 環境変数設定
```bash
# .env.production に設定済み
EXPO_PUBLIC_SUPABASE_URL=https://zfmqxdkqpeyvsuqyzuvy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

# 📊 監視項目・基準値

## 監視対象サービス

| サービス | 確認内容 | 正常基準 | 警告基準 | エラー基準 |
|----------|----------|----------|----------|------------|
| **Database** | PostgreSQL接続・クエリ実行 | < 1000ms | 1000-2000ms | > 2000ms |
| **API** | REST API応答時間 | < 500ms | 500-1000ms | > 1000ms |
| **Auth** | 認証システム接続 | < 200ms | 200-500ms | > 500ms |
| **Storage** | ファイルストレージ接続 | < 300ms | 300-1000ms | > 1000ms |
| **Realtime** | WebSocket接続 | < 2000ms | 2000-5000ms | > 5000ms |

## アラート条件

### 基本アラート
- **連続失敗**: 3回連続でエラーが発生
- **応答時間**: 基準値を超過した場合
- **接続エラー**: サービスに接続できない場合

### アラートクールダウン
- **同一サービス**: 30分間のクールダウン期間
- **システム全体**: 重大障害時は即座にアラート

---

# 📈 監視結果の確認

## 実行結果例
```bash
🔍 Mamapace基本監視システム
====================================
プロジェクトURL: https://zfmqxdkqpeyvsuqyzuvy.supabase.co
実行時刻: 2025/7/25 10:45:00

📊 監視結果サマリー
====================
✅ 正常: 5サービス
⚠️  警告: 0サービス  
❌ エラー: 0サービス

📋 詳細結果:
1. ✅ Database - 正常 (516ms)
2. ✅ API - 正常 (87ms)
3. ✅ Auth - 認証システム正常 (0ms)
4. ✅ Storage - ストレージ正常 (227ms)
5. ✅ Realtime - リアルタイム正常 (1501ms)

🎯 総合状態: ✅ 正常
```

## レポートファイル

### 監視レポート
```bash
# JSONレポート（詳細データ）
monitoring-reports/health-check-YYYY-MM-DDTHH-mm-ss-sssZ.json

# 内容例
{
  "timestamp": "2025-01-25T01:45:02.394Z",
  "project": {
    "name": "Mamapace",
    "url": "https://zfmqxdkqpeyvsuqyzuvy.supabase.co",
    "environment": "production"
  },
  "summary": {
    "total": 5,
    "healthy": 5,
    "warnings": 0,
    "errors": 0
  },
  "performance": {
    "averageResponseTime": 466,
    "slowestService": "Realtime (1501ms)",
    "fastestService": "Auth (0ms)"
  }
}
```

### 継続監視ログ
```bash
# メトリクスデータ（時系列）
monitoring-reports/metrics/metrics-YYYY-MM-DD.jsonl

# アラートログ
monitoring-reports/alerts/alerts-YYYY-MM-DD.log
```

---

# 🔔 Supabase Dashboard活用

## 標準監視機能

### 1. プロジェクト監視画面
```
https://supabase.com/dashboard/project/zfmqxdkqpeyvsuqyzuvy
├── Overview: 全体状況・統計
├── Database: クエリパフォーマンス
├── API: エンドポイント使用状況
├── Auth: ユーザー認証状況
├── Storage: ファイル使用量
└── Logs: システムログ・エラーログ
```

### 2. 重要な確認項目
- **Database健全性**: クエリ実行時間・接続数
- **API使用量**: リクエスト数・レスポンス時間
- **認証統計**: ログイン成功率・失敗原因
- **ストレージ使用量**: 容量・帯域幅使用状況
- **エラーログ**: システム・アプリケーションエラー

## 基本アラート設定

### 推奨アラート設定
```javascript
// Supabase Dashboard > Settings > Alerts
1. Database CPU使用率 > 80%
2. Database接続数 > 制限の80%
3. API エラー率 > 5%
4. Storage使用量 > 制限の90%
5. 認証失敗率 > 10%
```

---

# 🚨 アラート対応手順

## レベル1: 警告
**対応時間**: 1時間以内

### 確認項目
1. **Supabaseダッシュボード**でサービス状況確認
2. **監視ログ**で詳細エラー内容確認
3. **システムリソース**使用量確認

### 対応手順
```bash
# 1. 現在の状況確認
npm run monitoring:check

# 2. 詳細ログ確認
tail -f monitoring-reports/alerts/alerts-$(date +%Y-%m-%d).log

# 3. Supabaseダッシュボード確認
# https://supabase.com/dashboard/project/zfmqxdkqpeyvsuqyzuvy
```

## レベル2: エラー
**対応時間**: 30分以内

### 緊急対応
1. **サービス復旧**: 必要に応じて再起動・設定変更
2. **ユーザー影響確認**: アプリの動作状況確認
3. **原因調査**: ログ・メトリクス分析

### エスカレーション条件
- 連続30分以上のサービス停止
- 複数サービス同時障害
- データ損失の可能性

---

# ⚙️ 設定カスタマイズ

## 監視間隔の変更
```typescript
// src/scripts/continuous-monitoring.ts
const config: MonitoringConfig = {
  intervalMinutes: 5,    // 5分間隔 → 変更可能
  alertThresholds: {
    responseTime: 1000,  // 1秒 → 変更可能
    errorRate: 0.1,      // 10% → 変更可能
    consecutiveFailures: 3 // 3回 → 変更可能
  }
};
```

## アラート通知先追加
```typescript
// src/scripts/continuous-monitoring.ts - sendAlert関数
async function sendAlert(service: string, message: string) {
  // Slack通知
  // await sendSlackNotification(alertMessage);
  
  // メール通知  
  // await sendEmailAlert(alertMessage);
  
  // Discord通知
  // await sendDiscordNotification(alertMessage);
}
```

---

# 📋 運用チェックリスト

## 日次確認
- [ ] **監視システム動作確認** (`npm run monitoring:check`)
- [ ] **Supabaseダッシュボード**での全体状況確認
- [ ] **アラートログ**の確認・対応状況記録
- [ ] **パフォーマンス指標**の傾向確認

## 週次確認  
- [ ] **監視レポート**の傾向分析
- [ ] **アラート閾値**の適切性見直し
- [ ] **ディスク使用量**確認（ログファイル整理）
- [ ] **監視システム**の動作状況確認

## 月次確認
- [ ] **監視システム設定**の見直し・更新
- [ ] **パフォーマンス基準値**の調整
- [ ] **障害対応手順**の見直し・改善
- [ ] **チーム教育**・知識共有

---

# 🔮 将来の拡張計画

## フェーズ2: 高度な監視（ユーザー数増加後）

### 外部監視サービス連携
```bash
# New Relic APM
- アプリケーションパフォーマンス詳細監視
- ユーザー体験監視・分析

# Datadog
- インフラ・アプリケーション統合監視  
- 高度なアラート・ダッシュボード

# Sentry
- エラートラッキング・性能監視
- リアルタイムエラー通知
```

### ビジネスメトリクス監視
```bash
# ユーザー行動分析
- DAU/MAU・継続率
- 機能使用率・コンバージョン

# ビジネス指標  
- サービス収益・コスト
- SLA達成率・満足度
```

## フェーズ3: AI予測監視

### 予測的アラート
- **異常検知**: 機械学習による異常パターン検出
- **障害予測**: 過去データに基づく障害予測
- **自動修復**: 軽微な問題の自動修復機能

---

**現在の基本監視システムは本番運用に十分な機能を提供しています。ユーザー数の増加に応じて段階的に高度な監視システムに移行していきます。** 🚀

## 🆘 サポート・トラブルシューティング

### よくある問題

#### 1. 環境変数エラー
```bash
# エラー: EXPO_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません
# 解決: .env.productionファイルの確認・設定
```

#### 2. 接続タイムアウト
```bash
# 原因: ネットワーク・Supabaseサービス一時的な問題
# 対応: 数分後に再実行、Supabaseステータス確認
```

#### 3. 権限エラー
```bash
# 原因: RLS設定・APIキー権限問題
# 対応: Supabaseダッシュボードで権限設定確認
```

### 緊急連絡先
- **Supabaseサポート**: https://supabase.com/support
- **システム管理者**: [設定してください]
- **開発チーム**: [設定してください]