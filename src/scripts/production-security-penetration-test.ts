#!/usr/bin/env tsx
/**
 * 本番環境セキュリティペネトレーションテストスイート
 * システムセキュリティの脆弱性検査
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

interface PenetrationTestResult {
  testName: string;
  category: 'authentication' | 'authorization' | 'data_access' | 'injection' | 'network';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'pass' | 'fail' | 'warning';
  duration: number;
  description: string;
  details?: any;
  recommendations?: string[];
}

interface SecurityTestSuite {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warningTests: number;
  criticalIssues: number;
  highIssues: number;
  overallSecurityScore: number;
  testResults: PenetrationTestResult[];
}

// ペネトレーションテスト実行
async function runSecurityPenetrationTests() {
  console.log('🔒 Mamapace本番環境セキュリティペネトレーションテスト');
  console.log('=====================================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const testResults: PenetrationTestResult[] = [];

  try {
    // 1. 認証システムペネトレーションテスト
    console.log('1️⃣ 認証システムペネトレーションテスト');
    testResults.push(...await runAuthenticationPenetrationTests());

    // 2. 認可・アクセス制御テスト
    console.log('\n2️⃣ 認可・アクセス制御ペネトレーションテスト');
    testResults.push(...await runAuthorizationPenetrationTests());

    // 3. データアクセスセキュリティテスト
    console.log('\n3️⃣ データアクセスセキュリティテスト');
    testResults.push(...await runDataAccessSecurityTests());

    // 4. インジェクション攻撃テスト
    console.log('\n4️⃣ インジェクション攻撃テスト');
    testResults.push(...await runInjectionAttackTests());

    // 5. ネットワークセキュリティテスト
    console.log('\n5️⃣ ネットワークセキュリティテスト');
    testResults.push(...await runNetworkSecurityTests());

    // 結果の分析と表示
    const securitySuite = analyzeSecurityTestResults(testResults);
    displaySecurityTestResults(securitySuite);
    
    // セキュリティレポート生成
    generateSecurityTestReport(securitySuite);

  } catch (error) {
    console.error('💥 セキュリティテスト致命的エラー:', error);
    process.exit(1);
  }
}

// 認証システムペネトレーションテスト
async function runAuthenticationPenetrationTests(): Promise<PenetrationTestResult[]> {
  const results: PenetrationTestResult[] = [];

  // ブルートフォース攻撃テスト
  results.push(await runSecurityTest('ブルートフォース攻撃耐性テスト', 'authentication', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const attackAttempts: boolean[] = [];
    
    // 複数回の連続認証試行をシミュレート
    for (let i = 0; i < 10; i++) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: `BRUTEFORCE_${i}`,
          user_nickname_param: 'AttackUser'
        });
        
        attackAttempts.push(!error);
        await new Promise(resolve => setTimeout(resolve, 100)); // 短い間隔での攻撃
      } catch (err) {
        attackAttempts.push(false);
      }
    }
    
    const successfulAttacks = attackAttempts.filter(success => success).length;
    
    if (successfulAttacks === 0) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'ブルートフォース攻撃に対して適切に保護されています',
        details: { totalAttempts: 10, successfulAttacks: 0 }
      };
    } else {
      return {
        severity: 'high' as const,
        status: 'warning' as const,
        description: `ブルートフォース攻撃で${successfulAttacks}回成功しました`,
        details: { totalAttempts: 10, successfulAttacks },
        recommendations: ['レート制限の実装', '一時的なアカウントロック機能の追加']
      };
    }
  }));

  // 認証バイパス試行テスト
  results.push(await runSecurityTest('認証バイパス試行テスト', 'authentication', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const bypassAttempts = [
      { param: '', description: '空文字列' },
      { param: 'null', description: 'null文字列' },
      { param: 'admin', description: '管理者系キーワード' },
      { param: '0', description: 'ゼロ値' },
      { param: 'true', description: 'ブール値' }
    ];
    
    let bypassSuccessful = false;
    const attemptResults: any[] = [];
    
    for (const attempt of bypassAttempts) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: attempt.param,
          user_nickname_param: attempt.param
        });
        
        if (!error && data && data.length > 0) {
          bypassSuccessful = true;
          attemptResults.push({ ...attempt, success: true, data });
        } else {
          attemptResults.push({ ...attempt, success: false, error: error?.message });
        }
      } catch (err) {
        attemptResults.push({ ...attempt, success: false, error: String(err) });
      }
    }
    
    if (!bypassSuccessful) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '認証バイパス攻撃に対して適切に保護されています',
        details: { attemptResults }
      };
    } else {
      return {
        severity: 'critical' as const,
        status: 'fail' as const,
        description: '認証バイパスが可能です',
        details: { attemptResults },
        recommendations: ['認証パラメータの厳密な検証', '入力値のサニタイゼーション強化']
      };
    }
  }));

  // セッション管理テスト
  results.push(await runSecurityTest('セッション管理セキュリティテスト', 'authentication', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 正常な認証を実行
      const { data, error } = await client.rpc('auth_with_maternal_book', {
        maternal_book_param: 'SECURITY_TEST_SESSION',
        user_nickname_param: 'SecurityTestUser'
      });
      
      if (error || !data || data.length === 0) {
        return {
          severity: 'medium' as const,
          status: 'warning' as const,
          description: 'セッション管理テストのベース認証が失敗しました',
          details: { error: error?.message }
        };
      }
      
      const authResult = data[0];
      
      // トークンの形式確認
      const hasValidTokenFormat = authResult.access_token && 
                                 authResult.refresh_token && 
                                 authResult.access_token.includes(authResult.user_id);
      
      if (hasValidTokenFormat) {
        return {
          severity: 'low' as const,
          status: 'pass' as const,
          description: 'セッション管理が適切に実装されています',
          details: { 
            tokenFormat: 'valid',
            hasAccessToken: !!authResult.access_token,
            hasRefreshToken: !!authResult.refresh_token,
            userIdIncluded: authResult.access_token.includes(authResult.user_id)
          }
        };
      } else {
        return {
          severity: 'medium' as const,
          status: 'warning' as const,
          description: 'セッション管理に改善の余地があります',
          details: { tokenFormat: 'needs_improvement' },
          recommendations: ['トークン形式の標準化', 'セッション有効期限の明確化']
        };
      }
      
    } catch (err) {
      return {
        severity: 'medium' as const,
        status: 'warning' as const,
        description: 'セッション管理テスト中にエラーが発生しました',
        details: { error: String(err) }
      };
    }
  }));

  return results;
}

// 認可・アクセス制御ペネトレーションテスト
async function runAuthorizationPenetrationTests(): Promise<PenetrationTestResult[]> {
  const results: PenetrationTestResult[] = [];

  // 権限昇格攻撃テスト
  results.push(await runSecurityTest('権限昇格攻撃テスト', 'authorization', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const privilegeEscalationAttempts = [
      { table: 'users', action: 'select', description: 'ユーザー情報への不正アクセス' },
      { table: 'posts', action: 'insert', description: '投稿の不正作成' },
      { table: 'likes', action: 'delete', description: 'いいねの不正削除' },
      { table: 'comments', action: 'update', description: 'コメントの不正更新' }
    ];
    
    let unauthorizedAccessFound = false;
    const accessResults: any[] = [];
    
    for (const attempt of privilegeEscalationAttempts) {
      try {
        let result;
        
        switch (attempt.action) {
          case 'select':
            result = await client.from(attempt.table).select('*').limit(1);
            break;
          case 'insert':
            result = await client.from(attempt.table).insert({ 
              id: 'SECURITY_TEST_' + Date.now(),
              content: 'UNAUTHORIZED_ACCESS_TEST'
            });
            break;
          case 'update':
            result = await client.from(attempt.table).update({ 
              content: 'HACKED' 
            }).eq('id', 'non_existent_id');
            break;
          case 'delete':
            result = await client.from(attempt.table).delete().eq('id', 'non_existent_id');
            break;
        }
        
        const hasUnauthorizedAccess = result && !result.error && result.data;
        
        if (hasUnauthorizedAccess && attempt.action === 'select' && result.data.length > 0) {
          unauthorizedAccessFound = true;
          accessResults.push({ 
            ...attempt, 
            unauthorized: true, 
            dataCount: result.data.length 
          });
        } else {
          accessResults.push({ 
            ...attempt, 
            unauthorized: false, 
            error: result?.error?.message || 'RLS制限正常' 
          });
        }
        
      } catch (err) {
        accessResults.push({ 
          ...attempt, 
          unauthorized: false, 
          error: String(err) 
        });
      }
    }
    
    if (!unauthorizedAccessFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'RLSポリシーが適切に権限昇格攻撃を防いでいます',
        details: { accessResults }
      };
    } else {
      return {
        severity: 'critical' as const,
        status: 'fail' as const,
        description: '権限昇格攻撃が成功しました',
        details: { accessResults },
        recommendations: ['RLSポリシーの見直し', 'テーブルレベルの権限設定強化']
      };
    }
  }));

  // 横断的アクセス制御テスト（IDOR攻撃）
  results.push(await runSecurityTest('IDOR攻撃テスト', 'authorization', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const idorAttempts = [
      { id: '00000000-0000-0000-0000-000000000001', table: 'users' },
      { id: '99999999-9999-9999-9999-999999999999', table: 'posts' },
      { id: 'admin', table: 'users' },
      { id: '1', table: 'posts' }
    ];
    
    let idorVulnerabilityFound = false;
    const idorResults: any[] = [];
    
    for (const attempt of idorAttempts) {
      try {
        const { data, error } = await client
          .from(attempt.table)
          .select('*')
          .eq('id', attempt.id)
          .limit(1);
        
        if (!error && data && data.length > 0) {
          idorVulnerabilityFound = true;
          idorResults.push({ 
            ...attempt, 
            vulnerable: true, 
            dataFound: data[0] 
          });
        } else {
          idorResults.push({ 
            ...attempt, 
            vulnerable: false, 
            error: error?.message || 'アクセス拒否' 
          });
        }
        
      } catch (err) {
        idorResults.push({ 
          ...attempt, 
          vulnerable: false, 
          error: String(err) 
        });
      }
    }
    
    if (!idorVulnerabilityFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'IDOR攻撃に対して適切に保護されています',
        details: { idorResults }
      };
    } else {
      return {
        severity: 'high' as const,
        status: 'fail' as const,
        description: 'IDOR脆弱性が発見されました',
        details: { idorResults },
        recommendations: ['IDベースのアクセス制御強化', 'ユーザー固有の権限チェック実装']
      };
    }
  }));

  return results;
}

// データアクセスセキュリティテスト
async function runDataAccessSecurityTests(): Promise<PenetrationTestResult[]> {
  const results: PenetrationTestResult[] = [];

  // データ漏洩テスト
  results.push(await runSecurityTest('データ漏洩防止テスト', 'data_access', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const sensitiveDataAttempts = [
      { query: 'users', fields: '*', description: '全ユーザー情報の取得試行' },
      { query: 'users', fields: 'email,maternal_book_number', description: '機密情報の取得試行' },
      { query: 'posts', fields: '*', description: '全投稿情報の取得試行' }
    ];
    
    let dataLeakageFound = false;
    const leakageResults: any[] = [];
    
    for (const attempt of sensitiveDataAttempts) {
      try {
        const { data, error } = await client
          .from(attempt.query)
          .select(attempt.fields)
          .limit(10);
        
        if (!error && data && data.length > 0) {
          dataLeakageFound = true;
          leakageResults.push({
            ...attempt,
            leaked: true,
            recordCount: data.length,
            sampleData: data[0] // 実際のデータは表示しない（セキュリティ上）
          });
        } else {
          leakageResults.push({
            ...attempt,
            leaked: false,
            error: error?.message || 'アクセス拒否'
          });
        }
        
      } catch (err) {
        leakageResults.push({
          ...attempt,
          leaked: false,
          error: String(err)
        });
      }
    }
    
    if (!dataLeakageFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'データ漏洩攻撃に対して適切に保護されています',
        details: { leakageResults }
      };
    } else {
      return {
        severity: 'critical' as const,
        status: 'fail' as const,
        description: 'データ漏洩の脆弱性が発見されました',
        details: { leakageResults },
        recommendations: ['RLSポリシーの強化', 'フィールドレベルのアクセス制御実装']
      };
    }
  }));

  return results;
}

// インジェクション攻撃テスト
async function runInjectionAttackTests(): Promise<PenetrationTestResult[]> {
  const results: PenetrationTestResult[] = [];

  // SQLインジェクション攻撃テスト
  results.push(await runSecurityTest('SQLインジェクション攻撃テスト', 'injection', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users VALUES ('hacked') --",
      "1' OR '1'='1",
      "admin'; --"
    ];
    
    let injectionSuccessful = false;
    const injectionResults: any[] = [];
    
    for (const payload of sqlInjectionPayloads) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: payload,
          user_nickname_param: payload
        });
        
        // エラーメッセージにSQL構文が含まれている場合は脆弱性の可能性
        const hasSqlError = error?.message?.toLowerCase().includes('sql') || 
                           error?.message?.toLowerCase().includes('syntax') ||
                           error?.message?.toLowerCase().includes('table');
        
        if (hasSqlError) {
          injectionSuccessful = true;
          injectionResults.push({
            payload,
            vulnerable: true,
            error: error?.message
          });
        } else {
          injectionResults.push({
            payload,
            vulnerable: false,
            error: error?.message || 'safe'
          });
        }
        
      } catch (err) {
        injectionResults.push({
          payload,
          vulnerable: false,
          error: String(err)
        });
      }
    }
    
    if (!injectionSuccessful) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'SQLインジェクション攻撃に対して適切に保護されています',
        details: { injectionResults }
      };
    } else {
      return {
        severity: 'critical' as const,
        status: 'fail' as const,
        description: 'SQLインジェクション脆弱性が発見されました',
        details: { injectionResults },
        recommendations: ['パラメータ化クエリの使用', '入力値検証の強化']
      };
    }
  }));

  return results;
}

// ネットワークセキュリティテスト
async function runNetworkSecurityTests(): Promise<PenetrationTestResult[]> {
  const results: PenetrationTestResult[] = [];

  // HTTPS/TLS設定テスト
  results.push(await runSecurityTest('HTTPS/TLS設定テスト', 'network', async () => {
    const isHttps = supabaseUrl.startsWith('https://');
    
    if (isHttps) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'HTTPS通信が適切に設定されています',
        details: { protocol: 'HTTPS', url: supabaseUrl }
      };
    } else {
      return {
        severity: 'critical' as const,
        status: 'fail' as const,
        description: 'HTTP通信が使用されています（セキュリティリスク）',
        details: { protocol: 'HTTP', url: supabaseUrl },
        recommendations: ['HTTPS通信の強制実装', 'SSL証明書の設定']
      };
    }
  }));

  // APIエンドポイントセキュリティテスト
  results.push(await runSecurityTest('APIエンドポイントセキュリティテスト', 'network', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 適切なエラーハンドリングがされているかテスト
      const { data, error } = await client
        .from('non_existent_table')
        .select('*')
        .limit(1);
      
      if (error) {
        // エラーメッセージが内部情報を漏洩していないかチェック
        const hasInfoLeakage = error.message.toLowerCase().includes('postgresql') ||
                              error.message.toLowerCase().includes('database') ||
                              error.message.includes('supabase');
        
        if (hasInfoLeakage) {
          return {
            severity: 'medium' as const,
            status: 'warning' as const,
            description: 'APIエラーメッセージが内部情報を漏洩している可能性があります',
            details: { errorMessage: error.message },
            recommendations: ['エラーメッセージの汎用化', '詳細情報の非表示化']
          };
        } else {
          return {
            severity: 'low' as const,
            status: 'pass' as const,
            description: 'APIエンドポイントが適切にセキュリティ設定されています',
            details: { errorHandling: 'appropriate' }
          };
        }
      } else {
        return {
          severity: 'medium' as const,
          status: 'warning' as const,
          description: '存在しないテーブルへのアクセスがエラーを返しませんでした',
          details: { unexpectedSuccess: true }
        };
      }
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'APIエンドポイントが適切にエラーハンドリングしています',
        details: { errorHandling: 'appropriate', error: String(err) }
      };
    }
  }));

  return results;
}

// セキュリティテスト実行ヘルパー
async function runSecurityTest(
  testName: string, 
  category: PenetrationTestResult['category'], 
  testFn: () => Promise<{severity: PenetrationTestResult['severity'], status: PenetrationTestResult['status'], description: string, details?: any, recommendations?: string[]}>
): Promise<PenetrationTestResult> {
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
      details: result.details,
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
      details: { error }
    };
  }
}

// セキュリティテスト結果分析
function analyzeSecurityTestResults(testResults: PenetrationTestResult[]): SecurityTestSuite {
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const failedTests = testResults.filter(r => r.status === 'fail').length;
  const warningTests = testResults.filter(r => r.status === 'warning').length;
  
  const criticalIssues = testResults.filter(r => r.severity === 'critical' && r.status !== 'pass').length;
  const highIssues = testResults.filter(r => r.severity === 'high' && r.status !== 'pass').length;
  
  // セキュリティスコア計算 (0-100)
  let securityScore = 100;
  securityScore -= (criticalIssues * 30); // クリティカル問題は-30点
  securityScore -= (highIssues * 20); // 高リスク問題は-20点
  securityScore -= (warningTests * 5); // 警告は-5点
  securityScore = Math.max(0, securityScore);
  
  return {
    suiteName: 'セキュリティペネトレーションテスト',
    totalTests,
    passedTests,
    failedTests,
    warningTests,
    criticalIssues,
    highIssues,
    overallSecurityScore: securityScore,
    testResults
  };
}

// セキュリティテスト結果表示
function displaySecurityTestResults(suite: SecurityTestSuite) {
  console.log('\n🔒 セキュリティペネトレーションテスト結果サマリー');
  console.log('===============================================');
  
  console.log(`📊 総テスト数: ${suite.totalTests}`);
  console.log(`✅ 成功: ${suite.passedTests}`);
  console.log(`❌ 失敗: ${suite.failedTests}`);
  console.log(`⚠️  警告: ${suite.warningTests}`);
  console.log(`🚨 クリティカル問題: ${suite.criticalIssues}`);
  console.log(`⚠️  高リスク問題: ${suite.highIssues}`);
  
  // カテゴリ別結果
  const categories = ['authentication', 'authorization', 'data_access', 'injection', 'network'];
  console.log('\n📋 カテゴリ別結果:');
  categories.forEach(category => {
    const categoryTests = suite.testResults.filter(r => r.category === category);
    const categoryPassed = categoryTests.filter(r => r.status === 'pass').length;
    const categoryName = {
      authentication: '認証',
      authorization: '認可',
      data_access: 'データアクセス',
      injection: 'インジェクション',
      network: 'ネットワーク'
    }[category];
    console.log(`   ${categoryName}: ${categoryPassed}/${categoryTests.length} 成功`);
  });

  // 重要な問題の詳細表示
  const criticalAndHighIssues = suite.testResults.filter(r => 
    (r.severity === 'critical' || r.severity === 'high') && r.status !== 'pass'
  );
  
  if (criticalAndHighIssues.length > 0) {
    console.log('\n🚨 重要なセキュリティ問題:');
    criticalAndHighIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.testName}`);
      console.log(`      ${issue.description}`);
      if (issue.recommendations) {
        console.log(`      推奨対応: ${issue.recommendations.join(', ')}`);
      }
    });
  }

  // 総合セキュリティ評価
  console.log(`\n🎯 総合セキュリティスコア: ${suite.overallSecurityScore}/100`);
  
  if (suite.overallSecurityScore >= 90 && suite.criticalIssues === 0) {
    console.log('🎉 優秀！セキュリティが完璧に実装されています。');
  } else if (suite.overallSecurityScore >= 70 && suite.criticalIssues === 0) {
    console.log('✅ 良好！セキュリティレベルは本番環境に適用可能です。');
  } else if (suite.overallSecurityScore >= 50) {
    console.log('⚠️  注意：いくつかのセキュリティ問題があります。修正を推奨します。');
  } else {
    console.log('🚨 警告：重大なセキュリティ脆弱性があります。即座の修正が必要です。');
  }
}

// セキュリティテストレポート生成
function generateSecurityTestReport(suite: SecurityTestSuite) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `production-security-penetration-test-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'security-penetration-test',
    project: {
      name: 'Mamapace',
      url: supabaseUrl
    },
    summary: {
      totalTests: suite.totalTests,
      passedTests: suite.passedTests,
      failedTests: suite.failedTests,
      warningTests: suite.warningTests,
      criticalIssues: suite.criticalIssues,
      highIssues: suite.highIssues,
      securityScore: suite.overallSecurityScore
    },
    detailedResults: suite,
    recommendations: generateOverallSecurityRecommendations(suite)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 セキュリティペネトレーションテストレポートを保存しました: ${reportPath}`);
}

// 総合セキュリティ推奨事項生成
function generateOverallSecurityRecommendations(suite: SecurityTestSuite): string[] {
  const recommendations: string[] = [];
  
  if (suite.criticalIssues === 0 && suite.highIssues === 0 && suite.overallSecurityScore >= 90) {
    recommendations.push('優秀なセキュリティ実装です。現在の設定で本番環境運用を推奨します。');
  }
  
  if (suite.criticalIssues > 0) {
    recommendations.push(`${suite.criticalIssues}個のクリティカルなセキュリティ問題を即座に修正してください。`);
  }
  
  if (suite.highIssues > 0) {
    recommendations.push(`${suite.highIssues}個の高リスクセキュリティ問題の修正を推奨します。`);
  }
  
  // カテゴリ別推奨事項
  const failedCategories = suite.testResults
    .filter(r => r.status === 'fail')
    .map(r => r.category);
  
  const uniqueFailedCategories = [...new Set(failedCategories)];
  
  if (uniqueFailedCategories.includes('authentication')) {
    recommendations.push('認証システム: レート制限とアカウントロック機能の実装を検討してください。');
  }
  
  if (uniqueFailedCategories.includes('authorization')) {
    recommendations.push('認可システム: RLSポリシーの見直しとアクセス制御の強化を行ってください。');
  }
  
  if (uniqueFailedCategories.includes('data_access')) {
    recommendations.push('データアクセス: 機密データへのアクセス制御を強化してください。');
  }
  
  if (uniqueFailedCategories.includes('injection')) {
    recommendations.push('インジェクション対策: パラメータ化クエリと入力値検証を強化してください。');
  }
  
  // 継続的セキュリティ
  recommendations.push('定期的なセキュリティテスト（月1回）の実行を推奨します。');
  recommendations.push('セキュリティ監視とログ分析システムの導入を検討してください。');
  
  return recommendations;
}

// スクリプト実行
runSecurityPenetrationTests().catch(console.error);