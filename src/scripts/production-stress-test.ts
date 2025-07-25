#!/usr/bin/env tsx
/**
 * 本番環境ストレステストスイート
 * システム限界を探るための高負荷テスト
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

interface StressTestResult {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: string[];
  peakMemoryUsage?: number;
  memoryLeakDetected?: boolean;
}

interface UserSimulation {
  userId: number;
  client: any;
  startTime: number;
  requests: RequestResult[];
}

interface RequestResult {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
}

// ストレステスト設定（段階的に負荷を上げる）
const STRESS_TEST_SCENARIOS = [
  {
    name: 'ピーク時想定負荷（200ユーザー）',
    concurrentUsers: 200,
    testDurationMinutes: 3,
    requestIntervalMs: 1000, // 1秒間隔
    requestsPerUser: 5
  },
  {
    name: '極限負荷テスト（500ユーザー）',
    concurrentUsers: 500,
    testDurationMinutes: 2,
    requestIntervalMs: 500, // 0.5秒間隔
    requestsPerUser: 3
  },
  {
    name: 'バースト負荷テスト（1000ユーザー）',
    concurrentUsers: 1000,
    testDurationMinutes: 1,
    requestIntervalMs: 100, // 0.1秒間隔
    requestsPerUser: 1
  }
];

// 本番環境ストレステスト実行
async function runProductionStressTest() {
  console.log('🔥 Mamapace本番環境ストレステスト');
  console.log('=====================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const allResults: StressTestResult[] = [];

  try {
    // メモリ使用量の初期値を記録
    const initialMemory = process.memoryUsage();
    console.log(`初期メモリ使用量: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB\n`);

    for (let i = 0; i < STRESS_TEST_SCENARIOS.length; i++) {
      const scenario = STRESS_TEST_SCENARIOS[i];
      console.log(`${i + 1}️⃣ ${scenario.name}`);
      console.log(`   👥 同時ユーザー数: ${scenario.concurrentUsers}`);
      console.log(`   ⏱️  テスト時間: ${scenario.testDurationMinutes}分`);
      console.log(`   📨 リクエスト間隔: ${scenario.requestIntervalMs}ms\n`);

      const result = await runStressTestScenario(scenario);
      allResults.push(result);

      // メモリ使用量チェック
      const currentMemory = process.memoryUsage();
      const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
      console.log(`\n   📊 メモリ使用量: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB (+${Math.round(memoryIncrease / 1024 / 1024)}MB)`);
      
      // メモリリーク検出（簡易版）
      if (memoryIncrease > 100 * 1024 * 1024) { // 100MB以上増加
        console.log('   ⚠️  メモリリークの可能性があります');
        result.memoryLeakDetected = true;
      }

      result.peakMemoryUsage = Math.round(currentMemory.heapUsed / 1024 / 1024);

      // シナリオ間の休憩（メモリ回復とサーバー負荷軽減）
      if (i < STRESS_TEST_SCENARIOS.length - 1) {
        console.log(`\n   ⏸️  次のシナリオまで30秒間休憩...\n`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    // 結果の表示と分析
    displayStressTestResults(allResults);
    
    // テストレポートの生成
    generateStressTestReport(allResults);

  } catch (error) {
    console.error('💥 ストレステスト致命的エラー:', error);
    process.exit(1);
  }
}

// ストレステストシナリオ実行
async function runStressTestScenario(scenario: any): Promise<StressTestResult> {
  const testName = scenario.name;
  const startTime = Date.now();
  const userSimulations: UserSimulation[] = [];

  console.log(`  🚀 ${scenario.concurrentUsers}ユーザーでストレステスト開始...`);

  // 同時ユーザーをシミュレート
  const promises = Array.from({ length: scenario.concurrentUsers }, async (_, index) => {
    const userId = index + 1;
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const userSim: UserSimulation = {
      userId,
      client,
      startTime: Date.now(),
      requests: []
    };

    // 各ユーザーが複数回リクエストを実行
    for (let i = 0; i < scenario.requestsPerUser; i++) {
      const reqStart = Date.now();
      try {
        // データベースヘルスチェック（最も基本的な負荷テスト）
        const { data, error } = await client
          .from('users')
          .select('id')
          .limit(1);

        const reqEnd = Date.now();
        userSim.requests.push({
          operation: 'stress_test_db_check',
          startTime: reqStart,
          endTime: reqEnd,
          duration: reqEnd - reqStart,
          success: !error,
          error: error?.message
        });

        // リクエスト間隔
        await new Promise(resolve => setTimeout(resolve, scenario.requestIntervalMs));
      } catch (err) {
        const reqEnd = Date.now();
        userSim.requests.push({
          operation: 'stress_test_db_check',
          startTime: reqStart,
          endTime: reqEnd,
          duration: reqEnd - reqStart,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    return userSim;
  });

  const results = await Promise.allSettled(promises);
  const endTime = Date.now();

  // 成功したシミュレーションのみを抽出
  const successfulResults = results
    .filter((result): result is PromiseFulfilledResult<UserSimulation> => result.status === 'fulfilled')
    .map(result => result.value);

  // 失敗したシミュレーション数を記録
  const failedSimulations = results.filter(result => result.status === 'rejected').length;
  if (failedSimulations > 0) {
    console.log(`  ⚠️  ${failedSimulations}個のユーザーシミュレーションが失敗しました`);
  }

  return analyzeStressTestResults(testName, startTime, endTime, successfulResults);
}

// ストレステスト結果分析
function analyzeStressTestResults(testName: string, startTime: number, endTime: number, userSimulations: UserSimulation[]): StressTestResult {
  const allRequests = userSimulations.flatMap(sim => sim.requests);
  const successfulRequests = allRequests.filter(req => req.success);
  const failedRequests = allRequests.filter(req => !req.success);
  
  const responseTimes = successfulRequests.map(req => req.duration);
  const averageResponseTime = responseTimes.length > 0 
    ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
    : 0;
  
  const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
  
  const testDuration = endTime - startTime;
  const requestsPerSecond = Math.round((allRequests.length / testDuration) * 1000);
  
  const errorRate = allRequests.length > 0 
    ? Math.round((failedRequests.length / allRequests.length) * 100)
    : 0;

  const errors = [...new Set(failedRequests.map(req => req.error).filter(Boolean))];

  return {
    testName,
    startTime,
    endTime,
    duration: testDuration,
    concurrentUsers: userSimulations.length, // 実際に実行されたユーザー数
    totalRequests: allRequests.length,
    successfulRequests: successfulRequests.length,
    failedRequests: failedRequests.length,
    averageResponseTime,
    minResponseTime,
    maxResponseTime,
    requestsPerSecond,
    errorRate,
    errors
  };
}

// ストレステスト結果表示
function displayStressTestResults(results: StressTestResult[]) {
  console.log('\n🔥 本番環境ストレステスト結果サマリー');
  console.log('==========================================');

  results.forEach((result, index) => {
    console.log(`\n${index + 1}️⃣ ${result.testName}`);
    console.log(`   ⏱️  実行時間: ${Math.round(result.duration / 1000)}秒`);
    console.log(`   👥 実行ユーザー数: ${result.concurrentUsers}`);
    console.log(`   📨 総リクエスト数: ${result.totalRequests}`);
    console.log(`   ✅ 成功リクエスト: ${result.successfulRequests}`);
    console.log(`   ❌ 失敗リクエスト: ${result.failedRequests}`);
    console.log(`   📈 リクエスト/秒: ${result.requestsPerSecond}`);
    console.log(`   ⏱️  平均応答時間: ${result.averageResponseTime}ms`);
    console.log(`   ⚡ 最速応答時間: ${result.minResponseTime}ms`);
    console.log(`   🐌 最遅応答時間: ${result.maxResponseTime}ms`);
    console.log(`   💥 エラー率: ${result.errorRate}%`);
    
    if (result.peakMemoryUsage) {
      console.log(`   🧠 ピークメモリ: ${result.peakMemoryUsage}MB`);
    }
    
    if (result.memoryLeakDetected) {
      console.log(`   ⚠️  メモリリーク検出`);
    }
    
    if (result.errors.length > 0) {
      console.log(`   🚨 主なエラー:`);
      result.errors.slice(0, 3).forEach(error => {
        console.log(`      - ${error}`);
      });
    }
  });

  // 総合評価
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0);
  const averageErrorRate = Math.round(results.reduce((sum, r) => sum + r.errorRate, 0) / results.length);
  const averageResponseTime = Math.round(results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length);
  const maxConcurrentUsers = Math.max(...results.map(r => r.concurrentUsers));

  console.log('\n🎯 ストレステスト総合評価');
  console.log('==========================');
  console.log(`📊 総リクエスト数: ${totalRequests}`);
  console.log(`✅ 総成功率: ${Math.round((totalSuccessful / totalRequests) * 100)}%`);
  console.log(`💥 平均エラー率: ${averageErrorRate}%`);
  console.log(`⏱️  平均応答時間: ${averageResponseTime}ms`);
  console.log(`👥 最大同時ユーザー: ${maxConcurrentUsers}`);

  // システム限界の判定
  const highestErrorRate = Math.max(...results.map(r => r.errorRate));
  if (highestErrorRate === 0) {
    console.log('🎉 優秀！システムは全ての負荷シナリオに耐えました。');
  } else if (highestErrorRate <= 5) {
    console.log('✅ 良好！軽微なエラーはありますが、システムは安定しています。');
  } else if (highestErrorRate <= 15) {
    console.log('⚠️  注意：高負荷時にエラー率が上昇しています。限界に近づいています。');
  } else {
    console.log('🚨 警告：システム限界を超過。インフラ強化が必要です。');
  }
}

// ストレステストレポート生成
function generateStressTestReport(results: StressTestResult[]) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `production-stress-test-${timestamp}.json`);

  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'stress-test',
    project: {
      name: 'Mamapace',
      url: supabaseUrl
    },
    scenarios: STRESS_TEST_SCENARIOS,
    summary: {
      totalScenarios: results.length,
      maxConcurrentUsers: Math.max(...results.map(r => r.concurrentUsers)),
      totalRequests,
      totalSuccessful,
      overallSuccessRate: Math.round((totalSuccessful / totalRequests) * 100),
      averageErrorRate: Math.round(results.reduce((sum, r) => sum + r.errorRate, 0) / results.length),
      averageResponseTime: Math.round(results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length),
      memoryLeakDetected: results.some(r => r.memoryLeakDetected),
      peakMemoryUsage: Math.max(...results.map(r => r.peakMemoryUsage || 0))
    },
    testResults: results,
    recommendations: generateStressTestRecommendations(results)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 ストレステストレポートを保存しました: ${reportPath}`);
}

// ストレステスト推奨事項生成
function generateStressTestRecommendations(results: StressTestResult[]): string[] {
  const recommendations: string[] = [];
  const averageErrorRate = results.reduce((sum, r) => sum + r.errorRate, 0) / results.length;
  const averageResponseTime = results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length;
  const maxConcurrentUsers = Math.max(...results.map(r => r.concurrentUsers));

  if (averageErrorRate === 0 && averageResponseTime <= 500) {
    recommendations.push(`優秀！システムは最大${maxConcurrentUsers}ユーザーの同時負荷に完璧に対応できます。`);
  } else {
    if (averageErrorRate > 5) {
      recommendations.push(`エラー率が${Math.round(averageErrorRate)}%です。Supabaseの接続制限やRLS最適化を検討してください。`);
    }
    
    if (averageResponseTime > 1000) {
      recommendations.push(`平均応答時間が${Math.round(averageResponseTime)}msです。データベースインデックス最適化を検討してください。`);
    }
  }

  const highErrorScenarios = results.filter(r => r.errorRate > 10);
  if (highErrorScenarios.length > 0) {
    recommendations.push(`以下のシナリオで高いエラー率: ${highErrorScenarios.map(s => s.testName).join(', ')}`);
  }

  if (results.some(r => r.memoryLeakDetected)) {
    recommendations.push('メモリリークが検出されました。アプリケーションのメモリ管理を見直してください。');
  }

  return recommendations;
}

// スクリプト実行
runProductionStressTest().catch(console.error);