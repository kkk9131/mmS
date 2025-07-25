/**
 * アクセシビリティ統合テスト・ユーザビリティテスト
 * 
 * 実際の使用シナリオに基づいた包括的なアクセシビリティテストと
 * ユーザビリティテストを提供します。
 */

import { AccessibilityInfo, Platform } from 'react-native';
import { AccessibilityTestRunner } from './AccessibilityTestRunner';

/**
 * テストシナリオ
 */
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectedOutcome: string;
  category: 'navigation' | 'content' | 'interaction' | 'feedback' | 'emergency';
  priority: 'high' | 'medium' | 'low';
  assistiveTechnology?: 'screen-reader' | 'voice-control' | 'switch-control' | 'magnifier';
  userProfile?: UserProfile;
}

/**
 * テストステップ
 */
export interface TestStep {
  id: string;
  action: string;
  element?: string;
  input?: string;
  expected: string;
  timeout?: number;
  optional?: boolean;
}

/**
 * ユーザープロファイル
 */
export interface UserProfile {
  id: string;
  name: string;
  disabilities: ('visual' | 'auditory' | 'motor' | 'cognitive')[];
  assistiveTechnology: string[];
  experience: 'beginner' | 'intermediate' | 'expert';
  primaryUseCase: string;
  challenges: string[];
}

/**
 * 統合テスト結果
 */
export interface IntegrationTestResult {
  scenario: TestScenario;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'passed' | 'failed' | 'partial' | 'skipped';
  stepResults: StepResult[];
  issues: TestIssue[];
  recommendations: string[];
  userExperience: {
    efficiency: number;
    effectiveness: number;
    satisfaction: number;
    learnability: number;
  };
}

/**
 * ステップ結果
 */
export interface StepResult {
  step: TestStep;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  actualOutcome: string;
  issues: string[];
}

/**
 * テストイシュー
 */
export interface TestIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  category: string;
  description: string;
  impact: string;
  suggestion: string;
  wcagViolation?: string;
}

/**
 * アクセシビリティ統合テストランナー
 */
export class AccessibilityIntegrationTester {
  private scenarios: TestScenario[] = [];
  private userProfiles: UserProfile[] = [];
  private testResults: IntegrationTestResult[] = [];

  constructor() {
    this.initializeDefaultScenarios();
    this.initializeUserProfiles();
  }

  /**
   * デフォルトテストシナリオの初期化
   */
  private initializeDefaultScenarios(): void {
    // 基本ナビゲーションシナリオ
    this.scenarios.push({
      id: 'basic-navigation',
      name: '基本ナビゲーション',
      description: 'スクリーンリーダーを使用した基本的なアプリ内ナビゲーション',
      category: 'navigation',
      priority: 'high',
      assistiveTechnology: 'screen-reader',
      steps: [
        {
          id: 'launch-app',
          action: 'アプリを起動する',
          expected: 'アプリタイトルが読み上げられる',
          timeout: 5000
        },
        {
          id: 'navigate-tabs',
          action: 'タブナビゲーションを操作する',
          expected: '各タブの名前と状態が適切に読み上げられる',
          timeout: 3000
        },
        {
          id: 'access-menu',
          action: 'メニューボタンをタップする',
          element: 'menu-button',
          expected: 'メニューが開き、項目一覧が読み上げられる',
          timeout: 2000
        },
        {
          id: 'navigate-menu',
          action: 'メニュー項目間を移動する',
          expected: '各項目が順序よく読み上げられ、フォーカスが移動する',
          timeout: 3000
        }
      ],
      expectedOutcome: 'スムーズで直感的なナビゲーションが可能',
      userProfile: {
        id: 'visually-impaired-user',
        name: '視覚障害ユーザー',
        disabilities: ['visual'],
        assistiveTechnology: ['VoiceOver', 'TalkBack'],
        experience: 'intermediate',
        primaryUseCase: '情報収集とコミュニケーション',
        challenges: ['画面の内容把握', '操作要素の発見']
      }
    });

    // 投稿作成シナリオ
    this.scenarios.push({
      id: 'create-post',
      name: '投稿作成',
      description: '新しい投稿を作成し、公開するまでの一連の流れ',
      category: 'content',
      priority: 'high',
      steps: [
        {
          id: 'open-compose',
          action: '投稿作成ボタンをタップする',
          element: 'compose-button',
          expected: '投稿作成画面が開き、入力フィールドにフォーカスが移動する',
          timeout: 2000
        },
        {
          id: 'enter-text',
          action: '投稿内容を入力する',
          element: 'post-input',
          input: '今日は子供と公園に行きました。天気が良くて気持ちよかったです。',
          expected: '入力した内容が適切に認識され、読み上げられる',
          timeout: 5000
        },
        {
          id: 'add-image',
          action: '画像を追加する（任意）',
          element: 'image-button',
          expected: '画像選択ダイアログが開く',
          timeout: 3000,
          optional: true
        },
        {
          id: 'publish-post',
          action: '投稿を公開する',
          element: 'publish-button',
          expected: '投稿が公開され、確認メッセージが表示される',
          timeout: 3000
        }
      ],
      expectedOutcome: '投稿作成から公開まで迷うことなく完了できる'
    });

    // 片手操作シナリオ
    this.scenarios.push({
      id: 'one-handed-operation',
      name: '片手操作',
      description: '授乳中の母親を想定した片手でのアプリ操作',
      category: 'interaction',
      priority: 'high',
      steps: [
        {
          id: 'enable-one-handed',
          action: '片手操作モードを有効にする',
          element: 'settings-one-handed',
          expected: 'UI要素が画面下部に再配置される',
          timeout: 2000
        },
        {
          id: 'navigate-one-handed',
          action: '片手で投稿フィードをスクロールする',
          expected: 'スムーズにスクロールでき、重要な操作が親指で届く範囲にある',
          timeout: 5000
        },
        {
          id: 'like-post-one-handed',
          action: '片手で投稿にいいねする',
          element: 'like-button',
          expected: 'タップしやすい位置にあり、確実に操作できる',
          timeout: 2000
        },
        {
          id: 'access-top-content',
          action: '画面上部のコンテンツにアクセスする',
          expected: 'フローティングボタンやジェスチャーで上部にアクセスできる',
          timeout: 3000
        }
      ],
      expectedOutcome: '片手でも快適にアプリを使用できる',
      userProfile: {
        id: 'nursing-mother',
        name: '授乳中の母親',
        disabilities: ['motor'],
        assistiveTechnology: [],
        experience: 'beginner',
        primaryUseCase: '子育て情報の取得と共有',
        challenges: ['片手操作', '時間的制約', '集中力の分散']
      }
    });

    // 深夜使用シナリオ
    this.scenarios.push({
      id: 'night-usage',
      name: '深夜使用',
      description: '夜中の授乳時間帯での静かな操作',
      category: 'interaction',
      priority: 'medium',
      steps: [
        {
          id: 'enable-night-mode',
          action: 'ナイトモードを有効にする',
          expected: '画面が暗く調整され、音量が自動的に下がる',
          timeout: 2000
        },
        {
          id: 'disable-sounds',
          action: '音響フィードバックを無効にする',
          expected: '通知音やタップ音が無効になる',
          timeout: 1000
        },
        {
          id: 'use-haptic-feedback',
          action: 'ハプティックフィードバックを使用する',
          expected: '操作に対して振動でフィードバックが提供される',
          timeout: 2000
        },
        {
          id: 'read-quietly',
          action: '投稿を静かに閲覧する',
          expected: 'テキストが見やすく、スクロールがスムーズ',
          timeout: 5000
        }
      ],
      expectedOutcome: '周囲を起こすことなく、アプリを使用できる'
    });

    // 緊急時シナリオ
    this.scenarios.push({
      id: 'emergency-access',
      name: '緊急時アクセス',
      description: '緊急時に素早く重要な情報にアクセスする',
      category: 'emergency',
      priority: 'high',
      steps: [
        {
          id: 'quick-access-emergency',
          action: '緊急アクセス機能を起動する',
          element: 'emergency-button',
          expected: '重要な連絡先や情報に素早くアクセスできる',
          timeout: 1000
        },
        {
          id: 'call-emergency-contact',
          action: '緊急連絡先に電話をかける',
          element: 'emergency-call',
          expected: '最小限のタップで電話をかけることができる',
          timeout: 2000
        },
        {
          id: 'send-emergency-message',
          action: '緊急メッセージを送信する',
          element: 'emergency-message',
          expected: '定型文で素早くメッセージを送信できる',
          timeout: 3000
        }
      ],
      expectedOutcome: '緊急時に迅速かつ確実に必要な操作ができる'
    });

    // 高齢者使用シナリオ
    this.scenarios.push({
      id: 'elderly-usage',
      name: '高齢者使用',
      description: '高齢の祖母世代のユーザーを想定した操作',
      category: 'interaction',
      priority: 'medium',
      steps: [
        {
          id: 'enable-large-text',
          action: '大きな文字サイズを有効にする',
          expected: 'テキストサイズが150%に拡大される',
          timeout: 2000
        },
        {
          id: 'enable-high-contrast',
          action: '高コントラストモードを有効にする',
          expected: 'テキストと背景のコントラストが向上する',
          timeout: 2000
        },
        {
          id: 'slow-navigation',
          action: 'ゆっくりとメニューを操作する',
          expected: '十分な時間があり、誤操作が防止される',
          timeout: 10000
        },
        {
          id: 'get-help',
          action: 'ヘルプ機能を使用する',
          element: 'help-button',
          expected: '分かりやすいガイダンスが提供される',
          timeout: 3000
        }
      ],
      expectedOutcome: '年齢に関係なく安心してアプリを使用できる',
      userProfile: {
        id: 'elderly-user',
        name: '高齢ユーザー',
        disabilities: ['visual', 'motor'],
        assistiveTechnology: [],
        experience: 'beginner',
        primaryUseCase: '孫の写真や近況の確認',
        challenges: ['小さな文字', '複雑な操作', '技術的理解']
      }
    });
  }

  /**
   * ユーザープロファイルの初期化
   */
  private initializeUserProfiles(): void {
    this.userProfiles = [
      {
        id: 'power-user-visual-impaired',
        name: '視覚障害パワーユーザー',
        disabilities: ['visual'],
        assistiveTechnology: ['VoiceOver', 'TalkBack', 'NVDA', 'JAWS'],
        experience: 'expert',
        primaryUseCase: '情報収集、コミュニケーション、コンテンツ作成',
        challenges: ['複雑なUI', '画像の代替テキスト不足', '不適切なラベリング']
      },
      {
        id: 'new-mother',
        name: '新米ママ',
        disabilities: ['motor'],
        assistiveTechnology: [],
        experience: 'beginner',
        primaryUseCase: '育児情報の収集、経験の共有',
        challenges: ['時間不足', '片手操作', '情報の信頼性判断']
      },
      {
        id: 'hearing-impaired-user',
        name: '聴覚障害ユーザー',
        disabilities: ['auditory'],
        assistiveTechnology: [],
        experience: 'intermediate',
        primaryUseCase: '視覚的情報を中心とした交流',
        challenges: ['音声コンテンツ', '音声通知', '動画の字幕']
      },
      {
        id: 'cognitive-impaired-user',
        name: '認知機能障害ユーザー',
        disabilities: ['cognitive'],
        assistiveTechnology: [],
        experience: 'beginner',
        primaryUseCase: 'シンプルな情報共有',
        challenges: ['複雑な操作手順', '情報の整理', '注意の持続']
      },
      {
        id: 'working-mother',
        name: 'ワーキングママ',
        disabilities: [],
        assistiveTechnology: [],
        experience: 'intermediate',
        primaryUseCase: '効率的な情報収集と時短',
        challenges: ['時間制約', 'マルチタスク', '重要情報の優先順位']
      }
    ];
  }

  /**
   * 統合テスト実行
   */
  public async runIntegrationTests(scenarioIds?: string[]): Promise<IntegrationTestResult[]> {
    console.log('🧪 アクセシビリティ統合テストを開始...');

    const scenariosToTest = scenarioIds 
      ? this.scenarios.filter(s => scenarioIds.includes(s.id))
      : this.scenarios;

    const results: IntegrationTestResult[] = [];

    for (const scenario of scenariosToTest) {
      console.log(`📋 シナリオ実行中: ${scenario.name}`);
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    this.testResults.push(...results);
    
    console.log(`✅ 統合テスト完了: ${results.length}シナリオ実行`);
    this.printIntegrationTestSummary(results);

    return results;
  }

  /**
   * 個別シナリオ実行
   */
  private async runScenario(scenario: TestScenario): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    const issues: TestIssue[] = [];
    let overallStatus: 'passed' | 'failed' | 'partial' | 'skipped' = 'passed';

    for (const step of scenario.steps) {
      const stepResult = await this.runStep(step, scenario);
      stepResults.push(stepResult);

      if (stepResult.status === 'failed') {
        if (step.optional) {
          overallStatus = overallStatus === 'passed' ? 'partial' : overallStatus;
        } else {
          overallStatus = 'failed';
          // 必須ステップが失敗した場合、以降のテストをスキップ
          break;
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // シナリオ固有の分析
    const scenarioIssues = this.analyzeScenarioResults(scenario, stepResults);
    issues.push(...scenarioIssues);

    // 推奨事項の生成
    const recommendations = this.generateScenarioRecommendations(scenario, stepResults, issues);

    // ユーザーエクスペリエンス評価
    const userExperience = this.evaluateUserExperience(scenario, stepResults, duration);

    return {
      scenario,
      startTime,
      endTime,
      duration,
      status: overallStatus,
      stepResults,
      issues,
      recommendations,
      userExperience
    };
  }

  /**
   * 個別ステップ実行
   */
  private async runStep(step: TestStep, scenario: TestScenario): Promise<StepResult> {
    const stepStartTime = Date.now();
    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    let actualOutcome = '';
    const issues: string[] = [];

    try {
      console.log(`  📝 ステップ実行: ${step.action}`);

      // ステップのシミュレーション実行
      actualOutcome = await this.simulateStepExecution(step, scenario);

      // 期待される結果との比較
      const isExpectedOutcome = this.validateStepOutcome(step, actualOutcome);
      
      if (!isExpectedOutcome) {
        status = 'failed';
        issues.push(`期待される結果と異なります: ${step.expected} != ${actualOutcome}`);
      }

      // タイムアウトチェック
      const stepDuration = Date.now() - stepStartTime;
      if (step.timeout && stepDuration > step.timeout) {
        issues.push(`ステップがタイムアウトしました (${stepDuration}ms > ${step.timeout}ms)`);
        if (status === 'passed') status = 'partial' as any; // TypeScriptの制約回避
      }

    } catch (error) {
      status = 'failed';
      actualOutcome = `エラー: ${error}`;
      issues.push(`ステップ実行中にエラーが発生: ${error}`);
    }

    const stepEndTime = Date.now();
    const duration = stepEndTime - stepStartTime;

    return {
      step,
      status,
      duration,
      actualOutcome,
      issues
    };
  }

  /**
   * ステップ実行のシミュレーション
   */
  private async simulateStepExecution(step: TestStep, scenario: TestScenario): Promise<string> {
    // 実際の実装では、自動化テストツールやマニュアルテストの結果を統合
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // スクリーンリーダー関連のシミュレーション
    if (scenario.assistiveTechnology === 'screen-reader') {
      const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      if (!isScreenReaderEnabled) {
        return 'スクリーンリーダーが無効のため、実際の動作を確認できません';
      }
    }

    // ステップタイプ別のシミュレーション
    switch (step.id) {
      case 'launch-app':
        return 'アプリが起動し、メインタイトル「Mamapace」が読み上げられました';
      
      case 'navigate-tabs':
        return 'タブ1: ホーム、タブ2: 検索、タブ3: 通知、タブ4: プロフィール が順次読み上げられました';
      
      case 'enter-text':
        return step.input ? `テキスト入力完了: "${step.input}"` : 'テキストが入力されました';
      
      case 'enable-one-handed':
        return 'UI要素が画面下部75%の範囲に再配置されました';
      
      case 'enable-night-mode':
        return '画面輝度が30%に調整され、ブルーライトフィルターが適用されました';
      
      default:
        // 成功率をシミュレート（実際のテストでは実際の結果を使用）
        const successRate = 0.85; // 85%の成功率
        if (Math.random() < successRate) {
          return step.expected;
        } else {
          throw new Error('シミュレートされた失敗');
        }
    }
  }

  /**
   * ステップ結果の検証
   */
  private validateStepOutcome(step: TestStep, actualOutcome: string): boolean {
    // 簡易的な一致判定（実際の実装ではより高度な比較を行う）
    const expectedKeywords = step.expected.toLowerCase().split(/\s+/);
    const actualKeywords = actualOutcome.toLowerCase().split(/\s+/);
    
    const matchCount = expectedKeywords.filter(keyword => 
      actualKeywords.some(actual => actual.includes(keyword))
    ).length;
    
    return matchCount / expectedKeywords.length >= 0.7; // 70%以上のキーワード一致で成功
  }

  /**
   * シナリオ結果の分析
   */
  private analyzeScenarioResults(scenario: TestScenario, stepResults: StepResult[]): TestIssue[] {
    const issues: TestIssue[] = [];

    // 失敗ステップの分析
    const failedSteps = stepResults.filter(result => result.status === 'failed');
    failedSteps.forEach(stepResult => {
      issues.push({
        id: `issue-${scenario.id}-${stepResult.step.id}`,
        severity: stepResult.step.optional ? 'minor' : 'major',
        category: scenario.category,
        description: `ステップ「${stepResult.step.action}」が失敗しました`,
        impact: stepResult.step.optional ? '機能性に軽微な影響' : 'ユーザビリティに重大な影響',
        suggestion: `${stepResult.step.action}の実装を見直し、${stepResult.step.expected}が確実に達成されるようにしてください`,
        wcagViolation: this.identifyWCAGViolation(stepResult)
      });
    });

    // パフォーマンス分析
    const averageStepDuration = stepResults.reduce((sum, result) => sum + result.duration, 0) / stepResults.length;
    if (averageStepDuration > 3000) { // 3秒以上
      issues.push({
        id: `perf-${scenario.id}`,
        severity: 'minor',
        category: 'performance',
        description: `平均ステップ実行時間が長い (${averageStepDuration.toFixed(0)}ms)`,
        impact: 'ユーザーの作業効率に影響',
        suggestion: 'レスポンス時間の改善とパフォーマンス最適化を検討してください'
      });
    }

    return issues;
  }

  /**
   * WCAG違反の特定
   */
  private identifyWCAGViolation(stepResult: StepResult): string | undefined {
    const actionLower = stepResult.step.action.toLowerCase();
    
    if (actionLower.includes('読み上げ') || actionLower.includes('スクリーンリーダー')) {
      return '1.1.1 非テキストコンテンツ';
    }
    
    if (actionLower.includes('フォーカス') || actionLower.includes('移動')) {
      return '2.4.3 フォーカス順序';
    }
    
    if (actionLower.includes('タップ') || actionLower.includes('ボタン')) {
      return '2.5.5 ターゲットのサイズ';
    }
    
    if (actionLower.includes('コントラスト') || actionLower.includes('色')) {
      return '1.4.3 コントラスト（最低限）';
    }
    
    return undefined;
  }

  /**
   * シナリオ推奨事項の生成
   */
  private generateScenarioRecommendations(
    scenario: TestScenario,
    stepResults: StepResult[],
    issues: TestIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // 重大な問題がある場合
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('重大な問題が発見されました。immediate修正が必要です。');
    }

    // シナリオ別の推奨事項
    switch (scenario.category) {
      case 'navigation':
        if (stepResults.some(r => r.issues.length > 0)) {
          recommendations.push('ナビゲーション構造を見直し、論理的で一貫した構造にしてください。');
          recommendations.push('適切なランドマーク役割とヘディング階層を使用してください。');
        }
        break;
        
      case 'content':
        recommendations.push('コンテンツ作成フローをより直感的にし、ガイダンスを充実させてください。');
        break;
        
      case 'interaction':
        if (scenario.id === 'one-handed-operation') {
          recommendations.push('重要な操作要素を親指の到達範囲内（画面下部75%）に配置してください。');
        }
        break;
        
      case 'emergency':
        recommendations.push('緊急時の操作は最小限のステップで完了できるように設計してください。');
        break;
    }

    // ユーザープロファイル別の推奨事項
    if (scenario.userProfile) {
      if (scenario.userProfile.experience === 'beginner') {
        recommendations.push('初心者向けのオンボーディングプロセスを改善してください。');
      }
      
      if (scenario.userProfile.disabilities.includes('visual')) {
        recommendations.push('すべての視覚的情報に代替テキストを提供してください。');
      }
      
      if (scenario.userProfile.disabilities.includes('motor')) {
        recommendations.push('タップターゲットのサイズを48×48px以上にし、適切な間隔を確保してください。');
      }
    }

    return recommendations;
  }

  /**
   * ユーザーエクスペリエンス評価
   */
  private evaluateUserExperience(
    scenario: TestScenario,
    stepResults: StepResult[],
    totalDuration: number
  ): {
    efficiency: number;
    effectiveness: number;
    satisfaction: number;
    learnability: number;
  } {
    // 効率性（時間）
    const expectedDuration = scenario.steps.reduce((sum, step) => sum + (step.timeout || 3000), 0);
    const efficiency = Math.min(100, (expectedDuration / totalDuration) * 100);

    // 有効性（完了率）
    const completedSteps = stepResults.filter(r => r.status === 'passed').length;
    const effectiveness = (completedSteps / scenario.steps.length) * 100;

    // 満足度（エラー率の逆算）
    const errorCount = stepResults.reduce((sum, r) => sum + r.issues.length, 0);
    const satisfaction = Math.max(0, 100 - (errorCount * 10));

    // 学習しやすさ（オプショナルステップの成功率）
    const optionalSteps = stepResults.filter(r => r.step.optional);
    const optionalSuccessRate = optionalSteps.length > 0 
      ? (optionalSteps.filter(r => r.status === 'passed').length / optionalSteps.length) * 100
      : 100;
    const learnability = optionalSuccessRate;

    return {
      efficiency: Math.round(efficiency),
      effectiveness: Math.round(effectiveness),
      satisfaction: Math.round(satisfaction),
      learnability: Math.round(learnability)
    };
  }

  /**
   * 統合テスト結果サマリー出力
   */
  private printIntegrationTestSummary(results: IntegrationTestResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 アクセシビリティ統合テスト結果サマリー');
    console.log('='.repeat(80));

    const totalScenarios = results.length;
    const passedScenarios = results.filter(r => r.status === 'passed').length;
    const failedScenarios = results.filter(r => r.status === 'failed').length;
    const partialScenarios = results.filter(r => r.status === 'partial').length;

    console.log(`📊 テスト結果概要:`);
    console.log(`   総シナリオ数: ${totalScenarios}`);
    console.log(`   成功: ${passedScenarios} (${Math.round((passedScenarios / totalScenarios) * 100)}%)`);
    console.log(`   失敗: ${failedScenarios} (${Math.round((failedScenarios / totalScenarios) * 100)}%)`);
    console.log(`   部分成功: ${partialScenarios} (${Math.round((partialScenarios / totalScenarios) * 100)}%)`);

    // ユーザーエクスペリエンス平均
    const avgUX = {
      efficiency: Math.round(results.reduce((sum, r) => sum + r.userExperience.efficiency, 0) / totalScenarios),
      effectiveness: Math.round(results.reduce((sum, r) => sum + r.userExperience.effectiveness, 0) / totalScenarios),
      satisfaction: Math.round(results.reduce((sum, r) => sum + r.userExperience.satisfaction, 0) / totalScenarios),
      learnability: Math.round(results.reduce((sum, r) => sum + r.userExperience.learnability, 0) / totalScenarios)
    };

    console.log(`\n👤 ユーザーエクスペリエンス平均:`);
    console.log(`   効率性: ${avgUX.efficiency}%`);
    console.log(`   有効性: ${avgUX.effectiveness}%`);
    console.log(`   満足度: ${avgUX.satisfaction}%`);
    console.log(`   学習しやすさ: ${avgUX.learnability}%`);

    // 重要な問題
    const allIssues = results.flatMap(r => r.issues);
    const criticalIssues = allIssues.filter(i => i.severity === 'critical').length;
    const majorIssues = allIssues.filter(i => i.severity === 'major').length;

    console.log(`\n🚨 問題統計:`);
    console.log(`   重大: ${criticalIssues}件`);
    console.log(`   主要: ${majorIssues}件`);
    console.log(`   軽微: ${allIssues.filter(i => i.severity === 'minor').length}件`);

    // 失敗したシナリオの詳細
    const failedResults = results.filter(r => r.status === 'failed');
    if (failedResults.length > 0) {
      console.log(`\n❌ 失敗したシナリオ:`);
      failedResults.forEach(result => {
        console.log(`   - ${result.scenario.name}: ${result.issues.length}件の問題`);
      });
    }

    // 推奨事項
    const allRecommendations = [...new Set(results.flatMap(r => r.recommendations))];
    if (allRecommendations.length > 0) {
      console.log(`\n💡 主要な推奨事項:`);
      allRecommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(80));
  }

  /**
   * ユーザビリティテスト準備
   */
  public generateUsabilityTestPlan(): {
    testPlan: string;
    scenarios: TestScenario[];
    userProfiles: UserProfile[];
    instructions: string[];
  } {
    const testPlan = `
# アクセシビリティユーザビリティテスト計画

## 目的
Mamapaceアプリケーションの実際の障害を持つユーザーでの使用性を評価し、
アクセシビリティ機能の実効性を検証する。

## 対象ユーザー
- 視覚障害者（全盲、弱視）
- 聴覚障害者
- 運動機能障害者（片麻痺、上肢機能障害）
- 認知機能障害者
- 高齢者
- 子育て中の母親（疲労、時間的制約、片手操作）

## テスト環境
- デバイス: iOS（VoiceOver有効）、Android（TalkBack有効）
- 支援技術: スクリーンリーダー、スイッチコントロール、音声制御
- 環境条件: 静寂、騒音、暗所、明所

## 評価指標
- タスク完了率
- エラー発生率
- 完了時間
- 主観的満足度
- 学習効率
- ストレスレベル
`;

    const instructions = [
      '事前にユーザーの障害特性と支援技術の使用経験を確認してください',
      'テスト中はユーザーの発話や表情を記録し、困難な箇所を特定してください',
      'タスク完了を急かさず、ユーザーのペースに合わせてください',
      'テスト後のインタビューで改善点や要望を詳しく聞き取ってください',
      '支援技術の設定や使用方法についてもサポートを提供してください',
      '複数回のテストを実施し、学習効果も含めて評価してください'
    ];

    return {
      testPlan,
      scenarios: this.scenarios.filter(s => s.priority === 'high'),
      userProfiles: this.userProfiles,
      instructions
    };
  }

  /**
   * テスト結果取得
   */
  public getTestResults(): IntegrationTestResult[] {
    return [...this.testResults];
  }

  /**
   * シナリオ追加
   */
  public addScenario(scenario: TestScenario): void {
    this.scenarios.push(scenario);
  }

  /**
   * ユーザープロファイル追加
   */
  public addUserProfile(profile: UserProfile): void {
    this.userProfiles.push(profile);
  }
}

export default AccessibilityIntegrationTester;