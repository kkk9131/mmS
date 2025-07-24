/**
 * 画像アップロード状態管理 Redux Slice
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ImageAsset, ProcessedImage, UploadProgress, ImageSettings, ImageError, ImageCacheState, ImageUploadState, ImageErrorType } from '../../types/image';
import { ImageUploadManager } from '../../services/image/ImageUploadManager';
import { CacheManager } from '../../services/image/CacheManager';

// 非同期アクション: 画像選択
export const selectImages = createAsyncThunk(
  'image/selectImages',
  async ({ source, options }: { source: 'camera' | 'gallery'; options?: any }, { rejectWithValue }) => {
    try {
      const manager = new ImageUploadManager();
      const images = await manager.selectImage(source, options);
      return images;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Image selection failed');
    }
  }
);

// 非同期アクション: 画像処理
export const processImage = createAsyncThunk(
  'image/processImage',
  async ({ image, options }: { image: ImageAsset; options?: any }, { rejectWithValue }) => {
    try {
      const manager = new ImageUploadManager();
      const processedImage = await manager.processImage(image, options);
      return processedImage;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Image processing failed');
    }
  }
);

// 非同期アクション: 画像アップロード
export const uploadImage = createAsyncThunk(
  'image/uploadImage',
  async ({ image, bucket }: { image: ProcessedImage; bucket?: string }, { rejectWithValue, dispatch }) => {
    try {
      const manager = new ImageUploadManager();
      
      // 進捗更新のコールバック設定
      manager.onUploadProgress(image.id, (progress) => {
        dispatch(updateUploadProgress(progress));
      });
      
      const result = await manager.uploadImage(image, bucket);
      return { imageId: image.id, result };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Image upload failed');
    }
  }
);

// 非同期アクション: キャッシュクリーンアップ
export const cleanupCache = createAsyncThunk(
  'image/cleanupCache',
  async (_, { rejectWithValue }) => {
    try {
      const cacheManager = CacheManager.getInstance();
      await cacheManager.cleanup();
      const stats = cacheManager.getCacheStats();
      return stats;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Cache cleanup failed');
    }
  }
);

// デフォルト設定
const defaultSettings: ImageSettings = {
  compressionQuality: 0.8,
  stripMetadata: true,
  generateThumbnails: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  autoCleanup: true
};

const defaultCacheState: ImageCacheState = {
  size: 0,
  maxSize: 100 * 1024 * 1024,
  itemCount: 0,
  lastCleanup: null
};

const initialState: ImageUploadState = {
  uploads: {},
  cache: defaultCacheState,
  settings: defaultSettings,
  errors: []
};

const imageSlice = createSlice({
  name: 'image',
  initialState,
  reducers: {
    // アップロード進捗更新
    updateUploadProgress: (state, action: PayloadAction<UploadProgress>) => {
      state.uploads[action.payload.id] = action.payload;
    },

    // アップロードキャンセル
    cancelUpload: (state, action: PayloadAction<string>) => {
      const uploadId = action.payload;
      if (state.uploads[uploadId]) {
        state.uploads[uploadId].status = 'failed';
        state.uploads[uploadId].error = 'User cancelled';
      }
    },

    // アップロード削除
    removeUpload: (state, action: PayloadAction<string>) => {
      delete state.uploads[action.payload];
    },

    // 全アップロードクリア
    clearUploads: (state) => {
      state.uploads = {};
    },

    // 設定更新
    updateSettings: (state, action: PayloadAction<Partial<ImageSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },

    // 設定リセット
    resetSettings: (state) => {
      state.settings = defaultSettings;
    },

    // キャッシュ状態更新
    updateCacheState: (state, action: PayloadAction<ImageCacheState>) => {
      state.cache = action.payload;
    },

    // エラー追加
    addError: (state, action: PayloadAction<ImageError>) => {
      state.errors.push(action.payload);
      // 最大10件のエラーを保持
      if (state.errors.length > 10) {
        state.errors = state.errors.slice(-10);
      }
    },

    // エラークリア
    clearErrors: (state) => {
      state.errors = [];
    },

    // 特定エラー削除
    removeError: (state, action: PayloadAction<number>) => {
      state.errors.splice(action.payload, 1);
    },

    // 圧縮品質設定
    setCompressionQuality: (state, action: PayloadAction<number>) => {
      state.settings.compressionQuality = Math.max(0.1, Math.min(1.0, action.payload));
    },

    // メタデータ削除設定
    setStripMetadata: (state, action: PayloadAction<boolean>) => {
      state.settings.stripMetadata = action.payload;
    },

    // サムネイル生成設定
    setGenerateThumbnails: (state, action: PayloadAction<boolean>) => {
      state.settings.generateThumbnails = action.payload;
    },

    // キャッシュサイズ制限設定
    setMaxCacheSize: (state, action: PayloadAction<number>) => {
      state.settings.maxCacheSize = Math.max(10 * 1024 * 1024, action.payload); // 最小10MB
      state.cache.maxSize = state.settings.maxCacheSize;
    },

    // 自動クリーンアップ設定
    setAutoCleanup: (state, action: PayloadAction<boolean>) => {
      state.settings.autoCleanup = action.payload;
    }
  },
  extraReducers: (builder) => {
    // 画像選択
    builder
      .addCase(selectImages.pending, (state) => {
        // 選択開始時の処理
      })
      .addCase(selectImages.fulfilled, (state, action) => {
        // 選択成功時の処理
        console.log('✅ 画像選択完了:', action.payload.length);
      })
      .addCase(selectImages.rejected, (state, action) => {
        // 選択失敗時の処理
        const error: ImageError = {
          type: ImageErrorType.GALLERY_UNAVAILABLE,
          message: action.payload as string,
          recoverable: true,
          userMessage: '画像の選択に失敗しました'
        };
        state.errors.push(error);
      });

    // 画像処理
    builder
      .addCase(processImage.pending, (state) => {
        // 処理開始時の処理
      })
      .addCase(processImage.fulfilled, (state, action) => {
        // 処理成功時の処理
        console.log('✅ 画像処理完了:', action.payload.id);
      })
      .addCase(processImage.rejected, (state, action) => {
        // 処理失敗時の処理
        const error: ImageError = {
          type: ImageErrorType.PROCESSING_FAILED,
          message: action.payload as string,
          recoverable: true,
          userMessage: '画像の処理に失敗しました'
        };
        state.errors.push(error);
      });

    // 画像アップロード
    builder
      .addCase(uploadImage.pending, (state, action) => {
        const imageId = action.meta.arg.image.id;
        state.uploads[imageId] = {
          id: imageId,
          status: 'pending',
          progress: 0,
          retryCount: 0
        };
      })
      .addCase(uploadImage.fulfilled, (state, action) => {
        const { imageId, result } = action.payload;
        if (state.uploads[imageId]) {
          state.uploads[imageId].status = result.success ? 'completed' : 'failed';
          state.uploads[imageId].progress = 100;
          if (!result.success) {
            state.uploads[imageId].error = result.error;
          }
        }
      })
      .addCase(uploadImage.rejected, (state, action) => {
        const imageId = action.meta.arg.image.id;
        if (state.uploads[imageId]) {
          state.uploads[imageId].status = 'failed';
          state.uploads[imageId].error = action.payload as string;
        }
        
        const error: ImageError = {
          type: ImageErrorType.UPLOAD_FAILED,
          message: action.payload as string,
          recoverable: true,
          userMessage: '画像のアップロードに失敗しました'
        };
        state.errors.push(error);
      });

    // キャッシュクリーンアップ
    builder
      .addCase(cleanupCache.fulfilled, (state, action) => {
        state.cache = action.payload;
      })
      .addCase(cleanupCache.rejected, (state, action) => {
        const error: ImageError = {
          type: ImageErrorType.STORAGE_FULL,
          message: action.payload as string,
          recoverable: true,
          userMessage: 'キャッシュのクリーンアップに失敗しました'
        };
        state.errors.push(error);
      });
  }
});

export const {
  updateUploadProgress,
  cancelUpload,
  removeUpload,
  clearUploads,
  updateSettings,
  resetSettings,
  updateCacheState,
  addError,
  clearErrors,
  removeError,
  setCompressionQuality,
  setStripMetadata,
  setGenerateThumbnails,
  setMaxCacheSize,
  setAutoCleanup
} = imageSlice.actions;

export { imageSlice };

// セレクター
export const selectUploads = (state: { image: ImageUploadState }) => state.image.uploads;
export const selectUploadById = (state: { image: ImageUploadState }, id: string) => state.image.uploads[id];
export const selectActiveUploads = (state: { image: ImageUploadState }) => 
  Object.values(state.image.uploads).filter(upload => upload.status === 'uploading' || upload.status === 'pending');
export const selectCompletedUploads = (state: { image: ImageUploadState }) => 
  Object.values(state.image.uploads).filter(upload => upload.status === 'completed');
export const selectFailedUploads = (state: { image: ImageUploadState }) => 
  Object.values(state.image.uploads).filter(upload => upload.status === 'failed');
export const selectImageSettings = (state: { image: ImageUploadState }) => state.image.settings;
export const selectCacheState = (state: { image: ImageUploadState }) => state.image.cache;
export const selectImageErrors = (state: { image: ImageUploadState }) => state.image.errors;