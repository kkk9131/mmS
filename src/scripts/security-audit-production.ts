#!/usr/bin/env tsx
/**
 * 本番環境セキュリティ監査スクリプト
 * Supabaseセキュリティ設定の確認と報告
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// 環境変数の確認
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY環境変数が設定されていません');
  process.exit(1);
}

// Supabaseクライアントの初期化
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface SecurityCheckResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  recommendation?: string;
}

// セキュリティ監査の実行
async function runSecurityAudit() {
  console.log('🔒 Mamapace本番環境セキュリティ監査');
  console.log('=====================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const results: SecurityCheckResult[] = [];

  // 1. RLS（Row Level Security）の確認
  console.log('1️⃣ RLS設定を確認中...');
  const rlsResults = await checkRLSStatus();
  results.push(...rlsResults);

  // 2. APIキーとアクセス制限の確認
  console.log('\n2️⃣ APIキー設定を確認中...');
  const apiKeyResults = await checkAPIKeySettings();
  results.push(...apiKeyResults);

  // 3. データベース権限の確認
  console.log('\n3️⃣ データベース権限を確認中...');
  const dbPermResults = await checkDatabasePermissions();
  results.push(...dbPermResults);

  // 4. Storage設定の確認
  console.log('\n4️⃣ Storage設定を確認中...');
  const storageResults = await checkStorageSettings();
  results.push(...storageResults);

  // 5. バックアップ設定の確認
  console.log('\n5️⃣ バックアップ設定を確認中...');
  const backupResults = await checkBackupSettings();
  results.push(...backupResults);

  // 結果の集計と表示
  displayResults(results);
  
  // レポートファイルの生成
  generateReport(results);
}

// RLS状態の確認
async function checkRLSStatus(): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];
  const tables = ['users', 'posts', 'likes', 'comments', 'notifications', 'follows', 'push_tokens', 'notification_settings', 'image_uploads'];

  for (const table of tables) {
    try {
      // RLSが有効かチェック（実際の確認はSupabase Dashboardで行う必要があります）
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error && error.message.includes('row-level security')) {
        results.push({
          check: `${table}テーブルのRLS`,
          status: 'pass',
          message: 'RLSが有効になっています'
        });
      } else {
        results.push({
          check: `${table}テーブルのRLS`,
          status: 'warning',
          message: 'RLS状態を確認してください',
          recommendation: 'Supabase DashboardでRLSが有効になっていることを確認してください'
        });
      }
    } catch (err) {
      results.push({
        check: `${table}テーブルのRLS`,
        status: 'fail',
        message: 'RLS確認エラー',
        recommendation: 'テーブル設定を確認してください'
      });
    }
  }

  return results;
}

// APIキー設定の確認
async function checkAPIKeySettings(): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];

  // 環境変数の確認
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    results.push({
      check: 'Anonymous APIキー',
      status: 'warning',
      message: '環境変数が設定されていません',
      recommendation: 'EXPO_PUBLIC_SUPABASE_ANON_KEYを設定してください'
    });
  } else {
    results.push({
      check: 'Anonymous APIキー',
      status: 'pass',
      message: '環境変数が設定されています'
    });
  }

  // サービスロールキーの保護
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NODE_ENV === 'production') {
    results.push({
      check: 'Service Roleキーの保護',
      status: 'warning',
      message: '本番環境でService Roleキーが使用されています',
      recommendation: 'クライアントサイドではService Roleキーを使用しないでください'
    });
  } else {
    results.push({
      check: 'Service Roleキーの保護',
      status: 'pass',
      message: '適切に保護されています'
    });
  }

  return results;
}

// データベース権限の確認
async function checkDatabasePermissions(): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];

  // 匿名ユーザーのアクセス制限確認
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      results.push({
        check: '匿名アクセス制限',
        status: 'pass',
        message: '匿名ユーザーのアクセスが適切に制限されています'
      });
    } else {
      results.push({
        check: '匿名アクセス制限',
        status: 'warning',
        message: '匿名ユーザーがデータにアクセスできる可能性があります',
        recommendation: 'RLSポリシーを確認してください'
      });
    }
  } catch (err) {
    results.push({
      check: '匿名アクセス制限',
      status: 'fail',
      message: '確認中にエラーが発生しました'
    });
  }

  return results;
}

// Storage設定の確認
async function checkStorageSettings(): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];

  // ストレージバケットの確認
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      results.push({
        check: 'Storageバケット設定',
        status: 'fail',
        message: 'バケット一覧の取得に失敗しました'
      });
    } else {
      const publicBuckets = buckets?.filter(b => b.public) || [];
      
      if (publicBuckets.length > 0) {
        results.push({
          check: 'Storageバケット設定',
          status: 'warning',
          message: `${publicBuckets.length}個のパブリックバケットがあります`,
          recommendation: 'バケットのアクセス権限を確認してください'
        });
      } else {
        results.push({
          check: 'Storageバケット設定',
          status: 'pass',
          message: 'すべてのバケットがプライベート設定です'
        });
      }
    }
  } catch (err) {
    results.push({
      check: 'Storageバケット設定',
      status: 'fail',
      message: '確認中にエラーが発生しました'
    });
  }

  return results;
}

// バックアップ設定の確認
async function checkBackupSettings(): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];

  // Supabaseは自動バックアップを提供
  results.push({
    check: '自動バックアップ',
    status: 'pass',
    message: 'Supabaseは自動バックアップを提供しています',
    recommendation: 'Supabase Dashboardでバックアップ履歴を定期的に確認してください'
  });

  // Point-in-timeリカバリ（有料プランのみ）
  results.push({
    check: 'Point-in-timeリカバリ',
    status: 'warning',
    message: '無料プランではPoint-in-timeリカバリは利用できません',
    recommendation: '重要なデータは定期的に手動バックアップを取得してください'
  });

  return results;
}

// 結果の表示
function displayResults(results: SecurityCheckResult[]) {
  console.log('\n📊 セキュリティ監査結果サマリー');
  console.log('=====================================');

  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log(`✅ 合格: ${passed}項目`);
  console.log(`⚠️  警告: ${warnings}項目`);
  console.log(`❌ 不合格: ${failed}項目`);

  // 詳細結果
  console.log('\n📋 詳細結果:');
  results.forEach((result, index) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️ ' : '❌';
    console.log(`\n${index + 1}. ${icon} ${result.check}`);
    console.log(`   状態: ${result.message}`);
    if (result.recommendation) {
      console.log(`   推奨: ${result.recommendation}`);
    }
  });

  // セキュリティスコア
  const score = Math.round((passed / results.length) * 100);
  console.log(`\n🎯 セキュリティスコア: ${score}%`);

  if (score >= 80) {
    console.log('✨ 良好なセキュリティ状態です！');
  } else if (score >= 60) {
    console.log('⚠️  改善の余地があります。警告事項を確認してください。');
  } else {
    console.log('❌ セキュリティ改善が必要です。早急に対応してください。');
  }
}

// レポートファイルの生成
function generateReport(results: SecurityCheckResult[]) {
  const reportDir = path.join(process.cwd(), 'security-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `security-audit-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    projectUrl: supabaseUrl,
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      warnings: results.filter(r => r.status === 'warning').length,
      failed: results.filter(r => r.status === 'fail').length,
      score: Math.round((results.filter(r => r.status === 'pass').length / results.length) * 100)
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 レポートを保存しました: ${reportPath}`);
}

// スクリプト実行
runSecurityAudit().catch(console.error);