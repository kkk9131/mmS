interface AIEmpathyResponse {
  response: string;
  confidence: number;
  containsMedicalContent: boolean;
}

class AIEmpathyService {
  private static instance: AIEmpathyService;
  private isEnabled: boolean = true;

  private constructor() {}

  public static getInstance(): AIEmpathyService {
    if (!AIEmpathyService.instance) {
      AIEmpathyService.instance = new AIEmpathyService();
    }
    return AIEmpathyService.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public async generateEmpathyResponse(postContent: string): Promise<AIEmpathyResponse | null> {
    if (!this.isEnabled) {
      return null;
    }

    // シミュレーションのための簡単な実装
    // 実際の実装では、適切なAI APIを使用する必要があります
    const responses = this.getEmpathyResponses(postContent);
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    const containsMedicalContent = this.detectMedicalContent(postContent);
    
    return {
      response: containsMedicalContent ? this.getMedicalAdviceResponse() : randomResponse,
      confidence: 0.8,
      containsMedicalContent
    };
  }

  private getEmpathyResponses(content: string): string[] {
    const keywords = content.toLowerCase();
    
    if (keywords.includes('夜泣き') || keywords.includes('睡眠')) {
      return [
        '夜泣き本当にお疲れ様です。一人で頑張らないで、少しでも休める時間を作ってくださいね',
        '睡眠不足は辛いですよね。無理をしないで、周りの人に頼ることも大切です',
        '夜中の育児は本当に大変。あなたの頑張りを見てくれている人がいますよ'
      ];
    }
    
    if (keywords.includes('離乳食') || keywords.includes('食べない')) {
      return [
        '離乳食の悩み、よくわかります。無理をせず、お子さんのペースに合わせて大丈夫ですよ',
        '食べない時期は必ずあります。栄養面で心配な時は、小児科で相談してみてくださいね',
        '離乳食は思うようにいかないもの。完璧を求めすぎないで大丈夫です'
      ];
    }
    
    if (keywords.includes('疲れ') || keywords.includes('しんどい')) {
      return [
        '本当にお疲れ様です。あなたの気持ち、よくわかります',
        '疲れている時は、無理をしないで休むことも大切です',
        '一人で抱え込まないで。みんなで支え合いましょう'
      ];
    }
    
    if (keywords.includes('心配') || keywords.includes('不安')) {
      return [
        '心配になる気持ち、とてもよくわかります。一人で抱え込まないでくださいね',
        '不安な時は、信頼できる人に相談することも大切です',
        'あなたの気持ちに寄り添います。何でも話してください'
      ];
    }
    
    // デフォルトの共感メッセージ
    return [
      'あなたの気持ち、よくわかります。一人じゃないですよ',
      'お疲れ様です。あなたの頑張りを見てくれている人がいます',
      '大変な時期ですが、きっと乗り越えられます。応援しています',
      'あなたの気持ちに共感します。無理をしないでくださいね'
    ];
  }

  private detectMedicalContent(content: string): boolean {
    const medicalKeywords = [
      '発熱', '熱', '病気', '薬', '病院', '診察', '症状', '治療',
      'けいれん', '下痢', '嘔吐', '発疹', '咳', '鼻水', '予防接種'
    ];
    
    const lowerContent = content.toLowerCase();
    return medicalKeywords.some(keyword => lowerContent.includes(keyword));
  }

  private getMedicalAdviceResponse(): string {
    return '健康に関する心配事は、専門家に相談してくださいね 👉 小児科・保健所まで';
  }
}

export default AIEmpathyService;