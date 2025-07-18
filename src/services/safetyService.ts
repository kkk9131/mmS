interface SafetyReport {
  postId: string;
  reporterId: string;
  reason: 'inappropriate' | 'spam' | 'harassment' | 'other';
  description?: string;
  timestamp: string;
}

interface BlockedUser {
  userId: string;
  blockedAt: string;
}

class SafetyService {
  private static instance: SafetyService;
  private blockedUsers: Set<string> = new Set();
  private reportedPosts: Map<string, SafetyReport[]> = new Map();

  private constructor() {}

  public static getInstance(): SafetyService {
    if (!SafetyService.instance) {
      SafetyService.instance = new SafetyService();
    }
    return SafetyService.instance;
  }

  public blockUser(userId: string): void {
    this.blockedUsers.add(userId);
    console.log(`User ${userId} has been blocked`);
  }

  public unblockUser(userId: string): void {
    this.blockedUsers.delete(userId);
    console.log(`User ${userId} has been unblocked`);
  }

  public isUserBlocked(userId: string): boolean {
    return this.blockedUsers.has(userId);
  }

  public getBlockedUsers(): string[] {
    return Array.from(this.blockedUsers);
  }

  public reportPost(report: SafetyReport): void {
    const existingReports = this.reportedPosts.get(report.postId) || [];
    existingReports.push(report);
    this.reportedPosts.set(report.postId, existingReports);
    
    console.log(`Post ${report.postId} has been reported for: ${report.reason}`);
    
    // 実際の実装では、ここでモデレーションチームに通知を送る
    this.notifyModerationTeam(report);
  }

  public getReportsForPost(postId: string): SafetyReport[] {
    return this.reportedPosts.get(postId) || [];
  }

  public filterInappropriateContent(content: string): boolean {
    const inappropriateKeywords = [
      // 実際の実装では、より包括的なフィルタリングリストを使用
      'スパム', '宣伝', '販売', '商品', '購入'
    ];
    
    const lowerContent = content.toLowerCase();
    return inappropriateKeywords.some(keyword => lowerContent.includes(keyword));
  }

  private notifyModerationTeam(report: SafetyReport): void {
    // 実際の実装では、モデレーションチームへの通知システムを実装
    console.log('Moderation team notified about report:', report);
  }

  public getContentGuidelines(): string[] {
    return [
      'お互いを尊重し、温かいコミュニケーションを心がけましょう',
      '医療アドバイスは控え、専門家への相談を推奨してください',
      '個人情報や連絡先の投稿は避けてください',
      '商品の宣伝や販売は禁止されています',
      '他のユーザーへの誹謗中傷は絶対にやめてください'
    ];
  }
}

export default SafetyService;