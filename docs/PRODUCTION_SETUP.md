# 🚀 Mamapace本番環境セットアップガイド

## 📋 概要

このドキュメントは、Mamapaceアプリケーションを本番環境にデプロイするための手順書です。
既存のSupabaseプロジェクト（mamapace）を本番環境として使用します。

## 🔍 前提条件

- Node.js 18以上
- Expo CLI
- Supabaseアカウント
- 現在のプロジェクト: `zfmqxdkqpeyvsuqyzuvy` (mamapace)

## 📝 セットアップ手順

### 1. ブランチの作成と切り替え

```bash
git checkout -b feature/production-setup
```

### 2. 環境変数の準備

```bash
# テンプレートファイルをコピー
cp .env.production.example .env.production

# .env.productionを編集して実際の値を入力
# EXPO_PUBLIC_SUPABASE_URL=https://zfmqxdkqpeyvsuqyzuvy.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=実際のanon key
# SUPABASE_SERVICE_ROLE_KEY=実際のservice role key（秘密保持）
```

### 3. データクリーンアップ

⚠️ **重要**: 実行前に必ずバックアップを取得してください！

```bash
# 準備スクリプトを実行
npm run production:prepare

# または、Supabase SQL Editorで直接実行
# src/scripts/cleanup-test-data.sql
```

### 4. セキュリティ設定の適用

Supabase SQL Editorで以下のファイルを実行：

```sql
-- src/scripts/production-security-setup.sql
-- このファイルにはRLSポリシーとセキュリティ設定が含まれています
```

### 5. セキュリティ監査の実行

```bash
npm run production:audit
```

監査結果は`security-reports/`ディレクトリに保存されます。

### 6. 本番環境の確認事項

#### 6.1 Supabase Dashboard確認
- [ ] RLS（Row Level Security）が全テーブルで有効
- [ ] APIキーが適切に設定されている
- [ ] Storageバケットのアクセス権限が正しい
- [ ] バックアップが有効になっている

#### 6.2 環境変数確認
- [ ] `.env.production`に全ての必要な値が設定されている
- [ ] Service Roleキーが安全に保管されている
- [ ] 本番用のAPIキーが使用されている

#### 6.3 機能フラグ確認
- [ ] `EXPO_PUBLIC_USE_MOCK_DATA=false`
- [ ] `EXPO_PUBLIC_ENABLE_DEBUG_LOGS=false`
- [ ] `EXPO_PUBLIC_ENABLE_ERROR_REPORTING=true`

## 🔒 セキュリティベストプラクティス

### APIキー管理
- Service Roleキーは**絶対に**クライアントサイドで使用しない
- 環境変数は`.gitignore`に含まれていることを確認
- 定期的にAPIキーをローテーション

### データ保護
- RLSポリシーが適切に設定されていることを確認
- 個人情報は暗号化されて保存
- 定期的なバックアップを設定

### アクセス制御
- 母子手帳番号によるユニーク認証
- セッションタイムアウトの設定
- ログイン試行回数の制限

## 📊 監視とメンテナンス

### 定期監査
```bash
# 週次でセキュリティ監査を実行
npm run production:audit
```

### パフォーマンス監視
- Supabase Dashboardでクエリパフォーマンスを監視
- エラーログを定期的に確認
- ストレージ使用量を監視

### バックアップ確認
- 日次バックアップが実行されていることを確認
- リストアテストを月次で実施
- バックアップの保存期間を確認

## 🚨 トラブルシューティング

### RLSエラー
```
Error: row-level security policy violation
```
- RLSポリシーが正しく設定されているか確認
- ユーザーの認証状態を確認

### 接続エラー
```
Error: Failed to connect to Supabase
```
- 環境変数が正しく設定されているか確認
- Supabaseプロジェクトのステータスを確認

### パフォーマンス問題
- インデックスが適切に設定されているか確認
- クエリの最適化を検討
- キャッシュ戦略を見直し

## 📱 アプリのビルドとデプロイ

### iOS
```bash
# 本番環境でビルド
NODE_ENV=production expo build:ios
```

### Android
```bash
# 本番環境でビルド
NODE_ENV=production expo build:android
```

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. このドキュメントのトラブルシューティングセクション
2. Supabase公式ドキュメント
3. `security-reports/`の監査レポート

## ✅ チェックリスト

本番環境への移行前に、以下の項目を確認してください：

- [ ] テストデータがクリーンアップされている
- [ ] RLSポリシーが全テーブルで有効
- [ ] 環境変数が本番用に設定されている
- [ ] セキュリティ監査で重大な問題がない
- [ ] バックアップが設定されている
- [ ] 監視システムが稼働している
- [ ] エラーレポートが有効
- [ ] ドメインとSSLが設定されている（該当する場合）

---

最終更新: 2025年1月