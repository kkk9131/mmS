# GitHub ワークフロー ベストプラクティス

## 📋 目次

1. [ブランチ戦略](#ブランチ戦略)
2. [コミットメッセージ規約](#コミットメッセージ規約)
3. [プルリクエストガイドライン](#プルリクエストガイドライン)
4. [コードレビュープロセス](#コードレビュープロセス)
5. [GitHub Actions CI/CD](#github-actions-cicd)
6. [Issue管理](#issue管理)
7. [リリースプロセス](#リリースプロセス)

## 🌿 ブランチ戦略

### Git Flow ベースの戦略

```
main (本番)
├── develop (開発統合)
│   ├── feature/user-authentication
│   ├── feature/post-creation
│   └── feature/ai-empathy-bot
├── hotfix/critical-bug-fix
└── release/v1.0.0
```

### ブランチの種類

| ブランチ | 用途 | 命名規則 | 例 |
|---------|------|----------|-----|
| `main` | 本番環境 | `main` | `main` |
| `develop` | 開発統合 | `develop` | `develop` |
| `feature/*` | 新機能開発 | `feature/機能名` | `feature/user-auth` |
| `bugfix/*` | バグ修正 | `bugfix/バグ名` | `bugfix/login-error` |
| `hotfix/*` | 緊急修正 | `hotfix/修正名` | `hotfix/security-patch` |
| `release/*` | リリース準備 | `release/バージョン` | `release/v1.0.0` |

### ブランチ作成・運用ルール

```bash
# 1. 最新のdevelopから機能ブランチを作成
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 作業完了後、developにマージ
git checkout develop
git merge feature/new-feature
git push origin develop

# 3. 不要になったブランチを削除
git branch -d feature/new-feature
git push origin --delete feature/new-feature
```

## 📝 コミットメッセージ規約

### Conventional Commits 形式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### コミットタイプ

| タイプ | 説明 | 例 |
|--------|------|-----|
| `feat` | 新機能 | `feat: add user authentication` |
| `fix` | バグ修正 | `fix: resolve login validation error` |
| `docs` | ドキュメント | `docs: update API documentation` |
| `style` | コードスタイル | `style: format code with prettier` |
| `refactor` | リファクタリング | `refactor: optimize post loading logic` |
| `test` | テスト | `test: add unit tests for auth service` |
| `chore` | その他 | `chore: update dependencies` |
| `perf` | パフォーマンス | `perf: improve image loading speed` |
| `ci` | CI/CD | `ci: add automated testing workflow` |

### コミットメッセージ例

```bash
# 良い例
feat(auth): add biometric authentication support

- Implement fingerprint and face ID login
- Add fallback to PIN authentication
- Update security documentation

Closes #123

# 悪い例
fix bug
update code
changes
```

### コミットのベストプラクティス

- **1つのコミットは1つの変更**に集中
- **現在形で記述**（"add" not "added"）
- **50文字以内**の簡潔な説明
- **本文は72文字で改行**
- **なぜ変更したかを説明**

## 🔄 プルリクエストガイドライン

### PRテンプレート

```markdown
## 📋 変更内容

### 🎯 目的
- [ ] 新機能追加
- [ ] バグ修正
- [ ] リファクタリング
- [ ] ドキュメント更新
- [ ] その他: ___________

### 📝 変更詳細
<!-- 何を変更したかを具体的に記述 -->

### 🧪 テスト
- [ ] 単体テスト追加/更新
- [ ] 統合テスト実行
- [ ] 手動テスト完了
- [ ] テストケース: ___________

### 📱 動作確認
- [ ] iOS
- [ ] Android  
- [ ] Web

### 🔗 関連Issue
Closes #___

### 📸 スクリーンショット
<!-- UI変更がある場合は必須 -->

### ⚠️ 注意事項
<!-- レビュアーが注意すべき点があれば記述 -->
```

### PRのベストプラクティス

1. **小さく分割**：大きな変更は複数のPRに分割
2. **明確なタイトル**：変更内容が一目でわかるタイトル
3. **詳細な説明**：なぜ・何を・どのように変更したか
4. **セルフレビュー**：提出前に自分でコードを確認
5. **テスト完了**：すべてのテストが通ることを確認

## 👥 コードレビュープロセス

### レビュアーの責任

- **24時間以内**にレビュー開始
- **建設的なフィードバック**を提供
- **セキュリティ・パフォーマンス**の観点でチェック
- **コーディング規約**の遵守確認

### レビューチェックリスト

#### 🔍 コード品質
- [ ] コードは読みやすく理解しやすい
- [ ] 適切な変数名・関数名を使用
- [ ] 重複コードがない
- [ ] エラーハンドリングが適切

#### 🛡️ セキュリティ
- [ ] 入力値の検証が適切
- [ ] 認証・認可が正しく実装
- [ ] 機密情報がハードコードされていない

#### ⚡ パフォーマンス
- [ ] 不要な再レンダリングがない
- [ ] メモリリークの可能性がない
- [ ] 適切なデータ構造を使用

#### 🧪 テスト
- [ ] 適切なテストカバレッジ
- [ ] エッジケースのテスト
- [ ] テストが意味のあるものか

### レビューコメント例

```markdown
# 良いコメント例
💡 **提案**: この部分はuseMemoを使用することで、パフォーマンスが向上する可能性があります。

🐛 **問題**: この条件分岐では、nullの場合の処理が不足しています。

✨ **良い点**: エラーハンドリングが丁寧に実装されていて素晴らしいです！

# 悪いコメント例
これは間違っている
変更してください
なぜこうしたの？
```

## 🤖 GitHub Actions CI/CD

### ワークフロー構成

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npx tsc --noEmit
      
      - name: Run tests
        run: npm test
      
      - name: Build project
        run: npm run build:web

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: echo "Deploy to production"
```

### 必須チェック項目

- ✅ **Linting**: ESLint + Prettier
- ✅ **Type Check**: TypeScript型チェック
- ✅ **Testing**: Jest + React Native Testing Library
- ✅ **Build**: 本番ビルド成功確認
- ✅ **Security**: 依存関係の脆弱性チェック

## 📋 Issue管理

### Issueテンプレート

#### 🐛 バグレポート
```markdown
## 🐛 バグの概要
<!-- バグの簡潔な説明 -->

## 🔄 再現手順
1. 
2. 
3. 

## 🎯 期待される動作
<!-- 本来どうあるべきか -->

## 📱 実際の動作
<!-- 実際に何が起こるか -->

## 🖼️ スクリーンショット
<!-- 可能であれば添付 -->

## 🔧 環境情報
- OS: 
- ブラウザ: 
- アプリバージョン: 

## 📝 追加情報
<!-- その他の関連情報 -->
```

#### ✨ 機能リクエスト
```markdown
## 🎯 機能の概要
<!-- 新機能の簡潔な説明 -->

## 💡 動機・背景
<!-- なぜこの機能が必要か -->

## 📋 詳細な要件
<!-- 具体的な要件や仕様 -->

## 🎨 UI/UXの考慮事項
<!-- デザインやユーザビリティの観点 -->

## ✅ 受け入れ条件
- [ ] 条件1
- [ ] 条件2
- [ ] 条件3

## 📝 追加情報
<!-- その他の関連情報 -->
```

### Issueラベル体系

| カテゴリ | ラベル | 色 | 説明 |
|---------|--------|-----|------|
| **タイプ** | `bug` | `#d73a4a` | バグ報告 |
| | `enhancement` | `#a2eeef` | 新機能・改善 |
| | `documentation` | `#0075ca` | ドキュメント |
| **優先度** | `priority: high` | `#b60205` | 高優先度 |
| | `priority: medium` | `#fbca04` | 中優先度 |
| | `priority: low` | `#0e8a16` | 低優先度 |
| **ステータス** | `status: in progress` | `#ededed` | 作業中 |
| | `status: blocked` | `#000000` | ブロック中 |
| **コンポーネント** | `component: auth` | `#c5def5` | 認証関連 |
| | `component: ui` | `#f9d0c4` | UI関連 |

## 🚀 リリースプロセス

### セマンティックバージョニング

```
MAJOR.MINOR.PATCH (例: 1.2.3)
```

- **MAJOR**: 破壊的変更
- **MINOR**: 後方互換性のある新機能
- **PATCH**: 後方互換性のあるバグ修正

### リリース手順

1. **リリースブランチ作成**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.2.0
   ```

2. **バージョン更新**
   ```bash
   npm version minor  # package.jsonのバージョン更新
   ```

3. **リリースノート作成**
   ```markdown
   ## v1.2.0 (2024-01-15)
   
   ### ✨ 新機能
   - AI共感ボット機能を追加
   - ダークモード対応
   
   ### 🐛 バグ修正
   - ログイン時のバリデーションエラーを修正
   - 投稿表示の不具合を解消
   
   ### 🔧 改善
   - パフォーマンスの最適化
   - UIの微調整
   ```

4. **本番デプロイ**
   ```bash
   git checkout main
   git merge release/v1.2.0
   git tag v1.2.0
   git push origin main --tags
   ```

### リリース後の作業

- [ ] developブランチにマージ
- [ ] リリースブランチ削除
- [ ] GitHub Releaseページ更新
- [ ] チーム通知
- [ ] ドキュメント更新

## 🔧 開発環境セットアップ

### 必須ツール

```bash
# Git設定
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# コミットメッセージテンプレート設定
git config --global commit.template ~/.gitmessage

# .gitmessage ファイル作成
echo "# <type>[optional scope]: <description>
#
# [optional body]
#
# [optional footer(s)]" > ~/.gitmessage
```

### 推奨VSCode拡張機能

- **GitLens**: Git履歴の可視化
- **Conventional Commits**: コミットメッセージ支援
- **GitHub Pull Requests**: PR管理
- **ESLint**: コード品質チェック
- **Prettier**: コードフォーマット

## 📚 参考資料

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**このワークフローは生きた文書です。チームの成長と共に継続的に改善していきましょう！** 🚀