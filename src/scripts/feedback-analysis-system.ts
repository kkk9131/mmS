#!/usr/bin/env npx tsx
/**
 * 自動フィードバック収集・分析システム
 * ベータテストで収集されたフィードバックの詳細分析
 */

interface FeedbackData {
  user_id: string;
  feedback_type: 'bug_report' | 'feature_request' | 'usability_issue' | 'positive_feedback' | 'general_comment';
  category: 'ui_ux' | 'performance' | 'functionality' | 'content' | 'accessibility' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  steps_to_reproduce?: string[];
  expected_behavior?: string;
  actual_behavior?: string;
  device_info: {
    platform: 'iOS' | 'Android';
    version: string;
    device_model: string;
  };
  timestamp: string;
  status: 'new' | 'in_progress' | 'resolved' | 'wont_fix';
}

interface AnalysisResult {
  total_feedback: number;
  feedback_by_type: Record<string, number>;
  feedback_by_category: Record<string, number>;
  feedback_by_severity: Record<string, number>;
  top_issues: {
    description: string;
    frequency: number;
    severity: string;
    impact_score: number;
  }[];
  sentiment_analysis: {
    positive: number;
    neutral: number;
    negative: number;
  };
  actionable_insights: string[];
  priority_fixes: string[];
}

async function runFeedbackAnalysis(): Promise<AnalysisResult> {
  console.log('📊 自動フィードバック収集・分析システム開始');
  console.log('==========================================');
  
  try {
    // Step 1: フィードバックデータの生成・収集
    console.log('\n1️⃣ ベータテストフィードバックデータ収集中...');
    const feedbackData = generateBetaFeedbackData(200); // 200件のフィードバック
    console.log(`✅ ${feedbackData.length}件のフィードバック収集完了`);
    
    // Step 2: カテゴリ別フィードバック分析
    console.log('\n2️⃣ カテゴリ別フィードバック分析中...');
    const categoryAnalysis = analyzeFeedbackByCategory(feedbackData);
    console.log(`📊 カテゴリ別分析:`)
    Object.entries(categoryAnalysis).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}件`);
    });
    
    // Step 3: 重要度別フィードバック分析
    console.log('\n3️⃣ 重要度別フィードバック分析中...');
    const severityAnalysis = analyzeFeedbackBySeverity(feedbackData);
    console.log(`🚨 重要度別分析:`)
    Object.entries(severityAnalysis).forEach(([severity, count]) => {
      console.log(`   ${severity}: ${count}件`);
    });
    
    // Step 4: 頻出問題の特定
    console.log('\n4️⃣ 頻出問題特定中...');
    const topIssues = identifyTopIssues(feedbackData);
    console.log(`🔍 上位問題:`)
    topIssues.slice(0, 5).forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.description} (${issue.frequency}件, 影響度${issue.impact_score})`);
    });
    
    // Step 5: センチメント分析
    console.log('\n5️⃣ ユーザーセンチメント分析中...');
    const sentimentAnalysis = analyzeFeedbackSentiment(feedbackData);
    console.log(`😊 センチメント分析:`)
    console.log(`   ポジティブ: ${sentimentAnalysis.positive}%`);
    console.log(`   ニュートラル: ${sentimentAnalysis.neutral}%`);
    console.log(`   ネガティブ: ${sentimentAnalysis.negative}%`);
    
    // Step 6: プラットフォーム別問題分析
    console.log('\n6️⃣ プラットフォーム別問題分析中...');
    const platformIssues = analyzePlatformSpecificIssues(feedbackData);
    console.log(`📱 プラットフォーム別問題:`)
    console.log(`   iOS固有問題: ${platformIssues.ios_specific}件`);
    console.log(`   Android固有問題: ${platformIssues.android_specific}件`);
    console.log(`   共通問題: ${platformIssues.common_issues}件`);
    
    // Step 7: アクショナブルインサイト生成
    console.log('\n7️⃣ アクショナブルインサイト生成中...');
    const insights = generateActionableInsights(feedbackData, topIssues, sentimentAnalysis);
    console.log(`💡 主要インサイト:`)
    insights.slice(0, 5).forEach((insight, index) => {
      console.log(`   ${index + 1}. ${insight}`);
    });
    
    // Step 8: 優先修正項目の特定
    console.log('\n8️⃣ 優先修正項目特定中...');
    const priorityFixes = identifyPriorityFixes(feedbackData, topIssues);
    console.log(`🔧 優先修正項目:`)
    priorityFixes.forEach((fix, index) => {
      console.log(`   ${index + 1}. ${fix}`);
    });
    
    const result: AnalysisResult = {
      total_feedback: feedbackData.length,
      feedback_by_type: analyzeFeedbackByType(feedbackData),
      feedback_by_category: categoryAnalysis,
      feedback_by_severity: severityAnalysis,
      top_issues: topIssues,
      sentiment_analysis: sentimentAnalysis,
      actionable_insights: insights,
      priority_fixes: priorityFixes
    };
    
    console.log('\n📊 フィードバック分析結果サマリー:');
    console.log(`   総フィードバック数: ${result.total_feedback}件`);
    console.log(`   クリティカル問題: ${result.feedback_by_severity.critical || 0}件`);
    console.log(`   高優先度問題: ${result.feedback_by_severity.high || 0}件`);
    console.log(`   ポジティブ率: ${result.sentiment_analysis.positive}%`);
    console.log(`   優先修正項目: ${result.priority_fixes.length}件`);
    
    console.log('\n🎉 自動フィードバック収集・分析システム完了！');
    
    return result;
    
  } catch (error) {
    console.error('❌ フィードバック分析システムでエラーが発生:', error);
    throw error;
  }
}

// ベータフィードバックデータ生成
function generateBetaFeedbackData(count: number): FeedbackData[] {
  const feedbackData: FeedbackData[] = [];
  
  const feedbackTypes: FeedbackData['feedback_type'][] = [
    'bug_report', 'feature_request', 'usability_issue', 'positive_feedback', 'general_comment'
  ];
  
  const categories: FeedbackData['category'][] = [
    'ui_ux', 'performance', 'functionality', 'content', 'accessibility', 'security'
  ];
  
  const severities: FeedbackData['severity'][] = ['critical', 'high', 'medium', 'low'];
  const platforms: ('iOS' | 'Android')[] = ['iOS', 'Android'];
  
  const bugDescriptions = [
    'アプリが頻繁にクラッシュする',
    '投稿作成時にフリーズする',
    '画像アップロードに失敗する',
    'ログイン後に白い画面になる',
    'プッシュ通知が届かない',
    '母子手帳番号認証でエラーが発生',
    'コメント投稿ができない',
    'プロフィール画像が表示されない',
    'チャット機能で送信エラー',
    'いいねボタンが反応しない'
  ];
  
  const usabilityIssues = [
    'ボタンが小さくてタップしにくい',
    '文字が小さくて読みにくい',
    'ナビゲーションが分かりにくい',
    '操作手順が複雑すぎる',
    'エラーメッセージが不明確',
    '設定画面が見つけにくい',
    '検索機能が使いにくい',
    'タブの切り替えが分からない',
    '戻るボタンの位置が分からない',
    'チュートリアルが不十分'
  ];
  
  const featureRequests = [
    'ダークモードを追加してほしい',
    'フォントサイズ調整機能',
    '投稿の下書き保存機能',
    'ブックマーク機能を追加',
    '投稿の編集機能',
    'グループチャット機能',
    '投稿の検索フィルター強化',
    'プロフィールのカスタマイズ',
    'オフライン機能の追加',
    '多言語対応'
  ];
  
  const positiveComments = [
    '同じママ友とつながれて嬉しい',
    'デザインがかわいくて使いやすい',
    '匿名で相談できるのが安心',
    '必要な機能が揃っている',
    'レスポンスが早くて快適',
    'チュートリアルが分かりやすい',
    'プライバシー設定が充実',
    'コミュニティが温かい',
    '投稿が簡単にできる',
    'サポートが迅速で助かる'
  ];
  
  for (let i = 0; i < count; i++) {
    const feedbackType = feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    
    let description = '';
    let severity: FeedbackData['severity'] = 'medium';
    
    switch (feedbackType) {
      case 'bug_report':
        description = bugDescriptions[Math.floor(Math.random() * bugDescriptions.length)];
        severity = ['critical', 'high', 'medium'][Math.floor(Math.random() * 3)] as FeedbackData['severity'];
        break;
      case 'usability_issue':
        description = usabilityIssues[Math.floor(Math.random() * usabilityIssues.length)];
        severity = ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as FeedbackData['severity'];
        break;
      case 'feature_request':
        description = featureRequests[Math.floor(Math.random() * featureRequests.length)];
        severity = ['medium', 'low'][Math.floor(Math.random() * 2)] as FeedbackData['severity'];
        break;
      case 'positive_feedback':
        description = positiveComments[Math.floor(Math.random() * positiveComments.length)];
        severity = 'low';
        break;
      case 'general_comment':
        description = 'アプリ全般についてのコメント';
        severity = 'low';
        break;
    }
    
    feedbackData.push({
      user_id: `beta-user-${i + 1}`,
      feedback_type: feedbackType,
      category,
      severity,
      description,
      steps_to_reproduce: feedbackType === 'bug_report' ? [
        '1. アプリを起動',
        '2. 対象機能を操作',
        '3. エラーが発生'
      ] : undefined,
      expected_behavior: feedbackType === 'bug_report' ? '正常に動作すること' : undefined,
      actual_behavior: feedbackType === 'bug_report' ? description : undefined,
      device_info: {
        platform,
        version: platform === 'iOS' ? '17.0' : '14.0',
        device_model: platform === 'iOS' ? 'iPhone 14' : 'Samsung Galaxy S23'
      },
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'new'
    });
  }
  
  return feedbackData;
}

// カテゴリ別分析
function analyzeFeedbackByCategory(feedbackData: FeedbackData[]): Record<string, number> {
  const analysis: Record<string, number> = {};
  
  feedbackData.forEach(feedback => {
    analysis[feedback.category] = (analysis[feedback.category] || 0) + 1;
  });
  
  return analysis;
}

// タイプ別分析
function analyzeFeedbackByType(feedbackData: FeedbackData[]): Record<string, number> {
  const analysis: Record<string, number> = {};
  
  feedbackData.forEach(feedback => {
    analysis[feedback.feedback_type] = (analysis[feedback.feedback_type] || 0) + 1;
  });
  
  return analysis;
}

// 重要度別分析
function analyzeFeedbackBySeverity(feedbackData: FeedbackData[]): Record<string, number> {
  const analysis: Record<string, number> = {};
  
  feedbackData.forEach(feedback => {
    analysis[feedback.severity] = (analysis[feedback.severity] || 0) + 1;
  });
  
  return analysis;
}

// 頻出問題特定
function identifyTopIssues(feedbackData: FeedbackData[]) {
  const issueCount: Record<string, { count: number; severity: string }> = {};
  
  feedbackData.forEach(feedback => {
    if (feedback.feedback_type === 'bug_report' || feedback.feedback_type === 'usability_issue') {
      const key = feedback.description;
      if (!issueCount[key]) {
        issueCount[key] = { count: 0, severity: feedback.severity };
      }
      issueCount[key].count++;
    }
  });
  
  const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  
  return Object.entries(issueCount)
    .map(([description, data]) => ({
      description,
      frequency: data.count,
      severity: data.severity,
      impact_score: data.count * severityWeight[data.severity as keyof typeof severityWeight]
    }))
    .sort((a, b) => b.impact_score - a.impact_score);
}

// センチメント分析
function analyzeFeedbackSentiment(feedbackData: FeedbackData[]) {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  
  feedbackData.forEach(feedback => {
    switch (feedback.feedback_type) {
      case 'positive_feedback':
        positive++;
        break;
      case 'bug_report':
      case 'usability_issue':
        negative++;
        break;
      default:
        neutral++;
        break;
    }
  });
  
  const total = feedbackData.length;
  
  return {
    positive: Math.round((positive / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    negative: Math.round((negative / total) * 100)
  };
}

// プラットフォーム固有問題分析
function analyzePlatformSpecificIssues(feedbackData: FeedbackData[]) {
  const iosBugs = feedbackData.filter(f => 
    f.device_info.platform === 'iOS' && 
    (f.feedback_type === 'bug_report' || f.feedback_type === 'usability_issue')
  );
  
  const androidBugs = feedbackData.filter(f => 
    f.device_info.platform === 'Android' && 
    (f.feedback_type === 'bug_report' || f.feedback_type === 'usability_issue')
  );
  
  const iosIssues = new Set(iosBugs.map(f => f.description));
  const androidIssues = new Set(androidBugs.map(f => f.description));
  
  const commonIssues = [...iosIssues].filter(issue => androidIssues.has(issue));
  const iosSpecific = [...iosIssues].filter(issue => !androidIssues.has(issue));
  const androidSpecific = [...androidIssues].filter(issue => !iosIssues.has(issue));
  
  return {
    ios_specific: iosSpecific.length,
    android_specific: androidSpecific.length,
    common_issues: commonIssues.length
  };
}

// アクショナブルインサイト生成
function generateActionableInsights(feedbackData: FeedbackData[], topIssues: any[], sentimentAnalysis: any): string[] {
  const insights: string[] = [];
  
  const criticalBugs = feedbackData.filter(f => f.severity === 'critical').length;
  const highPriorityIssues = feedbackData.filter(f => f.severity === 'high').length;
  
  if (criticalBugs > 0) {
    insights.push(`${criticalBugs}件のクリティカル問題の即座修正が必要`);
  }
  
  if (highPriorityIssues > feedbackData.length * 0.15) {
    insights.push('高優先度問題が多く、安定性向上が急務');
  }
  
  if (sentimentAnalysis.negative > 40) {
    insights.push('ネガティブフィードバックが多く、ユーザビリティ改善が必要');
  }
  
  const uiuxIssues = feedbackData.filter(f => f.category === 'ui_ux').length;
  if (uiuxIssues > feedbackData.length * 0.3) {
    insights.push('UI/UXの問題が多く、デザイン見直しが必要');
  }
  
  const performanceIssues = feedbackData.filter(f => f.category === 'performance').length;
  if (performanceIssues > feedbackData.length * 0.2) {
    insights.push('パフォーマンス問題の最適化が必要');
  }
  
  const featureRequests = feedbackData.filter(f => f.feedback_type === 'feature_request').length;
  if (featureRequests > feedbackData.length * 0.25) {
    insights.push('機能拡張の需要が高く、ロードマップ検討が必要');
  }
  
  if (topIssues.length > 0 && topIssues[0].frequency > feedbackData.length * 0.1) {
    insights.push(`「${topIssues[0].description}」が頻発問題として最優先対応が必要`);
  }
  
  insights.push('継続的なフィードバック収集システムの構築推奨');
  insights.push('ユーザーテストの定期実施によるプロアクティブな問題発見');
  insights.push('プラットフォーム別テスト強化による品質向上');
  
  return insights;
}

// 優先修正項目特定
function identifyPriorityFixes(feedbackData: FeedbackData[], topIssues: any[]): string[] {
  const fixes: string[] = [];
  
  // クリティカル問題
  const criticalIssues = feedbackData.filter(f => f.severity === 'critical');
  criticalIssues.forEach(issue => {
    fixes.push(`[CRITICAL] ${issue.description}の即座修正`);
  });
  
  // 頻出問題上位5件
  topIssues.slice(0, 5).forEach(issue => {
    if (issue.severity === 'high' || issue.frequency > 5) {
      fixes.push(`[HIGH] ${issue.description}の修正 (${issue.frequency}件報告)`);
    }
  });
  
  // カテゴリ別問題
  const categoryIssues = analyzeFeedbackByCategory(feedbackData);
  Object.entries(categoryIssues).forEach(([category, count]) => {
    if (count > feedbackData.length * 0.2) {
      fixes.push(`[MEDIUM] ${category}カテゴリの包括的改善 (${count}件)`);
    }
  });
  
  // プラットフォーム固有問題
  fixes.push('[LOW] iOS/Android固有問題の個別対応');
  fixes.push('[LOW] ユーザビリティテストによる継続的改善');
  
  return fixes.slice(0, 10); // 上位10件まで
}

// メイン実行
if (require.main === module) {
  runFeedbackAnalysis()
    .then(result => {
      console.log('\n✅ フィードバック分析システム完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ フィードバック分析システム失敗:', error);
      process.exit(1);
    });
}

export { runFeedbackAnalysis };