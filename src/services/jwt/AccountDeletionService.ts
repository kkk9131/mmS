import { JWTAuthService } from './JWTAuthService';
import { LogoutManager } from './LogoutManager';
import { Alert } from 'react-native';

export interface DeletionConfig {
  confirmationSteps: number;
  gracePeriodDays: number;
  backupData: boolean;
  requireBiometric: boolean;
  requirePassword: boolean;
  timeoutMs: number;
}

export interface DeletionResult {
  success: boolean;
  deletedData: string[];
  backupLocation?: string;
  error?: string;
  pendingUntil?: Date;
}

export interface DeletionRequest {
  userId: string;
  reason?: string;
  confirmationCode?: string;
  timestamp: Date;
  ipAddress?: string;
  deviceInfo?: any;
}

export interface ApiClient {
  requestAccountDeletion: (request: DeletionRequest) => Promise<any>;
  confirmAccountDeletion: (confirmationCode: string) => Promise<any>;
  cancelAccountDeletion: (userId: string) => Promise<any>;
  getUserData: (userId: string) => Promise<any>;
  deleteUserData: (userId: string) => Promise<any>;
}

export class AccountDeletionService {
  private config: DeletionConfig;
  private apiClient: ApiClient;
  private jwtAuthService: JWTAuthService;
  private logoutManager: LogoutManager;
  private deletionInProgress: boolean = false;

  constructor(
    config: Partial<DeletionConfig> = {},
    apiClient?: ApiClient,
    jwtAuthService?: JWTAuthService,
    logoutManager?: LogoutManager
  ) {
    this.config = {
      confirmationSteps: 3,
      gracePeriodDays: 7,
      backupData: true,
      requireBiometric: true,
      requirePassword: true,
      timeoutMs: 30000, // 30秒
      ...config,
    };

    this.apiClient = apiClient || this.createMockApiClient();
    this.jwtAuthService = jwtAuthService || new JWTAuthService();
    this.logoutManager = logoutManager || new LogoutManager();
  }

  async requestAccountDeletion(reason?: string): Promise<DeletionResult> {
    if (this.deletionInProgress) {
      return {
        success: false,
        deletedData: [],
        error: 'Account deletion already in progress',
      };
    }

    this.deletionInProgress = true;

    try {
      console.log('Starting account deletion request...');

      // ステップ1: 削除前の確認
      const preCheckResult = await this.performPreDeletionChecks();
      if (!preCheckResult.success) {
        return preCheckResult;
      }

      // ステップ2: 多段階確認プロセス
      const confirmationResult = await this.performConfirmationSteps(reason);
      if (!confirmationResult) {
        return {
          success: false,
          deletedData: [],
          error: 'User cancelled deletion process',
        };
      }

      // ステップ3: 認証確認
      const authResult = await this.performAuthenticationCheck();
      if (!authResult.success) {
        return {
          success: false,
          deletedData: [],
          error: authResult.error || 'Authentication failed',
        };
      }

      // ステップ4: データバックアップ（必要な場合）
      let backupLocation: string | undefined;
      if (this.config.backupData) {
        try {
          backupLocation = await this.backupUserData();
          console.log('User data backed up:', backupLocation);
        } catch (backupError) {
          console.warn('Data backup failed:', backupError);
          // バックアップ失敗でも削除は続行するか確認
          const continueWithoutBackup = await this.confirmContinueWithoutBackup();
          if (!continueWithoutBackup) {
            return {
              success: false,
              deletedData: [],
              error: 'Data backup failed and user chose to cancel',
            };
          }
        }
      }

      // ステップ5: 削除リクエストをサーバーに送信
      const userId = await this.getCurrentUserId();
      const deletionRequest: DeletionRequest = {
        userId,
        reason,
        timestamp: new Date(),
        deviceInfo: await this.getDeviceInfo(),
      };

      const serverResponse = await this.apiClient.requestAccountDeletion(deletionRequest);

      // 猶予期間がある場合
      if (this.config.gracePeriodDays > 0) {
        const pendingUntil = new Date();
        pendingUntil.setDate(pendingUntil.getDate() + this.config.gracePeriodDays);

        return {
          success: true,
          deletedData: ['deletion_scheduled'],
          backupLocation,
          pendingUntil,
        };
      }

      // 即座に削除する場合
      const deletionResult = await this.executeAccountDeletion();
      return {
        ...deletionResult,
        backupLocation,
      };

    } catch (error) {
      console.error('Account deletion request failed:', error);
      return {
        success: false,
        deletedData: [],
        error: `Account deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    } finally {
      this.deletionInProgress = false;
    }
  }

  async confirmAccountDeletion(confirmationCode: string): Promise<DeletionResult> {
    try {
      console.log('Confirming account deletion with code...');

      // 確認コードを検証
      const response = await this.apiClient.confirmAccountDeletion(confirmationCode);
      
      if (!response.success) {
        return {
          success: false,
          deletedData: [],
          error: 'Invalid confirmation code',
        };
      }

      // 実際の削除処理を実行
      return await this.executeAccountDeletion();

    } catch (error) {
      console.error('Account deletion confirmation failed:', error);
      return {
        success: false,
        deletedData: [],
        error: `Confirmation failed: ${error.message}`,
      };
    }
  }

  async cancelAccountDeletion(): Promise<boolean> {
    try {
      console.log('Cancelling account deletion...');

      const userId = await this.getCurrentUserId();
      const response = await this.apiClient.cancelAccountDeletion(userId);

      if (response.success) {
        console.log('Account deletion cancelled successfully');
        return true;
      }

      console.error('Failed to cancel account deletion:', response.error);
      return false;

    } catch (error) {
      console.error('Account deletion cancellation error:', error);
      return false;
    }
  }

  private async performPreDeletionChecks(): Promise<DeletionResult> {
    try {
      // 認証状態の確認
      const accessToken = await this.jwtAuthService.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          deletedData: [],
          error: 'User not authenticated',
        };
      }

      // アカウントの状態確認
      // 例：未完了の取引、アクティブなサブスクリプションなど
      const accountStatus = await this.checkAccountStatus();
      if (accountStatus.hasBlockingIssues) {
        return {
          success: false,
          deletedData: [],
          error: `Cannot delete account: ${accountStatus.issues.join(', ')}`,
        };
      }

      return { success: true, deletedData: [] };
    } catch (error) {
      return {
        success: false,
        deletedData: [],
        error: `Pre-deletion check failed: ${error.message}`,
      };
    }
  }

  private async performConfirmationSteps(reason?: string): Promise<boolean> {
    const steps = [
      {
        title: '削除の確認',
        message: 'アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消すことができません。',
        confirmText: '理解しました',
      },
      {
        title: 'データの削除',
        message: '以下のデータが完全に削除されます：\n• プロフィール情報\n• 投稿・コメント\n• 設定・履歴\n• アプリ内のすべてのデータ',
        confirmText: '削除に同意します',
      },
      {
        title: '最終確認',
        message: reason 
          ? `削除理由: ${reason}\n\n本当にアカウントを削除しますか？`
          : '本当にアカウントを削除しますか？この操作は取り消せません。',
        confirmText: '削除を実行',
      },
    ];

    for (let i = 0; i < this.config.confirmationSteps && i < steps.length; i++) {
      const step = steps[i];
      const confirmed = await this.showConfirmationDialog(
        step.title,
        step.message,
        step.confirmText
      );

      if (!confirmed) {
        console.log(`User cancelled at confirmation step ${i + 1}`);
        return false;
      }
    }

    return true;
  }

  private async performAuthenticationCheck(): Promise<{ success: boolean; error?: string }> {
    try {
      // 生体認証が必要な場合
      if (this.config.requireBiometric) {
        const biometricResult = await this.jwtAuthService.authenticateWithBiometric();
        if (!biometricResult.success) {
          return {
            success: false,
            error: 'Biometric authentication required for account deletion',
          };
        }
      }

      // パスワード認証が必要な場合
      if (this.config.requirePassword) {
        const passwordConfirmed = await this.requestPasswordConfirmation();
        if (!passwordConfirmed) {
          return {
            success: false,
            error: 'Password confirmation required for account deletion',
          };
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Authentication check failed: ${error.message}`,
      };
    }
  }

  private async executeAccountDeletion(): Promise<DeletionResult> {
    try {
      console.log('Executing account deletion...');

      const userId = await this.getCurrentUserId();
      const deletedData: string[] = [];

      // サーバー側でユーザーデータを削除
      await this.apiClient.deleteUserData(userId);
      deletedData.push('server_data');

      // ローカルデータの削除
      await this.logoutManager.logout('force', {
        skipConfirmation: true,
        reason: 'Account deletion',
        clearBiometric: true,
      });
      deletedData.push('local_data');

      // その他のクリーンアップ
      await this.performAdditionalCleanup();
      deletedData.push('additional_data');

      console.log('Account deletion completed successfully');
      return {
        success: true,
        deletedData,
      };

    } catch (error) {
      console.error('Account deletion execution failed:', error);
      return {
        success: false,
        deletedData: [],
        error: `Deletion execution failed: ${error.message}`,
      };
    }
  }

  private async backupUserData(): Promise<string> {
    try {
      const userId = await this.getCurrentUserId();
      const userData = await this.apiClient.getUserData(userId);

      // データをJSON形式でローカルに保存
      const backupData = {
        exportDate: new Date().toISOString(),
        userId,
        data: userData,
      };

      // ファイルシステムまたはクラウドストレージに保存
      const backupLocation = `backup_${userId}_${Date.now()}.json`;
      
      // 実際の実装では、expo-file-systemやクラウドストレージAPIを使用
      console.log('Backup created:', backupLocation);
      
      return backupLocation;
    } catch (error) {
      console.error('Data backup failed:', error);
      throw error;
    }
  }

  private async showConfirmationDialog(
    title: string,
    message: string,
    confirmText: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'キャンセル',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: confirmText,
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  private async confirmContinueWithoutBackup(): Promise<boolean> {
    return this.showConfirmationDialog(
      'バックアップエラー',
      'データのバックアップに失敗しました。バックアップなしで削除を続行しますか？',
      '続行する'
    );
  }

  private async requestPasswordConfirmation(): Promise<boolean> {
    // 実際の実装では、パスワード入力ダイアログを表示
    // ここではモック実装
    return true;
  }

  private async getCurrentUserId(): Promise<string> {
    const accessToken = await this.jwtAuthService.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // JWTからユーザーIDを取得（簡易実装）
    return 'mock_user_id';
  }

  private async getDeviceInfo(): Promise<any> {
    return {
      platform: 'mobile',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkAccountStatus(): Promise<{ hasBlockingIssues: boolean; issues: string[] }> {
    // モック実装：実際のアプリでは各種チェックを実行
    return {
      hasBlockingIssues: false,
      issues: [],
    };
  }

  private async performAdditionalCleanup(): Promise<void> {
    // アプリ固有の追加クリーンアップ処理
    console.log('Performing additional cleanup...');
  }

  private createMockApiClient(): ApiClient {
    return {
      requestAccountDeletion: async (request: DeletionRequest) => {
        console.log('Mock: Account deletion requested', request);
        return { success: true, deletionId: 'mock_deletion_id' };
      },
      confirmAccountDeletion: async (confirmationCode: string) => {
        console.log('Mock: Account deletion confirmed', confirmationCode);
        return { success: true };
      },
      cancelAccountDeletion: async (userId: string) => {
        console.log('Mock: Account deletion cancelled', userId);
        return { success: true };
      },
      getUserData: async (userId: string) => {
        console.log('Mock: Getting user data', userId);
        return { id: userId, data: 'mock_user_data' };
      },
      deleteUserData: async (userId: string) => {
        console.log('Mock: Deleting user data', userId);
        return { success: true };
      },
    };
  }

  // 設定の更新
  updateConfig(config: Partial<DeletionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 削除状態の確認
  isDeletionInProgress(): boolean {
    return this.deletionInProgress;
  }
}