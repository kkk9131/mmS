// Core Performance Management
export { performanceManager, PerformanceManager } from './PerformanceManager';
export { PerformanceConfig, PerformanceMetrics } from './types';

// Rendering Optimization
export { renderingOptimizer, RenderingOptimizer } from './RenderingOptimizer';
export { withPerformanceOptimization, useRenderTimeTracker } from './RenderingOptimizer';

// List Optimization
export { listOptimizer, ListOptimizer } from './ListOptimizer';
export { useOptimizedList } from './ListOptimizer';

// Memory Optimization
export { memoryOptimizer, MemoryOptimizer } from './MemoryOptimizer';
export { useMemoryOptimization } from './MemoryOptimizer';

// Performance Monitoring
export { performanceMonitor, PerformanceMonitor } from './PerformanceMonitor';
export { usePerformanceMonitoring } from './PerformanceMonitor';

// Background Processing
export { backgroundOptimizer, BackgroundOptimizer } from './BackgroundOptimizer';
export { TaskPriority, useBackgroundOptimization } from './BackgroundOptimizer';

// Infinite Scroll Optimization
export { InfiniteScrollOptimizer, useInfiniteScrollOptimization } from './InfiniteScrollOptimizer';

// Battery & Hardware Optimization
export { batteryOptimizer, BatteryOptimizer } from './BatteryOptimizer';
export { PowerSaveMode, useBatteryOptimization } from './BatteryOptimizer';

// Analytics & Reporting
export { analyticsReporter, AnalyticsReporter } from './AnalyticsReporter';
export { ReportType, useAnalyticsReporter } from './AnalyticsReporter';

// Device Adaptation
export { deviceAdaptationManager, DeviceAdaptationManager } from './DeviceAdaptationManager';
export { DevicePerformanceCategory, useDeviceAdaptation } from './DeviceAdaptationManager';

// User Experience Prioritization
export { userExperiencePrioritizer, UserExperiencePrioritizer } from './UserExperiencePrioritizer';
export { UXPriorityLevel, UXControlPolicy, useUserExperiencePriorizer } from './UserExperiencePrioritizer';

// Performance Testing
export { performanceTestFramework, PerformanceTestFramework } from './PerformanceTestFramework';
export { TestType } from './PerformanceTestFramework';

/**
 * パフォーマンス最適化システムの統合初期化
 */
export const initializePerformanceSystem = async (): Promise<void> => {
  console.log('パフォーマンス最適化システムを初期化中...');
  
  try {
    // コアシステムの初期化
    const { performanceManager } = await import('./PerformanceManager');
    await performanceManager.initialize();
    
    // 各最適化システムの開始
    const { backgroundOptimizer } = await import('./BackgroundOptimizer');
    const { batteryOptimizer } = await import('./BatteryOptimizer');
    const { deviceAdaptationManager } = await import('./DeviceAdaptationManager');
    const { userExperiencePrioritizer } = await import('./UserExperiencePrioritizer');
    const { analyticsReporter } = await import('./AnalyticsReporter');
    
    // backgroundOptimizer.startOptimization?.(); // メソッドが存在しない
    batteryOptimizer.startOptimization();
    deviceAdaptationManager.startAdaptation();
    userExperiencePrioritizer.startPrioritization();
    analyticsReporter.startCollection();
    
    console.log('✅ パフォーマンス最適化システムの初期化が完了しました');
  } catch (error) {
    console.error('❌ パフォーマンス最適化システムの初期化に失敗:', error);
    throw error;
  }
};

/**
 * パフォーマンス最適化システムのクリーンアップ
 */
export const cleanupPerformanceSystem = async (): Promise<void> => {
  console.log('パフォーマンス最適化システムをクリーンアップ中...');
  
  try {
    const { analyticsReporter } = await import('./AnalyticsReporter');
    const { userExperiencePrioritizer } = await import('./UserExperiencePrioritizer');
    const { deviceAdaptationManager } = await import('./DeviceAdaptationManager');
    const { batteryOptimizer } = await import('./BatteryOptimizer');
    const { backgroundOptimizer } = await import('./BackgroundOptimizer');
    const { performanceMonitor } = await import('./PerformanceMonitor');
    const { memoryOptimizer } = await import('./MemoryOptimizer');
    
    analyticsReporter.stopCollection();
    userExperiencePrioritizer.stopPrioritization();
    deviceAdaptationManager.stopAdaptation();
    batteryOptimizer.stopOptimization();
    backgroundOptimizer.stopAllTasks();
    performanceMonitor.stopMonitoring();
    memoryOptimizer.stopMemoryMonitoring();
    
    console.log('✅ パフォーマンス最適化システムのクリーンアップが完了しました');
  } catch (error) {
    console.error('❌ パフォーマンス最適化システムのクリーンアップに失敗:', error);
  }
};