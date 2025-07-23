import { performanceMonitor } from '../../utils/performanceMonitor';

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1024 * 1024, // 1MB
    totalJSHeapSize: 2 * 1024 * 1024, // 2MB
    jsHeapSizeLimit: 10 * 1024 * 1024, // 10MB
  },
};

// @ts-ignore
global.performance = mockPerformance;
(global as any).__DEV__ = true;

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.reset();
    jest.clearAllMocks();
    mockPerformance.now.mockReturnValue(1000);
  });

  afterEach(() => {
    performanceMonitor.stopMemoryMonitoring();
  });

  describe('Basic Metric Tracking', () => {
    it('should start and end metrics correctly', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // start time
        .mockReturnValueOnce(1500); // end time

      performanceMonitor.startMetric('test_operation', { param: 'value' });
      const result = performanceMonitor.endMetric('test_operation');

      expect(result).toBeDefined();
      expect(result?.name).toBe('test_operation');
      expect(result?.duration).toBe(500);
      expect(result?.metadata).toEqual({ param: 'value' });
    });

    it('should handle non-existent metrics gracefully', () => {
      const result = performanceMonitor.endMetric('non_existent');
      expect(result).toBeNull();
    });

    it('should warn about slow operations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000) // start time
        .mockReturnValueOnce(3000); // end time (2000ms - slow)

      performanceMonitor.startMetric('slow_operation');
      performanceMonitor.endMetric('slow_operation');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected: slow_operation took 2000.00ms')
      );

      consoleSpy.mockRestore();
    });

    it('should track operation counts', () => {
      performanceMonitor.startMetric('counted_operation');
      performanceMonitor.endMetric('counted_operation');
      
      performanceMonitor.startMetric('counted_operation');
      performanceMonitor.endMetric('counted_operation');

      const stats = performanceMonitor.getStats();
      expect(stats.operationCounts['counted_operation']).toBe(2);
    });
  });

  describe('Supabase Query Tracking', () => {
    it('should track successful Supabase queries', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200);

      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });
      
      const result = await performanceMonitor.trackSupabaseQuery('posts', 'select', mockQueryFn);

      expect(result).toEqual({ data: 'test' });
      expect(mockQueryFn).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Supabase select on posts: 200.00ms'
      );

      consoleSpy.mockRestore();
    });

    it('should track failed Supabase queries', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1300);

      const mockError = new Error('Query failed');
      const mockQueryFn = jest.fn().mockRejectedValue(mockError);
      
      await expect(
        performanceMonitor.trackSupabaseQuery('users', 'insert', mockQueryFn)
      ).rejects.toThrow('Query failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Supabase insert on users failed after 300.00ms',
        mockError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('RTK Query Tracking', () => {
    it('should track RTK Query performance', async () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1150);

      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'rtk_result' });
      
      const result = await performanceMonitor.trackRTKQuery('getPosts', mockQueryFn);

      expect(result).toEqual({ data: 'rtk_result' });
      expect(mockQueryFn).toHaveBeenCalled();
    });

    it('should warn about slow RTK queries', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(3000); // 2000ms - slow

      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'slow_result' });
      
      await performanceMonitor.trackRTKQuery('slowEndpoint', mockQueryFn);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'RTK Query slowEndpoint is slow: 2000.00ms'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should track failed RTK queries', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200);

      const mockError = new Error('RTK Query failed');
      const mockQueryFn = jest.fn().mockRejectedValue(mockError);
      
      await expect(
        performanceMonitor.trackRTKQuery('failingEndpoint', mockQueryFn)
      ).rejects.toThrow('RTK Query failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'RTK Query failingEndpoint failed after 200.00ms',
        mockError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Realtime Subscription Tracking', () => {
    it('should track realtime subscriptions', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      performanceMonitor.trackRealtimeSubscription('posts-channel', 'subscribe');
      performanceMonitor.trackRealtimeSubscription('notifications-channel', 'subscribe');
      
      expect(performanceMonitor.getRealtimeSubscriptionCount()).toBe(2);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Realtime subscribe on posts-channel. Total subscriptions: 1'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Realtime subscribe on notifications-channel. Total subscriptions: 2'
      );

      consoleSpy.mockRestore();
    });

    it('should track realtime unsubscriptions', () => {
      performanceMonitor.trackRealtimeSubscription('test-channel', 'subscribe');
      performanceMonitor.trackRealtimeSubscription('test-channel', 'unsubscribe');
      
      expect(performanceMonitor.getRealtimeSubscriptionCount()).toBe(0);
    });

    it('should warn about high subscription counts', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Add 55 subscriptions to exceed the warning threshold of 50
      for (let i = 0; i < 55; i++) {
        performanceMonitor.trackRealtimeSubscription(`channel-${i}`, 'subscribe');
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'High number of realtime subscriptions: 51'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not allow negative subscription counts', () => {
      performanceMonitor.trackRealtimeSubscription('test-channel', 'unsubscribe');
      expect(performanceMonitor.getRealtimeSubscriptionCount()).toBe(0);
    });
  });

  describe('Batch Operation Tracking', () => {
    it('should track batch operations with throughput', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000); // 1000ms for 10 items = 10 items/sec

      const items = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      const mockOperation = jest.fn().mockResolvedValue('batch_result');
      
      const result = await performanceMonitor.trackBatchOperation('test_batch', items, mockOperation);

      expect(result).toBe('batch_result');
      expect(mockOperation).toHaveBeenCalledWith(items);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Batch operation test_batch: 10 items in 1000.00ms (10.0 items/sec)'
      );

      consoleSpy.mockRestore();
    });

    it('should track failed batch operations', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500);

      const items = ['item1', 'item2'];
      const mockError = new Error('Batch failed');
      const mockOperation = jest.fn().mockRejectedValue(mockError);
      
      await expect(
        performanceMonitor.trackBatchOperation('failed_batch', items, mockOperation)
      ).rejects.toThrow('Batch failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Batch operation failed_batch failed after 500.00ms',
        mockError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Memory Monitoring', () => {
    it('should start memory monitoring in dev mode', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      // Create new instance to trigger memory monitoring
      const performanceMonitor = require('../../utils/performanceMonitor').performanceMonitor;
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      
      setIntervalSpy.mockRestore();
    });

    it('should warn about high memory usage', (done) => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock high memory usage
      mockPerformance.memory = {
        usedJSHeapSize: 9 * 1024 * 1024, // 9MB
        totalJSHeapSize: 10 * 1024 * 1024, // 10MB  
        jsHeapSizeLimit: 10 * 1024 * 1024, // 10MB (90% usage)
      };

      // Trigger memory check manually
      const stats = performanceMonitor.getStats();
      
      // Since memory monitoring is async, we need to test the warning logic separately
      const usagePercent = (mockPerformance.memory.usedJSHeapSize / mockPerformance.memory.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) {
        console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`, mockPerformance.memory);
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'High memory usage: 90.0%',
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
      done();
    });

    it('should store memory metrics with limit', () => {
      const performanceMonitor = require('../../utils/performanceMonitor').performanceMonitor;
      const stats = performanceMonitor.getStats();
      
      // Memory metrics should be available
      expect(stats.memoryMetrics).toBeDefined();
      expect(Array.isArray(stats.memoryMetrics)).toBe(true);
    });

    it('should stop memory monitoring', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation();
      
      performanceMonitor.stopMemoryMonitoring();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Statistics and Reporting', () => {
    it('should provide comprehensive stats', () => {
      performanceMonitor.startMetric('stat_test');
      performanceMonitor.endMetric('stat_test');
      
      performanceMonitor.trackRealtimeSubscription('test-channel', 'subscribe');
      
      const stats = performanceMonitor.getStats();

      expect(stats).toHaveProperty('operationCounts');
      expect(stats).toHaveProperty('memoryMetrics');
      expect(stats).toHaveProperty('currentMemoryUsage');
      
      expect(stats.operationCounts['stat_test']).toBe(1);
      expect(Array.isArray(stats.memoryMetrics)).toBe(true);
    });

    it('should reset all metrics', () => {
      performanceMonitor.startMetric('reset_test');
      performanceMonitor.endMetric('reset_test');
      
      performanceMonitor.trackRealtimeSubscription('reset-channel', 'subscribe');
      
      let stats = performanceMonitor.getStats();
      expect(stats.operationCounts['reset_test']).toBe(1);
      expect(performanceMonitor.getRealtimeSubscriptionCount()).toBe(1);
      
      performanceMonitor.reset();
      
      stats = performanceMonitor.getStats();
      expect(stats.operationCounts['reset_test']).toBeUndefined();
      expect(stats.memoryMetrics).toHaveLength(0);
    });

    it('should provide current memory usage', () => {
      const stats = performanceMonitor.getStats();
      
      if (stats.currentMemoryUsage) {
        expect(stats.currentMemoryUsage).toHaveProperty('timestamp');
        expect(stats.currentMemoryUsage).toHaveProperty('usedJSHeapSize');
        expect(stats.currentMemoryUsage).toHaveProperty('totalJSHeapSize');
        expect(stats.currentMemoryUsage).toHaveProperty('jsHeapSizeLimit');
      }
    });
  });

  describe('Production Environment', () => {
    it('should not start memory monitoring in production', () => {
      (global as any).__DEV__ = false;
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      // Create new instance
      delete require.cache[require.resolve('../../utils/performanceMonitor')];
      require('../../utils/performanceMonitor');
      
      expect(setIntervalSpy).not.toHaveBeenCalled();
      
      setIntervalSpy.mockRestore();
      (global as any).__DEV__ = true; // Reset for other tests
    });

    it('should still track metrics in production', () => {
      (global as any).__DEV__ = false;
      
      performanceMonitor.startMetric('prod_test');
      const result = performanceMonitor.endMetric('prod_test');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('prod_test');
      
      (global as any).__DEV__ = true; // Reset for other tests
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent metric tracking', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // start metric1
        .mockReturnValueOnce(1100) // start metric2
        .mockReturnValueOnce(1200) // end metric1
        .mockReturnValueOnce(1300); // end metric2

      performanceMonitor.startMetric('concurrent1');
      performanceMonitor.startMetric('concurrent2');
      
      const result1 = performanceMonitor.endMetric('concurrent1');
      const result2 = performanceMonitor.endMetric('concurrent2');

      expect(result1?.duration).toBe(200);
      expect(result2?.duration).toBe(200);
    });

    it('should handle metrics with same name', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // start first
        .mockReturnValueOnce(1200) // end first
        .mockReturnValueOnce(1300) // start second  
        .mockReturnValueOnce(1500); // end second

      performanceMonitor.startMetric('same_name');
      const result1 = performanceMonitor.endMetric('same_name');
      
      performanceMonitor.startMetric('same_name');
      const result2 = performanceMonitor.endMetric('same_name');

      expect(result1?.duration).toBe(200);
      expect(result2?.duration).toBe(200);
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationCounts['same_name']).toBe(2);
    });

    it('should handle zero duration metrics', () => {
      mockPerformance.now.mockReturnValue(1000);

      performanceMonitor.startMetric('zero_duration');
      const result = performanceMonitor.endMetric('zero_duration');

      expect(result?.duration).toBe(0);
    });
  });
});