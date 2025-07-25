import { FeatureFlagsManager } from '@/services/featureFlags';

describe('FeatureFlagsManager', () => {
  let featureFlags: FeatureFlagsManager;

  beforeEach(() => {
    featureFlags = FeatureFlagsManager.getInstance();
    featureFlags.resetFlags();
  });

  describe('initialization', () => {
    it('should be a singleton', () => {
      const instance1 = FeatureFlagsManager.getInstance();
      const instance2 = FeatureFlagsManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should load default flags based on environment', () => {
      const flags = featureFlags.getAllFlags();
      
      expect(flags).toHaveProperty('USE_API');
      expect(flags).toHaveProperty('DEBUG_MODE');
      expect(flags).toHaveProperty('MOCK_DELAY');
      expect(typeof flags.USE_API).toBe('boolean');
      expect(typeof flags.DEBUG_MODE).toBe('boolean');
      expect(typeof flags.MOCK_DELAY).toBe('number');
    });
  });

  describe('flag management', () => {
    it('should get individual flags', () => {
      const useApi = featureFlags.getFlag('USE_API');
      const debugMode = featureFlags.getFlag('DEBUG_MODE');
      const mockDelay = featureFlags.getFlag('MOCK_DELAY');

      expect(typeof useApi).toBe('boolean');
      expect(typeof debugMode).toBe('boolean');
      expect(typeof mockDelay).toBe('number');
    });

    it('should set individual flags', () => {
      featureFlags.setFlag('USE_API', true);
      featureFlags.setFlag('DEBUG_MODE', false);
      featureFlags.setFlag('MOCK_DELAY', 1000);

      expect(featureFlags.getFlag('USE_API')).toBe(true);
      expect(featureFlags.getFlag('DEBUG_MODE')).toBe(false);
      expect(featureFlags.getFlag('MOCK_DELAY')).toBe(1000);
    });

    it('should update multiple flags', () => {
      const updates = {
        USE_API: false,
        DEBUG_MODE: true,
        MOCK_DELAY: 500,
      };

      featureFlags.updateFlags(updates);
      const allFlags = featureFlags.getAllFlags();

      expect(allFlags.USE_API).toBe(false);
      expect(allFlags.DEBUG_MODE).toBe(true);
      expect(allFlags.MOCK_DELAY).toBe(500);
    });

    it('should reset flags to defaults', () => {
      featureFlags.setFlag('USE_API', true);
      featureFlags.setFlag('DEBUG_MODE', false);
      featureFlags.setFlag('MOCK_DELAY', 1000);

      featureFlags.resetFlags();
      const flags = featureFlags.getAllFlags();

      expect(flags.USE_API).toBeDefined();
      expect(flags.DEBUG_MODE).toBeDefined();
      expect(flags.MOCK_DELAY).toBeDefined();
    });
  });

  describe('convenience methods', () => {
    it('should enable API mode', () => {
      featureFlags.enableApiMode();

      expect(featureFlags.isApiEnabled()).toBe(true);
      expect(featureFlags.isDebugModeEnabled()).toBe(false);
      expect(featureFlags.getMockDelay()).toBe(0);
    });

    it('should enable mock mode', () => {
      featureFlags.enableMockMode();

      expect(featureFlags.isApiEnabled()).toBe(false);
      expect(featureFlags.isDebugModeEnabled()).toBe(true);
      expect(featureFlags.getMockDelay()).toBe(500);
    });

    it('should enable debug mode', () => {
      featureFlags.enableDebugMode();
      expect(featureFlags.isDebugModeEnabled()).toBe(true);
    });

    it('should disable debug mode', () => {
      featureFlags.enableDebugMode();
      expect(featureFlags.isDebugModeEnabled()).toBe(true);

      featureFlags.disableDebugMode();
      expect(featureFlags.isDebugModeEnabled()).toBe(false);
    });

    it('should check if API is enabled', () => {
      featureFlags.setFlag('USE_API', true);
      expect(featureFlags.isApiEnabled()).toBe(true);

      featureFlags.setFlag('USE_API', false);
      expect(featureFlags.isApiEnabled()).toBe(false);
    });

    it('should get mock delay', () => {
      featureFlags.setFlag('MOCK_DELAY', 750);
      expect(featureFlags.getMockDelay()).toBe(750);
    });
  });
});