/**
 * アクセシブルコンポーネントライブラリのエクスポート
 */

// 基本コンポーネント
export { default as AccessibleButton } from './AccessibleButton';
export type { AccessibleButtonProps } from './AccessibleButton';

export { 
  default as AccessibleText,
  AccessibleHeading,
  AccessibleBody,
  AccessibleLabel
} from './AccessibleText';
export type { AccessibleTextProps } from './AccessibleText';

export { 
  default as AccessibleImage,
  AccessibleAvatar,
  AccessiblePostImage,
  AccessibleIcon
} from './AccessibleImage';
export type { AccessibleImageProps } from './AccessibleImage';

export { 
  default as AccessibleInput,
  AccessiblePasswordInput,
  AccessibleSearchInput
} from './AccessibleInput';
export type { AccessibleInputProps } from './AccessibleInput';

// 今後追加予定のコンポーネント
// export { default as AccessibleModal } from './AccessibleModal';
// export { default as AccessibleSwitch } from './AccessibleSwitch';
// export { default as AccessibleSlider } from './AccessibleSlider';
// export { default as AccessibleTabs } from './AccessibleTabs';
// export { default as FocusIndicator } from './FocusIndicator';