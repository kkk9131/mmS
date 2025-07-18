# 設計文書

## 概要

Mamapacea アプリのディレクトリ構造を、React Native + Expo のベストプラクティスに従った推奨構成に移行する。現在の構造から段階的に移行し、すべてのインポートパスを適切に更新する。

## アーキテクチャ

### 現在の構造
```
mamapace/
├── app/                 # Expo Router pages (既に適切)
├── components/          # UI components (既に適切)
├── services/           # Business logic (既に適切)
├── hooks/              # Custom hooks (既に適切)
├── types/              # TypeScript types (既に適切)
├── assets/             # Static assets (既に適切)
└── .kiro/              # Kiro configuration (既に適切)
```

### 推奨構造（移行後）
```
mamapace/
├── src/                 # 新しいソースディレクトリ
│   ├── app/            # Expo Router pages
│   ├── components/     # Reusable UI components
│   ├── services/       # Business logic & API services
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── constants/      # App constants
│   └── styles/         # Shared styles
├── assets/             # Static assets (images, fonts)
├── .expo/              # Expo configuration
├── .kiro/              # Kiro AI configuration
└── [config files]     # Root level config files
```

## コンポーネントと インターフェース

### ディレクトリ移行戦略

#### フェーズ 1: src/ ディレクトリの作成
- 新しい `src/` ディレクトリを作成
- 既存のディレクトリを `src/` 内に移動
- TypeScript 設定とパスエイリアスを更新

#### フェーズ 2: ファイル移動と整理
- `app/` → `src/app/`
- `components/` → `src/components/`
- `services/` → `src/services/`
- `hooks/` → `src/hooks/`
- `types/` → `src/types/`

#### フェーズ 3: 新しいディレクトリの追加
- `src/utils/` - ユーティリティ関数
- `src/constants/` - アプリ定数
- `src/styles/` - 共有スタイル

#### フェーズ 4: インポートパスの更新
- 全ファイルのインポート文を `@/` エイリアス使用に更新
- 相対パスを絶対パスに変更

### ファイル命名規則

#### 画面ファイル (src/app/)
- kebab-case: `chat-list.tsx`, `profile-edit.tsx`
- 既存のファイル名は適切なので変更不要

#### コンポーネント (src/components/)
- PascalCase: `PostCard.tsx`, `AIEmpathyBot.tsx`
- 既存のファイル名は適切なので変更不要

#### サービス (src/services/)
- camelCase + Service: `aiEmpathyService.ts`, `safetyService.ts`
- 既存のファイル名は適切なので変更不要

#### フック (src/hooks/)
- camelCase + use prefix: `useFrameworkReady.ts`
- 既存のファイル名は適切なので変更不要

## データモデル

### 設定ファイルの更新

#### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/app/*": ["src/app/*"],
      "@/components/*": ["src/components/*"],
      "@/services/*": ["src/services/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/constants/*": ["src/constants/*"],
      "@/styles/*": ["src/styles/*"]
    }
  }
}
```

#### metro.config.js (必要に応じて)
```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// src/ ディレクトリをソースルートとして設定
config.resolver.alias = {
  '@': './src',
};

module.exports = config;
```

## エラーハンドリング

### 移行中のエラー対策

1. **インポートエラー**
   - 段階的移行により、一時的にインポートパスが混在する可能性
   - TypeScript コンパイラーでエラーを検出し、順次修正

2. **パスエイリアス設定エラー**
   - tsconfig.json の設定ミスによるパス解決エラー
   - Metro bundler の設定も必要に応じて更新

3. **Expo Router 設定エラー**
   - app/ ディレクトリ移動後の Expo Router 設定確認
   - _layout.tsx ファイルのパス参照更新

## テスト戦略

### 移行検証手順

1. **TypeScript コンパイル確認**
   ```bash
   npx tsc --noEmit
   ```

2. **アプリ起動確認**
   ```bash
   npm run dev
   ```

3. **主要機能テスト**
   - ログイン画面の表示
   - タイムライン表示
   - 投稿機能
   - AI共感ボット応答
   - ナビゲーション動作

4. **ビルド確認**
   ```bash
   npm run build:web
   ```

### 回帰テスト項目

- [ ] アプリが正常に起動する
- [ ] 全画面が正しく表示される
- [ ] ナビゲーションが正常に動作する
- [ ] コンポーネント間の連携が正常
- [ ] サービス層の機能が正常
- [ ] TypeScript エラーが発生しない
- [ ] Web ビルドが成功する

## 実装上の考慮事項

### 段階的移行のメリット
- 機能を壊すリスクを最小化
- 各段階での動作確認が可能
- 問題発生時の切り戻しが容易

### パフォーマンスへの影響
- ディレクトリ構造変更によるパフォーマンス影響は最小限
- バンドルサイズに変更なし
- インポートパスの最適化により、わずかな改善の可能性

### 開発体験の向上
- ファイル検索の効率化
- コードの可読性向上
- 新機能追加時の配置場所の明確化
- チーム開発での一貫性確保