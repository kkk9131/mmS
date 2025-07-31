/**
 * 画像アップロードシステムの型定義
 */

export interface ImageAsset {
  id: string;
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  fileName?: string;
  exif?: ExifData;
}

export interface ProcessedImage extends ImageAsset {
  compressed: boolean;
  compressionRatio: number;
  thumbnailUri?: string;
  altText?: string;
  processedAt: Date;
}

export interface UploadProgress {
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  retryCount: number;
  estimatedTimeRemaining?: number;
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: number;
}

export interface FilterType {
  name: string;
  parameters: Record<string, any>;
  darkModeOptimized: boolean;
}

export interface ImageSettings {
  compressionQuality: number;
  stripMetadata: boolean;
  generateThumbnails: boolean;
  maxCacheSize: number;
  autoCleanup: boolean;
}

export interface ExifData {
  [key: string]: any;
}

export interface ThumbnailSize {
  width: number;
  height: number;
}

export interface CompressedImage extends ImageAsset {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface CroppedImage extends ImageAsset {
  cropData: CropData;
}

export interface FilteredImage extends ImageAsset {
  appliedFilter: FilterType;
}

export interface CleanImage extends ImageAsset {
  metadataRemoved: string[];
}

export interface Thumbnail extends ImageAsset {
  originalImageId: string;
  size: ThumbnailSize;
}

export interface ImageData {
  data: string | ArrayBuffer;
  metadata: {
    size: number;
    lastAccessed: Date;
    cacheKey: string;
  };
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export enum ImageErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CAMERA_UNAVAILABLE = 'CAMERA_UNAVAILABLE',
  GALLERY_UNAVAILABLE = 'GALLERY_UNAVAILABLE',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_FULL = 'STORAGE_FULL',
  INVALID_FORMAT = 'INVALID_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE'
}

export interface ImageError {
  type: ImageErrorType;
  message: string;
  recoverable: boolean;
  retryAction?: () => Promise<void>;
  userMessage: string;
}

export interface ProcessingOptions {
  compress?: boolean;
  compressionQuality?: number;
  resize?: {
    width?: number;
    height?: number;
    preserveAspectRatio?: boolean;
  };
  crop?: CropData;
  filter?: FilterType;
  stripMetadata?: boolean;
  generateThumbnail?: boolean;
  thumbnailSize?: ThumbnailSize;
}

export interface ImageSelectionOptions {
  allowsEditing?: boolean;
  allowsMultipleSelection?: boolean;
  mediaTypes?: 'Images' | 'Videos' | 'All';
  aspect?: [number, number];
  quality?: number;
}

export interface CameraOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  saveToPhotos?: boolean;
}

export interface ImageCacheState {
  size: number;
  maxSize: number;
  itemCount: number;
  lastCleanup: Date | null;
}

export interface ImageUploadState {
  uploads: Record<string, UploadProgress>;
  cache: ImageCacheState;
  settings: ImageSettings;
  errors: ImageError[];
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ImageErrorType[];
}

// 複数画像投稿機能用の型定義
export interface ImageAssetWithCaption extends ImageAsset {
  caption?: string;
  order: number;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadProgress?: number;
}

export interface PostImage {
  id: string;
  url: string;
  caption?: string;
  order: number;
  width: number;
  height: number;
}

export interface MultipleImageUploadState {
  selectedImages: ImageAssetWithCaption[];
  uploadProgress: Record<string, UploadProgress>;
  isUploading: boolean;
  errors: ImageError[];
}

export interface MultipleImageUploadProps {
  onImagesSelected: (images: ImageAssetWithCaption[]) => void;
  onImageRemoved: (imageId: string) => void;
  selectedImages: ImageAssetWithCaption[];
  maxImages?: number;
  disabled?: boolean;
  showPreview?: boolean;
}

export interface ImagePreviewCarouselProps {
  images: ImageAssetWithCaption[];
  onImageRemove: (imageId: string) => void;
  onImageReorder: (fromIndex: number, toIndex: number) => void;
  onCaptionChange: (imageId: string, caption: string) => void;
  editable?: boolean;
}

export interface ImagePreviewThumbnailProps {
  image: ImageAssetWithCaption;
  caption?: string;
  onRemove: () => void;
  onCaptionChange: (caption: string) => void;
  onPress: () => void;
  editable?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export interface ImageCaptionInputProps {
  visible: boolean;
  image: ImageAssetWithCaption;
  initialCaption?: string;
  onSave: (caption: string) => void;
  onCancel: () => void;
  maxLength?: number;
}