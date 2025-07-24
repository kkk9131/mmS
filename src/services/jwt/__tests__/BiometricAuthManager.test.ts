import { BiometricAuthManager } from '../BiometricAuthManager';

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

describe('BiometricAuthManager', () => {
  let biometricManager: BiometricAuthManager;
  
  beforeEach(() => {
    biometricManager = new BiometricAuthManager({
      enableFingerprint: true,
      enableFaceID: true,
      fallbackToPassword: true,
      promptMessage: 'Test prompt',
      cancelButtonText: 'Cancel',
      fallbackLabel: 'Use Password',
      disableDeviceFallback: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when biometric is available', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);

      const isAvailable = await biometricManager.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return false when hardware not available', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);

      const isAvailable = await biometricManager.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should return false when biometrics not enrolled', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(false);

      const isAvailable = await biometricManager.isAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return supported authentication types', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([1, 2]); // Fingerprint and Face

      const types = await biometricManager.getSupportedTypes();
      expect(types).toEqual(['fingerprint', 'faceID']);
    });

    it('should return empty array on error', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.supportedAuthenticationTypesAsync.mockRejectedValue(new Error('Test error'));

      const types = await biometricManager.getSupportedTypes();
      expect(types).toEqual([]);
    });
  });

  describe('authenticate', () => {
    it('should return success when authentication succeeds', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([1]); // Fingerprint
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true });

      const result = await biometricManager.authenticate('Test reason');
      
      expect(result.success).toBe(true);
      expect(result.biometricType).toBe('fingerprint');
    });

    it('should return failure when authentication fails', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'UserCancel',
      });

      const result = await biometricManager.authenticate('Test reason');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('キャンセル');
      expect(result.cancelled).toBe(true);
    });

    it('should return failure when biometric not available', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(false);

      const result = await biometricManager.authenticate('Test reason');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('利用できません');
      expect(result.biometricType).toBe('none');
    });
  });

  describe('enableBiometric', () => {
    it('should enable biometric when available and test passes', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true });

      const result = await biometricManager.enableBiometric();
      expect(result).toBe(true);
    });

    it('should throw error when biometric not available', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(false);

      await expect(biometricManager.enableBiometric()).rejects.toThrow('利用できません');
    });
  });

  describe('getBiometricInfo', () => {
    it('should return complete biometric information', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([2]); // Face ID

      const info = await biometricManager.getBiometricInfo();
      
      expect(info.isAvailable).toBe(true);
      expect(info.hasHardware).toBe(true);
      expect(info.isEnrolled).toBe(true);
      expect(info.supportedTypes).toEqual(['faceID']);
      expect(info.securityLevel).toBe('strong');
    });

    it('should return safe defaults on error', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockRejectedValue(new Error('Test error'));

      const info = await biometricManager.getBiometricInfo();
      
      expect(info.isAvailable).toBe(false);
      expect(info.hasHardware).toBe(false);
      expect(info.isEnrolled).toBe(false);
      expect(info.supportedTypes).toEqual([]);
      expect(info.securityLevel).toBe('none');
    });
  });

  describe('testBiometricAuthentication', () => {
    it('should return complete test results', async () => {
      const mockLocalAuth = require('expo-local-authentication');
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true });

      const testResult = await biometricManager.testBiometricAuthentication();
      
      expect(testResult.hardwareSupport).toBe(true);
      expect(testResult.enrolledBiometrics).toBe(true);
      expect(testResult.authenticationTest.success).toBe(true);
      expect(testResult.supportedTypes).toEqual(['fingerprint']);
    });
  });
});