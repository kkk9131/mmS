# アクセシビリティテストスイート

Mamapaceアプリケーションのアクセシビリティを包括的にテストするためのテストスイートです。WCAG 2.1ガイドラインに基づいて、自動的にアクセシビリティ準拠を検証します。

## 📋 目次

- [概要](#概要)
- [テストカテゴリ](#テストカテゴリ)
- [使用方法](#使用方法)
- [テストスイート詳細](#テストスイート詳細)
- [レポート](#レポート)
- [CI/CD統合](#cicd統合)
- [カスタマイズ](#カスタマイズ)

## 🎯 概要

このテストスイートは以下の機能を提供します：

- **包括的テスト**: 4つの主要カテゴリでアクセシビリティを検証
- **WCAG準拠チェック**: Level A/AA/AAA の準拠状況を自動判定
- **詳細レポート**: 問題点と改善提案を含む詳細なレポート
- **CI/CD対応**: 継続的インテグレーションに組み込み可能
- **カスタマイズ可能**: プロジェクト固有の要件に対応

## 🧪 テストカテゴリ

### 1. 基本アクセシビリティテスト (`AccessibilityTestSuite`)
- スクリーンリーダー検出
- セマンティックラベルの存在確認
- アクセシビリティヒントの検証
- ライブリージョンの実装確認

### 2. コントラスト比テスト (`ContrastValidator`)
- WCAG基準に基づくコントラスト比計算
- 色覚異常シミュレーション
- 高コントラストモードの検証
- 改善提案の生成

### 3. タップターゲットテスト (`TapTargetValidator`)
- 最小サイズ（48×48px）の検証
- 要素間の適切な間隔チェック
- 誤タップ防止機能の確認
- タイプ別推奨事項の提供

### 4. スクリーンリーダーテスト (`ScreenReaderTester`)
- アクセシビリティラベルの品質評価
- セマンティック役割の適切性
- 状態情報の完全性
- 読み上げ順序の論理性

## 🚀 使用方法

### 基本的な使用方法

```typescript
import { runAccessibilityTests } from './src/tests/accessibility';

// 包括的なテストを実行
await runAccessibilityTests();
```

### クイックチェック

```typescript
import { runQuickAccessibilityCheck } from './src/tests/accessibility';

// 開発中の簡易チェック
const isCompliant = await runQuickAccessibilityCheck();
console.log(`基本要件: ${isCompliant ? '満たしている' : '要改善'}`);
```

### 個別テストスイートの実行

```typescript
import { 
  AccessibilityTestRunner,
  ContrastValidator,
  TapTargetValidator,
  ScreenReaderTester 
} from './src/tests/accessibility';

// 統合テストランナー
const runner = new AccessibilityTestRunner();
const results = await runner.runComprehensiveTests();

// 個別のテスト実行
const contrastValidator = new ContrastValidator();
const contrastResults = contrastValidator.validateAllContrasts();
contrastValidator.printValidationResults(contrastResults);
```

### コンポーネント固有のテスト

```typescript
import { testComponentAccessibility } from './src/tests/accessibility';

// 特定のコンポーネントをテスト
const componentData = {
  elements: [
    {
      id: 'btn-submit',
      name: '送信ボタン',
      accessibilityLabel: '投稿を送信',
      accessibilityRole: 'button',
      isAccessible: true
    }
  ]
};

const isCompliant = await testComponentAccessibility('PostCard', componentData);
```

## 📊 テストスイート詳細

### AccessibilityTestSuite

基本的なアクセシビリティ機能をテストします。

```typescript
const testSuite = new AccessibilityTestSuite();
const results = await testSuite.runAllTests();

console.log(`総合スコア: ${results.overallScore}%`);
console.log(`WCAG AA準拠: ${results.wcagCompliance.levelAA}`);
```

### ContrastValidator

色のコントラスト比を詳細に検証します。

```typescript
const validator = new ContrastValidator();

// カスタムカラーペアを追加
validator.addColorPair({
  name: 'カスタムボタン',
  foreground: '#FF6B35',
  background: '#FFFFFF',
  isLargeText: false,
  category: 'button'
});

const results = validator.validateAllContrasts();
validator.printValidationResults(results);
```

### TapTargetValidator

タップ可能要素のサイズと配置を検証します。

```typescript
const validator = new TapTargetValidator();

// テスト要素を追加
validator.addElement({
  id: 'btn-custom',
  name: 'カスタムボタン',
  x: 50,
  y: 100,
  width: 120,
  height: 48,
  type: 'button',
  isEssential: true,
  hasLabel: true
});

const results = validator.validateAllTargets();
validator.printValidationResults(results);
```

### ScreenReaderTester

スクリーンリーダー対応を包括的にテストします。

```typescript
const tester = new ScreenReaderTester();

// テスト要素を追加
tester.addElement({
  id: 'header-main',
  name: 'メインヘッダー',
  accessibilityLabel: 'Mamapace - 母親のためのSNS',
  accessibilityRole: 'header',
  isAccessible: true
});

const results = await tester.runAllTests();
tester.printTestResults(results);
```

## 📋 レポート

### コンソール出力

各テストスイートは詳細なコンソール出力を提供します：

```
🏆 包括的アクセシビリティテスト結果
================================================================================
📊 総合評価:
   総合スコア: 87% 🥈
   実行日時: 2024/7/24 10:30:00

🏅 WCAG 2.1 準拠状況:
   Level A:   ✅ 準拠
   Level AA:  ✅ 準拠
   Level AAA: ❌ 非準拠

📈 テスト統計:
   総テスト数: 45
   合格: 39 (87%)
   失敗: 3 (7%)
   警告: 3 (7%)
```

### HTMLレポート

HTMLレポートを生成することも可能です：

```typescript
const runner = new AccessibilityTestRunner();
const results = await runner.runComprehensiveTests();
const htmlReport = runner.generateHTMLReport(results);

// HTMLファイルとして保存
await fs.writeFile('accessibility-report.html', htmlReport);
```

### JSONエクスポート

テスト結果をJSONとして保存できます：

```typescript
const results = await runner.runComprehensiveTests();
await runner.saveResultsToFile(results, 'accessibility-results.json');
```

## 🔄 CI/CD統合

### GitHub Actions

```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run accessibility tests
        run: npm run test:accessibility
      
      - name: Check results
        run: |
          if [ $ACCESSIBILITY_TEST_RESULT == "FAIL" ]; then
            echo "❌ アクセシビリティテストが失敗しました"
            exit 1
          fi
```

### NPMスクリプト

`package.json`にテストスクリプトを追加：

```json
{
  "scripts": {
    "test:accessibility": "node -e \"require('./src/tests/accessibility').runCIAccessibilityTests()\"",
    "test:accessibility:quick": "node -e \"require('./src/tests/accessibility').runQuickAccessibilityCheck()\"",
    "test:accessibility:full": "node -e \"require('./src/tests/accessibility').runAccessibilityTests()\""
  }
}
```

## ⚙️ カスタマイズ

### カスタムカラーパレット

プロジェクト固有の色をテストに追加：

```typescript
const contrastValidator = new ContrastValidator();

const customColors = [
  {
    name: 'ブランドプライマリ',
    foreground: '#FF6B9D',
    background: '#FFFFFF',
    category: 'brand'
  },
  {
    name: 'ブランドセカンダリ',
    foreground: '#4ECDC4',
    background: '#2C3E50',
    category: 'brand'
  }
];

contrastValidator.addColorPairs(customColors);
```

### カスタムテスト条件

独自のバリデーションルールを追加：

```typescript
class CustomAccessibilityValidator extends AccessibilityTestSuite {
  async runCustomTests() {
    // プロジェクト固有のテストロジック
    const customResult = this.validateCustomRequirement();
    this.testResults.push(customResult);
  }
  
  private validateCustomRequirement() {
    // カスタムバリデーション実装
    return {
      id: 'custom-001',
      name: '独自要件チェック',
      status: 'pass',
      // ... その他の結果データ
    };
  }
}
```

## 🔧 設定オプション

### 環境変数

```bash
# テストの詳細度設定
ACCESSIBILITY_TEST_VERBOSE=true

# 特定のテストスイートのみ実行
ACCESSIBILITY_TEST_SUITES=contrast,tap-target

# レポート出力形式
ACCESSIBILITY_REPORT_FORMAT=html,json,console
```

### 設定ファイル

`accessibility.config.js`:

```javascript
module.exports = {
  // 最小要求サイズをカスタマイズ
  tapTarget: {
    minimumSize: 48,
    recommendedSize: 56
  },
  
  // コントラスト基準をカスタマイズ
  contrast: {
    level: 'AAA',
    largeTextThreshold: 18
  },
  
  // 除外するテスト
  skipTests: ['sr-003', 'contrast-warning-messages'],
  
  // カスタムWCAGレベル要件
  wcagRequirements: {
    levelA: ['1.1.1', '1.3.1', '2.1.1'],
    levelAA: ['1.4.3', '1.4.11', '2.5.5'],
    levelAAA: ['1.4.6', '2.5.5']
  }
};
```

## 🐛 トラブルシューティング

### よくある問題

1. **スクリーンリーダーが検出されない**
   ```typescript
   // デバッグ用のログを追加
   console.log('Screen reader status:', await AccessibilityInfo.isScreenReaderEnabled());
   ```

2. **コントラスト計算の精度**
   ```typescript
   // 16進数カラーの形式を確認
   const color = '#FF6B9D'; // 正しい形式
   const invalidColor = 'FF6B9D'; // 不正（#なし）
   ```

3. **タップターゲットサイズの測定**
   ```typescript
   // パディングを含むサイズを考慮
   const effectiveSize = {
     width: actualWidth + paddingHorizontal * 2,
     height: actualHeight + paddingVertical * 2
   };
   ```

## 📚 参考資料

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [iOS Human Interface Guidelines - Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)

## 🤝 コントリビューション

バグ報告や機能提案は、プロジェクトのIssueトラッカーまでお願いします。

## 📄 ライセンス

このテストスイートはMamapaceプロジェクトの一部として提供されています。