import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import { NotificationType } from './NotificationHandler';

// Timerタイプの定義
type Timer = ReturnType<typeof setInterval>;

export interface NotificationMetrics {
  deliverySuccessRate: number;
  averageDeliveryTime: number;
  errorRate: number;
  tokenInvalidationRate: number;
  userEngagementRate: number;
  dailyActiveUsers: number;
  notificationVolume: number;
}

export interface AlertConfig {
  metric: keyof NotificationMetrics;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals';
  enabled: boolean;
  cooldownMinutes: number;
}

export interface PerformanceReport {
  timestamp: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  metrics: NotificationMetrics;
  trends: {
    metric: keyof NotificationMetrics;
    change: number;
    direction: 'up' | 'down' | 'stable';
  }[];
  alerts: AlertEvent[];
  recommendations: string[];
}

export interface AlertEvent {
  id: string;
  metric: keyof NotificationMetrics;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface EngagementAnalytics {
  notificationsSent: number;
  notificationsOpened: number;
  notificationsClicked: number;
  averageTimeToOpen: number;
  openRateByType: Record<NotificationType, number>;
  clickRateByType: Record<NotificationType, number>;
  bestPerformingTimeSlots: { hour: number; engagement: number }[];
  userSegmentPerformance: {
    segment: string;
    engagement: number;
    volume: number;
  }[];
}

class NotificationMonitoringManager {
  private static instance: NotificationMonitoringManager;
  
  private readonly METRICS_KEY = '@notification_metrics';
  private readonly ALERTS_KEY = '@notification_alerts';
  private readonly ENGAGEMENT_KEY = '@notification_engagement';
  
  private readonly defaultAlertConfigs: AlertConfig[] = [
    {
      metric: 'deliverySuccessRate',
      threshold: 95,
      operator: 'less_than',
      enabled: true,
      cooldownMinutes: 30,
    },
    {
      metric: 'averageDeliveryTime',
      threshold: 5000, // 5秒
      operator: 'greater_than',
      enabled: true,
      cooldownMinutes: 15,
    },
    {
      metric: 'errorRate',
      threshold: 5,
      operator: 'greater_than',
      enabled: true,
      cooldownMinutes: 20,
    },
    {
      metric: 'tokenInvalidationRate',
      threshold: 10,
      operator: 'greater_than',
      enabled: true,
      cooldownMinutes: 60,
    },
  ];

  private alertConfigs: AlertConfig[] = [...this.defaultAlertConfigs];
  private alertCooldowns: Map<string, number> = new Map();
  private metricsCollectionInterval: Timer | null = null;

  public static getInstance(): NotificationMonitoringManager {
    if (!NotificationMonitoringManager.instance) {
      NotificationMonitoringManager.instance = new NotificationMonitoringManager();
    }
    return NotificationMonitoringManager.instance;
  }

  constructor() {
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    // 5分ごとにメトリクスを収集
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 5 * 60 * 1000);

    // アプリ起動時に即座に収集
    this.collectMetrics();
  }

  // メトリクス収集

  async collectMetrics(): Promise<NotificationMetrics> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 過去24時間

      // 並列でデータを取得
      const [
        deliveryStats,
        errorStats,
        tokenStats,
        engagementStats,
        userStats,
        volumeStats,
      ] = await Promise.all([
        this.getDeliveryStats(startTime, endTime),
        this.getErrorStats(startTime, endTime),
        this.getTokenInvalidationStats(startTime, endTime),
        this.getEngagementStats(startTime, endTime),
        this.getUserStats(startTime, endTime),
        this.getVolumeStats(startTime, endTime),
      ]);

      const metrics: NotificationMetrics = {
        deliverySuccessRate: deliveryStats.successRate,
        averageDeliveryTime: deliveryStats.averageTime,
        errorRate: errorStats.errorRate,
        tokenInvalidationRate: tokenStats.invalidationRate,
        userEngagementRate: engagementStats.engagementRate,
        dailyActiveUsers: userStats.activeUsers,
        notificationVolume: volumeStats.volume,
      };

      // メトリクスを保存
      await this.saveMetrics(metrics);

      // アラートをチェック
      await this.checkAlerts(metrics);

      console.log('メトリクス収集完了:', metrics);
      return metrics;

    } catch (error) {
      console.error('メトリクス収集エラー:', error);
      throw error;
    }
  }

  private async getDeliveryStats(startTime: Date, endTime: Date): Promise<{
    successRate: number;
    averageTime: number;
  }> {
    try {
      // Edge Functionのログやローカルメトリクスから配信統計を取得
      const metrics = await this.getStoredMetrics();
      
      // 実際の実装では、より詳細な配信ログから計算
      return {
        successRate: 95.5, // デモデータ
        averageTime: 2500, // 2.5秒
      };
    } catch (error) {
      console.error('配信統計取得エラー:', error);
      return { successRate: 0, averageTime: 0 };
    }
  }

  private async getErrorStats(startTime: Date, endTime: Date): Promise<{
    errorRate: number;
  }> {
    try {
      const { notificationErrorHandler } = await import('./ErrorHandler');
      const errorStats = await notificationErrorHandler.getErrorStats();
      
      const errorRate = errorStats.totalErrors > 0 
        ? ((errorStats.totalErrors - (errorStats.totalErrors * 0.95)) / errorStats.totalErrors) * 100
        : 0;

      return { errorRate };
    } catch (error) {
      console.error('エラー統計取得エラー:', error);
      return { errorRate: 0 };
    }
  }

  private async getTokenInvalidationStats(startTime: Date, endTime: Date): Promise<{
    invalidationRate: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('push_tokens')
        .select('id, is_active, updated_at')
        .gte('updated_at', startTime.toISOString())
        .lte('updated_at', endTime.toISOString());

      if (error) throw error;

      const totalTokens = data?.length || 0;
      const invalidatedTokens = data?.filter(token => !token.is_active).length || 0;
      
      const invalidationRate = totalTokens > 0 ? (invalidatedTokens / totalTokens) * 100 : 0;

      return { invalidationRate };
    } catch (error) {
      console.error('トークン無効化統計取得エラー:', error);
      return { invalidationRate: 0 };
    }
  }

  private async getEngagementStats(startTime: Date, endTime: Date): Promise<{
    engagementRate: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, is_read, read_at, created_at')
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (error) throw error;

      const totalNotifications = data?.length || 0;
      const readNotifications = data?.filter(n => n.is_read).length || 0;
      
      const engagementRate = totalNotifications > 0 ? (readNotifications / totalNotifications) * 100 : 0;

      return { engagementRate };
    } catch (error) {
      console.error('エンゲージメント統計取得エラー:', error);
      return { engagementRate: 0 };
    }
  }

  private async getUserStats(startTime: Date, endTime: Date): Promise<{
    activeUsers: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('user_id')
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (error) throw error;

      const uniqueUsers = new Set(data?.map(n => n.user_id) || []);
      const activeUsers = uniqueUsers.size;

      return { activeUsers };
    } catch (error) {
      console.error('ユーザー統計取得エラー:', error);
      return { activeUsers: 0 };
    }
  }

  private async getVolumeStats(startTime: Date, endTime: Date): Promise<{
    volume: number;
  }> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (error) throw error;

      return { volume: count || 0 };
    } catch (error) {
      console.error('ボリューム統計取得エラー:', error);
      return { volume: 0 };
    }
  }

  // アラート管理

  private async checkAlerts(metrics: NotificationMetrics): Promise<void> {
    const now = Date.now();
    const activeAlerts: AlertEvent[] = [];

    for (const config of this.alertConfigs) {
      if (!config.enabled) continue;

      // クールダウン中かチェック
      const cooldownKey = `${config.metric}_${config.threshold}`;
      const lastAlert = this.alertCooldowns.get(cooldownKey);
      
      if (lastAlert && now - lastAlert < config.cooldownMinutes * 60 * 1000) {
        continue; // クールダウン中
      }

      const metricValue = metrics[config.metric];
      let shouldAlert = false;

      switch (config.operator) {
        case 'greater_than':
          shouldAlert = metricValue > config.threshold;
          break;
        case 'less_than':
          shouldAlert = metricValue < config.threshold;
          break;
        case 'equals':
          shouldAlert = metricValue === config.threshold;
          break;
      }

      if (shouldAlert) {
        const alert: AlertEvent = {
          id: this.generateAlertId(),
          metric: config.metric,
          value: metricValue,
          threshold: config.threshold,
          severity: this.calculateAlertSeverity(config.metric, metricValue, config.threshold),
          timestamp: new Date().toISOString(),
          resolved: false,
        };

        activeAlerts.push(alert);
        this.alertCooldowns.set(cooldownKey, now);

        // アラート処理
        await this.handleAlert(alert);
      }
    }

    if (activeAlerts.length > 0) {
      await this.saveAlerts(activeAlerts);
    }
  }

  private calculateAlertSeverity(
    metric: keyof NotificationMetrics,
    value: number,
    threshold: number
  ): AlertEvent['severity'] {
    const deviation = Math.abs(value - threshold) / threshold;

    if (deviation > 0.5) return 'critical';
    if (deviation > 0.3) return 'high';
    if (deviation > 0.1) return 'medium';
    return 'low';
  }

  private async handleAlert(alert: AlertEvent): Promise<void> {
    console.warn(`🚨 通知システムアラート: ${alert.metric} = ${alert.value} (閾値: ${alert.threshold})`);

    // 本番環境では、以下のような処理を実装
    // - Slackやメールでの通知
    // - 自動復旧アクションの実行
    // - エスカレーション

    try {
      // Supabaseにアラートログを送信
      await supabase.functions.invoke('log-system-alert', {
        body: {
          alert,
          environment: __DEV__ ? 'development' : 'production',
        },
      });
    } catch (error) {
      console.error('アラート送信エラー:', error);
    }
  }

  // エンゲージメント分析

  async generateEngagementAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<EngagementAnalytics> {
    try {
      // 通知データの取得
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const notificationsSent = notifications?.length || 0;
      const notificationsOpened = notifications?.filter(n => n.is_read).length || 0;
      
      // クリック率の計算（read_atが存在する通知をクリックとみなす）
      const notificationsClicked = notifications?.filter(n => n.read_at).length || 0;

      // 平均開封時간の計算
      const openTimes = notifications
        ?.filter(n => n.read_at && n.created_at)
        .map(n => new Date(n.read_at).getTime() - new Date(n.created_at).getTime()) || [];
      
      const averageTimeToOpen = openTimes.length > 0
        ? openTimes.reduce((sum, time) => sum + time, 0) / openTimes.length
        : 0;

      // タイプ別開封率・クリック率
      const openRateByType: Record<NotificationType, number> = {} as any;
      const clickRateByType: Record<NotificationType, number> = {} as any;

      for (const type of Object.values(NotificationType)) {
        const typeNotifications = notifications?.filter(n => n.type === type) || [];
        const typeOpened = typeNotifications.filter(n => n.is_read).length;
        const typeClicked = typeNotifications.filter(n => n.read_at).length;
        
        openRateByType[type] = typeNotifications.length > 0 
          ? (typeOpened / typeNotifications.length) * 100 
          : 0;
        
        clickRateByType[type] = typeNotifications.length > 0
          ? (typeClicked / typeNotifications.length) * 100
          : 0;
      }

      // 時間帯別パフォーマンス
      const hourlyEngagement = new Array(24).fill(0).map((_, hour) => ({
        hour,
        sent: 0,
        opened: 0,
        engagement: 0,
      }));

      notifications?.forEach(notification => {
        const hour = new Date(notification.created_at).getHours();
        hourlyEngagement[hour].sent++;
        if (notification.is_read) {
          hourlyEngagement[hour].opened++;
        }
      });

      hourlyEngagement.forEach(slot => {
        slot.engagement = slot.sent > 0 ? (slot.opened / slot.sent) * 100 : 0;
      });

      const bestPerformingTimeSlots = hourlyEngagement
        .filter(slot => slot.sent >= 5) // 最低5件以上送信された時間帯
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5)
        .map(slot => ({ hour: slot.hour, engagement: slot.engagement }));

      return {
        notificationsSent,
        notificationsOpened,
        notificationsClicked,
        averageTimeToOpen,
        openRateByType,
        clickRateByType,
        bestPerformingTimeSlots,
        userSegmentPerformance: [], // 実装に応じて拡張
      };

    } catch (error) {
      console.error('エンゲージメント分析エラー:', error);
      throw error;
    }
  }

  // レポート生成

  async generatePerformanceReport(
    period: PerformanceReport['period'] = 'daily'
  ): Promise<PerformanceReport> {
    try {
      const endTime = new Date();
      let startTime: Date;

      switch (period) {
        case 'hourly':
          startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
          break;
        case 'daily':
          startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const [currentMetrics, historicalMetrics, alerts] = await Promise.all([
        this.collectMetrics(),
        this.getHistoricalMetrics(startTime, endTime),
        this.getRecentAlerts(startTime, endTime),
      ]);

      // トレンド分析
      const trends = this.calculateTrends(currentMetrics, historicalMetrics);

      // 推奨事項の生成
      const recommendations = this.generateRecommendations(currentMetrics, trends);

      return {
        timestamp: new Date().toISOString(),
        period,
        metrics: currentMetrics,
        trends,
        alerts,
        recommendations,
      };

    } catch (error) {
      console.error('パフォーマンスレポート生成エラー:', error);
      throw error;
    }
  }

  private calculateTrends(
    current: NotificationMetrics,
    historical: NotificationMetrics[]
  ): PerformanceReport['trends'] {
    if (historical.length === 0) return [];

    const previousAverage = this.calculateAverageMetrics(historical);
    const trends: PerformanceReport['trends'] = [];

    for (const metric of Object.keys(current) as (keyof NotificationMetrics)[]) {
      const currentValue = current[metric];
      const previousValue = previousAverage[metric];
      
      if (previousValue === 0) continue;

      const change = ((currentValue - previousValue) / previousValue) * 100;
      let direction: 'up' | 'down' | 'stable' = 'stable';

      if (Math.abs(change) > 5) { // 5%以上の変化で方向性を判定
        direction = change > 0 ? 'up' : 'down';
      }

      trends.push({
        metric,
        change: Math.round(change * 100) / 100,
        direction,
      });
    }

    return trends;
  }

  private calculateAverageMetrics(metrics: NotificationMetrics[]): NotificationMetrics {
    if (metrics.length === 0) {
      return {
        deliverySuccessRate: 0,
        averageDeliveryTime: 0,
        errorRate: 0,
        tokenInvalidationRate: 0,
        userEngagementRate: 0,
        dailyActiveUsers: 0,
        notificationVolume: 0,
      };
    }

    const sums = metrics.reduce((acc, metric) => {
      for (const key of Object.keys(metric) as (keyof NotificationMetrics)[]) {
        acc[key] = (acc[key] || 0) + metric[key];
      }
      return acc;
    }, {} as NotificationMetrics);

    const averages = {} as NotificationMetrics;
    for (const key of Object.keys(sums) as (keyof NotificationMetrics)[]) {
      averages[key] = sums[key] / metrics.length;
    }

    return averages;
  }

  private generateRecommendations(
    metrics: NotificationMetrics,
    trends: PerformanceReport['trends']
  ): string[] {
    const recommendations: string[] = [];

    // 配信成功率が低い場合
    if (metrics.deliverySuccessRate < 90) {
      recommendations.push('プッシュトークンの有効性を確認し、無効なトークンを削除してください');
    }

    // エラー率が高い場合
    if (metrics.errorRate > 5) {
      recommendations.push('エラーログを確認し、主要なエラー原因に対処してください');
    }

    // エンゲージメント率が低い場合
    if (metrics.userEngagementRate < 30) {
      recommendations.push('通知内容とタイミングを見直し、ユーザーエンゲージメントを向上させてください');
    }

    // 配信時間が長い場合
    if (metrics.averageDeliveryTime > 5000) {
      recommendations.push('ネットワーク状況を確認し、バッチサイズの最適化を検討してください');
    }

    // トレンドベースの推奨事項
    for (const trend of trends) {
      if (trend.metric === 'errorRate' && trend.direction === 'up' && trend.change > 20) {
        recommendations.push('エラー率が急激に増加しています。システムの健全性を確認してください');
      }
      
      if (trend.metric === 'userEngagementRate' && trend.direction === 'down' && trend.change < -15) {
        recommendations.push('ユーザーエンゲージメントが低下しています。通知戦略の見直しが必要です');
      }
    }

    return recommendations;
  }

  // データ保存・取得

  private async saveMetrics(metrics: NotificationMetrics): Promise<void> {
    try {
      const stored = await this.getStoredMetrics();
      const updated = {
        ...stored,
        latest: metrics,
        history: [metrics, ...(stored.history || [])].slice(0, 100), // 最新100件を保持
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('メトリクス保存エラー:', error);
    }
  }

  private async getStoredMetrics(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(this.METRICS_KEY);
      return data ? JSON.parse(data) : { history: [] };
    } catch (error) {
      console.error('メトリクス取得エラー:', error);
      return { history: [] };
    }
  }

  private async saveAlerts(alerts: AlertEvent[]): Promise<void> {
    try {
      const stored = await this.getStoredAlerts();
      const updated = [
        ...alerts,
        ...stored,
      ].slice(0, 200); // 最新200件を保持

      await AsyncStorage.setItem(this.ALERTS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('アラート保存エラー:', error);
    }
  }

  private async getStoredAlerts(): Promise<AlertEvent[]> {
    try {
      const data = await AsyncStorage.getItem(this.ALERTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('アラート取得エラー:', error);
      return [];
    }
  }

  private async getHistoricalMetrics(startTime: Date, endTime: Date): Promise<NotificationMetrics[]> {
    const stored = await this.getStoredMetrics();
    return stored.history?.filter((metric: any) => {
      const timestamp = new Date(metric.timestamp);
      return timestamp >= startTime && timestamp <= endTime;
    }) || [];
  }

  private async getRecentAlerts(startTime: Date, endTime: Date): Promise<AlertEvent[]> {
    const stored = await this.getStoredAlerts();
    return stored.filter(alert => {
      const timestamp = new Date(alert.timestamp);
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  // ユーティリティ

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 設定管理

  updateAlertConfig(config: Partial<AlertConfig> & { metric: keyof NotificationMetrics }): void {
    const index = this.alertConfigs.findIndex(c => c.metric === config.metric);
    if (index >= 0) {
      this.alertConfigs[index] = { ...this.alertConfigs[index], ...config };
    } else {
      this.alertConfigs.push({ ...config } as AlertConfig);
    }
  }

  getAlertConfigs(): AlertConfig[] {
    return [...this.alertConfigs];
  }

  // API

  async getCurrentMetrics(): Promise<NotificationMetrics> {
    const stored = await this.getStoredMetrics();
    return stored.latest || await this.collectMetrics();
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
    lastCheck: string;
  }> {
    try {
      const metrics = await this.getCurrentMetrics();
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // 健全性チェック
      if (metrics.deliverySuccessRate < 95) {
        issues.push(`配信成功率が低い: ${metrics.deliverySuccessRate}%`);
        status = 'warning';
      }

      if (metrics.errorRate > 5) {
        issues.push(`エラー率が高い: ${metrics.errorRate}%`);
        status = metrics.errorRate > 15 ? 'critical' : 'warning';
      }

      if (metrics.averageDeliveryTime > 10000) {
        issues.push(`配信時間が長い: ${metrics.averageDeliveryTime}ms`);
        status = 'warning';
      }

      return {
        status,
        issues,
        uptime: Date.now() - (this.metricsCollectionInterval ? Date.now() - 5 * 60 * 1000 : Date.now()),
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'critical',
        issues: ['システムヘルスチェックに失敗しました'],
        uptime: 0,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  // クリーンアップ

  cleanup(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
    this.alertCooldowns.clear();
    console.log('監視システムをクリーンアップしました');
  }
}

export const notificationMonitoringManager = NotificationMonitoringManager.getInstance();