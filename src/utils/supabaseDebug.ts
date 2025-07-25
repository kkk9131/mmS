// Supabaseデバッグユーティリティ
// 本番環境でのエラーを詳細に記録

export interface DebugInfo {
  timestamp: string;
  action: string;
  success: boolean;
  error?: any;
  details?: any;
}

class SupabaseDebugger {
  private static instance: SupabaseDebugger;
  private logs: DebugInfo[] = [];

  private constructor() {}

  public static getInstance(): SupabaseDebugger {
    if (!SupabaseDebugger.instance) {
      SupabaseDebugger.instance = new SupabaseDebugger();
    }
    return SupabaseDebugger.instance;
  }

  public log(action: string, success: boolean, error?: any, details?: any) {
    const info: DebugInfo = {
      timestamp: new Date().toISOString(),
      action,
      success,
      error: error ? {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        details: error?.details,
        hint: error?.hint,
        name: error?.name,
        stack: error?.stack?.substring(0, 200), // スタックトレースの一部
      } : undefined,
      details
    };

    this.logs.push(info);
    
    // 最新10件のログを保持
    if (this.logs.length > 10) {
      this.logs.shift();
    }

    // コンソールにも出力
    if (success) {
      console.log(`✅ ${action}`, details);
    } else {
      console.error(`❌ ${action}`, error);
    }
  }

  public getLogs(): DebugInfo[] {
    return [...this.logs];
  }

  public getLastError(): DebugInfo | undefined {
    return this.logs.filter(log => !log.success).pop();
  }

  public clear() {
    this.logs = [];
  }

  public generateReport(): string {
    const report = {
      totalLogs: this.logs.length,
      errors: this.logs.filter(log => !log.success).length,
      lastError: this.getLastError(),
      environment: {
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
        hasAnonKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        useSupabase: process.env.EXPO_PUBLIC_USE_SUPABASE,
        platform: typeof window !== 'undefined' ? 'web' : 'native',
      },
      logs: this.logs
    };

    return JSON.stringify(report, null, 2);
  }
}

export const supabaseDebugger = SupabaseDebugger.getInstance();