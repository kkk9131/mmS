/**
 * コントラスト比検証ツール
 * 
 * WCAG 2.1ガイドラインに基づいてコントラスト比を検証し、
 * アクセシビリティ準拠を自動的にチェックします。
 */

import { calculateContrastRatio, isContrastCompliant, CONTRAST_RATIOS } from '../../utils/accessibilityUtils';

export interface ColorPair {
  name: string;
  foreground: string;
  background: string;
  isLargeText?: boolean;
  category?: 'text' | 'button' | 'icon' | 'border' | 'status';
}

export interface ContrastTestResult {
  id: string;
  name: string;
  foreground: string;
  background: string;
  contrastRatio: number;
  isLargeText: boolean;
  category: string;
  wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL';
  status: 'pass' | 'fail' | 'warning';
  requiredRatio: number;
  recommendations?: string[];
}

export interface ContrastValidationSummary {
  totalPairs: number;
  passedAA: number;
  passedAAA: number;
  failed: number;
  overallAACompliance: boolean;
  overallAAACompliance: boolean;
  results: ContrastTestResult[];
  worstContrast: ContrastTestResult | null;
  bestContrast: ContrastTestResult | null;
}

/**
 * コントラスト検証クラス
 */
export class ContrastValidator {
  private colorPairs: ColorPair[] = [];
  private testResults: ContrastTestResult[] = [];

  constructor() {
    this.initializeDefaultColorPairs();
  }

  /**
   * デフォルトのカラーペアを初期化
   */
  private initializeDefaultColorPairs(): void {
    this.colorPairs = [
      // メインテキスト
      {
        name: 'メインテキスト（白背景）',
        foreground: '#000000',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'text'
      },
      {
        name: 'メインテキスト（サーフェス背景）',
        foreground: '#000000',
        background: '#F2F2F7',
        isLargeText: false,
        category: 'text'
      },
      
      // セカンダリテキスト
      {
        name: 'セカンダリテキスト（白背景）',
        foreground: '#6D6D80',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'text'
      },
      {
        name: 'セカンダリテキスト（サーフェス背景）',
        foreground: '#6D6D80',
        background: '#F2F2F7',
        isLargeText: false,
        category: 'text'
      },

      // ボタン
      {
        name: 'プライマリボタン',
        foreground: '#FFFFFF',
        background: '#007AFF',
        isLargeText: false,
        category: 'button'
      },
      {
        name: 'セカンダリボタン',
        foreground: '#007AFF',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'button'
      },
      {
        name: '破壊的ボタン',
        foreground: '#FFFFFF',
        background: '#FF3B30',
        isLargeText: false,
        category: 'button'
      },

      // ステータス色
      {
        name: '成功メッセージ',
        foreground: '#34C759',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'status'
      },
      {
        name: 'エラーメッセージ',
        foreground: '#FF3B30',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'status'
      },
      {
        name: '警告メッセージ',
        foreground: '#FFCC00',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'status'
      },
      {
        name: '情報メッセージ',
        foreground: '#007AFF',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'status'
      },

      // リンク
      {
        name: 'リンクテキスト',
        foreground: '#007AFF',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'text'
      },
      {
        name: '訪問済みリンク',
        foreground: '#5856D6',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'text'
      },

      // アイコン
      {
        name: 'アクティブアイコン',
        foreground: '#007AFF',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'icon'
      },
      {
        name: '非アクティブアイコン',
        foreground: '#C7C7CC',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'icon'
      },

      // 大きなテキスト（18pt以上または14pt太字以上）
      {
        name: '大きなヘッドライン',
        foreground: '#6D6D80',
        background: '#FFFFFF',
        isLargeText: true,
        category: 'text'
      },
      {
        name: '大きなボタンテキスト',
        foreground: '#FFFFFF',
        background: '#FF9500',
        isLargeText: true,
        category: 'button'
      },

      // 高コントラストモード用
      {
        name: '高コントラスト：メインテキスト',
        foreground: '#000000',
        background: '#FFFFFF',
        isLargeText: false,
        category: 'text'
      },
      {
        name: '高コントラスト：プライマリボタン',
        foreground: '#FFFFFF',
        background: '#0000FF',
        isLargeText: false,
        category: 'button'
      }
    ];
  }

  /**
   * カスタムカラーペアを追加
   */
  public addColorPair(colorPair: ColorPair): void {
    this.colorPairs.push(colorPair);
  }

  /**
   * 複数のカラーペアを追加
   */
  public addColorPairs(colorPairs: ColorPair[]): void {
    this.colorPairs.push(...colorPairs);
  }

  /**
   * 全てのカラーペアのコントラスト比を検証
   */
  public validateAllContrasts(): ContrastValidationSummary {
    this.testResults = [];

    console.log('🎨 コントラスト比検証を開始...');

    for (let i = 0; i < this.colorPairs.length; i++) {
      const pair = this.colorPairs[i];
      const result = this.validateSingleContrast(pair, `contrast-${i + 1}`);
      this.testResults.push(result);
    }

    return this.generateValidationSummary();
  }

  /**
   * 単一のカラーペアのコントラスト比を検証
   */
  private validateSingleContrast(pair: ColorPair, id: string): ContrastTestResult {
    const contrastRatio = calculateContrastRatio(pair.foreground, pair.background);
    const isLargeText = pair.isLargeText || false;
    
    // WCAG準拠レベルの判定
    const isAACompliant = isContrastCompliant(pair.foreground, pair.background, 'AA', isLargeText);
    const isAAACompliant = isContrastCompliant(pair.foreground, pair.background, 'AAA', isLargeText);
    
    let wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL';
    let status: 'pass' | 'fail' | 'warning';
    
    if (isAAACompliant) {
      wcagLevel = 'AAA';
      status = 'pass';
    } else if (isAACompliant) {
      wcagLevel = 'AA';
      status = 'pass';
    } else if (contrastRatio >= 3.0) {
      wcagLevel = 'A';
      status = 'warning';
    } else {
      wcagLevel = 'FAIL';
      status = 'fail';
    }

    // 必要コントラスト比の計算
    const requiredRatio = isLargeText ? 
      CONTRAST_RATIOS.AA_LARGE : 
      CONTRAST_RATIOS.AA_NORMAL;

    // 改善提案の生成
    const recommendations = this.generateRecommendations(pair, contrastRatio, isAACompliant);

    return {
      id,
      name: pair.name,
      foreground: pair.foreground,
      background: pair.background,
      contrastRatio: Math.round(contrastRatio * 100) / 100,
      isLargeText,
      category: pair.category || 'unknown',
      wcagLevel,
      status,
      requiredRatio,
      recommendations
    };
  }

  /**
   * 改善提案を生成
   */
  private generateRecommendations(
    pair: ColorPair, 
    contrastRatio: number, 
    isAACompliant: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (!isAACompliant) {
      recommendations.push(
        `現在のコントラスト比(${contrastRatio.toFixed(2)}:1)はWCAG AA基準(${pair.isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL}:1)を満たしていません`
      );

      // 前景色を暗くする提案
      if (pair.category === 'text') {
        recommendations.push('テキスト色をより暗い色に変更することを検討してください');
      }

      // 背景色を明るくする提案
      if (pair.category === 'button') {
        recommendations.push('背景色をより明るいまたは暗い色に変更することを検討してください');
      }

      // 代替手段の提案
      recommendations.push('色以外の情報伝達手段（アイコン、下線、太字）の併用を検討してください');
    }

    if (isAACompliant && !isContrastCompliant(pair.foreground, pair.background, 'AAA', pair.isLargeText || false)) {
      recommendations.push('AAA準拠のため、更なるコントラスト向上を検討してください');
    }

    return recommendations;
  }

  /**
   * 検証結果のサマリーを生成
   */
  private generateValidationSummary(): ContrastValidationSummary {
    const totalPairs = this.testResults.length;
    const passedAA = this.testResults.filter(r => r.wcagLevel === 'AA' || r.wcagLevel === 'AAA').length;
    const passedAAA = this.testResults.filter(r => r.wcagLevel === 'AAA').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;

    const overallAACompliance = failed === 0 && passedAA === totalPairs;
    const overallAAACompliance = passedAAA === totalPairs;

    // 最悪と最良のコントラスト結果を特定
    const sortedByContrast = [...this.testResults].sort((a, b) => a.contrastRatio - b.contrastRatio);
    const worstContrast = sortedByContrast[0] || null;
    const bestContrast = sortedByContrast[sortedByContrast.length - 1] || null;

    return {
      totalPairs,
      passedAA,
      passedAAA,
      failed,
      overallAACompliance,
      overallAAACompliance,
      results: this.testResults,
      worstContrast,
      bestContrast
    };
  }

  /**
   * 特定のカテゴリの結果を取得
   */
  public getResultsByCategory(category: string): ContrastTestResult[] {
    return this.testResults.filter(result => result.category === category);
  }

  /**
   * 失敗した結果のみを取得
   */
  public getFailedResults(): ContrastTestResult[] {
    return this.testResults.filter(result => result.status === 'fail');
  }

  /**
   * 検証結果をコンソールに出力
   */
  public printValidationResults(summary: ContrastValidationSummary): void {
    console.log('\n' + '='.repeat(70));
    console.log('🎨 コントラスト比検証結果');
    console.log('='.repeat(70));
    
    console.log(`📊 総合結果:`);
    console.log(`   検証項目: ${summary.totalPairs}項目`);
    console.log(`   AA準拠:  ${summary.passedAA}/${summary.totalPairs} (${Math.round((summary.passedAA / summary.totalPairs) * 100)}%)`);
    console.log(`   AAA準拠: ${summary.passedAAA}/${summary.totalPairs} (${Math.round((summary.passedAAA / summary.totalPairs) * 100)}%)`);
    console.log(`   失敗:    ${summary.failed}項目`);
    
    console.log(`\n🏆 全体準拠状況:`);
    console.log(`   WCAG AA:  ${summary.overallAACompliance ? '✅ 準拠' : '❌ 非準拠'}`);
    console.log(`   WCAG AAA: ${summary.overallAAACompliance ? '✅ 準拠' : '❌ 非準拠'}`);

    if (summary.worstContrast && summary.bestContrast) {
      console.log(`\n📈 コントラスト範囲:`);
      console.log(`   最低: ${summary.worstContrast.contrastRatio}:1 (${summary.worstContrast.name})`);
      console.log(`   最高: ${summary.bestContrast.contrastRatio}:1 (${summary.bestContrast.name})`);
    }

    // カテゴリ別結果
    const categories = [...new Set(summary.results.map(r => r.category))];
    console.log(`\n📂 カテゴリ別結果:`);
    
    for (const category of categories) {
      const categoryResults = summary.results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'pass').length;
      console.log(`   ${category}: ${categoryPassed}/${categoryResults.length} 準拠`);
    }

    // 失敗項目の詳細
    const failedResults = summary.results.filter(r => r.status === 'fail');
    if (failedResults.length > 0) {
      console.log(`\n❌ 修正が必要な項目:`);
      
      for (const result of failedResults) {
        console.log(`\n   🔴 ${result.name}`);
        console.log(`      前景色: ${result.foreground}`);
        console.log(`      背景色: ${result.background}`);
        console.log(`      現在の比: ${result.contrastRatio}:1`);
        console.log(`      必要な比: ${result.requiredRatio}:1以上`);
        
        if (result.recommendations) {
          console.log(`      💡 改善提案:`);
          for (const rec of result.recommendations) {
            console.log(`         - ${rec}`);
          }
        }
      }
    }

    // 警告項目
    const warningResults = summary.results.filter(r => r.status === 'warning');
    if (warningResults.length > 0) {
      console.log(`\n⚠️  改善推奨項目:`);
      
      for (const result of warningResults) {
        console.log(`   🟡 ${result.name}: ${result.contrastRatio}:1`);
      }
    }

    console.log('\n' + '='.repeat(70));
  }

  /**
   * 検証結果をJSONで取得
   */
  public getValidationResultsAsJSON(): string {
    const summary = this.generateValidationSummary();
    return JSON.stringify(summary, null, 2);
  }

  /**
   * 特定の色に対する推奨改善色を生成
   */
  public generateImprovedColor(
    foreground: string, 
    background: string, 
    targetLevel: 'AA' | 'AAA' = 'AA',
    isLargeText: boolean = false
  ): { foreground: string; background: string; contrastRatio: number } {
    // 簡易的な色改善アルゴリズム
    // 実際の実装では、より高度な色空間計算が必要
    
    const targetRatio = targetLevel === 'AAA' ? 
      (isLargeText ? CONTRAST_RATIOS.AAA_LARGE : CONTRAST_RATIOS.AAA_NORMAL) :
      (isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL);

    // 現在のコントラスト比を取得
    const currentRatio = calculateContrastRatio(foreground, background);
    
    if (currentRatio >= targetRatio) {
      return { foreground, background, contrastRatio: currentRatio };
    }

    // 前景色を調整して目標コントラスト比を達成
    // この実装は簡易版で、実際にはより高度なアルゴリズムが必要
    const improvedForeground = this.adjustColorForContrast(foreground, background, targetRatio);
    const improvedRatio = calculateContrastRatio(improvedForeground, background);

    return {
      foreground: improvedForeground,
      background,
      contrastRatio: improvedRatio
    };
  }

  /**
   * 色を調整してコントラスト比を改善
   */
  private adjustColorForContrast(color: string, background: string, targetRatio: number): string {
    // 簡易的な実装
    // 実際にはHSL色空間での計算が推奨
    
    // 16進数カラーをRGBに変換
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    // 明度を調整
    const factor = targetRatio / calculateContrastRatio(color, background);
    const newR = Math.max(0, Math.min(255, Math.round(rgb.r * factor)));
    const newG = Math.max(0, Math.min(255, Math.round(rgb.g * factor)));
    const newB = Math.max(0, Math.min(255, Math.round(rgb.b * factor)));

    return this.rgbToHex(newR, newG, newB);
  }

  /**
   * 16進数カラーをRGBに変換
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * RGBを16進数カラーに変換
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}

export default ContrastValidator;