# プッシュ通知システム設計書

## 概要

Mamapaceアプリのプッシュ通知システムは、Expo Notificationsを基盤として、Supabaseのリアルタイム機能と統合されたシステムです。母親ユーザーが重要な情報をリアルタイムで受け取り、コミュニティとのつながりを維持できるよう設計されています。

## アーキテクチャ

### システム構成図

```mermaid
graph TB
    subgraph "クライアント (React Native)"
        A[Expo Notifications] --> B[Push Token Manager]
        B --> C[Notification Handler]
        C --> D[UI Components]
        E[Realtime Subscription] --> C
        F[Redux Store] --> C
    end
    
    subgraph "Supabase Backend"
        G[Realtime Server] --> H[Notifications Table]
        I[Edge Functions] --> H
        J[Database Triggers] --> G
    end
    
    subgraph "External Services"
        K[FCM (Android)]
        L[APNs (iOS)]
        M[Expo Push Service]
    end
    
    B --> M
    M --> K
    M --> L
    I --> M
    G --> E
```

### データフロー

1. **通知生成**: ユーザーアクション（いいね、コメント等）→ Database Trigger → Edge Function
2. **リアルタイム配信**: Edge Function → Supabase Realtime → クライアント
3. **プッシュ通知**: Edge Function → Expo Push Service → FCM/APNs → デバイス
4. **通知処理**: デバイス受信 → Notification Handler → UI更新

## コンポーネント設計

### 1. Push Token Manager

**責任**: プッシュトークンの取得、管理、更新

```typescript
interface PushTokenManager {
  // トークン取得
  getExpoPushToken(): Promise<string>;
  
  // トークン登録
  registerToken(userId: string, token: string): Promise<void>;
  
  // トークン更新
  updateToken(userId: string, token: string): Promise<void>;
  
  // トークン削除
  removeToken(userId: string): Promise<void>;
  
  // 権限チェック
  checkPermissions(): Promise<NotificationPermissionStatus>;
  
  // 権限リクエスト
  requestPermissions(): Promise<NotificationPermissionStatus>;
}
```

### 2. Notification Handler

**責任**: 通知の受信、処理、表示制御

```typescript
interface NotificationHandler {
  // 通知設定
  setNotificationHandler(handler: NotificationHandlerConfig): void;
  
  // フォアグラウンド通知処理
  handleForegroundNotification(notification: Notification): Promise<void>;
  
  // バックグラウンド通知処理
  handleBackgroundNotification(notification: Notification): Promise<void>;
  
  // 通知タップ処理
  handleNotificationResponse(response: NotificationResponse): Promise<void>;
  
  // 通知音・バイブレーション
  playNotificationEffects(type: NotificationType): Promise<void>;
}
```

### 3. Notification Settings Manager

**責任**: 通知設定の管理、時間帯制御

```typescript
interface NotificationSettingsManager {
  // 設定取得
  getSettings(userId: string): Promise<NotificationSettings>;
  
  // 設定更新
  updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void>;
  
  // おやすみモードチェック
  isQuietHours(): boolean;
  
  // 通知タイプ有効チェック
  isNotificationTypeEnabled(type: NotificationType): boolean;
  
  // 緊急通知チェック
  isEmergencyNotification(notification: Notification): boolean;
}
```

### 4. Notification Queue Manager

**責任**: 通知の一時保存、バッチ処理、再送制御

```typescript
interface NotificationQueueManager {
  // 通知をキューに追加
  enqueue(notification: PendingNotification): Promise<void>;
  
  // キューから通知を取得
  dequeue(): Promise<PendingNotification | null>;
  
  // バッチ処理
  processBatch(batchSize: number): Promise<void>;
  
  // 失敗した通知の再送
  retryFailedNotifications(): Promise<void>;
  
  // キューのクリア
  clearQueue(): Promise<void>;
}
```

## データモデル

### 通知テーブル (notifications)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- インデックス
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_user_unread (user_id, is_read) WHERE is_read = FALSE,
  INDEX idx_notifications_created_at (created_at DESC)
);

-- 通知タイプ
CREATE TYPE notification_type AS ENUM (
  'like',
  'comment', 
  'follow',
  'message',
  'mention',
  'post_reply',
  'system'
);
```

### プッシュトークンテーブル (push_tokens)

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 一意制約
  UNIQUE(user_id, device_id),
  
  -- インデックス
  INDEX idx_push_tokens_user_id (user_id),
  INDEX idx_push_tokens_active (is_active) WHERE is_active = TRUE
);
```

### 通知設定テーブル (notification_settings)

```sql
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  likes_enabled BOOLEAN DEFAULT TRUE,
  comments_enabled BOOLEAN DEFAULT TRUE,
  follows_enabled BOOLEAN DEFAULT TRUE,
  messages_enabled BOOLEAN DEFAULT TRUE,
  mentions_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## インターフェース設計

### 通知データ構造

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

interface NotificationData {
  userId: string;
  userName: string;
  userAvatar: string;
  postId?: string;
  postContent?: string;
  actionUrl: string;
  metadata: Record<string, any>;
}

enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  MESSAGE = 'message',
  MENTION = 'mention',
  POST_REPLY = 'post_reply',
  SYSTEM = 'system'
}
```

### 通知設定構造

```typescript
interface NotificationSettings {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  mentions: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string; // "HH:MM" format
  quietHoursEnd: string;   // "HH:MM" format
}
```

### プッシュ通知ペイロード

```typescript
interface PushNotificationPayload {
  to: string; // Expo Push Token
  sound: 'default' | string;
  title: string;
  body: string;
  data: {
    notificationId: string;
    type: NotificationType;
    actionUrl: string;
    userId: string;
    [key: string]: any;
  };
  badge?: number;
  channelId?: string; // Android
  categoryId?: string; // iOS
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}
```

## エラーハンドリング

### エラータイプ

```typescript
enum NotificationErrorType {
  PERMISSION_DENIED = 'permission_denied',
  TOKEN_INVALID = 'token_invalid',
  NETWORK_ERROR = 'network_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  DEVICE_NOT_REGISTERED = 'device_not_registered',
  MESSAGE_TOO_BIG = 'message_too_big',
  INVALID_CREDENTIALS = 'invalid_credentials',
  INTERNAL_ERROR = 'internal_error'
}

interface NotificationError {
  type: NotificationErrorType;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;
}
```

### エラー処理戦略

1. **権限エラー**: ユーザーに権限設定画面への誘導
2. **トークンエラー**: 自動的にトークン再取得・更新
3. **ネットワークエラー**: 指数バックオフによる再送
4. **クォータエラー**: 送信頻度の制限
5. **デバイス未登録**: トークンの無効化・削除

## テスト戦略

### 単体テスト

```typescript
describe('PushTokenManager', () => {
  test('should get expo push token', async () => {
    const manager = new PushTokenManager();
    const token = await manager.getExpoPushToken();
    expect(token).toMatch(/^ExponentPushToken\[.+\]$/);
  });
  
  test('should handle permission denied', async () => {
    // モック設定
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: 'denied'
    });
    
    const manager = new PushTokenManager();
    await expect(manager.getExpoPushToken()).rejects.toThrow('Permission denied');
  });
});
```

### 統合テスト

```typescript
describe('Notification Integration', () => {
  test('should send and receive notification', async () => {
    // 1. プッシュトークン登録
    const token = await pushTokenManager.getExpoPushToken();
    await pushTokenManager.registerToken(userId, token);
    
    // 2. 通知送信
    await notificationService.createNotification({
      userId,
      type: NotificationType.LIKE,
      title: 'テスト通知',
      message: 'テストメッセージ'
    });
    
    // 3. 通知受信確認
    const notifications = await notificationService.getNotifications();
    expect(notifications.notifications).toHaveLength(1);
  });
});
```

### E2Eテスト

```typescript
describe('Push Notification E2E', () => {
  test('should handle notification tap navigation', async () => {
    // 1. 通知送信
    await sendTestNotification({
      type: 'comment',
      actionUrl: '/posts/123'
    });
    
    // 2. 通知タップシミュレーション
    await device.launchApp({ newInstance: false });
    await device.openNotification();
    
    // 3. 正しい画面に遷移することを確認
    await expect(element(by.id('post-123'))).toBeVisible();
  });
});
```

## セキュリティ考慮事項

### データ保護

1. **個人情報の最小化**: 通知には必要最小限の情報のみ含める
2. **暗号化**: プッシュトークンの暗号化保存
3. **アクセス制御**: RLSによる通知データの保護
4. **監査ログ**: 通知送信履歴の記録

### プライバシー保護

```sql
-- RLS ポリシー例
CREATE POLICY "Users can only see their own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can only update their own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid());
```

## パフォーマンス最適化

### 通知配信最適化

1. **バッチ処理**: 複数通知の一括送信
2. **優先度制御**: 重要度に応じた配信優先度
3. **レート制限**: ユーザーあたりの送信頻度制限
4. **キャッシュ戦略**: 通知設定のキャッシュ

### データベース最適化

```sql
-- パーティショニング（日付別）
CREATE TABLE notifications_2024_01 PARTITION OF notifications
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- インデックス最適化
CREATE INDEX CONCURRENTLY idx_notifications_user_type_created 
ON notifications (user_id, type, created_at DESC);
```

## 監視とメトリクス

### 監視項目

1. **配信成功率**: プッシュ通知の配信成功率
2. **レスポンス時間**: 通知生成から配信までの時間
3. **エラー率**: 各種エラーの発生率
4. **ユーザーエンゲージメント**: 通知開封率、タップ率

### アラート設定

```typescript
interface NotificationMetrics {
  deliverySuccessRate: number;    // 95%以下でアラート
  averageDeliveryTime: number;    // 5秒以上でアラート
  errorRate: number;              // 5%以上でアラート
  tokenInvalidationRate: number;  // 10%以上でアラート
}
```

## 運用考慮事項

### デプロイメント

1. **段階的ロールアウト**: 機能フラグによる段階的展開
2. **A/Bテスト**: 通知内容・タイミングの最適化
3. **ロールバック計画**: 問題発生時の迅速な復旧

### メンテナンス

1. **古い通知の削除**: 定期的なデータクリーンアップ
2. **無効トークンの削除**: 定期的なトークン検証・削除
3. **パフォーマンス監視**: 継続的な性能監視・改善

## 今後の拡張計画

### Phase 1: 基本機能
- Expo Notifications統合
- 基本的なプッシュ通知
- 通知設定管理

### Phase 2: 高度な機能
- リッチ通知（画像、アクション）
- 通知スケジューリング
- 地域別配信

### Phase 3: AI機能
- 通知内容の最適化
- 配信タイミングの学習
- パーソナライゼーション