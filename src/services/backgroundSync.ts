import { useCallback } from 'react';
// import NetInfo from '@react-native-community/netinfo';
import { store } from '../store';
import { postsApi } from '../store/api/postsApi';
import { notificationsApi } from '../store/api/notificationsApi';
import { performanceMonitor } from '../utils/performanceMonitor';

interface SyncTask {
  id: string;
  endpoint: string;
  params?: any;
  priority: number;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: Date;
  completedAt?: Date;
  error?: Error;
}

interface SyncConfig {
  enabled: boolean;
  syncInterval: number; // in milliseconds
  maxConcurrentSyncs: number;
  syncOnAppForeground: boolean;
  syncOnNetworkReconnect: boolean;
  priorityThreshold: number;
}

class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private syncQueue: Map<string, SyncTask> = new Map();
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  
  private config: SyncConfig = {
    enabled: true,
    syncInterval: 30000, // 30 seconds
    maxConcurrentSyncs: 3,
    syncOnAppForeground: true,
    syncOnNetworkReconnect: true,
    priorityThreshold: 5,
  };

  private constructor() {
    this.setupNetworkListener();
    this.startSyncInterval();
  }

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  // Setup network state listener
  private setupNetworkListener(): void {
    // TODO: Implement when NetInfo is available
    // this.networkUnsubscribe = NetInfo.addEventListener((state: any) => {
    //   if (state.isConnected && this.config.syncOnNetworkReconnect) {
    //     console.log('Network reconnected, triggering background sync');
    //     this.syncNow();
    //   }
    // });
  }

  // Start periodic sync
  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.config.enabled) {
        this.performSync();
      }
    }, this.config.syncInterval);
  }

  // Add a sync task to the queue
  addSyncTask(task: Omit<SyncTask, 'id' | 'retryCount'>): void {
    const id = `${task.endpoint}_${Date.now()}_${Math.random()}`;
    const syncTask: SyncTask = {
      ...task,
      id,
      retryCount: 0,
      maxRetries: task.maxRetries || 3,
    };

    this.syncQueue.set(id, syncTask);
    
    // Trigger immediate sync if high priority
    if (task.priority >= this.config.priorityThreshold) {
      this.syncNow();
    }
  }

  // Perform sync operation
  private async performSync(): Promise<void> {
    if (this.isRunning || this.syncQueue.size === 0) {
      return;
    }

    this.isRunning = true;

    try {
      // Check network connectivity (TODO: implement when NetInfo is available)
      // const netInfo = await NetInfo.fetch();
      // if (!netInfo.isConnected) {
      //   console.log('No network connection, skipping sync');
      //   return;
      // }

      // Get tasks to sync (sorted by priority)
      const tasks = Array.from(this.syncQueue.values())
        .filter(task => !task.completedAt)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, this.config.maxConcurrentSyncs);

      // Execute sync tasks
      const syncPromises = tasks.map(task => this.executeSyncTask(task));
      await Promise.allSettled(syncPromises);

      // Clean up completed tasks
      this.cleanupCompletedTasks();
    } catch (error) {
      console.error('Background sync error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Execute a single sync task
  private async executeSyncTask(task: SyncTask): Promise<void> {
    const metricName = `background_sync_${task.endpoint}`;
    performanceMonitor.startMetric(metricName, { 
      endpoint: task.endpoint,
      priority: task.priority,
      retryCount: task.retryCount 
    });

    try {
      task.lastAttemptAt = new Date();

      // Execute the sync based on endpoint
      switch (task.endpoint) {
        case 'posts/refresh':
          await this.syncPosts(task.params);
          break;
          
        case 'notifications/refresh':
          await this.syncNotifications(task.params);
          break;
          
        case 'posts/create':
          await this.syncCreatePost(task.params);
          break;
          
        case 'posts/like':
          await this.syncLikePost(task.params);
          break;
          
        default:
          console.warn(`Unknown sync endpoint: ${task.endpoint}`);
      }

      // Mark as completed
      task.completedAt = new Date();
      const metric = performanceMonitor.endMetric(metricName);
      
      if (__DEV__ && metric) {
        console.log(`Background sync completed: ${task.endpoint} in ${metric.duration?.toFixed(2)}ms`);
      }
    } catch (error) {
      task.error = error as Error;
      task.retryCount++;
      
      const metric = performanceMonitor.endMetric(metricName);
      console.error(`Background sync failed: ${task.endpoint}`, error);

      // Remove from queue if max retries exceeded
      if (task.retryCount >= task.maxRetries) {
        console.error(`Max retries exceeded for sync task: ${task.endpoint}`);
        task.completedAt = new Date(); // Mark as completed to remove from queue
      }
    }
  }

  // Sync posts
  private async syncPosts(params?: any): Promise<void> {
    const result = await store.dispatch(
      postsApi.endpoints.getPosts.initiate(
        { limit: 20, offset: 0, ...params },
        { forceRefetch: true }
      )
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  // Sync notifications
  private async syncNotifications(params?: any): Promise<void> {
    const result = await store.dispatch(
      notificationsApi.endpoints.getNotifications.initiate(
        params || {},
        { forceRefetch: true }
      )
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  // Sync offline post creation
  private async syncCreatePost(postData: any): Promise<void> {
    const result = await store.dispatch(
      postsApi.endpoints.createPost.initiate(postData)
    );
    
    if (result.error) {
      throw result.error;
    }
  }

  // Sync offline like action (TODO: implement when like endpoints are available)
  private async syncLikePost(params: { postId: string; liked: boolean }): Promise<void> {
    console.log('Like sync not yet implemented:', params);
    // TODO: Implement when like/unlike endpoints are available
    // const endpoint = params.liked 
    //   ? postsApi.endpoints.likePost 
    //   : postsApi.endpoints.unlikePost;
    // 
    // const result = await store.dispatch(
    //   endpoint.initiate(params.postId)
    // );
    // 
    // if (result.error) {
    //   throw result.error;
    // }
  }

  // Clean up completed tasks
  private cleanupCompletedTasks(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const [id, task] of this.syncQueue.entries()) {
      if (task.completedAt && task.completedAt < oneHourAgo) {
        this.syncQueue.delete(id);
      }
    }
  }

  // Trigger immediate sync
  syncNow(): void {
    if (this.config.enabled) {
      this.performSync();
    }
  }

  // Pause sync
  pause(): void {
    this.config.enabled = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Resume sync
  resume(): void {
    this.config.enabled = true;
    this.startSyncInterval();
    this.syncNow();
  }

  // Update configuration
  updateConfig(updates: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Restart sync interval if interval changed
    if (updates.syncInterval) {
      this.startSyncInterval();
    }
  }

  // Get sync status
  getStatus(): {
    isRunning: boolean;
    queueSize: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const tasks = Array.from(this.syncQueue.values());
    
    return {
      isRunning: this.isRunning,
      queueSize: this.syncQueue.size,
      pendingTasks: tasks.filter(t => !t.completedAt).length,
      completedTasks: tasks.filter(t => t.completedAt && !t.error).length,
      failedTasks: tasks.filter(t => t.error).length,
    };
  }

  // Clean up
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    this.syncQueue.clear();
  }
}

export const backgroundSync = BackgroundSyncService.getInstance();

// Utility function to queue sync task
export const queueSyncTask = (
  endpoint: string,
  params?: any,
  priority: number = 1,
  maxRetries: number = 3
): void => {
  backgroundSync.addSyncTask({
    endpoint,
    params,
    priority,
    maxRetries,
  });
};

// High priority sync for critical operations
export const queueCriticalSync = (endpoint: string, params?: any): void => {
  queueSyncTask(endpoint, params, 10, 5);
};

// Hook for component-level sync management
export const useBackgroundSync = () => {
  const syncNow = useCallback(() => {
    backgroundSync.syncNow();
  }, []);

  const getStatus = useCallback(() => {
    return backgroundSync.getStatus();
  }, []);

  return {
    syncNow,
    getStatus,
    queueSyncTask,
    queueCriticalSync,
  };
};