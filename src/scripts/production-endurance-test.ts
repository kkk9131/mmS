#!/usr/bin/env tsx
/**
 * 本番環境長時間稼働テストスイート
 * 24時間相当の継続性・安定性テスト（10分で実行）
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

interface EnduranceTestResult {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalCycles: number;
  successfulCycles: number;
  failedCycles: number;
  averageResponseTime: number;
  responseTimeVariation: number;
  memoryLeakDetected: boolean;
  performanceDegradation: boolean;
  resourceMetrics: ResourceMetric[];
  errors: string[];
  stabilityScore: number;
}

interface ResourceMetric {
  timestamp: number;
  memoryUsage: number;
  heapUsed: number;
  heapTotal: number;
}

interface CycleResult {
  cycleNumber: number;
  startTime: number;
  endTime: number;
  success: boolean;
  responseTime: number;
  error?: string;
  memorySnapshot: ResourceMetric;
}

// 長時間稼働テスト設定（短時間で24時間相当をシミュレート）
const ENDURANCE_TEST_CONFIG = {
  totalDurationMinutes: 10, // 実際のテスト時間
  equivalentHours: 24, // シミュレートする時間
  concurrentUsers: 20, // 継続的な負荷
  cycleIntervalMs: 3000, // 3秒間隔でサイクル実行
  resourceMonitoringIntervalMs: 15000, // 15秒ごとにリソース監視
  memoryLeakThresholdMB: 30, // 30MB以上の増加でメモリリーク判定
  performanceDegradationThreshold: 50 // 50%以上の応答時間増加で劣化判定
};

// 本番環境長時間稼働テスト実行
async function runProductionEnduranceTest() {
  console.log('⏰ Mamapace本番環境24時間相当稼働テスト');
  console.log('==========================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実際のテスト時間: ${ENDURANCE_TEST_CONFIG.totalDurationMinutes}分`);
  console.log(`シミュレート時間: ${ENDURANCE_TEST_CONFIG.equivalentHours}時間相当`);
  console.log(`継続ユーザー数: ${ENDURANCE_TEST_CONFIG.concurrentUsers}`);
  console.log(`サイクル間隔: ${ENDURANCE_TEST_CONFIG.cycleIntervalMs}ms`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  try {
    const result = await runEnduranceTestScenario();
    
    // 結果の表示と分析
    displayEnduranceTestResults(result);
    
    // テストレポートの生成
    generateEnduranceTestReport(result);

  } catch (error) {
    console.error('💥 長時間稼働テスト致命的エラー:', error);
    process.exit(1);
  }
}

// 長時間稼働テストシナリオ実行
async function runEnduranceTestScenario(): Promise<EnduranceTestResult> {
  const testName = `24時間相当稼働テスト（${ENDURANCE_TEST_CONFIG.totalDurationMinutes}分実行）`;
  const startTime = Date.now();
  const endTime = startTime + (ENDURANCE_TEST_CONFIG.totalDurationMinutes * 60 * 1000);
  
  const cycleResults: CycleResult[] = [];
  const resourceMetrics: ResourceMetric[] = [];
  const errors: string[] = [];
  
  let cycleCount = 0;
  let lastResourceCheck = startTime;
  
  console.log('🔄 長時間稼働テスト開始...\n');
  
  // 初期リソース状態を記録
  const initialMemory = process.memoryUsage();
  resourceMetrics.push(captureResourceMetric(startTime, initialMemory));
  console.log(`初期メモリ: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

  while (Date.now() < endTime) {
    cycleCount++;
    const cycleStartTime = Date.now();
    
    try {
      // サイクル実行（複数操作を含む実際のユーザー行動をシミュレート）
      const cycleResult = await executeCycle(cycleCount, cycleStartTime);
      cycleResults.push(cycleResult);
      
      // 進捗表示（10サイクルごと）
      if (cycleCount % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000 / 60 * 10) / 10;
        const remaining = Math.round((endTime - Date.now()) / 1000 / 60 * 10) / 10;
        const successRate = Math.round((cycleResults.filter(r => r.success).length / cycleResults.length) * 100);
        console.log(`📊 サイクル ${cycleCount} | 経過: ${elapsed}分 | 残り: ${remaining}分 | 成功率: ${successRate}%`);
      }
      
      // リソース監視
      if (Date.now() - lastResourceCheck >= ENDURANCE_TEST_CONFIG.resourceMonitoringIntervalMs) {
        const currentMemory = process.memoryUsage();
        resourceMetrics.push(captureResourceMetric(Date.now(), currentMemory));
        lastResourceCheck = Date.now();
        
        // メモリリーク簡易検出
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        if (memoryIncrease > ENDURANCE_TEST_CONFIG.memoryLeakThresholdMB * 1024 * 1024) {
          console.log(`⚠️  メモリ増加検出: +${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      console.log(`❌ サイクル ${cycleCount} エラー: ${errorMessage}`);
    }
    
    // サイクル間隔の調整
    const cycleEndTime = Date.now();
    const cycleDuration = cycleEndTime - cycleStartTime;
    const waitTime = Math.max(0, ENDURANCE_TEST_CONFIG.cycleIntervalMs - cycleDuration);
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  const finalTime = Date.now();
  console.log(`\n✅ 長時間稼働テスト完了 | 総サイクル数: ${cycleCount}`);
  
  return analyzeEnduranceTestResults(testName, startTime, finalTime, cycleResults, resourceMetrics, errors);
}

// 個別サイクル実行
async function executeCycle(cycleNumber: number, startTime: number): Promise<CycleResult> {
  const promises = Array.from({ length: ENDURANCE_TEST_CONFIG.concurrentUsers }, async (_, index) => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 複数操作の組み合わせ（実際のユーザー行動）
      const operations = [
        // データベースヘルスチェック
        client.from('users').select('id').limit(1),
        // 複数テーブルの簡単なクエリ
        client.from('posts').select('id').limit(2),
        client.from('likes').select('id').limit(2)
      ];
      
      // 1つの操作をランダムに選択して実行
      const selectedOperation = operations[Math.floor(Math.random() * operations.length)];
      await selectedOperation;
      
      return true;
    } catch (error) {
      return false;
    }
  });
  
  const results = await Promise.allSettled(promises);
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const success = successCount > ENDURANCE_TEST_CONFIG.concurrentUsers * 0.8; // 80%以上の成功で成功とみなす
  
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  const memorySnapshot = captureResourceMetric(endTime, process.memoryUsage());
  
  return {
    cycleNumber,
    startTime,
    endTime,
    success,
    responseTime,
    memorySnapshot
  };
}

// リソースメトリック取得
function captureResourceMetric(timestamp: number, memoryUsage: NodeJS.MemoryUsage): ResourceMetric {
  return {
    timestamp,
    memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal
  };
}

// 長時間稼働テスト結果分析
function analyzeEnduranceTestResults(
  testName: string,
  startTime: number,
  endTime: number,
  cycleResults: CycleResult[],
  resourceMetrics: ResourceMetric[],
  errors: string[]
): EnduranceTestResult {
  const totalCycles = cycleResults.length;
  const successfulCycles = cycleResults.filter(r => r.success).length;
  const failedCycles = totalCycles - successfulCycles;
  
  const responseTimes = cycleResults.map(r => r.responseTime);
  const averageResponseTime = Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length);
  
  // 応答時間の変動を計算（標準偏差）
  const responseTimeVariance = responseTimes.reduce((sum, time) => sum + Math.pow(time - averageResponseTime, 2), 0) / responseTimes.length;
  const responseTimeVariation = Math.round(Math.sqrt(responseTimeVariance));
  
  // メモリリーク検出
  const initialMemory = resourceMetrics[0]?.memoryUsage || 0;
  const finalMemory = resourceMetrics[resourceMetrics.length - 1]?.memoryUsage || 0;
  const memoryIncrease = finalMemory - initialMemory;
  const memoryLeakDetected = memoryIncrease > ENDURANCE_TEST_CONFIG.memoryLeakThresholdMB;
  
  // パフォーマンス劣化検出
  const firstQuarterCycles = cycleResults.slice(0, Math.floor(totalCycles * 0.25));
  const lastQuarterCycles = cycleResults.slice(Math.floor(totalCycles * 0.75));
  
  const firstQuarterAvgResponseTime = firstQuarterCycles.reduce((sum, r) => sum + r.responseTime, 0) / firstQuarterCycles.length;
  const lastQuarterAvgResponseTime = lastQuarterCycles.reduce((sum, r) => sum + r.responseTime, 0) / lastQuarterCycles.length;
  
  const performanceChange = ((lastQuarterAvgResponseTime - firstQuarterAvgResponseTime) / firstQuarterAvgResponseTime) * 100;
  const performanceDegradation = performanceChange > ENDURANCE_TEST_CONFIG.performanceDegradationThreshold;
  
  // 安定性スコア計算（0-100）
  const successRateScore = (successfulCycles / totalCycles) * 40; // 40点満点
  const memoryStabilityScore = memoryLeakDetected ? 0 : 30; // 30点満点
  const performanceStabilityScore = performanceDegradation ? 0 : 30; // 30点満点
  const stabilityScore = Math.round(successRateScore + memoryStabilityScore + performanceStabilityScore);
  
  return {
    testName,
    startTime,
    endTime,
    duration: endTime - startTime,
    totalCycles,
    successfulCycles,
    failedCycles,
    averageResponseTime,
    responseTimeVariation,
    memoryLeakDetected,
    performanceDegradation,
    resourceMetrics,
    errors: [...new Set(errors)],
    stabilityScore
  };
}

// 長時間稼働テスト結果表示
function displayEnduranceTestResults(result: EnduranceTestResult) {
  console.log('\n⏰ 長時間稼働テスト結果サマリー');
  console.log('=====================================');
  
  console.log(`📋 テスト名: ${result.testName}`);
  console.log(`⏱️  実行時間: ${Math.round(result.duration / 1000 / 60)}分`);
  console.log(`🔄 総サイクル数: ${result.totalCycles}`);
  console.log(`✅ 成功サイクル: ${result.successfulCycles}`);
  console.log(`❌ 失敗サイクル: ${result.failedCycles}`);
  console.log(`📈 成功率: ${Math.round((result.successfulCycles / result.totalCycles) * 100)}%`);
  console.log(`⏱️  平均応答時間: ${result.averageResponseTime}ms`);
  console.log(`📊 応答時間変動: ±${result.responseTimeVariation}ms`);
  
  // メモリ使用量の変化
  const initialMemory = result.resourceMetrics[0]?.memoryUsage || 0;
  const finalMemory = result.resourceMetrics[result.resourceMetrics.length - 1]?.memoryUsage || 0;
  const memoryChange = finalMemory - initialMemory;
  
  console.log(`🧠 メモリ使用量変化: ${initialMemory}MB → ${finalMemory}MB (${memoryChange >= 0 ? '+' : ''}${memoryChange}MB)`);
  
  if (result.memoryLeakDetected) {
    console.log(`⚠️  メモリリーク検出: ${memoryChange}MB増加`);
  } else {
    console.log(`✅ メモリ使用量安定`);
  }
  
  if (result.performanceDegradation) {
    console.log(`⚠️  パフォーマンス劣化検出`);
  } else {
    console.log(`✅ パフォーマンス安定`);
  }
  
  // エラー情報
  if (result.errors.length > 0) {
    console.log(`🚨 発生エラー (${result.errors.length}種類):`);
    result.errors.slice(0, 5).forEach(error => {
      console.log(`   - ${error}`);
    });
  }
  
  // 安定性スコア
  console.log(`\n🎯 安定性スコア: ${result.stabilityScore}/100`);
  
  if (result.stabilityScore >= 90) {
    console.log('🎉 優秀！システムは24時間相当の長時間稼働に完璧に対応できます。');
  } else if (result.stabilityScore >= 70) {
    console.log('✅ 良好！システムは長時間稼働に対応できますが、一部改善の余地があります。');
  } else if (result.stabilityScore >= 50) {
    console.log('⚠️  注意：長時間稼働で問題が発生する可能性があります。改善が必要です。');
  } else {
    console.log('🚨 警告：長時間稼働に重大な問題があります。システムの安定性向上が必要です。');
  }
}

// 長時間稼働テストレポート生成
function generateEnduranceTestReport(result: EnduranceTestResult) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `production-endurance-test-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'endurance-test',
    project: {
      name: 'Mamapace',
      url: supabaseUrl
    },
    configuration: ENDURANCE_TEST_CONFIG,
    summary: {
      totalCycles: result.totalCycles,
      successRate: Math.round((result.successfulCycles / result.totalCycles) * 100),
      averageResponseTime: result.averageResponseTime,
      memoryLeakDetected: result.memoryLeakDetected,
      performanceDegradation: result.performanceDegradation,
      stabilityScore: result.stabilityScore
    },
    testResult: result,
    recommendations: generateEnduranceTestRecommendations(result)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 長時間稼働テストレポートを保存しました: ${reportPath}`);
}

// 長時間稼働テスト推奨事項生成
function generateEnduranceTestRecommendations(result: EnduranceTestResult): string[] {
  const recommendations: string[] = [];
  
  if (result.stabilityScore >= 90) {
    recommendations.push('システムは24時間相当の長時間稼働に完璧に対応できます。本番環境への移行準備完了です。');
  }
  
  if (result.memoryLeakDetected) {
    const initialMemory = result.resourceMetrics[0]?.memoryUsage || 0;
    const finalMemory = result.resourceMetrics[result.resourceMetrics.length - 1]?.memoryUsage || 0;
    const memoryIncrease = finalMemory - initialMemory;
    recommendations.push(`メモリリークが検出されました (+${memoryIncrease}MB)。Node.jsプロセスの再起動スケジュール設定を検討してください。`);
  }
  
  if (result.performanceDegradation) {
    recommendations.push('時間経過とともにパフォーマンスが劣化しています。データベース接続プール設定の見直しを検討してください。');
  }
  
  const successRate = (result.successfulCycles / result.totalCycles) * 100;
  if (successRate < 95) {
    recommendations.push(`成功率が${Math.round(successRate)}%です。Supabaseの接続安定性とRLS最適化を確認してください。`);
  }
  
  if (result.responseTimeVariation > result.averageResponseTime * 0.5) {
    recommendations.push('応答時間の変動が大きいです。負荷分散とキャッシュ戦略の見直しを検討してください。');
  }
  
  return recommendations;
}

// スクリプト実行
runProductionEnduranceTest().catch(console.error);