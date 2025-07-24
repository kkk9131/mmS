# プッシュ通知システム

Mamapaceアプリのための包括的なプッシュ通知システムです。Expo Notificationsを基盤とし、Supabaseと統合されています。

## 概要

このシステムは以下の機能を提供します：

- プッシュトークンの管理
- 通知の作成・送信・受信
- 通知設定の管理（カテゴリ別、おやすみモードなど）
- リアルタイム通知
- Redux統合

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App                        │
├─────────────────────────────────────────────────────────────┤
│  useNotifications Hook                                      │
│  ├─ NotificationService                                     │
│  ├─ PushTokenManager                                        │
│  ├─ NotificationHandler                                     │
│  └─ NotificationSettingsManager                             │
├─────────────────────────────────────────────────────────────┤
│  Redux Store (RTK Query)                                    │
│  └─ notificationsApi                                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase                                                   │
│  ├─ Database Tables                                         │
│  ├─ Realtime Subscriptions                                 │
│  └─ Edge Functions                                          │
├─────────────────────────────────────────────────────────────┤
│  Expo Notifications                                         │
│  └─ FCM/APNs                                               │
└─────────────────────────────────────────────────────────────┘
```

## セットアップ

### 1. 依存関係のインストール

必要なパッケージは既にインストール済みです：
- expo-notifications
- expo-device
- expo-constants

### 2. app.jsonの設定

通知設定は既に追加済みです：

```json
{
  "notification": {
    "icon": "./assets/images/notification-icon.png",
    "color": "#4F46E5",
    "androidMode": "default",
    "androidCollapsedTitle": "新しい通知があります"
  },
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/images/notification-icon.png",
      "color": "#ffffff",
      "defaultChannel": "default"
    }]
  ]
}
```

### 3. データベーステーブルの作成

SQLファイル `sql/001_create_push_notifications_tables.sql` を実行してテーブルを作成してください。

### 4. Edge Functionのデプロイ

`supabase/functions/send-push-notification/index.ts` をSupabaseにデプロイしてください。

## 使用方法

### アプリの初期化時

```typescript
import { useNotifications } from '../hooks/useNotifications';

function App() {
  const { initializeNotifications, requestNotificationPermissions } = useNotifications({
    autoInitialize: true,
    requestPermissionsOnMount: true,
  });

  // アプリ起動時に自動実行される
  return <YourAppContent />;
}
```

### 通知の作成・送信

```typescript
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../services/notifications/NotificationHandler';

function PostComponent() {
  const { createNotification } = useNotifications();

  const handleLike = async (postId: string, postAuthorId: string) => {
    // いいね処理...
    
    // プッシュ通知を送信
    await createNotification({
      userId: postAuthorId,
      type: NotificationType.LIKE,
      title: 'いいねされました',
      message: 'あなたの投稿にいいねがつきました',
      data: { postId },
      actionUrl: `/posts/${postId}`,
    });
  };

  return <YourPostComponent onLike={handleLike} />;
}
```

### Redux APIの使用

```typescript
import { 
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useUpdateNotificationSettingsMutation 
} from '../store/api/notificationsApi';

function NotificationsScreen() {
  const { data: notifications, isLoading } = useGetNotificationsQuery({
    page: 0,
    limit: 20,
  });
  
  const [markAsRead] = useMarkAsReadMutation();
  const [updateSettings] = useUpdateNotificationSettingsMutation();

  const handleNotificationTap = (notificationId: string) => {
    markAsRead(notificationId);
  };

  const toggleLikeNotifications = (enabled: boolean) => {
    updateSettings({
      userId: currentUser.id,
      settings: { likes: enabled },
    });
  };

  return (
    // UI implementation
  );
}
```

### リアルタイム通知の監視

```typescript
import { useRealtimeNotifications } from '../hooks/useNotifications';

function useNotificationListener() {
  const { subscribeToNotifications } = useRealtimeNotifications();

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notification) => {
      // 新しい通知を受信した時の処理
      console.log('新しい通知:', notification);
      
      // カスタムUI表示やサウンド再生など
    });

    return unsubscribe;
  }, [subscribeToNotifications]);
}
```

## 設定

### 通知設定の管理

```typescript
import { useNotificationSettings } from '../hooks/useNotifications';

function NotificationSettingsScreen() {
  const { getSettings, updateSettings, isQuietHours } = useNotificationSettings();

  const loadSettings = async () => {
    const settings = await getSettings();
    console.log('現在の設定:', settings);
  };

  const toggleQuietHours = async (start: string, end: string) => {
    await updateSettings({
      quietHoursStart: start,
      quietHoursEnd: end,
    });
  };

  return (
    // 設定UI
  );
}
```

### 通知タイプ

以下の通知タイプが利用可能です：

```typescript
enum NotificationType {
  LIKE = 'like',           // いいね
  COMMENT = 'comment',     // コメント
  FOLLOW = 'follow',       // フォロー
  MESSAGE = 'message',     // メッセージ
  MENTION = 'mention',     // メンション
  POST_REPLY = 'post_reply', // 投稿への返信
  SYSTEM = 'system'        // システム通知
}
```

## デバッグ

### 通知のテスト

```typescript
// 開発環境でのテスト通知送信
const testNotification = async () => {
  await createNotification({
    userId: 'current-user-id',
    type: NotificationType.SYSTEM,
    title: 'テスト通知',
    message: 'これはテスト通知です',
    actionUrl: '/test',
  });
};
```

### ログの確認

通知システムは詳細なログを出力します：

```javascript
// プッシュトークン登録
console.log('プッシュトークンが正常に登録されました');

// 通知送信
console.log('通知が正常に作成・送信されました:', notificationId);

// エラー
console.error('プッシュ通知送信エラー:', error);
```

## トラブルシューティング

### よくある問題

1. **プッシュ通知が届かない**
   - デバイスが実機か確認
   - 通知権限が許可されているか確認
   - プッシュトークンが正しく登録されているか確認

2. **権限エラー**
   - `requestNotificationPermissions()` を呼び出す
   - デバイス設定で通知が有効になっているか確認

3. **おやすみモードで通知が送信されない**
   - 緊急通知として分類されているか確認
   - 通知設定のおやすみ時間を確認

### エラーハンドリング

```typescript
try {
  await createNotification(params);
} catch (error) {
  if (error.message.includes('権限')) {
    // 権限関連エラーの処理
    await requestNotificationPermissions();
  } else if (error.message.includes('トークン')) {
    // トークン関連エラーの処理
    await initializeNotifications();
  }
}
```

## テスト

### 単体テスト実行

```bash
npm test src/services/notifications/__tests__/
```

### テストカバレッジ

主要なコンポーネントのテストが含まれています：
- PushTokenManager
- NotificationService
- 通知権限の処理
- エラーハンドリング

## パフォーマンス考慮事項

- 通知設定は5分間キャッシュされます
- バッチ処理により複数の通知を効率的に送信
- リアルタイム更新により即座にUI反映
- 楽観的更新によりユーザーエクスペリエンス向上

## セキュリティ

- Row Level Security (RLS) によるデータ保護
- プッシュトークンの暗号化保存
- 個人情報の最小化
- 監査ログの記録