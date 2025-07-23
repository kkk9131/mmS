/**
 * パフォーマンステストスクリプト
 * Supabase-Redux統合のパフォーマンスを包括的に検証
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { performanceMonitor } from '../utils/performanceMonitor';

interface PerformanceTestResult {
  test: string;
  metric: string;
  value: number;
  unit: string;
  status: 'excellent' | 'good' | 'warning' | 'poor';
  threshold?: number;
  details?: any;
}

interface LoadTestConfig {
  concurrentUsers: number;
  testDurationMs: number;
  operationsPerUser: number;
  dataSize: 'small' | 'medium' | 'large';
}

class PerformanceTestSuite {
  private supabase;
  private results: PerformanceTestResult[] = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * 全パフォーマンステストを実行
   */
  async runPerformanceTests(): Promise<PerformanceTestResult[]> {
    console.log('⚡ パフォーマンステストを開始...\n');

    await this.testDatabaseQueryPerformance();
    await this.testRealtimePerformance();
    await this.testCachePerformance();
    await this.testConcurrentOperations();
    await this.testMemoryUsage();
    await this.testNetworkLatency();
    await this.runLoadTests();

    this.printResults();
    return this.results;
  }

  /**
   * データベースクエリパフォーマンステスト
   */
  private async testDatabaseQueryPerformance() {
    console.log('🏃‍♂️ データベースクエリパフォーマンスをテスト中...');

    // 基本的なSELECTクエリ
    const selectStartTime = performance.now();
    const { data: posts, error } = await this.supabase
      .from('posts')
      .select('id, content, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(50);
    const selectEndTime = performance.now();
    
    const selectDuration = selectEndTime - selectStartTime;
    this.addResult(
      'db-select-performance',
      'Query Duration',
      selectDuration,
      'ms',
      this.evaluateQueryTime(selectDuration)
    );

    if (!error && posts) {
      // 複雑なJOINクエリ
      const joinStartTime = performance.now();
      const { data: postsWithUsers } = await this.supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          users!posts_user_id_fkey (
            nickname,
            avatar_url
          )
        `)
        .limit(20);
      const joinEndTime = performance.now();

      const joinDuration = joinEndTime - joinStartTime;
      this.addResult(
        'db-join-performance',
        'JOIN Query Duration',
        joinDuration,
        'ms',
        this.evaluateQueryTime(joinDuration, 500) // JOINは少し長めの閾値
      );

      // 集計クエリ
      const aggregateStartTime = performance.now();
      const { data: postCounts } = await this.supabase
        .rpc('get_post_counts_by_user' as any); // 事前に作成されたRPC関数
      const aggregateEndTime = performance.now();

      const aggregateDuration = aggregateEndTime - aggregateStartTime;
      this.addResult(
        'db-aggregate-performance',
        'Aggregate Query Duration',
        aggregateDuration,
        'ms',
        this.evaluateQueryTime(aggregateDuration, 300)
      );

      // インデックス効果テスト
      await this.testIndexPerformance();
    }
  }

  /**
   * インデックスパフォーマンステスト
   */
  private async testIndexPerformance() {
    // 日付範囲検索（インデックスあり）
    const indexedStartTime = performance.now();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentPosts } = await this.supabase
      .from('posts')
      .select('id, created_at')
      .gte('created_at', yesterday.toISOString())
      .limit(100);
    const indexedEndTime = performance.now();

    const indexedDuration = indexedEndTime - indexedStartTime;
    this.addResult(
      'db-indexed-search',
      'Indexed Search Duration',
      indexedDuration,
      'ms',
      this.evaluateQueryTime(indexedDuration, 200)
    );

    // テキスト検索（全文検索インデックス）
    const textSearchStartTime = performance.now();
    const { data: searchResults } = await this.supabase
      .from('posts')
      .select('id, content')
      .textSearch('content', 'test')
      .limit(20);
    const textSearchEndTime = performance.now();

    const textSearchDuration = textSearchEndTime - textSearchStartTime;
    this.addResult(
      'db-text-search',
      'Text Search Duration',
      textSearchDuration,
      'ms',
      this.evaluateQueryTime(textSearchDuration, 400)
    );
  }

  /**
   * リアルタイムパフォーマンステスト
   */
  private async testRealtimePerformance() {
    console.log('⚡ リアルタイム機能のパフォーマンスをテスト中...');

    let connectionTime = 0;
    let messageReceiveTime = 0;
    let messagesReceived = 0;

    const connectionStartTime = performance.now();
    
    const channel = this.supabase
      .channel('performance-test')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const now = performance.now();
          if (messageReceiveTime === 0) {
            messageReceiveTime = now;
          }
          messagesReceived++;
        }
      );

    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connectionTime = performance.now() - connectionStartTime;
          resolve(void 0);
        }
      });
    });

    this.addResult(
      'realtime-connection',
      'Connection Time',
      connectionTime,
      'ms',
      this.evaluateConnectionTime(connectionTime)
    );

    // メッセージ受信テスト
    const testPostStartTime = performance.now();
    const { error } = await this.supabase
      .from('posts')
      .insert({
        user_id: 'performance-test-user',
        content: 'Performance test message',
        is_anonymous: false
      });

    if (!error) {
      // メッセージ受信を待機
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (messagesReceived > 0) {
        const messageLatency = messageReceiveTime - testPostStartTime;
        this.addResult(
          'realtime-latency',
          'Message Latency',
          messageLatency,
          'ms',
          this.evaluateLatency(messageLatency)
        );
      } else {
        this.addResult(
          'realtime-latency',
          'Message Reception',
          0,
          'messages',
          'poor'
        );
      }

      // クリーンアップ
      await this.supabase
        .from('posts')
        .delete()
        .eq('user_id', 'performance-test-user');
    }

    channel.unsubscribe();
  }

  /**
   * キャッシュパフォーマンステスト
   */
  private async testCachePerformance() {
    console.log('🗃️ キャッシュパフォーマンスをテスト中...');

    const testQueries = [
      { table: 'posts', limit: 20 },
      { table: 'users', limit: 10 },
      { table: 'notifications', limit: 15 }
    ];

    for (const query of testQueries) {
      // 初回クエリ（キャッシュなし）
      const coldStartTime = performance.now();
      await this.supabase
        .from(query.table as any)
        .select('*')
        .limit(query.limit);
      const coldEndTime = performance.now();

      // 2回目クエリ（キャッシュあり）
      const cachedStartTime = performance.now();
      await this.supabase
        .from(query.table as any)
        .select('*')
        .limit(query.limit);
      const cachedEndTime = performance.now();

      const coldDuration = coldEndTime - coldStartTime;
      const cachedDuration = cachedEndTime - cachedStartTime;
      const cacheEfficiency = ((coldDuration - cachedDuration) / coldDuration) * 100;

      this.addResult(
        `cache-${query.table}-cold`,
        'Cold Query Time',
        coldDuration,
        'ms',
        this.evaluateQueryTime(coldDuration)
      );

      this.addResult(
        `cache-${query.table}-warm`,
        'Cached Query Time',
        cachedDuration,
        'ms',
        this.evaluateQueryTime(cachedDuration)
      );

      this.addResult(
        `cache-${query.table}-efficiency`,
        'Cache Efficiency',
        cacheEfficiency,
        '%',
        cacheEfficiency > 30 ? 'excellent' : cacheEfficiency > 10 ? 'good' : 'warning'
      );
    }
  }

  /**
   * 並行処理パフォーマンステスト
   */
  private async testConcurrentOperations() {
    console.log('🔄 並行処理パフォーマンスをテスト中...');

    const concurrentQueries = 10;
    const queries = Array.from({ length: concurrentQueries }, (_, i) => 
      this.supabase
        .from('posts')
        .select('id, content')
        .range(i * 10, (i + 1) * 10 - 1)
    );

    const startTime = performance.now();
    const results = await Promise.all(queries);
    const endTime = performance.now();

    const totalTime = endTime - startTime;
    const averageTime = totalTime / concurrentQueries;

    this.addResult(
      'concurrent-operations-total',
      'Total Time',
      totalTime,
      'ms',
      this.evaluateQueryTime(totalTime, 1000)
    );

    this.addResult(
      'concurrent-operations-average',
      'Average Time per Query',
      averageTime,
      'ms',
      this.evaluateQueryTime(averageTime, 200)
    );

    // 成功率チェック
    const successfulQueries = results.filter(r => !r.error).length;
    const successRate = (successfulQueries / concurrentQueries) * 100;

    this.addResult(
      'concurrent-operations-success-rate',
      'Success Rate',
      successRate,
      '%',
      successRate >= 95 ? 'excellent' : successRate >= 80 ? 'good' : 'poor'
    );
  }

  /**
   * メモリ使用量テスト
   */
  private async testMemoryUsage() {
    console.log('🧠 メモリ使用量をテスト中...');

    const initialMemory = this.getMemoryUsage();

    // 大量データロードテスト
    const largeDataQueries = Array.from({ length: 5 }, () =>
      this.supabase
        .from('posts')
        .select('*')
        .limit(100)
    );

    await Promise.all(largeDataQueries);

    const peakMemory = this.getMemoryUsage();
    const memoryIncrease = peakMemory - initialMemory;

    this.addResult(
      'memory-usage-increase',
      'Memory Increase',
      memoryIncrease,
      'MB',
      memoryIncrease < 50 ? 'excellent' : memoryIncrease < 100 ? 'good' : 'warning'
    );

    // メモリリークテスト
    await this.testMemoryLeaks();
  }

  /**
   * メモリリークテスト
   */
  private async testMemoryLeaks() {
    const iterations = 10;
    const memoryReadings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // リアルタイム接続の作成と破棄
      const channel = this.supabase
        .channel(`leak-test-${i}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {});
      
      await channel.subscribe();
      await new Promise(resolve => setTimeout(resolve, 100));
      await channel.unsubscribe();

      // データ取得
      await this.supabase.from('posts').select('*').limit(10);

      memoryReadings.push(this.getMemoryUsage());
      
      if (global.gc) {
        global.gc(); // ガベージコレクションを強制実行（Node.js）
      }
    }

    // メモリ使用量の傾向を分析
    const firstHalf = memoryReadings.slice(0, Math.floor(iterations / 2));
    const secondHalf = memoryReadings.slice(Math.floor(iterations / 2));
    
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    
    const memoryTrend = secondHalfAvg - firstHalfAvg;

    this.addResult(
      'memory-leak-trend',
      'Memory Trend',
      memoryTrend,
      'MB',
      memoryTrend < 5 ? 'excellent' : memoryTrend < 15 ? 'good' : 'warning'
    );
  }

  /**
   * ネットワークレイテンシーテスト
   */
  private async testNetworkLatency() {
    console.log('🌐 ネットワークレイテンシーをテスト中...');

    const pingTests = 5;
    const latencies: number[] = [];

    for (let i = 0; i < pingTests; i++) {
      const startTime = performance.now();
      await this.supabase.from('posts').select('id').limit(1);
      const endTime = performance.now();
      
      latencies.push(endTime - startTime);
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
    }

    const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    this.addResult(
      'network-latency-average',
      'Average Latency',
      avgLatency,
      'ms',
      this.evaluateLatency(avgLatency)
    );

    this.addResult(
      'network-latency-max',
      'Max Latency',
      maxLatency,
      'ms',
      this.evaluateLatency(maxLatency)
    );

    this.addResult(
      'network-latency-jitter',
      'Latency Jitter',
      maxLatency - minLatency,
      'ms',
      (maxLatency - minLatency) < 50 ? 'excellent' : (maxLatency - minLatency) < 100 ? 'good' : 'warning'
    );
  }

  /**
   * ロードテスト実行
   */
  private async runLoadTests() {
    console.log('🏋️‍♂️ ロードテストを実行中...');

    const loadConfigs: LoadTestConfig[] = [
      { concurrentUsers: 5, testDurationMs: 30000, operationsPerUser: 10, dataSize: 'small' },
      { concurrentUsers: 10, testDurationMs: 60000, operationsPerUser: 20, dataSize: 'medium' },
      { concurrentUsers: 20, testDurationMs: 120000, operationsPerUser: 30, dataSize: 'large' }
    ];

    for (const config of loadConfigs) {
      await this.executeLoadTest(config);
    }
  }

  /**
   * 個別ロードテスト実行
   */
  private async executeLoadTest(config: LoadTestConfig) {
    console.log(`📊 ロードテスト実行中: ${config.concurrentUsers} 同時ユーザー, ${config.testDurationMs}ms`);

    const testStartTime = Date.now();
    const userPromises: Promise<any>[] = [];
    let totalOperations = 0;
    let successfulOperations = 0;
    const responseTimes: number[] = [];

    // 同時ユーザーをシミュレート
    for (let userId = 0; userId < config.concurrentUsers; userId++) {
      const userPromise = this.simulateUser(userId, config, responseTimes).then(result => {
        totalOperations += result.totalOps;
        successfulOperations += result.successOps;
      });
      userPromises.push(userPromise);
    }

    await Promise.all(userPromises);

    const testEndTime = Date.now();
    const testDuration = testEndTime - testStartTime;

    // 結果分析
    const throughput = (successfulOperations / testDuration) * 1000; // ops/sec
    const successRate = (successfulOperations / totalOperations) * 100;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    this.addResult(
      `load-test-${config.concurrentUsers}users-throughput`,
      'Throughput',
      throughput,
      'ops/sec',
      throughput > 10 ? 'excellent' : throughput > 5 ? 'good' : 'warning'
    );

    this.addResult(
      `load-test-${config.concurrentUsers}users-success-rate`,
      'Success Rate',
      successRate,
      '%',
      successRate >= 95 ? 'excellent' : successRate >= 85 ? 'good' : 'poor'
    );

    this.addResult(
      `load-test-${config.concurrentUsers}users-response-time`,
      'Avg Response Time',
      avgResponseTime,
      'ms',
      this.evaluateQueryTime(avgResponseTime, 500)
    );
  }

  /**
   * ユーザー操作をシミュレート
   */
  private async simulateUser(userId: number, config: LoadTestConfig, responseTimes: number[]): Promise<{totalOps: number, successOps: number}> {
    let totalOps = 0;
    let successOps = 0;

    const endTime = Date.now() + config.testDurationMs;

    while (Date.now() < endTime && totalOps < config.operationsPerUser) {
      totalOps++;

      try {
        const operationStartTime = performance.now();
        
        // ランダムな操作を選択
        const operations = ['read', 'write', 'update'];
        const operation = operations[Math.floor(Math.random() * operations.length)];

        switch (operation) {
          case 'read':
            await this.supabase
              .from('posts')
              .select('*')
              .limit(config.dataSize === 'large' ? 50 : config.dataSize === 'medium' ? 20 : 10);
            break;
          
          case 'write':
            await this.supabase
              .from('posts')
              .insert({
                user_id: `load-test-user-${userId}`,
                content: `Load test post ${totalOps}`,
                is_anonymous: false
              });
            break;
          
          case 'update':
            // 既存投稿を更新（存在する場合のみ）
            await this.supabase
              .from('posts')
              .update({ content: `Updated content ${Date.now()}` })
              .eq('user_id', `load-test-user-${userId}`)
              .limit(1);
            break;
        }

        const operationEndTime = performance.now();
        responseTimes.push(operationEndTime - operationStartTime);
        successOps++;

      } catch (error) {
        // エラーは失敗としてカウント
        continue;
      }

      // 少し待機してリアルなユーザー操作をシミュレート
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    }

    // クリーンアップ（テストデータ削除）
    try {
      await this.supabase
        .from('posts')
        .delete()
        .eq('user_id', `load-test-user-${userId}`);
    } catch (error) {
      // クリーンアップエラーは無視
    }

    return { totalOps, successOps };
  }

  /**
   * メモリ使用量を取得
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    // ブラウザ環境では推定値
    return Math.round((performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0);
  }

  /**
   * クエリ時間を評価
   */
  private evaluateQueryTime(duration: number, threshold: number = 200): 'excellent' | 'good' | 'warning' | 'poor' {
    if (duration < threshold * 0.5) return 'excellent';
    if (duration < threshold) return 'good';
    if (duration < threshold * 2) return 'warning';
    return 'poor';
  }

  /**
   * 接続時間を評価
   */
  private evaluateConnectionTime(duration: number): 'excellent' | 'good' | 'warning' | 'poor' {
    if (duration < 500) return 'excellent';
    if (duration < 1000) return 'good';
    if (duration < 2000) return 'warning';
    return 'poor';
  }

  /**
   * レイテンシーを評価
   */
  private evaluateLatency(latency: number): 'excellent' | 'good' | 'warning' | 'poor' {
    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    if (latency < 800) return 'warning';
    return 'poor';
  }

  /**
   * 結果を追加
   */
  private addResult(
    test: string,
    metric: string,
    value: number,
    unit: string,
    status: 'excellent' | 'good' | 'warning' | 'poor',
    threshold?: number,
    details?: any
  ) {
    this.results.push({
      test,
      metric,
      value,
      unit,
      status,
      threshold,
      details
    });
  }

  /**
   * 結果を表示
   */
  private printResults() {
    console.log('\n📊 パフォーマンステスト結果:');
    console.log('=' .repeat(80));

    const excellent = this.results.filter(r => r.status === 'excellent').length;
    const good = this.results.filter(r => r.status === 'good').length;
    const warning = this.results.filter(r => r.status === 'warning').length;
    const poor = this.results.filter(r => r.status === 'poor').length;

    console.log(`🌟 優秀: ${excellent}`);
    console.log(`✅ 良好: ${good}`);
    console.log(`⚠️  警告: ${warning}`);
    console.log(`❌ 改善必要: ${poor}`);
    console.log(`📝 合計: ${this.results.length}`);
    console.log('');

    // カテゴリ別結果表示
    const categories = [
      'データベース',
      'リアルタイム',
      'キャッシュ',
      '並行処理',
      'メモリ',
      'ネットワーク',
      'ロードテスト'
    ];

    categories.forEach(category => {
      const categoryResults = this.results.filter(r => 
        r.test.includes(category.toLowerCase()) || 
        r.test.includes(this.getCategoryKeywords(category))
      );
      
      if (categoryResults.length > 0) {
        console.log(`\n📋 ${category}:`);
        categoryResults.forEach(result => {
          const statusIcon = this.getStatusIcon(result.status);
          console.log(`  ${statusIcon} ${result.metric}: ${result.value.toFixed(2)} ${result.unit}`);
        });
      }
    });

    // パフォーマンススコア算出
    const scoreWeights = { excellent: 4, good: 3, warning: 2, poor: 1 };
    const totalScore = this.results.reduce((sum, r) => sum + scoreWeights[r.status], 0);
    const maxScore = this.results.length * 4;
    const performanceScore = Math.round((totalScore / maxScore) * 100);

    console.log(`\n⚡ パフォーマンススコア: ${performanceScore}%`);

    if (performanceScore >= 85) {
      console.log('🎉 優秀なパフォーマンスです！');
    } else if (performanceScore >= 70) {
      console.log('✅ 良好なパフォーマンスです');
    } else if (performanceScore >= 50) {
      console.log('⚠️  パフォーマンスの改善を検討してください');
    } else {
      console.log('❌ パフォーマンスの大幅な改善が必要です');
    }
  }

  /**
   * カテゴリのキーワード取得
   */
  private getCategoryKeywords(category: string): string {
    const keywordMap: Record<string, string> = {
      'データベース': 'db',
      'リアルタイム': 'realtime',
      'キャッシュ': 'cache',
      '並行処理': 'concurrent',
      'メモリ': 'memory',
      'ネットワーク': 'network',
      'ロードテスト': 'load'
    };
    return keywordMap[category] || category.toLowerCase();
  }

  /**
   * ステータスアイコン取得
   */
  private getStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      excellent: '🌟',
      good: '✅',
      warning: '⚠️',
      poor: '❌'
    };
    return iconMap[status] || '❓';
  }

  /**
   * レポートをJSONで出力
   */
  exportReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        excellent: this.results.filter(r => r.status === 'excellent').length,
        good: this.results.filter(r => r.status === 'good').length,
        warning: this.results.filter(r => r.status === 'warning').length,
        poor: this.results.filter(r => r.status === 'poor').length,
        performanceScore: Math.round((this.results.reduce((sum, r) => {
          const weights = { excellent: 4, good: 3, warning: 2, poor: 1 };
          return sum + weights[r.status];
        }, 0) / (this.results.length * 4)) * 100)
      },
      results: this.results
    };

    return JSON.stringify(report, null, 2);
  }
}

// スクリプト実行用
async function runPerformanceTest() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 環境変数が設定されていません');
    process.exit(1);
  }

  const tester = new PerformanceTestSuite(supabaseUrl, supabaseKey);
  const results = await tester.runPerformanceTests();

  // レポート出力
  const report = tester.exportReport();
  const fs = require('fs');
  const reportPath = `performance-test-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportPath, report);
  
  console.log(`📄 詳細レポートが ${reportPath} に出力されました`);

  // 重大なパフォーマンス問題がある場合は終了コード1で終了
  const hasPoorPerformance = results.some(r => r.status === 'poor');
  process.exit(hasPoorPerformance ? 1 : 0);
}

export { runPerformanceTest };
export default PerformanceTestSuite;

// 直接実行時
if (require.main === module) {
  runPerformanceTest().catch(console.error);
}