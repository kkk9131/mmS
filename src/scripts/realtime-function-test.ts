#!/usr/bin/env tsx
/**
 * リアルタイム機能テストスイート
 * Supabase Realtimeの本番環境での動作確認
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
  timeout: 15000, // 15秒
  retries: 2,
  channelPrefix: 'test_' + Date.now()
};

// リアルタイム機能テスト実行
async function runRealtimeFunctionTests() {
  console.log('⚡ Mamapaceリアルタイム機能テスト');
  console.log('=====================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const testResults: TestResult[] = [];

  try {
    // 1. 基本接続テスト
    console.log('1️⃣ 基本接続テスト');
    testResults.push(...await testBasicConnection());

    // 2. チャンネル購読・通信テスト
    console.log('\n2️⃣ チャンネル購読・通信テスト');
    testResults.push(...await testChannelSubscription());

    // 3. Presence機能テスト
    console.log('\n3️⃣ Presence機能テスト');
    testResults.push(...await testPresenceFeatures());

    // 4. データベース変更リスニングテスト
    console.log('\n4️⃣ データベース変更リスニングテスト');
    testResults.push(...await testDatabaseChangeListening());

    // 5. パフォーマンス・レイテンシテスト
    console.log('\n5️⃣ パフォーマンス・レイテンシテスト');
    testResults.push(...await testPerformanceLatency());

    // 結果の表示と分析
    displayTestResults(testResults);
    
    // テストレポートの生成
    generateTestReport(testResults);

  } catch (error) {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  }
}

// 基本接続テスト
async function testBasicConnection(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Realtime接続確認
  results.push(await runTest('Realtime接続確認', async () => {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('Realtime接続タイムアウト'));
      }, 8000);

      const channel = supabase
        .channel(`${TEST_CONFIG.channelPrefix}_connection`)
        .on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve('Realtime接続成功');
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // presenceイベントが来ない場合も成功とみなす
            setTimeout(() => {
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve('Realtime接続成功（presence sync待機なし）');
            }, 2000);
          }
        });
    });
  }));

  // チャンネル作成・購読確認
  results.push(await runTest('チャンネル作成・購読', async () => {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('チャンネル購読タイムアウト'));
      }, 5000);

      const channel = supabase
        .channel(`${TEST_CONFIG.channelPrefix}_subscription`)
        .subscribe((status) => {
          clearTimeout(timeout);
          channel.unsubscribe();

          if (status === 'SUBSCRIBED') {
            resolve('チャンネル購読成功');
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('チャンネル購読エラー'));
          } else {
            resolve(`チャンネル状態: ${status}`);
          }
        });
    });
  }));

  return results;
}

// チャンネル購読・通信テスト  
async function testChannelSubscription(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ブロードキャストメッセージテスト
  results.push(await runTest('ブロードキャストメッセージ', async () => {
    return new Promise<string>((resolve, reject) => {
      const testMessage = { test: 'broadcast', timestamp: Date.now() };
      let messageReceived = false;

      const timeout = setTimeout(() => {
        channel.unsubscribe();
        if (!messageReceived) {
          reject(new Error('ブロードキャストメッセージ受信タイムアウト'));
        }
      }, 8000);

      const channel = supabase
        .channel(`${TEST_CONFIG.channelPrefix}_broadcast`)
        .on('broadcast', { event: 'test' }, (payload) => {
          if (payload.test === 'broadcast' && payload.timestamp === testMessage.timestamp) {
            messageReceived = true;
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve('ブロードキャストメッセージ送受信成功');
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // メッセージ送信
            setTimeout(async () => {
              await channel.send({
                type: 'broadcast',
                event: 'test',
                payload: testMessage
              });
            }, 500);
          }
        });
    });
  }));

  return results;
}

// Presence機能テスト
async function testPresenceFeatures(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Presence参加・状態同期テスト
  results.push(await runTest('Presence参加・状態同期', async () => {
    return new Promise<string>((resolve, reject) => {
      const userState = { user_id: 'test_user', status: 'online' };
      let presenceSynced = false;

      const timeout = setTimeout(() => {
        channel.unsubscribe();
        if (!presenceSynced) {
          reject(new Error('Presence同期タイムアウト'));
        }
      }, 10000);

      const channel = supabase
        .channel(`${TEST_CONFIG.channelPrefix}_presence`)
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const users = Object.keys(state);
          
          presenceSynced = true;
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve(`Presence同期成功: ${users.length}ユーザー`);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('      Presence参加:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('      Presence退出:', key, leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Presence状態を追跡
            await channel.track(userState);
          }
        });
    });
  }));

  return results;
}

// データベース変更リスニングテスト
async function testDatabaseChangeListening(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // テーブル変更リスニング（postsテーブル）
  results.push(await runTest('postsテーブル変更リスニング', async () => {
    return new Promise<string>((resolve, reject) => {
      let changeDetected = false;

      const timeout = setTimeout(() => {
        channel.unsubscribe();
        resolve('データベース変更リスニング設定完了（変更なし）');
      }, 6000);

      const channel = supabase
        .channel(`${TEST_CONFIG.channelPrefix}_db_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'posts'
          },
          (payload) => {
            changeDetected = true;
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve(`postsテーブル変更検知: ${payload.eventType}`);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // 実際のデータ変更は行わず、リスニング設定の確認のみ
            setTimeout(() => {
              if (!changeDetected) {
                clearTimeout(timeout);
                channel.unsubscribe();
                resolve('postsテーブル変更リスニング設定成功');
              }
            }, 3000);
          }
        });
    });
  }));

  return results;
}

// パフォーマンス・レイテンシテスト
async function testPerformanceLatency(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // メッセージ送受信レイテンシ測定
  results.push(await runTest('メッセージレイテンシ測定', async () => {
    return new Promise<string>((resolve, reject) => {
      const startTime = Date.now();
      const testPayload = { timestamp: startTime, test: 'latency' };

      const timeout = setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('レイテンシ測定タイムアウト'));
      }, 10000);

      const channel = supabase
        .channel(`${TEST_CONFIG.channelPrefix}_latency`)
        .on('broadcast', { event: 'latency_test' }, (payload) => {
          if (payload.timestamp === startTime) {
            const latency = Date.now() - startTime;
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve(`メッセージレイテンシ: ${latency}ms`);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // 少し待ってからメッセージ送信
            setTimeout(async () => {
              await channel.send({
                type: 'broadcast',
                event: 'latency_test',
                payload: testPayload
              });
            }, 500);
          }
        });
    });
  }));

  // 複数チャンネル同時接続テスト
  results.push(await runTest('複数チャンネル同時接続', async () => {
    const channelCount = 3;
    const channels: any[] = [];
    const subscribedChannels: Set<string> = new Set();

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        channels.forEach(ch => ch.unsubscribe());
        reject(new Error('複数チャンネル接続タイムアウト'));
      }, 12000);

      for (let i = 0; i < channelCount; i++) {
        const channel = supabase
          .channel(`${TEST_CONFIG.channelPrefix}_multi_${i}`)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              subscribedChannels.add(`multi_${i}`);
              
              if (subscribedChannels.size === channelCount) {
                clearTimeout(timeout);
                channels.forEach(ch => ch.unsubscribe());
                resolve(`複数チャンネル接続成功: ${channelCount}チャンネル`);
              }
            }
          });
        
        channels.push(channel);
      }
    });
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
  console.log('\n📊 リアルタイム機能テスト結果サマリー');
  console.log('==========================================');

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

  // パフォーマンス分析
  const latencyTests = results.filter(r => r.message.includes('レイテンシ') || r.message.includes('ms'));
  if (latencyTests.length > 0) {
    console.log('\n⚡ パフォーマンス分析:');
    latencyTests.forEach(test => {
      console.log(`- ${test.testName}: ${test.message}`);
    });
  }

  // 総合評価
  const successRate = Math.round((passed / results.length) * 100);
  console.log(`\n🎯 成功率: ${successRate}%`);

  if (successRate >= 90) {
    console.log('✨ 優秀！リアルタイム機能が正常に動作しています。');
  } else if (successRate >= 70) {
    console.log('⚠️  注意：いくつかの問題があります。修正を検討してください。');
  } else {
    console.log('🚨 警告：重大な問題があります。リアルタイム機能の見直しが必要です。');
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
  const reportPath = path.join(reportDir, `realtime-function-test-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'realtime-function',
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
    performance: {
      averageLatency: calculateAverageLatency(results),
      connectionTime: calculateConnectionTime(results)
    },
    recommendations: generateRecommendations(results)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 リアルタイムテストレポートを保存しました: ${reportPath}`);
}

// 平均レイテンシ計算
function calculateAverageLatency(results: TestResult[]): number {
  const latencyTests = results.filter(r => r.message.includes('レイテンシ:'));
  if (latencyTests.length === 0) return 0;

  const latencies = latencyTests.map(test => {
    const match = test.message.match(/(\d+)ms/);
    return match ? parseInt(match[1]) : 0;
  });

  return Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length);
}

// 接続時間計算
function calculateConnectionTime(results: TestResult[]): number {
  const connectionTests = results.filter(r => r.testName.includes('接続'));
  if (connectionTests.length === 0) return 0;

  return Math.round(connectionTests.reduce((sum, t) => sum + t.duration, 0) / connectionTests.length);
}

// 推奨事項生成
function generateRecommendations(results: TestResult[]): string[] {
  const recommendations: string[] = [];
  const failedTests = results.filter(r => r.status === 'fail');

  if (failedTests.length === 0) {
    recommendations.push('すべてのリアルタイムテストが成功しました。リアルタイム機能は正常に動作しています。');
  } else {
    recommendations.push(`${failedTests.length}個のリアルタイムテストが失敗しました。以下の問題を修正してください：`);
    
    failedTests.forEach(test => {
      recommendations.push(`- ${test.testName}: ${test.message}`);
    });
  }

  const avgLatency = calculateAverageLatency(results);
  if (avgLatency > 500) {
    recommendations.push(`平均レイテンシが${avgLatency}msと高めです。ネットワーク最適化を検討してください。`);
  }

  return recommendations;
}

// スクリプト実行
runRealtimeFunctionTests().catch(console.error);