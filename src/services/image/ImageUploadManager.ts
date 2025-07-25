/**
 * 画像アップロード管理クラス
 * 画像の選択、処理、アップロードを統合管理
 */

import * as ImagePicker from 'expo-image-picker';
import { ImageAsset, ProcessedImage, UploadResult, UploadProgress, ProcessingOptions, ImageSelectionOptions, CameraOptions, ImageError, ImageErrorType } from '../../types/image';
import { ImageProcessor } from './ImageProcessor';
import { SupabaseImageService } from './SupabaseImageService';
import { FeatureFlagsManager } from '../featureFlags';

export class ImageUploadManager {
  private imageProcessor: ImageProcessor;
  private supabaseService: SupabaseImageService;
  private featureFlags: FeatureFlagsManager;
  private uploadProgressCallbacks: Map<string, (progress: UploadProgress) => void> = new Map();

  constructor() {
    this.imageProcessor = new ImageProcessor();
    this.supabaseService = new SupabaseImageService();
    this.featureFlags = FeatureFlagsManager.getInstance();
  }

  /**
   * 画像選択（カメラまたはギャラリー）
   */
  async selectImage(source: 'camera' | 'gallery', options: ImageSelectionOptions = {}): Promise<ImageAsset[]> {
    try {
      console.log('🖼️ 画像選択開始:', { source, options });
      
      // 権限チェック
      await this.checkPermissions(source);
      
      let result: ImagePicker.ImagePickerResult;
      
      if (source === 'camera') {
        const cameraOptions: CameraOptions = {
          allowsEditing: options.allowsEditing,
          aspect: options.aspect,
          quality: options.quality || 0.8,
          saveToPhotos: false
        };
        
        result = await ImagePicker.launchCameraAsync(cameraOptions);
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: options.allowsMultipleSelection || false,
          allowsEditing: options.allowsEditing,
          aspect: options.aspect,
          quality: options.quality || 0.8
        });
      }

      if (result.canceled) {
        console.log('📱 ユーザーが画像選択をキャンセル');
        return [];
      }

      const imageAssets = result.assets.map(asset => this.convertToImageAsset(asset));
      console.log('✅ 画像選択完了:', imageAssets.length);
      
      return imageAssets;
    } catch (error) {
      console.error('❌ 画像選択エラー:', error);
      throw this.handleImageError(error, source === 'camera' ? ImageErrorType.CAMERA_UNAVAILABLE : ImageErrorType.GALLERY_UNAVAILABLE);
    }
  }

  /**
   * 画像処理
   */
  async processImage(image: ImageAsset, options: ProcessingOptions = {}): Promise<ProcessedImage> {
    try {
      console.log('⚙️ 画像処理開始:', { imageId: image.id, options });
      
      let processedImage = { ...image };
      
      // 圧縮処理
      if (options.compress !== false) {
        const compressed = await this.imageProcessor.compress(processedImage, options.compressionQuality || 0.7);
        processedImage = { ...processedImage, ...compressed };
      }
      
      // リサイズ処理
      if (options.resize) {
        const resized = await this.imageProcessor.resize(processedImage, options.resize);
        processedImage = { ...processedImage, ...resized };
      }
      
      // クロップ処理
      if (options.crop) {
        const cropped = await this.imageProcessor.crop(processedImage, options.crop);
        processedImage = { ...processedImage, ...cropped };
      }
      
      // フィルター適用
      if (options.filter) {
        const filtered = await this.imageProcessor.applyFilter(processedImage, options.filter);
        processedImage = { ...processedImage, ...filtered };
      }
      
      // メタデータ削除
      if (options.stripMetadata !== false) {
        const cleaned = await this.imageProcessor.stripMetadata(processedImage);
        processedImage = { ...processedImage, ...cleaned };
      }
      
      // サムネイル生成
      let thumbnailUri: string | undefined;
      if (options.generateThumbnail) {
        const thumbnail = await this.imageProcessor.generateThumbnail(
          processedImage, 
          options.thumbnailSize || { width: 150, height: 150 }
        );
        thumbnailUri = thumbnail.uri;
      }
      
      const result: ProcessedImage = {
        ...processedImage,
        compressed: options.compress !== false,
        compressionRatio: this.calculateCompressionRatio(image.fileSize, processedImage.fileSize),
        thumbnailUri,
        processedAt: new Date()
      };
      
      console.log('✅ 画像処理完了:', { 
        originalSize: image.fileSize, 
        processedSize: result.fileSize,
        compressionRatio: result.compressionRatio 
      });
      
      return result;
    } catch (error) {
      console.error('❌ 画像処理エラー:', error);
      throw this.handleImageError(error, ImageErrorType.PROCESSING_FAILED);
    }
  }

  /**
   * 画像アップロード
   */
  async uploadImage(image: ProcessedImage, bucket: string = 'images'): Promise<UploadResult> {
    try {
      console.log('📤 画像アップロード開始:', { imageId: image.id, bucket });
      
      // アップロード進捗の初期化
      const uploadProgress: UploadProgress = {
        id: image.id,
        status: 'pending',
        progress: 0,
        retryCount: 0
      };
      
      this.notifyProgress(uploadProgress);
      
      // アップロード実行
      uploadProgress.status = 'uploading';
      this.notifyProgress(uploadProgress);
      
      const result = await this.supabaseService.uploadImage(image, bucket, (progress) => {
        uploadProgress.progress = progress;
        this.notifyProgress(uploadProgress);
      });
      
      if (result.success) {
        uploadProgress.status = 'completed';
        uploadProgress.progress = 100;
        console.log('✅ 画像アップロード完了:', result.url);
      } else {
        uploadProgress.status = 'failed';
        uploadProgress.error = result.error;
        console.error('❌ 画像アップロード失敗:', result.error);
      }
      
      this.notifyProgress(uploadProgress);
      return result;
    } catch (error) {
      console.error('❌ 画像アップロードエラー:', error);
      throw this.handleImageError(error, ImageErrorType.UPLOAD_FAILED);
    }
  }

  /**
   * アップロード進捗取得
   */
  getUploadProgress(uploadId: string): UploadProgress | null {
    // 実装は後でRedux統合時に追加
    return null;
  }

  /**
   * アップロードキャンセル
   */
  cancelUpload(uploadId: string): void {
    console.log('🚫 アップロードキャンセル:', uploadId);
    // 実装は後でRedux統合時に追加
  }

  /**
   * 進捗コールバック登録
   */
  onUploadProgress(uploadId: string, callback: (progress: UploadProgress) => void): void {
    this.uploadProgressCallbacks.set(uploadId, callback);
  }

  /**
   * 進捗通知
   */
  private notifyProgress(progress: UploadProgress): void {
    const callback = this.uploadProgressCallbacks.get(progress.id);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * 権限チェック
   */
  private async checkPermissions(source: 'camera' | 'gallery'): Promise<void> {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('カメラの権限が必要です');
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('フォトライブラリの権限が必要です');
      }
    }
  }

  /**
   * ImagePicker.ImagePickerAssetをImageAssetに変換
   */
  private convertToImageAsset(asset: ImagePicker.ImagePickerAsset): ImageAsset {
    return {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize || 0,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || undefined,
      exif: asset.exif || undefined
    };
  }

  /**
   * 圧縮率計算
   */
  private calculateCompressionRatio(originalSize: number, compressedSize: number): number {
    return originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
  }

  /**
   * エラーハンドリング
   */
  private handleImageError(error: any, type: ImageErrorType): ImageError {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    const imageError: ImageError = {
      type,
      message,
      recoverable: this.isRecoverableError(type),
      userMessage: this.getUserFriendlyMessage(type)
    };
    
    return imageError;
  }

  /**
   * 復旧可能エラーかチェック
   */
  private isRecoverableError(type: ImageErrorType): boolean {
    const recoverableErrors = [
      ImageErrorType.NETWORK_ERROR,
      ImageErrorType.UPLOAD_FAILED,
      ImageErrorType.PROCESSING_FAILED,
      ImageErrorType.PERMISSION_DENIED
    ];
    return recoverableErrors.includes(type);
  }

  /**
   * ユーザーフレンドリーなエラーメッセージ
   */
  private getUserFriendlyMessage(type: ImageErrorType): string {
    switch (type) {
      case ImageErrorType.PERMISSION_DENIED:
        return '画像にアクセスするための権限が必要です。設定から権限を許可してください。';
      case ImageErrorType.CAMERA_UNAVAILABLE:
        return 'カメラが利用できません。デバイスのカメラ機能を確認してください。';
      case ImageErrorType.GALLERY_UNAVAILABLE:
        return 'フォトライブラリにアクセスできません。';
      case ImageErrorType.PROCESSING_FAILED:
        return '画像の処理中にエラーが発生しました。もう一度お試しください。';
      case ImageErrorType.UPLOAD_FAILED:
        return '画像のアップロードに失敗しました。ネットワーク接続を確認してください。';
      case ImageErrorType.NETWORK_ERROR:
        return 'ネットワークエラーが発生しました。接続を確認してください。';
      case ImageErrorType.STORAGE_FULL:
        return 'ストレージの容量が不足しています。';
      case ImageErrorType.INVALID_FORMAT:
        return 'サポートされていない画像形式です。';
      case ImageErrorType.FILE_TOO_LARGE:
        return 'ファイルサイズが大きすぎます。';
      default:
        return '予期しないエラーが発生しました。';
    }
  }
}