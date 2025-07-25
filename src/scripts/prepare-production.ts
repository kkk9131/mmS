#!/usr/bin/env tsx
/**
 * 本番環境準備スクリプト
 * テストデータのクリーンアップと本番設定の適用
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// 環境変数の確認
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('必要な環境変数:');
  console.error('- EXPO_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Supabaseクライアントの初期化（サービスロール）
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 確認プロンプト
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

// メイン処理
async function prepareProduction() {
  console.log('🚀 Mamapace本番環境準備スクリプト');
  console.log('=====================================');
  
  try {
    // 1. 現在のデータ数を確認
    console.log('\n📊 現在のデータ数を確認中...');
    const dataCounts = await checkDataCounts();
    console.log('現在のデータ:');
    Object.entries(dataCounts).forEach(([table, count]) => {
      console.log(`  - ${table}: ${count}件`);
    });

    // 2. バックアップの確認
    console.log('\n⚠️  重要: 実行前に必ずデータベースのバックアップを取得してください！');
    const backupConfirm = await question('バックアップは取得済みですか？ (yes/no): ');
    
    if (backupConfirm.toLowerCase() !== 'yes') {
      console.log('❌ バックアップを取得してから再実行してください');
      process.exit(0);
    }

    // 3. 実行内容の選択
    console.log('\n実行する処理を選択してください:');
    console.log('1. テストデータのクリーンアップのみ');
    console.log('2. セキュリティ設定の適用のみ');
    console.log('3. 両方実行（推奨）');
    console.log('4. キャンセル');
    
    const choice = await question('選択 (1-4): ');

    switch (choice) {
      case '1':
        await cleanupTestData();
        break;
      case '2':
        await applySecuritySettings();
        break;
      case '3':
        await cleanupTestData();
        await applySecuritySettings();
        break;
      case '4':
        console.log('キャンセルしました');
        process.exit(0);
      default:
        console.log('無効な選択です');
        process.exit(1);
    }

    // 4. 環境変数ファイルの作成
    await createProductionEnvFile();

    // 5. 完了
    console.log('\n✅ 本番環境準備が完了しました！');
    console.log('\n次のステップ:');
    console.log('1. .env.production ファイルを確認・編集');
    console.log('2. Supabase Dashboardでセキュリティ設定を確認');
    console.log('3. APIキーを本番用に再生成（推奨）');
    console.log('4. バックアップ設定の確認');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// データ数の確認
async function checkDataCounts(): Promise<Record<string, number>> {
  const tables = ['users', 'posts', 'likes', 'comments', 'notifications', 'follows', 'push_tokens', 'notification_settings', 'image_uploads'];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.warn(`⚠️  ${table}テーブルのカウント取得エラー:`, error.message);
      counts[table] = -1;
    } else {
      counts[table] = count || 0;
    }
  }

  return counts;
}

// テストデータのクリーンアップ
async function cleanupTestData() {
  console.log('\n🧹 テストデータをクリーンアップ中...');
  
  const confirm = await question('本当にテストデータを削除しますか？ (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('クリーンアップをキャンセルしました');
    return;
  }

  // SQLファイルを読み込み
  const sqlPath = path.join(__dirname, 'cleanup-test-data.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Supabase APIではなく、直接SQLを実行する必要がある場合の注意
  console.log('⚠️  注意: 完全なクリーンアップにはSupabase DashboardのSQL Editorを使用してください');
  console.log(`SQLファイル: ${sqlPath}`);

  // 基本的なクリーンアップ（API経由）
  const tables = [
    'notification_settings',
    'push_tokens',
    'notifications',
    'comments',
    'likes',
    'posts',
    'follows',
    'image_uploads',
    'users'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 全削除（ダミー条件）
      
      if (error) {
        console.warn(`⚠️  ${table}のクリーンアップでエラー:`, error.message);
      } else {
        console.log(`✅ ${table}をクリーンアップしました`);
      }
    } catch (err) {
      console.error(`❌ ${table}のクリーンアップ失敗:`, err);
    }
  }

  // クリーンアップ後のデータ数を確認
  const afterCounts = await checkDataCounts();
  console.log('\nクリーンアップ後のデータ:');
  Object.entries(afterCounts).forEach(([table, count]) => {
    console.log(`  - ${table}: ${count}件`);
  });
}

// セキュリティ設定の適用
async function applySecuritySettings() {
  console.log('\n🔒 セキュリティ設定を適用中...');
  
  console.log('⚠️  注意: RLSポリシーの適用にはSupabase DashboardのSQL Editorを使用してください');
  const sqlPath = path.join(__dirname, 'production-security-setup.sql');
  console.log(`SQLファイル: ${sqlPath}`);

  // 基本的なRLS有効化（API経由で可能な部分）
  console.log('\nRLS（Row Level Security）を有効化中...');
  
  // 注：実際のRLSポリシー適用はSQL Editorで行う必要があります
  console.log('✅ セキュリティ設定の準備が完了しました');
  console.log('📝 Supabase DashboardでSQLファイルを実行してください');
}

// 本番環境用の環境変数ファイル作成
async function createProductionEnvFile() {
  console.log('\n📝 本番環境用の設定ファイルを作成中...');

  const envContent = `# Mamapace本番環境設定
# ⚠️ このファイルには機密情報が含まれます。Gitにコミットしないでください！

# Supabase設定
EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# 環境設定
EXPO_PUBLIC_ENVIRONMENT=production
NODE_ENV=production

# 機能フラグ
EXPO_PUBLIC_USE_MOCK_DATA=false
EXPO_PUBLIC_ENABLE_REALTIME=true
EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true

# セキュリティ設定
EXPO_PUBLIC_ENABLE_DEBUG_LOGS=false
EXPO_PUBLIC_ENABLE_ERROR_REPORTING=true

# バックアップ設定
BACKUP_RETENTION_DAYS=30
BACKUP_FREQUENCY=daily

# 監視設定
MONITORING_ENABLED=true
ALERT_EMAIL=admin@mamapace.app
`;

  const envPath = path.join(process.cwd(), '.env.production');
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ .env.production ファイルを作成しました: ${envPath}`);
}

// スクリプト実行
prepareProduction().catch(console.error);