# エージェント・MCP統合ガイド

## 概要
各専門エージェントに適切なMCPサーバーを統合し、特化した機能を提供します。

## エージェント・MCP統合マッピング

### 🧪 test-automation-expert + Playwright MCP
**役割**: テスト自動化とE2Eテスト実行
**MCPサーバー**: `playwright`

**強化機能**:
- ブラウザ自動化テスト
- UIの視覚的回帰テスト  
- パフォーマンステスト
- クロスプラットフォームテスト

**使用例**:
```
user: "投稿作成フローのE2Eテストを実行して"
→ test-automation-expertがPlaywright MCPを使用して自動テスト実行
```

### 🐛 bug-hunter + Context7 MCP  
**役割**: バグ解析と根本原因特定
**MCPサーバー**: `Context7`

**強化機能**:
- コンテキスト保持によるバグ解析
- 履歴データ追跡
- パターン認識による問題特定
- 継続的監視とアラート

**使用例**:
```
user: "認証エラーが断続的に発生する原因を調査して"
→ bug-hunterがContext7 MCPでコンテキスト分析・パターン解析実行
```

### 🔌 api-integrator + Supabase MCP
**役割**: データベース・API統合管理  
**MCPサーバー**: `supabase`

**強化機能**:
- リアルタイムSupabase操作
- スキーマ・マイグレーション管理
- RLSポリシー設定
- データベース最適化

**使用例**:
```
user: "新しいコメント機能のテーブルを作成して"
→ api-integratorがSupabase MCPで直接DB操作・RLS設定実行
```

## MCP統合の利点

### 🎯 特化した専門性
- 各エージェントが最適なツールを使用
- 作業効率の向上
- エラー率の低減

### 🔄 シームレスな連携
- エージェント間の情報共有
- 統合されたワークフロー
- 一貫した品質管理

### 📊 拡張された機能
- リアルタイムデータアクセス
- 高度な自動化
- 包括的な監視・分析

## 使用時の自動選択

Claude Codeは以下の条件で自動的に適切なエージェント・MCP組み合わせを選択します：

1. **テスト関連タスク** → test-automation-expert + Playwright
2. **バグ・問題解決** → bug-hunter + Context7  
3. **API・DB操作** → api-integrator + Supabase

## 設定確認

現在のMCPサーバー状況:
```bash
claude mcp list
```

この統合により、各エージェントがより効果的で専門的なサポートを提供できます。