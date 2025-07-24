# プッシュ通知システム API仕様書

## 概要
Mamapaceアプリのプッシュ通知システムのAPI仕様および技術仕様を記載します。

## アーキテクチャ
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │    Supabase     │    │  Expo Push API  │
│      Client     │◄──►│   Edge Functions │◄──►│    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│   Local Storage │    │   PostgreSQL    │
│     (Cache)     │    │    Database     │
└─────────────────┘    └─────────────────┘
```

## データベーススキーマ

### notifications テーブル
```sql
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### push_tokens テーブル
```sql
CREATE TABLE push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);
```

### notification_settings テーブル
```sql
CREATE TABLE notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  likes_enabled BOOLEAN DEFAULT TRUE,
  comments_enabled BOOLEAN DEFAULT TRUE,
  follows_enabled BOOLEAN DEFAULT TRUE,
  messages_enabled BOOLEAN DEFAULT TRUE,
  mentions_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API エンドポイント

### 1. プッシュトークン管理

#### POST /rest/v1/push_tokens
プッシュトークンを登録・更新します。

**リクエスト:**
```json
{
  "user_id": "uuid",
  "token": "ExponentPushToken[xxx]",
  "platform": "ios|android",
  "device_id": "string"
}
```

**レスポンス:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "token": "ExponentPushToken[xxx]",
  "platform": "ios",
  "device_id": "string",
  "is_active": true,
  "created_at": "2023-01-01T00:00:00Z"
}
```

#### DELETE /rest/v1/push_tokens?user_id=eq.{userId}&device_id=eq.{deviceId}
特定デバイスのプッシュトークンを削除します。

### 2. 通知管理

#### GET /rest/v1/notifications?user_id=eq.{userId}
ユーザーの通知一覧を取得します。

**クエリパラメータ:**
- `limit`: 取得件数 (デフォルト: 20, 最大: 100)
- `offset`: オフセット
- `type`: 通知タイプでフィルタ
- `is_read`: 既読状態でフィルタ

**レスポンス:**
```json
[
  {
    "id": "uuid",
    "type": "like",
    "title": "いいねを受け取りました",
    "message": "田中さんがあなたの投稿にいいねしました",
    "data": {
      "post_id": "uuid",
      "from_user_id": "uuid"
    },
    "action_url": "/posts/uuid",
    "is_read": false,
    "created_at": "2023-01-01T00:00:00Z"
  }
]
```

#### PATCH /rest/v1/notifications?id=eq.{notificationId}
通知を既読にします。

**リクエスト:**
```json
{
  "is_read": true,
  "read_at": "2023-01-01T00:00:00Z"
}
```

#### GET /rest/v1/notifications?user_id=eq.{userId}&is_read=eq.false
未読通知数を取得します。

### 3. 通知設定

#### GET /rest/v1/notification_settings?user_id=eq.{userId}
ユーザーの通知設定を取得します。

#### POST /rest/v1/notification_settings
通知設定を作成・更新します（UPSERT）。

**リクエスト:**
```json
{
  "user_id": "uuid",
  "push_enabled": true,
  "likes_enabled": true,
  "comments_enabled": true,
  "follows_enabled": true,
  "messages_enabled": true,
  "mentions_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00"
}
```

## Edge Functions

### send-push-notification
プッシュ通知を送信するEdge Function。

**URL:** `/functions/v1/send-push-notification`

**リクエスト:**
```json
{
  "notification": {
    "user_id": "uuid",
    "type": "like",
    "title": "通知タイトル",
    "message": "通知メッセージ",
    "data": {},
    "action_url": "/posts/123"
  }
}
```

**処理フロー:**
1. ユーザーの通知設定をチェック
2. おやすみモードの確認
3. プッシュトークンの取得
4. Expo Push APIへの送信
5. 配信結果の記録

### notification-trigger
データベーストリガーから呼び出される通知処理Function。

**処理内容:**
- 新しい通知レコードが作成された際に自動実行
- バックグラウンドでプッシュ通知を送信
- エラーハンドリングと再送処理

## クライアントSDK

### NotificationService
```typescript
class NotificationService {
  // 初期化
  async initializePushNotifications(userId: string): Promise<void>
  
  // 通知取得
  async getNotifications(userId: string, options?: GetNotificationsOptions): Promise<Notification[]>
  
  // 既読処理
  async markNotificationAsRead(notificationId: string): Promise<void>
  async markAllNotificationsAsRead(userId: string): Promise<void>
  
  // 設定管理
  async getNotificationSettings(userId: string): Promise<NotificationSettings>
  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void>
}
```

### PushTokenManager
```typescript
class PushTokenManager {
  // トークン管理
  async getExpoPushToken(): Promise<string>
  async registerToken(userId: string, token: string): Promise<void>
  async updateToken(userId: string, newToken: string): Promise<void>
  
  // 権限管理
  async checkPermissions(): Promise<NotificationPermissionsStatus>
  async requestPermissions(): Promise<NotificationPermissionsStatus>
}
```

### NotificationHandler
```typescript
class NotificationHandler {
  // ハンドラー設定
  setNotificationHandler(): void
  
  // 通知処理
  handleForegroundNotification(notification: Notification): Promise<void>
  handleNotificationResponse(response: NotificationResponse): Promise<void>
}
```

## React Hook

### useEnhancedNotifications
```typescript
function useEnhancedNotifications(options?: UseEnhancedNotificationsOptions) {
  return {
    // データ
    notifications: Notification[],
    unreadCount: number,
    settings: NotificationSettings | null,
    
    // 状態
    isLoading: boolean,
    isInitialized: boolean,
    isOnline: boolean,
    
    // 操作
    markAsRead: (id: string) => Promise<void>,
    markAllAsRead: () => Promise<void>,
    updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>,
    
    // システム
    initialize: () => Promise<void>,
    refetch: () => void,
    
    // メトリクス
    getPerformanceMetrics: () => Promise<PerformanceMetrics>,
    getQueueStats: () => Promise<QueueStats>,
    getErrorStats: () => Promise<ErrorStats>
  }
}
```

## セキュリティ

### Row Level Security (RLS)
すべてのテーブルでRLSを有効化し、以下のポリシーを適用：

```sql
-- notifications テーブル
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- push_tokens テーブル
CREATE POLICY "Users can manage own push tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- notification_settings テーブル
CREATE POLICY "Users can manage own notification settings" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);
```

### データ暗号化
- プッシュトークンは AES-256-GCM で暗号化して保存
- 個人情報を含む通知データは最小化
- 監査ログの記録

## パフォーマンス最適化

### キャッシュ戦略
- **通知データ**: 5分間のLRUキャッシュ
- **設定データ**: 10分間のLRUキャッシュ  
- **プッシュトークン**: 30分間のFIFOキャッシュ

### レート制限
- **プッシュ通知**: 100件/分
- **設定更新**: 10件/30秒
- **トークン更新**: 5件/5分

### バッチ処理
- 通知配信: 5-20件のバッチサイズで動的調整
- システム負荷に応じた自動調整

## 監視・メトリクス

### 主要メトリクス
- **配信成功率**: 95%以上を目標
- **平均配信時間**: 3秒以下を目標  
- **エラー率**: 5%以下を目標
- **エンゲージメント率**: 30%以上を目標

### アラート設定
- 配信成功率が95%を下回った場合
- 平均配信時間が5秒を超えた場合
- エラー率が5%を超えた場合
- トークン無効化率が10%を超えた場合

## エラーハンドリング

### エラータイプと対応
```typescript
enum NotificationErrorType {
  DEVICE_NOT_REGISTERED = 'device_not_registered',
  INVALID_CREDENTIALS = 'invalid_credentials', 
  MESSAGE_TOO_BIG = 'message_too_big',
  MESSAGE_RATE_EXCEEDED = 'message_rate_exceeded',
  INVALID_CREDENTIALS = 'invalid_credentials',
  MISMATCHED_SENDER_ID = 'mismatched_sender_id'
}
```

### 再試行戦略
- **指数バックオフ**: 1秒, 2秒, 4秒, 8秒, 16秒
- **最大試行回数**: 5回
- **永続的エラー**: 再試行しない（デバイス未登録など）

## テスト戦略

### 単体テスト
- 各サービスクラスの機能テスト
- モック使用による分離テスト
- エラーケースの網羅的テスト

### 結合テスト  
- プッシュ通知の送受信フロー
- 設定変更の反映確認
- リアルタイム機能の統合テスト

### パフォーマンステスト
- 大量通知の配信テスト
- 同時接続数の負荷テスト
- メモリ使用量の監視

## デプロイメント

### 段階的ロールアウト
1. **Alpha版**: 開発者のみ (5%)
2. **Beta版**: 限定ユーザー (15%) 
3. **段階リリース**: 25% -> 50% -> 100%

### 機能フラグ
```typescript
const FEATURE_FLAGS = {
  PUSH_NOTIFICATIONS_ENABLED: boolean,
  REALTIME_NOTIFICATIONS_ENABLED: boolean,
  ADVANCED_ANALYTICS_ENABLED: boolean,
  PERFORMANCE_MONITORING_ENABLED: boolean
}
```

### ロールバック計画
- データベースマイグレーションの巻き戻し手順
- 機能フラグによる即座の無効化
- Edge Functionの前バージョンへの復元

## 使用例

### 基本的な実装
```typescript
import { useEnhancedNotifications } from '../hooks/useEnhancedNotifications';

function NotificationScreen() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead
  } = useEnhancedNotifications();

  if (isLoading) return <LoadingSpinner />;

  return (
    <View>
      <Text>未読: {unreadCount}件</Text>
      <Button onPress={markAllAsRead}>全て既読</Button>
      
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onPress={() => markAsRead(notification.id)}
        />
      ))}
    </View>
  );
}
```

### 設定画面の実装
```typescript
import { NotificationSettingsScreen } from '../components/notifications/NotificationSettingsScreen';

function SettingsScreen() {
  return <NotificationSettingsScreen />;
}
```

## サポート・トラブルシューティング

### よくある問題

#### プッシュ通知が届かない
1. 権限設定の確認
2. プッシュトークンの有効性確認
3. おやすみモード設定の確認
4. ネットワーク接続の確認

#### 通知が重複する
1. 重複排除ロジックの確認
2. リアルタイム接続の状態確認
3. キャッシュの整合性確認

#### パフォーマンス問題
1. メトリクス監視の確認
2. キャッシュヒット率の確認
3. データベースクエリの最適化確認

### ログ確認方法
```bash
# Edge Function ログ
supabase functions logs send-push-notification

# データベースログ  
SELECT * FROM pg_stat_activity WHERE query LIKE '%notifications%';

# アプリケーションログ
# React Native Debugger またはコンソールで確認
```

---

**最終更新**: 2023年12月
**バージョン**: 1.0.0  
**作成者**: プッシュ通知システム開発チーム