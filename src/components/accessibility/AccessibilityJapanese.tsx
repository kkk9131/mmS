/**
 * 日本語アクセシビリティ対応コンポーネント
 * 
 * 日本語圏のユーザーと支援技術に最適化された
 * アクセシビリティ機能を提供します。
 */

import * as React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { AccessibleText, AccessibleHeading } from './AccessibleText';
import { AccessibleButton } from './AccessibleButton';

/**
 * 日本語アクセシビリティ設定
 */
export interface JapaneseAccessibilitySettings {
  usePoliteLanguage: boolean; // 敬語の使用
  useKanji: boolean; // 漢字の使用
  readingSpeed: 'slow' | 'normal' | 'fast'; // 読み上げ速度
  pronunciationGuide: boolean; // 読み方ガイド
  culturalContext: boolean; // 文化的コンテキスト
}

/**
 * 日本語アクセシビリティコンテキスト
 */
interface JapaneseAccessibilityContextType {
  settings: JapaneseAccessibilitySettings;
  updateSettings: (settings: Partial<JapaneseAccessibilitySettings>) => void;
  formatPoliteText: (text: string, isPolite?: boolean) => string;
  addFurigana: (text: string, furigana: string) => string;
  formatDateJapanese: (date: Date) => string;
  formatTimeJapanese: (date: Date) => string;
  formatNumberJapanese: (number: number) => string;
}

const JapaneseAccessibilityContext = React.createContext<JapaneseAccessibilityContextType | undefined>(undefined);

/**
 * 日本語アクセシビリティプロバイダー
 */
export const JapaneseAccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = React.useState<JapaneseAccessibilitySettings>({
    usePoliteLanguage: true,
    useKanji: true,
    readingSpeed: 'normal',
    pronunciationGuide: true,
    culturalContext: true
  });

  const updateSettings = React.useCallback((newSettings: Partial<JapaneseAccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  /**
   * 敬語への変換
   */
  const formatPoliteText = React.useCallback((text: string, isPolite?: boolean): string => {
    const shouldUsePolite = isPolite ?? settings.usePoliteLanguage;
    
    if (!shouldUsePolite) {
      return text;
    }

    // 敬語変換辞書
    const politeMap: Record<string, string> = {
      'する': 'いたします',
      'した': 'いたしました',
      'してください': 'していただけますでしょうか',
      'ありがとう': 'ありがとうございます',
      'すみません': '申し訳ございません',
      'わかりました': '承知いたしました',
      'できます': 'できます',
      'できません': 'できかねます',
      'してます': 'しております',
      'やります': 'させていただきます',
      'やりました': 'させていただきました',
      '見る': '拝見する',
      '見た': '拝見いたしました',
      '聞く': '伺う',
      '聞いた': '伺いました',
      '言う': '申し上げる',
      '言った': '申し上げました',
      'もらう': 'いただく',
      'もらった': 'いただきました',
      'あげる': '差し上げる',
      'あげた': '差し上げました',
      'いる': 'いらっしゃる',
      'いた': 'いらっしゃいました',
      'くる': 'いらっしゃる',
      'きた': 'いらっしゃいました',
      '知ってる': 'ご存じ',
      '知ってます': 'ご存じです'
    };

    let politeText = text;
    
    // 敬語変換を適用
    Object.entries(politeMap).forEach(([casual, polite]) => {
      const regex = new RegExp(casual, 'g');
      politeText = politeText.replace(regex, polite);
    });

    return politeText;
  }, [settings.usePoliteLanguage]);

  /**
   * ふりがなの追加
   */
  const addFurigana = React.useCallback((text: string, furigana: string): string => {
    if (!settings.pronunciationGuide) {
      return text;
    }

    // 実際の実装ではルビタグやアクセシビリティ属性を使用
    return `${text}（${furigana}）`;
  }, [settings.pronunciationGuide]);

  /**
   * 日本語形式での日付フォーマット
   */
  const formatDateJapanese = React.useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

    const eraYear = year - 2018; // 令和元年を2019年とする
    const eraName = eraYear > 0 ? `令和${eraYear}年` : `平成${year - 1988}年`;

    if (settings.culturalContext) {
      return `${eraName}${month}月${day}日（${dayOfWeek}曜日）`;
    } else {
      return `${year}年${month}月${day}日（${dayOfWeek}曜日）`;
    }
  }, [settings.culturalContext]);

  /**
   * 日本語形式での時刻フォーマット
   */
  const formatTimeJapanese = React.useCallback((date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // 24時間制 vs 12時間制
    if (settings.culturalContext) {
      // 12時間制（午前/午後）
      const period = hours < 12 ? '午前' : '午後';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${period}${displayHours}時${minutes.toString().padStart(2, '0')}分`;
    } else {
      // 24時間制
      return `${hours}時${minutes.toString().padStart(2, '0')}分`;
    }
  }, [settings.culturalContext]);

  /**
   * 日本語形式での数値フォーマット
   */
  const formatNumberJapanese = React.useCallback((number: number): string => {
    // 大きな数値の日本語表記
    if (number >= 100000000) { // 1億以上
      const oku = Math.floor(number / 100000000);
      const remainder = number % 100000000;
      if (remainder === 0) {
        return `${oku}億`;
      } else {
        const man = Math.floor(remainder / 10000);
        if (man === 0) {
          return `${oku}億${remainder}`;
        } else {
          return `${oku}億${man}万`;
        }
      }
    } else if (number >= 10000) { // 1万以上
      const man = Math.floor(number / 10000);
      const remainder = number % 10000;
      if (remainder === 0) {
        return `${man}万`;
      } else {
        return `${man}万${remainder}`;
      }
    } else {
      return number.toLocaleString('ja-JP');
    }
  }, []);

  const contextValue: JapaneseAccessibilityContextType = {
    settings,
    updateSettings,
    formatPoliteText,
    addFurigana,
    formatDateJapanese,
    formatTimeJapanese,
    formatNumberJapanese
  };

  return (
    <JapaneseAccessibilityContext.Provider value={contextValue}>
      {children}
    </JapaneseAccessibilityContext.Provider>
  );
};

/**
 * 日本語アクセシビリティフック
 */
export const useJapaneseAccessibility = (): JapaneseAccessibilityContextType => {
  const context = React.useContext(JapaneseAccessibilityContext);
  
  if (context === undefined) {
    throw new Error('useJapaneseAccessibility must be used within a JapaneseAccessibilityProvider');
  }
  
  return context;
};

/**
 * 日本語対応アクセシブルテキスト
 */
export interface JapaneseAccessibleTextProps {
  children: string;
  furigana?: string;
  isPolite?: boolean;
  level?: 'formal' | 'polite' | 'casual';
  style?: any;
  accessibilityLabel?: string;
  testID?: string;
}

export const JapaneseAccessibleText: React.FC<JapaneseAccessibleTextProps> = ({
  children,
  furigana,
  isPolite,
  level = 'polite',
  style,
  accessibilityLabel,
  testID
}) => {
  const { formatPoliteText, addFurigana } = useJapaneseAccessibility();
  
  // レベルに応じた敬語変換
  const shouldUsePolite = isPolite ?? (level === 'formal' || level === 'polite');
  
  let formattedText = formatPoliteText(children, shouldUsePolite);
  
  if (furigana) {
    formattedText = addFurigana(formattedText, furigana);
  }

  const finalAccessibilityLabel = accessibilityLabel || formattedText;

  return (
    <AccessibleText
      style={style}
      accessibilityLabel={finalAccessibilityLabel}
      testID={testID}
    >
      {formattedText}
    </AccessibleText>
  );
};

/**
 * 日本語対応日時表示
 */
export interface JapaneseDateTimeProps {
  date: Date;
  format: 'date' | 'time' | 'datetime';
  style?: any;
  accessibilityLabel?: string;
}

export const JapaneseDateTime: React.FC<JapaneseDateTimeProps> = ({
  date,
  format,
  style,
  accessibilityLabel
}) => {
  const { formatDateJapanese, formatTimeJapanese } = useJapaneseAccessibility();
  
  const formattedText = React.useMemo(() => {
    switch (format) {
      case 'date':
        return formatDateJapanese(date);
      case 'time':
        return formatTimeJapanese(date);
      case 'datetime':
        return `${formatDateJapanese(date)} ${formatTimeJapanese(date)}`;
      default:
        return date.toLocaleString('ja-JP');
    }
  }, [date, format, formatDateJapanese, formatTimeJapanese]);

  return (
    <AccessibleText
      style={style}
      accessibilityLabel={accessibilityLabel || `日時: ${formattedText}`}
    >
      {formattedText}
    </AccessibleText>
  );
};

/**
 * 日本語対応数値表示
 */
export interface JapaneseNumberProps {
  value: number;
  unit?: string;
  style?: any;
  accessibilityLabel?: string;
}

export const JapaneseNumber: React.FC<JapaneseNumberProps> = ({
  value,
  unit,
  style,
  accessibilityLabel
}) => {
  const { formatNumberJapanese } = useJapaneseAccessibility();
  
  const formattedText = React.useMemo(() => {
    const numberText = formatNumberJapanese(value);
    return unit ? `${numberText}${unit}` : numberText;
  }, [value, unit, formatNumberJapanese]);

  return (
    <AccessibleText
      style={style}
      accessibilityLabel={accessibilityLabel || formattedText}
    >
      {formattedText}
    </AccessibleText>
  );
};

/**
 * 日本語アクセシビリティ設定画面
 */
export const JapaneseAccessibilitySettings: React.FC<{
  style?: ViewStyle;
}> = ({ style }) => {
  const { settings, updateSettings } = useJapaneseAccessibility();

  return (
    <View style={[styles.container, style]}>
      <AccessibleHeading level={2} style={styles.title}>
        日本語アクセシビリティ設定
      </AccessibleHeading>

      <View style={styles.settingGroup}>
        <AccessibleHeading level={3} style={styles.groupTitle}>
          言語設定
        </AccessibleHeading>

        <View style={styles.settingItem}>
          <AccessibleText style={styles.settingLabel}>
            敬語を使用する
          </AccessibleText>
          <AccessibleButton
            onPress={() => updateSettings({ usePoliteLanguage: !settings.usePoliteLanguage })}
            style={settings.usePoliteLanguage ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}
            accessibilityLabel={`敬語の使用: ${settings.usePoliteLanguage ? 'オン' : 'オフ'}`}
            accessibilityRole="switch"
          >
            {settings.usePoliteLanguage ? 'オン' : 'オフ'}
          </AccessibleButton>
        </View>

        <View style={styles.settingItem}>
          <AccessibleText style={styles.settingLabel}>
            漢字を使用する
          </AccessibleText>
          <AccessibleButton
            onPress={() => updateSettings({ useKanji: !settings.useKanji })}
            style={settings.useKanji ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}
            accessibilityLabel={`漢字の使用: ${settings.useKanji ? 'オン' : 'オフ'}`}
            accessibilityRole="switch"
          >
            {settings.useKanji ? 'オン' : 'オフ'}
          </AccessibleButton>
        </View>

        <View style={styles.settingItem}>
          <AccessibleText style={styles.settingLabel}>
            読み方ガイド
          </AccessibleText>
          <AccessibleButton
            onPress={() => updateSettings({ pronunciationGuide: !settings.pronunciationGuide })}
            style={settings.pronunciationGuide ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}
            accessibilityLabel={`読み方ガイド: ${settings.pronunciationGuide ? 'オン' : 'オフ'}`}
            accessibilityRole="switch"
          >
            {settings.pronunciationGuide ? 'オン' : 'オフ'}
          </AccessibleButton>
        </View>
      </View>

      <View style={styles.settingGroup}>
        <AccessibleHeading level={3} style={styles.groupTitle}>
          文化的設定
        </AccessibleHeading>

        <View style={styles.settingItem}>
          <AccessibleText style={styles.settingLabel}>
            和暦・12時間制を使用
          </AccessibleText>
          <AccessibleButton
            onPress={() => updateSettings({ culturalContext: !settings.culturalContext })}
            style={settings.culturalContext ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}
            accessibilityLabel={`文化的コンテキスト: ${settings.culturalContext ? 'オン' : 'オフ'}`}
            accessibilityRole="switch"
          >
            {settings.culturalContext ? 'オン' : 'オフ'}
          </AccessibleButton>
        </View>
      </View>

      <View style={styles.settingGroup}>
        <AccessibleHeading level={3} style={styles.groupTitle}>
          読み上げ設定
        </AccessibleHeading>

        <View style={styles.settingItem}>
          <AccessibleText style={styles.settingLabel}>
            読み上げ速度
          </AccessibleText>
          <View style={styles.speedButtons}>
            {(['slow', 'normal', 'fast'] as const).map((speed) => (
              <AccessibleButton
                key={speed}
                onPress={() => updateSettings({ readingSpeed: speed })}
                style={settings.readingSpeed === speed ? {...styles.speedButton, ...styles.speedButtonActive} : styles.speedButton}
                accessibilityLabel={`読み上げ速度: ${speed === 'slow' ? 'ゆっくり' : speed === 'normal' ? '普通' : '速い'}`}
                accessibilityRole="button"
              >
                {speed === 'slow' ? 'ゆっくり' : speed === 'normal' ? '普通' : '速い'}
              </AccessibleButton>
            ))}
          </View>
        </View>
      </View>

      {/* 設定プレビュー */}
      <View style={styles.previewSection}>
        <AccessibleHeading level={3} style={styles.groupTitle}>
          設定プレビュー
        </AccessibleHeading>

        <View style={styles.previewItem}>
          <AccessibleText style={styles.previewLabel}>日付表示例:</AccessibleText>
          <JapaneseDateTime
            date={new Date()}
            format="date"
            style={styles.previewValue}
          />
        </View>

        <View style={styles.previewItem}>
          <AccessibleText style={styles.previewLabel}>時刻表示例:</AccessibleText>
          <JapaneseDateTime
            date={new Date()}
            format="time"
            style={styles.previewValue}
          />
        </View>

        <View style={styles.previewItem}>
          <AccessibleText style={styles.previewLabel}>数値表示例:</AccessibleText>
          <JapaneseNumber
            value={12345}
            unit="円"
            style={styles.previewValue}
          />
        </View>

        <View style={styles.previewItem}>
          <AccessibleText style={styles.previewLabel}>敬語例:</AccessibleText>
          <JapaneseAccessibleText
            furigana="とうこう"
            style={styles.previewValue}
          >
            投稿する
          </JapaneseAccessibleText>
        </View>
      </View>
    </View>
  );
};

/**
 * 日本の支援技術との互換性チェック
 */
export const useJapaneseAssistiveTechCompatibility = () => {
  const [compatibility, setCompatibility] = React.useState({
    pcTalker: false,    // PC-Talker
    jaws: false,        // JAWS
    nvda: false,        // NVDA
    voiceOver: false,   // VoiceOver (iOS)
    talkBack: false     // TalkBack (Android)
  });

  React.useEffect(() => {
    const checkCompatibility = () => {
      // プラットフォーム別の支援技術検出
      if (Platform.OS === 'ios') {
        setCompatibility(prev => ({ ...prev, voiceOver: true }));
      } else if (Platform.OS === 'android') {
        setCompatibility(prev => ({ ...prev, talkBack: true }));
      } else {
        // Web環境での検出（簡易版）
        const userAgent = navigator.userAgent.toLowerCase();
        setCompatibility(prev => ({
          ...prev,
          nvda: userAgent.includes('nvda'),
          jaws: userAgent.includes('jaws')
        }));
      }
    };

    checkCompatibility();
  }, []);

  return compatibility;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center'
  },
  settingGroup: {
    marginBottom: 24
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF'
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8
  },
  settingLabel: {
    fontSize: 16,
    flex: 1
  },
  toggleButton: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF'
  },
  speedButtons: {
    flexDirection: 'row',
    gap: 8
  },
  speedButton: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  speedButtonActive: {
    backgroundColor: '#007AFF'
  },
  previewSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  previewLabel: {
    fontSize: 14,
    color: '#666666',
    width: 100
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  }
});

export default JapaneseAccessibilityProvider;