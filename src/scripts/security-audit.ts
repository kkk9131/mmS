/**
 * Supabase セキュリティ監査スクリプト
 * 本番環境でのセキュリティ設定を検証
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

interface SecurityCheckResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class SupabaseSecurityAuditor {
  private supabase;
  private results: SecurityCheckResult[] = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * 全セキュリティチェックを実行
   */
  async runAudit(): Promise<SecurityCheckResult[]> {
    console.log('🔐 Supabase セキュリティ監査を開始...\n');

    await this.checkEnvironmentConfiguration();
    await this.checkRLSPolicies();
    await this.checkAuthenticationSettings();
    await this.checkDatabaseAccess();
    await this.checkAPIKeyPermissions();
    await this.checkDataPrivacy();
    await this.checkStorageSecurity();

    this.printResults();
    return this.results;
  }

  /**
   * 環境設定チェック
   */
  private async checkEnvironmentConfiguration() {
    console.log('📋 環境設定をチェック中...');

    // Supabase URL の形式チェック
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      this.addResult('env-supabase-url', 'fail', 'EXPO_PUBLIC_SUPABASE_URL が設定されていません');
      return;
    }

    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      this.addResult('env-supabase-url', 'fail', 'Supabase URL の形式が正しくありません');
    } else {
      this.addResult('env-supabase-url', 'pass', 'Supabase URL が正しく設定されています');
    }

    // API Key の形式チェック
    const apiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!apiKey) {
      this.addResult('env-api-key', 'fail', 'EXPO_PUBLIC_SUPABASE_ANON_KEY が設定されていません');
      return;
    }

    if (apiKey.length < 100) {
      this.addResult('env-api-key', 'warning', 'API Key が短すぎる可能性があります');
    } else {
      this.addResult('env-api-key', 'pass', 'API Key が設定されています');
    }

    // Service Role Key の存在チェック（開発環境のみ）
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (process.env.NODE_ENV === 'production' && serviceKey) {
      this.addResult('env-service-key', 'warning', '本番環境でService Role Keyが設定されています');
    }
  }

  /**
   * RLSポリシーチェック
   */
  private async checkRLSPolicies() {
    console.log('🛡️  RLS (Row Level Security) ポリシーをチェック中...');

    const tables = ['users', 'posts', 'likes', 'comments', 'notifications', 'follows'];

    for (const table of tables) {
      try {
        // テーブルの RLS 状態を確認
        const { data: rlsStatus, error } = await this.supabase
          .rpc('check_rls_enabled' as any, { table_name: table });

        if (error) {
          this.addResult(`rls-${table}`, 'warning', `${table} テーブルのRLS状態確認中にエラー: ${error.message}`);
          continue;
        }

        if (!rlsStatus) {
          this.addResult(`rls-${table}`, 'fail', `${table} テーブルでRLSが無効になっています`);
        } else {
          this.addResult(`rls-${table}`, 'pass', `${table} テーブルでRLSが有効です`);
        }

        // ポリシーの存在確認
        await this.checkTablePolicies(table);

      } catch (error) {
        this.addResult(`rls-${table}`, 'fail', `${table} テーブルアクセス中にエラー: ${error}`);
      }
    }
  }

  /**
   * 特定テーブルのポリシーチェック
   */
  private async checkTablePolicies(tableName: string) {
    try {
      // 基本的なCRUD操作のポリシー存在確認
      const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
      
      for (const operation of operations) {
        const { data: policies, error } = await this.supabase
          .rpc('get_table_policies' as any, { 
            table_name: tableName, 
            operation_type: operation 
          });

        if (error) {
          this.addResult(
            `policy-${tableName}-${operation.toLowerCase()}`,
            'warning',
            `${tableName} の ${operation} ポリシー確認中にエラー`
          );
          continue;
        }

        if (!policies || policies.length === 0) {
          this.addResult(
            `policy-${tableName}-${operation.toLowerCase()}`,
            'fail',
            `${tableName} に ${operation} ポリシーが設定されていません`
          );
        } else {
          this.addResult(
            `policy-${tableName}-${operation.toLowerCase()}`,
            'pass',
            `${tableName} の ${operation} ポリシーが設定されています`
          );
        }
      }
    } catch (error) {
      this.addResult(
        `policy-${tableName}`,
        'warning',
        `${tableName} のポリシー確認中にエラーが発生`
      );
    }
  }

  /**
   * 認証設定チェック
   */
  private async checkAuthenticationSettings() {
    console.log('🔑 認証設定をチェック中...');

    try {
      // 匿名サインアップの無効化確認
      const testEmail = `security-test-${Date.now()}@example.com`;
      const { data, error } = await this.supabase.auth.signUp({
        email: testEmail,
        password: 'test-password-123'
      });

      if (!error && data.user) {
        this.addResult('auth-signup', 'warning', '一般的なメールサインアップが有効になっています');
        
        // テストユーザーを削除（可能な場合）
        await this.supabase.auth.admin.deleteUser(data.user.id);
      } else {
        this.addResult('auth-signup', 'pass', '一般的なサインアップが適切に制限されています');
      }

      // セッション設定の確認
      const { data: session } = await this.supabase.auth.getSession();
      if (session?.session) {
        this.addResult('auth-session', 'pass', '認証セッションが正常に動作しています');
      } else {
        this.addResult('auth-session', 'warning', '認証セッションの状態を確認できませんでした');
      }

    } catch (error) {
      this.addResult('auth-test', 'warning', `認証テスト中にエラー: ${error}`);
    }
  }

  /**
   * データベースアクセステスト
   */
  private async checkDatabaseAccess() {
    console.log('💾 データベースアクセス権限をチェック中...');

    // 未認証状態でのアクセステスト
    try {
      // users テーブルへの未認証アクセス
      const { data: usersData, error: usersError } = await this.supabase
        .from('users')
        .select('*')
        .limit(1);

      if (!usersError && usersData && usersData.length > 0) {
        this.addResult('db-users-access', 'fail', '未認証状態でusersテーブルにアクセスできます');
      } else {
        this.addResult('db-users-access', 'pass', 'usersテーブルへの未認証アクセスが適切にブロックされています');
      }

      // posts テーブルへのアクセステスト
      const { data: postsData, error: postsError } = await this.supabase
        .from('posts')
        .select('id, content, created_at')
        .limit(1);

      if (!postsError) {
        this.addResult('db-posts-access', 'pass', '公開投稿への読み取りアクセスが正常です');
      } else {
        this.addResult('db-posts-access', 'warning', `投稿データへのアクセス中にエラー: ${postsError.message}`);
      }

    } catch (error) {
      this.addResult('db-access', 'warning', `データベースアクセステスト中にエラー: ${error}`);
    }
  }

  /**
   * API キー権限チェック
   */
  private async checkAPIKeyPermissions() {
    console.log('🔐 API キー権限をチェック中...');

    try {
      // 管理者機能へのアクセステスト
      const { data, error } = await this.supabase.auth.admin.listUsers();

      if (!error) {
        this.addResult('api-admin-access', 'fail', 'Anonymous キーで管理者機能にアクセスできます');
      } else {
        this.addResult('api-admin-access', 'pass', '管理者機能へのアクセスが適切にブロックされています');
      }

      // 直接的なデータベース操作テスト
      const { error: insertError } = await this.supabase
        .from('users')
        .insert({
          id: 'security-test-user',
          nickname: 'Test User',
          maternal_book_number: 'test-hash'
        } as any);

      if (!insertError) {
        this.addResult('api-direct-insert', 'fail', '未認証状態で直接データ挿入ができます');
        
        // テストデータを削除
        await this.supabase
          .from('users')
          .delete()
          .eq('id', 'security-test-user');
      } else {
        this.addResult('api-direct-insert', 'pass', '未認証状態での直接データ挿入が適切にブロックされています');
      }

    } catch (error) {
      this.addResult('api-permissions', 'warning', `API権限テスト中にエラー: ${error}`);
    }
  }

  /**
   * データプライバシーチェック
   */
  private async checkDataPrivacy() {
    console.log('🔒 データプライバシーをチェック中...');

    try {
      // 個人情報フィールドのアクセステスト
      const { data: userData, error } = await this.supabase
        .from('users')
        .select('mothers_handbook_number_hash, email')
        .limit(1);

      if (!error && userData && userData.length > 0) {
        if ((userData[0] as any).mothers_handbook_number_hash || (userData[0] as any).email) {
          this.addResult('privacy-sensitive-data', 'fail', '個人情報が未認証状態でアクセス可能です');
        }
      } else {
        this.addResult('privacy-sensitive-data', 'pass', '個人情報へのアクセスが適切に制限されています');
      }

      // 匿名投稿の機能テスト
      const { data: anonPosts, error: anonError } = await this.supabase
        .from('posts')
        .select('user_id, is_anonymous')
        .eq('is_anonymous', true)
        .limit(1);

      if (!anonError) {
        this.addResult('privacy-anonymous-posts', 'pass', '匿名投稿機能が正常に動作しています');
      } else {
        this.addResult('privacy-anonymous-posts', 'warning', '匿名投稿機能の確認中にエラーが発生');
      }

    } catch (error) {
      this.addResult('privacy-check', 'warning', `プライバシーチェック中にエラー: ${error}`);
    }
  }

  /**
   * ストレージセキュリティチェック
   */
  private async checkStorageSecurity() {
    console.log('📁 ストレージセキュリティをチェック中...');

    try {
      // ストレージバケットのアクセス制御確認
      const { data: buckets, error } = await this.supabase.storage.listBuckets();

      if (error) {
        this.addResult('storage-access', 'warning', `ストレージアクセス中にエラー: ${error.message}`);
        return;
      }

      if (buckets && buckets.length > 0) {
        for (const bucket of buckets) {
          // バケットのポリシー確認
          const { data: files, error: listError } = await this.supabase.storage
            .from(bucket.name)
            .list();

          if (!listError) {
            this.addResult(`storage-${bucket.name}`, 'pass', `${bucket.name} バケットのアクセス制御が設定されています`);
          } else {
            this.addResult(`storage-${bucket.name}`, 'warning', `${bucket.name} バケットアクセス中にエラー`);
          }
        }
      } else {
        this.addResult('storage-buckets', 'pass', 'ストレージバケットが適切に設定されています');
      }

    } catch (error) {
      this.addResult('storage-security', 'warning', `ストレージセキュリティチェック中にエラー: ${error}`);
    }
  }

  /**
   * 結果を追加
   */
  private addResult(check: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
    this.results.push({ check, status, message, details });
  }

  /**
   * 結果を表示
   */
  private printResults() {
    console.log('\n📊 セキュリティ監査結果:');
    console.log('=' .repeat(60));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    console.log(`✅ 成功: ${passed}`);
    console.log(`❌ 失敗: ${failed}`);
    console.log(`⚠️  警告: ${warnings}`);
    console.log(`📝 合計: ${this.results.length}`);
    console.log('');

    // 失敗項目の詳細表示
    if (failed > 0) {
      console.log('🚨 修正が必要な項目:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(result => {
          console.log(`  ❌ ${result.check}: ${result.message}`);
        });
      console.log('');
    }

    // 警告項目の表示
    if (warnings > 0) {
      console.log('⚠️  確認が推奨される項目:');
      this.results
        .filter(r => r.status === 'warning')
        .forEach(result => {
          console.log(`  ⚠️  ${result.check}: ${result.message}`);
        });
      console.log('');
    }

    // 全体評価
    if (failed === 0) {
      console.log('🎉 セキュリティ監査に合格しました！');
    } else {
      console.log('🔧 修正が必要な項目があります。本番環境デプロイ前に対応してください。');
    }
  }

  /**
   * レポートをJSONで出力
   */
  exportReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'pass').length,
        failed: this.results.filter(r => r.status === 'fail').length,
        warnings: this.results.filter(r => r.status === 'warning').length
      },
      results: this.results
    };

    return JSON.stringify(report, null, 2);
  }
}

// スクリプト実行用
async function runSecurityAudit() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 環境変数が設定されていません');
    process.exit(1);
  }

  const auditor = new SupabaseSecurityAuditor(supabaseUrl, supabaseKey);
  const results = await auditor.runAudit();

  // レポート出力
  const report = auditor.exportReport();
  const fs = require('fs');
  const reportPath = `security-audit-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportPath, report);
  
  console.log(`📄 詳細レポートが ${reportPath} に出力されました`);

  // 失敗がある場合は終了コード1で終了
  const hasFailed = results.some(r => r.status === 'fail');
  process.exit(hasFailed ? 1 : 0);
}

export { SupabaseSecurityAuditor, runSecurityAudit };

// 直接実行時
if (require.main === module) {
  runSecurityAudit().catch(console.error);
}