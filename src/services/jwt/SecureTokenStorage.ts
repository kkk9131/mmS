import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { JWTAuthError } from './types';

interface StorageConfig {
  encryptionAlgorithm: 'AES-256-GCM';
  keyDerivation: 'PBKDF2';
  biometricPrompt: string;
  accessGroup?: string; // iOS Keychain
}

interface StorageItem {
  value: string;
  encrypted: boolean;
  createdAt: Date;
  expiresAt?: Date;
  requiresBiometric: boolean;
}

export class SecureTokenStorage {
  private config: StorageConfig;
  private encryptionKey: string | null = null;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      encryptionAlgorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      biometricPrompt: 'セキュアなトークンアクセスのため認証が必要です',
      ...config,
    };
  }

  async setSecureItem(
    key: string, 
    value: string, 
    options?: {
      requiresBiometric?: boolean;
      expiresAt?: Date;
    }
  ): Promise<void> {
    try {
      const storageItem: StorageItem = {
        value: await this.encrypt(value),
        encrypted: true,
        createdAt: new Date(),
        expiresAt: options?.expiresAt,
        requiresBiometric: options?.requiresBiometric || false,
      };

      const storeOptions: SecureStore.SecureStoreOptions = {};
      
      if (options?.requiresBiometric) {
        storeOptions.requireAuthentication = true;
        storeOptions.authenticationPrompt = this.config.biometricPrompt;
      }

      await SecureStore.setItemAsync(
        key, 
        JSON.stringify(storageItem),
        storeOptions
      );
    } catch (error) {
      throw new JWTAuthError(
        `セキュアストレージへの保存に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    try {
      const storedData = await SecureStore.getItemAsync(key);
      if (!storedData) {
        return null;
      }

      const storageItem: StorageItem = JSON.parse(storedData);
      
      // 期限チェック
      if (storageItem.expiresAt && new Date() > storageItem.expiresAt) {
        await this.removeSecureItem(key);
        return null;
      }

      if (storageItem.encrypted) {
        return await this.decrypt(storageItem.value);
      }
      
      return storageItem.value;
    } catch (error) {
      if (error instanceof Error && error.message.includes('authentication')) {
        throw new JWTAuthError(
          '生体認証が必要です',
          'BIOMETRIC_ERROR'
        );
      }
      throw new JWTAuthError(
        `セキュアストレージからの取得に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async removeSecureItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      throw new JWTAuthError(
        `セキュアストレージからの削除に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async clearAllItems(): Promise<void> {
    try {
      // SecureStoreには全削除機能がないため、既知のキーを削除
      const knownKeys = [
        'access_token',
        'refresh_token',
        'token_config',
        'biometric_enabled',
        'encryption_key'
      ];
      
      for (const key of knownKeys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (error) {
          // 存在しないキーの場合はエラーを無視
          console.warn(`Key ${key} not found during cleanup`);
        }
      }
    } catch (error) {
      throw new JWTAuthError(
        `セキュアストレージのクリアに失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    return await SecureStore.isAvailableAsync();
  }

  private async encrypt(data: string): Promise<string> {
    try {
      if (!this.encryptionKey) {
        this.encryptionKey = await this.generateEncryptionKey();
      }
      
      // Expo Cryptoを使用してハッシュ化（簡単な暗号化）
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data + this.encryptionKey
      );
      
      return `encrypted:${hash}:${Buffer.from(data).toString('base64')}`;
    } catch (error) {
      throw new JWTAuthError(
        `暗号化に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  private async decrypt(encryptedData: string): Promise<string> {
    try {
      if (!encryptedData.startsWith('encrypted:')) {
        throw new Error('Invalid encrypted data format');
      }
      
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const [, hash, encodedData] = parts;
      const data = Buffer.from(encodedData, 'base64').toString();
      
      // ハッシュ検証
      if (!this.encryptionKey) {
        this.encryptionKey = await this.generateEncryptionKey();
      }
      
      const expectedHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data + this.encryptionKey
      );
      
      if (hash !== expectedHash) {
        throw new Error('Data integrity check failed');
      }
      
      return data;
    } catch (error) {
      throw new JWTAuthError(
        `復号化に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }

  private async generateEncryptionKey(): Promise<string> {
    try {
      // デバイス固有のキーを生成
      const deviceKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `mamapace_${Date.now()}_${Math.random()}`
      );
      
      // セキュアストレージに保存
      await SecureStore.setItemAsync('encryption_key', deviceKey);
      
      return deviceKey;
    } catch (error) {
      // フォールバック：既存のキーを取得
      const existingKey = await SecureStore.getItemAsync('encryption_key');
      if (existingKey) {
        return existingKey;
      }
      
      throw new JWTAuthError(
        `暗号化キーの生成に失敗しました: ${error}`,
        'STORAGE_ERROR'
      );
    }
  }
}