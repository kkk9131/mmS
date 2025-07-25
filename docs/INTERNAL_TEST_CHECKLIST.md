# 内部テストチェックリスト

## ✅ 即座に開始可能な内部テスト

### **1. 基本動作確認**
- [ ] アプリ起動確認
- [ ] 新規登録フロー
- [ ] ログインフロー
- [ ] ログアウト動作

### **2. 主要機能テスト**
- [ ] 投稿作成（テキストのみ）
- [ ] 投稿作成（画像付き）
- [ ] 投稿一覧表示
- [ ] 投稿詳細表示
- [ ] コメント投稿
- [ ] いいね機能
- [ ] プロフィール表示
- [ ] プロフィール編集

### **3. エッジケーステスト**
- [ ] 長文投稿（1000文字以上）
- [ ] 絵文字投稿
- [ ] ネットワーク切断時の動作
- [ ] バックグラウンドからの復帰
- [ ] 複数画像の同時アップロード

### **4. パフォーマンステスト**
- [ ] 起動時間測定
- [ ] 画面遷移速度
- [ ] スクロールの滑らかさ
- [ ] メモリ使用量確認

### **5. UI/UXチェック**
- [ ] ダークモード対応
- [ ] 文字サイズ変更対応
- [ ] 横画面対応
- [ ] アクセシビリティ機能

## 🔧 デバイステスト

### **必須デバイス**
- [ ] iPhone 15 Pro
- [ ] iPhone 14
- [ ] iPhone 13
- [ ] iPhone SE (3rd)
- [ ] iPhone 12 mini

### **iOS バージョン**
- [ ] iOS 17.x
- [ ] iOS 16.x
- [ ] iOS 15.x（最小サポート）

## 📝 バグトラッキング

### **記録項目**
1. 発生日時
2. デバイス・OS情報
3. 再現手順
4. 期待される動作
5. 実際の動作
6. スクリーンショット/動画
7. 優先度（Critical/High/Medium/Low）

## 🚀 次のビルドに向けて

### **改善優先度**
1. **Critical**: クラッシュ・データ損失
2. **High**: 主要機能の不具合
3. **Medium**: UI/UXの問題
4. **Low**: 軽微な表示崩れ

---
*内部テスト実施者:*
*テスト開始日:*
*最終更新:*