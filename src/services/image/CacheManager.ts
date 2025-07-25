/**
 * 画像キャッシュマネージャー
 * LRU cache、自動クリーンアップ、キャッシュ整合性管理
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageData, ImageCacheState } from '../../types/image';

interface CacheEntry {
  data: string;
  metadata: {
    size: number;
    lastAccessed: number;
    cacheKey: string;
    expiresAt?: number;
  };
}

export class CacheManager {
  private static instance: CacheManager;
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB
  private maxItemAge: number = 7 * 24 * 60 * 60 * 1000; // 7日間
  private cacheState: ImageCacheState;

  private constructor() {
    this.cacheState = {
      size: 0,
      maxSize: this.maxCacheSize,
      itemCount: 0,
      lastCleanup: null
    };
    this.initializeCache();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * キャッシュ初期化
   */
  private async initializeCache(): Promise<void> {
    try {
      console.log('🗄️ 画像キャッシュ初期化開始');
      
      // キャッシュ状態の復元
      const savedState = await AsyncStorage.getItem('image_cache_state');
      if (savedState) {
        this.cacheState = { ...this.cacheState, ...JSON.parse(savedState) };
      }
      
      // キャッシュ整合性チェック
      await this.verifyIntegrity();
      
      // 期限切れアイテムのクリーンアップ
      await this.cleanupExpiredItems();
      
      console.log('✅ 画像キャッシュ初期化完了:', this.cacheState);
    } catch (error) {
      console.error('❌ 画像キャッシュ初期化エラー:', error);
    }
  }

  /**
   * 画像データをキャッシュに保存
   */
  async store(key: string, imageData: ImageData): Promise<void> {
    try {
      console.log('💾 画像キャッシュ保存開始:', key);
      
      const cacheKey = this.generateCacheKey(key);
      const now = Date.now();
      
      const entry: CacheEntry = {
        data: typeof imageData.data === 'string' ? imageData.data : '',
        metadata: {
          size: imageData.metadata.size,
          lastAccessed: now,
          cacheKey,
          expiresAt: now + this.maxItemAge
        }
      };
      
      // キャッシュサイズチェック
      if (this.cacheState.size + entry.metadata.size > this.maxCacheSize) {
        await this.makeSpace(entry.metadata.size);
      }
      
      // データ保存
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      // キャッシュ状態更新
      this.cacheState.size += entry.metadata.size;
      this.cacheState.itemCount += 1;
      await this.saveCacheState();
      
      console.log('✅ 画像キャッシュ保存完了:', key);
    } catch (error) {
      console.error('❌ 画像キャッシュ保存エラー:', error);
      throw error;
    }
  }

  /**
   * キャッシュから画像データを取得
   */
  async retrieve(key: string): Promise<ImageData | null> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log('📭 キャッシュミス:', key);
        return null;
      }
      
      const entry: CacheEntry = JSON.parse(cachedData);
      
      // 有効期限チェック
      if (entry.metadata.expiresAt && Date.now() > entry.metadata.expiresAt) {
        console.log('⏰ キャッシュ期限切れ:', key);
        await this.remove(key);
        return null;
      }
      
      // アクセス時刻更新（LRU）
      entry.metadata.lastAccessed = Date.now();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      console.log('✅ キャッシュヒット:', key);
      
      return {
        data: entry.data,
        metadata: {
          size: entry.metadata.size,
          lastAccessed: new Date(entry.metadata.lastAccessed),
          cacheKey: entry.metadata.cacheKey
        }
      };
    } catch (error) {
      console.error('❌ 画像キャッシュ取得エラー:', error);
      return null;
    }
  }

  /**
   * キャッシュからアイテムを削除
   */
  async remove(key: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const entry: CacheEntry = JSON.parse(cachedData);
        
        await AsyncStorage.removeItem(cacheKey);
        
        // キャッシュ状態更新
        this.cacheState.size -= entry.metadata.size;
        this.cacheState.itemCount -= 1;
        await this.saveCacheState();
        
        console.log('🗑️ キャッシュアイテム削除:', key);
      }
    } catch (error) {
      console.error('❌ キャッシュアイテム削除エラー:', error);
    }
  }

  /**
   * キャッシュクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 キャッシュクリーンアップ開始');
      
      await this.cleanupExpiredItems();
      await this.cleanupOldestItems();
      
      this.cacheState.lastCleanup = new Date();
      await this.saveCacheState();
      
      console.log('✅ キャッシュクリーンアップ完了:', this.cacheState);
    } catch (error) {
      console.error('❌ キャッシュクリーンアップエラー:', error);
    }
  }

  /**
   * キャッシュサイズ取得
   */
  async getCacheSize(): Promise<number> {
    return this.cacheState.size;
  }

  /**
   * 全キャッシュクリア
   */
  async clearCache(): Promise<void> {
    try {
      console.log('🗑️ 全キャッシュクリア開始');
      
      // 全キャッシュキーを取得
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('img_cache_'));
      
      // 全キャッシュアイテムを削除
      await AsyncStorage.multiRemove(cacheKeys);
      
      // キャッシュ状態リセット
      this.cacheState = {
        size: 0,
        maxSize: this.maxCacheSize,
        itemCount: 0,
        lastCleanup: new Date()
      };
      
      await this.saveCacheState();
      
      console.log('✅ 全キャッシュクリア完了');
    } catch (error) {
      console.error('❌ 全キャッシュクリアエラー:', error);
    }
  }

  /**
   * キャッシュ統計取得
   */
  getCacheStats(): ImageCacheState {
    return { ...this.cacheState };
  }

  /**
   * キャッシュ設定更新
   */
  updateCacheSettings(maxSize?: number, maxAge?: number): void {
    if (maxSize && maxSize > 0) {
      this.maxCacheSize = maxSize;
      this.cacheState.maxSize = maxSize;
    }
    
    if (maxAge && maxAge > 0) {
      this.maxItemAge = maxAge;
    }
    
    console.log('⚙️ キャッシュ設定更新:', {
      maxCacheSize: this.maxCacheSize,
      maxItemAge: this.maxItemAge
    });
  }

  /**
   * キャッシュキー生成
   */
  private generateCacheKey(key: string): string {
    return `img_cache_${key}`;
  }

  /**
   * キャッシュ整合性検証
   */
  private async verifyIntegrity(): Promise<void> {
    try {
      console.log('🔍 キャッシュ整合性検証開始');
      
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('img_cache_'));
      
      let totalSize = 0;
      let validItemCount = 0;
      const corruptedKeys: string[] = [];
      
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entry: CacheEntry = JSON.parse(data);
            if (entry.metadata && typeof entry.metadata.size === 'number') {
              totalSize += entry.metadata.size;
              validItemCount += 1;
            } else {
              corruptedKeys.push(key);
            }
          } else {
            corruptedKeys.push(key);
          }
        } catch (error) {
          console.warn('⚠️ 破損したキャッシュアイテム:', key);
          corruptedKeys.push(key);
        }
      }
      
      // 破損したアイテムを削除
      if (corruptedKeys.length > 0) {
        console.log('🗑️ 破損したキャッシュアイテムを削除:', corruptedKeys.length);
        await AsyncStorage.multiRemove(corruptedKeys);
      }
      
      // キャッシュ状態を実際の値に更新
      this.cacheState.size = totalSize;
      this.cacheState.itemCount = validItemCount;
      
      console.log('✅ キャッシュ整合性検証完了:', {
        totalSize,
        validItemCount,
        removedCorrupted: corruptedKeys.length
      });
    } catch (error) {
      console.error('❌ キャッシュ整合性検証エラー:', error);
    }
  }

  /**
   * 期限切れアイテムのクリーンアップ
   */
  private async cleanupExpiredItems(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('img_cache_'));
      const now = Date.now();
      const expiredKeys: string[] = [];
      let reclaimedSize = 0;
      
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entry: CacheEntry = JSON.parse(data);
            if (entry.metadata.expiresAt && now > entry.metadata.expiresAt) {
              expiredKeys.push(key);
              reclaimedSize += entry.metadata.size;
            }
          }
        } catch (error) {
          // 解析できないアイテムも削除
          expiredKeys.push(key);
        }
      }
      
      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        this.cacheState.size -= reclaimedSize;
        this.cacheState.itemCount -= expiredKeys.length;
        
        console.log('🗑️ 期限切れアイテム削除:', {
          count: expiredKeys.length,
          reclaimedSize
        });
      }
    } catch (error) {
      console.error('❌ 期限切れアイテムクリーンアップエラー:', error);
    }
  }

  /**
   * 最古のアイテムをクリーンアップ（LRU）
   */
  private async cleanupOldestItems(): Promise<void> {
    try {
      if (this.cacheState.size <= this.maxCacheSize) {
        return;
      }
      
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('img_cache_'));
      const items: { key: string; entry: CacheEntry }[] = [];
      
      // 全アイテムを取得してアクセス時刻でソート
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entry: CacheEntry = JSON.parse(data);
            items.push({ key, entry });
          }
        } catch (error) {
          // 破損したアイテムは削除対象に
          items.push({ 
            key, 
            entry: { 
              data: '', 
              metadata: { 
                size: 0, 
                lastAccessed: 0, 
                cacheKey: key 
              } 
            } 
          });
        }
      }
      
      // アクセス時刻でソート（古い順）
      items.sort((a, b) => a.entry.metadata.lastAccessed - b.entry.metadata.lastAccessed);
      
      // サイズが制限以下になるまで削除
      const keysToRemove: string[] = [];
      let reclaimedSize = 0;
      
      for (const item of items) {
        if (this.cacheState.size - reclaimedSize <= this.maxCacheSize) {
          break;
        }
        
        keysToRemove.push(item.key);
        reclaimedSize += item.entry.metadata.size;
      }
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        this.cacheState.size -= reclaimedSize;
        this.cacheState.itemCount -= keysToRemove.length;
        
        console.log('🗑️ LRU削除:', {
          count: keysToRemove.length,
          reclaimedSize
        });
      }
    } catch (error) {
      console.error('❌ LRUクリーンアップエラー:', error);
    }
  }

  /**
   * 新しいアイテム用のスペース確保
   */
  private async makeSpace(requiredSize: number): Promise<void> {
    console.log('📦 キャッシュスペース確保:', requiredSize);
    
    // まず期限切れアイテムをクリーンアップ
    await this.cleanupExpiredItems();
    
    // まだ足りない場合はLRUで削除
    if (this.cacheState.size + requiredSize > this.maxCacheSize) {
      await this.cleanupOldestItems();
    }
    
    // それでも足りない場合は強制削除
    if (this.cacheState.size + requiredSize > this.maxCacheSize) {
      const deficit = (this.cacheState.size + requiredSize) - this.maxCacheSize;
      console.log('⚠️ 強制的にキャッシュスペースを確保:', deficit);
      
      // 追加のLRU削除を実行
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('img_cache_'));
      
      let removedSize = 0;
      for (const key of cacheKeys) {
        if (removedSize >= deficit) break;
        
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entry: CacheEntry = JSON.parse(data);
            await AsyncStorage.removeItem(key);
            removedSize += entry.metadata.size;
            this.cacheState.size -= entry.metadata.size;
            this.cacheState.itemCount -= 1;
          }
        } catch (error) {
          // エラーの場合もキーを削除
          await AsyncStorage.removeItem(key);
        }
      }
    }
  }

  /**
   * キャッシュ状態を保存
   */
  private async saveCacheState(): Promise<void> {
    try {
      await AsyncStorage.setItem('image_cache_state', JSON.stringify(this.cacheState));
    } catch (error) {
      console.error('❌ キャッシュ状態保存エラー:', error);
    }
  }
}