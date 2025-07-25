# 設計文書

## 概要

Mamapaceアプリのアクセシビリティ対応を実装するための包括的な設計です。React NativeとExpoの標準的なアクセシビリティAPIを活用し、WCAG 2.1 AA準拠を目指します。特に日本の母親ユーザーの深夜使用と片手操作のニーズに配慮した設計を行います。

## アーキテクチャ

### アクセシビリティレイヤー構造

```
AccessibilityLayer/
├── providers/
│   ├── AccessibilityProvider.tsx     # アクセシビリティ設定の管理
│   └── ScreenReaderProvider.tsx     # スクリーンリーダー対応
├── hooks/
│   ├── useAccessibility.ts          # アクセシビリティ状態管理
│   ├── useScreenReader.ts           # スクリーンリーダー検出
│   ├── useFocusManagement.ts        # フォーカス管理
│   └── useOneHandedMode.ts          # 片手操作モード
├── components/
│   ├── AccessibleButton.tsx         # アクセシブルボタン
│   ├── AccessibleText.tsx           # アクセシブルテキスト
│   ├── AccessibleImage.tsx          # 代替テキスト付き画像
│   ├── AccessibleInput.tsx          # アクセシブル入力フィールド
│   └── FocusIndicator.tsx           # フォーカス表示
├── utils/
│   ├── accessibilityUtils.ts        # アクセシビリティユーティリティ
│   ├── contrastChecker.ts           # コントラスト比チェック
│   └── tapTargetValidator.ts        # タップターゲットサイズ検証
└── constants/
    ├── accessibilityLabels.ts       # アクセシビリティラベル定数
    └── accessibilityRoles.ts        # アクセシビリティロール定数
```

## コンポーネントと インターフェース

### 1. AccessibilityProvider

```typescript
interface AccessibilitySettings {
  screenReaderEnabled: boolean;
  highContrastMode: boolean;
  largeTextMode: boolean;
  oneHandedMode: boolean;
  reducedMotion: boolean;
  hapticFeedbackEnabled: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  isScreenReaderActive: boolean;
  announceForScreenReader: (message: string) => void;
}
```

### 2. アクセシブルコンポーネント

```typescript
// AccessibleButton
interface AccessibleButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
  minTouchTarget?: boolean; // 48dp最小サイズ強制
}

// AccessibleText
interface AccessibleTextProps {
  children: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'text' | 'header';
  semanticLevel?: 1 | 2 | 3 | 4 | 5 | 6; // ヘッダーレベル
  highContrast?: boolean;
}

// AccessibleImage
interface AccessibleImageProps {
  source: ImageSourcePropType;
  alt: string; // 必須の代替テキスト
  decorative?: boolean; // 装飾的画像の場合true
  accessibilityLabel?: string;
}
```

### 3. フォーカス管理システム

```typescript
interface FocusManager {
  setFocusOrder: (elements: RefObject<any>[]) => void;
  moveFocusToNext: () => void;
  moveFocusToPrevious: () => void;
  trapFocus: (container: RefObject<any>) => void;
  releaseFocusTrap: () => void;
  announcePageChange: (pageName: string) => void;
}
```

## データモデル

### アクセシビリティ設定

```typescript
interface UserAccessibilityPreferences {
  userId: string;
  screenReaderOptimized: boolean;
  highContrastEnabled: boolean;
  textSizeMultiplier: number; // 1.0 - 2.0
  oneHandedModeEnabled: boolean;
  hapticFeedbackLevel: 'none' | 'light' | 'medium' | 'strong';
  reducedMotionEnabled: boolean;
  colorBlindnessType?: 'protanopia' | 'deuteranopia' | 'tritanopia';
  customColorScheme?: ColorScheme;
}
```

### アクセシビリティ監査データ

```typescript
interface AccessibilityAuditResult {
  componentName: string;
  issues: AccessibilityIssue[];
  score: number; // 0-100
  timestamp: Date;
}

interface AccessibilityIssue {
  type: 'contrast' | 'tap-target' | 'label' | 'focus' | 'semantic';
  severity: 'error' | 'warning' | 'info';
  description: string;
  element: string;
  suggestion: string;
}
```

## エラーハンドリング

### アクセシビリティエラー処理

```typescript
class AccessibilityErrorHandler {
  static handleScreenReaderError(error: Error): void;
  static handleFocusError(error: Error): void;
  static handleContrastError(error: Error): void;
  static logAccessibilityIssue(issue: AccessibilityIssue): void;
}
```

### フォールバック機能

1. **スクリーンリーダー検出失敗時**: 手動設定オプションを提供
2. **フォーカス管理エラー時**: デフォルトのタブ順序に戻す
3. **ハプティックフィードバック失敗時**: 視覚的フィードバックで代替
4. **コントラスト調整失敗時**: 高コントラストモードを強制適用

## テスト戦略

### 1. 自動テスト

```typescript
// アクセシビリティテストスイート
describe('Accessibility Compliance', () => {
  test('すべてのボタンに適切なアクセシビリティラベルがある');
  test('タップターゲットが最小48dpサイズを満たす');
  test('コントラスト比が4.5:1以上である');
  test('フォーカス順序が論理的である');
  test('スクリーンリーダーで全機能にアクセス可能');
});
```

### 2. 手動テスト

- **スクリーンリーダーテスト**: VoiceOver (iOS), TalkBack (Android)
- **キーボードナビゲーションテスト**: 外部キーボード接続時
- **片手操作テスト**: 実際の授乳姿勢での操作確認
- **色覚異常シミュレーション**: 各種色覚異常での表示確認

### 3. ユーザビリティテスト

- 視覚障害を持つ母親ユーザーでのテスト
- 運動機能に制限がある母親ユーザーでのテスト
- 深夜使用シナリオでのテスト

## 実装詳細

### 1. React Native アクセシビリティAPI活用

```typescript
// 基本的なアクセシビリティプロパティ
<TouchableOpacity
  accessible={true}
  accessibilityLabel="投稿にいいねする"
  accessibilityHint="この投稿に共感を示します"
  accessibilityRole="button"
  accessibilityState={{ selected: isLiked }}
  onPress={handleLike}
>
```

### 2. 片手操作最適化

```typescript
// 片手操作ゾーン定義
const ONE_HANDED_ZONES = {
  EASY: { bottom: 0, height: '30%' },      // 親指で簡単に届く
  MEDIUM: { bottom: '30%', height: '40%' }, // 少し伸ばせば届く
  HARD: { bottom: '70%', height: '30%' }    // 届きにくい
};

// 重要な操作を簡単ゾーンに配置
const OneHandedLayout = ({ children }) => {
  const { oneHandedMode } = useAccessibility();
  
  if (oneHandedMode) {
    return (
      <View style={styles.oneHandedContainer}>
        <View style={styles.contentArea}>{children}</View>
        <View style={styles.actionArea}>
          {/* 主要操作ボタン */}
        </View>
      </View>
    );
  }
  
  return children;
};
```

### 3. 動的コントラスト調整

```typescript
const useContrastAdjustment = () => {
  const { highContrastMode } = useAccessibility();
  
  const getContrastAdjustedColor = useCallback((baseColor: string) => {
    if (highContrastMode) {
      return adjustColorContrast(baseColor, 7.0); // AAA準拠
    }
    return adjustColorContrast(baseColor, 4.5); // AA準拠
  }, [highContrastMode]);
  
  return { getContrastAdjustedColor };
};
```

### 4. スクリーンリーダー最適化

```typescript
const useScreenReaderAnnouncements = () => {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    } else {
      // Android用の実装
      AccessibilityInfo.setAccessibilityFocus(findNodeHandle(ref.current));
    }
  }, []);
  
  return { announce };
};
```

## パフォーマンス考慮事項

### 1. レンダリング最適化

- アクセシビリティ設定変更時の不要な再レンダリングを防止
- 大きなリストでのアクセシビリティ情報の遅延読み込み
- スクリーンリーダー使用時の画像読み込み最適化

### 2. メモリ使用量

- アクセシビリティラベルの効率的なキャッシュ
- 不要なアクセシビリティイベントリスナーの削除
- フォーカス管理の軽量化

## セキュリティ考慮事項

### 1. プライバシー保護

- スクリーンリーダーによる機密情報の読み上げ制御
- アクセシビリティログの個人情報除去
- 音声入力時の一時的なデータ保護

### 2. 入力検証

- アクセシビリティ設定の不正値チェック
- 外部アクセシビリティサービスとの安全な連携

## 国際化対応

### 1. 日本語最適化

```typescript
const ACCESSIBILITY_LABELS_JA = {
  LIKE_BUTTON: '共感ボタン',
  COMMENT_BUTTON: 'コメントボタン',
  SHARE_BUTTON: 'シェアボタン',
  NAVIGATION_HOME: 'ホーム画面に移動',
  NAVIGATION_NOTIFICATIONS: '通知画面に移動',
  POST_CONTENT: '投稿内容',
  USER_PROFILE: 'ユーザープロフィール'
};
```

### 2. 文化的配慮

- 日本の母親コミュニティに適したアクセシビリティ表現
- 敬語を使用したスクリーンリーダー読み上げ
- 日本の障害者支援技術との互換性確保