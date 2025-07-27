#!/usr/bin/env tsx

/**
 * フォロー機能RPC関数のテストスクリプト
 * 作成したRPC関数の動作確認を行う
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  error?: string;
  duration: number;
  data?: any;
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
  summary: string;
}

class FollowRPCTester {
  private supabase: any;
  private testResults: TestResult[] = [];
  private testUsers: { id: string; email: string }[] = [];

  constructor() {
    // 環境変数から直接Supabaseクライアントを作成
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zfmqxdkqpeyvsuqyzuvy.supabase.co';
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbXF4ZGtxcGV5dnN1cXl6dXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMzMzNDIsImV4cCI6MjA2ODcwOTM0Mn0.BUE7K0TzIMVzQTk6fsDecYNY6s-ftH1UCsm6eOm4BCA';
    
    this.supabase = createClient(url, anonKey);
    
    console.log('🚀 フォロー機能RPC関数テスト開始');
    console.log(`📍 Supabase URL: ${url}`);
    
    // テスト用ユーザーID生成
    this.testUsers = [
      { id: randomUUID(), email: 'user1@test.com' },
      { id: randomUUID(), email: 'user2@test.com' },
      { id: randomUUID(), email: 'user3@test.com' }
    ];
    
    console.log('👥 テスト用ユーザー:');
    this.testUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.id})`);
    });
  }

  /**
   * follow_user関数のテスト
   */
  private async testFollowUser(): Promise<TestResult> {
    const testName = 'follow_user関数テスト';
    const startTime = Date.now();
    
    try {
      console.log('\n🔄 follow_user関数をテスト中...');
      
      const follower = this.testUsers[0];
      const following = this.testUsers[1];
      
      console.log(`   フォロワー: ${follower.email} (${follower.id})`);
      console.log(`   フォロー対象: ${following.email} (${following.id})`);
      
      const { data, error } = await this.supabase.rpc('follow_user', {
        p_follower_id: follower.id,
        p_following_id: following.id
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        console.log(`❌ follow_user関数エラー: ${error.message}`);
        
        // 関数が存在しない場合の特別処理
        if (error.message?.includes('does not exist')) {
          return {
            testName,
            success: false,
            message: '関数が作成されていません - Supabaseダッシュボードでのマニュアル実行が必要',
            error: error.message,
            duration
          };
        }
        
        return {
          testName,
          success: false,
          message: 'follow_user関数の実行に失敗',
          error: error.message,
          duration
        };
      }
      
      console.log(`✅ follow_user関数テスト成功: ${data}`);
      
      return {
        testName,
        success: true,
        message: `フォロー実行成功 (${follower.email} → ${following.email})`,
        duration,
        data
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ follow_user関数テスト例外: ${errorMessage}`);
      
      return {
        testName,
        success: false,
        message: 'follow_user関数でテスト例外発生',
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * get_follow_relationship関数のテスト
   */
  private async testGetFollowRelationship(): Promise<TestResult> {
    const testName = 'get_follow_relationship関数テスト';
    const startTime = Date.now();
    
    try {
      console.log('\n🔄 get_follow_relationship関数をテスト中...');
      
      const user1 = this.testUsers[0];
      const user2 = this.testUsers[1];
      
      console.log(`   ユーザー1: ${user1.email} (${user1.id})`);
      console.log(`   ユーザー2: ${user2.email} (${user2.id})`);
      
      const { data, error } = await this.supabase.rpc('get_follow_relationship', {
        p_user_id: user1.id,
        p_target_user_id: user2.id
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        console.log(`❌ get_follow_relationship関数エラー: ${error.message}`);
        
        if (error.message?.includes('does not exist')) {
          return {
            testName,
            success: false,
            message: '関数が作成されていません - Supabaseダッシュボードでのマニュアル実行が必要',
            error: error.message,
            duration
          };
        }
        
        return {
          testName,
          success: false,
          message: 'get_follow_relationship関数の実行に失敗',
          error: error.message,
          duration
        };
      }
      
      console.log(`✅ get_follow_relationship関数テスト成功:`, data);
      
      // データの検証
      if (Array.isArray(data) && data.length > 0) {
        const relationship = data[0];
        console.log(`   - フォロー中: ${relationship.is_following}`);
        console.log(`   - フォローされている: ${relationship.is_followed_by}`);
        console.log(`   - フォロー日時: ${relationship.followed_at}`);
      }
      
      return {
        testName,
        success: true,
        message: `フォロー関係取得成功 (${user1.email} ↔ ${user2.email})`,
        duration,
        data
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ get_follow_relationship関数テスト例外: ${errorMessage}`);
      
      return {
        testName,
        success: false,
        message: 'get_follow_relationship関数でテスト例外発生',
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * unfollow_user関数のテスト
   */
  private async testUnfollowUser(): Promise<TestResult> {
    const testName = 'unfollow_user関数テスト';
    const startTime = Date.now();
    
    try {
      console.log('\n🔄 unfollow_user関数をテスト中...');
      
      const follower = this.testUsers[0];
      const following = this.testUsers[1];
      
      console.log(`   フォロワー: ${follower.email} (${follower.id})`);
      console.log(`   フォロー解除対象: ${following.email} (${following.id})`);
      
      const { data, error } = await this.supabase.rpc('unfollow_user', {
        p_follower_id: follower.id,
        p_following_id: following.id
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        console.log(`❌ unfollow_user関数エラー: ${error.message}`);
        
        if (error.message?.includes('does not exist')) {
          return {
            testName,
            success: false,
            message: '関数が作成されていません - Supabaseダッシュボードでのマニュアル実行が必要',
            error: error.message,
            duration
          };
        }
        
        return {
          testName,
          success: false,
          message: 'unfollow_user関数の実行に失敗',
          error: error.message,
          duration
        };
      }
      
      console.log(`✅ unfollow_user関数テスト成功: ${data}`);
      
      return {
        testName,
        success: true,
        message: `フォロー解除実行成功 (${follower.email} → ${following.email})`,
        duration,
        data
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ unfollow_user関数テスト例外: ${errorMessage}`);
      
      return {
        testName,
        success: false,
        message: 'unfollow_user関数でテスト例外発生',
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * エラーケースのテスト（自分自身をフォロー）
   */
  private async testSelfFollowError(): Promise<TestResult> {
    const testName = '自分自身フォローエラーテスト';
    const startTime = Date.now();
    
    try {
      console.log('\n🔄 自分自身をフォローするエラーケースをテスト中...');
      
      const user = this.testUsers[0];
      
      console.log(`   テストユーザー: ${user.email} (${user.id})`);
      
      const { data, error } = await this.supabase.rpc('follow_user', {
        p_follower_id: user.id,
        p_following_id: user.id
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        // このケースではエラーが期待される
        if (error.message?.includes('Cannot follow yourself')) {
          console.log(`✅ 期待通りのエラー: ${error.message}`);
          
          return {
            testName,
            success: true,
            message: '自分自身フォロー防止機能が正常動作',
            duration,
            data: { expectedError: error.message }
          };
        } else if (error.message?.includes('does not exist')) {
          return {
            testName,
            success: false,
            message: '関数が作成されていません - Supabaseダッシュボードでのマニュアル実行が必要',
            error: error.message,
            duration
          };
        } else {
          console.log(`❌ 予期しないエラー: ${error.message}`);
          
          return {
            testName,
            success: false,
            message: '予期しないエラーが発生',
            error: error.message,
            duration
          };
        }
      }
      
      // エラーが発生しなかった場合（問題）
      console.log(`❌ エラーが発生すべきですが成功してしまいました: ${data}`);
      
      return {
        testName,
        success: false,
        message: '自分自身フォロー防止機能が動作していません',
        duration,
        data
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ 自分自身フォローテスト例外: ${errorMessage}`);
      
      return {
        testName,
        success: false,
        message: '自分自身フォローテストで例外発生',
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * すべてのテストを実行
   */
  async runAllTests(): Promise<TestReport> {
    const startTime = new Date();
    console.log('\n' + '='.repeat(80));
    console.log('🧪 フォロー機能RPC関数テスト開始');
    console.log('='.repeat(80));
    console.log(`🕐 開始時刻: ${startTime.toISOString()}`);
    
    try {
      // テスト実行
      console.log('\n📋 テスト項目:');
      console.log('1. follow_user関数の基本動作テスト');
      console.log('2. get_follow_relationship関数の基本動作テスト');
      console.log('3. unfollow_user関数の基本動作テスト');
      console.log('4. 自分自身フォローエラーケーステスト');
      
      this.testResults.push(await this.testFollowUser());
      this.testResults.push(await this.testGetFollowRelationship());
      this.testResults.push(await this.testUnfollowUser());
      this.testResults.push(await this.testSelfFollowError());
      
      // 結果の集計
      const passed = this.testResults.filter(r => r.success).length;
      const failed = this.testResults.length - passed;
      
      const report: TestReport = {
        timestamp: startTime.toISOString(),
        totalTests: this.testResults.length,
        passed,
        failed,
        results: this.testResults,
        summary: this.generateSummary(passed, failed)
      };
      
      // レポート表示
      this.displayReport(report);
      
      // レポート保存
      await this.saveReport(report);
      
      return report;
      
    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      
      const errorResult: TestResult = {
        testName: 'テスト実行',
        success: false,
        message: 'テスト実行エラー',
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      };
      
      const report: TestReport = {
        timestamp: startTime.toISOString(),
        totalTests: 1,
        passed: 0,
        failed: 1,
        results: [errorResult],
        summary: 'テスト実行中にエラーが発生しました'
      };
      
      return report;
    }
  }

  /**
   * サマリー生成
   */
  private generateSummary(passed: number, failed: number): string {
    const total = passed + failed;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    if (successRate === 100) {
      return `🎉 全てのRPC関数が正常に動作しています！ (${passed}/${total} 成功)`;
    } else if (successRate >= 75) {
      return `✅ RPC関数の大部分が正常に動作しています (${passed}/${total} 成功, ${successRate}%)`;
    } else if (successRate >= 50) {
      return `⚠️  RPC関数の一部に問題があります (${passed}/${total} 成功, ${successRate}%)`;
    } else if (successRate > 0) {
      return `❌ RPC関数に重大な問題があります (${passed}/${total} 成功, ${successRate}%)`;
    } else {
      return `🚫 RPC関数が作成されていません - Supabaseダッシュボードでの手動実行が必要です`;
    }
  }

  /**
   * レポート表示
   */
  private displayReport(report: TestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 フォロー機能RPC関数テスト結果');
    console.log('='.repeat(80));
    console.log(`🕐 実行時刻: ${report.timestamp}`);
    console.log(`📈 総合結果: ${report.passed}/${report.totalTests} 成功`);
    console.log(`📋 サマリー: ${report.summary}`);
    
    console.log('\n📋 詳細結果:');
    report.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `(${result.duration}ms)`;
      console.log(`${index + 1}. ${status} ${result.testName} ${duration}`);
      console.log(`   ${result.message}`);
      
      if (result.error) {
        console.log(`   エラー: ${result.error}`);
      }
      
      if (result.data) {
        console.log(`   データ: ${JSON.stringify(result.data, null, 2)}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    
    // 次のステップの案内
    if (report.failed > 0) {
      console.log('\n📋 次のステップ:');
      console.log('1. Supabaseダッシュボード (https://supabase.com/dashboard) にアクセス');
      console.log('2. プロジェクト (zfmqxdkqpeyvsuqyzuvy) を選択');
      console.log('3. SQL Editor タブを開く');
      console.log('4. 以下のファイルの内容をコピー＆ペーストして実行:');
      console.log('   src/scripts/follow-rpc-manual-setup.sql');
      console.log('5. 実行後、このテストスクリプトを再実行してください');
    }
  }

  /**
   * レポート保存
   */
  private async saveReport(report: TestReport): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `follow-rpc-test-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', '..', 'test-reports', filename);
      
      // ディレクトリが存在しない場合は作成
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`💾 テストレポートを保存しました: ${filepath}`);
    } catch (error) {
      console.warn('⚠️  レポート保存に失敗:', error);
    }
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  const tester = new FollowRPCTester();
  
  tester.runAllTests()
    .then((report) => {
      const exitCode = report.failed === 0 ? 0 : 1;
      console.log(`\n🏁 テスト完了 (終了コード: ${exitCode})`);
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

export { FollowRPCTester };