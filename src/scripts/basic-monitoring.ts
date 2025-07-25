#!/usr/bin/env tsx
/**
 * 基本監視システム
 * Supabaseプロジェクトの基本的なヘルスチェックと監視
 */

import { createClient } from '@supabase/supabase-js';

// 環境変数の確認
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません');
  process.exit(1);
}

// Supabaseクライアントの初期化
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface HealthCheck {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  message: string;
  timestamp: string;
}

// 基本監視の実行
async function runBasicMonitoring() {
  console.log('🔍 Mamapace基本監視システム');
  console.log('====================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const healthChecks: HealthCheck[] = [];

  // 1. データベース接続確認
  console.log('1️⃣ データベース接続確認中...');
  const dbHealth = await checkDatabaseHealth();
  healthChecks.push(dbHealth);

  // 2. API応答時間確認
  console.log('2️⃣ API応答時間確認中...');
  const apiHealth = await checkApiResponseTime();
  healthChecks.push(apiHealth);

  // 3. 認証システム確認
  console.log('3️⃣ 認証システム確認中...');
  const authHealth = await checkAuthSystem();
  healthChecks.push(authHealth);

  // 4. ストレージ確認
  console.log('4️⃣ ストレージシステム確認中...');
  const storageHealth = await checkStorageSystem();
  healthChecks.push(storageHealth);

  // 5. リアルタイム機能確認
  console.log('5️⃣ リアルタイム機能確認中...');
  const realtimeHealth = await checkRealtimeSystem();
  healthChecks.push(realtimeHealth);

  // 結果の表示と分析
  displayHealthResults(healthChecks);
  
  // 監視レポートの生成
  generateMonitoringReport(healthChecks);
}

// データベース接続確認
async function checkDatabaseHealth(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        service: 'Database',
        status: 'error',
        responseTime,
        message: `データベースエラー: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }

    const status = responseTime > 1000 ? 'warning' : 'healthy';
    const message = status === 'warning' 
      ? `応答時間が遅い (${responseTime}ms)` 
      : `正常 (${responseTime}ms)`;

    return {
      service: 'Database',
      status,
      responseTime,
      message,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      service: 'Database',
      status: 'error',
      responseTime: Date.now() - startTime,
      message: `接続エラー: ${err}`,
      timestamp: new Date().toISOString()
    };
  }
}

// API応答時間確認
async function checkApiResponseTime(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, created_at')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        service: 'API',
        status: 'error',
        responseTime,
        message: `APIエラー: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let message = `正常 (${responseTime}ms)`;

    if (responseTime > 500) {
      status = 'warning';
      message = `応答時間が基準を超過 (${responseTime}ms > 500ms)`;
    }

    if (responseTime > 2000) {
      status = 'error';
      message = `応答時間が異常に遅い (${responseTime}ms)`;
    }

    return {
      service: 'API',
      status,
      responseTime,
      message,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      service: 'API',
      status: 'error',
      responseTime: Date.now() - startTime,
      message: `API接続エラー: ${err}`,
      timestamp: new Date().toISOString()
    };
  }
}

// 認証システム確認
async function checkAuthSystem(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // 匿名セッション確認（実際のログインは行わない）
    const { data: { session }, error } = await supabase.auth.getSession();
    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        service: 'Auth',
        status: 'error',
        responseTime,
        message: `認証エラー: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }

    return {
      service: 'Auth',
      status: 'healthy',
      responseTime,
      message: `認証システム正常 (${responseTime}ms)`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      service: 'Auth',
      status: 'error',
      responseTime: Date.now() - startTime,
      message: `認証システム接続エラー: ${err}`,
      timestamp: new Date().toISOString()
    };
  }
}

// ストレージシステム確認
async function checkStorageSystem(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        service: 'Storage',
        status: 'error',
        responseTime,
        message: `ストレージエラー: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }

    const bucketCount = buckets?.length || 0;
    return {
      service: 'Storage',
      status: 'healthy',
      responseTime,
      message: `ストレージ正常 (${bucketCount}バケット, ${responseTime}ms)`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      service: 'Storage',
      status: 'error',
      responseTime: Date.now() - startTime,
      message: `ストレージ接続エラー: ${err}`,
      timestamp: new Date().toISOString()
    };
  }
}

// リアルタイム機能確認
async function checkRealtimeSystem(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // リアルタイム接続のテスト（簡単な接続確認のみ）
    const channel = supabase.channel('health-check');
    
    return new Promise<HealthCheck>((resolve) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        resolve({
          service: 'Realtime',
          status: 'warning',
          responseTime: Date.now() - startTime,
          message: 'リアルタイム接続タイムアウト (5秒)',
          timestamp: new Date().toISOString()
        });
      }, 5000);

      channel
        .on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          channel.unsubscribe();
          const responseTime = Date.now() - startTime;
          
          resolve({
            service: 'Realtime',
            status: 'healthy',
            responseTime,
            message: `リアルタイム正常 (${responseTime}ms)`,
            timestamp: new Date().toISOString()
          });
        })
        .subscribe();
    });
  } catch (err) {
    return {
      service: 'Realtime',
      status: 'error',
      responseTime: Date.now() - startTime,
      message: `リアルタイム接続エラー: ${err}`,
      timestamp: new Date().toISOString()
    };
  }
}

// 結果の表示
function displayHealthResults(healthChecks: HealthCheck[]) {
  console.log('\n📊 監視結果サマリー');
  console.log('====================');

  const healthy = healthChecks.filter(h => h.status === 'healthy').length;
  const warnings = healthChecks.filter(h => h.status === 'warning').length;
  const errors = healthChecks.filter(h => h.status === 'error').length;

  console.log(`✅ 正常: ${healthy}サービス`);
  console.log(`⚠️  警告: ${warnings}サービス`);
  console.log(`❌ エラー: ${errors}サービス`);

  // 詳細結果
  console.log('\n📋 詳細結果:');
  healthChecks.forEach((health, index) => {
    const icon = health.status === 'healthy' ? '✅' : health.status === 'warning' ? '⚠️ ' : '❌';
    console.log(`\n${index + 1}. ${icon} ${health.service}`);
    console.log(`   状態: ${health.message}`);
    console.log(`   応答時間: ${health.responseTime}ms`);
  });

  // 総合評価
  const overallStatus = errors > 0 ? 'エラー' : warnings > 0 ? '警告' : '正常';
  const statusIcon = errors > 0 ? '❌' : warnings > 0 ? '⚠️ ' : '✅';
  
  console.log(`\n🎯 総合状態: ${statusIcon} ${overallStatus}`);

  if (errors > 0) {
    console.log('🚨 エラーが発生しています。至急確認が必要です。');
  } else if (warnings > 0) {
    console.log('⚠️  警告があります。監視を継続してください。');
  } else {
    console.log('✨ すべてのサービスが正常に動作しています！');
  }
}

// 監視レポートの生成
function generateMonitoringReport(healthChecks: HealthCheck[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `monitoring-reports/health-check-${timestamp}.json`;

  // レポートディレクトリ作成
  const fs = require('fs');
  const path = require('path');
  const reportDir = path.join(process.cwd(), 'monitoring-reports');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    project: {
      name: 'Mamapace',
      url: supabaseUrl,
      environment: 'production'
    },
    summary: {
      total: healthChecks.length,
      healthy: healthChecks.filter(h => h.status === 'healthy').length,
      warnings: healthChecks.filter(h => h.status === 'warning').length,
      errors: healthChecks.filter(h => h.status === 'error').length
    },
    checks: healthChecks,
    performance: {
      averageResponseTime: Math.round(
        healthChecks.reduce((sum, h) => sum + h.responseTime, 0) / healthChecks.length
      ),
      slowestService: healthChecks.reduce((prev, current) => 
        prev.responseTime > current.responseTime ? prev : current
      ),
      fastestService: healthChecks.reduce((prev, current) => 
        prev.responseTime < current.responseTime ? prev : current
      )
    }
  };

  const fullReportPath = path.join(reportDir, `health-check-${timestamp}.json`);
  fs.writeFileSync(fullReportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 監視レポートを保存しました: ${fullReportPath}`);
}

// スクリプト実行
runBasicMonitoring().catch(console.error);