// パフォーマンス最適化システムの型定義

export interface PerformanceConfig {
  fpsThreshold: number;
  memoryThreshold: number;
  renderTimeThreshold: number;
  batteryOptimizationEnabled: boolean;
}

export interface PerformanceReport {
  timestamp: Date;
  fps: number;
  memoryUsage: number;
  renderTime: number;
  batterLevel: number;
  issues: PerformanceIssue[];
  recommendations: string[];
}

export interface PerformanceIssue {
  type: PerformanceErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  suggestedFix: string;
}

export enum PerformanceErrorType {
  LOW_FPS = 'LOW_FPS',
  HIGH_MEMORY_USAGE = 'HIGH_MEMORY_USAGE',
  SLOW_RENDER = 'SLOW_RENDER',
  MEMORY_LEAK = 'MEMORY_LEAK',
  BATTERY_DRAIN = 'BATTERY_DRAIN'
}

export interface PerformanceSettings {
  id: string;
  userId: string;
  renderingOptimization: {
    enabled: boolean;
    memoizationLevel: 'basic' | 'aggressive';
    rerenderThreshold: number;
  };
  listOptimization: {
    enabled: boolean;
    virtualizationEnabled: boolean;
    windowSize: number;
    maxToRenderPerBatch: number;
  };
  memoryOptimization: {
    enabled: boolean;
    imageCompressionLevel: number;
    cacheSize: number;
    garbageCollectionInterval: number;
  };
  batteryOptimization: {
    enabled: boolean;
    powerSaveMode: boolean;
    backgroundTaskLimitation: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsCollectionInterval: number;
    alertsEnabled: boolean;
  };
}

export interface PerformanceMetrics {
  fps: number[];
  renderTimes: number[];
  memoryUsage: number[];
  networkLatency: number[];
  userInteractionDelay: number[];
}

export interface PerformanceMetricsData {
  timestamp: Date;
  sessionId: string;
  userId: string;
  deviceInfo: {
    platform: string;
    version: string;
    memory: number;
    cpu: string;
  };
  metrics: {
    fps: number;
    renderTime: number;
    memoryUsage: number;
    batteryLevel: number;
    networkLatency: number;
    userInteractionDelay: number;
  };
  context: {
    screenName: string;
    userAction: string;
    dataSize: number;
  };
}

export interface DeviceCapability {
  tier: 'low' | 'medium' | 'high';
  memory: number;
  cpu: string;
  gpu: string;
}

export interface AlertThresholds {
  lowFPS: number;
  highMemoryUsage: number;
  slowRenderTime: number;
  highNetworkLatency: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}