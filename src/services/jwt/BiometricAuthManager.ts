import * as LocalAuthentication from 'expo-local-authentication';
import { JWTAuthError } from './types';

interface BiometricConfig {
  enableFingerprint: boolean;
  enableFaceID: boolean;
  fallbackToPassword: boolean;
  promptMessage: string;
  cancelButtonText: string;
  fallbackLabel: string;
  disableDeviceFallback: boolean;
}

interface BiometricResult {
  success: boolean;
  error?: string;
  biometricType?: 'fingerprint' | 'faceID' | 'iris' | 'none';
  cancelled?: boolean;
}

export class BiometricAuthManager {
  private config: BiometricConfig;
  private static instance: BiometricAuthManager | null = null;

  constructor(config?: Partial<BiometricConfig>) {
    this.config = {
      enableFingerprint: true,
      enableFaceID: true,
      fallbackToPassword: true,
      promptMessage: 'ママパースのセキュアなデータにアクセスするため、認証が必要です',
      cancelButtonText: 'キャンセル',
      fallbackLabel: 'パスワードを使用',
      disableDeviceFallback: false,
      ...config,
    };
  }

  static getInstance(config?: Partial<BiometricConfig>): BiometricAuthManager {
    if (!BiometricAuthManager.instance) {
      BiometricAuthManager.instance = new BiometricAuthManager(config);
    }
    return BiometricAuthManager.instance;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  async getSupportedTypes(): Promise<string[]> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'faceID';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'unknown';
        }
      });
    } catch (error) {
      console.error('Error getting supported biometric types:', error);
      return [];
    }
  }

  async authenticate(reason?: string): Promise<BiometricResult> {
    try {
      // 生体認証が利用可能かチェック
      if (!(await this.isAvailable())) {
        return {
          success: false,
          error: '生体認証が利用できません',
          biometricType: 'none',
        };
      }

      // 認証実行
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || this.config.promptMessage,
        cancelLabel: this.config.cancelButtonText,
        fallbackLabel: this.config.fallbackToPassword ? this.config.fallbackLabel : undefined,
        disableDeviceFallback: this.config.disableDeviceFallback,
      });

      if (result.success) {
        const supportedTypes = await this.getSupportedTypes();
        const primaryType = supportedTypes[0] as BiometricResult['biometricType'] || 'none';

        return {
          success: true,
          biometricType: primaryType,
        };
      } else {
        return this.handleAuthenticationError(result);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: `認証中にエラーが発生しました: ${error}`,
        biometricType: 'none',
      };
    }
  }

  async enableBiometric(): Promise<boolean> {
    try {
      if (!(await this.isAvailable())) {
        throw new JWTAuthError(
          '生体認証が利用できません。デバイスの設定を確認してください。',
          'BIOMETRIC_ERROR'
        );
      }

      // テスト認証を実行
      const testResult = await this.authenticate('生体認証を有効にするため認証してください');
      
      if (!testResult.success) {
        throw new JWTAuthError(
          '生体認証のテストに失敗しました',
          'BIOMETRIC_ERROR'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof JWTAuthError) {
        throw error;
      }
      throw new JWTAuthError(
        `生体認証の有効化に失敗しました: ${error}`,
        'BIOMETRIC_ERROR'
      );
    }
  }

  async disableBiometric(): Promise<void> {
    // 生体認証の無効化は設定のリセットのみ
    // 実際のセキュリティ設定はアプリの設定で管理
    console.log('Biometric authentication disabled');
  }

  async getBiometricInfo(): Promise<{
    isAvailable: boolean;
    supportedTypes: string[];
    hasHardware: boolean;
    isEnrolled: boolean;
    securityLevel: 'none' | 'weak' | 'strong';
  }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await this.getSupportedTypes();
      const isAvailable = hasHardware && isEnrolled;

      // セキュリティレベルの判定
      let securityLevel: 'none' | 'weak' | 'strong' = 'none';
      if (isAvailable) {
        if (supportedTypes.includes('faceID') || supportedTypes.includes('iris')) {
          securityLevel = 'strong';
        } else if (supportedTypes.includes('fingerprint')) {
          securityLevel = 'strong'; // 指紋も強いセキュリティとみなす
        } else {
          securityLevel = 'weak';
        }
      }

      return {
        isAvailable,
        supportedTypes,
        hasHardware,
        isEnrolled,
        securityLevel,
      };
    } catch (error) {
      console.error('Error getting biometric info:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        hasHardware: false,
        isEnrolled: false,
        securityLevel: 'none',
      };
    }
  }

  private handleAuthenticationError(result: LocalAuthentication.LocalAuthenticationResult): BiometricResult {
    if ('error' in result && result.error) {
      const errorString = String(result.error);
      switch (errorString) {
        case 'UserCancel':
          return {
            success: false,
            error: 'ユーザーによってキャンセルされました',
            cancelled: true,
            biometricType: 'none',
          };
        case 'UserFallback':
          return {
            success: false,
            error: 'フォールバック認証が選択されました',
            biometricType: 'none',
          };
        case 'SystemCancel':
          return {
            success: false,
            error: 'システムによってキャンセルされました',
            biometricType: 'none',
          };
        case 'PasscodeNotSet':
          return {
            success: false,
            error: 'デバイスにパスコードが設定されていません',
            biometricType: 'none',
          };
        case 'BiometricNotAvailable':
          return {
            success: false,
            error: '生体認証が利用できません',
            biometricType: 'none',
          };
        case 'BiometricNotEnrolled':
          return {
            success: false,
            error: '生体認証が登録されていません',
            biometricType: 'none',
          };
        case 'BiometricLockout':
          return {
            success: false,
            error: '生体認証が一時的に無効になっています',
            biometricType: 'none',
          };
        default:
          return {
            success: false,
            error: `認証エラー: ${errorString}`,
            biometricType: 'none',
          };
      }
    }

    return {
      success: false,
      error: '不明な認証エラーが発生しました',
      biometricType: 'none',
    };
  }

  private async showFallbackAuth(): Promise<boolean> {
    if (!this.config.fallbackToPassword) {
      return false;
    }

    try {
      // パスワード認証のフォールバック実装
      // 実際の実装では、パスワード入力UIを表示
      console.log('Showing password fallback authentication');
      
      // モック実装：実際にはパスワード認証UIを表示
      return new Promise((resolve) => {
        // シミュレート：2秒後にランダムな結果を返す
        setTimeout(() => {
          resolve(Math.random() > 0.5);
        }, 2000);
      });
    } catch (error) {
      console.error('Fallback authentication error:', error);
      return false;
    }
  }

  // 生体認証の設定管理
  updateConfig(newConfig: Partial<BiometricConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): BiometricConfig {
    return { ...this.config };
  }

  // デバッグ用：生体認証のテスト
  async testBiometricAuthentication(): Promise<{
    hardwareSupport: boolean;
    enrolledBiometrics: boolean;
    authenticationTest: BiometricResult;
    supportedTypes: string[];
  }> {
    try {
      const hardwareSupport = await LocalAuthentication.hasHardwareAsync();
      const enrolledBiometrics = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await this.getSupportedTypes();
      
      let authenticationTest: BiometricResult = {
        success: false,
        error: 'Test skipped',
        biometricType: 'none',
      };

      if (hardwareSupport && enrolledBiometrics) {
        authenticationTest = await this.authenticate('生体認証のテストを実行しています');
      }

      return {
        hardwareSupport,
        enrolledBiometrics,
        authenticationTest,
        supportedTypes,
      };
    } catch (error) {
      console.error('Biometric test error:', error);
      return {
        hardwareSupport: false,
        enrolledBiometrics: false,
        authenticationTest: {
          success: false,
          error: `テストエラー: ${error}`,
          biometricType: 'none',
        },
        supportedTypes: [],
      };
    }
  }
}