/**
 * アクセシビリティテストランナー
 * 
 * 全てのアクセシビリティテストを統合実行し、
 * 包括的なレポートを生成します。
 */

import AccessibilityTestSuite from './AccessibilityTestSuite';
import ContrastValidator from './ContrastValidator';
import TapTargetValidator from './TapTargetValidator';
import ScreenReaderTester from './ScreenReaderTester';

export interface ComprehensiveTestResult {
  timestamp: string;
  overallScore: number;
  wcagCompliance: {
    levelA: boolean;
    levelAA: boolean;
    levelAAA: boolean;
  };
  testSuites: {
    accessibility: any;
    contrast: any;
    tapTarget: any;
    screenReader: any;
  };
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
    criticalIssues: number;
    majorIssues: number;
    minorIssues: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

/**
 * アクセシビリティテストランナークラス
 */
export class AccessibilityTestRunner {
  private accessibilityTestSuite: AccessibilityTestSuite;
  private contrastValidator: ContrastValidator;
  private tapTargetValidator: TapTargetValidator;
  private screenReaderTester: ScreenReaderTester;

  constructor() {
    this.accessibilityTestSuite = new AccessibilityTestSuite();
    this.contrastValidator = new ContrastValidator();
    this.tapTargetValidator = new TapTargetValidator();
    this.screenReaderTester = new ScreenReaderTester();
  }

  /**
   * 全テストスイートを実行
   */
  public async runComprehensiveTests(): Promise<ComprehensiveTestResult> {
    console.log('🧪 包括的アクセシビリティテストを開始...');
    console.log('='.repeat(70));

    // 各テストスイートを並行実行
    const [
      accessibilityResults,
      contrastResults,
      tapTargetResults,
      screenReaderResults
    ] = await Promise.all([
      this.runAccessibilityTests(),
      this.runContrastTests(),
      this.runTapTargetTests(),
      this.runScreenReaderTests()
    ]);

    // 統合結果を生成
    const comprehensiveResult = this.generateComprehensiveResult({
      accessibility: accessibilityResults,
      contrast: contrastResults,
      tapTarget: tapTargetResults,
      screenReader: screenReaderResults
    });

    // レポートを出力
    this.printComprehensiveReport(comprehensiveResult);

    return comprehensiveResult;
  }

  /**
   * アクセシビリティテストスイートを実行
   */
  private async runAccessibilityTests() {
    console.log('🏗️  基本アクセシビリティテストを実行中...');
    try {
      const results = await this.accessibilityTestSuite.runAllTests();
      console.log('✅ 基本アクセシビリティテスト完了');
      return results;
    } catch (error) {
      console.error('❌ 基本アクセシビリティテストでエラー:', error);
      throw error;
    }
  }

  /**
   * コントラストテストを実行
   */
  private async runContrastTests() {
    console.log('🎨 コントラスト比テストを実行中...');
    try {
      const results = this.contrastValidator.validateAllContrasts();
      console.log('✅ コントラスト比テスト完了');
      return results;
    } catch (error) {
      console.error('❌ コントラスト比テストでエラー:', error);
      throw error;
    }
  }

  /**
   * タップターゲットテストを実行
   */
  private async runTapTargetTests() {
    console.log('👆 タップターゲットテストを実行中...');
    try {
      // サンプル要素を追加
      this.tapTargetValidator.addSampleElements();
      const results = this.tapTargetValidator.validateAllTargets();
      console.log('✅ タップターゲットテスト完了');
      return results;
    } catch (error) {
      console.error('❌ タップターゲットテストでエラー:', error);
      throw error;
    }
  }

  /**
   * スクリーンリーダーテストを実行
   */
  private async runScreenReaderTests() {
    console.log('📱 スクリーンリーダーテストを実行中...');
    try {
      // サンプル要素を追加
      this.screenReaderTester.addSampleElements();
      const results = await this.screenReaderTester.runAllTests();
      console.log('✅ スクリーンリーダーテスト完了');
      return results;
    } catch (error) {
      console.error('❌ スクリーンリーダーテストでエラー:', error);
      throw error;
    }
  }

  /**
   * 統合結果を生成
   */
  private generateComprehensiveResult(testSuites: any): ComprehensiveTestResult {
    // 全体的な統計を計算
    const totalTests = 
      testSuites.accessibility.totalTests +
      testSuites.contrast.totalPairs +
      testSuites.tapTarget.totalElements +
      testSuites.screenReader.totalTests;

    const passedTests = 
      testSuites.accessibility.passedTests +
      testSuites.contrast.passedAA +
      testSuites.tapTarget.passedElements +
      testSuites.screenReader.passedTests;

    const failedTests = 
      testSuites.accessibility.failedTests +
      testSuites.contrast.failed +
      testSuites.tapTarget.failedElements +
      testSuites.screenReader.failedTests;

    const warningTests = 
      testSuites.accessibility.warningTests +
      0 + // コントラストテストには警告カテゴリなし
      testSuites.tapTarget.warningElements +
      testSuites.screenReader.warningTests;

    // 全体スコアを計算
    const overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // WCAG準拠レベルを判定
    const wcagCompliance = {
      levelA: testSuites.accessibility.wcagCompliance.levelA && 
              testSuites.screenReader.overallScore >= 90,
      levelAA: testSuites.accessibility.wcagCompliance.levelAA &&
               testSuites.contrast.overallAACompliance &&
               testSuites.tapTarget.overallCompliance &&
               testSuites.screenReader.overallScore >= 85,
      levelAAA: testSuites.accessibility.wcagCompliance.levelAAA &&
                testSuites.contrast.overallAAACompliance &&
                testSuites.tapTarget.overallCompliance &&
                testSuites.screenReader.overallScore >= 95
    };

    // 問題の重要度別集計
    const criticalIssues = testSuites.screenReader.criticalIssues;
    const majorIssues = testSuites.screenReader.majorIssues + failedTests;
    const minorIssues = testSuites.screenReader.minorIssues + warningTests;

    // 推奨事項を生成
    const recommendations = this.generateRecommendations(testSuites, wcagCompliance);
    const nextSteps = this.generateNextSteps(testSuites, wcagCompliance);

    return {
      timestamp: new Date().toISOString(),
      overallScore,
      wcagCompliance,
      testSuites,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        warningTests,
        criticalIssues,
        majorIssues,
        minorIssues
      },
      recommendations,
      nextSteps
    };
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(testSuites: any, wcagCompliance: any): string[] {
    const recommendations: string[] = [];

    // WCAG準拠レベル別の推奨事項
    if (!wcagCompliance.levelA) {
      recommendations.push('🚨 WCAG Level A準拠のため、基本的なアクセシビリティ問題を優先的に修正してください');
    }

    if (!wcagCompliance.levelAA) {
      recommendations.push('⚠️  WCAG Level AA準拠のため、コントラスト比とタップターゲットサイズを改善してください');
    }

    // 各テストスイート別の推奨事項
    if (testSuites.contrast.failed > 0) {
      recommendations.push(`🎨 ${testSuites.contrast.failed}個のコントラスト比問題を修正してください`);
    }

    if (testSuites.tapTarget.failedElements > 0) {
      recommendations.push(`👆 ${testSuites.tapTarget.failedElements}個のタップターゲットサイズを48×48px以上にしてください`);
    }

    if (testSuites.screenReader.criticalIssues > 0) {
      recommendations.push(`📱 ${testSuites.screenReader.criticalIssues}個の重大なスクリーンリーダー問題を即座に修正してください`);
    }

    // 一般的な推奨事項
    recommendations.push('🔄 実際のスクリーンリーダー（VoiceOver/TalkBack）でのユーザビリティテストを実施してください');
    recommendations.push('👥 障害を持つユーザーからのフィードバックを収集してください');
    recommendations.push('📖 開発チーム向けのアクセシビリティガイドラインを整備してください');

    return recommendations;
  }

  /**
   * 次のステップを生成
   */
  private generateNextSteps(testSuites: any, wcagCompliance: any): string[] {
    const nextSteps: string[] = [];

    // 優先度順のアクションプラン
    if (testSuites.screenReader.criticalIssues > 0) {
      nextSteps.push('1. 【緊急】重大なスクリーンリーダー問題の修正');
    }

    if (testSuites.contrast.failed > 0) {
      nextSteps.push('2. 【高】コントラスト比の改善');
    }

    if (testSuites.tapTarget.failedElements > 0) {
      nextSteps.push('3. 【高】タップターゲットサイズの調整');
    }

    if (!wcagCompliance.levelAA) {
      nextSteps.push('4. 【中】WCAG 2.1 AA準拠の達成');
    }

    // 継続的改善
    nextSteps.push('5. 【低】定期的なアクセシビリティ監査の実施');
    nextSteps.push('6. 【低】アクセシビリティ自動テストのCI/CD統合');
    nextSteps.push('7. 【低】AAA準拠に向けた追加改善');

    return nextSteps;
  }

  /**
   * 包括的テストレポートを出力
   */
  private printComprehensiveReport(result: ComprehensiveTestResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('🏆 包括的アクセシビリティテスト結果');
    console.log('='.repeat(80));
    
    console.log(`📊 総合評価:`);
    console.log(`   総合スコア: ${result.overallScore}% ${this.getScoreEmoji(result.overallScore)}`);
    console.log(`   実行日時: ${new Date(result.timestamp).toLocaleString('ja-JP')}`);
    
    console.log(`\n🏅 WCAG 2.1 準拠状況:`);
    console.log(`   Level A:   ${result.wcagCompliance.levelA ? '✅ 準拠' : '❌ 非準拠'}`);
    console.log(`   Level AA:  ${result.wcagCompliance.levelAA ? '✅ 準拠' : '❌ 非準拠'}`);
    console.log(`   Level AAA: ${result.wcagCompliance.levelAAA ? '✅ 準拠' : '❌ 非準拠'}`);
    
    console.log(`\n📈 テスト統計:`);
    console.log(`   総テスト数: ${result.summary.totalTests}`);
    console.log(`   合格: ${result.summary.passedTests} (${Math.round((result.summary.passedTests / result.summary.totalTests) * 100)}%)`);
    console.log(`   失敗: ${result.summary.failedTests} (${Math.round((result.summary.failedTests / result.summary.totalTests) * 100)}%)`);
    console.log(`   警告: ${result.summary.warningTests} (${Math.round((result.summary.warningTests / result.summary.totalTests) * 100)}%)`);
    
    console.log(`\n🚨 問題の重要度:`);
    console.log(`   重大: ${result.summary.criticalIssues}個 ${result.summary.criticalIssues > 0 ? '🔴' : '✅'}`);
    console.log(`   主要: ${result.summary.majorIssues}個 ${result.summary.majorIssues > 0 ? '🟡' : '✅'}`);
    console.log(`   軽微: ${result.summary.minorIssues}個 ${result.summary.minorIssues > 0 ? '🔵' : '✅'}`);
    
    // 各テストスイートの結果サマリー
    console.log(`\n📋 テストスイート別結果:`);
    console.log(`   基本テスト:         ${result.testSuites.accessibility.passedTests}/${result.testSuites.accessibility.totalTests} 合格`);
    console.log(`   コントラスト:       ${result.testSuites.contrast.passedAA}/${result.testSuites.contrast.totalPairs} 合格 (AA)`);
    console.log(`   タップターゲット:   ${result.testSuites.tapTarget.passedElements}/${result.testSuites.tapTarget.totalElements} 合格`);
    console.log(`   スクリーンリーダー: ${result.testSuites.screenReader.passedTests}/${result.testSuites.screenReader.totalTests} 合格`);
    
    // 推奨事項
    if (result.recommendations.length > 0) {
      console.log(`\n💡 推奨事項:`);
      for (const rec of result.recommendations) {
        console.log(`   ${rec}`);
      }
    }
    
    // 次のステップ
    if (result.nextSteps.length > 0) {
      console.log(`\n🎯 次のアクションプラン:`);
      for (const step of result.nextSteps) {
        console.log(`   ${step}`);
      }
    }
    
    // 品質評価
    console.log(`\n🎖️  品質評価: ${this.getQualityAssessment(result.overallScore)}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('テスト完了 ✨ 詳細な結果は各テストスイートの出力をご確認ください。');
    console.log('='.repeat(80));
  }

  /**
   * スコアに応じた絵文字を取得
   */
  private getScoreEmoji(score: number): string {
    if (score >= 95) return '🥇';
    if (score >= 85) return '🥈';
    if (score >= 75) return '🥉';
    if (score >= 60) return '👍';
    if (score >= 40) return '⚠️';
    return '🔴';
  }

  /**
   * 品質評価を取得
   */
  private getQualityAssessment(score: number): string {
    if (score >= 95) return '優秀 - 素晴らしいアクセシビリティ対応です';
    if (score >= 85) return '良好 - アクセシビリティ基準を満たしています';
    if (score >= 75) return '普通 - 基本的な対応は完了していますが改善の余地があります';
    if (score >= 60) return '要改善 - いくつかの重要な問題があります';
    if (score >= 40) return '不十分 - 多くの改善が必要です';
    return '極めて不十分 - 包括的な見直しが必要です';
  }

  /**
   * テスト結果をJSONファイルとして保存
   */
  public async saveResultsToFile(result: ComprehensiveTestResult, filePath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`📄 テスト結果を保存しました: ${filePath}`);
    } catch (error) {
      console.error('❌ テスト結果の保存に失敗:', error);
    }
  }

  /**
   * HTMLレポートを生成
   */
  public generateHTMLReport(result: ComprehensiveTestResult): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>アクセシビリティテストレポート</title>
    <style>
        body { font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; margin: 20px; }
        .header { background: #007AFF; color: white; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .card { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #007AFF; }
        .score { font-size: 2em; font-weight: bold; }
        .pass { color: #34C759; }
        .fail { color: #FF3B30; }
        .warning { color: #FFCC00; }
        .recommendations { background: #E3F2FD; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .wcag-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; margin: 4px; font-weight: bold; }
        .wcag-pass { background: #34C759; color: white; }
        .wcag-fail { background: #FF3B30; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏆 アクセシビリティテストレポート</h1>
        <p>実行日時: ${new Date(result.timestamp).toLocaleString('ja-JP')}</p>
    </div>
    
    <div class="summary">
        <div class="card">
            <h3>総合スコア</h3>
            <div class="score ${result.overallScore >= 80 ? 'pass' : result.overallScore >= 60 ? 'warning' : 'fail'}">
                ${result.overallScore}%
            </div>
        </div>
        
        <div class="card">
            <h3>WCAG準拠</h3>
            <div>
                <span class="wcag-badge ${result.wcagCompliance.levelA ? 'wcag-pass' : 'wcag-fail'}">Level A</span>
                <span class="wcag-badge ${result.wcagCompliance.levelAA ? 'wcag-pass' : 'wcag-fail'}">Level AA</span>
                <span class="wcag-badge ${result.wcagCompliance.levelAAA ? 'wcag-pass' : 'wcag-fail'}">Level AAA</span>
            </div>
        </div>
        
        <div class="card">
            <h3>テスト統計</h3>
            <p>総数: ${result.summary.totalTests}</p>
            <p class="pass">合格: ${result.summary.passedTests}</p>
            <p class="fail">失敗: ${result.summary.failedTests}</p>
            <p class="warning">警告: ${result.summary.warningTests}</p>
        </div>
    </div>
    
    <div class="recommendations">
        <h3>💡 推奨事項</h3>
        <ul>
            ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    
    <div class="recommendations">
        <h3>🎯 次のアクションプラン</h3>
        <ol>
            ${result.nextSteps.map(step => `<li>${step}</li>`).join('')}
        </ol>
    </div>
</body>
</html>`;
  }

  /**
   * CIレポート（簡易版）を生成
   */
  public generateCIReport(result: ComprehensiveTestResult): string {
    const status = result.wcagCompliance.levelAA ? 'PASS' : 'FAIL';
    
    return `
ACCESSIBILITY_TEST_RESULT=${status}
OVERALL_SCORE=${result.overallScore}
WCAG_LEVEL_A=${result.wcagCompliance.levelA}
WCAG_LEVEL_AA=${result.wcagCompliance.levelAA}
WCAG_LEVEL_AAA=${result.wcagCompliance.levelAAA}
CRITICAL_ISSUES=${result.summary.criticalIssues}
MAJOR_ISSUES=${result.summary.majorIssues}
TOTAL_TESTS=${result.summary.totalTests}
PASSED_TESTS=${result.summary.passedTests}
FAILED_TESTS=${result.summary.failedTests}
`;
  }
}

export default AccessibilityTestRunner;