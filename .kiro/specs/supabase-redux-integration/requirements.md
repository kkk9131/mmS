# Requirements Document

## Introduction

この機能は、MamapaceアプリにSupabaseバックエンドとRedux状態管理を統合し、既存のモックシステムから本格的なデータベース駆動アプリケーションへの移行を実現します。母親向けSNSとして必要な認証、投稿、通知、フォロー機能をSupabaseで実装し、Redux Toolkitで状態管理を統一します。

## Requirements

### Requirement 1: Supabase基盤構築

**User Story:** As a developer, I want to integrate Supabase as the backend service, so that the app can use a real database and authentication system.

#### Acceptance Criteria

1. WHEN Supabaseクライアントが初期化される THEN アプリは正常にSupabaseに接続できる
2. WHEN 環境変数が設定される THEN Supabase URLとAnon Keyが正しく読み込まれる
3. WHEN 機能フラグが設定される THEN Supabase/モック切り替えが可能である
4. WHEN データベーススキーマが作成される THEN 必要なテーブル（users, posts, notifications, follows）が存在する
5. WHEN Row Level Security (RLS) が設定される THEN 適切なセキュリティポリシーが適用される

### Requirement 2: Redux Toolkit統合

**User Story:** As a developer, I want to implement Redux Toolkit for state management, so that the app has centralized and predictable state management.

#### Acceptance Criteria

1. WHEN Redux Storeが設定される THEN アプリ全体で状態が共有される
2. WHEN Redux DevToolsが設定される THEN 開発時に状態変化が可視化される
3. WHEN RTK Queryが設定される THEN APIキャッシュとデータフェッチが効率化される
4. WHEN Sliceが作成される THEN 各機能の状態管理が分離される
5. WHEN Middlewareが設定される THEN 非同期処理とログが適切に処理される

### Requirement 3: 認証システム統合

**User Story:** As a user, I want to log in with my maternal health book number and nickname, so that I can access the app securely and anonymously.

#### Acceptance Criteria

1. WHEN ユーザーがログインする THEN Supabase Authで認証される
2. WHEN 母子手帳番号とニックネームが入力される THEN カスタム認証ロジックが実行される
3. WHEN 認証が成功する THEN JWTトークンがRedux stateに保存される
4. WHEN アプリが再起動される THEN 認証状態が復元される
5. WHEN ログアウトする THEN 認証状態とトークンがクリアされる

### Requirement 4: データ層統合

**User Story:** As a user, I want my posts, notifications, and follows to be stored in a real database, so that my data persists and is synchronized across devices.

#### Acceptance Criteria

1. WHEN 投稿が作成される THEN Supabaseデータベースに保存される
2. WHEN 投稿一覧が取得される THEN Supabaseから最新データが取得される
3. WHEN いいねが押される THEN リアルタイムでデータベースが更新される
4. WHEN 通知が発生する THEN Supabaseで通知レコードが作成される
5. WHEN フォロー操作が行われる THEN 関係データがデータベースに反映される

### Requirement 5: リアルタイム機能基盤

**User Story:** As a user, I want to see real-time updates for likes, comments, and notifications, so that I have an interactive and responsive experience.

#### Acceptance Criteria

1. WHEN 他ユーザーがいいねする THEN リアルタイムで画面が更新される
2. WHEN 新しい通知が発生する THEN 即座に通知バッジが更新される
3. WHEN コメントが投稿される THEN リアルタイムでコメント一覧が更新される
4. WHEN Supabase接続が切断される THEN 適切にエラーハンドリングされる
5. WHEN 接続が復旧する THEN 自動的に再接続される

### Requirement 6: 既存コード互換性

**User Story:** As a developer, I want to maintain compatibility with existing code, so that the migration to Supabase is smooth and doesn't break existing functionality.

#### Acceptance Criteria

1. WHEN 既存のServiceクラスが呼び出される THEN Supabase統合後も同じインターフェースで動作する
2. WHEN 機能フラグが無効の場合 THEN 既存のモックシステムが動作する
3. WHEN エラーが発生する THEN 既存のエラーハンドリングシステムが機能する
4. WHEN テストが実行される THEN 既存のテストが引き続き通る
5. WHEN 段階的移行が行われる THEN 一部機能のみSupabase化が可能である

### Requirement 7: パフォーマンス最適化

**User Story:** As a user, I want the app to be fast and responsive, so that I can use it smoothly even during late-night feeding sessions.

#### Acceptance Criteria

1. WHEN データが取得される THEN RTK Queryでキャッシュされる
2. WHEN 同じデータが再要求される THEN キャッシュから即座に返される
3. WHEN 楽観的更新が実行される THEN UIが即座に反応する
4. WHEN ネットワークエラーが発生する THEN 適切にリトライされる
5. WHEN バックグラウンド同期が実行される THEN ユーザー体験を阻害しない

### Requirement 8: セキュリティ強化

**User Story:** As a mother using this app, I want my data to be secure and my anonymity to be protected, so that I can share safely.

#### Acceptance Criteria

1. WHEN Row Level Security (RLS) が適用される THEN ユーザーは自分のデータのみアクセス可能である
2. WHEN 匿名投稿が作成される THEN 個人を特定できる情報が含まれない
3. WHEN JWTトークンが使用される THEN 適切な有効期限と権限が設定される
4. WHEN データベースアクセスが行われる THEN 認証されたユーザーのみアクセス可能である
5. WHEN セキュリティポリシーが違反される THEN アクセスが拒否される