import { apiClient } from './index';

export async function runApiDemo(): Promise<void> {
  console.log('🚀 API Client デモを開始します...\n');

  try {
    console.log('📋 API Client の初期化...');
    await apiClient.initialize();
    console.log('✅ 初期化完了\n');

    console.log('📊 統計情報の取得...');
    const stats = apiClient.getStats();
    console.log('統計情報:', JSON.stringify(stats, null, 2));
    console.log('');

    console.log('🔍 接続テストの実行...');
    const connectionTest = await apiClient.testConnection();
    console.log('接続テスト結果:', JSON.stringify(connectionTest, null, 2));
    console.log('');

    console.log('🏥 ヘルスチェックの実行...');
    const healthCheck = await apiClient.performHealthCheck();
    console.log('ヘルスチェック結果:', JSON.stringify(healthCheck, null, 2));
    console.log('');

    console.log('📡 GET リクエストのテスト (/health)...');
    const healthResponse = await apiClient.get('/health');
    console.log('レスポンス:', JSON.stringify(healthResponse, null, 2));
    console.log('');

    console.log('🔐 認証テスト (/auth/login)...');
    const loginData = {
      email: 'demo@example.com',
      password: 'password123'
    };
    const loginResponse = await apiClient.post('/auth/login', loginData);
    console.log('ログインレスポンス:', JSON.stringify(loginResponse, null, 2));
    console.log('');

    if ((loginResponse as any).tokens?.accessToken) {
      console.log('🔑 認証トークンの設定...');
      apiClient.setAuthToken((loginResponse as any).tokens.accessToken);
      console.log('✅ トークン設定完了');
    }

    console.log('👤 ユーザープロフィール取得テスト...');
    const profileResponse = await apiClient.get('/user/profile');
    console.log('プロフィール:', JSON.stringify(profileResponse, null, 2));
    console.log('');

    console.log('📝 投稿一覧取得テスト...');
    const postsResponse = await apiClient.get('/posts');
    console.log('投稿一覧:', JSON.stringify(postsResponse, null, 2));
    console.log('');

    console.log('✍️ 新規投稿作成テスト...');
    const newPost = {
      title: 'デモ投稿',
      content: 'これはAPIクライアントのデモで作成された投稿です。',
      tags: ['デモ', 'テスト']
    };
    const createPostResponse = await apiClient.post('/posts', newPost);
    console.log('投稿作成結果:', JSON.stringify(createPostResponse, null, 2));
    console.log('');

    console.log('❌ エラーハンドリングテスト...');
    try {
      await apiClient.get('/error/404');
    } catch (error) {
      console.log('404エラーが正常にキャッチされました:', error);
    }
    console.log('');

    console.log('🔄 モード切り替えテスト...');
    console.log('現在のモード:', stats.connection.mode);
    
    if (stats.connection.mode === 'mock') {
      console.log('APIモードに切り替え中...');
      apiClient.enableApiMode();
    } else {
      console.log('モックモードに切り替え中...');
      apiClient.enableMockMode();
    }
    
    const newStats = apiClient.getStats();
    console.log('切り替え後のモード:', newStats.connection.mode);
    console.log('');

    console.log('🧹 認証情報のクリア...');
    apiClient.clearAuthToken();
    apiClient.clearRefreshToken();
    console.log('✅ クリア完了');
    console.log('');

    console.log('🎉 デモが正常に完了しました！');

  } catch (error) {
    console.error('❌ デモ実行中にエラーが発生しました:', error);
  }
}

export async function runFeatureFlagsDemo(): Promise<void> {
  console.log('🏁 機能フラグデモを開始します...\n');

  try {
    const stats = apiClient.getStats();
    const flags = stats.flags;

    console.log('🎛️ 現在の機能フラグ設定:');
    console.log(`USE_API: ${flags.USE_API}`);
    console.log(`DEBUG_MODE: ${flags.DEBUG_MODE}`);
    console.log(`MOCK_DELAY: ${flags.MOCK_DELAY}ms`);
    console.log('');

    console.log('🔧 機能フラグの切り替えテスト...');
    
    console.log('モックモードに切り替え...');
    apiClient.enableMockMode();
    let newStats = apiClient.getStats();
    console.log(`USE_API: ${newStats.flags.USE_API}, DEBUG_MODE: ${newStats.flags.DEBUG_MODE}, MOCK_DELAY: ${newStats.flags.MOCK_DELAY}ms`);
    
    console.log('APIモードに切り替え...');
    apiClient.enableApiMode();
    newStats = apiClient.getStats();
    console.log(`USE_API: ${newStats.flags.USE_API}, DEBUG_MODE: ${newStats.flags.DEBUG_MODE}, MOCK_DELAY: ${newStats.flags.MOCK_DELAY}ms`);
    
    console.log('');
    console.log('✅ 機能フラグデモが完了しました！');

  } catch (error) {
    console.error('❌ 機能フラグデモ実行中にエラーが発生しました:', error);
  }
}

export async function runErrorHandlingDemo(): Promise<void> {
  console.log('⚠️ エラーハンドリングデモを開始します...\n');

  try {
    await apiClient.initialize();

    const errorEndpoints = [
      { url: '/error/400', description: 'Bad Request (400)' },
      { url: '/error/401', description: 'Unauthorized (401)' },
      { url: '/error/404', description: 'Not Found (404)' },
      { url: '/error/500', description: 'Internal Server Error (500)' },
    ];

    for (const test of errorEndpoints) {
      console.log(`🧪 ${test.description} のテスト...`);
      try {
        await apiClient.get(test.url);
        console.log('❌ エラーが発生しませんでした（予期しない結果）');
      } catch (error: any) {
        console.log(`✅ 正常にエラーをキャッチ: ${error.response?.status} - ${error.response?.data?.message}`);
      }
      console.log('');
    }

    console.log('✅ エラーハンドリングデモが完了しました！');

  } catch (error) {
    console.error('❌ エラーハンドリングデモ実行中にエラーが発生しました:', error);
  }
}

if (require.main === module) {
  (async () => {
    await runApiDemo();
    console.log('\n' + '='.repeat(50) + '\n');
    await runFeatureFlagsDemo();
    console.log('\n' + '='.repeat(50) + '\n');
    await runErrorHandlingDemo();
  })();
}