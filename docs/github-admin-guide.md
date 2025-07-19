# GitHub 管理者向け設定管理ガイド

## 📋 目次

1. [初期設定](#初期設定)
2. [ブランチ保護ルール設定](#ブランチ保護ルール設定)
3. [GitHub Actions設定](#github-actions設定)
4. [セキュリティ設定](#セキュリティ設定)
5. [メンテナンス](#メンテナンス)
6. [トラブルシューティング](#トラブルシューティング)

## 🚀 初期設定

### 1. リポジトリ設定

1. **Settings → General**
   - Default branch: `main`
   - Features:
     - ✅ Issues
     - ✅ Projects
     - ✅ Wiki (オプション)
   - Pull Requests:
     - ✅ Allow squash merging
     - ✅ Allow merge commits
     - ✅ Allow rebase merging
     - ✅ Automatically delete head branches

### 2. アクセス権限設定

1. **Settings → Manage access**
   ```
   Admin: tech-leads
   Write: developers
   Read: contractors
   ```

2. **チーム作成**
   - `@frontend-team`
   - `@backend-team`
   - `@devops-team`
   - `@qa-team`

## 🛡️ ブランチ保護ルール設定

### mainブランチの保護

1. **Settings → Branches → Add rule**

2. **Branch name pattern**: `main`

3. **設定項目**:
   ```yaml
   ✅ Require a pull request before merging
      ✅ Require approvals: 2
      ✅ Dismiss stale pull request approvals
      ✅ Require review from CODEOWNERS
      ✅ Restrict who can dismiss PR reviews
   
   ✅ Require status checks to pass before merging
      ✅ Require branches to be up to date
      必須ステータスチェック:
      - Security Audit
      - Lint and Type Check
      - Run Tests
      - Build Application
   
   ✅ Require conversation resolution before merging
   ✅ Require signed commits (オプション)
   ✅ Require linear history
   ✅ Include administrators
   ✅ Restrict who can push to matching branches
   ```

### developブランチの保護

mainブランチと同様の設定で、以下を調整：
- Required approvals: 1
- Include administrators: オフ

## 🤖 GitHub Actions設定

### 1. Secrets設定

**Settings → Secrets and variables → Actions**

必須シークレット：
```bash
SLACK_WEBHOOK_URL     # Slack通知用
DEPLOY_KEY           # デプロイ用SSH鍵
AWS_ACCESS_KEY_ID    # AWS認証（使用する場合）
AWS_SECRET_ACCESS_KEY
```

### 2. Actions権限設定

**Settings → Actions → General**

```yaml
Actions permissions:
  ✅ Allow all actions and reusable workflows

Workflow permissions:
  ✅ Read and write permissions
  ✅ Allow GitHub Actions to create and approve pull requests
```

### 3. 環境設定

**Settings → Environments**

#### Production環境
```yaml
名前: production
保護ルール:
  ✅ Required reviewers
  レビュアー: @tech-leads
  ✅ Wait timer: 5 minutes
  Deployment branches: main のみ
```

#### Staging環境
```yaml
名前: staging
保護ルール:
  Deployment branches: develop のみ
```

## 🔒 セキュリティ設定

### 1. Security Policy

`.github/SECURITY.md` を作成：

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

セキュリティ脆弱性を発見した場合：

1. **公開しない**: GitHubのIssueには記載しない
2. **連絡先**: security@example.com
3. **詳細情報**: 
   - 脆弱性の説明
   - 再現手順
   - 影響範囲
   - 可能であれば修正案

48時間以内に対応します。
```

### 2. Dependabot設定

`.github/dependabot.yml` を作成：

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 10
    reviewers:
      - "devops-team"
    labels:
      - "dependencies"
      - "automated"
```

### 3. Code scanning設定

**Settings → Security → Code scanning**
- Enable CodeQL analysis
- Schedule: Weekly

## 🔧 メンテナンス

### 定期タスク

#### 週次
- [ ] Dependabot PR のレビュー
- [ ] セキュリティアラートの確認
- [ ] ワークフロー実行状況の確認

#### 月次
- [ ] 不要なブランチの削除
- [ ] Actions使用量の確認
- [ ] アクセス権限の棚卸し

#### 四半期
- [ ] ブランチ保護ルールの見直し
- [ ] ワークフロー最適化
- [ ] ドキュメント更新

### ブランチクリーンアップ

```bash
# マージ済みブランチの確認
git branch -r --merged main | grep -v main | grep -v develop

# 削除（慎重に）
git push origin --delete branch-name
```

### ワークフロー最適化

1. **実行時間の確認**
   - Actions → ワークフロー選択 → Usage

2. **キャッシュ利用状況**
   ```yaml
   - uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

3. **並列実行の活用**
   ```yaml
   strategy:
     matrix:
       node-version: [18, 20]
   ```

## 🆘 トラブルシューティング

### よくある問題

#### 1. ワークフローが実行されない

確認事項：
- ブランチ名が正しいか
- YAMLシンタックスエラーがないか
- 権限設定が適切か

```bash
# ローカルでYAML検証
yamllint .github/workflows/ci.yml
```

#### 2. PRがマージできない

確認事項：
- 必須ステータスチェックが通っているか
- レビュー承認数が足りているか
- ブランチが最新か

解決方法：
```bash
# ブランチを最新に
git checkout feature-branch
git pull origin develop
git push origin feature-branch
```

#### 3. Secrets が機能しない

確認事項：
- Secret名が正しいか（大文字小文字区別）
- 環境指定が正しいか
- ワークフローでの参照方法

```yaml
# 正しい参照方法
env:
  MY_SECRET: ${{ secrets.MY_SECRET }}
```

#### 4. デプロイが失敗する

デバッグ手順：
1. ワークフローログを確認
2. 環境変数を確認
3. 権限を確認
4. 手動でコマンドを実行してテスト

### 緊急時の対応

#### 本番デプロイの緊急停止

1. **Actions → 実行中のワークフロー → Cancel workflow**
2. **Settings → Environments → production → Lock**

#### セキュリティインシデント

1. 影響を受けるシークレットを即座に無効化
2. アクセスログを確認
3. 新しいシークレットを生成
4. 影響範囲を調査

### 監視とアラート

#### GitHub Actions の監視

```bash
# GitHub CLI を使用
gh workflow list
gh run list
gh run view <run-id>
```

#### 通知設定

1. **Settings → Notifications**
2. **Workflow runs**: Failed runs only
3. **Security alerts**: All activity

## 📊 メトリクスとレポート

### 収集すべきメトリクス

1. **ワークフロー成功率**
   ```
   成功率 = (成功した実行数 / 総実行数) × 100
   ```

2. **平均実行時間**
   - CI/CD: < 10分目標
   - テスト: < 5分目標

3. **PR マージまでの時間**
   - 目標: 24時間以内

### レポート生成

```bash
# GitHub CLI でワークフロー統計を取得
gh api repos/:owner/:repo/actions/runs \
  --jq '.workflow_runs[] | {name: .name, status: .status, created: .created_at}'
```

## 🔐 セキュリティベストプラクティス

1. **最小権限の原則**
   - 必要最小限の権限のみ付与
   - 定期的な権限レビュー

2. **シークレット管理**
   - 定期的なローテーション
   - 使用されていないシークレットの削除
   - 環境別の分離

3. **監査ログ**
   - 定期的なレビュー
   - 異常なアクティビティの検知

4. **依存関係管理**
   - Dependabotアラートへの迅速な対応
   - 定期的なアップデート

## 📚 参考資料

- [GitHub Docs - 管理者向け](https://docs.github.com/ja/organizations)
- [GitHub Actions セキュリティガイド](https://docs.github.com/ja/actions/security-guides)
- [ブランチ保護ルール](https://docs.github.com/ja/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

---

**このガイドは機密情報を含む可能性があるため、アクセス制限を適切に設定してください。**