import * as React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  ViewStyle,
  Alert
} from 'react-native';
// import Slider from '@react-native-community/slider';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { AccessibleButton } from './AccessibleButton';
import { AccessibleText, AccessibleHeading } from './AccessibleText';
import { ColorAccessibilityProvider, useColorAccessibility } from './ColorAccessibility';
import { useCognitiveSupport } from './CognitiveSupport';

/**
 * アクセシビリティ設定セクション
 */
interface SettingSection {
  id: string;
  title: string;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'slider' | 'select' | 'button';
  value?: any;
  options?: { label: string; value: any }[];
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * アクセシビリティ設定画面
 */
export const AccessibilitySettings: React.FC<{
  style?: ViewStyle;
  testID?: string;
}> = ({ style, testID }) => {
  const { settings, updateSettings, resetToDefaults, isScreenReaderActive, announceForScreenReader } = useAccessibility();
  const { showConfirmation, showHelp } = useCognitiveSupport();

  // 設定変更の確認
  const handleSettingChange = React.useCallback((
    settingKey: string,
    newValue: any,
    requiresConfirmation: boolean = false
  ) => {
    if (requiresConfirmation) {
      showConfirmation(
        `${settingKey}を変更しますか？`,
        () => {
          updateSettings({ [settingKey]: newValue });
          announceForScreenReader(`${settingKey}を${newValue ? '有効' : '無効'}にしました`);
        }
      );
    } else {
      updateSettings({ [settingKey]: newValue });
      announceForScreenReader(`${settingKey}を変更しました`);
    }
  }, [updateSettings, showConfirmation, announceForScreenReader]);

  // 設定項目の定義
  const settingSections: SettingSection[] = [
    {
      id: 'visual',
      title: '視覚的アクセシビリティ',
      items: [
        {
          id: 'screenReaderEnabled',
          title: 'スクリーンリーダー対応',
          description: 'スクリーンリーダーでの読み上げを最適化します',
          type: 'toggle',
          value: settings.screenReaderEnabled
        },
        {
          id: 'highContrastMode',
          title: '高コントラストモード',
          description: 'テキストと背景のコントラストを高めます',
          type: 'toggle',
          value: settings.highContrastMode
        },
        {
          id: 'largeTextMode',
          title: '大きなテキスト',
          description: 'テキストサイズを大きくします',
          type: 'toggle',
          value: settings.largeTextMode
        },
        {
          id: 'textSizeMultiplier',
          title: 'テキストサイズ倍率',
          description: 'テキストサイズの倍率を調整します (1.0〜2.0)',
          type: 'slider',
          value: settings.textSizeMultiplier
        },
        {
          id: 'colorBlindnessType',
          title: '色覚サポート',
          description: '色覚特性に応じた色調整を行います',
          type: 'select',
          value: settings.colorBlindnessType,
          options: [
            { label: '設定なし', value: undefined },
            { label: '1型色覚 (赤)', value: 'protanopia' },
            { label: '2型色覚 (緑)', value: 'deuteranopia' },
            { label: '3型色覚 (青)', value: 'tritanopia' }
          ]
        }
      ]
    },
    {
      id: 'motor',
      title: '運動機能サポート',
      items: [
        {
          id: 'oneHandedMode',
          title: '片手操作モード',
          description: '授乳中などの片手操作に最適化します',
          type: 'toggle',
          value: settings.oneHandedMode
        },
        {
          id: 'hapticFeedbackEnabled',
          title: 'ハプティックフィードバック',
          description: '操作時の振動フィードバックを有効にします',
          type: 'toggle',
          value: settings.hapticFeedbackEnabled
        },
        {
          id: 'reducedMotion',
          title: 'アニメーション軽減',
          description: 'アニメーションを軽減し、動きを抑えます',
          type: 'toggle',
          value: settings.reducedMotion
        }
      ]
    },
    {
      id: 'actions',
      title: 'アクション',
      items: [
        {
          id: 'testAccessibility',
          title: 'アクセシビリティテスト',
          description: '現在の設定でアクセシビリティをテストします',
          type: 'button',
          onPress: () => runAccessibilityTest()
        },
        {
          id: 'exportSettings',
          title: '設定のエクスポート',
          description: '現在の設定をエクスポートします',
          type: 'button',
          onPress: () => exportSettings()
        },
        {
          id: 'importSettings',
          title: '設定のインポート',
          description: '保存された設定をインポートします',
          type: 'button',
          onPress: () => importSettings()
        },
        {
          id: 'resetSettings',
          title: '設定をリセット',
          description: '全ての設定をデフォルトに戻します',
          type: 'button',
          onPress: () => handleResetSettings()
        }
      ]
    }
  ];

  // アクセシビリティテストの実行
  const runAccessibilityTest = React.useCallback(() => {
    announceForScreenReader('アクセシビリティテストを開始します');
    
    // 基本的なテスト項目
    const testResults = {
      screenReader: isScreenReaderActive,
      highContrast: settings.highContrastMode,
      textSize: settings.textSizeMultiplier > 1.0,
      oneHanded: settings.oneHandedMode,
      haptics: settings.hapticFeedbackEnabled
    };

    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;

    Alert.alert(
      'アクセシビリティテスト結果',
      `${totalTests}項目中${passedTests}項目が有効です。\n\n` +
      `スクリーンリーダー: ${testResults.screenReader ? '✅' : '❌'}\n` +
      `高コントラスト: ${testResults.highContrast ? '✅' : '❌'}\n` +
      `大きなテキスト: ${testResults.textSize ? '✅' : '❌'}\n` +
      `片手操作: ${testResults.oneHanded ? '✅' : '❌'}\n` +
      `ハプティック: ${testResults.haptics ? '✅' : '❌'}`,
      [{ text: 'OK' }]
    );
  }, [isScreenReaderActive, settings, announceForScreenReader]);

  // 設定のエクスポート
  const exportSettings = React.useCallback(() => {
    const settingsJson = JSON.stringify(settings, null, 2);
    console.log('エクスポートされた設定:', settingsJson);
    
    Alert.alert(
      '設定エクスポート',
      '設定がログに出力されました。実際の実装では、ファイル保存やクラウド同期を行います。',
      [{ text: 'OK' }]
    );
  }, [settings]);

  // 設定のインポート
  const importSettings = React.useCallback(() => {
    Alert.alert(
      '設定インポート',
      '実際の実装では、ファイル選択やクラウドから設定を読み込みます。',
      [{ text: 'OK' }]
    );
  }, []);

  // 設定リセット
  const handleResetSettings = React.useCallback(() => {
    showConfirmation(
      '全ての設定をデフォルトに戻しますか？この操作は取り消せません。',
      () => {
        resetToDefaults();
        announceForScreenReader('設定をデフォルトにリセットしました');
      }
    );
  }, [resetToDefaults, showConfirmation, announceForScreenReader]);

  return (
    <ColorAccessibilityProvider>
      <ScrollView
        style={[styles.container, style]}
        testID={testID}
        accessibilityLabel="アクセシビリティ設定"
      >
        <AccessibleHeading level={1} style={styles.title}>
          アクセシビリティ設定
        </AccessibleHeading>

        <AccessibleText style={styles.description}>
          あなたの使いやすさに合わせて、各種アクセシビリティ機能を設定できます。
        </AccessibleText>

        {settingSections.map((section) => (
          <SettingSection
            key={section.id}
            section={section}
            onSettingChange={handleSettingChange}
          />
        ))}

        {/* フッター情報 */}
        <View style={styles.footer}>
          <AccessibleText style={styles.footerText}>
            設定は自動的に保存されます。アプリを再起動しても設定は保持されます。
          </AccessibleText>
        </View>
      </ScrollView>
    </ColorAccessibilityProvider>
  );
};

/**
 * 設定セクションコンポーネント
 */
interface SettingSectionProps {
  section: SettingSection;
  onSettingChange: (key: string, value: any, requiresConfirmation?: boolean) => void;
}

const SettingSection: React.FC<SettingSectionProps> = ({ section, onSettingChange }) => {
  return (
    <View style={styles.section}>
      <AccessibleHeading level={2} style={styles.sectionTitle}>
        {section.title}
      </AccessibleHeading>

      {section.items.map((item) => (
        <SettingItem
          key={item.id}
          item={item}
          onSettingChange={onSettingChange}
        />
      ))}
    </View>
  );
};

/**
 * 設定項目コンポーネント
 */
interface SettingItemProps {
  item: SettingItem;
  onSettingChange: (key: string, value: any, requiresConfirmation?: boolean) => void;
}

const SettingItem: React.FC<SettingItemProps> = ({ item, onSettingChange }) => {
  const { showHelp } = useCognitiveSupport();

  const renderControl = () => {
    switch (item.type) {
      case 'toggle':
        return (
          <Switch
            value={item.value}
            onValueChange={(value) => onSettingChange(item.id, value)}
            disabled={item.disabled}
            accessibilityLabel={`${item.title}のスイッチ`}
            accessibilityHint={item.value ? 'オンになっています' : 'オフになっています'}
          />
        );

      case 'slider':
        return (
          <View style={styles.sliderContainer}>
            <AccessibleText style={styles.sliderValue}>
              {(item.value || 1.0).toFixed(1)}
            </AccessibleText>
            <AccessibleText style={styles.sliderNote}>
              スライダー機能は開発中です
            </AccessibleText>
          </View>
        );

      case 'select':
        return (
          <SelectControl
            options={item.options || []}
            value={item.value}
            onValueChange={(value) => onSettingChange(item.id, value)}
            disabled={item.disabled}
            accessibilityLabel={`${item.title}の選択`}
          />
        );

      case 'button':
        return (
          <AccessibleButton
            onPress={item.onPress || (() => {})}
            style={styles.actionButton}
            disabled={item.disabled}
            accessibilityLabel={item.title}
            accessibilityHint={item.description}
          >
            実行
          </AccessibleButton>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <AccessibleText style={styles.settingTitle}>
          {item.title}
        </AccessibleText>
        <AccessibleText style={styles.settingDescription}>
          {item.description}
        </AccessibleText>
      </View>

      <View style={styles.settingControl}>
        {renderControl()}
        
        {/* ヘルプボタン */}
        <AccessibleButton
          onPress={() => showHelp(item.description, item.title)}
          style={styles.helpButton}
          accessibilityLabel={`${item.title}のヘルプ`}
        >
          ❓
        </AccessibleButton>
      </View>
    </View>
  );
};

/**
 * 選択コントロール
 */
interface SelectControlProps {
  options: { label: string; value: any }[];
  value: any;
  onValueChange: (value: any) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const SelectControl: React.FC<SelectControlProps> = ({
  options,
  value,
  onValueChange,
  disabled,
  accessibilityLabel
}) => {
  const [showOptions, setShowOptions] = React.useState(false);

  const selectedOption = options.find(option => option.value === value);

  return (
    <View style={styles.selectContainer}>
      <AccessibleButton
        onPress={() => setShowOptions(!showOptions)}
        style={styles.selectButton}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel || '選択ボタン'}
        accessibilityHint={`現在の選択: ${selectedOption?.label || '未選択'}`}
      >
        {selectedOption?.label || '選択してください'}
      </AccessibleButton>

      {showOptions && (
        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <AccessibleButton
              key={index}
              onPress={() => {
                onValueChange(option.value);
                setShowOptions(false);
              }}
              style={[
                styles.optionButton,
                option.value === value ? styles.selectedOption : {}
              ] as any}
              accessibilityLabel={option.label}
              accessibilityHint={option.value === value ? '選択中' : '選択可能'}
            >
              {option.label}
            </AccessibleButton>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center'
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  section: {
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#007AFF'
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12
  },
  settingInfo: {
    flex: 1,
    marginRight: 16
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20
  },
  settingControl: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120
  },
  slider: {
    flex: 1,
    height: 40
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    minWidth: 32,
    textAlign: 'center'
  },
  sliderNote: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
    fontStyle: 'italic'
  },
  selectContainer: {
    position: 'relative',
    minWidth: 140
  },
  selectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    marginTop: 4,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  optionButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  selectedOption: {
    backgroundColor: '#E3F2FD'
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80
  },
  helpButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  footer: {
    marginTop: 32,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20
  }
});

export default AccessibilitySettings;