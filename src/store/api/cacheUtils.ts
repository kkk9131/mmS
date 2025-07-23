import { FetchBaseQueryError } from '@reduxjs/toolkit/query';

// Cache time constants (in seconds)
export const CACHE_TIMES = {
  SHORT: 30,          // 30 seconds - for frequently changing data
  MEDIUM: 300,        // 5 minutes - for moderately changing data
  LONG: 900,          // 15 minutes - for rarely changing data
  VERY_LONG: 3600,    // 1 hour - for static data
} as const;

// Tag types for cache invalidation
export const TAG_TYPES = {
  Post: 'Post',
  User: 'User',
  Notification: 'Notification',
  Follow: 'Follow',
  Comment: 'Comment',
  Like: 'Like',
} as const;

// Generate cache tags for posts
export const postTags = {
  list: (filters?: any) => {
    const baseTags = [{ type: 'Post' as const, id: 'LIST' }];
    if (filters) {
      baseTags.push({ type: 'Post' as const, id: JSON.stringify(filters) });
    }
    return baseTags;
  },
  detail: (id: string) => {
    return [{ type: 'Post' as const, id }];
  },
  likes: (postId: string) => {
    return [{ type: 'Like' as const, id: `post-${postId}` }];
  },
  comments: (postId: string) => {
    return [{ type: 'Comment' as const, id: `post-${postId}` }];
  },
};

// Generate cache tags for users
export const userTags = {
  current: () => {
    return [{ type: 'User' as const, id: 'CURRENT' }];
  },
  detail: (id: string) => {
    return [{ type: 'User' as const, id }];
  },
  list: () => {
    return [{ type: 'User' as const, id: 'LIST' }];
  },
  followers: (userId: string) => {
    return [{ type: 'Follow' as const, id: `followers-${userId}` }];
  },
  following: (userId: string) => {
    return [{ type: 'Follow' as const, id: `following-${userId}` }];
  },
};

// Generate cache tags for notifications
export const notificationTags = {
  list: (filters?: any) => {
    const baseTags = [{ type: 'Notification' as const, id: 'LIST' }];
    if (filters) {
      baseTags.push({ type: 'Notification' as const, id: JSON.stringify(filters) });
    }
    return baseTags;
  },
  unreadCount: () => {
    return [{ type: 'Notification' as const, id: 'UNREAD_COUNT' }];
  },
};

// Generate cache tags for follows
export const followTags = {
  status: (targetUserId: string) => {
    return [{ type: 'Follow' as const, id: `status-${targetUserId}` }];
  },
  recommendations: () => {
    return [{ type: 'Follow' as const, id: 'RECOMMENDATIONS' }];
  },
};

// Optimistic update helpers
export interface OptimisticUpdate<T> {
  optimisticData: T;
  rollbackOnError?: boolean;
  mergeFn?: (current: T, optimistic: T) => T;
}

export const createOptimisticUpdate = <T>(
  update: OptimisticUpdate<T>
): OptimisticUpdate<T> => ({
  rollbackOnError: true,
  ...update,
});

// Cache update utilities
export const updateCacheOnSuccess = <T>(
  cacheName: string,
  updateFn: (draft: T) => void
) => {
  return (api: any, { dispatch }: any, result: any) => {
    const patchResult = dispatch(
      api.util.updateQueryData(cacheName, undefined, updateFn)
    );
    
    // Rollback on error
    if (result.error) {
      patchResult.undo();
    }
  };
};

// Selective cache invalidation
export const selectiveInvalidateTags = (
  api: any,
  tagType: string,
  ids: string[]
) => {
  const tags = ids.map(id => ({ type: tagType, id }));
  api.dispatch(api.util.invalidateTags(tags));
};

// Background sync configuration
export interface BackgroundSyncConfig {
  interval: number; // in milliseconds
  condition?: () => boolean;
  onSync?: () => void;
}

export const createBackgroundSync = (
  api: any,
  endpoint: string,
  config: BackgroundSyncConfig
) => {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  
  const start = () => {
    if (intervalId) return;
    
    intervalId = setInterval(() => {
      if (config.condition && !config.condition()) return;
      
      api.dispatch(api.endpoints[endpoint].initiate(undefined, {
        forceRefetch: true,
        subscribe: false,
      }));
      
      config.onSync?.();
    }, config.interval);
  };
  
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  
  return { start, stop };
};

// Error retry configuration
export const getRetryConfig = (attempt: number, error: FetchBaseQueryError | undefined) => {
  if (!error) return 0;
  
  // Don't retry on client errors (4xx)
  if ('status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    return 0;
  }
  
  // Exponential backoff for server errors and network errors
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  
  return delay;
};

// Query result transformer for consistent data shape
export const transformQueryResponse = <T>(
  response: any,
  defaultValue: T
): T => {
  if (!response || response.error) {
    return defaultValue;
  }
  
  return response.data || defaultValue;
};

// Batch operation utilities
export const createBatchOperation = <T, R>(
  batchSize: number,
  operation: (batch: T[]) => Promise<R[]>
) => {
  return async (items: T[]): Promise<R[]> => {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await operation(batch);
      results.push(...batchResults);
    }
    
    return results;
  };
};