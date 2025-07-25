/**
 * PerformanceManager のテストファイル
 * パフォーマンス最適化システムの基本機能をテスト
 */

import { PerformanceManager } from '../PerformanceManager';

// AsyncStorage のモック
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// React Native のモック
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '14.0'
  }
}));

describe('PerformanceManager', () => {
  let performanceManager: PerformanceManager;

  beforeEach(() => {
    performanceManager = PerformanceManager.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初期化', () => {
    it('シングルトンインスタンスが正しく作成される', () => {
      const instance1 = PerformanceManager.getInstance();
      const instance2 = PerformanceManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('initialize() が正常に実行される', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await performanceManager.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('初期化が完了しました')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('最適化機能の制御', () => {
    beforeEach(async () => {
      await performanceManager.initialize();
    });

    it('最適化機能を有効化できる', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      performanceManager.enableOptimizations();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('全ての最適化機能を有効化しました')
      );
      
      consoleSpy.mockRestore();
    });

    it('最適化機能を無効化できる', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      performanceManager.disableOptimizations();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('全ての最適化機能を無効化しました')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('設定管理', () => {
    beforeEach(async () => {
      await performanceManager.initialize();
    });

    it('パフォーマンス閾値を設定できる', () => {
      const newConfig = {
        fpsThreshold: 50,
        memoryThreshold: 100,
        renderTimeThreshold: 20,
        batteryOptimizationEnabled: true
      };

      performanceManager.configureThresholds(newConfig);
      
      // 内部状態は直接確認できないため、エラーが発生しないことを確認
      expect(() => performanceManager.configureThresholds(newConfig)).not.toThrow();
    });

    it('設定を取得できる', () => {
      const settings = performanceManager.getSettings();
      
      // 初期化後は設定が存在するはず
      expect(settings).toBeDefined();
      if (settings) {
        expect(settings).toHaveProperty('renderingOptimization');
        expect(settings).toHaveProperty('listOptimization');
        expect(settings).toHaveProperty('memoryOptimization');
        expect(settings).toHaveProperty('batteryOptimization');
        expect(settings).toHaveProperty('monitoring');
      }
    });
  });

  describe('パフォーマンスレポート', () => {
    beforeEach(async () => {
      await performanceManager.initialize();
    });

    it('パフォーマンスレポートを生成できる', () => {
      const report = performanceManager.getPerformanceReport();
      
      expect(report).toBeDefined();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('fps');
      expect(report).toHaveProperty('memoryUsage');
      expect(report).toHaveProperty('renderTime');
      expect(report).toHaveProperty('batterLevel');
      expect(report).toHaveProperty('issues');
      expect(report).toHaveProperty('recommendations');
      
      expect(Array.isArray(report.issues)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('パフォーマンス問題が正しく検出される', () => {
      const report = performanceManager.getPerformanceReport();
      
      // 推奨事項が含まれることを確認
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('初期化前の操作で警告が出力される', () => {
      const freshInstance = PerformanceManager.getInstance();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // 初期化前に最適化機能を有効化
      freshInstance.enableOptimizations();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('初期化されていません')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });
});