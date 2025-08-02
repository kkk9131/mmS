# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド集

### 開発コマンド
```bash
# 開発サーバー起動（テレメトリー無効、キャッシュクリア）
npm run dev

# 型チェック（厳格モード）
npm run type-check

# リント実行
npm run lint

# リント自動修正
npm run lint:fix

# コードフォーマット
npm run format

# フォーマットチェック
npm run format:check
```

### テストコマンド
```bash
# 単体テスト実行
npm test

# テスト監視モード
npm run test:watch

# カバレッジ確認
npm run test:coverage

# E2Eテスト実行
npm run test:e2e

# E2EテストUI起動
npm run test:e2e:ui

# E2Eテスト（ヘッドフル）
npm run test:e2e:headed

# E2Eテストデバッグ
npm run test:e2e:debug
```

### ビルド・デプロイコマンド
```bash
# Web版ビルド
npm run build:web

# iOS TestFlightビルド
npm run build:ios

# Android プレビュービルド
npm run build:android

# iOS アプリ提出
npm run submit:ios
```

### 本番環境・モニタリング
```bash
# 本番環境準備
npm run production:prepare

# モニタリングチェック
npm run monitoring:check

# 継続的モニタリング開始
npm run monitoring:start

# モニタリング統計確認
npm run monitoring:stats

# 本番機能テスト
npm run test:production

# 本番パフォーマンステスト
npm run test:performance

# 本番セキュリティテスト
npm run test:security

# 全本番テスト実行
npm run test:production:all
```

### データベース・ストレージ
```bash
# RLSポリシー設定
npm run db:setup-rls

# データベース最適化
npm run db:optimize

# ストレージセットアップ
npm run setup:storage
```

### セキュリティ・認証
```bash
# セキュリティ監査
npm run security:audit

# 認証セキュリティテスト
npm run security:auth-test

# 本番セキュリティ監査
npm run production:audit
```

## アーキテクチャ概要

### プロジェクト構成
```
src/
├── app/                 # Expo Router ページ（ファイルベースルーティング）
│   ├── (tabs)/         # タブナビゲーション画面
│   └── *.tsx           # 個別画面
├── components/         # 再利用可能UIコンポーネント
│   ├── accessibility/  # アクセシビリティ特化コンポーネント
│   ├── auth/          # 認証関連コンポーネント
│   ├── image/         # 画像処理コンポーネント
│   └── performance/   # パフォーマンス最適化コンポーネント
├── services/          # ビジネスロジック層
│   ├── api/          # APIクライアント（axios）
│   ├── supabase/     # Supabaseクライアント管理
│   ├── jwt/          # JWT認証システム
│   ├── notifications/ # プッシュ通知システム
│   └── performance/   # パフォーマンス管理
├── store/             # Redux Toolkit状態管理
│   ├── api/          # RTK Query APIスライス
│   └── slices/       # 状態スライス
├── contexts/          # React Context（全体的な状態）
├── hooks/            # カスタムReactフック
├── types/            # TypeScript型定義
└── utils/            # ユーティリティ関数
```

### 主要な技術スタック
- **フレームワーク**: React Native + Expo SDK 53
- **言語**: TypeScript（厳格モード）
- **ルーティング**: Expo Router（ファイルベース）
- **状態管理**: Redux Toolkit + RTK Query
- **バックエンド**: Supabase（PostgreSQL + リアルタイムDB）
- **認証**: JWT（カスタム実装）+ Supabase Auth
- **スタイリング**: StyleSheet API（React Native標準）
- **テスト**: Jest + Testing Library + Playwright

### 重要な設計パターン

#### 1. 認証フロー
- `AuthContext`で認証状態を管理
- JWTトークンは`SecureStore`で暗号化保存
- 自動ログイン・生体認証対応
- `ProtectedRoute`コンポーネントでアクセス制御

#### 2. API通信
- RTK Queryで全APIコールを統一管理
- Supabase用カスタムベースクエリ実装
- 楽観的更新とキャッシング戦略
- エラーハンドリングとリトライロジック

#### 3. パフォーマンス最適化
- リスト仮想化（`FlashList`使用）
- 画像遅延読み込み・キャッシング
- メモリ最適化とガベージコレクション管理
- バッテリー消費最適化

#### 4. アクセシビリティ
- スクリーンリーダー対応
- 最小タップエリア48dp確保
- 高コントラスト対応
- 片手操作モード

### Supabase連携
- カスタム認証（母子手帳番号）実装
- RLSポリシーでデータアクセス制御
- リアルタイム購読（投稿・通知）
- ストレージバケット（画像アップロード）

### 開発時の注意点
1. **型安全性**: TypeScript厳格モードを維持
2. **エラーハンドリング**: 全てのAPIコールでエラー処理必須
3. **セキュリティ**: 認証トークンや個人情報の扱いに注意
4. **パフォーマンス**: リスト表示は必ず仮想化を使用
5. **テスト**: 新機能追加時は必ずテストを書く

### デバッグ・トラブルシューティング
- Supabaseデバッグ: `src/utils/supabaseDebug.ts`
- パフォーマンス監視: `src/utils/performanceMonitor.ts`
- エラーログ: `src/utils/errorUtils.ts`
- 認証デバッグ: `src/services/jwt/AuthErrorHandler.ts`