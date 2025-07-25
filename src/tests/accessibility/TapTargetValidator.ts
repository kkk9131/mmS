/**
 * タップターゲットサイズ検証ツール
 * 
 * WCAG 2.1ガイドライン 2.5.5「ターゲットのサイズ」に基づいて
 * タップ可能要素のサイズとアクセシビリティを検証します。
 */

export interface TapTargetElement {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'button' | 'link' | 'input' | 'checkbox' | 'radio' | 'toggle' | 'icon' | 'custom';
  isEssential?: boolean; // 重要な機能かどうか
  hasLabel?: boolean;
  isDisabled?: boolean;
  parentContainer?: string;
}

export interface TapTargetTestResult {
  id: string;
  name: string;
  element: TapTargetElement;
  actualSize: { width: number; height: number };
  effectiveSize: { width: number; height: number }; // padding含む
  minimumRequiredSize: { width: number; height: number };
  status: 'pass' | 'fail' | 'warning';
  wcagLevel: 'AA' | 'FAIL';
  issues: string[];
  recommendations: string[];
  proximityWarnings: ProximityWarning[];
}

export interface ProximityWarning {
  nearbyElementId: string;
  nearbyElementName: string;
  distance: number;
  minimumDistance: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
}

export interface TapTargetValidationSummary {
  totalElements: number;
  passedElements: number;
  failedElements: number;
  warningElements: number;
  overallCompliance: boolean;
  averageSize: { width: number; height: number };
  smallestTarget: TapTargetTestResult | null;
  largestTarget: TapTargetTestResult | null;
  results: TapTargetTestResult[];
  proximityIssues: ProximityWarning[];
}

/**
 * タップターゲット検証クラス
 */
export class TapTargetValidator {
  // WCAG 2.1推奨最小サイズ（44×44 CSS pixels ≈ 48×48 dp）
  private static readonly MIN_TARGET_SIZE = 48;
  private static readonly RECOMMENDED_TARGET_SIZE = 56;
  private static readonly MIN_SPACING = 8; // 要素間の最小間隔

  private elements: TapTargetElement[] = [];
  private testResults: TapTargetTestResult[] = [];

  constructor() {}

  /**
   * テスト対象の要素を追加
   */
  public addElement(element: TapTargetElement): void {
    this.elements.push(element);
  }

  /**
   * 複数の要素を追加
   */
  public addElements(elements: TapTargetElement[]): void {
    this.elements.push(...elements);
  }

  /**
   * デモ用のサンプル要素を追加
   */
  public addSampleElements(): void {
    const sampleElements: TapTargetElement[] = [
      // 標準的なボタン
      {
        id: 'btn-primary',
        name: 'プライマリボタン',
        x: 50,
        y: 100,
        width: 120,
        height: 48,
        type: 'button',
        isEssential: true,
        hasLabel: true
      },
      
      // 小さすぎるボタン（問題あり）
      {
        id: 'btn-small',
        name: '小さなアイコンボタン',
        x: 200,
        y: 100,
        width: 32,
        height: 32,
        type: 'icon',
        isEssential: false,
        hasLabel: false
      },
      
      // 適切なサイズのチェックボックス
      {
        id: 'checkbox-terms',
        name: '利用規約同意チェックボックス',
        x: 50,
        y: 200,
        width: 48,
        height: 48,
        type: 'checkbox',
        isEssential: true,
        hasLabel: true
      },
      
      // 近すぎる位置にあるボタン（間隔の問題）
      {
        id: 'btn-close1',
        name: '保存ボタン',
        x: 50,
        y: 300,
        width: 80,
        height: 44,
        type: 'button',
        isEssential: true,
        hasLabel: true
      },
      {
        id: 'btn-close2',
        name: 'キャンセルボタン',
        x: 135, // 5pxしか離れていない
        y: 300,
        width: 80,
        height: 44,
        type: 'button',
        isEssential: true,
        hasLabel: true
      },
      
      // 大きなボタン（理想的）
      {
        id: 'btn-large',
        name: '大きなCTAボタン',
        x: 50,
        y: 400,
        width: 200,
        height: 56,
        type: 'button',
        isEssential: true,
        hasLabel: true
      },
      
      // 入力フィールド
      {
        id: 'input-email',
        name: 'メールアドレス入力',
        x: 50,
        y: 500,
        width: 250,
        height: 44,
        type: 'input',
        isEssential: true,
        hasLabel: true
      },
      
      // 無効化されたボタン
      {
        id: 'btn-disabled',
        name: '無効化されたボタン',
        x: 50,
        y: 600,
        width: 100,
        height: 40,
        type: 'button',
        isEssential: false,
        hasLabel: true,
        isDisabled: true
      }
    ];

    this.addElements(sampleElements);
  }

  /**
   * 全要素のタップターゲット検証を実行
   */
  public validateAllTargets(): TapTargetValidationSummary {
    this.testResults = [];

    console.log('👆 タップターゲットサイズ検証を開始...');

    // 各要素を個別に検証
    for (const element of this.elements) {
      const result = this.validateSingleTarget(element);
      this.testResults.push(result);
    }

    // 近接性の問題をチェック
    this.checkProximityIssues();

    return this.generateValidationSummary();
  }

  /**
   * 単一要素のタップターゲット検証
   */
  private validateSingleTarget(element: TapTargetElement): TapTargetTestResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 実際のサイズ
    const actualSize = { width: element.width, height: element.height };
    
    // 有効サイズ（padding等を考慮、ここでは実際のサイズと同じとする）
    const effectiveSize = { ...actualSize };
    
    // 最小要求サイズの決定
    const minimumRequiredSize = {
      width: TapTargetValidator.MIN_TARGET_SIZE,
      height: TapTargetValidator.MIN_TARGET_SIZE
    };

    // サイズチェック
    const isWidthCompliant = effectiveSize.width >= minimumRequiredSize.width;
    const isHeightCompliant = effectiveSize.height >= minimumRequiredSize.height;
    const isSizeCompliant = isWidthCompliant && isHeightCompliant;

    // ステータス判定
    let status: 'pass' | 'fail' | 'warning';
    let wcagLevel: 'AA' | 'FAIL';

    if (element.isDisabled) {
      // 無効化された要素は検証対象外
      status = 'pass';
      wcagLevel = 'AA';
    } else if (isSizeCompliant) {
      status = 'pass';
      wcagLevel = 'AA';
      
      // 推奨サイズとの比較
      if (effectiveSize.width < TapTargetValidator.RECOMMENDED_TARGET_SIZE || 
          effectiveSize.height < TapTargetValidator.RECOMMENDED_TARGET_SIZE) {
        recommendations.push(`より大きなサイズ（${TapTargetValidator.RECOMMENDED_TARGET_SIZE}×${TapTargetValidator.RECOMMENDED_TARGET_SIZE}px）を推奨`);
      }
    } else {
      status = 'fail';
      wcagLevel = 'FAIL';
    }

    // 個別の問題をチェック
    if (!isWidthCompliant) {
      issues.push(`幅が不足: ${effectiveSize.width}px < ${minimumRequiredSize.width}px`);
      recommendations.push(`幅を${minimumRequiredSize.width}px以上にしてください`);
    }

    if (!isHeightCompliant) {
      issues.push(`高さが不足: ${effectiveSize.height}px < ${minimumRequiredSize.height}px`);
      recommendations.push(`高さを${minimumRequiredSize.height}px以上にしてください`);
    }

    // タイプ別の推奨事項
    this.addTypeSpecificRecommendations(element, recommendations);

    // ラベルの問題
    if (!element.hasLabel && element.type !== 'input') {
      issues.push('アクセシビリティラベルが不足');
      recommendations.push('accessibilityLabelを設定してください');
    }

    return {
      id: `tap-${element.id}`,
      name: element.name,
      element,
      actualSize,
      effectiveSize,
      minimumRequiredSize,
      status,
      wcagLevel,
      issues,
      recommendations,
      proximityWarnings: [] // 後で近接チェックで更新
    };
  }

  /**
   * 要素タイプ別の推奨事項を追加
   */
  private addTypeSpecificRecommendations(element: TapTargetElement, recommendations: string[]): void {
    switch (element.type) {
      case 'icon':
        recommendations.push('アイコンボタンには視覚的なフィードバック（背景色、境界線）を追加');
        recommendations.push('アイコンの意味を説明するツールチップやラベルを提供');
        break;
        
      case 'checkbox':
      case 'radio':
        recommendations.push('チェック可能領域を視覚的に明確に示す');
        recommendations.push('ラベルテキストもタップ可能にする');
        break;
        
      case 'toggle':
        recommendations.push('オン/オフ状態を視覚的に区別しやすくする');
        recommendations.push('状態変化にアニメーション効果を追加');
        break;
        
      case 'link':
        recommendations.push('リンク領域を下線やボックスで視覚的に示す');
        break;
        
      case 'input':
        recommendations.push('フォーカス時の視覚的フィードバックを強化');
        recommendations.push('入力エリア全体をタップ可能にする');
        break;
    }
  }

  /**
   * 要素間の近接性をチェック
   */
  private checkProximityIssues(): void {
    for (let i = 0; i < this.testResults.length; i++) {
      const result1 = this.testResults[i];
      const element1 = result1.element;
      
      if (element1.isDisabled) continue;

      for (let j = i + 1; j < this.testResults.length; j++) {
        const result2 = this.testResults[j];
        const element2 = result2.element;
        
        if (element2.isDisabled) continue;

        const distance = this.calculateDistance(element1, element2);
        const minDistance = TapTargetValidator.MIN_SPACING;

        if (distance < minDistance) {
          const direction = this.getProximityDirection(element1, element2);
          
          const warning: ProximityWarning = {
            nearbyElementId: element2.id,
            nearbyElementName: element2.name,
            distance,
            minimumDistance: minDistance,
            direction
          };

          result1.proximityWarnings.push(warning);
          
          // 相互に警告を追加
          const reverseWarning: ProximityWarning = {
            nearbyElementId: element1.id,
            nearbyElementName: element1.name,
            distance,
            minimumDistance: minDistance,
            direction
          };
          
          result2.proximityWarnings.push(reverseWarning);

          // ステータスを警告に更新（失敗でない場合）
          if (result1.status === 'pass') {
            result1.status = 'warning';
            result1.recommendations.push(`${element2.name}との間隔を${minDistance}px以上確保してください`);
          }
          
          if (result2.status === 'pass') {
            result2.status = 'warning';
            result2.recommendations.push(`${element1.name}との間隔を${minDistance}px以上確保してください`);
          }
        }
      }
    }
  }

  /**
   * 2つの要素間の距離を計算
   */
  private calculateDistance(element1: TapTargetElement, element2: TapTargetElement): number {
    // 要素の中心点を計算
    const center1 = {
      x: element1.x + element1.width / 2,
      y: element1.y + element1.height / 2
    };
    
    const center2 = {
      x: element2.x + element2.width / 2,
      y: element2.y + element2.height / 2
    };

    // エッジ間の最短距離を計算
    const dx = Math.max(0, Math.abs(center1.x - center2.x) - (element1.width + element2.width) / 2);
    const dy = Math.max(0, Math.abs(center1.y - center2.y) - (element1.height + element2.height) / 2);

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 近接方向を判定
   */
  private getProximityDirection(element1: TapTargetElement, element2: TapTargetElement): 'horizontal' | 'vertical' | 'diagonal' {
    const dx = Math.abs(element1.x - element2.x);
    const dy = Math.abs(element1.y - element2.y);

    if (dx > dy * 2) return 'horizontal';
    if (dy > dx * 2) return 'vertical';
    return 'diagonal';
  }

  /**
   * 検証結果のサマリーを生成
   */
  private generateValidationSummary(): TapTargetValidationSummary {
    const totalElements = this.testResults.length;
    const passedElements = this.testResults.filter(r => r.status === 'pass').length;
    const failedElements = this.testResults.filter(r => r.status === 'fail').length;
    const warningElements = this.testResults.filter(r => r.status === 'warning').length;

    const overallCompliance = failedElements === 0;

    // 平均サイズを計算
    const totalWidth = this.testResults.reduce((sum, r) => sum + r.actualSize.width, 0);
    const totalHeight = this.testResults.reduce((sum, r) => sum + r.actualSize.height, 0);
    const averageSize = {
      width: totalElements > 0 ? Math.round(totalWidth / totalElements) : 0,
      height: totalElements > 0 ? Math.round(totalHeight / totalElements) : 0
    };

    // 最小・最大ターゲット
    const sortedBySize = [...this.testResults].sort((a, b) => 
      (a.actualSize.width * a.actualSize.height) - (b.actualSize.width * b.actualSize.height)
    );
    const smallestTarget = sortedBySize[0] || null;
    const largestTarget = sortedBySize[sortedBySize.length - 1] || null;

    // 近接問題を収集
    const proximityIssues: ProximityWarning[] = [];
    for (const result of this.testResults) {
      proximityIssues.push(...result.proximityWarnings);
    }

    return {
      totalElements,
      passedElements,
      failedElements,
      warningElements,
      overallCompliance,
      averageSize,
      smallestTarget,
      largestTarget,
      results: this.testResults,
      proximityIssues
    };
  }

  /**
   * 検証結果をコンソールに出力
   */
  public printValidationResults(summary: TapTargetValidationSummary): void {
    console.log('\n' + '='.repeat(70));
    console.log('👆 タップターゲットサイズ検証結果');
    console.log('='.repeat(70));
    
    console.log(`📊 総合結果:`);
    console.log(`   検証要素: ${summary.totalElements}個`);
    console.log(`   合格:    ${summary.passedElements}個 (${Math.round((summary.passedElements / summary.totalElements) * 100)}%)`);
    console.log(`   失敗:    ${summary.failedElements}個`);
    console.log(`   警告:    ${summary.warningElements}個`);
    console.log(`   WCAG準拠: ${summary.overallCompliance ? '✅ 準拠' : '❌ 非準拠'}`);

    console.log(`\n📏 サイズ統計:`);
    console.log(`   平均サイズ: ${summary.averageSize.width}×${summary.averageSize.height}px`);
    console.log(`   推奨サイズ: ${TapTargetValidator.RECOMMENDED_TARGET_SIZE}×${TapTargetValidator.RECOMMENDED_TARGET_SIZE}px`);
    console.log(`   最小要求:   ${TapTargetValidator.MIN_TARGET_SIZE}×${TapTargetValidator.MIN_TARGET_SIZE}px`);

    if (summary.smallestTarget && summary.largestTarget) {
      console.log(`\n📐 サイズ範囲:`);
      console.log(`   最小: ${summary.smallestTarget.actualSize.width}×${summary.smallestTarget.actualSize.height}px (${summary.smallestTarget.name})`);
      console.log(`   最大: ${summary.largestTarget.actualSize.width}×${summary.largestTarget.actualSize.height}px (${summary.largestTarget.name})`);
    }

    // 失敗した要素の詳細
    const failedResults = summary.results.filter(r => r.status === 'fail');
    if (failedResults.length > 0) {
      console.log(`\n❌ 修正が必要な要素:`);
      
      for (const result of failedResults) {
        console.log(`\n   🔴 ${result.name}`);
        console.log(`      現在のサイズ: ${result.actualSize.width}×${result.actualSize.height}px`);
        console.log(`      必要サイズ:   ${result.minimumRequiredSize.width}×${result.minimumRequiredSize.height}px`);
        console.log(`      タイプ: ${result.element.type}`);
        
        if (result.issues.length > 0) {
          console.log(`      🐛 問題:`);
          for (const issue of result.issues) {
            console.log(`         - ${issue}`);
          }
        }
        
        if (result.recommendations.length > 0) {
          console.log(`      💡 改善提案:`);
          for (const rec of result.recommendations) {
            console.log(`         - ${rec}`);
          }
        }
      }
    }

    // 警告がある要素
    const warningResults = summary.results.filter(r => r.status === 'warning');
    if (warningResults.length > 0) {
      console.log(`\n⚠️  改善推奨要素:`);
      
      for (const result of warningResults) {
        console.log(`\n   🟡 ${result.name}`);
        console.log(`      サイズ: ${result.actualSize.width}×${result.actualSize.height}px`);
        
        if (result.proximityWarnings.length > 0) {
          console.log(`      📍 近接問題:`);
          for (const warning of result.proximityWarnings) {
            console.log(`         - ${warning.nearbyElementName}との距離: ${Math.round(warning.distance)}px (推奨: ${warning.minimumDistance}px以上)`);
          }
        }
        
        if (result.recommendations.length > 0) {
          console.log(`      💡 改善提案:`);
          for (const rec of result.recommendations) {
            console.log(`         - ${rec}`);
          }
        }
      }
    }

    // タイプ別統計
    const typeStats = this.generateTypeStatistics(summary.results);
    if (Object.keys(typeStats).length > 0) {
      console.log(`\n📊 要素タイプ別統計:`);
      for (const [type, stats] of Object.entries(typeStats)) {
        console.log(`   ${type}: ${stats.passed}/${stats.total} 合格 (平均: ${stats.averageSize.width}×${stats.averageSize.height}px)`);
      }
    }

    console.log('\n' + '='.repeat(70));
  }

  /**
   * タイプ別統計を生成
   */
  private generateTypeStatistics(results: TapTargetTestResult[]): Record<string, {
    total: number;
    passed: number;
    averageSize: { width: number; height: number };
  }> {
    const stats: Record<string, {
      total: number;
      passed: number;
      sizes: { width: number; height: number }[];
    }> = {};

    // データを収集
    for (const result of results) {
      const type = result.element.type;
      if (!stats[type]) {
        stats[type] = { total: 0, passed: 0, sizes: [] };
      }
      
      stats[type].total++;
      if (result.status === 'pass') {
        stats[type].passed++;
      }
      stats[type].sizes.push(result.actualSize);
    }

    // 平均サイズを計算
    const finalStats: Record<string, {
      total: number;
      passed: number;
      averageSize: { width: number; height: number };
    }> = {};

    for (const [type, data] of Object.entries(stats)) {
      const avgWidth = data.sizes.reduce((sum, size) => sum + size.width, 0) / data.sizes.length;
      const avgHeight = data.sizes.reduce((sum, size) => sum + size.height, 0) / data.sizes.length;
      
      finalStats[type] = {
        total: data.total,
        passed: data.passed,
        averageSize: {
          width: Math.round(avgWidth),
          height: Math.round(avgHeight)
        }
      };
    }

    return finalStats;
  }

  /**
   * 特定のタイプの結果を取得
   */
  public getResultsByType(type: string): TapTargetTestResult[] {
    return this.testResults.filter(result => result.element.type === type);
  }

  /**
   * 失敗した結果のみを取得
   */
  public getFailedResults(): TapTargetTestResult[] {
    return this.testResults.filter(result => result.status === 'fail');
  }

  /**
   * 近接問題がある結果を取得
   */
  public getProximityIssues(): TapTargetTestResult[] {
    return this.testResults.filter(result => result.proximityWarnings.length > 0);
  }

  /**
   * 検証結果をJSONで取得
   */
  public getValidationResultsAsJSON(): string {
    const summary = this.generateValidationSummary();
    return JSON.stringify(summary, null, 2);
  }
}

export default TapTargetValidator;