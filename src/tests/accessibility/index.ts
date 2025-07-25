/**
 * アクセシビリティテストモジュール
 * 
 * Mamapaceアプリケーションのアクセシビリティテストスイート
 * WCAG 2.1 準拠の包括的なテストを提供します。
 */

export { default as AccessibilityTestSuite } from './AccessibilityTestSuite';
export { default as ContrastValidator } from './ContrastValidator';
export { default as TapTargetValidator } from './TapTargetValidator';
export { default as ScreenReaderTester } from './ScreenReaderTester';
export { default as AccessibilityTestRunner } from './AccessibilityTestRunner';

// 型定義をエクスポート
export type {
  AccessibilityTestResult,
  AccessibilityTestSummary
} from './AccessibilityTestSuite';

export type {
  ColorPair,
  ContrastTestResult,
  ContrastValidationSummary
} from './ContrastValidator';

export type {
  TapTargetElement,
  TapTargetTestResult,
  TapTargetValidationSummary,
  ProximityWarning
} from './TapTargetValidator';

export type {
  ScreenReaderElement,
  ScreenReaderTestResult,
  ScreenReaderTestSummary
} from './ScreenReaderTester';

export type {
  ComprehensiveTestResult
} from './AccessibilityTestRunner';

/**
 * クイック実行関数
 * 
 * 全てのアクセシビリティテストを一度に実行する便利関数
 */
export async function runAccessibilityTests(): Promise<void> {
  console.log('🚀 Mamapace アクセシビリティテストスイートを開始...');
  
  const { AccessibilityTestRunner } = await import('./AccessibilityTestRunner');
  const runner = new AccessibilityTestRunner();
  
  try {
    const results = await runner.runComprehensiveTests();
    
    // 結果をファイルに保存（実際の実装では適切なパスを指定）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `accessibility-test-results-${timestamp}.json`;
    
    console.log(`\n📊 テスト結果の概要:`);
    console.log(`   総合スコア: ${results.overallScore}%`);
    console.log(`   WCAG AA準拠: ${results.wcagCompliance.levelAA ? '✅' : '❌'}`);
    console.log(`   重大な問題: ${results.summary.criticalIssues}個`);
    
    if (results.summary.criticalIssues > 0) {
      console.log(`\n🚨 重大な問題が見つかりました。詳細なレポートを確認してください。`);
    } else if (results.wcagCompliance.levelAA) {
      console.log(`\n✅ おめでとうございます！WCAG 2.1 AA準拠を達成しました。`);
    } else {
      console.log(`\n⚠️  いくつかの改善点があります。推奨事項を確認してください。`);
    }
    
  } catch (error) {
    console.error('❌ アクセシビリティテストの実行中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * 開発モード用の簡易テスト実行
 */
export async function runQuickAccessibilityCheck(): Promise<boolean> {
  console.log('⚡ クイックアクセシビリティチェックを実行...');
  
  const { AccessibilityTestRunner } = await import('./AccessibilityTestRunner');
  const runner = new AccessibilityTestRunner();
  
  try {
    const results = await runner.runComprehensiveTests();
    
    // 簡易判定（重大な問題がなく、基本的な準拠ができているか）
    const isBasicCompliant = results.summary.criticalIssues === 0 && 
                            results.overallScore >= 70;
    
    console.log(`結果: ${isBasicCompliant ? '✅ 基本要件を満たしています' : '❌ 改善が必要です'}`);
    console.log(`スコア: ${results.overallScore}%`);
    
    return isBasicCompliant;
    
  } catch (error) {
    console.error('❌ クイックチェックでエラーが発生:', error);
    return false;
  }
}

/**
 * 特定のコンポーネントのアクセシビリティをテスト
 */
export async function testComponentAccessibility(
  componentName: string,
  componentData: any
): Promise<boolean> {
  console.log(`🔍 ${componentName} のアクセシビリティをテスト中...`);
  
  const { ScreenReaderTester } = await import('./ScreenReaderTester');
  const tester = new ScreenReaderTester();
  
  // コンポーネントデータを要素として追加
  if (componentData.elements) {
    tester.addElements(componentData.elements);
  }
  
  const results = await tester.runAllTests();
  
  const isCompliant = results.criticalIssues === 0 && 
                     results.overallScore >= 80;
  
  console.log(`${componentName} の結果: ${isCompliant ? '✅ 合格' : '❌ 要改善'}`);
  
  return isCompliant;
}

/**
 * CI/CD環境でのテスト実行
 */
export async function runCIAccessibilityTests(): Promise<{
  success: boolean;
  score: number;
  wcagCompliant: boolean;
  criticalIssues: number;
}> {
  console.log('🤖 CI/CD環境でアクセシビリティテストを実行...');
  
  const { AccessibilityTestRunner } = await import('./AccessibilityTestRunner');
  const runner = new AccessibilityTestRunner();
  
  try {
    const results = await runner.runComprehensiveTests();
    
    // CI用の結果を生成
    const ciReport = runner.generateCIReport(results);
    console.log('CI Report:\n', ciReport);
    
    return {
      success: results.wcagCompliance.levelAA && results.summary.criticalIssues === 0,
      score: results.overallScore,
      wcagCompliant: results.wcagCompliance.levelAA,
      criticalIssues: results.summary.criticalIssues
    };
    
  } catch (error) {
    console.error('❌ CI テストでエラーが発生:', error);
    
    return {
      success: false,
      score: 0,
      wcagCompliant: false,
      criticalIssues: 999
    };
  }
}

/**
 * 使用例とテストコマンド
 */
export const USAGE_EXAMPLES = {
  comprehensive: `
// 包括的なテストを実行
import { runAccessibilityTests } from './tests/accessibility';
await runAccessibilityTests();
`,
  
  quick: `
// クイックチェックを実行
import { runQuickAccessibilityCheck } from './tests/accessibility';
const isCompliant = await runQuickAccessibilityCheck();
`,
  
  component: `
// 特定のコンポーネントをテスト
import { testComponentAccessibility } from './tests/accessibility';
const isCompliant = await testComponentAccessibility('PostCard', {
  elements: [/* 要素データ */]
});
`,
  
  individual: `
// 個別のテストスイートを実行
import { ContrastValidator, TapTargetValidator } from './tests/accessibility';

const contrastValidator = new ContrastValidator();
const contrastResults = contrastValidator.validateAllContrasts();

const tapTargetValidator = new TapTargetValidator();
tapTargetValidator.addSampleElements();
const tapTargetResults = tapTargetValidator.validateAllTargets();
`
};

// デフォルトエクスポート（メイン実行関数）
export default runAccessibilityTests;