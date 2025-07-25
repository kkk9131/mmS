#!/usr/bin/env tsx
/**
 * 継続監視システム
 * 定期的なヘルスチェックとアラート機能
 */

import { createClient } from '@supabase/supabase-js';

// 環境変数
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface MonitoringConfig {
  intervalMinutes: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    consecutiveFailures: number;
  };
  services: string[];
}

interface MonitoringState {
  consecutiveFailures: Record<string, number>;
  lastAlertTime: Record<string, number>;
  isRunning: boolean;
}

const config: MonitoringConfig = {
  intervalMinutes: 5, // 5分間隔
  alertThresholds: {
    responseTime: 1000, // 1秒
    errorRate: 0.1, // 10%
    consecutiveFailures: 3 // 3回連続失敗
  },
  services: ['database', 'api', 'auth', 'storage', 'realtime']
};

const state: MonitoringState = {
  consecutiveFailures: {},
  lastAlertTime: {},
  isRunning: false
};

// 継続監視の開始
async function startContinuousMonitoring() {
  console.log('🔄 Mamapace継続監視システム開始');
  console.log('===================================');
  console.log(`監視間隔: ${config.intervalMinutes}分`);
  console.log(`アラート閾値: 応答時間${config.alertThresholds.responseTime}ms, 連続失敗${config.alertThresholds.consecutiveFailures}回`);
  console.log(`監視サービス: ${config.services.join(', ')}`);
  console.log(`開始時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  state.isRunning = true;

  // 初回実行
  await performHealthCheck();

  // 定期実行の開始
  const intervalMs = config.intervalMinutes * 60 * 1000;
  const interval = setInterval(async () => {
    if (!state.isRunning) {
      clearInterval(interval);
      return;
    }
    await performHealthCheck();
  }, intervalMs);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 監視システムを停止中...');
    state.isRunning = false;
    clearInterval(interval);
    process.exit(0);
  });

  console.log('✅ 継続監視システムが開始されました。Ctrl+C で停止できます。');
}

// ヘルスチェック実行
async function performHealthCheck() {
  const timestamp = new Date().toLocaleString('ja-JP');
  console.log(`\n🔍 [${timestamp}] ヘルスチェック実行中...`);

  try {
    // 基本的なAPI応答確認
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    const responseTime = Date.now() - startTime;
    const serviceName = 'supabase-api';

    if (error || responseTime > config.alertThresholds.responseTime) {
      // 失敗カウント増加
      state.consecutiveFailures[serviceName] = (state.consecutiveFailures[serviceName] || 0) + 1;
      
      const errorMessage = error?.message || `応答時間遅延 (${responseTime}ms)`;
      console.log(`❌ [${serviceName}] エラー: ${errorMessage}`);
      
      // アラート判定
      if (state.consecutiveFailures[serviceName] >= config.alertThresholds.consecutiveFailures) {
        await sendAlert(serviceName, errorMessage, responseTime);
      }
    } else {
      // 成功時はカウントリセット
      if (state.consecutiveFailures[serviceName] > 0) {
        console.log(`✅ [${serviceName}] 復旧しました (${responseTime}ms)`);
        state.consecutiveFailures[serviceName] = 0;
      } else {
        console.log(`✅ [${serviceName}] 正常 (${responseTime}ms)`);
      }
    }

    // 統計情報の記録
    await recordMetrics({
      timestamp: new Date().toISOString(),
      service: serviceName,
      responseTime,
      status: error ? 'error' : 'healthy',
      error: error?.message
    });

  } catch (err) {
    console.error(`❌ ヘルスチェック実行エラー: ${err}`);
    state.consecutiveFailures['system'] = (state.consecutiveFailures['system'] || 0) + 1;
  }
}

// アラート送信
async function sendAlert(service: string, message: string, responseTime: number) {
  const now = Date.now();
  const lastAlert = state.lastAlertTime[service] || 0;
  const alertCooldown = 30 * 60 * 1000; // 30分間のクールダウン

  // クールダウン中はアラートを送信しない
  if (now - lastAlert < alertCooldown) {
    return;
  }

  state.lastAlertTime[service] = now;

  const alertMessage = `
🚨 Mamapace監視アラート

サービス: ${service}
エラー: ${message}
応答時間: ${responseTime}ms
連続失敗回数: ${state.consecutiveFailures[service]}回
発生時刻: ${new Date().toLocaleString('ja-JP')}

プロジェクトURL: ${supabaseUrl}
`;

  console.log('🚨 アラート発生:');
  console.log(alertMessage);

  // 実際の運用では、ここでSlack、Discord、メール等に通知
  // await sendSlackNotification(alertMessage);
  // await sendEmailAlert(alertMessage);
  
  // ログファイルに記録
  await logAlert(alertMessage);
}

// メトリクス記録
async function recordMetrics(metrics: {
  timestamp: string;
  service: string;
  responseTime: number;
  status: string;
  error?: string;
}) {
  const fs = require('fs');
  const path = require('path');
  
  const metricsDir = path.join(process.cwd(), 'monitoring-reports', 'metrics');
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const metricsFile = path.join(metricsDir, `metrics-${date}.jsonl`);
  
  const metricLine = JSON.stringify(metrics) + '\n';
  fs.appendFileSync(metricsFile, metricLine);
}

// アラートログ記録
async function logAlert(alertMessage: string) {
  const fs = require('fs');
  const path = require('path');
  
  const alertsDir = path.join(process.cwd(), 'monitoring-reports', 'alerts');
  if (!fs.existsSync(alertsDir)) {
    fs.mkdirSync(alertsDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const alertsFile = path.join(alertsDir, `alerts-${date}.log`);
  
  const logEntry = `[${new Date().toISOString()}] ${alertMessage}\n${'='.repeat(50)}\n`;
  fs.appendFileSync(alertsFile, logEntry);
}

// システム統計の表示
function displaySystemStats() {
  console.log('\n📊 システム統計:');
  console.log('================');
  
  Object.entries(state.consecutiveFailures).forEach(([service, failures]) => {
    if (failures > 0) {
      console.log(`⚠️  ${service}: ${failures}回連続失敗`);
    }
  });

  const activeAlerts = Object.keys(state.lastAlertTime).length;
  console.log(`🚨 アクティブアラート: ${activeAlerts}件`);
  console.log(`⏰ 監視状態: ${state.isRunning ? '実行中' : '停止中'}`);
}

// 使用方法の表示
function showUsage() {
  console.log(`
📋 Mamapace継続監視システム

使用方法:
  npm run monitoring:start     # 継続監視開始
  npm run monitoring:check     # 単発ヘルスチェック
  npm run monitoring:stats     # 統計情報表示

設定:
  - 監視間隔: ${config.intervalMinutes}分
  - アラート閾値: ${config.alertThresholds.responseTime}ms
  - 連続失敗許容: ${config.alertThresholds.consecutiveFailures}回

ファイル出力:
  - monitoring-reports/metrics/     # メトリクスデータ
  - monitoring-reports/alerts/      # アラートログ
  - monitoring-reports/            # ヘルスチェックレポート

終了: Ctrl+C
`);
}

// コマンドライン引数の処理
const command = process.argv[2];

switch (command) {
  case 'start':
    startContinuousMonitoring();
    break;
  case 'stats':
    displaySystemStats();
    break;
  case 'help':
    showUsage();
    break;
  default:
    console.log('継続監視システムのデモ実行');
    performHealthCheck().then(() => {
      console.log('\n単発ヘルスチェック完了。');
      console.log('継続監視を開始するには: npm run monitoring:start');
    });
}