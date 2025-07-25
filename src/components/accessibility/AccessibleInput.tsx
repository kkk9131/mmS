import * as React from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  NativeSyntheticEvent,
  TextInputFocusEventData
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { useHapticFeedback } from '../../hooks/useAccessibility';
import { 
  generateHighContrastColor,
  adjustTextSize,
  debugAccessibility 
} from '../../utils/accessibilityUtils';
import { AccessibleText, AccessibleLabel } from './AccessibleText';
import { AccessibleButton } from './AccessibleButton';

export interface AccessibleInputProps extends Omit<TextInputProps, 'style'> {
  label: string; // 必須のラベル
  accessibilityLabel?: string;
  accessibilityHint?: string;
  errorMessage?: string;
  helperText?: string;
  required?: boolean;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  helperStyle?: TextStyle;
  onFocus?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onBlur?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // バリデーション
  validationPattern?: RegExp;
  onValidation?: (isValid: boolean, value: string) => void;
  showCharacterCount?: boolean;
  maxLength?: number;
}

/**
 * アクセシブル入力フィールドコンポーネント
 * ラベル関連付け、エラー表示、バリデーション、文字数カウント対応
 */
export const AccessibleInput: React.FC<AccessibleInputProps> = ({
  label,
  accessibilityLabel,
  accessibilityHint,
  errorMessage,
  helperText,
  required = false,
  style,
  containerStyle,
  labelStyle,
  errorStyle,
  helperStyle,
  onFocus,
  onBlur,
  onChangeText,
  leftIcon,
  rightIcon,
  validationPattern,
  onValidation,
  showCharacterCount = false,
  maxLength,
  value,
  testID,
  ...props
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [isValid, setIsValid] = React.useState(true);
  const [characterCount, setCharacterCount] = React.useState(0);
  const inputRef = React.useRef<TextInput>(null);
  const { settings } = useAccessibility();
  const { triggerHaptic } = useHapticFeedback();

  // アクセシビリティデバッグ
  React.useEffect(() => {
    debugAccessibility('AccessibleInput', {
      accessible: true,
      accessibilityLabel: accessibilityLabel || label,
      accessibilityHint,
      accessibilityRole: 'text',
      accessibilityState: { disabled: props.editable === false }
    });
  }, [accessibilityLabel, label, accessibilityHint, props.editable]);

  // 文字数カウントの更新
  React.useEffect(() => {
    setCharacterCount(value?.length || 0);
  }, [value]);

  // バリデーション処理
  const validateInput = React.useCallback((inputValue: string) => {
    let valid = true;

    // 必須チェック
    if (required && !inputValue.trim()) {
      valid = false;
    }

    // パターンマッチング
    if (validationPattern && inputValue && !validationPattern.test(inputValue)) {
      valid = false;
    }

    setIsValid(valid);
    onValidation?.(valid, inputValue);
    
    return valid;
  }, [required, validationPattern, onValidation]);

  // テキスト変更処理
  const handleChangeText = React.useCallback((text: string) => {
    validateInput(text);
    onChangeText?.(text);
  }, [validateInput, onChangeText]);

  // フォーカス処理
  const handleFocus = React.useCallback((e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(true);
    triggerHaptic('selection');
    onFocus?.(e);
  }, [triggerHaptic, onFocus]);

  // ブラー処理
  const handleBlur = React.useCallback((e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(false);
    if (value) {
      validateInput(value);
    }
    onBlur?.(e);
  }, [value, validateInput, onBlur]);

  // 入力フィールドのスタイル
  const inputStyle = React.useMemo(() => {
    const baseStyle = StyleSheet.flatten([styles.input, style]);
    let adjustedStyle = { ...baseStyle };

    // テキストサイズ調整
    const baseFontSize = baseStyle.fontSize || 16;
    adjustedStyle.fontSize = adjustTextSize(baseFontSize, settings.textSizeMultiplier);

    // 高コントラストモード
    if (settings.highContrastMode) {
      const currentColor = (baseStyle as any).color || '#000000';
      (adjustedStyle as any).color = generateHighContrastColor(currentColor.toString(), '#FFFFFF');
      adjustedStyle.borderColor = generateHighContrastColor('#CCCCCC', '#FFFFFF');
      adjustedStyle.borderWidth = 2;
    }

    // フォーカス状態
    if (isFocused) {
      adjustedStyle.borderColor = '#007AFF';
      adjustedStyle.borderWidth = 2;
    }

    // エラー状態
    if (errorMessage || !isValid) {
      adjustedStyle.borderColor = '#FF3B30';
      adjustedStyle.borderWidth = 2;
    }

    return adjustedStyle;
  }, [style, settings.textSizeMultiplier, settings.highContrastMode, isFocused, errorMessage, isValid]);

  // コンテナスタイル
  const containerStyles = [styles.container, containerStyle];

  // アクセシビリティラベルの生成
  const effectiveAccessibilityLabel = React.useMemo(() => {
    let label_text = accessibilityLabel || label;
    
    if (required) {
      label_text += '、必須項目';
    }
    
    if (errorMessage) {
      label_text += `、エラー: ${errorMessage}`;
    }
    
    return label_text;
  }, [accessibilityLabel, label, required, errorMessage]);

  // アクセシビリティヒントの生成
  const effectiveAccessibilityHint = React.useMemo(() => {
    let hints: string[] = [];
    
    if (accessibilityHint) {
      hints.push(accessibilityHint);
    }
    
    if (helperText) {
      hints.push(helperText);
    }
    
    if (showCharacterCount && maxLength) {
      hints.push(`${maxLength}文字まで入力可能`);
    }
    
    return hints.join(', ') || undefined;
  }, [accessibilityHint, helperText, showCharacterCount, maxLength]);

  return (
    <View style={containerStyles} testID={testID}>
      {/* ラベル */}
      <AccessibleLabel style={StyleSheet.flatten([styles.label, labelStyle])}>
        {label}
        {required && <AccessibleText style={styles.required}> *</AccessibleText>}
      </AccessibleLabel>

      {/* 入力フィールドコンテナ */}
      <View style={styles.inputContainer}>
        {leftIcon && (
          <View style={styles.leftIcon}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          ref={inputRef}
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          maxLength={maxLength}
          // アクセシビリティ設定
          accessible={true}
          accessibilityLabel={effectiveAccessibilityLabel}
          accessibilityHint={effectiveAccessibilityHint}
          accessibilityRole="text"
          accessibilityState={{
            disabled: props.editable === false
          }}
          {...props}
        />
        
        {rightIcon && (
          <View style={styles.rightIcon}>
            {rightIcon}
          </View>
        )}
      </View>

      {/* ヘルパーテキスト */}
      {helperText && !errorMessage && (
        <AccessibleText 
          style={StyleSheet.flatten([styles.helperText, helperStyle])}
          accessibilityLabel={`ヘルプ: ${helperText}`}
        >
          {helperText}
        </AccessibleText>
      )}

      {/* エラーメッセージ */}
      {errorMessage && (
        <AccessibleText 
          style={StyleSheet.flatten([styles.errorText, errorStyle])}
          accessibilityLabel={`エラー: ${errorMessage}`}
        >
          ⚠️ {errorMessage}
        </AccessibleText>
      )}

      {/* 文字数カウント */}
      {showCharacterCount && maxLength && (
        <AccessibleText 
          style={styles.characterCount}
          accessibilityLabel={`${characterCount}文字入力済み、残り${maxLength - characterCount}文字`}
        >
          {characterCount}/{maxLength}
        </AccessibleText>
      )}
    </View>
  );
};

/**
 * パスワード入力用のプリセットコンポーネント
 */
export const AccessiblePasswordInput: React.FC<Omit<AccessibleInputProps, 'secureTextEntry'>> = (props) => {
  const [isSecure, setIsSecure] = React.useState(true);

  const toggleSecureEntry = () => {
    setIsSecure(!isSecure);
  };

  return (
    <AccessibleInput
      {...props}
      secureTextEntry={isSecure}
      accessibilityHint="パスワードを入力してください。右のボタンで表示・非表示を切り替えできます。"
      rightIcon={
        <AccessibleButton 
          style={styles.toggleButton}
          onPress={toggleSecureEntry}
          accessibilityLabel={isSecure ? 'パスワードを表示' : 'パスワードを非表示'}
        >
          {isSecure ? '👁️' : '🙈'}
        </AccessibleButton>
      }
    />
  );
};

/**
 * 検索入力用のプリセットコンポーネント
 */
export const AccessibleSearchInput: React.FC<Omit<AccessibleInputProps, 'label'> & {
  onSearch?: (query: string) => void;
}> = ({ onSearch, ...props }) => (
  <AccessibleInput
    {...props}
    label="検索"
    placeholder="検索キーワードを入力"
    accessibilityLabel="検索キーワード入力欄"
    accessibilityHint="検索したいキーワードを入力してください"
    returnKeyType="search"
    onSubmitEditing={(e) => onSearch?.(e.nativeEvent.text)}
    leftIcon={<AccessibleText>🔍</AccessibleText>}
  />
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 8
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333333'
  },
  required: {
    color: '#FF3B30'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 48 // 最小タップターゲットサイズ
  },
  leftIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1
  },
  rightIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 1
  },
  helperText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4
  },
  characterCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4
  },
  toggleButton: {
    padding: 8,
    fontSize: 16
  }
});

export default AccessibleInput;