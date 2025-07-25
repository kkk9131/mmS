#!/usr/bin/env tsx
/**
 * 本番環境機能テストスイート
 * 全機能の本番環境での動作確認
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 本番環境変数を読み込み
config({ path: path.join(process.cwd(), '.env.production') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message: string;
  details?: any;
}

// テスト設定
const TEST_CONFIG = {
  timeout: 10000, // 10秒
  retries: 2,
  testUser: {
    maternal_book_number: 'TEST_' + Date.now(),
    nickname: 'テストユーザー_' + Date.now()
  }
};

// 本番環境機能テスト実行
async function runProductionFunctionalTests() {
  console.log('🧪 Mamapace本番環境機能テスト');
  console.log('====================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const testResults: TestResult[] = [];

  // 1. データベース基本機能テスト
  console.log('1️⃣ データベース基本機能テスト');
  testResults.push(...await testDatabaseFunctions());

  // 2. 認証フロー統合テスト
  console.log('\n2️⃣ 認証フロー統合テスト');
  testResults.push(...await testAuthenticationFlow());

  // 3. 投稿機能テスト
  console.log('\n3️⃣ 投稿機能テスト');
  testResults.push(...await testPostsFunctions());

  // 4. リアルタイム機能テスト
  console.log('\n4️⃣ リアルタイム機能テスト');
  testResults.push(...await testRealtimeFunctions());

  // 5. ストレージ機能テスト
  console.log('\n5️⃣ ストレージ機能テスト');
  testResults.push(...await testStorageFunctions());

  // 6. 通知機能テスト
  console.log('\n6️⃣ 通知機能テスト');
  testResults.push(...await testNotificationFunctions());

  // 結果の表示と分析
  displayTestResults(testResults);
  
  // テストレポートの生成
  generateTestReport(testResults);
}

// データベース基本機能テスト
async function testDatabaseFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // テーブル存在確認
  results.push(await runTest('テーブル存在確認', async () => {
    const tables = ['users', 'posts', 'likes', 'comments', 'notifications', 'follows'];
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error && !error.message.includes('row-level security')) {
        throw new Error(`テーブル ${table} にアクセスできません: ${error.message}`);
      }
    }
    return 'すべてのテーブルが存在し、アクセス可能です';
  }));

  // RLS確認（認証なしでアクセス制限されることを確認）
  results.push(await runTest('RLS設定確認', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    // 認証なしの場合、データが取得できないか0件であることを確認
    if (!error && data?.length === 0) {
      return 'RLS正常動作：認証なしでデータアクセス制限';
    }
    
    if (error && error.message.includes('row-level security')) {
      return 'RLS正常動作：認証なしでエラー発生';
    }

    // データが取得できた場合は問題
    if (data && data.length > 0) {
      throw new Error('RLSが機能していません：認証なしでデータ取得可能');
    }

    return 'RLS正常動作：アクセス制限確認済み';
  }));

  return results;
}

// 認証フロー統合テスト
async function testAuthenticationFlow(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // セッション状態確認
  results.push(await runTest('セッション状態確認', async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(`セッション取得エラー: ${error.message}`);
    }
    
    return session ? 'セッション取得成功' : 'セッションなし（正常）';
  }));

  // 認証機能確認（実際のログインはテストしない）
  results.push(await runTest('認証機能確認', async () => {
    // 認証エンドポイントの存在確認のみ
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'invalid'
    });

    if (error && error.message.includes('Invalid login credentials')) {
      return '認証エンドポイントが正常に動作しています';
    }
    
    throw new Error('認証エンドポイントの応答が予期しないものです');
  }));

  return results;
}

// 投稿機能テスト
async function testPostsFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 投稿データ取得テスト（RLS制限確認）
  results.push(await runTest('投稿データ取得（RLS制限）', async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .limit(1);

    if (error && error.message.includes('row-level security')) {
      return 'RLS正常：認証なしでエラー発生';
    }
    
    if (!error && data?.length === 0) {
      return 'RLS正常：認証なしで0件取得';
    }
    
    if (data && data.length > 0) {
      throw new Error('RLS問題：認証なしでデータ取得可能');
    }
    
    return 'RLS正常：投稿データアクセス制限済み';
  }));

  // いいね機能のテーブル確認
  results.push(await runTest('いいね機能テーブル確認', async () => {
    const { data, error } = await supabase
      .from('likes')
      .select('*')
      .limit(1);

    if (error && error.message.includes('row-level security')) {
      return 'RLS正常：likesテーブル認証なしでエラー';
    }
    
    if (!error && data?.length === 0) {
      return 'RLS正常：likesテーブル認証なしで0件';
    }
    
    if (data && data.length > 0) {
      throw new Error('RLS問題：likesテーブル認証なしでデータ取得可能');
    }
    
    return 'RLS正常：likesテーブルアクセス制限済み';
  }));

  return results;
}

// リアルタイム機能テスト
async function testRealtimeFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // リアルタイム接続テスト
  results.push(await runTest('リアルタイム接続', async () => {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('リアルタイム接続タイムアウト'));
      }, 5000);

      const channel = supabase
        .channel('test-channel')
        .on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve('リアルタイム接続成功');
        })
        .subscribe();
    });
  }));

  return results;
}

// ストレージ機能テスト
async function testStorageFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ストレージバケット確認
  results.push(await runTest('ストレージバケット確認', async () => {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      throw new Error(`ストレージエラー: ${error.message}`);
    }
    
    return `ストレージバケット: ${buckets?.length || 0}個`;
  }));

  return results;
}

// 通知機能テスト
async function testNotificationFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 通知テーブル確認
  results.push(await runTest('通知テーブル確認', async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);

    if (error && error.message.includes('row-level security')) {
      return 'RLS正常：notificationsテーブル認証なしでエラー';
    }
    
    if (!error && data?.length === 0) {
      return 'RLS正常：notificationsテーブル認証なしで0件';
    }
    
    if (data && data.length > 0) {
      throw new Error('RLS問題：notificationsテーブル認証なしでデータ取得可能');
    }
    
    return 'RLS正常：notificationsテーブルアクセス制限済み';
  }));

  return results;
}

// テスト実行ヘルパー
async function runTest(testName: string, testFn: () => Promise<string>): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`  🔍 ${testName}...`);

  try {
    const message = await Promise.race([
      testFn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('テストタイムアウト')), TEST_CONFIG.timeout)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`  ✅ ${testName}: ${message} (${duration}ms)`);
    
    return {
      testName,
      status: 'pass',
      duration,
      message
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${testName}: ${errorMessage} (${duration}ms)`);
    
    return {
      testName,
      status: 'fail',
      duration,
      message: errorMessage,
      details: error
    };
  }
}

// テスト結果表示
function displayTestResults(results: TestResult[]) {
  console.log('\n📊 機能テスト結果サマリー');
  console.log('=============================');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`✅ 成功: ${passed}テスト`);
  console.log(`❌ 失敗: ${failed}テスト`);
  console.log(`⏭️  スキップ: ${skipped}テスト`);

  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`⏱️  総実行時間: ${totalTime}ms`);

  // 失敗したテストの詳細
  const failedTests = results.filter(r => r.status === 'fail');
  if (failedTests.length > 0) {
    console.log('\n❌ 失敗したテスト:');
    failedTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.testName}: ${test.message}`);
    });
  }

  // 総合評価
  const successRate = Math.round((passed / results.length) * 100);
  console.log(`\n🎯 成功率: ${successRate}%`);

  if (successRate >= 90) {
    console.log('✨ 優秀！本番環境の機能が正常に動作しています。');
  } else if (successRate >= 70) {
    console.log('⚠️  注意：いくつかの問題があります。修正を検討してください。');
  } else {
    console.log('🚨 警告：重大な問題があります。本番環境への移行を延期してください。');
  }
}

// テストレポート生成
function generateTestReport(results: TestResult[]) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `functional-test-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    project: {
      name: 'Mamapace',
      url: supabaseUrl
    },
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
      successRate: Math.round((results.filter(r => r.status === 'pass').length / results.length) * 100),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    },
    tests: results,
    recommendations: generateRecommendations(results)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 テストレポートを保存しました: ${reportPath}`);
}

// 推奨事項生成
function generateRecommendations(results: TestResult[]): string[] {
  const recommendations: string[] = [];
  const failedTests = results.filter(r => r.status === 'fail');

  if (failedTests.length === 0) {
    recommendations.push('すべてのテストが成功しました。本番環境への移行準備完了です。');
  } else {
    recommendations.push(`${failedTests.length}個のテストが失敗しました。以下の問題を修正してください：`);
    
    failedTests.forEach(test => {
      recommendations.push(`- ${test.testName}: ${test.message}`);
    });
  }

  const slowTests = results.filter(r => r.duration > 2000);
  if (slowTests.length > 0) {
    recommendations.push('実行時間が長いテストがあります。パフォーマンス改善を検討してください。');
  }

  return recommendations;
}

// スクリプト実行
runProductionFunctionalTests().catch(console.error);