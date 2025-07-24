import { SecurityEvent, SecurityMetrics } from './types';

interface SecurityAlert {
  level: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  userId?: string;
  deviceId: string;
  actionRequired: boolean;
  autoResolved: boolean;
}

interface ThresholdConfig {
  maxRefreshesPerHour: number;
  maxFailedValidationsPerHour: number;
  maxTokenAgeHours: number;
  suspiciousActivityWindow: number; // minutes
  rapidRefreshThreshold: number; // refreshes per minute
}

export class TokenSecurityMonitor {
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private alertThresholds: ThresholdConfig;
  private alertCallbacks: ((alert: SecurityAlert) => void)[] = [];
  private deviceId: string;

  constructor(
    deviceId: string,
    thresholds?: Partial<ThresholdConfig>
  ) {
    this.deviceId = deviceId;
    this.alertThresholds = {
      maxRefreshesPerHour: 10,
      maxFailedValidationsPerHour: 5,
      maxTokenAgeHours: 24,
      suspiciousActivityWindow: 5,
      rapidRefreshThreshold: 3,
      ...thresholds,
    };

    // 定期的なクリーンアップ（24時間後に古いイベントを削除）
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000); // 1時間ごと
  }

  logSecurityEvent(event: SecurityEvent): void {
    // デバイスIDを自動設定
    const eventWithDevice: SecurityEvent = {
      ...event,
      deviceId: event.deviceId || this.deviceId,
      timestamp: event.timestamp || new Date(),
    };

    this.events.push(eventWithDevice);
    
    console.log(`Security event logged: ${eventWithDevice.type} - ${JSON.stringify(eventWithDevice.details)}`);

    // 異常検知を実行
    this.analyzeEvent(eventWithDevice);

    // イベント数制限（最新1000件を保持）
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  getSecurityMetrics(timeframe?: { start: Date; end: Date }): SecurityMetrics {
    const relevantEvents = this.getEventsInTimeframe(timeframe);
    
    const totalRefreshes = relevantEvents.filter(e => e.type === 'token_refresh').length;
    const failedValidations = relevantEvents.filter(e => e.type === 'token_validation_failed').length;
    const suspiciousActivities = relevantEvents.filter(e => e.type === 'suspicious_activity').length;

    // 平均トークン生存時間の計算
    const refreshEvents = relevantEvents.filter(e => e.type === 'token_refresh');
    let averageTokenLifetime = 0;
    
    if (refreshEvents.length > 1) {
      const lifetimes = [];
      for (let i = 1; i < refreshEvents.length; i++) {
        const lifetime = refreshEvents[i].timestamp.getTime() - refreshEvents[i - 1].timestamp.getTime();
        lifetimes.push(lifetime);
      }
      averageTokenLifetime = lifetimes.reduce((sum, time) => sum + time, 0) / lifetimes.length;
    }

    return {
      totalRefreshes,
      failedValidations,
      suspiciousActivities,
      averageTokenLifetime,
    };
  }

  detectAnomalousActivity(userId: string): boolean {
    const recentEvents = this.getRecentEvents(this.alertThresholds.suspiciousActivityWindow);
    const userEvents = recentEvents.filter(e => e.userId === userId);

    // 異常パターンの検出
    const hasRapidRefreshes = this.analyzeRefreshPatterns(userId);
    const hasRapidTokenUsage = this.checkRapidTokenUsage(userId);
    const hasUnusualFailures = this.checkUnusualValidationFailures(userId);

    if (hasRapidRefreshes || hasRapidTokenUsage || hasUnusualFailures) {
      this.triggerSecurityAlert({
        level: 'medium',
        type: 'anomalous_activity',
        message: `異常なアクティビティが検出されました: ユーザー ${userId}`,
        timestamp: new Date(),
        userId,
        deviceId: this.deviceId,
        actionRequired: true,
        autoResolved: false,
      });
      return true;
    }

    return false;
  }

  private analyzeEvent(event: SecurityEvent): void {
    switch (event.type) {
      case 'token_refresh':
        this.analyzeRefreshEvent(event);
        break;
      case 'token_validation_failed':
        this.analyzeValidationFailure(event);
        break;
      case 'token_expired':
        this.analyzeTokenExpiry(event);
        break;
      case 'suspicious_activity':
        this.analyzeSuspiciousActivity(event);
        break;
    }
  }

  private analyzeRefreshEvent(event: SecurityEvent): void {
    if (!event.userId) return;

    // 過去1時間のリフレッシュ回数をチェック
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRefreshes = this.events.filter(e =>
      e.type === 'token_refresh' &&
      e.userId === event.userId &&
      e.timestamp > oneHourAgo
    );

    if (recentRefreshes.length > this.alertThresholds.maxRefreshesPerHour) {
      this.triggerSecurityAlert({
        level: 'high',
        type: 'excessive_token_refresh',
        message: `過度なトークンリフレッシュが検出されました: ${recentRefreshes.length}回/時間`,
        timestamp: new Date(),
        userId: event.userId,
        deviceId: event.deviceId,
        actionRequired: true,
        autoResolved: false,
      });
    }

    // 急速なリフレッシュパターンをチェック
    const rapidRefreshes = this.checkRapidRefreshPattern(event.userId);
    if (rapidRefreshes) {
      this.triggerSecurityAlert({
        level: 'medium',
        type: 'rapid_token_refresh',
        message: '短時間での連続トークンリフレッシュが検出されました',
        timestamp: new Date(),
        userId: event.userId,
        deviceId: event.deviceId,
        actionRequired: false,
        autoResolved: false,
      });
    }
  }

  private analyzeValidationFailure(event: SecurityEvent): void {
    if (!event.userId) return;

    // 過去1時間の検証失敗回数をチェック
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFailures = this.events.filter(e =>
      e.type === 'token_validation_failed' &&
      e.userId === event.userId &&
      e.timestamp > oneHourAgo
    );

    if (recentFailures.length > this.alertThresholds.maxFailedValidationsPerHour) {
      this.triggerSecurityAlert({
        level: 'high',
        type: 'excessive_validation_failures',
        message: `過度なトークン検証失敗が検出されました: ${recentFailures.length}回/時間`,
        timestamp: new Date(),
        userId: event.userId,
        deviceId: event.deviceId,
        actionRequired: true,
        autoResolved: false,
      });
    }
  }

  private analyzeTokenExpiry(event: SecurityEvent): void {
    // トークンの期限切れパターンを分析
    const details = event.details;
    if (details && details.tokenAge) {
      const ageHours = details.tokenAge / (1000 * 60 * 60);
      
      if (ageHours > this.alertThresholds.maxTokenAgeHours) {
        this.triggerSecurityAlert({
          level: 'low',
          type: 'old_token_detected',
          message: `古いトークンが検出されました: ${ageHours.toFixed(1)}時間`,
          timestamp: new Date(),
          userId: event.userId,
          deviceId: event.deviceId,
          actionRequired: false,
          autoResolved: true,
        });
      }
    }
  }

  private analyzeSuspiciousActivity(event: SecurityEvent): void {
    this.triggerSecurityAlert({
      level: 'critical',
      type: 'suspicious_activity_detected',
      message: `疑わしいアクティビティが報告されました: ${JSON.stringify(event.details)}`,
      timestamp: new Date(),
      userId: event.userId,
      deviceId: event.deviceId,
      actionRequired: true,
      autoResolved: false,
    });
  }

  private analyzeRefreshPatterns(userId: string): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const refreshEvents = this.events.filter(e =>
      e.type === 'token_refresh' &&
      e.userId === userId &&
      e.timestamp > oneHourAgo
    );

    // 一定時間内の異常なリフレッシュパターンを検出
    return refreshEvents.length > this.alertThresholds.maxRefreshesPerHour;
  }

  private checkRapidTokenUsage(userId: string): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEvents = this.events.filter(e =>
      e.userId === userId &&
      e.timestamp > fiveMinutesAgo
    );

    // 5分間に10回以上のイベントは異常
    return recentEvents.length > 10;
  }

  private checkUnusualValidationFailures(userId: string): boolean {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const validationFailures = this.events.filter(e =>
      e.type === 'token_validation_failed' &&
      e.userId === userId &&
      e.timestamp > thirtyMinutesAgo
    );

    // 30分間に3回以上の検証失敗は異常
    return validationFailures.length > 3;
  }

  private checkRapidRefreshPattern(userId: string): boolean {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const rapidRefreshes = this.events.filter(e =>
      e.type === 'token_refresh' &&
      e.userId === userId &&
      e.timestamp > twoMinutesAgo
    );

    return rapidRefreshes.length >= this.alertThresholds.rapidRefreshThreshold;
  }

  private triggerSecurityAlert(alert: SecurityAlert): void {
    this.alerts.push(alert);
    
    console.warn(`Security Alert [${alert.level.toUpperCase()}]: ${alert.message}`);

    // アラートコールバックを実行
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });

    // アラート数制限（最新500件を保持）
    if (this.alerts.length > 500) {
      this.alerts = this.alerts.slice(-500);
    }

    // 自動解決の処理
    if (alert.autoResolved) {
      setTimeout(() => {
        this.resolveAlert(alert);
      }, 5 * 60 * 1000); // 5分後に自動解決
    }
  }

  private resolveAlert(alert: SecurityAlert): void {
    const index = this.alerts.findIndex(a => 
      a.timestamp === alert.timestamp && a.type === alert.type
    );
    if (index > -1) {
      this.alerts[index] = { ...alert, autoResolved: true };
      console.log(`Alert auto-resolved: ${alert.type}`);
    }
  }

  private getEventsInTimeframe(timeframe?: { start: Date; end: Date }): SecurityEvent[] {
    if (!timeframe) {
      return this.events;
    }

    return this.events.filter(e =>
      e.timestamp >= timeframe.start && e.timestamp <= timeframe.end
    );
  }

  private getRecentEvents(minutes: number): SecurityEvent[] {
    const timeAgo = new Date(Date.now() - minutes * 60 * 1000);
    return this.events.filter(e => e.timestamp > timeAgo);
  }

  private cleanupOldEvents(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const initialCount = this.events.length;
    
    this.events = this.events.filter(e => e.timestamp > oneDayAgo);
    
    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old security events`);
    }
  }

  // パブリックメソッド
  addAlertCallback(callback: (alert: SecurityAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  removeAlertCallback(callback: (alert: SecurityAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  getAlerts(level?: SecurityAlert['level']): SecurityAlert[] {
    if (level) {
      return this.alerts.filter(a => a.level === level);
    }
    return [...this.alerts];
  }

  getActiveAlerts(): SecurityAlert[] {
    return this.alerts.filter(a => !a.autoResolved);
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  updateThresholds(newThresholds: Partial<ThresholdConfig>): void {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
  }

  getThresholds(): ThresholdConfig {
    return { ...this.alertThresholds };
  }

  exportSecurityReport(timeframe?: { start: Date; end: Date }): {
    summary: SecurityMetrics;
    events: SecurityEvent[];
    alerts: SecurityAlert[];
    recommendations: string[];
  } {
    const events = this.getEventsInTimeframe(timeframe);
    const summary = this.getSecurityMetrics(timeframe);
    const alerts = timeframe 
      ? this.alerts.filter(a => 
          (!timeframe.start || a.timestamp >= timeframe.start) &&
          (!timeframe.end || a.timestamp <= timeframe.end)
        )
      : this.alerts;

    // 推奨事項の生成
    const recommendations = this.generateRecommendations(summary, alerts);

    return {
      summary,
      events,
      alerts,
      recommendations,
    };
  }

  private generateRecommendations(metrics: SecurityMetrics, alerts: SecurityAlert[]): string[] {
    const recommendations: string[] = [];

    if (metrics.failedValidations > 10) {
      recommendations.push('トークン検証失敗が多発しています。認証フローを確認してください。');
    }

    if (metrics.totalRefreshes > 50) {
      recommendations.push('トークンリフレッシュが頻繁です。トークン有効期限の見直しを検討してください。');
    }

    const criticalAlerts = alerts.filter(a => a.level === 'critical').length;
    if (criticalAlerts > 0) {
      recommendations.push('重大なセキュリティアラートが発生しています。即座に対応してください。');
    }

    if (metrics.averageTokenLifetime < 30 * 60 * 1000) { // 30分未満
      recommendations.push('トークンの平均生存時間が短すぎます。設定を確認してください。');
    }

    return recommendations;
  }
}