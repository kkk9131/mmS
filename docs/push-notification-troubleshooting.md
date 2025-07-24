# プッシュ通知システム トラブルシューティングガイド

## 概要
Mamapaceアプリのプッシュ通知システムで発生する可能性のある問題と、その診断・解決方法を記載します。

## 問題診断フローチャート

```
プッシュ通知が届かない
         ↓
    権限は許可されているか？
    ↓ No          ↓ Yes
権限要求の実装確認  アプリがフォアグラウンドか？
                ↓ No          ↓ Yes
            バックグラウンド通知  フォアグラウンド通知
            の設定確認          の設定確認
                ↓              ↓
            トークンは有効か？    通知ハンドラーは
                ↓              正常に動作しているか？
            データベース確認      ↓
                              ログ確認
```

## 1. プッシュ通知が届かない

### 1.1 権限が拒否されている

#### 症状
- 通知が一切届かない
- `getExpoPushToken()` で `null` が返される

#### 診断方法
```typescript
// 権限状態の確認
const permissions = await Notifications.getPermissionsAsync();
console.log('通知権限:', permissions);

// 設定画面への案内が必要かどうか確認
if (permissions.status !== 'granted') {
  console.log('権限が許可されていません');
  console.log('canAskAgain:', permissions.canAskAgain);
}
```

#### 解決方法
```typescript
// 権限要求の実装
const { status, canAskAgain } = await Notifications.requestPermissionsAsync();

if (status !== 'granted') {
  if (!canAskAgain) {
    // システム設定への案内
    Alert.alert(
      '通知許可が必要です',
      'プッシュ通知を受け取るには、設定アプリで通知を許可してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() }
      ]
    );
  }
}
```

### 1.2 プッシュトークンが無効

#### 症状
- 通知送信時に `DeviceNotRegistered` エラー
- 特定のデバイスのみ通知が届かない

#### 診断方法
```typescript
// データベースのトークン状態確認
const tokenCheck = await supabase
  .from('push_tokens')
  .select('*')
  .eq('user_id', userId)
  .eq('device_id', deviceId);

console.log('トークン状態:', tokenCheck.data);

// Expo Push APIでの直接確認
const response = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: pushToken,
    title: 'テスト通知',
    body: 'トークン確認用',
  }),
});

const result = await response.json();
console.log('直接送信結果:', result);
```

#### 解決方法
```typescript
// 無効トークンの削除と再登録
async function refreshPushToken(userId: string, deviceId: string) {
  try {
    // 古いトークンを削除
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    // 新しいトークンを取得・登録
    const newToken = await Notifications.getExpoPushTokenAsync();
    if (newToken) {
      await pushTokenManager.registerToken(userId, newToken.data);
      console.log('プッシュトークンを更新しました');
    }
  } catch (error) {
    console.error('トークン更新エラー:', error);
  }
}
```

### 1.3 おやすみモード中

#### 症状
- 特定の時間帯のみ通知が届かない
- システム通知以外が届かない

#### 診断方法
```typescript
// ユーザーの設定確認
const settings = await notificationSettingsManager.getSettings(userId);
const isQuietHours = await notificationSettingsManager.isQuietHoursForUser(userId);

console.log('通知設定:', settings);
console.log('おやすみモード:', isQuietHours);

// 現在時刻とおやすみ時間の比較
const now = new Date();
const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                   now.getMinutes().toString().padStart(2, '0');
console.log('現在時刻:', currentTime);
console.log('おやすみ開始:', settings.quiet_hours_start);
console.log('おやすみ終了:', settings.quiet_hours_end);
```

#### 解決方法
```typescript
// おやすみモードの例外処理
async function sendUrgentNotification(notification: NotificationData) {
  const isQuietHours = await notificationSettingsManager.isQuietHoursForUser(
    notification.userId
  );
  
  // 緊急通知の場合はおやすみモードを無視
  if (notification.type === NotificationType.SYSTEM || notification.urgent) {
    console.log('緊急通知のため、おやすみモードを無視します');
    await sendPushNotification(notification);
  } else if (isQuietHours) {
    console.log('おやすみモード中のため通知を蓄積します');
    await notificationQueueManager.enqueue(notification);
  } else {
    await sendPushNotification(notification);
  }
}
```

### 1.4 Edge Function エラー

#### 症状
- 通知作成は成功するが配信されない
- Edge Function のログにエラーが記録される

#### 診断方法
```bash
# Edge Function のログ確認
supabase functions logs send-push-notification --tail

# 特定期間のエラーログ
supabase functions logs send-push-notification --since="2023-12-01" --until="2023-12-02"
```

#### ログの例とその意味
```
[ERROR] DeviceNotRegistered: プッシュトークンが無効です
→ ユーザーのトークンを削除・再登録が必要

[ERROR] MessageRateExceeded: 送信レート制限に達しました  
→ Expo の制限に引っかかっている、送信間隔を調整

[ERROR] InvalidCredentials: 認証情報が無効です
→ Expo Push API のアクセストークンを確認

[ERROR] MessageTooBig: メッセージサイズが大きすぎます
→ 通知の内容量を削減
```

#### 解決方法
```typescript
// Edge Function のエラーハンドリング強化
export async function sendPushNotificationEdgeFunction(notification: NotificationData) {
  try {
    const result = await supabase.functions.invoke('send-push-notification', {
      body: { notification }
    });
    
    if (result.error) {
      console.error('Edge Function エラー:', result.error);
      
      // エラータイプ別の対応
      switch (result.error.type) {
        case 'DeviceNotRegistered':
          await handleInvalidToken(notification.userId);
          break;
        case 'MessageRateExceeded':
          await notificationQueueManager.delayAndRetry(notification, 60000); // 1分後に再試行
          break;
        default:
          await notificationErrorHandler.handleError(result.error, {
            userId: notification.userId,
            operation: 'edge_function_call'
          });
      }
    }
  } catch (error) {
    console.error('Edge Function 呼び出しエラー:', error);
  }
}
```

## 2. 通知の重複

### 2.1 リアルタイム通知との重複

#### 症状
- 同じ通知が複数回表示される
- アプリ内通知とプッシュ通知が重複

#### 診断方法
```typescript
// 重複通知の確認
const duplicateCheck = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // 過去1時間
  .order('created_at', { ascending: false });

// 同一タイトル・メッセージの通知を確認
const grouped = duplicateCheck.data?.reduce((acc, notification) => {
  const key = `${notification.title}_${notification.message}`;
  acc[key] = (acc[key] || []).concat(notification);
  return acc;
}, {});

console.log('重複候補:', Object.entries(grouped).filter(([_, notifications]) => notifications.length > 1));
```

#### 解決方法
```typescript
// 重複排除ロジックの実装
class NotificationDeduplicator {
  private recentNotifications = new Map<string, number>();
  
  async isDuplicate(notification: NotificationData): Promise<boolean> {
    const key = this.generateNotificationKey(notification);
    const lastSent = this.recentNotifications.get(key);
    const now = Date.now();
    
    // 同じ内容の通知が5分以内に送信されていれば重複とみなす
    if (lastSent && now - lastSent < 300000) {
      console.log('重複通知を検出:', key);
      return true;
    }
    
    this.recentNotifications.set(key, now);
    
    // 古いエントリを削除（メモリリーク防止）
    this.cleanupOldEntries();
    
    return false;
  }
  
  private generateNotificationKey(notification: NotificationData): string {
    return `${notification.userId}_${notification.type}_${notification.title}_${notification.message}`;
  }
  
  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentNotifications) {
      if (now - timestamp > 600000) { // 10分以上古い
        this.recentNotifications.delete(key);
      }
    }
  }
}
```

### 2.2 データベーストリガーの重複実行

#### 症状
- 通知作成時に複数のプッシュ通知が送信される
- ログに同じ通知IDで複数の送信記録

#### 診断方法
```sql
-- トリガーの実行回数確認
SELECT 
  schemaname,
  tablename,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE table_name = 'notifications';

-- 重複する通知送信ログの確認
SELECT 
  notification_id,
  COUNT(*) as send_count,
  array_agg(created_at) as send_times
FROM notification_send_log 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY notification_id
HAVING COUNT(*) > 1;
```

#### 解決方法
```sql
-- トリガーの修正（冪等性の確保）
CREATE OR REPLACE FUNCTION handle_notification_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 既に処理済みかチェック
  IF EXISTS (
    SELECT 1 FROM notification_send_log 
    WHERE notification_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;
  
  -- プッシュ通知送信の Edge Function 呼び出し
  PERFORM net.http_post(
    url := 'https://[project-id].supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [anon-key]"}'::jsonb,
    body := json_build_object('notification_id', NEW.id)::jsonb
  );
  
  -- 送信ログの記録
  INSERT INTO notification_send_log (notification_id, sent_at)
  VALUES (NEW.id, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 3. パフォーマンス問題

### 3.1 配信の遅延

#### 症状
- 通知作成から配信まで時間がかかる
- キューに通知が蓄積される

#### 診断方法
```typescript
// キューの状態確認
const queueStats = await notificationQueueManager.getQueueStats();
console.log('キュー統計:', queueStats);
console.log('処理待ち:', queueStats.totalPending);
console.log('失敗:', queueStats.totalFailed);

// 処理時間の測定
const processingTimes = [];
for (let i = 0; i < 10; i++) {
  const start = Date.now();
  await notificationQueueManager.processBatch(1);
  const time = Date.now() - start;
  processingTimes.push(time);
}
console.log('平均処理時間:', processingTimes.reduce((a, b) => a + b) / processingTimes.length);
```

#### 解決方法
```typescript
// バッチサイズの動的調整
async function optimizeQueueProcessing() {
  const stats = await notificationQueueManager.getQueueStats();
  const systemLoad = await getSystemLoad(); // CPU使用率など
  
  let optimalBatchSize = 10; // デフォルト
  
  if (stats.totalPending > 100) {
    optimalBatchSize = 20; // 多数の待機中通知がある場合は増加
  } else if (systemLoad > 0.8) {
    optimalBatchSize = 5; // システム負荷が高い場合は減少
  }
  
  await notificationQueueManager.setBatchSize(optimalBatchSize);
  console.log('バッチサイズを調整しました:', optimalBatchSize);
}

// 並列処理の最適化
async function processQueueInParallel() {
  const batchSize = 5;
  const concurrency = 3; // 同時実行数
  
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(notificationQueueManager.processBatch(batchSize));
  }
  
  await Promise.allSettled(promises);
}
```

### 3.2 データベースクエリの遅延

#### 症状
- 通知一覧の取得が遅い
- 未読件数の取得に時間がかかる

#### 診断方法
```sql
-- 遅いクエリの特定
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  (100 * total_time / sum(total_time) OVER ()) AS percentage
FROM pg_stat_statements 
WHERE query LIKE '%notifications%'
ORDER BY mean_time DESC
LIMIT 10;

-- インデックスの使用状況確認
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'notifications';
```

#### 解決方法
```sql
-- 最適なインデックスの追加
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
ON notifications (user_id, is_read, created_at DESC) 
WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type_date 
ON notifications (user_id, type, created_at DESC);

-- クエリの最適化
-- 悪い例
SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC;

-- 良い例  
SELECT id, type, title, message, is_read, created_at
FROM notifications 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 20;
```

### 3.3 メモリ使用量の増加

#### 症状
- アプリの動作が重い
- キャッシュサイズが異常に大きい

#### 診断方法
```typescript
// メモリ使用量の確認
const memoryStats = await notificationPerformanceOptimizer.getMemoryUsage();
console.log('メモリ使用量:', memoryStats);

// キャッシュ統計の確認
const cacheStats = {
  notifications: await notificationPerformanceOptimizer.getCacheSize('notifications'),
  settings: await notificationPerformanceOptimizer.getCacheSize('settings'),
  tokens: await notificationPerformanceOptimizer.getCacheSize('tokens')
};
console.log('キャッシュサイズ:', cacheStats);
```

#### 解決方法
```typescript
// メモリ最適化の実行
async function optimizeMemoryUsage() {
  // 期限切れキャッシュの削除
  await notificationPerformanceOptimizer.optimizeMemoryUsage();
  
  // キャッシュサイズの制限
  const maxCacheSize = 50; // 50件まで
  await notificationPerformanceOptimizer.setCacheLimit('notifications', maxCacheSize);
  
  // 不要なデータの削除
  await notificationPerformanceOptimizer.clearStaleData();
  
  console.log('メモリ使用量を最適化しました');
}

// 定期的なクリーンアップ
setInterval(async () => {
  await optimizeMemoryUsage();
}, 10 * 60 * 1000); // 10分ごと
```

## 4. 設定・UI関連の問題

### 4.1 設定が反映されない

#### 症状
- 通知設定を変更しても通知が届く/届かない
- アプリ再起動後に設定が元に戻る

#### 診断方法
```typescript
// 設定の同期状態確認
const localSettings = await notificationSettingsManager.getLocalSettings(userId);
const serverSettings = await notificationSettingsManager.getServerSettings(userId);

console.log('ローカル設定:', localSettings);
console.log('サーバー設定:', serverSettings);
console.log('設定の差分:', deepDiff(localSettings, serverSettings));

// キャッシュ状態の確認
const cachedSettings = await notificationPerformanceOptimizer.cacheGet('settings', userId);
console.log('キャッシュされた設定:', cachedSettings);
```

#### 解決方法
```typescript
// 設定の強制同期
async function forceSyncSettings(userId: string) {
  try {
    // キャッシュをクリア
    await notificationPerformanceOptimizer.cacheInvalidate('settings', userId);
    
    // サーバーから最新設定を取得
    const serverSettings = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (serverSettings.data) {
      // ローカルストレージに保存
      await AsyncStorage.setItem(
        `notification_settings_${userId}`,
        JSON.stringify(serverSettings.data)
      );
      
      console.log('設定を強制同期しました');
    }
  } catch (error) {
    console.error('設定同期エラー:', error);
  }
}

// 設定変更時の検証
async function updateSettingsWithValidation(userId: string, newSettings: any) {
  try {
    // バリデーション
    if (!isValidNotificationSettings(newSettings)) {
      throw new Error('無効な設定値です');
    }
    
    // サーバー更新
    const { error } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        ...newSettings,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    // ローカル更新
    await AsyncStorage.setItem(
      `notification_settings_${userId}`,
      JSON.stringify(newSettings)
    );
    
    // キャッシュ更新
    await notificationPerformanceOptimizer.cacheSet('settings', userId, newSettings);
    
    console.log('設定を更新しました');
  } catch (error) {
    console.error('設定更新エラー:', error);
    throw error;
  }
}
```

### 4.2 UI表示の問題

#### 症状
- 未読バッジが正しく表示されない
- 通知一覧の表示が遅い
- スクロール時にカクつく

#### 診断方法
```typescript
// バッジ数の確認
const badgeCount = await badgeManager.getBadgeCount();
const actualUnreadCount = await supabase
  .from('notifications')
  .select('id', { count: 'exact' })
  .eq('user_id', userId)
  .eq('is_read', false);

console.log('バッジ数:', badgeCount);
console.log('実際の未読数:', actualUnreadCount.count);

// 通知一覧の取得時間測定
const start = Date.now();
const notifications = await notificationPerformanceOptimizer.optimizeNotificationQuery(
  userId,
  { limit: 20 }
);
const loadTime = Date.now() - start;
console.log('一覧取得時間:', loadTime, 'ms');
```

#### 解決方法
```typescript
// バッジ数の同期修正
async function syncBadgeCount(userId: string) {
  try {
    // データベースから正確な未読数を取得
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    // バッジを更新
    await badgeManager.setBadgeCount(count || 0);
    
    // アプリアイコンのバッジも更新
    await Notifications.setBadgeCountAsync(count || 0);
    
    console.log('バッジ数を同期しました:', count);
  } catch (error) {
    console.error('バッジ同期エラー:', error);
  }
}

// 通知一覧のパフォーマンス最適化
const NotificationList = React.memo(({ notifications, onNotificationPress }) => {
  const renderNotification = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onPress={() => onNotificationPress(item.id)}
    />
  ), [onNotificationPress]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <FlatList
      data={notifications}
      renderItem={renderNotification}
      keyExtractor={keyExtractor}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={20}
      getItemLayout={(data, index) => ({
        length: 80, // 通知アイテムの高さ
        offset: 80 * index,
        index,
      })}
    />
  );
});
```

## 5. セキュリティ関連の問題

### 5.1 不正なアクセス

#### 症状
- 他のユーザーの通知が見える
- 認証なしで通知にアクセスできる

#### 診断方法
```sql
-- RLSポリシーの確認
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('notifications', 'push_tokens', 'notification_settings');

-- 不正アクセスの痕跡確認
SELECT 
  user_id,
  COUNT(*) as access_count,
  array_agg(DISTINCT created_at::date) as access_dates
FROM notifications 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY access_count DESC;
```

#### 解決方法
```sql
-- RLSポリシーの強化
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    auth.uid() = user_id 
    AND auth.role() = 'authenticated'
    AND auth.jwt() ->> 'aud' = 'authenticated'
  );

-- より厳密なアクセス制御
CREATE POLICY "Restrict notification updates" ON notifications
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND auth.role() = 'authenticated'
    AND updated_at < NOW() + INTERVAL '1 minute' -- 更新時刻制限
  );
```

### 5.2 プッシュトークンの漏洩

#### 症状
- 不正な通知送信の痕跡
- 異常な送信量の検出

#### 診断方法
```typescript
// 異常な送信パターンの検出
const suspiciousActivity = await supabase
  .from('notification_send_log')
  .select('*')
  .gte('sent_at', new Date(Date.now() - 3600000).toISOString())
  .order('sent_at', { ascending: false });

// 送信元IPアドレスの確認（ログから）
console.log('最近の送信活動:', suspiciousActivity.data);

// トークンの使用頻度確認
const tokenUsage = await supabase
  .from('push_tokens')
  .select(`
    token,
    user_id,
    created_at,
    updated_at,
    (SELECT COUNT(*) FROM notification_send_log nsl 
     WHERE nsl.push_token = push_tokens.token 
     AND nsl.sent_at > NOW() - INTERVAL '1 hour') as recent_usage
  `)
  .order('recent_usage', { ascending: false });

console.log('トークン使用状況:', tokenUsage.data);
```

#### 解決方法
```typescript
// プッシュトークンの再生成
async function regenerateAllPushTokens() {
  try {
    // 全ユーザーのトークンを無効化
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .neq('id', 'impossible-id'); // 全レコード対象
    
    // アプリ側でトークン再取得を促す通知
    await supabase
      .from('system_notifications')
      .insert({
        type: 'security_update',
        title: 'セキュリティ更新',
        message: 'プッシュ通知の設定を更新しています。アプリを再起動してください。',
        all_users: true
      });
    
    console.log('全プッシュトークンを無効化しました');
  } catch (error) {
    console.error('トークン無効化エラー:', error);
  }
}

// トークン暗号化の強化
async function enhanceTokenSecurity(userId: string, token: string) {
  try {
    // 新しい暗号化キーで再暗号化
    const encryptedToken = await notificationSecurityManager.encryptToken(
      token,
      await notificationSecurityManager.getLatestEncryptionKey()
    );
    
    // ハッシュ値も同時に保存（重複チェック用）
    const tokenHash = await notificationSecurityManager.hashToken(token);
    
    await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: encryptedToken,
        token_hash: tokenHash,
        encryption_version: 'v2',
        updated_at: new Date().toISOString()
      });
    
    console.log('トークンセキュリティを強化しました');
  } catch (error) {
    console.error('セキュリティ強化エラー:', error);
  }
}
```

## 6. ネットワーク関連の問題

### 6.1 接続エラー

#### 症状
- Edge Function が呼び出せない
- データベース接続エラー

#### 診断方法
```typescript
// ネットワーク接続状態の確認
import NetInfo from '@react-native-community/netinfo';

const networkState = await NetInfo.fetch();
console.log('ネットワーク状態:', networkState);

// Supabase接続テスト
const connectionTest = await supabase
  .from('notifications')
  .select('id')
  .limit(1);

console.log('データベース接続:', connectionTest.error ? 'エラー' : '正常');

// Edge Function接続テスト
const functionTest = await supabase.functions.invoke('send-push-notification', {
  body: { test: true }
});

console.log('Edge Function接続:', functionTest.error ? 'エラー' : '正常');
```

#### 解決方法
```typescript
// オフライン対応の実装
class OfflineQueueManager {
  private offlineQueue: NotificationData[] = [];
  
  async handleOfflineNotification(notification: NotificationData) {
    // オフライン時はローカルキューに保存
    this.offlineQueue.push(notification);
    await AsyncStorage.setItem(
      'offline_notifications',
      JSON.stringify(this.offlineQueue)
    );
    
    console.log('オフライン通知をキューに追加しました');
  }
  
  async processOfflineQueue() {
    try {
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        console.log('まだオフラインです');
        return;
      }
      
      // オンライン復帰時にキューを処理
      const queueData = await AsyncStorage.getItem('offline_notifications');
      if (queueData) {
        const queue = JSON.parse(queueData);
        
        for (const notification of queue) {
          await this.sendNotificationWithRetry(notification);
        }
        
        // キューをクリア
        this.offlineQueue = [];
        await AsyncStorage.removeItem('offline_notifications');
        
        console.log('オフラインキューを処理しました');
      }
    } catch (error) {
      console.error('オフラインキュー処理エラー:', error);
    }
  }
  
  private async sendNotificationWithRetry(
    notification: NotificationData,
    maxRetries: number = 3
  ) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await notificationService.sendPushNotification(notification);
        console.log('通知送信成功:', notification.id);
        return;
      } catch (error) {
        console.error(`送信試行 ${attempt} 失敗:`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 指数バックオフ
        }
      }
    }
    
    console.error('通知送信に失敗しました:', notification.id);
  }
}
```

## 7. デバッグツールと監視

### 7.1 デバッグログの活用

```typescript
// 詳細なデバッグログの実装
class NotificationDebugger {
  private debugEnabled = __DEV__ || process.env.NODE_ENV === 'debug';
  
  log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.debugEnabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console[level](logMessage, data);
    
    // 本番環境では外部ログサービスに送信
    if (!__DEV__) {
      this.sendToLogService(level, message, data);
    }
  }
  
  private async sendToLogService(level: string, message: string, data?: any) {
    try {
      await supabase.functions.invoke('log-debug-info', {
        body: {
          level,
          message,
          data,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          app_version: '1.0.0'
        }
      });
    } catch (error) {
      // ログ送信エラーは無視（無限ループ防止）
    }
  }
}

const debugger = new NotificationDebugger();

// 使用例
debugger.log('info', 'プッシュ通知送信開始', { userId, notificationType });
debugger.log('error', 'トークン取得失敗', { error: error.message });
```

### 7.2 リアルタイム監視ダッシュボード

```typescript
// 管理者用の監視ダッシュボード
export function useNotificationMonitoringDashboard() {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [currentMetrics, recentAlerts, health] = await Promise.all([
          notificationMonitoringManager.getCurrentMetrics(),
          notificationMonitoringManager.getRecentAlerts(),
          notificationMonitoringManager.getSystemHealth()
        ]);
        
        setMetrics(currentMetrics);
        setAlerts(recentAlerts);
        setSystemHealth(health);
      } catch (error) {
        console.error('監視データ取得エラー:', error);
      }
    }, 30000); // 30秒ごと更新
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    metrics,
    alerts,
    systemHealth,
    refreshData: () => {
      // 手動更新用
    }
  };
}
```

---

**最終更新**: 2023年12月
**バージョン**: 1.0.0
**緊急対応**: 重大な問題が発生した場合は、まず機能フラグで通知システムを無効化してから調査を開始してください。