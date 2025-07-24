/**
 * Supabase画像ストレージサービス
 * Supabase Storageを使用した画像アップロード・管理機能
 */

import { ProcessedImage, UploadResult } from '../../types/image';
import { SupabaseClientManager } from '../supabase/client';

export class SupabaseImageService {
  private bucketName: string = 'images';

  /**
   * 画像アップロード
   */
  async uploadImage(
    image: ProcessedImage, 
    bucket: string = this.bucketName,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      console.log('📤 Supabase画像アップロード開始:', { imageId: image.id, bucket });
      
      // ユーザーIDを取得
      const manager = SupabaseClientManager.getInstance();
      
      // Supabaseクライアントの初期化を確認
      if (!manager.isInitialized()) {
        console.log('🔧 Supabaseクライアント初期化開始');
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase環境変数が設定されていません');
          }
          
          manager.initialize({
            url: supabaseUrl,
            anonKey: supabaseKey,
            debug: true
          });
        } catch (error) {
          console.error('❌ Supabase初期化エラー:', error);
          throw new Error('Supabase接続の初期化に失敗しました');
        }
      }
      
      const client = manager.getClient();
      
      if (!client) {
        throw new Error('Supabase client not initialized');
      }
      
      const currentUser = await manager.getCurrentUser();
      const userId = currentUser?.id || 'anonymous';
      
      console.log('📤 ユーザー情報:', { userId, hasUser: !!currentUser });
      
      // ファイル名生成（ユニークな名前）
      const fileName = this.generateFileName(image);
      const filePath = bucket === 'avatars' 
        ? `${userId}/${fileName}`  // avatarsの場合はユーザーIDフォルダに保存
        : `uploads/${fileName}`;   // その他の場合はuploadsフォルダ
      
      // 進捗通知
      onProgress?.(10);
      
      // 画像データの準備
      const response = await fetch(image.uri);
      const blob = await response.blob();
      
      onProgress?.(30);
      
      // Supabase Storageにアップロード
      console.log('📤 アップロード詳細:', {
        bucket,
        filePath,
        blobSize: blob.size,
        mimeType: image.mimeType,
        userId
      });
      
      const { data, error } = await client.storage
        .from(bucket)
        .upload(filePath, blob, {
          contentType: image.mimeType,
          upsert: true  // 既存ファイルがある場合は上書き
        });
      
      onProgress?.(80);
      
      if (error) {
        console.error('❌ Supabaseアップロードエラー:', error);
        console.error('エラー詳細:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error
        });
        return {
          success: false,
          error: error.message
        };
      }
      
      console.log('✅ アップロード成功:', data);
      
      // パブリックURLの取得
      const { data: urlData } = client.storage
        .from(bucket)
        .getPublicUrl(filePath);
      
      onProgress?.(100);
      
      const result: UploadResult = {
        success: true,
        url: urlData.publicUrl,
        path: filePath
      };
      
      console.log('✅ Supabase画像アップロード完了:', {
        url: result.url,
        path: result.path,
        fullUrl: urlData.publicUrl
      });
      
      // データベースに画像情報を保存
      await this.saveImageMetadata(image, result);
      
      return result;
    } catch (error) {
      console.error('❌ Supabase画像アップロードエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 画像URL取得
   */
  getImageUrl(path: string, bucket: string = this.bucketName): string {
    const manager = SupabaseClientManager.getInstance();
    const client = manager.getClient();
    
    const { data } = client.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  /**
   * 画像削除
   */
  async deleteImage(path: string, bucket: string = this.bucketName): Promise<void> {
    try {
      console.log('🗑️ 画像削除開始:', path);
      
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { error } = await client.storage
        .from(bucket)
        .remove([path]);
      
      if (error) {
        console.error('❌ 画像削除エラー:', error);
        throw error;
      }
      
      // データベースからも削除
      await this.deleteImageMetadata(path);
      
      console.log('✅ 画像削除完了:', path);
    } catch (error) {
      console.error('❌ 画像削除エラー:', error);
      throw error;
    }
  }

  /**
   * 署名付きURL生成
   */
  async generateSignedUrl(path: string, expiresIn: number = 3600, bucket: string = this.bucketName): Promise<string> {
    try {
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      
      if (error) {
        console.error('❌ 署名付きURL生成エラー:', error);
        throw error;
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error('❌ 署名付きURL生成エラー:', error);
      throw error;
    }
  }

  /**
   * バケット一覧取得
   */
  async listBuckets(): Promise<string[]> {
    try {
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { data, error } = await client.storage.listBuckets();
      
      if (error) {
        console.error('❌ バケット一覧取得エラー:', error);
        throw error;
      }
      
      return data.map(bucket => bucket.name);
    } catch (error) {
      console.error('❌ バケット一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * ファイル一覧取得
   */
  async listFiles(folder: string = '', bucket: string = this.bucketName): Promise<any[]> {
    try {
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { data, error } = await client.storage
        .from(bucket)
        .list(folder);
      
      if (error) {
        console.error('❌ ファイル一覧取得エラー:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ ファイル一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * ストレージ使用量取得
   */
  async getStorageUsage(bucket: string = this.bucketName): Promise<number> {
    try {
      const files = await this.listFiles('', bucket);
      const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      
      return totalSize;
    } catch (error) {
      console.error('❌ ストレージ使用量取得エラー:', error);
      return 0;
    }
  }

  /**
   * ファイル名生成
   */
  private generateFileName(image: ProcessedImage): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const extension = this.getFileExtension(image.mimeType);
    
    return `${timestamp}_${random}_${image.id}.${extension}`;
  }

  /**
   * ファイル拡張子取得
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    
    return mimeToExt[mimeType] || 'jpg';
  }

  /**
   * 画像メタデータをデータベースに保存
   */
  private async saveImageMetadata(image: ProcessedImage, uploadResult: UploadResult): Promise<void> {
    try {
      // ユーザーIDを取得
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        console.warn('⚠️ ユーザーが認証されていません');
        return;
      }
      
      const imageMetadata = {
        user_id: user.id,
        storage_path: uploadResult.path,
        original_name: image.fileName,
        file_size: image.fileSize,
        mime_type: image.mimeType,
        width: image.width,
        height: image.height,
        alt_text: image.altText,
        upload_status: 'completed'
      };
      
      const { error } = await client
        .from('image_uploads')
        .insert([imageMetadata]);
      
      if (error) {
        console.error('❌ 画像メタデータ保存エラー:', error);
      } else {
        console.log('✅ 画像メタデータ保存完了');
      }
    } catch (error) {
      console.error('❌ 画像メタデータ保存エラー:', error);
    }
  }

  /**
   * 画像メタデータをデータベースから削除
   */
  private async deleteImageMetadata(storagePath: string): Promise<void> {
    try {
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { error } = await client
        .from('image_uploads')
        .delete()
        .eq('storage_path', storagePath);
      
      if (error) {
        console.error('❌ 画像メタデータ削除エラー:', error);
      } else {
        console.log('✅ 画像メタデータ削除完了');
      }
    } catch (error) {
      console.error('❌ 画像メタデータ削除エラー:', error);
    }
  }

  /**
   * バケット作成（必要に応じて）
   */
  async createBucket(bucketName: string, isPublic: boolean = true): Promise<void> {
    try {
      const manager = SupabaseClientManager.getInstance();
      const client = manager.getClient();
      
      const { error } = await client.storage.createBucket(bucketName, {
        public: isPublic
      });
      
      if (error) {
        console.error('❌ バケット作成エラー:', error);
        throw error;
      }
      
      console.log('✅ バケット作成完了:', bucketName);
    } catch (error) {
      console.error('❌ バケット作成エラー:', error);
      throw error;
    }
  }

  /**
   * アップロード制限チェック
   */
  async checkUploadLimits(fileSize: number): Promise<{ allowed: boolean; reason?: string }> {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxStorageSize = 100 * 1024 * 1024; // 100MB per user
    
    if (fileSize > maxFileSize) {
      return {
        allowed: false,
        reason: `ファイルサイズが制限を超えています（最大${maxFileSize / 1024 / 1024}MB）`
      };
    }
    
    try {
      const currentUsage = await this.getStorageUsage();
      if (currentUsage + fileSize > maxStorageSize) {
        return {
          allowed: false,
          reason: 'ストレージ容量が不足しています'
        };
      }
    } catch (error) {
      console.warn('⚠️ ストレージ使用量チェック失敗:', error);
    }
    
    return { allowed: true };
  }
}