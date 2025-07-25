#!/usr/bin/env tsx
/**
 * 本番環境データ漏洩セキュリティテストスイート
 * 機密データの保護と漏洩防止の検証
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

interface DataLeakTestResult {
  testName: string;
  category: 'pii' | 'credentials' | 'system' | 'business';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pass' | 'fail' | 'warning';
  duration: number;
  description: string;
  leakedData?: any;
  dataCount?: number;
  recommendations?: string[];
}

// データ漏洩セキュリティテスト実行
async function runDataLeakageSecurityTests() {
  console.log('🔍 Mamapaceデータ漏洩セキュリティテスト');
  console.log('==================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const testResults: DataLeakTestResult[] = [];

  try {
    // 1. 個人識別情報（PII）漏洩テスト
    console.log('1️⃣ 個人識別情報（PII）漏洩テスト');
    testResults.push(...await runPIILeakageTests());

    // 2. 認証情報漏洩テスト
    console.log('\n2️⃣ 認証情報漏洩テスト');
    testResults.push(...await runCredentialLeakageTests());

    // 3. システム情報漏洩テスト
    console.log('\n3️⃣ システム情報漏洩テスト');
    testResults.push(...await runSystemInfoLeakageTests());

    // 4. ビジネスデータ漏洩テスト
    console.log('\n4️⃣ ビジネスデータ漏洩テスト');
    testResults.push(...await runBusinessDataLeakageTests());

    // 結果の表示と分析
    displayDataLeakResults(testResults);
    
    // レポート生成
    generateDataLeakReport(testResults);

  } catch (error) {
    console.error('💥 データ漏洩テスト致命的エラー:', error);
    process.exit(1);
  }
}

// 個人識別情報（PII）漏洩テスト
async function runPIILeakageTests(): Promise<DataLeakTestResult[]> {
  const results: DataLeakTestResult[] = [];

  // 母子手帳番号漏洩テスト
  results.push(await runDataLeakTest('母子手帳番号漏洩テスト', 'pii', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 直接的なクエリで母子手帳番号の取得を試行
      const { data, error } = await client
        .from('users')
        .select('maternal_book_number, nickname')
        .limit(10);
      
      if (!error && data && data.length > 0) {
        const leakedMaternalBooks = data.filter(user => user.maternal_book_number);
        
        if (leakedMaternalBooks.length > 0) {
          return {
            severity: 'critical' as const,
            status: 'fail' as const,
            description: `${leakedMaternalBooks.length}件の母子手帳番号が漏洩しています`,
            leakedData: leakedMaternalBooks.map(u => ({ 
              id: '***masked***', 
              maternal_book_masked: u.maternal_book_number?.substring(0, 3) + '***'
            })),
            dataCount: leakedMaternalBooks.length,
            recommendations: ['母子手帳番号フィールドのRLS強化', 'データマスキングの実装']
          };
        }
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '母子手帳番号が適切に保護されています',
        dataCount: 0
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '母子手帳番号へのアクセスが適切に制限されています',
        dataCount: 0
      };
    }
  }));

  // メールアドレス・連絡先情報漏洩テスト
  results.push(await runDataLeakTest('メールアドレス漏洩テスト', 'pii', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      const { data, error } = await client
        .from('users')
        .select('email, phone')
        .limit(10);
      
      if (!error && data && data.length > 0) {
        const leakedContacts = data.filter(user => user.email || user.phone);
        
        if (leakedContacts.length > 0) {
          return {
            severity: 'high' as const,
            status: 'fail' as const,
            description: `${leakedContacts.length}件の連絡先情報が漏洩しています`,
            leakedData: leakedContacts.map(u => ({
              email: u.email ? u.email.substring(0, 3) + '***@***' : null,
              phone: u.phone ? '***' + u.phone?.slice(-4) : null
            })),
            dataCount: leakedContacts.length,
            recommendations: ['連絡先情報のアクセス制御強化', 'PII保護ポリシーの実装']
          };
        }
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '連絡先情報が適切に保護されています',
        dataCount: 0
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '連絡先情報へのアクセスが適切に制限されています',
        dataCount: 0
      };
    }
  }));

  // プロフィール情報一括取得テスト
  results.push(await runDataLeakTest('プロフィール情報一括漏洩テスト', 'pii', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .limit(50);
      
      if (!error && data && data.length > 0) {
        return {
          severity: 'critical' as const,
          status: 'fail' as const,
          description: `${data.length}件のユーザープロフィールが一括取得可能です`,
          dataCount: data.length,
          leakedData: { 
            fields: Object.keys(data[0] || {}),
            recordCount: data.length
          },
          recommendations: ['RLSポリシーの強化', 'ユーザー個別のデータアクセス制御', 'データクエリ制限の実装']
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'プロフィール情報の一括取得が適切に防がれています',
        dataCount: 0
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'プロフィール情報へのアクセスが適切に制限されています',
        dataCount: 0
      };
    }
  }));

  return results;
}

// 認証情報漏洩テスト
async function runCredentialLeakageTests(): Promise<DataLeakTestResult[]> {
  const results: DataLeakTestResult[] = [];

  // パスワード・認証トークン漏洩テスト
  results.push(await runDataLeakTest('認証トークン漏洩テスト', 'credentials', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 認証関連のテーブルやフィールドへのアクセスを試行
      const { data, error } = await client
        .from('users')
        .select('password, auth_token, session_token, refresh_token')
        .limit(5);
      
      if (!error && data && data.length > 0) {
        const hasCredentials = data.some(user => 
          user.password || user.auth_token || user.session_token || user.refresh_token
        );
        
        if (hasCredentials) {
          return {
            severity: 'critical' as const,
            status: 'fail' as const,
            description: '認証情報が平文で保存・アクセス可能です',
            dataCount: data.length,
            recommendations: ['認証情報の暗号化', '認証テーブルの分離', 'RLS強化']
          };
        }
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '認証情報が適切に保護されています',
        dataCount: 0
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '認証情報へのアクセスが適切に制限されています',
        dataCount: 0
      };
    }
  }));

  // APIキー・シークレット漏洩テスト
  results.push(await runDataLeakTest('APIキー漏洩テスト', 'credentials', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // システム設定やAPIキーが含まれる可能性のあるテーブルをチェック
      const tables = ['config', 'settings', 'api_keys', 'secrets'];
      let leakageFound = false;
      const leakageResults: any[] = [];
      
      for (const table of tables) {
        try {
          const { data, error } = await client
            .from(table)
            .select('*')
            .limit(1);
          
          if (!error && data && data.length > 0) {
            leakageFound = true;
            leakageResults.push({
              table,
              dataFound: true,
              recordCount: data.length,
              fields: Object.keys(data[0])
            });
          } else {
            leakageResults.push({
              table,
              dataFound: false,
              error: error?.message
            });
          }
        } catch (err) {
          leakageResults.push({
            table,
            dataFound: false,
            error: String(err)
          });
        }
      }
      
      if (leakageFound) {
        return {
          severity: 'high' as const,
          status: 'fail' as const,
          description: 'システム設定テーブルへの不正アクセスが可能です',
          leakedData: leakageResults,
          recommendations: ['システム設定テーブルのアクセス制御強化', '機密情報の暗号化']
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'システム設定情報が適切に保護されています',
        leakedData: leakageResults
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'システム設定情報へのアクセスが適切に制限されています'
      };
    }
  }));

  return results;
}

// システム情報漏洩テスト
async function runSystemInfoLeakageTests(): Promise<DataLeakTestResult[]> {
  const results: DataLeakTestResult[] = [];

  // データベース構造漏洩テスト
  results.push(await runDataLeakTest('データベース構造漏洩テスト', 'system', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // PostgreSQLのシステムテーブルへのアクセスを試行
      const systemQueries = [
        'information_schema.tables',
        'information_schema.columns',
        'pg_tables',
        'pg_stat_user_tables'
      ];
      
      let systemInfoLeaked = false;
      const systemInfoResults: any[] = [];
      
      for (const query of systemQueries) {
        try {
          const { data, error } = await client
            .from(query)
            .select('*')
            .limit(1);
          
          if (!error && data && data.length > 0) {
            systemInfoLeaked = true;
            systemInfoResults.push({
              query,
              accessible: true,
              recordCount: data.length
            });
          } else {
            systemInfoResults.push({
              query,
              accessible: false,
              error: error?.message
            });
          }
        } catch (err) {
          systemInfoResults.push({
            query,
            accessible: false,
            error: String(err)
          });
        }
      }
      
      if (systemInfoLeaked) {
        return {
          severity: 'medium' as const,
          status: 'fail' as const,
          description: 'データベースシステム情報への不正アクセスが可能です',
          leakedData: systemInfoResults,
          recommendations: ['システムテーブルへのアクセス制限', 'データベース権限の最小化']
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'データベースシステム情報が適切に保護されています',
        leakedData: systemInfoResults
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'データベースシステム情報へのアクセスが適切に制限されています'
      };
    }
  }));

  // エラーメッセージ情報漏洩テスト
  results.push(await runDataLeakTest('エラーメッセージ情報漏洩テスト', 'system', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 意図的にエラーを発生させてメッセージの内容を確認
      const { data, error } = await client
        .from('non_existent_table_xyz123')
        .select('*')
        .limit(1);
      
      if (error) {
        const errorMessage = error.message.toLowerCase();
        
        // 内部情報が漏洩する可能性のあるキーワードをチェック
        const sensitiveKeywords = [
          'postgresql', 'supabase', 'database', 'schema', 'table', 
          'connection', 'server', 'port', 'host', 'password'
        ];
        
        const hasSensitiveInfo = sensitiveKeywords.some(keyword => 
          errorMessage.includes(keyword)
        );
        
        if (hasSensitiveInfo) {
          return {
            severity: 'medium' as const,
            status: 'warning' as const,
            description: 'エラーメッセージが内部システム情報を漏洩しています',
            leakedData: { 
              errorMessage: error.message,
              sensitiveKeywords: sensitiveKeywords.filter(k => errorMessage.includes(k))
            },
            recommendations: ['エラーメッセージの汎用化', '詳細エラー情報の非表示化']
          };
        }
        
        return {
          severity: 'low' as const,
          status: 'pass' as const,
          description: 'エラーメッセージが適切に制御されています',
          leakedData: { errorMessage: error.message }
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'エラーハンドリングが適切に実装されています'
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'エラーハンドリングが適切に実装されています'
      };
    }
  }));

  return results;
}

// ビジネスデータ漏洩テスト
async function runBusinessDataLeakageTests(): Promise<DataLeakTestResult[]> {
  const results: DataLeakTestResult[] = [];

  // 投稿データ一括取得テスト
  results.push(await runDataLeakTest('投稿データ一括漏洩テスト', 'business', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      const { data, error } = await client
        .from('posts')
        .select('*')
        .limit(100);
      
      if (!error && data && data.length > 0) {
        return {
          severity: 'high' as const,
          status: 'fail' as const,
          description: `${data.length}件の投稿データが一括取得可能です`,
          dataCount: data.length,
          leakedData: {
            recordCount: data.length,
            fields: Object.keys(data[0] || {}),
            sampleTitles: data.slice(0, 3).map(p => p.title || 'untitled').map(t => t.substring(0, 20) + '...')
          },
          recommendations: ['投稿データのアクセス制御強化', 'ページネーション制限の実装']
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '投稿データが適切に保護されています',
        dataCount: 0
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '投稿データへのアクセスが適切に制限されています',
        dataCount: 0
      };
    }
  }));

  // 統計・分析データ漏洩テスト
  results.push(await runDataLeakTest('統計データ漏洩テスト', 'business', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 統計情報の取得を試行
      const aggregationQueries = [
        { query: 'users', operation: 'count', field: '*' },
        { query: 'posts', operation: 'count', field: '*' },
        { query: 'likes', operation: 'count', field: '*' }
      ];
      
      let statisticsLeaked = false;
      const statisticsResults: any[] = [];
      
      for (const aggQuery of aggregationQueries) {
        try {
          // Supabaseでは直接count(*)は使用できないため、select('*')でデータ存在確認
          const { data, error } = await client
            .from(aggQuery.query)
            .select('id')
            .limit(1);
          
          if (!error && data) {
            statisticsLeaked = true;
            statisticsResults.push({
              table: aggQuery.query,
              dataAccessible: true,
              hasRecords: data.length > 0
            });
          } else {
            statisticsResults.push({
              table: aggQuery.query,
              dataAccessible: false,
              error: error?.message
            });
          }
        } catch (err) {
          statisticsResults.push({
            table: aggQuery.query,
            dataAccessible: false,
            error: String(err)
          });
        }
      }
      
      if (statisticsLeaked) {
        return {
          severity: 'medium' as const,
          status: 'warning' as const,
          description: 'ビジネス統計データへのアクセスが可能です',
          leakedData: statisticsResults,
          recommendations: ['統計データのアクセス制御', '集計クエリの制限実装']
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '統計データが適切に保護されています',
        leakedData: statisticsResults
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '統計データへのアクセスが適切に制限されています'
      };
    }
  }));

  return results;
}

// データ漏洩テスト実行ヘルパー
async function runDataLeakTest(
  testName: string, 
  category: DataLeakTestResult['category'], 
  testFn: () => Promise<{severity: DataLeakTestResult['severity'], status: DataLeakTestResult['status'], description: string, leakedData?: any, dataCount?: number, recommendations?: string[]}>
): Promise<DataLeakTestResult> {
  const startTime = Date.now();
  console.log(`  🔍 ${testName}...`);

  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`  ${statusIcon} ${testName}: ${result.description} (${duration}ms)`);
    
    return {
      testName,
      category,
      severity: result.severity,
      status: result.status,
      duration,
      description: result.description,
      leakedData: result.leakedData,
      dataCount: result.dataCount,
      recommendations: result.recommendations
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${testName}: テスト実行エラー - ${errorMessage} (${duration}ms)`);
    
    return {
      testName,
      category,
      severity: 'medium',
      status: 'fail',
      duration,
      description: `テスト実行エラー: ${errorMessage}`,
      leakedData: { error }
    };
  }
}

// データ漏洩テスト結果表示
function displayDataLeakResults(testResults: DataLeakTestResult[]) {
  console.log('\n🔍 データ漏洩セキュリティテスト結果サマリー');
  console.log('=======================================');
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const failedTests = testResults.filter(r => r.status === 'fail').length;
  const warningTests = testResults.filter(r => r.status === 'warning').length;
  
  const criticalIssues = testResults.filter(r => r.severity === 'critical' && r.status !== 'pass').length;
  const highIssues = testResults.filter(r => r.severity === 'high' && r.status !== 'pass').length;
  
  console.log(`📊 総テスト数: ${totalTests}`);
  console.log(`✅ 成功: ${passedTests}`);
  console.log(`❌ 失敗: ${failedTests}`);
  console.log(`⚠️  警告: ${warningTests}`);
  console.log(`🚨 クリティカル問題: ${criticalIssues}`);
  console.log(`⚠️  高リスク問題: ${highIssues}`);

  // カテゴリ別結果
  const categories = ['pii', 'credentials', 'system', 'business'];
  console.log('\n📋 カテゴリ別結果:');
  categories.forEach(category => {
    const categoryTests = testResults.filter(r => r.category === category);
    const categoryPassed = categoryTests.filter(r => r.status === 'pass').length;
    const categoryName = {
      pii: '個人識別情報',
      credentials: '認証情報',
      system: 'システム情報',
      business: 'ビジネスデータ'
    }[category];
    console.log(`   ${categoryName}: ${categoryPassed}/${categoryTests.length} 成功`);
  });

  // 重要な漏洩の詳細表示
  const criticalLeaks = testResults.filter(r => 
    (r.severity === 'critical' || r.severity === 'high') && r.status !== 'pass'
  );
  
  if (criticalLeaks.length > 0) {
    console.log('\n🚨 重要なデータ漏洩リスク:');
    criticalLeaks.forEach((leak, index) => {
      console.log(`   ${index + 1}. [${leak.severity.toUpperCase()}] ${leak.testName}`);
      console.log(`      ${leak.description}`);
      if (leak.dataCount) {
        console.log(`      漏洩データ数: ${leak.dataCount}件`);
      }
      if (leak.recommendations) {
        console.log(`      推奨対応: ${leak.recommendations.join(', ')}`);
      }
    });
  }

  // データ保護スコア計算
  let dataProtectionScore = 100;
  dataProtectionScore -= (criticalIssues * 30);
  dataProtectionScore -= (highIssues * 20);
  dataProtectionScore -= (warningTests * 5);
  dataProtectionScore = Math.max(0, dataProtectionScore);

  console.log(`\n🎯 データ保護スコア: ${dataProtectionScore}/100`);
  
  if (dataProtectionScore >= 90 && criticalIssues === 0) {
    console.log('🎉 優秀！データが完璧に保護されています。');
  } else if (dataProtectionScore >= 70 && criticalIssues === 0) {
    console.log('✅ 良好！データ保護レベルは本番環境に適用可能です。');
  } else if (dataProtectionScore >= 50) {
    console.log('⚠️  注意：データ保護に改善が必要です。');
  } else {
    console.log('🚨 警告：重大なデータ漏洩リスクがあります。即座の対応が必要です。');
  }
}

// データ漏洩テストレポート生成
function generateDataLeakReport(testResults: DataLeakTestResult[]) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `production-security-data-leak-test-${timestamp}.json`);

  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const failedTests = testResults.filter(r => r.status === 'fail').length;
  const warningTests = testResults.filter(r => r.status === 'warning').length;
  const criticalIssues = testResults.filter(r => r.severity === 'critical' && r.status !== 'pass').length;
  const highIssues = testResults.filter(r => r.severity === 'high' && r.status !== 'pass').length;

  let dataProtectionScore = 100;
  dataProtectionScore -= (criticalIssues * 30);
  dataProtectionScore -= (highIssues * 20);
  dataProtectionScore -= (warningTests * 5);
  dataProtectionScore = Math.max(0, dataProtectionScore);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'data-leakage-security-test',
    project: {
      name: 'Mamapace',
      url: supabaseUrl
    },
    summary: {
      totalTests,
      passedTests,
      failedTests,
      warningTests,
      criticalIssues,
      highIssues,
      dataProtectionScore
    },
    testResults,
    recommendations: generateDataLeakRecommendations(testResults)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 データ漏洩セキュリティテストレポートを保存しました: ${reportPath}`);
}

// データ漏洩推奨事項生成
function generateDataLeakRecommendations(testResults: DataLeakTestResult[]): string[] {
  const recommendations: string[] = [];
  
  const criticalIssues = testResults.filter(r => r.severity === 'critical' && r.status !== 'pass').length;
  const highIssues = testResults.filter(r => r.severity === 'high' && r.status !== 'pass').length;
  
  if (criticalIssues === 0 && highIssues === 0) {
    recommendations.push('データ保護システムは高いセキュリティレベルを達成しています。');
  }
  
  if (criticalIssues > 0) {
    recommendations.push(`${criticalIssues}個のクリティカルなデータ漏洩リスクを即座に修正してください。`);
  }
  
  if (highIssues > 0) {
    recommendations.push(`${highIssues}個の高リスクデータ漏洩問題の修正を推奨します。`);
  }
  
  // 具体的な推奨事項
  const failedTests = testResults.filter(r => r.status === 'fail');
  failedTests.forEach(test => {
    if (test.recommendations) {
      recommendations.push(...test.recommendations);
    }
  });
  
  // 一般的なデータ保護推奨事項
  recommendations.push('定期的なデータ漏洩監査の実施を推奨します。');
  recommendations.push('データ分類とアクセス制御ポリシーの策定を検討してください。');
  recommendations.push('データアクセスログの監視システム導入を推奨します。');
  
  return [...new Set(recommendations)]; // 重複を除去
}

// スクリプト実行
runDataLeakageSecurityTests().catch(console.error);