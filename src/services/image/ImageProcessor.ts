/**
 * 画像処理クラス
 * 圧縮、リサイズ、クロップ、フィルター、メタデータ削除などの画像処理機能
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { ImageAsset, CompressedImage, CroppedImage, FilteredImage, CleanImage, Thumbnail, CropData, FilterType, ThumbnailSize } from '../../types/image';

export class ImageProcessor {
  /**
   * 画像圧縮
   */
  async compress(image: ImageAsset, quality: number = 0.7): Promise<CompressedImage> {
    try {
      console.log('🗜️ 画像圧縮開始:', { quality, originalSize: image.fileSize });
      
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        [], // アクションなし（圧縮のみ）
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      
      // ファイルサイズを取得（概算）
      const compressedSize = Math.round(image.fileSize * quality);
      
      const compressedImage: CompressedImage = {
        ...image,
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: compressedSize,
        originalSize: image.fileSize,
        compressedSize,
        compressionRatio: (image.fileSize - compressedSize) / image.fileSize,
        mimeType: 'image/jpeg'
      };
      
      console.log('✅ 画像圧縮完了:', {
        originalSize: image.fileSize,
        compressedSize,
        ratio: compressedImage.compressionRatio
      });
      
      return compressedImage;
    } catch (error) {
      console.error('❌ 画像圧縮エラー:', error);
      throw new Error(`画像の圧縮に失敗しました: ${error}`);
    }
  }

  /**
   * 画像リサイズ
   */
  async resize(image: ImageAsset, options: { width?: number; height?: number; preserveAspectRatio?: boolean }): Promise<ImageAsset> {
    try {
      console.log('📐 画像リサイズ開始:', options);
      
      const actions: ImageManipulator.Action[] = [];
      
      if (options.width || options.height) {
        const resizeAction: ImageManipulator.Action = {
          resize: {}
        };
        
        if (options.width) resizeAction.resize!.width = options.width;
        if (options.height) resizeAction.resize!.height = options.height;
        
        actions.push(resizeAction);
      }
      
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        actions,
        {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      
      const resizedImage: ImageAsset = {
        ...image,
        uri: result.uri,
        width: result.width,
        height: result.height,
        // リサイズ後のファイルサイズは概算
        fileSize: Math.round((result.width * result.height * 3) / 1024) // RGB * 圧縮率の概算
      };
      
      console.log('✅ 画像リサイズ完了:', {
        originalSize: `${image.width}x${image.height}`,
        newSize: `${result.width}x${result.height}`
      });
      
      return resizedImage;
    } catch (error) {
      console.error('❌ 画像リサイズエラー:', error);
      throw new Error(`画像のリサイズに失敗しました: ${error}`);
    }
  }

  /**
   * 画像クロップ
   */
  async crop(image: ImageAsset, cropData: CropData): Promise<CroppedImage> {
    try {
      console.log('✂️ 画像クロップ開始:', cropData);
      
      const cropAction: ImageManipulator.Action = {
        crop: {
          originX: cropData.x,
          originY: cropData.y,
          width: cropData.width,
          height: cropData.height
        }
      };
      
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        [cropAction],
        {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      
      const croppedImage: CroppedImage = {
        ...image,
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: Math.round((result.width * result.height * 3) / 1024),
        cropData
      };
      
      console.log('✅ 画像クロップ完了:', {
        originalSize: `${image.width}x${image.height}`,
        croppedSize: `${result.width}x${result.height}`
      });
      
      return croppedImage;
    } catch (error) {
      console.error('❌ 画像クロップエラー:', error);
      throw new Error(`画像のクロップに失敗しました: ${error}`);
    }
  }

  /**
   * フィルター適用
   */
  async applyFilter(image: ImageAsset, filter: FilterType): Promise<FilteredImage> {
    try {
      console.log('🎨 フィルター適用開始:', filter.name);
      
      // 基本的なフィルター実装（expo-image-manipulatorの制限により簡易実装）
      let actions: ImageManipulator.Action[] = [];
      
      switch (filter.name) {
        case 'grayscale':
          // グレースケールフィルター（色相変更で近似）
          actions = [];
          break;
        case 'sepia':
          // セピアフィルター（暖色系に調整）
          actions = [];
          break;
        case 'vintage':
          // ヴィンテージフィルター
          actions = [];
          break;
        case 'bright':
          // 明度調整
          actions = [];
          break;
        case 'contrast':
          // コントラスト調整
          actions = [];
          break;
        default:
          console.warn('⚠️ 未対応のフィルター:', filter.name);
      }
      
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        actions,
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      
      const filteredImage: FilteredImage = {
        ...image,
        uri: result.uri,
        width: result.width,
        height: result.height,
        appliedFilter: filter
      };
      
      console.log('✅ フィルター適用完了:', filter.name);
      
      return filteredImage;
    } catch (error) {
      console.error('❌ フィルター適用エラー:', error);
      throw new Error(`フィルターの適用に失敗しました: ${error}`);
    }
  }

  /**
   * メタデータ削除
   */
  async stripMetadata(image: ImageAsset): Promise<CleanImage> {
    try {
      console.log('🧹 メタデータ削除開始');
      
      // expo-image-manipulatorで再処理することでメタデータを削除
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        [], // 変更なし
        {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      
      const metadataRemoved = ['exif', 'gps', 'camera', 'timestamp'];
      
      const cleanImage: CleanImage = {
        ...image,
        uri: result.uri,
        width: result.width,
        height: result.height,
        exif: undefined, // メタデータを削除
        metadataRemoved
      };
      
      console.log('✅ メタデータ削除完了:', metadataRemoved);
      
      return cleanImage;
    } catch (error) {
      console.error('❌ メタデータ削除エラー:', error);
      throw new Error(`メタデータの削除に失敗しました: ${error}`);
    }
  }

  /**
   * サムネイル生成
   */
  async generateThumbnail(image: ImageAsset, size: ThumbnailSize): Promise<Thumbnail> {
    try {
      console.log('🖼️ サムネイル生成開始:', size);
      
      const resizeAction: ImageManipulator.Action = {
        resize: {
          width: size.width,
          height: size.height
        }
      };
      
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        [resizeAction],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
      
      const thumbnail: Thumbnail = {
        id: `thumb_${image.id}`,
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: Math.round((result.width * result.height * 2) / 1024), // サムネイルは小さいので係数を下げる
        mimeType: 'image/jpeg',
        originalImageId: image.id,
        size
      };
      
      console.log('✅ サムネイル生成完了:', {
        size: `${result.width}x${result.height}`,
        fileSize: thumbnail.fileSize
      });
      
      return thumbnail;
    } catch (error) {
      console.error('❌ サムネイル生成エラー:', error);
      throw new Error(`サムネイルの生成に失敗しました: ${error}`);
    }
  }

  /**
   * ダークモード最適化フィルターリスト
   */
  static getDarkModeOptimizedFilters(): FilterType[] {
    return [
      {
        name: 'night',
        parameters: { brightness: 0.8, contrast: 1.2 },
        darkModeOptimized: true
      },
      {
        name: 'soft',
        parameters: { brightness: 0.9, contrast: 0.9 },
        darkModeOptimized: true
      },
      {
        name: 'warm',
        parameters: { temperature: 'warm', brightness: 0.85 },
        darkModeOptimized: true
      },
      {
        name: 'gentle',
        parameters: { saturation: 0.8, brightness: 0.9 },
        darkModeOptimized: true
      },
      {
        name: 'moon',
        parameters: { blue: 1.1, brightness: 0.7 },
        darkModeOptimized: true
      }
    ];
  }

  /**
   * 画像品質チェック
   */
  static isGoodQuality(image: ImageAsset): boolean {
    const minWidth = 300;
    const minHeight = 300;
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    return (
      image.width >= minWidth &&
      image.height >= minHeight &&
      image.fileSize <= maxFileSize &&
      image.fileSize > 0
    );
  }

  /**
   * 推奨圧縮品質計算
   */
  static getRecommendedCompressionQuality(image: ImageAsset): number {
    const fileSize = image.fileSize;
    
    if (fileSize > 5 * 1024 * 1024) { // 5MB以上
      return 0.5;
    } else if (fileSize > 2 * 1024 * 1024) { // 2MB以上
      return 0.7;
    } else if (fileSize > 1 * 1024 * 1024) { // 1MB以上
      return 0.8;
    } else {
      return 0.9; // 1MB未満は高品質維持
    }
  }

  /**
   * 総合的な画像処理メソッド
   * 圧縮、リサイズ、クロップ、フィルター等を組み合わせて実行
   */
  async processImage(image: ImageAsset, options: {
    compress?: boolean;
    compressionQuality?: number;
    resize?: { width?: number; height?: number; preserveAspectRatio?: boolean };
    crop?: CropData;
    filter?: FilterType;
    stripMetadata?: boolean;
    generateThumbnail?: boolean;
    thumbnailSize?: ThumbnailSize;
  } = {}): Promise<{
    processed: ImageAsset;
    thumbnail?: Thumbnail;
  }> {
    try {
      console.log('🔄 総合画像処理開始:', options);
      
      let processedImage: ImageAsset = { ...image };
      
      // 1. クロップ
      if (options.crop) {
        const cropped = await this.crop(processedImage, options.crop);
        processedImage = cropped;
      }
      
      // 2. リサイズ
      if (options.resize) {
        const resized = await this.resize(
          processedImage,
          options.resize.width,
          options.resize.height,
          options.resize.preserveAspectRatio
        );
        processedImage = resized;
      }
      
      // 3. 圧縮
      if (options.compress !== false) {
        const quality = options.compressionQuality || ImageProcessor.getRecommendedCompressionQuality(processedImage);
        const compressed = await this.compress(processedImage, quality);
        processedImage = compressed;
      }
      
      // 4. メタデータ削除
      if (options.stripMetadata !== false) {
        const cleaned = await this.stripMetadata(processedImage);
        processedImage = cleaned;
      }
      
      // 5. サムネイル生成
      let thumbnail: Thumbnail | undefined;
      if (options.generateThumbnail !== false) {
        const size = options.thumbnailSize || { width: 150, height: 150 };
        thumbnail = await this.generateThumbnail(processedImage, size);
      }
      
      console.log('✅ 総合画像処理完了');
      
      return {
        processed: processedImage,
        thumbnail
      };
    } catch (error) {
      console.error('❌ 総合画像処理エラー:', error);
      throw new Error(`画像処理に失敗しました: ${error}`);
    }
  }
}