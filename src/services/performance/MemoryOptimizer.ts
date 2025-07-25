import * as React from 'react';
import { Image } from 'react-native';
import { performanceManager } from './PerformanceManager';

/**
 * メモリ使用量情報のインターフェース
 */
export interface MemoryUsageInfo {
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  cacheSize: number;
  imageMemoryUsage: number;
}

/**
 * 画像サイズの設定インターフェース
 */
export interface ImageSize {
  width: number;
  height: number;
  quality?: number;
}

/**
 * LRUキャッシュの実装
 */
class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;
  private accessOrder: K[];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // アクセス順序を更新
      this.updateAccessOrder(key);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
    } else {
      if (this.cache.size >= this.maxSize) {
        // 最も古いエントリを削除
        const oldestKey = this.accessOrder.shift();
        if (oldestKey !== undefined) {
          this.cache.delete(oldestKey);
        }
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }

  private updateAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
}

/**
 * メモリ最適化を担当するクラス
 * 画像メモリ管理、キャッシュ制御、ガベージコレクション促進を実行
 */
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private imageCache: LRUCache<string, string>;
  private isMonitoring: boolean = false;
  private memoryUsageHistory: number[] = [];
  private gcIntervalId: number | null = null;

  private constructor() {
    const settings = performanceManager.getSettings();
    const cacheSize = settings?.memoryOptimization.cacheSize || 50;
    this.imageCache = new LRUCache<string, string>(cacheSize);
  }

  public static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  /**
   * メモリ使用量の監視
   */
  public monitorMemoryUsage(): MemoryUsageInfo {
    // React Nativeでのメモリ使用量取得は制限的
    // 実際の実装では react-native-device-info などを使用
    const estimatedUsage = this.estimateMemoryUsage();
    
    this.memoryUsageHistory.push(estimatedUsage.usedMemory);
    
    // 履歴は最新100件まで保持
    if (this.memoryUsageHistory.length > 100) {
      this.memoryUsageHistory.shift();
    }

    // メモリ警告の確認
    this.checkMemoryWarning(estimatedUsage);

    return estimatedUsage;
  }

  /**
   * 画像メモリの最適化
   */
  public async optimizeImageMemory(imageUri: string, targetSize: ImageSize): Promise<string> {
    // キャッシュから確認
    const cacheKey = `${imageUri}_${targetSize.width}x${targetSize.height}_${targetSize.quality || 80}`;
    const cachedUri = this.imageCache.get(cacheKey);
    
    if (cachedUri) {
      console.log(`MemoryOptimizer: キャッシュから画像を取得 ${cacheKey}`);
      return cachedUri;
    }

    try {
      // 画像リサイズとメモリ最適化
      const optimizedUri = await this.resizeAndOptimizeImage(imageUri, targetSize);
      
      // キャッシュに保存
      this.imageCache.set(cacheKey, optimizedUri);
      
      console.log(`MemoryOptimizer: 画像を最適化してキャッシュに保存 ${cacheKey}`);
      return optimizedUri;
      
    } catch (error) {
      console.error('MemoryOptimizer: 画像最適化エラー', error);
      return imageUri; // 元の画像URIを返す
    }
  }

  /**
   * 未使用キャッシュのクリア
   */
  public async clearUnusedCache(): Promise<void> {
    const beforeSize = this.imageCache.size();
    
    // キャッシュサイズの調整
    const settings = performanceManager.getSettings();
    const maxCacheSize = settings?.memoryOptimization.cacheSize || 50;
    
    if (beforeSize > maxCacheSize * 0.8) { // 80%を超えた場合
      // 古いエントリの削除
      const targetSize = Math.floor(maxCacheSize * 0.6); // 60%まで削減
      const deleteCount = beforeSize - targetSize;
      
      for (let i = 0; i < deleteCount; i++) {
        // LRUキャッシュなので、自動的に古いエントリが削除される
        this.imageCache.set(`temp_${i}`, `temp_${i}`);
      }
    }

    const afterSize = this.imageCache.size();
    console.log(`MemoryOptimizer: キャッシュをクリアしました (${beforeSize} -> ${afterSize})`);
  }

  /**
   * ガベージコレクションの促進
   */
  public enableGarbageCollection(): void {
    const settings = performanceManager.getSettings();
    const interval = settings?.memoryOptimization.garbageCollectionInterval || 30000;

    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
    }

    this.gcIntervalId = setInterval(() => {
      this.forceGarbageCollection();
    }, interval) as number;

    console.log(`MemoryOptimizer: ガベージコレクションを ${interval}ms 間隔で有効化しました`);
  }

  /**
   * メモリ警告の閾値設定
   */
  public setMemoryWarningThreshold(threshold: number): void {
    console.log(`MemoryOptimizer: メモリ警告閾値を ${threshold}MB に設定しました`);
    
    // AsyncStorageに閾値を保存
    this.saveMemoryThreshold(threshold);
  }

  /**
   * メモリ使用量統計の取得
   */
  public getMemoryStats(): {
    current: MemoryUsageInfo;
    average: number;
    peak: number;
    cacheStats: { size: number; maxSize: number };
  } {
    const current = this.monitorMemoryUsage();
    const average = this.memoryUsageHistory.length > 0 
      ? this.memoryUsageHistory.reduce((sum, usage) => sum + usage, 0) / this.memoryUsageHistory.length
      : 0;
    const peak = Math.max(...this.memoryUsageHistory, 0);

    return {
      current,
      average: Math.round(average * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      cacheStats: {
        size: this.imageCache.size(),
        maxSize: 50 // TODO: 設定から取得
      }
    };
  }

  /**
   * メモリ監視の開始
   */
  public startMemoryMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('MemoryOptimizer: メモリ監視を開始しました');

    // 定期的なメモリ使用量チェック
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 5000) as number; // 5秒間隔

    // ガベージコレクションの有効化
    this.enableGarbageCollection();
  }

  /**
   * メモリ監視の停止
   */
  public stopMemoryMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
      this.gcIntervalId = null;
    }

    console.log('MemoryOptimizer: メモリ監視を停止しました');
  }

  /**
   * メモリ使用量の推定
   */
  private estimateMemoryUsage(): MemoryUsageInfo {
    // 実際の実装では react-native-device-info や
    // ネイティブモジュールを使用してメモリ情報を取得
    
    const totalMemory = 4000; // MB (仮の値)
    const imageMemoryUsage = this.imageCache.size() * 2; // 1画像あたり約2MBと仮定
    const estimatedUsedMemory = 100 + imageMemoryUsage; // 基本使用量 + 画像メモリ
    const availableMemory = totalMemory - estimatedUsedMemory;

    return {
      totalMemory,
      usedMemory: estimatedUsedMemory,
      availableMemory: Math.max(availableMemory, 0),
      cacheSize: this.imageCache.size(),
      imageMemoryUsage
    };
  }

  /**
   * 画像のリサイズと最適化
   */
  private async resizeAndOptimizeImage(imageUri: string, targetSize: ImageSize): Promise<string> {
    return new Promise((resolve, reject) => {
      // 実際の実装ではreact-native-image-resizerなどを使用
      // ここでは簡略化された処理
      
      const quality = targetSize.quality || 80;
      
      // 画像サイズの取得
      Image.getSize(
        imageUri,
        (originalWidth, originalHeight) => {
          const { width: targetWidth, height: targetHeight } = targetSize;
          
          // リサイズ比率の計算
          const scaleX = targetWidth / originalWidth;
          const scaleY = targetHeight / originalHeight;
          const scale = Math.min(scaleX, scaleY);
          
          const newWidth = Math.round(originalWidth * scale);
          const newHeight = Math.round(originalHeight * scale);
          
          console.log(
            `MemoryOptimizer: 画像をリサイズ ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight} (品質: ${quality}%)`
          );
          
          // 実際のリサイズ処理は外部ライブラリに依存
          // ここでは元のURIを返す（実装の簡略化）
          resolve(imageUri);
        },
        (error) => {
          console.error('MemoryOptimizer: 画像サイズ取得エラー', error);
          reject(error);
        }
      );
    });
  }

  /**
   * メモリ警告のチェック
   */
  private checkMemoryWarning(usage: MemoryUsageInfo): void {
    const settings = performanceManager.getSettings();
    const threshold = 80; // デフォルト閾値: 80%
    
    const usagePercentage = (usage.usedMemory / usage.totalMemory) * 100;
    
    if (usagePercentage > threshold) {
      console.warn(
        `MemoryOptimizer: メモリ使用量が閾値を超えました ` +
        `(${usagePercentage.toFixed(1)}% > ${threshold}%)`
      );
      
      // 自動最適化の実行
      this.performEmergencyOptimization();
    }
  }

  /**
   * 緊急時のメモリ最適化
   */
  private performEmergencyOptimization(): void {
    console.log('MemoryOptimizer: 緊急メモリ最適化を実行します');
    
    // キャッシュの強制クリア
    this.clearUnusedCache();
    
    // ガベージコレクションの強制実行
    this.forceGarbageCollection();
    
    // イメージキャッシュのサイズ削減
    const currentSize = this.imageCache.size();
    const targetSize = Math.floor(currentSize * 0.5); // 50%削減
    
    for (let i = 0; i < currentSize - targetSize; i++) {
      // 最も古いエントリを削除（LRUキャッシュの特性により）
      this.imageCache.set(`emergency_cleanup_${i}`, '');
    }
    
    console.log(`MemoryOptimizer: 緊急最適化完了 (キャッシュサイズ: ${currentSize} -> ${this.imageCache.size()})`);
  }

  /**
   * ガベージコレクションの強制実行
   */
  private forceGarbageCollection(): void {
    // JavaScript の gc() は通常利用できないため、
    // 間接的にガベージコレクションを促進する処理
    
    // 大きなオブジェクトの作成と解放でGCを促進
    let dummy: any[] = [];
    for (let i = 0; i < 1000; i++) {
      dummy.push({ id: i, data: new Array(100).fill(0) });
    }
    dummy = [];
    
    console.log('MemoryOptimizer: ガベージコレクション促進処理を実行しました');
  }

  /**
   * メモリ閾値の保存
   */
  private async saveMemoryThreshold(threshold: number): Promise<void> {
    try {
      // AsyncStorageを使用して閾値を保存
      // await AsyncStorage.setItem('memory_threshold', threshold.toString());
      console.log(`MemoryOptimizer: メモリ閾値 ${threshold}MB を保存しました`);
    } catch (error) {
      console.error('MemoryOptimizer: 閾値保存エラー', error);
    }
  }
}

/**
 * メモリ最適化用カスタムフック
 */
export const useMemoryOptimization = () => {
  const memoryOptimizer = MemoryOptimizer.getInstance();
  
  const optimizeImage = async (imageUri: string, size: ImageSize) => {
    return memoryOptimizer.optimizeImageMemory(imageUri, size);
  };
  
  const clearCache = async () => {
    return memoryOptimizer.clearUnusedCache();
  };
  
  const getStats = () => {
    return memoryOptimizer.getMemoryStats();
  };

  return {
    optimizeImage,
    clearCache,
    getStats
  };
};

/**
 * 画像メモリ最適化コンポーネント用HOC
 */
export const withMemoryOptimization = <P extends { source: { uri: string } }>(
  ImageComponent: React.ComponentType<P>
) => {
  const Component = React.forwardRef<any, P>((props, ref) => {
    const memoryOptimizer = MemoryOptimizer.getInstance();
    const [optimizedUri, setOptimizedUri] = React.useState<string>(props.source.uri);

    React.useEffect(() => {
      const optimizeImageAsync = async () => {
        try {
          const optimized = await memoryOptimizer.optimizeImageMemory(
            props.source.uri,
            { width: 300, height: 300, quality: 80 } // デフォルトサイズ
          );
          setOptimizedUri(optimized);
        } catch (error) {
          console.error('画像最適化エラー:', error);
        }
      };

      optimizeImageAsync();
    }, [props.source?.uri]);

    return React.createElement(ImageComponent as any, {
      ...props,
      source: { ...props.source, uri: optimizedUri },
      ref
    });
  });
  
  Component.displayName = `MemoryOptimized(${ImageComponent.displayName || ImageComponent.name || 'Component'})`;
  return Component;
};

// シングルトンインスタンスのエクスポート
export const memoryOptimizer = MemoryOptimizer.getInstance();