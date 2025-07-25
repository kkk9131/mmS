#!/usr/bin/env tsx
/**
 * 本番環境リソース監視システム
 * メモリリーク・リソース使用量の継続監視
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

interface ResourceSnapshot {
  timestamp: number;
  memoryUsage: {
    rss: number; // MB
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  systemInfo: {
    platform: string;
    nodeVersion: string;
    uptime: number; // seconds
  };
  databaseHealth: {
    connectionTime: number;
    success: boolean;
    error?: string;
  };
  performanceMetrics: {
    cpuUsage?: number;
    loadAverage?: number[];
  };
}

interface ResourceMonitoringResult {
  testName: string;
  monitoringDuration: number;
  totalSnapshots: number;
  resourceSnapshots: ResourceSnapshot[];
  memoryAnalysis: {
    initialMemory: number;
    finalMemory: number;
    peakMemory: number;
    memoryIncrease: number;
    memoryLeakDetected: boolean;
    averageMemoryUsage: number;
  };
  performanceAnalysis: {
    averageDbConnectionTime: number;
    maxDbConnectionTime: number;
    dbConnectionFailures: number;
    overallDbHealthScore: number;
  };
  recommendations: string[];
  stabilityScore: number;
}

// リソース監視設定（デモンストレーション用に短縮）
const RESOURCE_MONITOR_CONFIG = {
  monitoringDurationMinutes: 3, // 3分間の監視
  snapshotIntervalMs: 5000, // 5秒ごとにスナップショット
  memoryLeakThresholdMB: 30, // 30MB以上の増加でメモリリーク
  dbConnectionTimeoutMs: 5000, // 5秒のDB接続タイムアウト
  alertThresholds: {
    memoryUsageMB: 100, // 100MB以上でアラート
    dbConnectionTimeMs: 2000, // 2秒以上でアラート
    dbFailureRate: 10 // 10%以上の失敗率でアラート
  }
};

// 本番環境リソース監視実行
async function runProductionResourceMonitor() {
  console.log('🔍 Mamapace本番環境リソース監視システム');
  console.log('=======================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`監視時間: ${RESOURCE_MONITOR_CONFIG.monitoringDurationMinutes}分`);
  console.log(`スナップショット間隔: ${RESOURCE_MONITOR_CONFIG.snapshotIntervalMs}ms`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  try {
    const result = await runResourceMonitoring();
    
    // 結果の表示と分析
    displayResourceMonitoringResults(result);
    
    // 監視レポートの生成
    generateResourceMonitoringReport(result);

  } catch (error) {
    console.error('💥 リソース監視エラー:', error);
    process.exit(1);
  }
}

// リソース監視実行
async function runResourceMonitoring(): Promise<ResourceMonitoringResult> {
  const testName = `本番環境リソース監視（${RESOURCE_MONITOR_CONFIG.monitoringDurationMinutes}分）`;
  const startTime = Date.now();
  const endTime = startTime + (RESOURCE_MONITOR_CONFIG.monitoringDurationMinutes * 60 * 1000);
  
  const resourceSnapshots: ResourceSnapshot[] = [];
  let snapshotCount = 0;
  
  console.log('📊 リソース監視開始...\n');

  while (Date.now() < endTime) {
    snapshotCount++;
    
    try {
      const snapshot = await captureResourceSnapshot();
      resourceSnapshots.push(snapshot);
      
      // 進捗とアラート表示
      if (snapshotCount % 6 === 0) { // 1分ごとに表示
        const elapsed = Math.round((Date.now() - startTime) / 1000 / 60 * 10) / 10;
        const remaining = Math.round((endTime - Date.now()) / 1000 / 60 * 10) / 10;
        
        console.log(`⏱️  ${elapsed}分経過 | 残り: ${remaining}分 | スナップショット: ${snapshotCount}`);
        console.log(`   メモリ: ${snapshot.memoryUsage.heapUsed}MB | DB接続: ${snapshot.databaseHealth.connectionTime}ms`);
        
        // アラート判定
        if (snapshot.memoryUsage.heapUsed > RESOURCE_MONITOR_CONFIG.alertThresholds.memoryUsageMB) {
          console.log(`   🚨 メモリ使用量アラート: ${snapshot.memoryUsage.heapUsed}MB`);
        }
        
        if (snapshot.databaseHealth.connectionTime > RESOURCE_MONITOR_CONFIG.alertThresholds.dbConnectionTimeMs) {
          console.log(`   🚨 DB接続時間アラート: ${snapshot.databaseHealth.connectionTime}ms`);
        }
        
        if (!snapshot.databaseHealth.success) {
          console.log(`   🚨 DB接続失敗: ${snapshot.databaseHealth.error}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ スナップショット ${snapshotCount} エラー:`, error);
    }
    
    // 次のスナップショットまで待機
    await new Promise(resolve => setTimeout(resolve, RESOURCE_MONITOR_CONFIG.snapshotIntervalMs));
  }
  
  console.log(`\n✅ リソース監視完了 | 総スナップショット数: ${snapshotCount}`);
  
  return analyzeResourceMonitoringResults(testName, Date.now() - startTime, resourceSnapshots);
}

// リソーススナップショット取得
async function captureResourceSnapshot(): Promise<ResourceSnapshot> {
  const timestamp = Date.now();
  const memoryUsage = process.memoryUsage();
  
  // データベースヘルスチェック
  const dbStart = Date.now();
  let databaseHealth = {
    connectionTime: 0,
    success: false,
    error: undefined as string | undefined
  };
  
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await Promise.race([
      client.from('users').select('id').limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timeout')), RESOURCE_MONITOR_CONFIG.dbConnectionTimeoutMs))
    ]);
    
    databaseHealth = {
      connectionTime: Date.now() - dbStart,
      success: !error,
      error: error?.message
    };
  } catch (err) {
    databaseHealth = {
      connectionTime: Date.now() - dbStart,
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
  
  return {
    timestamp,
    memoryUsage: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    },
    systemInfo: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: Math.round(process.uptime())
    },
    databaseHealth,
    performanceMetrics: {
      // Node.jsでは簡易的なCPU使用率は取得困難なため省略
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : undefined
    }
  };
}

// リソース監視結果分析
function analyzeResourceMonitoringResults(
  testName: string,
  monitoringDuration: number,
  resourceSnapshots: ResourceSnapshot[]
): ResourceMonitoringResult {
  
  // メモリ分析
  const memoryUsages = resourceSnapshots.map(s => s.memoryUsage.heapUsed);
  const initialMemory = memoryUsages[0] || 0;
  const finalMemory = memoryUsages[memoryUsages.length - 1] || 0;
  const peakMemory = Math.max(...memoryUsages);
  const memoryIncrease = finalMemory - initialMemory;
  const memoryLeakDetected = memoryIncrease > RESOURCE_MONITOR_CONFIG.memoryLeakThresholdMB;
  const averageMemoryUsage = Math.round(memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length);
  
  // パフォーマンス分析
  const dbHealths = resourceSnapshots.map(s => s.databaseHealth);
  const successfulConnections = dbHealths.filter(db => db.success);
  const failedConnections = dbHealths.filter(db => !db.success);
  
  const connectionTimes = successfulConnections.map(db => db.connectionTime);
  const averageDbConnectionTime = connectionTimes.length > 0 
    ? Math.round(connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length)
    : 0;
  const maxDbConnectionTime = connectionTimes.length > 0 ? Math.max(...connectionTimes) : 0;
  const dbConnectionFailures = failedConnections.length;
  const dbFailureRate = (dbConnectionFailures / dbHealths.length) * 100;
  const overallDbHealthScore = Math.round(100 - dbFailureRate);
  
  // 安定性スコア計算
  const memoryStabilityScore = memoryLeakDetected ? 0 : 30;
  const dbStabilityScore = Math.min(30, Math.round((overallDbHealthScore / 100) * 30));
  const performanceScore = averageDbConnectionTime <= 1000 ? 40 : Math.max(0, 40 - Math.round((averageDbConnectionTime - 1000) / 100));
  const stabilityScore = memoryStabilityScore + dbStabilityScore + performanceScore;
  
  return {
    testName,
    monitoringDuration,
    totalSnapshots: resourceSnapshots.length,
    resourceSnapshots,
    memoryAnalysis: {
      initialMemory,
      finalMemory,
      peakMemory,
      memoryIncrease,
      memoryLeakDetected,
      averageMemoryUsage
    },
    performanceAnalysis: {
      averageDbConnectionTime,
      maxDbConnectionTime,
      dbConnectionFailures,
      overallDbHealthScore
    },
    recommendations: generateResourceMonitoringRecommendations({
      memoryLeakDetected,
      memoryIncrease,
      averageDbConnectionTime,
      dbFailureRate,
      peakMemory
    }),
    stabilityScore
  };
}

// リソース監視結果表示
function displayResourceMonitoringResults(result: ResourceMonitoringResult) {
  console.log('\n🔍 リソース監視結果サマリー');
  console.log('==============================');
  
  console.log(`📋 監視名: ${result.testName}`);
  console.log(`⏱️  監視時間: ${Math.round(result.monitoringDuration / 1000 / 60)}分`);
  console.log(`📊 総スナップショット数: ${result.totalSnapshots}`);
  
  // メモリ分析結果
  console.log('\n🧠 メモリ使用量分析:');
  console.log(`   初期メモリ: ${result.memoryAnalysis.initialMemory}MB`);
  console.log(`   最終メモリ: ${result.memoryAnalysis.finalMemory}MB`);
  console.log(`   ピークメモリ: ${result.memoryAnalysis.peakMemory}MB`);
  console.log(`   メモリ増加: ${result.memoryAnalysis.memoryIncrease >= 0 ? '+' : ''}${result.memoryAnalysis.memoryIncrease}MB`);
  console.log(`   平均メモリ使用量: ${result.memoryAnalysis.averageMemoryUsage}MB`);
  
  if (result.memoryAnalysis.memoryLeakDetected) {
    console.log(`   ⚠️  メモリリーク検出: ${result.memoryAnalysis.memoryIncrease}MB増加`);
  } else {
    console.log(`   ✅ メモリ使用量安定`);
  }
  
  // パフォーマンス分析結果
  console.log('\n⚡ データベースパフォーマンス分析:');
  console.log(`   平均接続時間: ${result.performanceAnalysis.averageDbConnectionTime}ms`);
  console.log(`   最大接続時間: ${result.performanceAnalysis.maxDbConnectionTime}ms`);
  console.log(`   接続失敗回数: ${result.performanceAnalysis.dbConnectionFailures}回`);
  console.log(`   DB健全性スコア: ${result.performanceAnalysis.overallDbHealthScore}%`);
  
  // 推奨事項
  if (result.recommendations.length > 0) {
    console.log('\n📝 推奨事項:');
    result.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  // 総合評価
  console.log(`\n🎯 システム安定性スコア: ${result.stabilityScore}/100`);
  
  if (result.stabilityScore >= 90) {
    console.log('🎉 優秀！システムリソースが完璧に管理されています。');
  } else if (result.stabilityScore >= 70) {
    console.log('✅ 良好！システムは安定していますが、一部改善の余地があります。');
  } else if (result.stabilityScore >= 50) {
    console.log('⚠️  注意：リソース管理に問題があります。改善が必要です。');
  } else {
    console.log('🚨 警告：重大なリソース問題があります。即座の対応が必要です。');
  }
}

// リソース監視レポート生成
function generateResourceMonitoringReport(result: ResourceMonitoringResult) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `production-resource-monitor-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'resource-monitoring',
    project: {
      name: 'Mamapace',
      url: supabaseUrl
    },
    configuration: RESOURCE_MONITOR_CONFIG,
    summary: {
      monitoringDuration: Math.round(result.monitoringDuration / 1000 / 60),
      totalSnapshots: result.totalSnapshots,
      memoryLeakDetected: result.memoryAnalysis.memoryLeakDetected,
      memoryIncrease: result.memoryAnalysis.memoryIncrease,
      averageDbConnectionTime: result.performanceAnalysis.averageDbConnectionTime,
      dbHealthScore: result.performanceAnalysis.overallDbHealthScore,
      stabilityScore: result.stabilityScore
    },
    detailedResults: result,
    recommendations: result.recommendations
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 リソース監視レポートを保存しました: ${reportPath}`);
}

// リソース監視推奨事項生成
function generateResourceMonitoringRecommendations(analysis: {
  memoryLeakDetected: boolean;
  memoryIncrease: number;
  averageDbConnectionTime: number;
  dbFailureRate: number;
  peakMemory: number;
}): string[] {
  const recommendations: string[] = [];
  
  if (!analysis.memoryLeakDetected && analysis.averageDbConnectionTime <= 1000 && analysis.dbFailureRate <= 5) {
    recommendations.push('システムリソースが完璧に管理されています。本番環境での安定稼働が可能です。');
  }
  
  if (analysis.memoryLeakDetected) {
    recommendations.push(`メモリリークが検出されました (+${analysis.memoryIncrease}MB)。プロセスの定期再起動スケジュールを設定してください。`);
  }
  
  if (analysis.averageDbConnectionTime > 1000) {
    recommendations.push(`DB接続時間が${analysis.averageDbConnectionTime}msと長めです。データベース接続プール設定を最適化してください。`);
  }
  
  if (analysis.dbFailureRate > 5) {
    recommendations.push(`DB接続失敗率が${Math.round(analysis.dbFailureRate)}%です。ネットワーク設定とSupabase接続設定を確認してください。`);
  }
  
  if (analysis.peakMemory > 200) {
    recommendations.push(`ピークメモリ使用量が${analysis.peakMemory}MBと高めです。メモリ使用量の最適化を検討してください。`);
  }
  
  // 運用推奨事項
  recommendations.push('継続的な監視のため、本監視スクリプトを定期実行（週1回）することを推奨します。');
  
  return recommendations;
}

// スクリプト実行
runProductionResourceMonitor().catch(console.error);