/**
 * 画像アクセシビリティサービス
 * スクリーンリーダー対応、高コントラスト、フォントサイズ調整
 */

import { AccessibilityInfo, Platform } from 'react-native';

export interface AccessibilitySettings {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isHighContrastEnabled: boolean;
  preferredContentSizeCategory: string;
  isVoiceOverRunning: boolean;
  isTalkBackRunning: boolean;
}

export interface ImageAccessibilityData {
  altText: string;
  description?: string;
  longDescription?: string;
  captionText?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role: 'image' | 'button' | 'link';
  isDecorative: boolean;
}

export class AccessibilityService {
  private static instance: AccessibilityService;
  private settings: AccessibilitySettings | null = null;
  private listeners: Array<(settings: AccessibilitySettings) => void> = [];

  static getInstance(): AccessibilityService {
    if (!AccessibilityService.instance) {
      AccessibilityService.instance = new AccessibilityService();
    }
    return AccessibilityService.instance;
  }

  /**
   * アクセシビリティ設定を初期化
   */
  async initialize(): Promise<void> {
    try {
      console.log('♿ AccessibilityService初期化開始');
      
      const [
        isScreenReaderEnabled,
        isReduceMotionEnabled,
        isHighContrastEnabled,
        preferredContentSizeCategory
      ] = await Promise.all([
        AccessibilityInfo.isScreenReaderEnabled(),
        AccessibilityInfo.isReduceMotionEnabled(),
        Platform.OS === 'ios' ? AccessibilityInfo.isHighContrastEnabled() : Promise.resolve(false),
        AccessibilityInfo.getPreferredContentSizeCategory?.() || Promise.resolve('medium')
      ]);

      this.settings = {
        isScreenReaderEnabled,
        isReduceMotionEnabled,
        isHighContrastEnabled,
        preferredContentSizeCategory,
        isVoiceOverRunning: Platform.OS === 'ios' && isScreenReaderEnabled,
        isTalkBackRunning: Platform.OS === 'android' && isScreenReaderEnabled
      };

      // アクセシビリティ設定変更を監視
      this.setupEventListeners();
      
      console.log('✅ AccessibilityService初期化完了:', this.settings);
    } catch (error) {
      console.error('❌ AccessibilityService初期化エラー:', error);
      // フォールバック設定
      this.settings = {
        isScreenReaderEnabled: false,
        isReduceMotionEnabled: false,
        isHighContrastEnabled: false,
        preferredContentSizeCategory: 'medium',
        isVoiceOverRunning: false,
        isTalkBackRunning: false
      };
    }
  }

  /**
   * 現在のアクセシビリティ設定を取得
   */
  getSettings(): AccessibilitySettings | null {
    return this.settings;
  }

  /**
   * 設定変更リスナーを追加
   */
  addSettingsListener(listener: (settings: AccessibilitySettings) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 画像のアクセシビリティプロパティを生成
   */
  generateImageAccessibilityProps(data: ImageAccessibilityData) {
    const settings = this.getSettings();
    if (!settings) return {};

    const props: any = {
      accessible: !data.isDecorative,
      accessibilityRole: data.role,
    };

    if (!data.isDecorative) {
      // メインのアクセシビリティラベル
      props.accessibilityLabel = data.ariaLabel || data.altText;
      
      // 詳細な説明
      if (data.description) {
        props.accessibilityHint = data.description;
      }
      
      // 長い説明がある場合
      if (data.longDescription) {
        props.accessibilityValue = { text: data.longDescription };
      }
      
      // キャプション
      if (data.captionText) {
        props.accessibilityLabel += `. ${data.captionText}`;
      }
    } else {
      // 装飾的な画像の場合
      props.accessibilityElementsHidden = true;
      props.importantForAccessibility = 'no-hide-descendants';
    }

    // スクリーンリーダー固有の設定
    if (settings.isScreenReaderEnabled) {
      if (Platform.OS === 'ios' && settings.isVoiceOverRunning) {
        // VoiceOver固有の設定
        props.accessibilityTraits = ['image'];
      } else if (Platform.OS === 'android' && settings.isTalkBackRunning) {
        // TalkBack固有の設定
        props.accessibilityLiveRegion = 'polite';
      }
    }

    return props;
  }

  /**
   * ボタンのアクセシビリティプロパティを生成
   */
  generateButtonAccessibilityProps(label: string, hint?: string, disabled: boolean = false) {
    const settings = this.getSettings();
    if (!settings) return {};

    const props: any = {
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: label,
      accessibilityState: { disabled }
    };

    if (hint) {
      props.accessibilityHint = hint;
    }

    // 無効状態の場合
    if (disabled) {
      props.accessibilityState.disabled = true;
      if (settings.isScreenReaderEnabled) {
        props.accessibilityLabel += '、無効';
      }
    }

    return props;
  }

  /**
   * モーダルのアクセシビリティプロパティを生成
   */
  generateModalAccessibilityProps(title: string, description?: string) {
    const settings = this.getSettings();
    if (!settings) return {};

    const props: any = {
      accessible: true,
      accessibilityRole: 'none',
      accessibilityLabel: title,
      accessibilityViewIsModal: true
    };

    if (description) {
      props.accessibilityHint = description;
    }

    // モーション削減設定の場合
    if (settings.isReduceMotionEnabled) {
      props.animationType = 'none';
    }

    return props;
  }

  /**
   * テキスト入力のアクセシビリティプロパティを生成
   */
  generateTextInputAccessibilityProps(
    label: string, 
    placeholder?: string, 
    error?: string,
    required: boolean = false
  ) {
    const settings = this.getSettings();
    if (!settings) return {};

    const props: any = {
      accessible: true,
      accessibilityRole: 'text',
      accessibilityLabel: required ? `${label}、必須` : label
    };

    if (placeholder) {
      props.placeholder = placeholder;
    }

    if (error) {
      props.accessibilityLabel += `、エラー: ${error}`;
      props.accessibilityState = { invalid: true };
    }

    return props;
  }

  /**
   * 進捗表示のアクセシビリティプロパティを生成
   */
  generateProgressAccessibilityProps(current: number, total: number, description?: string) {
    const settings = this.getSettings();
    if (!settings) return {};

    const percentage = Math.round((current / total) * 100);
    const progressText = description ? 
      `${description}: ${percentage}%完了` : 
      `${percentage}%完了`;

    const props: any = {
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: progressText,
      accessibilityValue: { 
        min: 0, 
        max: total, 
        now: current,
        text: `${current}/${total}`
      }
    };

    // スクリーンリーダー使用時は定期的に進捗を通知
    if (settings.isScreenReaderEnabled) {
      props.accessibilityLiveRegion = 'polite';
    }

    return props;
  }

  /**
   * 高コントラストモード用のスタイル調整
   */
  getHighContrastStyles() {
    const settings = this.getSettings();
    if (!settings?.isHighContrastEnabled) return {};

    return {
      borderWidth: 2,
      borderColor: '#000000',
      backgroundColor: '#FFFFFF',
      color: '#000000'
    };
  }

  /**
   * フォントサイズ調整
   */
  getScaledFontSize(baseFontSize: number): number {
    const settings = this.getSettings();
    if (!settings) return baseFontSize;

    const scaleFactors: Record<string, number> = {
      'extraSmall': 0.8,
      'small': 0.9,
      'medium': 1.0,
      'large': 1.1,
      'extraLarge': 1.2,
      'extraExtraLarge': 1.3,
      'extraExtraExtraLarge': 1.4,
      'accessibilityMedium': 1.3,
      'accessibilityLarge': 1.5,
      'accessibilityExtraLarge': 1.7,
      'accessibilityExtraExtraLarge': 1.9,
      'accessibilityExtraExtraExtraLarge': 2.1
    };

    const scaleFactor = scaleFactors[settings.preferredContentSizeCategory] || 1.0;
    return Math.round(baseFontSize * scaleFactor);
  }

  /**
   * アニメーション設定を取得
   */
  shouldReduceMotion(): boolean {
    const settings = this.getSettings();
    return settings?.isReduceMotionEnabled || false;
  }

  /**
   * スクリーンリーダー使用状況を取得
   */
  isScreenReaderEnabled(): boolean {
    const settings = this.getSettings();
    return settings?.isScreenReaderEnabled || false;
  }

  /**
   * イベントリスナーをセットアップ
   */
  private setupEventListeners(): void {
    // スクリーンリーダー状態変更の監視
    AccessibilityInfo.addEventListener('screenReaderChanged', this.handleScreenReaderChange);
    
    // モーション削減設定変更の監視
    AccessibilityInfo.addEventListener('reduceMotionChanged', this.handleReduceMotionChange);
    
    //高コントラスト設定変更の監視（iOS）
    if (Platform.OS === 'ios') {
      AccessibilityInfo.addEventListener('highContrastChanged', this.handleHighContrastChange);
    }
  }

  private handleScreenReaderChange = (isEnabled: boolean) => {
    if (this.settings) {
      this.settings = {
        ...this.settings,
        isScreenReaderEnabled: isEnabled,
        isVoiceOverRunning: Platform.OS === 'ios' && isEnabled,
        isTalkBackRunning: Platform.OS === 'android' && isEnabled
      };
      this.notifyListeners();
    }
  };

  private handleReduceMotionChange = (isEnabled: boolean) => {
    if (this.settings) {
      this.settings = { ...this.settings, isReduceMotionEnabled: isEnabled };
      this.notifyListeners();
    }
  };

  private handleHighContrastChange = (isEnabled: boolean) => {
    if (this.settings) {
      this.settings = { ...this.settings, isHighContrastEnabled: isEnabled };
      this.notifyListeners();
    }
  };

  private notifyListeners(): void {
    if (this.settings) {
      this.listeners.forEach(listener => listener(this.settings!));
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    AccessibilityInfo.removeEventListener('screenReaderChanged', this.handleScreenReaderChange);
    AccessibilityInfo.removeEventListener('reduceMotionChanged', this.handleReduceMotionChange);
    
    if (Platform.OS === 'ios') {
      AccessibilityInfo.removeEventListener('highContrastChanged', this.handleHighContrastChange);
    }
    
    this.listeners = [];
  }
}