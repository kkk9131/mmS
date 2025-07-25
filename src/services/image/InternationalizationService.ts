/**
 * 画像システム国際化サービス
 * 多言語対応、地域設定、RTL言語サポート
 */

import { I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SupportedLanguage = 'ja' | 'en' | 'ko' | 'zh' | 'es' | 'pt' | 'ar' | 'he';

export interface LocaleSettings {
  language: SupportedLanguage;
  region: string;
  isRTL: boolean;
  dateFormat: string;
  numberFormat: string;
  currency: string;
}

export interface ImageI18nText {
  // アクション関連
  selectImage: string;
  takePhoto: string;
  chooseFromGallery: string;
  upload: string;
  save: string;
  cancel: string;
  retry: string;
  delete: string;
  edit: string;
  crop: string;
  filter: string;
  rotate: string;
  
  // 状態関連
  uploading: string;
  processing: string;
  completed: string;
  failed: string;
  loading: string;
  
  // エラーメッセージ
  permissionDenied: string;
  cameraUnavailable: string;
  galleryUnavailable: string;
  processingFailed: string;
  uploadFailed: string;
  networkError: string;
  storageFull: string;
  invalidFormat: string;
  fileTooLarge: string;
  
  // UI要素
  imageEditor: string;
  imageViewer: string;
  altTextPlaceholder: string;
  compressionQuality: string;
  aspectRatio: string;
  brightness: string;
  contrast: string;
  saturation: string;
  
  // アクセシビリティ
  imageAlt: string;
  tapToExpand: string;
  swipeToClose: string;
  pinchToZoom: string;
  doubleTapToZoom: string;
  loadingImage: string;
  imageLoadError: string;
  retryLoading: string;
  
  // プログレス
  uploadProgress: string;
  processingProgress: string;
  cacheCleanup: string;
  
  // 設定
  stripMetadata: string;
  generateThumbnails: string;
  enableCache: string;
  maxCacheSize: string;
  autoCleanup: string;
}

// 言語ごとのテキスト定義
const translations: Record<SupportedLanguage, ImageI18nText> = {
  ja: {
    // アクション関連
    selectImage: '画像を選択',
    takePhoto: '写真を撮る',
    chooseFromGallery: 'ギャラリーから選択',
    upload: 'アップロード',
    save: '保存',
    cancel: 'キャンセル',
    retry: '再試行',
    delete: '削除',
    edit: '編集',
    crop: 'クロップ',
    filter: 'フィルター',
    rotate: '回転',
    
    // 状態関連
    uploading: 'アップロード中',
    processing: '処理中',
    completed: '完了',
    failed: '失敗',
    loading: '読み込み中',
    
    // エラーメッセージ
    permissionDenied: 'カメラまたはギャラリーへのアクセス許可が必要です',
    cameraUnavailable: 'カメラが利用できません',
    galleryUnavailable: 'ギャラリーが利用できません',
    processingFailed: '画像の処理に失敗しました',
    uploadFailed: '画像のアップロードに失敗しました',
    networkError: 'ネットワークエラーが発生しました',
    storageFull: 'ストレージ容量が不足しています',
    invalidFormat: 'サポートされていない画像形式です',
    fileTooLarge: 'ファイルサイズが大きすぎます',
    
    // UI要素
    imageEditor: '画像編集',
    imageViewer: '画像ビューワー',
    altTextPlaceholder: '画像の説明を入力',
    compressionQuality: '圧縮品質',
    aspectRatio: 'アスペクト比',
    brightness: '明度',
    contrast: 'コントラスト',
    saturation: '彩度',
    
    // アクセシビリティ
    imageAlt: '画像',
    tapToExpand: 'タップして拡大',
    swipeToClose: 'スワイプして閉じる',
    pinchToZoom: 'ピンチでズーム',
    doubleTapToZoom: 'ダブルタップでズーム切替',
    loadingImage: '画像読み込み中',
    imageLoadError: '画像の読み込みに失敗しました',
    retryLoading: '再読み込み',
    
    // プログレス
    uploadProgress: 'アップロード進捗',
    processingProgress: '処理進捗',
    cacheCleanup: 'キャッシュクリーンアップ',
    
    // 設定
    stripMetadata: 'メタデータを削除',
    generateThumbnails: 'サムネイルを生成',
    enableCache: 'キャッシュを有効にする',
    maxCacheSize: '最大キャッシュサイズ',
    autoCleanup: '自動クリーンアップ'
  },
  
  en: {
    // Actions
    selectImage: 'Select Image',
    takePhoto: 'Take Photo',
    chooseFromGallery: 'Choose from Gallery',
    upload: 'Upload',
    save: 'Save',
    cancel: 'Cancel',
    retry: 'Retry',
    delete: 'Delete',
    edit: 'Edit',
    crop: 'Crop',
    filter: 'Filter',
    rotate: 'Rotate',
    
    // States
    uploading: 'Uploading',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    loading: 'Loading',
    
    // Error messages
    permissionDenied: 'Camera or gallery access permission required',
    cameraUnavailable: 'Camera is not available',
    galleryUnavailable: 'Gallery is not available',
    processingFailed: 'Failed to process image',
    uploadFailed: 'Failed to upload image',
    networkError: 'Network error occurred',
    storageFull: 'Storage space is insufficient',
    invalidFormat: 'Unsupported image format',
    fileTooLarge: 'File size is too large',
    
    // UI elements
    imageEditor: 'Image Editor',
    imageViewer: 'Image Viewer',
    altTextPlaceholder: 'Enter image description',
    compressionQuality: 'Compression Quality',
    aspectRatio: 'Aspect Ratio',
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    
    // Accessibility
    imageAlt: 'Image',
    tapToExpand: 'Tap to expand',
    swipeToClose: 'Swipe to close',
    pinchToZoom: 'Pinch to zoom',
    doubleTapToZoom: 'Double tap to toggle zoom',
    loadingImage: 'Loading image',
    imageLoadError: 'Failed to load image',
    retryLoading: 'Reload',
    
    // Progress
    uploadProgress: 'Upload Progress',
    processingProgress: 'Processing Progress',
    cacheCleanup: 'Cache Cleanup',
    
    // Settings
    stripMetadata: 'Strip Metadata',
    generateThumbnails: 'Generate Thumbnails',
    enableCache: 'Enable Cache',
    maxCacheSize: 'Max Cache Size',
    autoCleanup: 'Auto Cleanup'
  },
  
  ko: {
    // 액션 관련
    selectImage: '이미지 선택',
    takePhoto: '사진 촬영',
    chooseFromGallery: '갤러리에서 선택',
    upload: '업로드',
    save: '저장',
    cancel: '취소',
    retry: '재시도',
    delete: '삭제',
    edit: '편집',
    crop: '자르기',
    filter: '필터',
    rotate: '회전',
    
    // 상태 관련
    uploading: '업로드 중',
    processing: '처리 중',
    completed: '완료',
    failed: '실패',
    loading: '로딩 중',
    
    // 에러 메시지
    permissionDenied: '카메라 또는 갤러리 접근 권한이 필요합니다',
    cameraUnavailable: '카메라를 사용할 수 없습니다',
    galleryUnavailable: '갤러리를 사용할 수 없습니다',
    processingFailed: '이미지 처리에 실패했습니다',
    uploadFailed: '이미지 업로드에 실패했습니다',
    networkError: '네트워크 오류가 발생했습니다',
    storageFull: '저장 공간이 부족합니다',
    invalidFormat: '지원되지 않는 이미지 형식입니다',
    fileTooLarge: '파일 크기가 너무 큽니다',
    
    // UI 요소
    imageEditor: '이미지 편집기',
    imageViewer: '이미지 뷰어',
    altTextPlaceholder: '이미지 설명을 입력하세요',
    compressionQuality: '압축 품질',
    aspectRatio: '화면 비율',
    brightness: '밝기',
    contrast: '대비',
    saturation: '채도',
    
    // 접근성
    imageAlt: '이미지',
    tapToExpand: '탭하여 확대',
    swipeToClose: '스와이프하여 닫기',
    pinchToZoom: '핀치하여 줌',
    doubleTapToZoom: '더블탭하여 줌 전환',
    loadingImage: '이미지 로딩 중',
    imageLoadError: '이미지 로드에 실패했습니다',
    retryLoading: '다시 로드',
    
    // 진행률
    uploadProgress: '업로드 진행률',
    processingProgress: '처리 진행률',
    cacheCleanup: '캐시 정리',
    
    // 설정
    stripMetadata: '메타데이터 제거',
    generateThumbnails: '썸네일 생성',
    enableCache: '캐시 활성화',
    maxCacheSize: '최대 캐시 크기',
    autoCleanup: '자동 정리'
  },
  
  zh: {
    // 操作相关
    selectImage: '选择图片',
    takePhoto: '拍照',
    chooseFromGallery: '从相册选择',
    upload: '上传',
    save: '保存',
    cancel: '取消',
    retry: '重试',
    delete: '删除',
    edit: '编辑',
    crop: '裁剪',
    filter: '滤镜',
    rotate: '旋转',
    
    // 状态相关
    uploading: '上传中',
    processing: '处理中',
    completed: '完成',
    failed: '失败',
    loading: '加载中',
    
    // 错误信息
    permissionDenied: '需要相机或相册访问权限',
    cameraUnavailable: '相机不可用',
    galleryUnavailable: '相册不可用',
    processingFailed: '图片处理失败',
    uploadFailed: '图片上传失败',
    networkError: '网络错误',
    storageFull: '存储空间不足',
    invalidFormat: '不支持的图片格式',
    fileTooLarge: '文件太大',
    
    // UI元素
    imageEditor: '图片编辑器',
    imageViewer: '图片查看器',
    altTextPlaceholder: '输入图片描述',
    compressionQuality: '压缩质量',
    aspectRatio: '宽高比',
    brightness: '亮度',
    contrast: '对比度',
    saturation: '饱和度',
    
    // 可访问性
    imageAlt: '图片',
    tapToExpand: '点击放大',
    swipeToClose: '滑动关闭',
    pinchToZoom: '捏合缩放',
    doubleTapToZoom: '双击切换缩放',
    loadingImage: '加载图片中',
    imageLoadError: '图片加载失败',
    retryLoading: '重新加载',
    
    // 进度
    uploadProgress: '上传进度',
    processingProgress: '处理进度',
    cacheCleanup: '清理缓存',
    
    // 设置
    stripMetadata: '删除元数据',
    generateThumbnails: '生成缩略图',
    enableCache: '启用缓存',
    maxCacheSize: '最大缓存大小',
    autoCleanup: '自动清理'
  },
  
  es: {
    // Acciones
    selectImage: 'Seleccionar Imagen',
    takePhoto: 'Tomar Foto',
    chooseFromGallery: 'Elegir de Galería',
    upload: 'Subir',
    save: 'Guardar',
    cancel: 'Cancelar',
    retry: 'Reintentar',
    delete: 'Eliminar',
    edit: 'Editar',
    crop: 'Recortar',
    filter: 'Filtro',
    rotate: 'Rotar',
    
    // Estados
    uploading: 'Subiendo',
    processing: 'Procesando',
    completed: 'Completado',
    failed: 'Fallido',
    loading: 'Cargando',
    
    // Mensajes de error
    permissionDenied: 'Se requiere permiso de acceso a cámara o galería',
    cameraUnavailable: 'La cámara no está disponible',
    galleryUnavailable: 'La galería no está disponible',
    processingFailed: 'Error al procesar la imagen',
    uploadFailed: 'Error al subir la imagen',
    networkError: 'Error de red',
    storageFull: 'Espacio de almacenamiento insuficiente',
    invalidFormat: 'Formato de imagen no compatible',
    fileTooLarge: 'El archivo es demasiado grande',
    
    // Elementos UI
    imageEditor: 'Editor de Imágenes',
    imageViewer: 'Visor de Imágenes',
    altTextPlaceholder: 'Ingrese descripción de imagen',
    compressionQuality: 'Calidad de Compresión',
    aspectRatio: 'Relación de Aspecto',
    brightness: 'Brillo',
    contrast: 'Contraste',
    saturation: 'Saturación',
    
    // Accesibilidad
    imageAlt: 'Imagen',
    tapToExpand: 'Toque para expandir',
    swipeToClose: 'Deslice para cerrar',
    pinchToZoom: 'Pellizque para hacer zoom',
    doubleTapToZoom: 'Doble toque para alternar zoom',
    loadingImage: 'Cargando imagen',
    imageLoadError: 'Error al cargar imagen',
    retryLoading: 'Recargar',
    
    // Progreso
    uploadProgress: 'Progreso de Subida',
    processingProgress: 'Progreso de Procesamiento',
    cacheCleanup: 'Limpieza de Caché',
    
    // Configuración
    stripMetadata: 'Eliminar Metadatos',
    generateThumbnails: 'Generar Miniaturas',
    enableCache: 'Habilitar Caché',
    maxCacheSize: 'Tamaño Máximo de Caché',
    autoCleanup: 'Limpieza Automática'
  },
  
  pt: {
    // Ações
    selectImage: 'Selecionar Imagem',
    takePhoto: 'Tirar Foto',
    chooseFromGallery: 'Escolher da Galeria',
    upload: 'Upload',
    save: 'Salvar',
    cancel: 'Cancelar',
    retry: 'Tentar Novamente',
    delete: 'Excluir',
    edit: 'Editar',
    crop: 'Cortar',
    filter: 'Filtro',
    rotate: 'Girar',
    
    // Estados
    uploading: 'Enviando',
    processing: 'Processando',
    completed: 'Concluído',
    failed: 'Falhou',
    loading: 'Carregando',
    
    // Mensagens de erro
    permissionDenied: 'Permissão de acesso à câmera ou galeria necessária',
    cameraUnavailable: 'Câmera não disponível',
    galleryUnavailable: 'Galeria não disponível',
    processingFailed: 'Falha ao processar imagem',
    uploadFailed: 'Falha ao enviar imagem',
    networkError: 'Erro de rede',
    storageFull: 'Espaço de armazenamento insuficiente',
    invalidFormat: 'Formato de imagem não suportado',
    fileTooLarge: 'Arquivo muito grande',
    
    // Elementos UI
    imageEditor: 'Editor de Imagens',
    imageViewer: 'Visualizador de Imagens',
    altTextPlaceholder: 'Digite a descrição da imagem',
    compressionQuality: 'Qualidade de Compressão',
    aspectRatio: 'Proporção',
    brightness: 'Brilho',
    contrast: 'Contraste',
    saturation: 'Saturação',
    
    // Acessibilidade
    imageAlt: 'Imagem',
    tapToExpand: 'Toque para expandir',
    swipeToClose: 'Deslize para fechar',
    pinchToZoom: 'Belisque para dar zoom',
    doubleTapToZoom: 'Toque duplo para alternar zoom',
    loadingImage: 'Carregando imagem',
    imageLoadError: 'Falha ao carregar imagem',
    retryLoading: 'Recarregar',
    
    // Progresso
    uploadProgress: 'Progresso do Upload',
    processingProgress: 'Progresso do Processamento',
    cacheCleanup: 'Limpeza de Cache',
    
    // Configurações
    stripMetadata: 'Remover Metadados',
    generateThumbnails: 'Gerar Miniaturas',
    enableCache: 'Habilitar Cache',
    maxCacheSize: 'Tamanho Máximo do Cache',
    autoCleanup: 'Limpeza Automática'
  },
  
  ar: {
    // الإجراءات
    selectImage: 'اختيار صورة',
    takePhoto: 'التقاط صورة',
    chooseFromGallery: 'اختيار من المعرض',
    upload: 'رفع',
    save: 'حفظ',
    cancel: 'إلغاء',
    retry: 'إعادة المحاولة',
    delete: 'حذف',
    edit: 'تحرير',
    crop: 'قص',
    filter: 'فلتر',
    rotate: 'تدوير',
    
    // الحالات
    uploading: 'جارٍ الرفع',
    processing: 'جارٍ المعالجة',
    completed: 'مكتمل',
    failed: 'فشل',
    loading: 'جارٍ التحميل',
    
    // رسائل الخطأ
    permissionDenied: 'مطلوب إذن الوصول للكاميرا أو المعرض',
    cameraUnavailable: 'الكاميرا غير متاحة',
    galleryUnavailable: 'المعرض غير متاح',
    processingFailed: 'فشل في معالجة الصورة',
    uploadFailed: 'فشل في رفع الصورة',
    networkError: 'خطأ في الشبكة',
    storageFull: 'مساحة التخزين غير كافية',
    invalidFormat: 'تنسيق صورة غير مدعوم',
    fileTooLarge: 'حجم الملف كبير جداً',
    
    // عناصر الواجهة
    imageEditor: 'محرر الصور',
    imageViewer: 'عارض الصور',
    altTextPlaceholder: 'أدخل وصف الصورة',
    compressionQuality: 'جودة الضغط',
    aspectRatio: 'نسبة العرض إلى الارتفاع',
    brightness: 'السطوع',
    contrast: 'التباين',
    saturation: 'التشبع',
    
    // إمكانية الوصول
    imageAlt: 'صورة',
    tapToExpand: 'اضغط للتوسيع',
    swipeToClose: 'اسحب للإغلاق',
    pinchToZoom: 'اقرص للتكبير',
    doubleTapToZoom: 'اضغط مرتين لتبديل التكبير',
    loadingImage: 'جارٍ تحميل الصورة',
    imageLoadError: 'فشل في تحميل الصورة',
    retryLoading: 'إعادة التحميل',
    
    // التقدم
    uploadProgress: 'تقدم الرفع',
    processingProgress: 'تقدم المعالجة',
    cacheCleanup: 'تنظيف التخزين المؤقت',
    
    // الإعدادات
    stripMetadata: 'إزالة البيانات الوصفية',
    generateThumbnails: 'إنشاء الصور المصغرة',
    enableCache: 'تفعيل التخزين المؤقت',
    maxCacheSize: 'الحد الأقصى لحجم التخزين المؤقت',
    autoCleanup: 'التنظيف التلقائي'
  },
  
  he: {
    // פעולות
    selectImage: 'בחר תמונה',
    takePhoto: 'צלם תמונה',
    chooseFromGallery: 'בחר מהגלריה',
    upload: 'העלה',
    save: 'שמור',
    cancel: 'בטל',
    retry: 'נסה שוב',
    delete: 'מחק',
    edit: 'ערוך',
    crop: 'חתוך',
    filter: 'פילטר',
    rotate: 'סובב',
    
    // מצבים
    uploading: 'מעלה',
    processing: 'מעבד',
    completed: 'הושלם',
    failed: 'נכשל',
    loading: 'טוען',
    
    // הודעות שגיאה
    permissionDenied: 'נדרשת הרשאה לגישה למצלמה או לגלריה',
    cameraUnavailable: 'המצלמה לא זמינה',
    galleryUnavailable: 'הגלריה לא זמינה',
    processingFailed: 'עיבוד התמונה נכשל',
    uploadFailed: 'העלאת התמונה נכשלה',
    networkError: 'שגיאת רשת',
    storageFull: 'אין מספיק מקום אחסון',
    invalidFormat: 'פורמט תמונה לא נתמך',
    fileTooLarge: 'הקובץ גדול מדי',
    
    // אלמנטי ממשק
    imageEditor: 'עורך תמונות',
    imageViewer: 'מציג תמונות',
    altTextPlaceholder: 'הזן תיאור תמונה',
    compressionQuality: 'איכות דחיסה',
    aspectRatio: 'יחס גובה-רוחב',
    brightness: 'בהירות',
    contrast: 'ניגודיות',
    saturation: 'רוויה',
    
    // נגישות
    imageAlt: 'תמונה',
    tapToExpand: 'הקש להרחבה',
    swipeToClose: 'החלק לסגירה',
    pinchToZoom: 'צבוט לזום',
    doubleTapToZoom: 'הקש פעמיים לחלופת זום',
    loadingImage: 'טוען תמונה',
    imageLoadError: 'טעינת התמונה נכשלה',
    retryLoading: 'טען שוב',
    
    // התקדמות
    uploadProgress: 'התקדמות העלאה',
    processingProgress: 'התקדמות עיבוד',
    cacheCleanup: 'ניקוי מטמון',
    
    // הגדרות
    stripMetadata: 'הסר מטא-נתונים',
    generateThumbnails: 'צור תמונות ממוזערות',
    enableCache: 'אפשר מטמון',
    maxCacheSize: 'גודל מטמון מקסימלי',
    autoCleanup: 'ניקוי אוטומטי'
  }
};

const LOCALE_STORAGE_KEY = 'image_locale_settings';

export class InternationalizationService {
  private static instance: InternationalizationService;
  private settings: LocaleSettings | null = null;
  private listeners: ((settings: LocaleSettings) => void)[] = [];

  static getInstance(): InternationalizationService {
    if (!InternationalizationService.instance) {
      InternationalizationService.instance = new InternationalizationService();
    }
    return InternationalizationService.instance;
  }

  /**
   * 国際化サービスを初期化
   */
  async initialize(): Promise<void> {
    try {
      console.log('🌍 I18nService初期化開始');
      
      // 保存された設定を読み込み
      const storedSettings = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
        console.log('✅ 保存された言語設定を復元:', this.settings);
      } else {
        // デフォルト設定を作成
        this.settings = await this.createDefaultSettings();
        await this.saveSettings();
        console.log('✅ デフォルト言語設定を作成:', this.settings);
      }

      // RTL言語の場合、レイアウト方向を設定
      if (this.settings?.isRTL && !I18nManager.isRTL) {
        I18nManager.forceRTL(true);
        console.log('🔄 RTLレイアウトを有効化');
      }
      
    } catch (error) {
      console.error('❌ I18nService初期化エラー:', error);
      // フォールバック設定
      this.settings = {
        language: 'ja',
        region: 'JP',
        isRTL: false,
        dateFormat: 'YYYY-MM-DD',
        numberFormat: '1,234.56',
        currency: 'JPY'
      };
    }
  }

  /**
   * 現在の言語設定を取得
   */
  getSettings(): LocaleSettings | null {
    return this.settings;
  }

  /**
   * 現在の言語のテキストを取得
   */
  getText(): ImageI18nText {
    const language = this.settings?.language || 'ja';
    return translations[language];
  }

  /**
   * 特定のキーのテキストを取得
   */
  t(key: keyof ImageI18nText): string {
    const texts = this.getText();
    return texts[key] || key;
  }

  /**
   * 言語を変更
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    if (this.settings) {
      const isRTL = language === 'ar' || language === 'he';
      
      this.settings = {
        ...this.settings,
        language,
        isRTL
      };

      // RTL設定を適用
      if (isRTL !== I18nManager.isRTL) {
        I18nManager.forceRTL(isRTL);
        console.log(`🔄 RTLレイアウト${isRTL ? '有効化' : '無効化'}`);
      }

      await this.saveSettings();
      this.notifyListeners();
      console.log('✅ 言語変更完了:', language);
    }
  }

  /**
   * 地域設定を変更
   */
  async setRegion(region: string): Promise<void> {
    if (this.settings) {
      this.settings = { ...this.settings, region };
      await this.saveSettings();
      this.notifyListeners();
      console.log('✅ 地域設定変更完了:', region);
    }
  }

  /**
   * 数値をフォーマット
   */
  formatNumber(value: number): string {
    const settings = this.getSettings();
    if (!settings) return value.toString();

    try {
      return new Intl.NumberFormat(this.getLocaleString()).format(value);
    } catch (error) {
      console.warn('⚠️ 数値フォーマットエラー:', error);
      return value.toString();
    }
  }

  /**
   * ファイルサイズをフォーマット
   */
  formatFileSize(bytes: number): string {
    const sizes = {
      ja: ['バイト', 'KB', 'MB', 'GB'],
      en: ['bytes', 'KB', 'MB', 'GB'],
      ko: ['바이트', 'KB', 'MB', 'GB'],
      zh: ['字节', 'KB', 'MB', 'GB'],
      es: ['bytes', 'KB', 'MB', 'GB'],
      pt: ['bytes', 'KB', 'MB', 'GB'],
      ar: ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'],
      he: ['בתים', 'קילובייט', 'מגהבייט', 'גיגהבייט']
    };

    const language = this.settings?.language || 'ja';
    const units = sizes[language];
    
    if (bytes === 0) return `0 ${units[0]}`;
    
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    
    return `${this.formatNumber(size)} ${units[i]}`;
  }

  /**
   * 日付をフォーマット
   */
  formatDate(date: Date): string {
    const settings = this.getSettings();
    if (!settings) return date.toLocaleDateString();

    try {
      return new Intl.DateTimeFormat(this.getLocaleString()).format(date);
    } catch (error) {
      console.warn('⚠️ 日付フォーマットエラー:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * パーセンテージをフォーマット
   */
  formatPercentage(value: number): string {
    const settings = this.getSettings();
    if (!settings) return `${value}%`;

    try {
      return new Intl.NumberFormat(this.getLocaleString(), {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
      }).format(value / 100);
    } catch (error) {
      console.warn('⚠️ パーセンテージフォーマットエラー:', error);
      return `${value}%`;
    }
  }

  /**
   * RTL言語かどうかを判定
   */
  isRTL(): boolean {
    return this.settings?.isRTL || false;
  }

  /**
   * 現在の言語を取得
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.settings?.language || 'ja';
  }

  /**
   * サポートされてる言語のリストを取得
   */
  getSupportedLanguages(): { code: SupportedLanguage; name: string; nativeName: string }[] {
    return [
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'he', name: 'Hebrew', nativeName: 'עברית' }
    ];
  }

  /**
   * 設定変更リスナーを追加
   */
  addSettingsListener(listener: (settings: LocaleSettings) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * デフォルト設定を作成
   */
  private async createDefaultSettings(): Promise<LocaleSettings> {
    // システムの言語設定を取得
    const systemLanguage = Platform.OS === 'ios' 
      ? 'ja' // iOS用の言語検出ロジック
      : 'ja'; // Android用の言語検出ロジック

    const isRTL = (systemLanguage as string) === 'ar' || (systemLanguage as string) === 'he';

    return {
      language: systemLanguage as SupportedLanguage,
      region: 'JP',
      isRTL,
      dateFormat: 'YYYY-MM-DD',
      numberFormat: '1,234.56',
      currency: 'JPY'
    };
  }

  /**
   * ロケール文字列を取得
   */
  private getLocaleString(): string {
    const settings = this.getSettings();
    if (!settings) return 'ja-JP';
    
    return `${settings.language}-${settings.region}`;
  }

  /**
   * 設定を保存
   */
  private async saveSettings(): Promise<void> {
    if (this.settings) {
      try {
        await AsyncStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(this.settings));
      } catch (error) {
        console.error('❌ 言語設定保存エラー:', error);
      }
    }
  }

  /**
   * リスナーに設定変更を通知
   */
  private notifyListeners(): void {
    if (this.settings) {
      this.listeners.forEach(listener => listener(this.settings!));
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.listeners = [];
  }
}