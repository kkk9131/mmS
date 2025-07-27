# 🚀 画像アップロード機能の簡単セットアップ

## 方法1: Supabaseダッシュボード（推奨）

### 1. ストレージバケットを作成
1. [Supabaseダッシュボード](https://app.supabase.com/project/jikjfizabtmvogijjspn/storage/buckets) を開く
2. 「New bucket」をクリック
3. 以下の設定で2つのバケットを作成:

#### postsバケット
- **Name**: `posts`
- **Public bucket**: ✅ ON
- **File size limit**: `10MB`
- **Allowed MIME types**: 
  ```
  image/jpeg
  image/jpg
  image/png
  image/webp
  image/gif
  ```

#### avatarsバケット
- **Name**: `avatars`
- **Public bucket**: ✅ ON
- **File size limit**: `5MB`
- **Allowed MIME types**:
  ```
  image/jpeg
  image/jpg
  image/png
  image/webp
  ```

### 2. RLSポリシーを設定
1. [SQL Editor](https://app.supabase.com/project/jikjfizabtmvogijjspn/sql/new) を開く
2. `src/scripts/setup-storage-buckets.sql` の内容をコピー
3. 実行（Runボタンをクリック）

## 方法2: 自動セットアップスクリプト

### 前提条件
- Service Role Keyが必要（[Settings > API](https://app.supabase.com/project/jikjfizabtmvogijjspn/settings/api) から取得）

### 実行方法
```bash
# Service Role Keyを環境変数に設定して実行
SUPABASE_SERVICE_KEY="your-service-role-key" npm run setup:storage
```

## 🎉 セットアップ完了！

セットアップが完了したら、アプリから画像をアップロードできるようになります。

## ❓ トラブルシューティング

### "Bucket not found" エラー
→ バケットが作成されていません。上記の手順を実行してください。

### "row-level security policy violation" エラー
→ RLSポリシーが設定されていません。SQL Editorでスクリプトを実行してください。

### "Invalid JWT" エラー
→ ログインし直してください。

## 📝 注意事項
- Service Role Keyは絶対に公開しないでください
- 本番環境では、より厳密なアクセス制御を検討してください