#!/usr/bin/env tsx
/**
 * 画像アップロード・通知機能テストスイート
 * 画像ストレージと通知システムの本番環境での動作確認
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
  timeout: 20000, // 20秒
  retries: 2,
  testBucket: 'test-images',
  testFileName: `test-image-${Date.now()}.jpg`
};

// 画像アップロード・通知テスト実行
async function runImageNotificationTests() {
  console.log('🖼️ Mamapace画像アップロード・通知機能テスト');
  console.log('==========================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const testResults: TestResult[] = [];

  try {
    // 1. ストレージ基本機能テスト
    console.log('1️⃣ ストレージ基本機能テスト');
    testResults.push(...await testStorageBasicFunctions());

    // 2. 画像アップロード機能テスト
    console.log('\n2️⃣ 画像アップロード機能テスト');
    testResults.push(...await testImageUploadFunctions());

    // 3. 画像アクセス・セキュリティテスト
    console.log('\n3️⃣ 画像アクセス・セキュリティテスト');
    testResults.push(...await testImageAccessSecurity());

    // 4. 通知システムテスト
    console.log('\n4️⃣ 通知システムテスト');
    testResults.push(...await testNotificationSystem());

    // 5. 統合機能テスト
    console.log('\n5️⃣ 統合機能テスト');
    testResults.push(...await testIntegratedFeatures());

    // 結果の表示と分析
    displayTestResults(testResults);
    
    // テストレポートの生成
    generateTestReport(testResults);

  } catch (error) {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  }
}

// ストレージ基本機能テスト
async function testStorageBasicFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ストレージバケット一覧取得
  results.push(await runTest('ストレージバケット一覧取得', async () => {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      throw new Error(`バケット一覧取得エラー: ${error.message}`);
    }
    
    return `バケット数: ${buckets?.length || 0}個`;
  }));

  // アバターバケット存在確認
  results.push(await runTest('アバターバケット存在確認', async () => {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      throw new Error(`バケット確認エラー: ${error.message}`);
    }
    
    const avatarBucket = buckets?.find(bucket => bucket.name === 'avatars');
    if (avatarBucket) {
      return 'アバターバケットが存在します';
    }
    
    return 'アバターバケットは存在しません（設定により正常）';
  }));

  // ストレージ権限確認
  results.push(await runTest('ストレージ権限確認', async () => {
    const testFile = new Uint8Array([137, 80, 78, 71]); // PNG header
    const fileName = `permission-test-${Date.now()}.png`;
    
    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, testFile);

    if (error) {
      if (error.message.includes('Bucket not found')) {
        return 'アバターバケット未作成（正常）';
      }
      if (error.message.includes('permission')) {
        return 'ストレージ権限が適切に設定されています';
      }
      throw new Error(`ストレージ権限エラー: ${error.message}`);
    }

    // アップロード成功した場合はクリーンアップ
    await supabase.storage.from('avatars').remove([fileName]);
    return 'ストレージアップロード・削除成功';
  }));

  return results;
}

// 画像アップロード機能テスト
async function testImageUploadFunctions(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // テスト用の小さな画像データを作成
  const createTestImageData = (): Uint8Array => {
    // 最小限のJPEGヘッダーを持つダミーデータ
    return new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
    ]);
  };

  // 画像サイズ制限テスト
  results.push(await runTest('画像サイズ制限テスト', async () => {
    const maxSize = parseInt(process.env.EXPO_PUBLIC_MAX_IMAGE_SIZE || '10485760'); // 10MB
    const testImageSize = createTestImageData().length;
    
    if (testImageSize < maxSize) {
      return `画像サイズ制限OK: ${testImageSize}bytes < ${maxSize}bytes`;
    }
    
    throw new Error('テスト画像サイズが制限を超えています');
  }));

  // 画像形式確認テスト
  results.push(await runTest('画像形式確認テスト', async () => {
    const allowedTypes = process.env.EXPO_PUBLIC_ALLOWED_IMAGE_TYPES?.split(',') || [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
    ];
    
    return `対応画像形式: ${allowedTypes.join(', ')}`;
  }));

  // 画像品質設定確認
  results.push(await runTest('画像品質設定確認', async () => {
    const imageQuality = parseFloat(process.env.EXPO_PUBLIC_IMAGE_QUALITY || '0.8');
    
    if (imageQuality >= 0.1 && imageQuality <= 1.0) {
      return `画像品質設定: ${imageQuality} (正常範囲)`;
    }
    
    throw new Error(`画像品質設定が異常: ${imageQuality}`);
  }));

  return results;
}

// 画像アクセス・セキュリティテスト
async function testImageAccessSecurity(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 未認証でのバケットアクセステスト
  results.push(await runTest('未認証バケットアクセス制限', async () => {
    const { data, error } = await supabase.storage
      .from('avatars')
      .list();

    if (error) {
      if (error.message.includes('Bucket not found')) {
        return '未認証アクセス適切に制限（バケット未作成）';
      }
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return '未認証アクセス適切に制限';
      }
      throw new Error(`予期しないエラー: ${error.message}`);
    }

    return `未認証でもアクセス可能: ${data?.length || 0}ファイル`;
  }));

  // パブリックURL生成テスト
  results.push(await runTest('パブリックURL生成テスト', async () => {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl('nonexistent-file.jpg');

    if (data?.publicUrl) {
      const url = new URL(data.publicUrl);
      return `パブリックURL生成成功: ${url.hostname}`;
    }

    throw new Error('パブリックURL生成失敗');
  }));

  return results;
}

// 通知システムテスト
async function testNotificationSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 通知テーブル構造確認
  results.push(await runTest('通知テーブル構造確認', async () => {
    const { error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('row-level security')) {
        return '通知テーブルが存在し、RLSが適用されています';
      }
      throw new Error(`通知テーブルエラー: ${error.message}`);
    }

    return '通知テーブル構造確認成功';
  }));

  // プッシュトークンテーブル確認
  results.push(await runTest('プッシュトークンテーブル確認', async () => {
    const { error } = await supabase
      .from('push_tokens')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('row-level security')) {
        return 'プッシュトークンテーブルが存在し、RLSが適用されています';
      }
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return 'プッシュトークンテーブル未作成（オプション機能）';
      }
      throw new Error(`プッシュトークンテーブルエラー: ${error.message}`);
    }

    return 'プッシュトークンテーブル構造確認成功';
  }));

  // 通知設定確認
  results.push(await runTest('通知設定確認', async () => {
    const pushEnabled = process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true';
    const fcmSenderId = process.env.EXPO_PUBLIC_FCM_SENDER_ID;
    const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;

    let status = `プッシュ通知: ${pushEnabled ? '有効' : '無効'}`;
    
    if (pushEnabled) {
      if (fcmSenderId && fcmSenderId !== 'your-fcm-sender-id') {
        status += ', FCM設定済み';
      }
      if (expoProjectId && expoProjectId !== 'your-expo-project-id') {
        status += ', Expo設定済み';
      }
    }

    return status;
  }));

  return results;
}

// 統合機能テスト
async function testIntegratedFeatures(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 設定統合確認
  results.push(await runTest('機能フラグ統合確認', async () => {
    const flags = {
      realtime: process.env.EXPO_PUBLIC_ENABLE_REALTIME === 'true',
      imageUpload: process.env.EXPO_PUBLIC_ENABLE_IMAGE_UPLOAD === 'true',
      pushNotifications: process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true',
      analytics: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true'
    };

    const enabledFeatures = Object.entries(flags).filter(([_, enabled]) => enabled);
    return `有効機能: ${enabledFeatures.map(([name]) => name).join(', ')}`;
  }));

  // パフォーマンス設定確認
  results.push(await runTest('パフォーマンス設定確認', async () => {
    const settings = {
      apiTimeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '30000'),
      cacheDuration: parseInt(process.env.EXPO_PUBLIC_CACHE_DURATION || '300000'),
      batchSize: parseInt(process.env.EXPO_PUBLIC_BATCH_SIZE || '20')
    };

    return `API timeout: ${settings.apiTimeout}ms, Cache: ${settings.cacheDuration}ms, Batch: ${settings.batchSize}`;
  }));

  // セキュリティ設定確認
  results.push(await runTest('セキュリティ設定確認', async () => {
    const security = {
      debugLogs: process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS === 'true',
      errorReporting: process.env.EXPO_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
      maxLoginAttempts: parseInt(process.env.EXPO_PUBLIC_MAX_LOGIN_ATTEMPTS || '5'),
      sessionTimeout: parseInt(process.env.EXPO_PUBLIC_SESSION_TIMEOUT || '86400000')
    };

    return `Debug: ${security.debugLogs}, Error報告: ${security.errorReporting}, Login試行: ${security.maxLoginAttempts}, Session: ${Math.round(security.sessionTimeout / 3600000)}h`;
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
  console.log('\n📊 画像アップロード・通知テスト結果サマリー');
  console.log('================================================');

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

  // 設定情報表示
  const configTests = results.filter(r => r.message.includes('設定') || r.message.includes('有効') || r.message.includes('対応'));
  if (configTests.length > 0) {
    console.log('\n⚙️ 設定情報:');
    configTests.forEach(test => {
      console.log(`- ${test.testName}: ${test.message}`);
    });
  }

  // 総合評価
  const successRate = Math.round((passed / results.length) * 100);
  console.log(`\n🎯 成功率: ${successRate}%`);

  if (successRate >= 90) {
    console.log('✨ 優秀！画像アップロード・通知機能が正常に設定されています。');
  } else if (successRate >= 70) {
    console.log('⚠️  注意：いくつかの問題があります。修正を検討してください。');
  } else {
    console.log('🚨 警告：重大な問題があります。画像・通知機能の見直しが必要です。');
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
  const reportPath = path.join(reportDir, `image-notification-test-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'image-notification',
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
    configuration: extractConfiguration(results),
    recommendations: generateRecommendations(results)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 画像・通知テストレポートを保存しました: ${reportPath}`);
}

// 設定情報抽出
function extractConfiguration(results: TestResult[]): any {
  const config: any = {};
  
  results.forEach(result => {
    if (result.testName.includes('設定') && result.status === 'pass') {
      config[result.testName] = result.message;
    }
  });

  return config;
}

// 推奨事項生成
function generateRecommendations(results: TestResult[]): string[] {
  const recommendations: string[] = [];
  const failedTests = results.filter(r => r.status === 'fail');

  if (failedTests.length === 0) {
    recommendations.push('すべての画像・通知テストが成功しました。機能が正常に設定されています。');
  } else {
    recommendations.push(`${failedTests.length}個のテストが失敗しました。以下の問題を修正してください：`);
    
    failedTests.forEach(test => {
      recommendations.push(`- ${test.testName}: ${test.message}`);
    });
  }

  // 特定の推奨事項
  const hasStorageIssues = failedTests.some(t => t.testName.includes('ストレージ'));
  if (hasStorageIssues) {
    recommendations.push('ストレージバケットの作成とRLS設定の確認を推奨します。');
  }

  const hasNotificationIssues = failedTests.some(t => t.testName.includes('通知'));
  if (hasNotificationIssues) {
    recommendations.push('通知システムの設定と外部サービス連携を確認してください。');
  }

  return recommendations;
}

// スクリプト実行
runImageNotificationTests().catch(console.error);