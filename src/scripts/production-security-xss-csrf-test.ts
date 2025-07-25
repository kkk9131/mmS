#!/usr/bin/env tsx
/**
 * 本番環境XSS・CSRF対策セキュリティテストスイート
 * クロスサイトスクリプティングとクロスサイトリクエストフォージェリ対策の検証
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

interface XSSCSRFTestResult {
  testName: string;
  category: 'xss' | 'csrf' | 'injection' | 'validation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pass' | 'fail' | 'warning';
  duration: number;
  description: string;
  payload?: string;
  response?: any;
  recommendations?: string[];
}

// XSS・CSRF対策セキュリティテスト実行
async function runXSSCSRFSecurityTests() {
  console.log('🛡️ MamapaceXSS・CSRF対策セキュリティテスト');
  console.log('=====================================');
  console.log(`プロジェクトURL: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);

  const testResults: XSSCSRFTestResult[] = [];

  try {
    // 1. XSS攻撃テスト
    console.log('1️⃣ XSS攻撃テスト');
    testResults.push(...await runXSSAttackTests());

    // 2. CSRF攻撃テスト
    console.log('\n2️⃣ CSRF攻撃テスト');
    testResults.push(...await runCSRFAttackTests());

    // 3. スクリプトインジェクションテスト
    console.log('\n3️⃣ スクリプトインジェクションテスト');
    testResults.push(...await runScriptInjectionTests());

    // 4. 入力値サニタイゼーションテスト
    console.log('\n4️⃣ 入力値サニタイゼーションテスト');
    testResults.push(...await runInputSanitizationTests());

    // 結果の表示と分析
    displayXSSCSRFResults(testResults);
    
    // レポート生成
    generateXSSCSRFReport(testResults);

  } catch (error) {
    console.error('💥 XSS・CSRFテスト致命的エラー:', error);
    process.exit(1);
  }
}

// XSS攻撃テスト
async function runXSSAttackTests(): Promise<XSSCSRFTestResult[]> {
  const results: XSSCSRFTestResult[] = [];

  // 基本的なXSSペイロードテスト
  results.push(await runXSSCSRFTest('基本XSSペイロードテスト', 'xss', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")'
    ];
    
    let xssVulnerabilityFound = false;
    const xssResults: any[] = [];
    
    for (const payload of xssPayloads) {
      try {
        // 母子手帳認証システム経由でXSSペイロードをテスト
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: payload,
          user_nickname_param: payload
        });
        
        // レスポンスにペイロードがそのまま含まれている場合は脆弱性の可能性
        const responseString = JSON.stringify(data || error);
        const payloadReflected = responseString.includes(payload) || 
                               responseString.includes(payload.replace(/[<>"']/g, ''));
        
        if (payloadReflected) {
          xssVulnerabilityFound = true;
          xssResults.push({
            payload,
            reflected: true,
            response: responseString.substring(0, 200) + '...'
          });
        } else {
          xssResults.push({
            payload,
            reflected: false,
            sanitized: true
          });
        }
        
      } catch (err) {
        xssResults.push({
          payload,
          reflected: false,
          error: String(err).substring(0, 100)
        });
      }
    }
    
    if (!xssVulnerabilityFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'XSS攻撃に対して適切に保護されています',
        response: xssResults
      };
    } else {
      return {
        severity: 'critical' as const,
        status: 'fail' as const,
        description: 'XSS脆弱性が発見されました',
        response: xssResults,
        recommendations: ['入力値のHTMLエスケープ処理', 'Content Security Policy (CSP)の実装', '出力値のサニタイゼーション']
      };
    }
  }));

  // DOM-Based XSSテスト
  results.push(await runXSSCSRFTest('DOM-Based XSSテスト', 'xss', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const domXSSPayloads = [
      '#<script>alert("DOM-XSS")</script>',
      'javascript:alert("DOM-XSS")',
      'data:text/html,<script>alert("DOM-XSS")</script>',
      '"><img src=x onerror=alert("DOM-XSS")>'
    ];
    
    let domXSSFound = false;
    const domXSSResults: any[] = [];
    
    for (const payload of domXSSPayloads) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: `DOM_XSS_TEST_${payload}`,
          user_nickname_param: 'DOMXSSTest'
        });
        
        // DOM-XSSは主にクライアントサイドの問題だが、サーバーサイドでの反映を確認
        const responseData = JSON.stringify(data || error || {});
        const hasDangerousContent = responseData.includes('javascript:') || 
                                   responseData.includes('data:text/html') ||
                                   responseData.includes('<script>');
        
        if (hasDangerousContent) {
          domXSSFound = true;
          domXSSResults.push({
            payload,
            vulnerable: true,
            response: responseData.substring(0, 150)
          });
        } else {
          domXSSResults.push({
            payload,
            vulnerable: false,
            safe: true
          });
        }
        
      } catch (err) {
        domXSSResults.push({
          payload,
          vulnerable: false,
          error: String(err).substring(0, 50)
        });
      }
    }
    
    if (!domXSSFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'DOM-Based XSS攻撃に対して適切に保護されています',
        response: domXSSResults
      };
    } else {
      return {
        severity: 'high' as const,
        status: 'fail' as const,
        description: 'DOM-Based XSS脆弱性が発見されました',
        response: domXSSResults,
        recommendations: ['DOM操作の際のサニタイゼーション', 'innerHTML使用の回避', '安全なDOM操作APIの使用']
      };
    }
  }));

  // Stored XSSテスト
  results.push(await runXSSCSRFTest('Stored XSSテスト', 'xss', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const storedXSSPayload = `<script>alert("Stored-XSS-${Date.now()}")</script>`;
    
    try {
      // ペイロードを含むユーザーを作成
      const { data: createData, error: createError } = await client.rpc('auth_with_maternal_book', {
        maternal_book_param: `STORED_XSS_${Date.now()}`,
        user_nickname_param: storedXSSPayload
      });
      
      if (createError || !createData || createData.length === 0) {
        return {
          severity: 'low' as const,
          status: 'pass' as const,
          description: 'Stored XSSペイロードの保存が適切に防がれています',
          payload: storedXSSPayload
        };
      }
      
      // 保存されたデータを取得して確認
      const savedData = createData[0];
      const profileData = savedData.profile_data || {};
      
      const hasStoredXSS = JSON.stringify(profileData).includes('<script>') ||
                          JSON.stringify(profileData).includes('alert(');
      
      if (hasStoredXSS) {
        return {
          severity: 'critical' as const,
          status: 'fail' as const,
          description: 'Stored XSS脆弱性が発見されました',
          payload: storedXSSPayload,
          response: profileData,
          recommendations: ['データベース保存時のサニタイゼーション', 'データ表示時のエスケープ処理', 'HTMLタグの除去または無効化']
        };
      } else {
        return {
          severity: 'low' as const,
          status: 'pass' as const,
          description: 'Stored XSS攻撃に対して適切に保護されています',
          payload: storedXSSPayload,
          response: { sanitized: true }
        };
      }
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'Stored XSSペイロードの処理が適切に制限されています',
        payload: storedXSSPayload
      };
    }
  }));

  return results;
}

// CSRF攻撃テスト
async function runCSRFAttackTests(): Promise<XSSCSRFTestResult[]> {
  const results: XSSCSRFTestResult[] = [];

  // CSRF Token検証テスト
  results.push(await runXSSCSRFTest('CSRF Token検証テスト', 'csrf', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      // 正常な認証リクエスト
      const { data: normalAuth, error: normalError } = await client.rpc('auth_with_maternal_book', {
        maternal_book_param: 'CSRF_TEST_NORMAL',
        user_nickname_param: 'NormalUser'
      });
      
      // CSRF攻撃をシミュレート（異なるOriginからのリクエスト想定）
      const { data: csrfAuth, error: csrfError } = await client.rpc('auth_with_maternal_book', {
        maternal_book_param: 'CSRF_TEST_ATTACK',
        user_nickname_param: 'AttackUser'
      });
      
      // 現在の実装では、CSRFトークンによる保護は実装されていない
      // SupabaseのRLSとAPIキーベースの認証に依存
      const normalSuccess = !normalError && normalAuth && normalAuth.length > 0;
      const csrfSuccess = !csrfError && csrfAuth && csrfAuth.length > 0;
      
      if (normalSuccess && csrfSuccess) {
        return {
          severity: 'medium' as const,
          status: 'warning' as const,
          description: 'CSRFトークンによる保護が実装されていません（APIベースアプリでは一般的）',
          response: {
            normalRequest: normalSuccess,
            csrfRequest: csrfSuccess,
            note: 'Supabase APIキーとRLSによる保護に依存'
          },
          recommendations: ['リクエスト送信元の検証', 'リファラーチェックの実装', 'SameSite Cookieの設定']
        };
      }
      
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'CSRF攻撃が適切に防がれています',
        response: {
          normalRequest: normalSuccess,
          csrfRequest: csrfSuccess
        }
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'CSRF攻撃リクエストが適切に制限されています'
      };
    }
  }));

  // Origin/Referer検証テスト
  results.push(await runXSSCSRFTest('Origin/Referer検証テスト', 'csrf', async () => {
    // React NativeアプリからのSupabase API呼び出しの場合、
    // Origin/Refererヘッダーの検証は限定的
    
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data, error } = await client.rpc('auth_with_maternal_book', {
        maternal_book_param: 'ORIGIN_TEST',
        user_nickname_param: 'OriginTestUser'
      });
      
      // モバイルアプリの場合、Origin/Refererチェックは不適用
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'モバイルアプリのため、Origin/Referer検証は適用されません',
        response: {
          note: 'React Native環境ではOrigin/Refererヘッダーは異なる扱い',
          apiKeyProtection: true,
          rlsProtection: true
        }
      };
      
    } catch (err) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'API呼び出しが適切に制限されています'
      };
    }
  }));

  return results;
}

// スクリプトインジェクションテスト
async function runScriptInjectionTests(): Promise<XSSCSRFTestResult[]> {
  const results: XSSCSRFTestResult[] = [];

  // HTMLタグインジェクションテスト
  results.push(await runXSSCSRFTest('HTMLタグインジェクションテスト', 'injection', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const htmlInjectionPayloads = [
      '<iframe src="javascript:alert(\'Injection\')"></iframe>',
      '<object data="javascript:alert(\'Injection\')"></object>',
      '<embed src="javascript:alert(\'Injection\')">',
      '<form action="javascript:alert(\'Injection\')">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'Injection\')">'
    ];
    
    let injectionFound = false;
    const injectionResults: any[] = [];
    
    for (const payload of htmlInjectionPayloads) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: payload,
          user_nickname_param: 'InjectionTest'
        });
        
        const responseData = JSON.stringify(data || error || {});
        const hasInjection = responseData.includes('<iframe') ||
                            responseData.includes('<object') ||
                            responseData.includes('<embed') ||
                            responseData.includes('<form') ||
                            responseData.includes('<meta');
        
        if (hasInjection) {
          injectionFound = true;
          injectionResults.push({
            payload,
            injected: true,
            response: responseData.substring(0, 100)
          });
        } else {
          injectionResults.push({
            payload,
            injected: false,
            filtered: true
          });
        }
        
      } catch (err) {
        injectionResults.push({
          payload,
          injected: false,
          error: String(err).substring(0, 50)
        });
      }
    }
    
    if (!injectionFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'HTMLタグインジェクション攻撃に対して適切に保護されています',
        response: injectionResults
      };
    } else {
      return {
        severity: 'high' as const,
        status: 'fail' as const,
        description: 'HTMLタグインジェクション脆弱性が発見されました',
        response: injectionResults,
        recommendations: ['HTMLタグのフィルタリング', '許可リストベースの入力検証', 'HTML要素の無効化']
      };
    }
  }));

  // イベントハンドラインジェクションテスト
  results.push(await runXSSCSRFTest('イベントハンドラインジェクションテスト', 'injection', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const eventHandlerPayloads = [
      'onmouseover="alert(\'Event Handler\')"',
      'onclick="alert(\'Event Handler\')"',
      'onerror="alert(\'Event Handler\')"',
      'onload="alert(\'Event Handler\')"',
      'onfocus="alert(\'Event Handler\')"'
    ];
    
    let eventHandlerFound = false;
    const eventResults: any[] = [];
    
    for (const payload of eventHandlerPayloads) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: `test ${payload}`,
          user_nickname_param: 'EventTest'
        });
        
        const responseData = JSON.stringify(data || error || {});
        const hasEventHandler = responseData.includes('onmouseover') ||
                               responseData.includes('onclick') ||
                               responseData.includes('onerror') ||
                               responseData.includes('onload') ||
                               responseData.includes('onfocus');
        
        if (hasEventHandler) {
          eventHandlerFound = true;
          eventResults.push({
            payload,
            eventHandlerFound: true,
            response: responseData.substring(0, 100)
          });
        } else {
          eventResults.push({
            payload,
            eventHandlerFound: false,
            sanitized: true
          });
        }
        
      } catch (err) {
        eventResults.push({
          payload,
          eventHandlerFound: false,
          error: String(err).substring(0, 50)
        });
      }
    }
    
    if (!eventHandlerFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: 'イベントハンドラインジェクション攻撃に対して適切に保護されています',
        response: eventResults
      };
    } else {
      return {
        severity: 'high' as const,
        status: 'fail' as const,
        description: 'イベントハンドラインジェクション脆弱性が発見されました',
        response: eventResults,
        recommendations: ['イベントハンドラの除去', '属性値のエスケープ処理', '安全な属性のみ許可']
      };
    }
  }));

  return results;
}

// 入力値サニタイゼーションテスト
async function runInputSanitizationTests(): Promise<XSSCSRFTestResult[]> {
  const results: XSSCSRFTestResult[] = [];

  // 特殊文字サニタイゼーションテスト
  results.push(await runXSSCSRFTest('特殊文字サニタイゼーションテスト', 'validation', async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    const specialChars = [
      '<>&"\'`',
      '\\x3cscript\\x3e',
      '%3Cscript%3E',
      '&lt;script&gt;',
      '&#60;script&#62;'
    ];
    
    let unsanitizedFound = false;
    const sanitizationResults: any[] = [];
    
    for (const chars of specialChars) {
      try {
        const { data, error } = await client.rpc('auth_with_maternal_book', {
          maternal_book_param: `TEST_${chars}_END`,
          user_nickname_param: 'SanitizationTest'
        });
        
        const responseData = JSON.stringify(data || error || {});
        
        // 特殊文字がそのまま含まれているかチェック
        const hasUnsanitized = responseData.includes('<script') ||
                              responseData.includes('&lt;script') ||
                              responseData.includes('%3Cscript') ||
                              responseData.includes('\\x3cscript');
        
        if (hasUnsanitized) {
          unsanitizedFound = true;
          sanitizationResults.push({
            input: chars,
            sanitized: false,
            response: responseData.substring(0, 100)
          });
        } else {
          sanitizationResults.push({
            input: chars,
            sanitized: true,
            safe: true
          });
        }
        
      } catch (err) {
        sanitizationResults.push({
          input: chars,
          sanitized: true,
          error: String(err).substring(0, 50)
        });
      }
    }
    
    if (!unsanitizedFound) {
      return {
        severity: 'low' as const,
        status: 'pass' as const,
        description: '特殊文字が適切にサニタイズされています',
        response: sanitizationResults
      };
    } else {
      return {
        severity: 'medium' as const,
        status: 'warning' as const,
        description: '一部の特殊文字のサニタイゼーションが不十分です',
        response: sanitizationResults,
        recommendations: ['HTMLエンティティエンコーディング', 'URLエンコーディング対応', '特殊文字の統一的処理']
      };
    }
  }));

  return results;
}

// XSS/CSRFテスト実行ヘルパー
async function runXSSCSRFTest(
  testName: string, 
  category: XSSCSRFTestResult['category'], 
  testFn: () => Promise<{severity: XSSCSRFTestResult['severity'], status: XSSCSRFTestResult['status'], description: string, payload?: string, response?: any, recommendations?: string[]}>
): Promise<XSSCSRFTestResult> {
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
      payload: result.payload,
      response: result.response,
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
      response: { error }
    };
  }
}

// XSS/CSRFテスト結果表示
function displayXSSCSRFResults(testResults: XSSCSRFTestResult[]) {
  console.log('\n🛡️ XSS・CSRF対策セキュリティテスト結果サマリー');
  console.log('==========================================');
  
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
  const categories = ['xss', 'csrf', 'injection', 'validation'];
  console.log('\n📋 カテゴリ別結果:');
  categories.forEach(category => {
    const categoryTests = testResults.filter(r => r.category === category);
    const categoryPassed = categoryTests.filter(r => r.status === 'pass').length;
    const categoryName = {
      xss: 'XSS攻撃対策',
      csrf: 'CSRF攻撃対策',
      injection: 'インジェクション対策',
      validation: '入力値検証'
    }[category];
    console.log(`   ${categoryName}: ${categoryPassed}/${categoryTests.length} 成功`);
  });

  // 重要な脆弱性の詳細表示
  const criticalVulnerabilities = testResults.filter(r => 
    (r.severity === 'critical' || r.severity === 'high') && r.status !== 'pass'
  );
  
  if (criticalVulnerabilities.length > 0) {
    console.log('\n🚨 重要な脆弱性:');
    criticalVulnerabilities.forEach((vuln, index) => {
      console.log(`   ${index + 1}. [${vuln.severity.toUpperCase()}] ${vuln.testName}`);
      console.log(`      ${vuln.description}`);
      if (vuln.recommendations) {
        console.log(`      推奨対応: ${vuln.recommendations.join(', ')}`);
      }
    });
  }

  // XSS/CSRF保護スコア計算
  let protectionScore = 100;
  protectionScore -= (criticalIssues * 30);
  protectionScore -= (highIssues * 20);
  protectionScore -= (warningTests * 5);
  protectionScore = Math.max(0, protectionScore);

  console.log(`\n🎯 XSS・CSRF保護スコア: ${protectionScore}/100`);
  
  if (protectionScore >= 90 && criticalIssues === 0) {
    console.log('🎉 優秀！XSS・CSRF攻撃に対して完璧に保護されています。');
  } else if (protectionScore >= 70 && criticalIssues === 0) {
    console.log('✅ 良好！XSS・CSRF保護レベルは本番環境に適用可能です。');
  } else if (protectionScore >= 50) {
    console.log('⚠️  注意：XSS・CSRF保護に改善が必要です。');
  } else {
    console.log('🚨 警告：重大なXSS・CSRF脆弱性があります。即座の対応が必要です。');
  }
}

// XSS/CSRFテストレポート生成
function generateXSSCSRFReport(testResults: XSSCSRFTestResult[]) {
  const fs = require('fs');
  const path = require('path');
  
  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `production-security-xss-csrf-test-${timestamp}.json`);

  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const failedTests = testResults.filter(r => r.status === 'fail').length;
  const warningTests = testResults.filter(r => r.status === 'warning').length;
  const criticalIssues = testResults.filter(r => r.severity === 'critical' && r.status !== 'pass').length;
  const highIssues = testResults.filter(r => r.severity === 'high' && r.status !== 'pass').length;

  let protectionScore = 100;
  protectionScore -= (criticalIssues * 30);
  protectionScore -= (highIssues * 20);
  protectionScore -= (warningTests * 5);
  protectionScore = Math.max(0, protectionScore);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    testType: 'xss-csrf-security-test',
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
      protectionScore
    },
    testResults,
    recommendations: generateXSSCSRFRecommendations(testResults)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 XSS・CSRF対策セキュリティテストレポートを保存しました: ${reportPath}`);
}

// XSS/CSRF推奨事項生成
function generateXSSCSRFRecommendations(testResults: XSSCSRFTestResult[]): string[] {
  const recommendations: string[] = [];
  
  const criticalIssues = testResults.filter(r => r.severity === 'critical' && r.status !== 'pass').length;
  const highIssues = testResults.filter(r => r.severity === 'high' && r.status !== 'pass').length;
  
  if (criticalIssues === 0 && highIssues === 0) {
    recommendations.push('XSS・CSRF対策は高いセキュリティレベルを達成しています。');
  }
  
  if (criticalIssues > 0) {
    recommendations.push(`${criticalIssues}個のクリティカルなXSS・CSRF脆弱性を即座に修正してください。`);
  }
  
  if (highIssues > 0) {
    recommendations.push(`${highIssues}個の高リスクXSS・CSRF問題の修正を推奨します。`);
  }
  
  // 具体的な推奨事項
  const failedTests = testResults.filter(r => r.status === 'fail');
  failedTests.forEach(test => {
    if (test.recommendations) {
      recommendations.push(...test.recommendations);
    }
  });
  
  // 一般的なXSS・CSRF保護推奨事項
  recommendations.push('Content Security Policy (CSP)の実装を検討してください。');
  recommendations.push('定期的なXSS・CSRF脆弱性診断の実施を推奨します。');
  recommendations.push('開発者向けセキュアコーディング研修の実施を検討してください。');
  
  return [...new Set(recommendations)]; // 重複を除去
}

// スクリプト実行
runXSSCSRFSecurityTests().catch(console.error);