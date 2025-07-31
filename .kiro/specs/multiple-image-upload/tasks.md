# Implementation Plan

- [ ] 1. 型定義とインターフェースの拡張
  - 複数画像対応のための型定義を追加
  - ImageAssetWithCaption型の作成
  - PostImage型の定義
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. ImageUploadManagerの複数画像対応拡張
  - [ ] 2.1 複数画像選択機能の実装
    - selectMultipleImages メソッドの追加
    - 最大5枚制限の実装
    - エラーハンドリングの追加
    - _Requirements: 1.1, 1.4_

  - [ ] 2.2 並列画像処理機能の実装
    - processMultipleImages メソッドの追加
    - 並列処理によるパフォーマンス最適化
    - プログレス管理機能
    - _Requirements: 4.1, 4.2_

  - [ ] 2.3 並列アップロード機能の実装
    - uploadMultipleImages メソッドの追加
    - 個別画像のアップロード状態管理
    - 失敗時のリトライ機能
    - _Requirements: 4.3, 4.4, 4.5_

- [ ] 3. ImagePreviewThumbnailコンポーネントの作成
  - [ ] 3.1 基本サムネイル表示機能
    - 80x80dpサイズのサムネイル表示
    - 削除ボタン（X）の実装
    - タップ時の拡大表示機能
    - _Requirements: 2.1, 2.4_

  - [ ] 3.2 アクセシビリティ対応
    - 48x48dp以上のタップエリア確保
    - スクリーンリーダー対応のalt text
    - 高コントラスト表示対応
    - _Requirements: 5.1, 5.3_

- [ ] 4. ImagePreviewCarouselコンポーネントの作成
  - [ ] 4.1 水平スクロール表示機能
    - ScrollViewを使用した水平スクロール実装
    - 小さめサムネイルでの全画像表示
    - スムーズなスクロール動作
    - _Requirements: 2.1, 2.2_

  - [ ] 4.2 ドラッグ&ドロップ並び替え機能
    - react-native-gesture-handlerを使用した実装
    - 視覚的フィードバックの提供
    - 並び替え後の状態更新
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 4.3 アクセシビリティとジェスチャー対応
    - タッチとスワイプジェスチャーの両対応
    - 片手操作での使いやすさ確保
    - 読み込み状態の明確な表示
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 5. ImageCaptionInputコンポーネントの作成
  - [ ] 5.1 モーダル形式のキャプション入力UI
    - モーダル表示でのキャプション入力画面
    - 100文字制限の実装
    - 保存・キャンセル機能
    - _Requirements: 6.1, 6.2_

  - [ ] 5.2 キャプション表示機能
    - プレビュー画面でのキャプション表示
    - 投稿時のキャプション含有
    - 画像との関連付け管理
    - _Requirements: 6.3, 6.4_

- [ ] 6. MultipleImageUploadComponentの作成
  - [ ] 6.1 既存ImageUploadButtonの拡張
    - 複数画像選択機能の統合
    - 最大枚数制限の実装
    - 選択画像の状態管理
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 6.2 プレビュー機能の統合
    - ImagePreviewCarouselとの連携
    - 画像削除機能の実装
    - リアルタイム状態更新
    - _Requirements: 2.1, 2.4_

- [ ] 7. Redux状態管理の拡張
  - [ ] 7.1 imageSliceの複数画像対応
    - MultipleImageUploadState型の追加
    - 複数画像選択アクションの実装
    - 画像並び替えアクションの追加
    - _Requirements: 3.4_

  - [ ] 7.2 アップロード進捗管理
    - 個別画像のアップロード状態追跡
    - 全体進捗の計算機能
    - エラー状態の管理
    - _Requirements: 4.2, 4.3_

- [ ] 8. 投稿作成画面の統合
  - [ ] 8.1 post.tsxでのMultipleImageUploadComponent統合
    - 既存のImageUploadButtonを新コンポーネントに置換
    - 複数画像データの状態管理
    - 投稿時の画像データ処理
    - _Requirements: 1.1, 1.2_

  - [ ] 8.2 投稿データ構造の更新
    - PostsServiceでの複数画像対応
    - Supabaseデータベーススキーマ更新
    - 画像URL配列の処理実装
    - _Requirements: 6.3, 6.4_

- [ ] 9. エラーハンドリングとパフォーマンス最適化
  - [ ] 9.1 包括的エラーハンドリング
    - 選択時エラー（最大枚数超過、形式不正）の処理
    - アップロード失敗時の個別リトライ機能
    - ユーザーフレンドリーなエラーメッセージ表示
    - _Requirements: 1.4, 4.4, 4.5_

  - [ ] 9.2 パフォーマンス最適化
    - 画像圧縮とサムネイル生成の最適化
    - メモリ使用量の監視と制御
    - 並列処理による高速化実装
    - _Requirements: 4.1, 4.2_

- [ ] 10. テストの実装
  - [ ] 10.1 単体テストの作成
    - MultipleImageUploadComponentのテスト
    - ImagePreviewCarouselのテスト
    - ImageUploadManager拡張機能のテスト
    - _Requirements: 全要件のテストカバレッジ_

  - [ ] 10.2 統合テストの作成
    - エンドツーエンドの画像投稿フローテスト
    - エラー発生時の復旧テスト
    - アクセシビリティ機能のテスト
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 11. 最終統合とデバッグ
  - [ ] 11.1 全機能の統合テスト
    - 複数画像選択から投稿完了までの全フロー確認
    - 各種エラーケースでの動作確認
    - パフォーマンス指標の測定
    - _Requirements: 全要件の統合確認_

  - [ ] 11.2 UI/UXの最終調整
    - プレビューサイズの最適化
    - スクロール動作の調整
    - アクセシビリティ要件の最終確認
    - _Requirements: 2.1, 2.2, 5.1, 5.2_