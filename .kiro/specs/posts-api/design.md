# Design Document

## Overview

投稿関連API実装は、Mamapaceアプリのコア機能である投稿の表示・作成・操作をAPIに接続する機能です。既存のHTTPクライアントと認証システムを活用し、RESTful APIとの通信を実現します。

## Architecture

### システム構成

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Components │    │   Service Layer  │    │   API Endpoints │
│                 │    │                  │    │                 │
│ - HomeScreen    │◄──►│ - PostsService   │◄──►│ GET /posts      │
│ - PostScreen    │    │ - HttpClient     │    │ POST /posts     │
│ - PostCard      │    │ - FeatureFlags   │    │ POST /posts/:id │
│ - CommentModal  │    │ - ErrorHandler   │    │ DELETE /posts/  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### データフロー

1. **投稿一覧取得**: HomeScreen → PostsService → GET /posts → UI更新
2. **投稿作成**: PostScreen → PostsService → POST /posts → HomeScreen遷移
3. **いいね操作**: PostCard → PostsService → POST/DELETE /posts/:id/like → 楽観的更新
4. **コメント機能**: CommentModal → PostsService → GET/POST /posts/:id/comments → モーダル更新

## Components and Interfaces

### PostsService クラス

```typescript
interface PostsService {
  // 投稿一覧取得
  getPosts(page?: number, limit?: number): Promise<PostsResponse>;
  
  // 投稿作成
  createPost(content: string): Promise<Post>;
  
  // いいね操作
  likePost(postId: string): Promise<void>;
  unlikePost(postId: string): Promise<void>;
  
  // コメント機能
  getComments(postId: string): Promise<Comment[]>;
  createComment(postId: string, content: string): Promise<Comment>;
}
```

### データ型定義

```typescript
interface Post {
  id: string;
  content: string;
  authorId: string;
  authorNickname: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  createdAt: string;
}

interface PostsResponse {
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

### API エンドポイント設計

| メソッド | エンドポイント | 説明 | 認証 |
|---------|---------------|------|------|
| GET | `/posts` | 投稿一覧取得 | 必須 |
| POST | `/posts` | 投稿作成 | 必須 |
| POST | `/posts/:id/like` | いいね追加 | 必須 |
| DELETE | `/posts/:id/like` | いいね削除 | 必須 |
| GET | `/posts/:id/comments` | コメント一覧取得 | 必須 |
| POST | `/posts/:id/comments` | コメント作成 | 必須 |

## Data Models

### 投稿データモデル

```typescript
// データベース保存形式
interface PostEntity {
  id: string;
  content: string;
  author_id: string;
  created_at: Date;
  updated_at: Date;
}

// API レスポンス形式
interface PostResponse {
  id: string;
  content: string;
  author: {
    id: string;
    nickname: string;
  };
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

// フロントエンド使用形式
interface Post {
  id: string;
  content: string;
  authorId: string;
  authorNickname: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}
```

### ページネーション設計

```typescript
interface PaginationRequest {
  page: number;      // 1から開始
  limit: number;     // デフォルト20
  cursor?: string;   // カーソルベースページネーション用
}

interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}
```

## Error Handling

### エラー分類と処理

```typescript
enum PostsErrorType {
  NETWORK_ERROR = 'network',
  VALIDATION_ERROR = 'validation',
  AUTHENTICATION_ERROR = 'auth',
  RATE_LIMIT_ERROR = 'rate_limit',
  SERVER_ERROR = 'server'
}

interface PostsError {
  type: PostsErrorType;
  message: string;
  code?: string;
  details?: any;
}
```

### エラーハンドリング戦略

1. **ネットワークエラー**: リトライ機能付きエラー表示
2. **認証エラー**: ログイン画面へリダイレクト
3. **バリデーションエラー**: フィールド固有のエラー表示
4. **レート制限**: 一時的な操作制限通知
5. **サーバーエラー**: 汎用エラーメッセージ

## Testing Strategy

### 単体テスト

```typescript
describe('PostsService', () => {
  describe('getPosts', () => {
    it('正常に投稿一覧を取得できる');
    it('ページネーションが正しく動作する');
    it('ネットワークエラー時に適切にエラーを投げる');
  });
  
  describe('createPost', () => {
    it('正常に投稿を作成できる');
    it('600文字制限を超えた場合にエラーを投げる');
    it('空の投稿でエラーを投げる');
  });
  
  describe('likePost', () => {
    it('正常にいいねを追加できる');
    it('既にいいね済みの場合に適切に処理する');
  });
});
```

### 統合テスト

```typescript
describe('Posts Integration', () => {
  it('投稿作成から一覧表示までの完全フロー');
  it('いいね操作の楽観的更新とロールバック');
  it('コメント作成と表示の連携');
  it('エラー発生時のUI状態管理');
});
```

### モックデータ設計

```typescript
const mockPosts: Post[] = [
  {
    id: 'post_1',
    content: '今日は子供と公園に行きました。天気が良くて気持ちよかったです！',
    authorId: 'user_1',
    authorNickname: 'みさき',
    createdAt: '2024-01-15T10:30:00Z',
    likesCount: 5,
    commentsCount: 2,
    isLiked: false
  },
  // ... 追加のモックデータ
];
```

## Performance Considerations

### 最適化戦略

1. **ページネーション**: 20件ずつの段階的読み込み
2. **楽観的更新**: いいね操作の即座なUI反映
3. **キャッシュ戦略**: 投稿データの一時保存
4. **画像遅延読み込み**: プロフィール画像の最適化
5. **デバウンス**: 検索・フィルター機能の最適化

### メモリ管理

```typescript
class PostsCache {
  private cache = new Map<string, Post>();
  private maxSize = 100;
  
  set(key: string, post: Post): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, post);
  }
  
  get(key: string): Post | undefined {
    return this.cache.get(key);
  }
}
```

## Security Considerations

### データ保護

1. **入力値検証**: XSS攻撃防止のためのサニタイゼーション
2. **認証確認**: 全API呼び出しでのJWTトークン検証
3. **レート制限**: 投稿・いいね・コメントの頻度制限
4. **コンテンツフィルタリング**: 不適切な投稿の検出と処理

### プライバシー保護

```typescript
interface PostSanitizer {
  sanitizeContent(content: string): string;
  validatePostLength(content: string): boolean;
  filterInappropriateContent(content: string): boolean;
}
```

## Implementation Notes

### 機能フラグ活用

```typescript
const FEATURES = {
  USE_POSTS_API: !__DEV__,
  ENABLE_COMMENTS: true,
  ENABLE_LIKES: true,
  DEBUG_POSTS: __DEV__
};
```

### 段階的実装アプローチ

1. **Phase 1**: 投稿一覧取得とモック連携
2. **Phase 2**: 投稿作成機能の実装
3. **Phase 3**: いいね機能の実装
4. **Phase 4**: コメント機能の実装
5. **Phase 5**: エラーハンドリングとテストの完成

### 既存システムとの統合

- **認証システム**: 既存のAuthServiceとの連携
- **HTTPクライアント**: 既存のHttpClientの活用
- **エラーハンドリング**: 統一されたエラー処理システム
- **機能フラグ**: FeatureFlagsManagerとの統合