# 設計書

## 概要

この設計書は、Mamapaceアプリの残りの基本機能（ユーザー管理、通知、フォロー機能）のAPI連携実装について詳述します。既存の認証APIと投稿APIの基盤を活用し、プロフィール管理、通知システム、フォロー機能を統合して、母親向けSNSとしての完全なユーザー体験を実現します。

## アーキテクチャ

### システム構成
```
Frontend (React Native/Expo)
├── Profile Management
├── Notification System  
├── Follow System
└── Integration Layer

Backend API
├── User Management Endpoints
├── Notification Endpoints
├── Follow Relationship Endpoints
└── Authentication (既存)
```

### データフロー
1. **プロフィール管理**: ユーザー情報の取得・更新
2. **通知システム**: 通知の取得・既読管理
3. **フォローシステム**: フォロー関係の作成・削除・一覧取得
4. **統合レイヤー**: 既存の認証・投稿APIとの連携

## コンポーネントとインターフェース

### 1. ユーザー管理サービス (UserService)

#### インターフェース
```typescript
interface UserService {
  getCurrentUser(): Promise<User>;
  updateProfile(data: UpdateProfileData): Promise<User>;
  getUserById(id: string): Promise<User>;
  getFollowList(type: 'following' | 'followers'): Promise<User[]>;
}

interface User {
  id: string;
  nickname: string;
  maternalHealthBookNumber: string;
  createdAt: string;
  followingCount: number;
  followersCount: number;
  postsCount: number;
}

interface UpdateProfileData {
  nickname?: string;
}
```

#### API エンドポイント
- `GET /users/me` - 自分の情報取得
- `PUT /users/me` - プロフィール更新
- `GET /users/:id` - 他ユーザー情報取得
- `GET /users/me/following` - フォロー中ユーザー一覧
- `GET /users/me/followers` - フォロワー一覧

### 2. 通知サービス (NotificationService)

#### インターフェース
```typescript
interface NotificationService {
  getNotifications(): Promise<Notification[]>;
  markAsRead(notificationIds: string[]): Promise<void>;
  getUnreadCount(): Promise<number>;
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  fromUser: User;
  targetPost?: Post;
  message: string;
  isRead: boolean;
  createdAt: string;
}
```

#### API エンドポイント
- `GET /notifications` - 通知一覧取得
- `PUT /notifications/read` - 既読状態更新
- `GET /notifications/unread-count` - 未読数取得

### 3. フォローサービス (FollowService)

#### インターフェース
```typescript
interface FollowService {
  followUser(userId: string): Promise<void>;
  unfollowUser(userId: string): Promise<void>;
  checkFollowStatus(userId: string): Promise<boolean>;
}
```

#### API エンドポイント
- `POST /users/:id/follow` - フォロー
- `DELETE /users/:id/follow` - フォロー解除
- `GET /users/:id/follow-status` - フォロー状態確認

### 4. 統合サービス (IntegrationService)

#### 責任
- 既存の認証システムとの連携
- エラーハンドリングの統一
- ローディング状態の管理
- キャッシュ戦略の実装

## データモデル

### User拡張
既存のUser型を拡張し、フォロー関連情報を追加：

```typescript
interface User {
  id: string;
  nickname: string;
  maternalHealthBookNumber: string;
  createdAt: string;
  followingCount: number;
  followersCount: number;
  postsCount: number;
  isFollowing?: boolean; // 現在のユーザーがフォローしているか
}
```

### Notification
```typescript
interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  fromUser: User;
  targetPost?: Post;
  message: string;
  isRead: boolean;
  createdAt: string;
}
```

### Follow Relationship
```typescript
interface FollowRelationship {
  followerId: string;
  followingId: string;
  createdAt: string;
}
```

## エラーハンドリング

### エラー分類
1. **ネットワークエラー**: 接続失敗、タイムアウト
2. **認証エラー**: トークン無効、権限不足
3. **バリデーションエラー**: 入力データ不正
4. **サーバーエラー**: 500系エラー

### エラー処理戦略
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// エラーハンドリング例
const handleApiError = (error: ApiError) => {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'ネットワーク接続を確認してください';
    case 'UNAUTHORIZED':
      return 'ログインが必要です';
    case 'VALIDATION_ERROR':
      return error.message;
    default:
      return 'エラーが発生しました。しばらく待ってから再試行してください';
  }
};
```

## テスト戦略

### 1. ユニットテスト
- 各サービスクラスの個別機能テスト
- モックAPIレスポンスを使用したテスト
- エラーケースの網羅的テスト

### 2. 統合テスト
- 認証→プロフィール取得→更新の完全フロー
- 通知取得→既読更新の完全フロー
- フォロー→フォロー解除の完全フロー

### 3. E2Eテスト
- ユーザーストーリーに基づく完全なユーザーフロー
- 複数画面間の連携テスト
- オフライン→オンライン復帰テスト

### 4. パフォーマンステスト
- API応答時間の測定（目標: 500ms以内）
- 大量データでの動作確認
- メモリ使用量の監視

## セキュリティ考慮事項

### 1. 認証・認可
- JWTトークンの自動送信
- トークン有効期限の管理
- 権限チェックの実装

### 2. データ保護
- 個人情報の適切な取り扱い
- 母子手帳番号の暗号化
- ログ出力時の機密情報マスキング

### 3. 入力検証
- クライアントサイドバリデーション
- サーバーサイドバリデーション
- XSS対策

## パフォーマンス最適化

### 1. キャッシュ戦略
```typescript
interface CacheStrategy {
  userProfile: '5分間キャッシュ';
  notifications: '1分間キャッシュ';
  followList: '10分間キャッシュ';
}
```

### 2. 楽観的更新
- フォロー/フォロー解除の即座UI更新
- 通知既読状態の即座反映
- エラー時のロールバック機能

### 3. バッチ処理
- 複数通知の一括既読処理
- フォロー状態の一括取得

## 実装フェーズ

### Phase 1: 基盤整備
- サービスクラスの作成
- 型定義の整備
- エラーハンドリングの統一

### Phase 2: プロフィール機能
- プロフィール表示・編集画面の実装
- ユーザー情報取得・更新API連携

### Phase 3: 通知機能
- 通知一覧画面の実装
- 通知取得・既読API連携
- 通知バッジの実装

### Phase 4: フォロー機能
- フォロー・フォロワー一覧画面の実装
- フォロー関係API連携
- フォロー状態の管理

### Phase 5: 統合・テスト
- 全機能の統合テスト
- パフォーマンス最適化
- セキュリティ検証

## 品質保証

### コード品質
- TypeScript strict mode
- ESLint/Prettier設定
- コードレビュープロセス

### テストカバレッジ
- 目標: 80%以上
- 重要な機能: 90%以上
- エラーケース: 100%

### ドキュメント
- API仕様書の更新
- 実装ガイドの作成
- トラブルシューティングガイド