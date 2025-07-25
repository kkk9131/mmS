
// メモリキャッシュの実装
class PerformanceCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5分

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  invalidate(pattern?: string) {
    if (pattern) {
      // パターンマッチでキャッシュクリア
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

// 使用例
const cache = new PerformanceCache();

export const getCachedPosts = async () => {
  return cache.get('posts:recent', async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    return data;
  });
};
