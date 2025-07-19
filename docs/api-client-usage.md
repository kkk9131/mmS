# APIクライアント使用方法ガイド

## 概要

このAPIクライアントは、Mamapaceアプリケーション用に設計された包括的なHTTPクライアントライブラリです。モック機能、エラーハンドリング、認証、接続テストなどの機能を提供します。

## 基本的な使用方法

### 初期化

```typescript
import { apiClient } from '../services/api';

// APIクライアントの初期化
await apiClient.initialize();
```

### 基本的なHTTPリクエスト

```typescript
// GET リクエスト
const userData = await apiClient.get('/user/profile');

// POST リクエスト
const newPost = await apiClient.post('/posts', {
  title: '新しい投稿',
  content: '投稿内容',
  tags: ['タグ1', 'タグ2']
});

// PUT リクエスト
const updatedUser = await apiClient.put('/user/profile', {
  name: '新しい名前',
  bio: '新しい自己紹介'
});

// DELETE リクエスト
await apiClient.delete('/posts/123');
```

## 認証

### 認証トークンの設定

```typescript
// ログイン
const loginResponse = await apiClient.post('/auth/login', {
  email: 'user@example.com',
  password: 'password123'
});

// トークンの設定
apiClient.setAuthToken(loginResponse.tokens.accessToken);
apiClient.setRefreshToken(loginResponse.tokens.refreshToken);
```

### 認証コールバックの設定

```typescript
// トークンリフレッシュ時のコールバック
apiClient.onTokenRefreshed((newToken) => {
  console.log('新しいトークンを受信:', newToken);
  // 新しいトークンをローカルストレージに保存
  localStorage.setItem('accessToken', newToken);
});

// 認証失敗時のコールバック
apiClient.onAuthenticationFailure(() => {
  console.log('認証に失敗しました');
  // ログイン画面にリダイレクト
  window.location.href = '/login';
});
```

### 認証情報のクリア

```typescript
apiClient.clearAuthToken();
apiClient.clearRefreshToken();
```

## 機能フラグとモード切り替え

### APIモードとモックモード

```typescript
// モックモードに切り替え（開発時）
apiClient.enableMockMode();

// APIモードに切り替え（本番時）
apiClient.enableApiMode();
```

### 機能フラグの管理

```typescript
import { FeatureFlagsManager } from '../services/featureFlags';

const featureFlags = FeatureFlagsManager.getInstance();

// 個別フラグの取得
const useApi = featureFlags.getFlag('USE_API');
const debugMode = featureFlags.getFlag('DEBUG_MODE');
const mockDelay = featureFlags.getFlag('MOCK_DELAY');

// 全フラグの取得
const allFlags = featureFlags.getAllFlags();

// フラグの設定
featureFlags.setFlag('DEBUG_MODE', true);
featureFlags.setFlag('MOCK_DELAY', 1000);

// 複数フラグの更新
featureFlags.updateFlags({
  USE_API: false,
  DEBUG_MODE: true,
  MOCK_DELAY: 500
});
```

## エラーハンドリング

### 基本的なエラーハンドリング

```typescript
try {
  const data = await apiClient.get('/posts');
  console.log('投稿を取得しました:', data);
} catch (error) {
  console.error('エラーが発生しました:', error);
  
  if (error.response) {
    // HTTPエラー
    const status = error.response.status;
    const message = error.response.data?.message;
    
    switch (status) {
      case 401:
        console.log('認証が必要です');
        break;
      case 404:
        console.log('リソースが見つかりません');
        break;
      case 500:
        console.log('サーバーエラーです');
        break;
      default:
        console.log(`HTTPエラー: ${status} - ${message}`);
    }
  } else {
    // ネットワークエラーやその他のエラー
    console.log('ネットワークエラーまたは予期しないエラーです');
  }
}
```

### エラーハンドラーの使用

```typescript
import { ApiErrorHandler } from '../services/api/errorHandler';

const errorHandler = new ApiErrorHandler();

try {
  const data = await apiClient.get('/posts');
} catch (error) {
  const apiError = errorHandler.handleError(error);
  
  console.log('エラータイプ:', apiError.type);
  console.log('エラーメッセージ:', apiError.message);
  console.log('ユーザー向けメッセージ:', errorHandler.formatUserFriendlyMessage(apiError));
  
  // リトライ可能かチェック
  if (errorHandler.isRetryableError(apiError)) {
    console.log('このエラーはリトライ可能です');
  }
}
```

## 接続テストとヘルスチェック

### 基本的な接続テスト

```typescript
// 単一接続テスト
const connectionResult = await apiClient.testConnection();
console.log('接続テスト結果:', connectionResult);

if (connectionResult.success) {
  console.log(`接続成功 (応答時間: ${connectionResult.responseTime}ms)`);
} else {
  console.log('接続失敗:', connectionResult.error);
}
```

### 包括的なヘルスチェック

```typescript
const healthCheck = await apiClient.performHealthCheck();

console.log('API:', healthCheck.api.success ? '正常' : '異常');
if (healthCheck.database) {
  console.log('データベース:', healthCheck.database.success ? '正常' : '異常');
}
if (healthCheck.cache) {
  console.log('キャッシュ:', healthCheck.cache.success ? '正常' : '異常');
}
```

## 統計情報の取得

```typescript
const stats = apiClient.getStats();

console.log('接続統計:', stats.connection);
console.log('モック統計:', stats.mock);
console.log('設定情報:', stats.config);
console.log('機能フラグ:', stats.flags);
```

## 高度な設定

### カスタム設定

```typescript
import { ApiConfigManager } from '../services/api/config';

const configManager = ApiConfigManager.getInstance();

// 設定の更新
configManager.updateConfig({
  timeout: 15000,
  retries: 5
});

// 開発用設定の取得
const devConfig = configManager.getDevelopmentConfig();

// 本番用設定の取得
const prodConfig = configManager.getProductionConfig();
```

### モックエンドポイントの追加

```typescript
import { MockSystem } from '../services/api/mockSystem';

const mockSystem = MockSystem.getInstance();

// カスタムモックエンドポイントの追加
mockSystem.registerEndpoint({
  url: '/custom/endpoint',
  method: 'GET',
  response: {
    message: 'カスタムレスポンス',
    data: { custom: true }
  },
  delay: 200,
  status: 200
});

// 動的レスポンスの設定
mockSystem.registerEndpoint({
  url: '/dynamic/endpoint',
  method: 'POST',
  response: (requestData) => ({
    echo: requestData,
    timestamp: new Date().toISOString(),
    processed: true
  })
});
```

## ベストプラクティス

### 1. 初期化の確認

```typescript
if (!apiClient.isInitialized()) {
  await apiClient.initialize();
}
```

### 2. エラーハンドリングの統一

```typescript
const handleApiError = (error: any) => {
  const errorHandler = new ApiErrorHandler();
  const apiError = errorHandler.handleError(error);
  const userMessage = errorHandler.formatUserFriendlyMessage(apiError);
  
  // ユーザーに表示
  showErrorMessage(userMessage);
  
  // ログに記録
  console.error('API Error:', apiError);
};
```

### 3. 認証状態の管理

```typescript
class AuthManager {
  private static instance: AuthManager;
  
  async login(credentials: LoginCredentials) {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      apiClient.setAuthToken(response.tokens.accessToken);
      apiClient.setRefreshToken(response.tokens.refreshToken);
      return response;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }
  
  logout() {
    apiClient.clearAuthToken();
    apiClient.clearRefreshToken();
  }
}
```

### 4. デバッグモードの活用

```typescript
// 開発環境でのデバッグモード有効化
if (__DEV__) {
  const featureFlags = FeatureFlagsManager.getInstance();
  featureFlags.enableDebugMode();
  featureFlags.enableMockMode();
}
```

## トラブルシューティング

### よくある問題

1. **初期化エラー**
   - `await apiClient.initialize()`を呼び出しているか確認
   - ネットワーク接続を確認

2. **認証エラー**
   - トークンが正しく設定されているか確認
   - トークンの有効期限を確認

3. **モックが動作しない**
   - モックモードが有効になっているか確認
   - モックエンドポイントが正しく登録されているか確認

4. **タイムアウトエラー**
   - ネットワーク状況を確認
   - タイムアウト設定を調整

### デバッグ情報の取得

```typescript
// 詳細な統計情報
const stats = apiClient.getStats();
console.log('Debug Info:', JSON.stringify(stats, null, 2));

// 接続テスト
const connectionTest = await apiClient.testConnection();
console.log('Connection Test:', connectionTest);
```