/**
 * リアルタイム機能パフォーマンステスト
 * 同時接続数とメッセージ配信性能を検証
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

interface RealtimeTestResult {
  test: string;
  connectionCount: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  messagesSent: number;
  messagesReceived: number;
  successRate: number;
  throughput: number;
  connectionErrors: number;
  status: 'excellent' | 'good' | 'warning' | 'poor';
}

class RealtimePerformanceTester {
  private supabaseUrl: string;
  private supabaseKey: string;
  private results: RealtimeTestResult[] = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  /**
   * リアルタイムパフォーマンステストを実行
   */
  async runRealtimePerformanceTests(): Promise<RealtimeTestResult[]> {
    console.log('⚡ リアルタイム機能パフォーマンステストを開始...\n');

    // 段階的に負荷を増加
    const testConfigs = [
      { connections: 5, duration: 30000, messagesPerSecond: 2 },
      { connections: 10, duration: 60000, messagesPerSecond: 5 },
      { connections: 20, duration: 90000, messagesPerSecond: 10 },
      { connections: 50, duration: 120000, messagesPerSecond: 20 }
    ];

    for (const config of testConfigs) {
      await this.runConnectionLoadTest(config);
      // テスト間に少し待機
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await this.testMessageBroadcastPerformance();
    await this.testSubscriptionResilience();
    await this.testMemoryLeaksInRealtime();

    this.printResults();
    return this.results;
  }

  /**
   * 接続負荷テスト
   */
  private async runConnectionLoadTest(config: {
    connections: number;
    duration: number;
    messagesPerSecond: number;
  }) {
    console.log(`📊 接続負荷テスト: ${config.connections} 同時接続, ${config.duration}ms`);

    const clients: any[] = [];
    const channels: any[] = [];
    const connectionTimes: number[] = [];
    const messageTimes: number[] = [];
    let messagesSent = 0;
    let messagesReceived = 0;
    let connectionErrors = 0;

    try {
      // 複数クライアント接続
      for (let i = 0; i < config.connections; i++) {
        const connectionStartTime = performance.now();
        
        try {
          const client = createClient<Database>(this.supabaseUrl, this.supabaseKey);
          clients.push(client);

          const channel = client
            .channel(`load-test-${i}`)
            .on('postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'posts' },
              (payload) => {
                const receiveTime = performance.now();
                const sendTime = payload.new?.created_at ? 
                  new Date(payload.new.created_at).getTime() : receiveTime;
                messageTimes.push(receiveTime - sendTime);
                messagesReceived++;
              }
            )
            .on('broadcast', { event: 'test-message' }, (payload) => {
              const receiveTime = performance.now();
              messageTimes.push(receiveTime - payload.timestamp);
              messagesReceived++;
            });

          await new Promise<void>((resolve, reject) => {
            channel.subscribe((status, error) => {
              const connectionTime = performance.now() - connectionStartTime;
              connectionTimes.push(connectionTime);

              if (status === 'SUBSCRIBED') {
                resolve();
              } else if (error) {
                connectionErrors++;
                reject(error);
              }
            });
          });

          channels.push(channel);

        } catch (error) {
          connectionErrors++;
          console.error(`接続エラー (client ${i}):`, error);
        }
      }

      console.log(`✅ ${clients.length} / ${config.connections} クライアント接続完了`);

      // メッセージ送信テスト
      const testStartTime = Date.now();
      const messageInterval = 1000 / config.messagesPerSecond;

      const sendMessages = async () => {
        while (Date.now() - testStartTime < config.duration) {
          try {
            // ブロードキャストメッセージ送信
            if (channels.length > 0) {
              const randomChannel = channels[Math.floor(Math.random() * channels.length)];
              await randomChannel.send({
                type: 'broadcast',
                event: 'test-message',
                payload: { timestamp: performance.now(), messageId: messagesSent }
              });
              messagesSent++;
            }

            // データベース変更によるリアルタイム更新
            if (messagesSent % 5 === 0) { // 5回に1回はDB更新
              const client = clients[0]; // 最初のクライアントでDB操作
              await client.from('posts').insert({
                user_id: `realtime-test-${messagesSent}`,
                content: `Realtime test message ${messagesSent}`,
                is_anonymous: false
              });
            }

            await new Promise(resolve => setTimeout(resolve, messageInterval));
          } catch (error) {
            console.error('メッセージ送信エラー:', error);
          }
        }
      };

      await sendMessages();

      // 結果待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 結果計算
      const avgLatency = messageTimes.length > 0 ? 
        messageTimes.reduce((a, b) => a + b) / messageTimes.length : 0;
      const maxLatency = messageTimes.length > 0 ? Math.max(...messageTimes) : 0;
      const minLatency = messageTimes.length > 0 ? Math.min(...messageTimes) : 0;
      const successRate = messagesSent > 0 ? (messagesReceived / messagesSent) * 100 : 0;
      const throughput = messagesReceived / (config.duration / 1000);

      this.results.push({
        test: `connection-load-${config.connections}`,
        connectionCount: config.connections,
        avgLatency,
        maxLatency,
        minLatency,
        messagesSent,
        messagesReceived,
        successRate,
        throughput,
        connectionErrors,
        status: this.evaluatePerformance(avgLatency, successRate, connectionErrors)
      });

    } finally {
      // クリーンアップ
      for (const channel of channels) {
        try {
          await channel.unsubscribe();
        } catch (error) {
          // クリーンアップエラーは無視
        }
      }

      // テストデータ削除
      if (clients.length > 0) {
        try {
          await clients[0]
            .from('posts')
            .delete()
            .like('user_id', 'realtime-test-%');
        } catch (error) {
          // クリーンアップエラーは無視
        }
      }
    }
  }

  /**
   * メッセージブロードキャスト性能テスト
   */
  private async testMessageBroadcastPerformance() {
    console.log('📡 メッセージブロードキャスト性能をテスト中...');

    const client = createClient<Database>(this.supabaseUrl, this.supabaseKey);
    const receivedMessages: { id: number; timestamp: number; receiveTime: number }[] = [];
    
    const channel = client
      .channel('broadcast-performance-test')
      .on('broadcast', { event: 'performance-test' }, (payload) => {
        receivedMessages.push({
          id: payload.id,
          timestamp: payload.timestamp,
          receiveTime: performance.now()
        });
      });

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve();
        }
      });
    });

    // 大量メッセージ送信テスト
    const messageCount = 100;
    const sendStartTime = performance.now();

    for (let i = 0; i < messageCount; i++) {
      const timestamp = performance.now();
      await channel.send({
        type: 'broadcast',
        event: 'performance-test',
        payload: { id: i, timestamp }
      });

      // 少し間隔をあける
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const sendEndTime = performance.now();
    const sendDuration = sendEndTime - sendStartTime;

    // 受信完了を待機
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 結果分析
    const receivedCount = receivedMessages.length;
    const latencies = receivedMessages.map(msg => msg.receiveTime - msg.timestamp);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const successRate = (receivedCount / messageCount) * 100;
    const throughput = receivedCount / (sendDuration / 1000);

    this.results.push({
      test: 'broadcast-performance',
      connectionCount: 1,
      avgLatency,
      maxLatency,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      messagesSent: messageCount,
      messagesReceived: receivedCount,
      successRate,
      throughput,
      connectionErrors: 0,
      status: this.evaluatePerformance(avgLatency, successRate, 0)
    });

    await channel.unsubscribe();
  }

  /**
   * 接続復旧性テスト
   */
  private async testSubscriptionResilience() {
    console.log('🔄 接続復旧性をテスト中...');

    const client = createClient<Database>(this.supabaseUrl, this.supabaseKey);
    let reconnectCount = 0;
    let messagesReceived = 0;
    const latencies: number[] = [];

    const channel = client
      .channel('resilience-test')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          messagesReceived++;
          const receiveTime = performance.now();
          if (payload.new?.created_at) {
            const sendTime = new Date(payload.new.created_at).getTime();
            latencies.push(receiveTime - sendTime);
          }
        }
      );

    // 接続状態監視
    channel.subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR') {
        reconnectCount++;
        console.log('接続エラーが発生、再接続中...');
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 接続中断をシミュレート
    const testMessages = 20;
    let messagesSent = 0;

    for (let i = 0; i < testMessages; i++) {
      try {
        await client.from('posts').insert({
          user_id: `resilience-test-${i}`,
          content: `Resilience test message ${i}`,
          is_anonymous: false
        });
        messagesSent++;

        // 途中で接続を一時的に中断する効果をシミュレート
        if (i === Math.floor(testMessages / 2)) {
          await channel.unsubscribe();
          await new Promise(resolve => setTimeout(resolve, 100));
          await channel.subscribe();
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('メッセージ送信エラー:', error);
      }
    }

    // 結果待機
    await new Promise(resolve => setTimeout(resolve, 2000));

    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0;
    const successRate = messagesSent > 0 ? (messagesReceived / messagesSent) * 100 : 0;

    this.results.push({
      test: 'subscription-resilience',
      connectionCount: 1,
      avgLatency,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      messagesSent,
      messagesReceived,
      successRate,
      throughput: messagesReceived / 10, // 10秒間での throughput
      connectionErrors: reconnectCount,
      status: this.evaluateResilience(successRate, reconnectCount)
    });

    // クリーンアップ
    await channel.unsubscribe();
    await client.from('posts').delete().like('user_id', 'resilience-test-%');
  }

  /**
   * リアルタイムでのメモリリークテスト
   */
  private async testMemoryLeaksInRealtime() {
    console.log('🧠 リアルタイム接続でのメモリリークをテスト中...');

    const initialMemory = this.getMemoryUsage();
    const clients: any[] = [];
    const channels: any[] = [];

    try {
      // 複数の接続を作成・破棄を繰り返す
      for (let cycle = 0; cycle < 5; cycle++) {
        console.log(`メモリテストサイクル ${cycle + 1}/5`);

        // 接続作成
        for (let i = 0; i < 10; i++) {
          const client = createClient<Database>(this.supabaseUrl, this.supabaseKey);
          const channel = client
            .channel(`memory-test-${cycle}-${i}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {});

          await channel.subscribe();
          clients.push(client);
          channels.push(channel);
        }

        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 接続破棄
        for (const channel of channels.splice(0, 10)) {
          await channel.unsubscribe();
        }

        // ガベージコレクション（可能な場合）
        if (global.gc) {
          global.gc();
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const finalMemory = this.getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      this.results.push({
        test: 'realtime-memory-leak',
        connectionCount: 50, // 総接続数
        avgLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        messagesSent: 0,
        messagesReceived: 0,
        successRate: 100,
        throughput: 0,
        connectionErrors: 0,
        status: memoryIncrease < 20 ? 'excellent' : memoryIncrease < 50 ? 'good' : 'warning'
      });

      console.log(`メモリ使用量変化: ${memoryIncrease}MB`);

    } finally {
      // 残りのリソースをクリーンアップ
      for (const channel of channels) {
        try {
          await channel.unsubscribe();
        } catch (error) {
          // クリーンアップエラーは無視
        }
      }
    }
  }

  /**
   * パフォーマンスを評価
   */
  private evaluatePerformance(
    avgLatency: number, 
    successRate: number, 
    connectionErrors: number
  ): 'excellent' | 'good' | 'warning' | 'poor' {
    if (avgLatency > 2000 || successRate < 70 || connectionErrors > 5) return 'poor';
    if (avgLatency > 1000 || successRate < 85 || connectionErrors > 2) return 'warning';
    if (avgLatency > 500 || successRate < 95 || connectionErrors > 0) return 'good';
    return 'excellent';
  }

  /**
   * 復旧性を評価
   */
  private evaluateResilience(
    successRate: number,
    reconnectCount: number
  ): 'excellent' | 'good' | 'warning' | 'poor' {
    if (successRate < 60) return 'poor';
    if (successRate < 80 || reconnectCount > 3) return 'warning';
    if (successRate < 95 || reconnectCount > 1) return 'good';
    return 'excellent';
  }

  /**
   * メモリ使用量を取得
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return Math.round((performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0);
  }

  /**
   * 結果を表示
   */
  private printResults() {
    console.log('\n📊 リアルタイムパフォーマンステスト結果:');
    console.log('=' .repeat(80));

    for (const result of this.results) {
      const statusIcon = this.getStatusIcon(result.status);
      console.log(`\n${statusIcon} ${result.test.toUpperCase()}`);
      console.log(`  同時接続数: ${result.connectionCount}`);
      console.log(`  平均レイテンシー: ${result.avgLatency.toFixed(2)}ms`);
      console.log(`  最大レイテンシー: ${result.maxLatency.toFixed(2)}ms`);
      console.log(`  成功率: ${result.successRate.toFixed(1)}%`);
      console.log(`  スループット: ${result.throughput.toFixed(2)} msg/sec`);
      console.log(`  接続エラー: ${result.connectionErrors}`);
    }

    // 総合評価
    const excellentCount = this.results.filter(r => r.status === 'excellent').length;
    const goodCount = this.results.filter(r => r.status === 'good').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;
    const poorCount = this.results.filter(r => r.status === 'poor').length;

    console.log('\n📈 総合評価:');
    console.log(`🌟 優秀: ${excellentCount}`);
    console.log(`✅ 良好: ${goodCount}`);
    console.log(`⚠️  警告: ${warningCount}`);
    console.log(`❌ 改善必要: ${poorCount}`);

    const overallScore = (excellentCount * 4 + goodCount * 3 + warningCount * 2 + poorCount * 1) / (this.results.length * 4) * 100;
    console.log(`\n⚡ リアルタイムパフォーマンススコア: ${overallScore.toFixed(1)}%`);

    if (overallScore >= 85) {
      console.log('🎉 リアルタイム機能のパフォーマンスは優秀です！');
    } else if (overallScore >= 70) {
      console.log('✅ リアルタイム機能のパフォーマンスは良好です');
    } else {
      console.log('⚠️  リアルタイム機能の最適化を検討してください');
    }
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
        overallScore: (this.results.reduce((sum, r) => {
          const weights = { excellent: 4, good: 3, warning: 2, poor: 1 };
          return sum + weights[r.status];
        }, 0) / (this.results.length * 4)) * 100
      },
      results: this.results
    };

    return JSON.stringify(report, null, 2);
  }
}

// スクリプト実行用
async function runRealtimePerformanceTest() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 環境変数が設定されていません');
    process.exit(1);
  }

  const tester = new RealtimePerformanceTester(supabaseUrl, supabaseKey);
  const results = await tester.runRealtimePerformanceTests();

  // レポート出力
  const report = tester.exportReport();
  const fs = require('fs');
  const reportPath = `realtime-performance-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportPath, report);
  
  console.log(`📄 詳細レポートが ${reportPath} に出力されました`);

  // パフォーマンス問題がある場合は終了コード1で終了
  const hasPerformanceIssues = results.some(r => r.status === 'poor' || r.status === 'warning');
  process.exit(hasPerformanceIssues ? 1 : 0);
}

export { runRealtimePerformanceTest };
export default RealtimePerformanceTester;

// 直接実行時
if (require.main === module) {
  runRealtimePerformanceTest().catch(console.error);
}