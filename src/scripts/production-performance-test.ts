#!/usr/bin/env tsx
/**
 * 本番環境パフォーマンステスト
 * 負荷テスト、ストレステスト、長時間稼働テスト
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません');
  process.exit(1);
}

interface PerformanceMetric {
  operation: string;
  responseTime: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

interface LoadTestConfig {
  concurrent: number;
  duration: number; // 秒
  requestsPerSecond: number;
}

// パフォーマンステスト実行
async function runProductionPerformanceTest() {
  console.log('⚡ Mamapace本番環境パフォーマンステスト');
  console.log('==========================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  // 1. 基本レスポンス時間テスト
  console.log('1️⃣ 基本レスポンス時間テスト');
  await testBasicResponseTime();

  // 2. 負荷テスト（軽度）
  console.log('\n2️⃣ 軽負荷テスト（10並行接続）');
  await testLightLoad();

  // 3. ストレステスト（中程度）
  console.log('\n3️⃣ 中負荷テスト（25並行接続）');
  await testMediumLoad();

  // 4. 長時間稼働テスト（簡易版）
  console.log('\n4️⃣ 長時間稼働テスト（5分間）');
  await testEnduranceShort();

  console.log('\n✅ パフォーマンステスト完了');
}

// 基本レスポンス時間テスト
async function testBasicResponseTime() {
  const operations = [
    { name: 'データベース接続', fn: testDatabaseConnection },
    { name: 'API応答', fn: testAPIResponse },
    { name: '認証チェック', fn: testAuthCheck },
    { name: 'ストレージアクセス', fn: testStorageAccess }
  ];

  for (const op of operations) {
    const metrics: PerformanceMetric[] = [];
    
    // 5回実行して平均を取る
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      try {
        await op.fn();
        metrics.push({
          operation: op.name,
          responseTime: Date.now() - startTime,
          success: true,
          timestamp: Date.now()
        });
      } catch (error) {
        metrics.push({
          operation: op.name,
          responseTime: Date.now() - startTime,
          success: false,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // 1秒間隔
      await sleep(1000);
    }

    displayOperationMetrics(op.name, metrics);
  }
}

// 軽負荷テスト
async function testLightLoad() {
  await runLoadTest({
    concurrent: 10,
    duration: 30, // 30秒
    requestsPerSecond: 2
  });
}

// 中負荷テスト
async function testMediumLoad() {
  await runLoadTest({
    concurrent: 25,
    duration: 60, // 60秒
    requestsPerSecond: 1
  });
}

// 長時間稼働テスト（短縮版）
async function testEnduranceShort() {
  console.log('  📊 5分間の継続負荷テスト開始...');
  
  const startTime = Date.now();
  const duration = 5 * 60 * 1000; // 5分
  const metrics: PerformanceMetric[] = [];
  let requestCount = 0;

  while (Date.now() - startTime < duration) {
    const reqStartTime = Date.now();
    try {
      await testDatabaseConnection();
      metrics.push({
        operation: '長時間稼働テスト',
        responseTime: Date.now() - reqStartTime,
        success: true,
        timestamp: Date.now()
      });
      requestCount++;
    } catch (error) {
      metrics.push({
        operation: '長時間稼働テスト',
        responseTime: Date.now() - reqStartTime,
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 10秒間隔
    await sleep(10000);
    
    // 進行状況表示
    const elapsed = Date.now() - startTime;
    const progress = Math.round((elapsed / duration) * 100);
    if (requestCount % 6 === 0) { // 1分おき
      console.log(`  ⏱️  進行状況: ${progress}% (${requestCount}リクエスト完了)`);
    }
  }

  console.log(`  ✅ 長時間稼働テスト完了: ${requestCount}リクエスト実行`);
  displayOperationMetrics('長時間稼働テスト', metrics);
}

// 負荷テスト実行
async function runLoadTest(config: LoadTestConfig) {
  console.log(`  📊 ${config.concurrent}並行接続、${config.duration}秒間のテスト`);
  
  const promises: Promise<PerformanceMetric[]>[] = [];
  
  // 並行接続を開始
  for (let i = 0; i < config.concurrent; i++) {
    promises.push(runWorker(i, config));
  }

  // すべての接続完了を待機
  const results = await Promise.all(promises);
  const allMetrics = results.flat();

  // 結果分析
  analyzeLoadTestResults(allMetrics, config);
}

// ワーカー（個別の並行接続）
async function runWorker(workerId: number, config: LoadTestConfig): Promise<PerformanceMetric[]> {
  const metrics: PerformanceMetric[] = [];
  const startTime = Date.now();
  const interval = 1000 / config.requestsPerSecond;

  while (Date.now() - startTime < config.duration * 1000) {
    const reqStartTime = Date.now();
    try {
      await testDatabaseConnection();
      metrics.push({
        operation: `Worker-${workerId}`,
        responseTime: Date.now() - reqStartTime,
        success: true,
        timestamp: Date.now()
      });
    } catch (error) {
      metrics.push({
        operation: `Worker-${workerId}`,
        responseTime: Date.now() - reqStartTime,
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });
    }

    await sleep(interval);
  }

  return metrics;
}

// テスト用関数群
async function testDatabaseConnection() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });
  
  if (error && !error.message.includes('row-level security')) {
    throw error;
  }
}

async function testAPIResponse() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });
  
  if (error && !error.message.includes('row-level security')) {
    throw error;
  }
}

async function testAuthCheck() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.auth.getSession();
  
  if (error) {
    throw error;
  }
}

async function testStorageAccess() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.storage.listBuckets();
  
  if (error) {
    throw error;
  }
}

// メトリクス表示
function displayOperationMetrics(operationName: string, metrics: PerformanceMetric[]) {
  const successfulMetrics = metrics.filter(m => m.success);
  const failedMetrics = metrics.filter(m => !m.success);

  if (successfulMetrics.length === 0) {
    console.log(`  ❌ ${operationName}: すべて失敗`);
    return;
  }

  const responseTimes = successfulMetrics.map(m => m.responseTime);
  const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const successRate = Math.round((successfulMetrics.length / metrics.length) * 100);

  console.log(`  📊 ${operationName}:`);
  console.log(`     平均応答時間: ${avgResponseTime}ms`);
  console.log(`     最速/最遅: ${minResponseTime}ms / ${maxResponseTime}ms`);
  console.log(`     成功率: ${successRate}% (${successfulMetrics.length}/${metrics.length})`);

  // パフォーマンス評価
  if (avgResponseTime <= 500) {
    console.log(`     評価: ✅ 優秀`);
  } else if (avgResponseTime <= 1000) {
    console.log(`     評価: ⚠️  良好`);
  } else {
    console.log(`     評価: ❌ 改善必要`);
  }

  if (failedMetrics.length > 0) {
    console.log(`     ❌ 失敗: ${failedMetrics.length}件`);
  }
}

// 負荷テスト結果分析
function analyzeLoadTestResults(metrics: PerformanceMetric[], config: LoadTestConfig) {
  const successfulMetrics = metrics.filter(m => m.success);
  const failedMetrics = metrics.filter(m => !m.success);

  console.log(`  📊 負荷テスト結果:`);
  console.log(`     総リクエスト数: ${metrics.length}`);
  console.log(`     成功: ${successfulMetrics.length}件`);
  console.log(`     失敗: ${failedMetrics.length}件`);
  console.log(`     成功率: ${Math.round((successfulMetrics.length / metrics.length) * 100)}%`);

  if (successfulMetrics.length > 0) {
    const responseTimes = successfulMetrics.map(m => m.responseTime);
    const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    const p95ResponseTime = Math.round(responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]);
    
    console.log(`     平均応答時間: ${avgResponseTime}ms`);
    console.log(`     95パーセンタイル: ${p95ResponseTime}ms`);
    
    // スループット計算
    const duration = config.duration;
    const throughput = Math.round(successfulMetrics.length / duration);
    console.log(`     スループット: ${throughput} req/sec`);
  }

  // 評価
  const successRate = (successfulMetrics.length / metrics.length) * 100;
  if (successRate >= 95) {
    console.log(`     評価: ✅ 優秀 - 高負荷に対応可能`);
  } else if (successRate >= 85) {
    console.log(`     評価: ⚠️  良好 - 通常負荷に対応可能`);
  } else {
    console.log(`     評価: ❌ 改善必要 - スケーリングが必要`);
  }
}

// ユーティリティ関数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// スクリプト実行
runProductionPerformanceTest().catch(console.error);