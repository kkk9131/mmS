# GitHub ワークフロー使用ガイド

## 📋 目次

1. [はじめに](#はじめに)
2. [開発フロー](#開発フロー)
3. [ブランチ運用](#ブランチ運用)
4. [コミット規約](#コミット規約)
5. [プルリクエスト作成](#プルリクエスト作成)
6. [コードレビュー](#コードレビュー)
7. [CI/CDパイプライン](#cicdパイプライン)
8. [トラブルシューティング](#トラブルシューティング)

## 🚀 はじめに

このガイドは、チームメンバーがGitHubワークフローを効率的に利用するための実践的な手順書です。

### 前提条件

- Git の基本的な知識
- GitHub アカウント
- リポジトリへのアクセス権限

## 🔄 開発フロー

### 1. 新機能開発の流れ

```bash
# 1. 最新のdevelopブランチを取得
git checkout develop
git pull origin develop

# 2. 機能ブランチを作成
git checkout -b feature/your-feature-name

# 3. 開発作業
# ... コードを編集 ...

# 4. 変更をコミット
git add .
git commit -m "feat: add new feature description"

# 5. リモートにプッシュ
git push origin feature/your-feature-name

# 6. GitHubでプルリクエストを作成
```

### 2. バグ修正の流れ

```bash
# 1. 最新のdevelopブランチを取得
git checkout develop
git pull origin develop

# 2. バグ修正ブランチを作成
git checkout -b bugfix/issue-description

# 3. バグを修正
# ... コードを編集 ...

# 4. 変更をコミット
git add .
git commit -m "fix: resolve issue with login validation"

# 5. プッシュしてPRを作成
git push origin bugfix/issue-description
```

## 🌿 ブランチ運用

### ブランチ命名規則

| ブランチタイプ | 命名パターン | 例 |
|--------------|-------------|-----|
| 機能追加 | `feature/機能名` | `feature/user-authentication` |
| バグ修正 | `bugfix/問題の説明` | `bugfix/login-error` |
| 緊急修正 | `hotfix/修正内容` | `hotfix/security-patch` |
| リリース | `release/バージョン` | `release/v1.2.0` |

### 保護されたブランチ

- **main**: 本番環境（直接プッシュ禁止）
- **develop**: 開発環境（直接プッシュ禁止）

## 📝 コミット規約

### Conventional Commits形式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### よく使うタイプ

| タイプ | 使用場面 | 例 |
|--------|---------|-----|
| `feat` | 新機能追加 | `feat: ユーザー認証機能を追加` |
| `fix` | バグ修正 | `fix: ログインエラーを修正` |
| `docs` | ドキュメント変更 | `docs: READMEを更新` |
| `style` | コードスタイル変更 | `style: インデントを修正` |
| `refactor` | リファクタリング | `refactor: 認証ロジックを最適化` |
| `test` | テスト追加・修正 | `test: ユーザーサービスのテストを追加` |
| `chore` | ビルド・ツール変更 | `chore: 依存関係を更新` |

### コミット例

```bash
# 良い例
git commit -m "feat(auth): バイオメトリック認証を実装"
git commit -m "fix(ui): ダークモードでのボタン表示を修正"
git commit -m "docs: APIドキュメントを追加"

# 悪い例
git commit -m "更新"
git commit -m "バグ修正"
git commit -m "WIP"
```

## 🔀 プルリクエスト作成

### PR作成前のチェックリスト

- [ ] 最新のdevelopブランチをマージ済み
- [ ] テストがすべて通る
- [ ] ESLintエラーがない
- [ ] TypeScriptエラーがない
- [ ] 不要なconsole.logを削除

### PR作成手順

1. **GitHubでPRを作成**
   - developブランチに向けてPRを作成
   - テンプレートに従って記入

2. **タイトルの付け方**
   ```
   feat: ユーザープロフィール編集機能を追加
   fix: 投稿一覧の無限スクロールバグを修正
   ```

3. **説明の書き方**
   - 何を変更したか
   - なぜ変更したか
   - どのように動作確認したか
   - スクリーンショット（UI変更の場合）

### PR テンプレートの使い方

```markdown
## 概要
このPRで実装した機能の簡潔な説明

## 変更内容
- 実装した機能1
- 修正したバグ1
- リファクタリング内容

## 動作確認
- [x] iOS実機で確認
- [x] Android実機で確認
- [x] Webブラウザで確認

## スクリーンショット
変更前：
変更後：

## 関連Issue
Closes #123
```

## 👀 コードレビュー

### レビュアーとして

1. **24時間以内にレビュー開始**
2. **建設的なフィードバック**を心がける
3. **以下の観点でチェック**：
   - コードの可読性
   - パフォーマンス
   - セキュリティ
   - テストカバレッジ
   - ベストプラクティス

### レビューコメントの書き方

```markdown
# 提案
💡 ここは `useMemo` を使用することでパフォーマンスが向上します。

# 質問
❓ この処理の意図を教えていただけますか？

# 必須修正
🚨 nullチェックが必要です。

# 称賛
👍 エラーハンドリングが丁寧で素晴らしいです！
```

### レビュイーとして

1. **フィードバックに感謝**する
2. **質問には丁寧に回答**
3. **修正完了後はコメントで報告**
4. **re-requestレビュー**を忘れずに

## 🤖 CI/CDパイプライン

### 自動実行されるチェック

1. **セキュリティ監査** - npm audit
2. **コード品質** - ESLint
3. **コードフォーマット** - Prettier
4. **型チェック** - TypeScript
5. **テスト** - Jest
6. **ビルド** - 本番ビルドの確認

### CI失敗時の対処法

#### ESLintエラー

```bash
# ローカルで修正
npm run lint
npm run lint:fix  # 自動修正可能なものは修正
```

#### TypeScriptエラー

```bash
# エラー内容を確認
npx tsc --noEmit
```

#### テスト失敗

```bash
# テストを実行して詳細を確認
npm test
npm test -- --watch  # ウォッチモードで開発
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. PR作成時にCIが失敗する

```bash
# ローカルで全チェックを実行
npm run lint
npx tsc --noEmit
npm test
npm run build
```

#### 2. コミットメッセージが拒否される

正しい形式：
```bash
git commit -m "feat: 新機能を追加"
git commit -m "fix(auth): ログインバグを修正"
```

#### 3. マージコンフリクトが発生

```bash
# 最新のdevelopを取り込む
git checkout develop
git pull origin develop
git checkout your-branch
git merge develop

# コンフリクトを解決
# エディタでコンフリクトマーカーを修正

# 解決をコミット
git add .
git commit -m "chore: merge develop and resolve conflicts"
```

#### 4. ブランチ保護によりマージできない

- すべての必須チェックが通っているか確認
- 必要なレビュー承認数を満たしているか確認
- ブランチが最新か確認

### デバッグ用コマンド

```bash
# Git設定確認
git config --list

# リモートブランチ確認
git branch -r

# 変更状態確認
git status

# コミット履歴確認
git log --oneline --graph --all

# 特定ファイルの変更履歴
git log -p path/to/file
```

## 📚 参考リンク

- [Conventional Commits](https://www.conventionalcommits.org/ja/)
- [GitHub Flow](https://docs.github.com/ja/get-started/quickstart/github-flow)
- [Git チートシート](https://training.github.com/downloads/ja/github-git-cheat-sheet/)

## 💡 ベストプラクティス

1. **小さく頻繁にコミット**
2. **わかりやすいコミットメッセージ**
3. **PRは小さく保つ**（300行以下推奨）
4. **テストを書く習慣**
5. **ドキュメントを更新**
6. **レビューは迅速に**

## 🆘 ヘルプ

問題が解決しない場合は：

1. チームリーダーに相談
2. `#dev-help` Slackチャンネルで質問
3. GitHub Issueを作成

---

**このガイドは定期的に更新されます。改善提案は歓迎です！** 🚀