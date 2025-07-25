/**
 * スクリーンリーダーテストツール
 * 
 * React Nativeアプリケーションのスクリーンリーダー対応を
 * 自動的にテストし、WCAG 2.1準拠を検証します。
 */

import { AccessibilityInfo, AccessibilityChangeEvent } from 'react-native';

export interface ScreenReaderElement {
  id: string;
  name: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  accessibilityState?: Record<string, boolean | string | number>;
  accessibilityValue?: {
    min?: number;
    max?: number;
    now?: number;
    text?: string;
  };
  accessibilityActions?: { name: string; label?: string }[];
  isAccessible?: boolean;
  testID?: string;
  children?: ScreenReaderElement[];
}

export interface ScreenReaderTestResult {
  id: string;
  testName: string;
  element: ScreenReaderElement;
  category: 'ラベル' | '役割' | '状態' | '値' | 'アクション' | '構造' | '読み上げ順序';
  status: 'pass' | 'fail' | 'warning' | 'skip';
  wcagLevel: 'A' | 'AA' | 'AAA';
  guideline: string;
  actualValue: string;
  expectedValue: string;
  issues: string[];
  recommendations: string[];
  severity: 'critical' | 'major' | 'minor' | 'info';
}

export interface ScreenReaderTestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warningTests: number;
  skippedTests: number;
  overallScore: number;
  screenReaderEnabled: boolean;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  results: ScreenReaderTestResult[];
  elementHierarchy: ScreenReaderElement[];
}

/**
 * スクリーンリーダーテストクラス
 */
export class ScreenReaderTester {
  private elements: ScreenReaderElement[] = [];
  private testResults: ScreenReaderTestResult[] = [];
  private isScreenReaderEnabled: boolean = false;

  constructor() {
    this.initializeScreenReaderStatus();
  }

  /**
   * スクリーンリーダーの状態を初期化
   */
  private async initializeScreenReaderStatus(): Promise<void> {
    try {
      this.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      // スクリーンリーダー状態の変更を監視
      AccessibilityInfo.addEventListener('screenReaderChanged', this.handleScreenReaderChange.bind(this));
    } catch (error) {
      console.warn('スクリーンリーダー状態の取得に失敗:', error);
      this.isScreenReaderEnabled = false;
    }
  }

  /**
   * スクリーンリーダー状態変更のハンドラ
   */
  private handleScreenReaderChange(isEnabled: AccessibilityChangeEvent): void {
    this.isScreenReaderEnabled = isEnabled;
    console.log(`スクリーンリーダー状態が変更されました: ${isEnabled ? '有効' : '無効'}`);
  }

  /**
   * テスト対象の要素を追加
   */
  public addElement(element: ScreenReaderElement): void {
    this.elements.push(element);
  }

  /**
   * 複数の要素を追加
   */
  public addElements(elements: ScreenReaderElement[]): void {
    this.elements.push(...elements);
  }

  /**
   * デモ用のサンプル要素を追加
   */
  public addSampleElements(): void {
    const sampleElements: ScreenReaderElement[] = [
      // 適切に設定されたボタン
      {
        id: 'btn-good',
        name: '適切なボタン',
        accessibilityLabel: '投稿を送信',
        accessibilityHint: 'タップすると投稿が送信されます',
        accessibilityRole: 'button',
        accessibilityState: { disabled: false },
        isAccessible: true
      },
      
      // ラベルが不足しているボタン（問題あり）
      {
        id: 'btn-bad',
        name: 'ラベルなしボタン',
        // accessibilityLabel が不足
        accessibilityRole: 'button',
        isAccessible: true
      },
      
      // 適切に設定されたヘッダー
      {
        id: 'header-good',
        name: 'メインヘッダー',
        accessibilityLabel: 'Mamapace - 母親のためのSNS',
        accessibilityRole: 'header',
        isAccessible: true
      },
      
      // 値を持つスライダー
      {
        id: 'slider-volume',
        name: 'ボリューム調整',
        accessibilityLabel: 'ボリューム',
        accessibilityRole: 'adjustable',
        accessibilityValue: {
          min: 0,
          max: 100,
          now: 50,
          text: '50パーセント'
        },
        isAccessible: true
      },
      
      // チェックボックス
      {
        id: 'checkbox-terms',
        name: '利用規約同意',
        accessibilityLabel: '利用規約に同意する',
        accessibilityRole: 'checkbox',
        accessibilityState: { checked: false },
        isAccessible: true
      },
      
      // 画像（代替テキストあり）
      {
        id: 'img-profile',
        name: 'プロフィール画像',
        accessibilityLabel: '田中花子さんのプロフィール写真',
        accessibilityRole: 'image',
        isAccessible: true
      },
      
      // 画像（代替テキストなし - 問題あり）
      {
        id: 'img-bad',
        name: '代替テキストなし画像',
        accessibilityRole: 'image',
        // accessibilityLabel が不足
        isAccessible: true
      },
      
      // テキスト入力
      {
        id: 'input-search',
        name: '検索入力',
        accessibilityLabel: '投稿を検索',
        accessibilityHint: 'キーワードを入力してください',
        accessibilityRole: 'search',
        isAccessible: true
      },
      
      // リスト
      {
        id: 'list-posts',
        name: '投稿リスト',
        accessibilityLabel: '最新の投稿一覧',
        accessibilityRole: 'list',
        isAccessible: true,
        children: [
          {
            id: 'post-1',
            name: '投稿アイテム1',
            accessibilityLabel: '田中花子さんの投稿：今日は子供と公園に行きました',
            accessibilityRole: 'button',
            isAccessible: true
          },
          {
            id: 'post-2',
            name: '投稿アイテム2',
            accessibilityLabel: '山田太郎さんの投稿：子育てのコツを共有します',
            accessibilityRole: 'button',
            isAccessible: true
          }
        ]
      },
      
      // カスタムアクションを持つ要素
      {
        id: 'post-card',
        name: '投稿カード',
        accessibilityLabel: '投稿：子育てについて',
        accessibilityRole: 'button',
        accessibilityActions: [
          { name: 'activate', label: '投稿を開く' },
          { name: 'like', label: 'いいね' },
          { name: 'comment', label: 'コメント' },
          { name: 'share', label: '共有' }
        ],
        isAccessible: true
      }
    ];

    this.addElements(sampleElements);
  }

  /**
   * 全要素のスクリーンリーダーテストを実行
   */
  public async runAllTests(): Promise<ScreenReaderTestSummary> {
    this.testResults = [];

    console.log('📱 スクリーンリーダーテストを開始...');
    console.log(`スクリーンリーダー状態: ${this.isScreenReaderEnabled ? '有効' : '無効'}`);

    // 各要素を個別にテスト
    for (const element of this.elements) {
      await this.testElement(element);
    }

    // 階層構造のテスト
    await this.testHierarchicalStructure();

    // 読み上げ順序のテスト
    await this.testReadingOrder();

    return this.generateTestSummary();
  }

  /**
   * 単一要素のテスト
   */
  private async testElement(element: ScreenReaderElement): Promise<void> {
    // アクセシビリティラベルのテスト
    await this.testAccessibilityLabel(element);
    
    // アクセシビリティ役割のテスト
    await this.testAccessibilityRole(element);
    
    // アクセシビリティ状態のテスト
    await this.testAccessibilityState(element);
    
    // アクセシビリティ値のテスト
    await this.testAccessibilityValue(element);
    
    // カスタムアクションのテスト
    await this.testCustomActions(element);
    
    // 子要素がある場合は再帰的にテスト
    if (element.children && element.children.length > 0) {
      for (const child of element.children) {
        await this.testElement(child);
      }
    }
  }

  /**
   * アクセシビリティラベルのテスト
   */
  private async testAccessibilityLabel(element: ScreenReaderElement): Promise<void> {
    const testId = `sr-label-${element.id}`;
    const hasLabel = Boolean(element.accessibilityLabel);
    const needsLabel = this.elementNeedsLabel(element);

    let status: 'pass' | 'fail' | 'warning' | 'skip';
    let severity: 'critical' | 'major' | 'minor' | 'info';
    let issues: string[] = [];
    let recommendations: string[] = [];

    if (!needsLabel) {
      status = 'skip';
      severity = 'info';
    } else if (hasLabel) {
      // ラベルの品質をチェック
      const labelQuality = this.assessLabelQuality(element.accessibilityLabel!);
      
      if (labelQuality.score >= 0.8) {
        status = 'pass';
        severity = 'info';
      } else {
        status = 'pass'; // ラベルはあるが改善の余地あり
        severity = 'minor';
        issues.push(...labelQuality.issues);
        recommendations.push(...labelQuality.recommendations);
      }
    } else {
      status = 'fail';
      severity = 'critical';
      issues.push('アクセシビリティラベルが設定されていません');
      recommendations.push('適切なaccessibilityLabelを設定してください');
    }

    this.testResults.push({
      id: testId,
      testName: 'アクセシビリティラベル',
      element,
      category: 'ラベル',
      status,
      wcagLevel: 'A',
      guideline: '4.1.2 名前・役割・値',
      actualValue: element.accessibilityLabel || '(設定なし)',
      expectedValue: needsLabel ? '適切な説明テキスト' : '(不要)',
      issues,
      recommendations,
      severity
    });
  }

  /**
   * 要素がラベルを必要とするかどうかを判定
   */
  private elementNeedsLabel(element: ScreenReaderElement): boolean {
    const interactiveRoles = ['button', 'link', 'search', 'checkbox', 'radio', 'switch', 'adjustable'];
    const contentRoles = ['image', 'header', 'text'];
    
    return interactiveRoles.includes(element.accessibilityRole || '') ||
           contentRoles.includes(element.accessibilityRole || '') ||
           element.isAccessible !== false;
  }

  /**
   * ラベルの品質を評価
   */
  private assessLabelQuality(label: string): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 1.0;

    // 長さのチェック
    if (label.length < 3) {
      issues.push('ラベルが短すぎます');
      recommendations.push('より説明的なラベルを使用してください');
      score -= 0.3;
    }

    if (label.length > 100) {
      issues.push('ラベルが長すぎます');
      recommendations.push('簡潔で分かりやすいラベルにしてください');
      score -= 0.2;
    }

    // 内容のチェック
    if (label.match(/^(button|image|text|link)$/i)) {
      issues.push('汎用的すぎるラベルです');
      recommendations.push('要素の具体的な機能や内容を説明してください');
      score -= 0.4;
    }

    // 日本語の適切性チェック
    if (label.match(/[a-zA-Z]{3,}/) && !label.match(/[ひらがなカタカナ漢字]/)) {
      issues.push('日本語での説明が不足している可能性があります');
      recommendations.push('日本語ユーザー向けの適切な説明を検討してください');
      score -= 0.1;
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * アクセシビリティ役割のテスト
   */
  private async testAccessibilityRole(element: ScreenReaderElement): Promise<void> {
    const testId = `sr-role-${element.id}`;
    const hasRole = Boolean(element.accessibilityRole);
    const expectedRole = this.getExpectedRole(element);

    let status: 'pass' | 'fail' | 'warning';
    let issues: string[] = [];
    let recommendations: string[] = [];

    if (!hasRole && expectedRole) {
      status = 'fail';
      issues.push('アクセシビリティ役割が設定されていません');
      recommendations.push(`accessibilityRole="${expectedRole}"を設定してください`);
    } else if (hasRole && expectedRole && element.accessibilityRole !== expectedRole) {
      status = 'warning';
      issues.push(`推奨される役割と異なります: ${element.accessibilityRole} != ${expectedRole}`);
      recommendations.push(`accessibilityRole="${expectedRole}"の使用を検討してください`);
    } else {
      status = 'pass';
    }

    this.testResults.push({
      id: testId,
      testName: 'アクセシビリティ役割',
      element,
      category: '役割',
      status,
      wcagLevel: 'A',
      guideline: '4.1.2 名前・役割・値',
      actualValue: element.accessibilityRole || '(設定なし)',
      expectedValue: expectedRole || '(推奨なし)',
      issues,
      recommendations,
      severity: status === 'fail' ? 'major' : 'minor'
    });
  }

  /**
   * 要素の期待される役割を取得
   */
  private getExpectedRole(element: ScreenReaderElement): string | null {
    // 要素名や特性から推測される役割
    const name = element.name.toLowerCase();
    
    if (name.includes('button') || name.includes('ボタン')) return 'button';
    if (name.includes('header') || name.includes('ヘッダー')) return 'header';
    if (name.includes('image') || name.includes('画像')) return 'image';
    if (name.includes('input') || name.includes('入力')) return 'search';
    if (name.includes('checkbox') || name.includes('チェック')) return 'checkbox';
    if (name.includes('slider') || name.includes('スライダー')) return 'adjustable';
    if (name.includes('list') || name.includes('リスト')) return 'list';
    if (name.includes('link') || name.includes('リンク')) return 'link';
    
    return null;
  }

  /**
   * アクセシビリティ状態のテスト
   */
  private async testAccessibilityState(element: ScreenReaderElement): Promise<void> {
    const testId = `sr-state-${element.id}`;
    const hasState = Boolean(element.accessibilityState);
    const needsState = this.elementNeedsState(element);

    let status: 'pass' | 'fail' | 'warning' | 'skip';
    let issues: string[] = [];
    let recommendations: string[] = [];

    if (!needsState) {
      status = 'skip';
    } else if (hasState) {
      // 状態の妥当性をチェック
      const stateValidation = this.validateAccessibilityState(element);
      status = stateValidation.isValid ? 'pass' : 'warning';
      issues.push(...stateValidation.issues);
      recommendations.push(...stateValidation.recommendations);
    } else {
      status = 'fail';
      issues.push('必要なアクセシビリティ状態が設定されていません');
      recommendations.push('適切なaccessibilityStateを設定してください');
    }

    this.testResults.push({
      id: testId,
      testName: 'アクセシビリティ状態',
      element,
      category: '状態',
      status,
      wcagLevel: 'A',
      guideline: '4.1.2 名前・役割・値',
      actualValue: element.accessibilityState ? JSON.stringify(element.accessibilityState) : '(設定なし)',
      expectedValue: needsState ? '適切な状態情報' : '(不要)',
      issues,
      recommendations,
      severity: status === 'fail' ? 'major' : 'minor'
    });
  }

  /**
   * 要素が状態情報を必要とするかどうかを判定
   */
  private elementNeedsState(element: ScreenReaderElement): boolean {
    const statefulRoles = ['checkbox', 'radio', 'switch', 'button'];
    return statefulRoles.includes(element.accessibilityRole || '');
  }

  /**
   * アクセシビリティ状態の妥当性を検証
   */
  private validateAccessibilityState(element: ScreenReaderElement): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const state = element.accessibilityState!;

    // 役割に応じた状態の検証
    if (element.accessibilityRole === 'checkbox' && !('checked' in state)) {
      issues.push('チェックボックスにchecked状態が設定されていません');
      recommendations.push('accessibilityState.checkedを設定してください');
    }

    if (element.accessibilityRole === 'button' && state.disabled === undefined) {
      recommendations.push('ボタンのdisabled状態の設定を検討してください');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * アクセシビリティ値のテスト
   */
  private async testAccessibilityValue(element: ScreenReaderElement): Promise<void> {
    const testId = `sr-value-${element.id}`;
    const hasValue = Boolean(element.accessibilityValue);
    const needsValue = this.elementNeedsValue(element);

    let status: 'pass' | 'fail' | 'warning' | 'skip';
    let issues: string[] = [];
    let recommendations: string[] = [];

    if (!needsValue) {
      status = 'skip';
    } else if (hasValue) {
      const valueValidation = this.validateAccessibilityValue(element);
      status = valueValidation.isValid ? 'pass' : 'warning';
      issues.push(...valueValidation.issues);
      recommendations.push(...valueValidation.recommendations);
    } else {
      status = 'fail';
      issues.push('必要なアクセシビリティ値が設定されていません');
      recommendations.push('適切なaccessibilityValueを設定してください');
    }

    this.testResults.push({
      id: testId,
      testName: 'アクセシビリティ値',
      element,
      category: '値',
      status,
      wcagLevel: 'A',
      guideline: '4.1.2 名前・役割・値',
      actualValue: element.accessibilityValue ? JSON.stringify(element.accessibilityValue) : '(設定なし)',
      expectedValue: needsValue ? '適切な値情報' : '(不要)',
      issues,
      recommendations,
      severity: status === 'fail' ? 'major' : 'minor'
    });
  }

  /**
   * 要素が値情報を必要とするかどうかを判定
   */
  private elementNeedsValue(element: ScreenReaderElement): boolean {
    return element.accessibilityRole === 'adjustable';
  }

  /**
   * アクセシビリティ値の妥当性を検証
   */
  private validateAccessibilityValue(element: ScreenReaderElement): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const value = element.accessibilityValue!;

    if (element.accessibilityRole === 'adjustable') {
      if (value.min === undefined || value.max === undefined || value.now === undefined) {
        issues.push('調整可能要素にmin, max, nowの値が不足しています');
        recommendations.push('min, max, now値を適切に設定してください');
      }

      if (value.text === undefined) {
        recommendations.push('ユーザーに分かりやすいtext値の設定を検討してください');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * カスタムアクションのテスト
   */
  private async testCustomActions(element: ScreenReaderElement): Promise<void> {
    const testId = `sr-actions-${element.id}`;
    const hasActions = Boolean(element.accessibilityActions && element.accessibilityActions.length > 0);

    let status: 'pass' | 'skip';
    let recommendations: string[] = [];

    if (hasActions) {
      status = 'pass';
      
      // アクションの品質をチェック
      for (const action of element.accessibilityActions!) {
        if (!action.label) {
          recommendations.push(`アクション "${action.name}" にラベルを設定することを推奨します`);
        }
      }
    } else {
      status = 'skip';
      
      // 複数の操作が可能な要素の場合、カスタムアクションの追加を推奨
      if (element.name.includes('カード') || element.name.includes('アイテム')) {
        recommendations.push('複数の操作がある場合、カスタムアクションの追加を検討してください');
      }
    }

    this.testResults.push({
      id: testId,
      testName: 'カスタムアクション',
      element,
      category: 'アクション',
      status,
      wcagLevel: 'AA',
      guideline: '2.1.1 キーボード',
      actualValue: hasActions ? `${element.accessibilityActions!.length}個のアクション` : '(設定なし)',
      expectedValue: '(任意)',
      issues: [],
      recommendations,
      severity: 'info'
    });
  }

  /**
   * 階層構造のテスト
   */
  private async testHierarchicalStructure(): Promise<void> {
    const elementsWithChildren = this.elements.filter(e => e.children && e.children.length > 0);
    
    for (const parent of elementsWithChildren) {
      const testId = `sr-hierarchy-${parent.id}`;
      
      let status: 'pass' | 'warning';
      let issues: string[] = [];
      let recommendations: string[] = [];

      // リスト構造のチェック
      if (parent.accessibilityRole === 'list') {
        const childrenWithoutRole = parent.children!.filter(child => !child.accessibilityRole);
        
        if (childrenWithoutRole.length > 0) {
          status = 'warning';
          issues.push('リストの子要素に適切な役割が設定されていません');
          recommendations.push('リストアイテムにはaccessibilityRole="button"またはその他の適切な役割を設定してください');
        } else {
          status = 'pass';
        }
      } else {
        status = 'pass';
      }

      this.testResults.push({
        id: testId,
        testName: '階層構造',
        element: parent,
        category: '構造',
        status,
        wcagLevel: 'A',
        guideline: '1.3.1 情報及び関係性',
        actualValue: `${parent.children!.length}個の子要素`,
        expectedValue: '適切な階層構造',
        issues,
        recommendations,
        severity: 'minor'
      });
    }
  }

  /**
   * 読み上げ順序のテスト
   */
  private async testReadingOrder(): Promise<void> {
    const testId = 'sr-reading-order';
    
    // 要素の位置に基づいて期待される読み上げ順序を計算
    // （実際の実装では、レイアウト情報が必要）
    
    let status: 'pass' | 'warning';
    let recommendations: string[] = [];

    // 簡易的なチェック：ヘッダー要素が最初にあるかどうか
    const headerElements = this.elements.filter(e => e.accessibilityRole === 'header');
    const firstElement = this.elements[0];
    
    if (headerElements.length > 0 && firstElement.accessibilityRole !== 'header') {
      status = 'warning';
      recommendations.push('ページヘッダーを最初の要素として配置することを検討してください');
    } else {
      status = 'pass';
    }

    this.testResults.push({
      id: testId,
      testName: '読み上げ順序',
      element: { id: 'global', name: '全体構造' } as ScreenReaderElement,
      category: '読み上げ順序',
      status,
      wcagLevel: 'A',
      guideline: '1.3.2 意味のある順序',
      actualValue: '現在の要素順序',
      expectedValue: '論理的な読み上げ順序',
      issues: [],
      recommendations,
      severity: 'minor'
    });
  }

  /**
   * テスト結果のサマリーを生成
   */
  private generateTestSummary(): ScreenReaderTestSummary {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'pass').length;
    const failedTests = this.testResults.filter(r => r.status === 'fail').length;
    const warningTests = this.testResults.filter(r => r.status === 'warning').length;
    const skippedTests = this.testResults.filter(r => r.status === 'skip').length;

    const overallScore = totalTests > 0 ? Math.round((passedTests / (totalTests - skippedTests)) * 100) : 0;

    const criticalIssues = this.testResults.filter(r => r.severity === 'critical').length;
    const majorIssues = this.testResults.filter(r => r.severity === 'major').length;
    const minorIssues = this.testResults.filter(r => r.severity === 'minor').length;

    return {
      totalTests,
      passedTests,
      failedTests,
      warningTests,
      skippedTests,
      overallScore,
      screenReaderEnabled: this.isScreenReaderEnabled,
      criticalIssues,
      majorIssues,
      minorIssues,
      results: this.testResults,
      elementHierarchy: this.elements
    };
  }

  /**
   * テスト結果をコンソールに出力
   */
  public printTestResults(summary: ScreenReaderTestSummary): void {
    console.log('\n' + '='.repeat(70));
    console.log('📱 スクリーンリーダーテスト結果');
    console.log('='.repeat(70));
    
    console.log(`📊 総合結果:`);
    console.log(`   スクリーンリーダー: ${summary.screenReaderEnabled ? '✅ 有効' : '❌ 無効'}`);
    console.log(`   総合スコア: ${summary.overallScore}%`);
    console.log(`   テスト総数: ${summary.totalTests}`);
    console.log(`   合格: ${summary.passedTests}`);
    console.log(`   失敗: ${summary.failedTests}`);
    console.log(`   警告: ${summary.warningTests}`);
    console.log(`   スキップ: ${summary.skippedTests}`);

    console.log(`\n🚨 問題の重要度別:`);
    console.log(`   重大: ${summary.criticalIssues}個`);
    console.log(`   主要: ${summary.majorIssues}個`);
    console.log(`   軽微: ${summary.minorIssues}個`);

    // カテゴリ別結果
    const categories = [...new Set(summary.results.map(r => r.category))];
    console.log(`\n📂 カテゴリ別結果:`);
    
    for (const category of categories) {
      const categoryResults = summary.results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'pass').length;
      const categoryTotal = categoryResults.filter(r => r.status !== 'skip').length;
      console.log(`   ${category}: ${categoryPassed}/${categoryTotal} 合格`);
    }

    // 重大な問題の詳細
    const criticalResults = summary.results.filter(r => r.severity === 'critical');
    if (criticalResults.length > 0) {
      console.log(`\n🚨 重大な問題（即座に修正が必要）:`);
      
      for (const result of criticalResults) {
        console.log(`\n   🔴 ${result.element.name} - ${result.testName}`);
        console.log(`      要素ID: ${result.element.id}`);
        
        if (result.issues.length > 0) {
          console.log(`      🐛 問題:`);
          for (const issue of result.issues) {
            console.log(`         - ${issue}`);
          }
        }
        
        if (result.recommendations.length > 0) {
          console.log(`      💡 修正方法:`);
          for (const rec of result.recommendations) {
            console.log(`         - ${rec}`);
          }
        }
      }
    }

    // 主要な問題の詳細
    const majorResults = summary.results.filter(r => r.severity === 'major');
    if (majorResults.length > 0) {
      console.log(`\n⚠️  主要な問題（修正を推奨）:`);
      
      for (const result of majorResults) {
        console.log(`   🟡 ${result.element.name} - ${result.testName}`);
        if (result.issues.length > 0) {
          console.log(`      問題: ${result.issues.join(', ')}`);
        }
      }
    }

    // 推奨事項
    console.log(`\n💡 全体的な推奨事項:`);
    console.log(`   - 全ての操作可能要素にaccessibilityLabelを設定してください`);
    console.log(`   - 適切なaccessibilityRoleを使用してください`);
    console.log(`   - 動的な状態変化をaccessibilityStateで表現してください`);
    console.log(`   - 実際のスクリーンリーダーでのテストを定期的に実施してください`);

    if (!summary.screenReaderEnabled) {
      console.log(`\n📝 注意: スクリーンリーダーが無効です。実際の使用体験を確認するため、デバイスの設定でスクリーンリーダーを有効にしてテストしてください。`);
    }

    console.log('\n' + '='.repeat(70));
  }

  /**
   * 特定のカテゴリの結果を取得
   */
  public getResultsByCategory(category: string): ScreenReaderTestResult[] {
    return this.testResults.filter(result => result.category === category);
  }

  /**
   * 重要度別の結果を取得
   */
  public getResultsBySeverity(severity: 'critical' | 'major' | 'minor' | 'info'): ScreenReaderTestResult[] {
    return this.testResults.filter(result => result.severity === severity);
  }

  /**
   * 失敗した結果のみを取得
   */
  public getFailedResults(): ScreenReaderTestResult[] {
    return this.testResults.filter(result => result.status === 'fail');
  }

  /**
   * 検証結果をJSONで取得
   */
  public getTestResultsAsJSON(): string {
    const summary = this.generateTestSummary();
    return JSON.stringify(summary, null, 2);
  }
}

export default ScreenReaderTester;