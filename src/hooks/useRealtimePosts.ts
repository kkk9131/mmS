import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from './redux';
import { useRealtimeSubscription, useMultipleRealtimeSubscriptions } from './useRealtimeSubscription';
import { postsApi } from '../store/api/postsApi';
import { supabaseClient } from '../services/supabase/client';
import { FeatureFlagsManager } from '../services/featureFlags';
import { Post as SupabasePost, Comment as SupabaseComment, Like } from '../types/supabase';

export interface UseRealtimePostsOptions {
  /**
   * 自動でサブスクライブするかどうか
   */
  autoSubscribe?: boolean;
  
  /**
   * 競合解決の戦略
   */
  conflictResolution?: 'latest' | 'merge' | 'user-wins';
  
  /**
   * エラーハンドラー
   */
  onError?: (error: Error, context: string) => void;
  
  /**
   * デバッグモード
   */
  debug?: boolean;
}

export interface RealtimePostUpdate {
  type: 'post' | 'like' | 'comment';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: Date;
  userId?: string;
}

/**
 * 投稿のリアルタイム更新を管理するフック
 */
export function useRealtimePosts(options: UseRealtimePostsOptions = {}) {
  const dispatch = useAppDispatch();
  const featureFlags = FeatureFlagsManager.getInstance();
  
  const {
    autoSubscribe = true,
    conflictResolution = 'latest',
    onError,
    debug = false
  } = options;
  
  // Conflict resolution state
  const pendingUpdatesRef = useRef<Map<string, RealtimePostUpdate[]>>(new Map());
  const lastUpdateTimestampRef = useRef<Map<string, Date>>(new Map());
  
  /**
   * ログ出力（デバッグモード時のみ）
   */
  const debugLog = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[RealtimePosts] ${message}`, ...args);
    }
  }, [debug]);
  
  /**
   * 競合解決ロジック
   */
  const resolveConflict = useCallback((postId: string, newUpdate: RealtimePostUpdate): boolean => {
    const pendingUpdates = pendingUpdatesRef.current.get(postId) || [];
    const lastTimestamp = lastUpdateTimestampRef.current.get(postId);
    
    switch (conflictResolution) {
      case 'latest':
        // Always accept the latest update
        return true;
        
      case 'user-wins':
        // If the current user made the update, it takes priority
        return newUpdate.userId === (supabaseClient.getCurrentUser() as any)?.id;
        
      case 'merge':
        // For merge strategy, we need to carefully combine updates
        if (!lastTimestamp || newUpdate.timestamp > lastTimestamp) {
          return true;
        }
        
        // If timestamps are very close (within 1 second), queue for merge
        if (Math.abs(newUpdate.timestamp.getTime() - lastTimestamp.getTime()) < 1000) {
          pendingUpdatesRef.current.set(postId, [...pendingUpdates, newUpdate]);
          return false; // Don't apply immediately
        }
        
        return newUpdate.timestamp > lastTimestamp;
        
      default:
        return true;
    }
  }, [conflictResolution]);
  
  /**
   * 投稿データの変換（SupabaseからApp形式へ）
   */
  const transformSupabasePost = useCallback(async (supabasePost: SupabasePost) => {
    const currentUser = await supabaseClient.getCurrentUser();
    let isLiked = false;
    
    // Get like status if user is authenticated
    if (currentUser) {
      try {
        const client = supabaseClient.getClient();
        const { data: like } = await client
          .from('likes')
          .select('id')
          .eq('post_id', supabasePost.id)
          .eq('user_id', currentUser.id)
          .single();
        isLiked = !!like;
      } catch {
        // Ignore errors when checking like status
      }
    }
    
    // Get user data
    let user = null;
    try {
      const client = supabaseClient.getClient();
      const { data: userData } = await client
        .from('users')
        .select('id, nickname, avatar_url')
        .eq('id', supabasePost.user_id)
        .single();
      user = userData;
    } catch {
      // Use fallback user data
    }
    
    return {
      id: supabasePost.id,
      content: supabasePost.content,
      authorId: supabasePost.user_id,
      authorName: user?.nickname || 'Unknown',
      authorAvatar: user?.avatar_url || 'https://via.placeholder.com/40',
      createdAt: supabasePost.created_at || new Date().toISOString(),
      updatedAt: supabasePost.updated_at || new Date().toISOString(),
      likesCount: supabasePost.likes_count || 0,
      commentsCount: supabasePost.comments_count || 0,
      isLiked,
      images: supabasePost.image_url ? [supabasePost.image_url] : undefined,
    };
  }, []);
  
  /**
   * キャッシュの無効化とリフレッシュ
   */
  const invalidatePostsCache = useCallback(() => {
    debugLog('Invalidating posts cache');
    dispatch(postsApi.util.invalidateTags(['Post']));
  }, [dispatch, debugLog]);
  
  /**
   * 特定の投稿のキャッシュ更新
   */
  const updatePostInCache = useCallback(async (postId: string, updateFn: (post: any) => any) => {
    debugLog('Updating post in cache:', postId);
    
    // Update getPosts query with common parameter combinations
    const commonQueries = [
      { limit: 20, offset: 0 },
      { limit: 10, offset: 0 },
      {},
    ];
    
    commonQueries.forEach(queryParams => {
      (dispatch as any)(
        postsApi.util.updateQueryData('getPosts', queryParams, (draft) => {
          const postIndex = draft.findIndex((p: any) => p.id === postId);
          if (postIndex !== -1) {
            draft[postIndex] = updateFn(draft[postIndex]);
          }
        })
      );
    });
    
    // Update individual post query if it exists
    (dispatch as any)(
      postsApi.util.updateQueryData('getPost', postId, (draft) => {
        return updateFn(draft);
      })
    );
  }, [dispatch, debugLog]);
  
  /**
   * 投稿の挿入処理
   */
  const handlePostInsert = useCallback(async (payload: any) => {
    const supabasePost = payload.new as SupabasePost;
    debugLog('Post inserted:', supabasePost.id);
    
    const update: RealtimePostUpdate = {
      type: 'post',
      action: 'INSERT',
      data: supabasePost,
      timestamp: new Date(),
      userId: supabasePost.user_id,
    };
    
    if (!resolveConflict(supabasePost.id, update)) {
      debugLog('Post insert conflict, skipping:', supabasePost.id);
      return;
    }
    
    try {
      const transformedPost = await transformSupabasePost(supabasePost);
      
      // Add to cache
      const commonQueries = [
        { limit: 20, offset: 0 },
        { limit: 10, offset: 0 },
        {},
      ];
      
      commonQueries.forEach(queryParams => {
        (dispatch as any)(
          postsApi.util.updateQueryData('getPosts', queryParams, (draft) => {
            // Add to beginning of posts array
            draft.unshift(transformedPost as any);
          })
        );
      });
      
      lastUpdateTimestampRef.current.set(supabasePost.id, update.timestamp);
    } catch (error) {
      onError?.(error as Error, 'post-insert');
    }
  }, [transformSupabasePost, resolveConflict, dispatch, debugLog, onError]);
  
  /**
   * 投稿の更新処理
   */
  const handlePostUpdate = useCallback(async (payload: any) => {
    const supabasePost = payload.new as SupabasePost;
    debugLog('Post updated:', supabasePost.id);
    
    const update: RealtimePostUpdate = {
      type: 'post',
      action: 'UPDATE',
      data: supabasePost,
      timestamp: new Date(),
      userId: supabasePost.user_id,
    };
    
    if (!resolveConflict(supabasePost.id, update)) {
      debugLog('Post update conflict, skipping:', supabasePost.id);
      return;
    }
    
    try {
      const transformedPost = await transformSupabasePost(supabasePost);
      
      await updatePostInCache(supabasePost.id, () => transformedPost);
      
      lastUpdateTimestampRef.current.set(supabasePost.id, update.timestamp);
    } catch (error) {
      onError?.(error as Error, 'post-update');
    }
  }, [transformSupabasePost, resolveConflict, updatePostInCache, debugLog, onError]);
  
  /**
   * 投稿の削除処理
   */
  const handlePostDelete = useCallback((payload: any) => {
    const deletedPost = payload.old as SupabasePost;
    debugLog('Post deleted:', deletedPost.id);
    
    const update: RealtimePostUpdate = {
      type: 'post',
      action: 'DELETE',
      data: deletedPost,
      timestamp: new Date(),
      userId: deletedPost.user_id,
    };
    
    if (!resolveConflict(deletedPost.id, update)) {
      debugLog('Post delete conflict, skipping:', deletedPost.id);
      return;
    }
    
    // Remove from all caches
    const commonQueries = [
      { limit: 20, offset: 0 },
      { limit: 10, offset: 0 },
      {},
    ];
    
    commonQueries.forEach(queryParams => {
      (dispatch as any)(
        postsApi.util.updateQueryData('getPosts', queryParams, (draft) => {
          const index = draft.findIndex((p: any) => p.id === deletedPost.id);
          if (index !== -1) {
            draft.splice(index, 1);
          }
        })
      );
    });
    
    lastUpdateTimestampRef.current.set(deletedPost.id, update.timestamp);
  }, [resolveConflict, dispatch, debugLog]);
  
  /**
   * いいね処理
   */
  const handleLikeChange = useCallback(async (payload: any, isInsert: boolean) => {
    const like = (isInsert ? payload.new : payload.old) as Like;
    debugLog(`Like ${isInsert ? 'added' : 'removed'}:`, like.post_id);
    
    const update: RealtimePostUpdate = {
      type: 'like',
      action: isInsert ? 'INSERT' : 'DELETE',
      data: like,
      timestamp: new Date(),
      userId: like.user_id,
    };
    
    if (!resolveConflict(like.post_id, update)) {
      debugLog('Like change conflict, skipping:', like.post_id);
      return;
    }
    
    try {
      const currentUser = await supabaseClient.getCurrentUser();
      const isCurrentUser = currentUser?.id === like.user_id;
      
      await updatePostInCache(like.post_id, (post: any) => ({
        ...post,
        likesCount: Math.max(0, post.likesCount + (isInsert ? 1 : -1)),
        isLiked: isCurrentUser ? isInsert : post.isLiked,
      }));
      
      lastUpdateTimestampRef.current.set(like.post_id, update.timestamp);
    } catch (error) {
      onError?.(error as Error, `like-${isInsert ? 'insert' : 'delete'}`);
    }
  }, [resolveConflict, updatePostInCache, debugLog, onError]);
  
  /**
   * コメント処理
   */
  const handleCommentChange = useCallback(async (payload: any, isInsert: boolean) => {
    const comment = (isInsert ? payload.new : payload.old) as SupabaseComment;
    debugLog(`Comment ${isInsert ? 'added' : 'removed'}:`, comment.post_id);
    
    const update: RealtimePostUpdate = {
      type: 'comment',
      action: isInsert ? 'INSERT' : 'DELETE',
      data: comment,
      timestamp: new Date(),
      userId: comment.user_id,
    };
    
    if (!resolveConflict(comment.post_id, update)) {
      debugLog('Comment change conflict, skipping:', comment.post_id);
      return;
    }
    
    await updatePostInCache(comment.post_id, (post: any) => ({
      ...post,
      commentsCount: Math.max(0, post.commentsCount + (isInsert ? 1 : -1)),
    }));
    
    // Also invalidate comments cache for this post
    dispatch(postsApi.util.invalidateTags([{ type: 'Comment', id: comment.post_id }]));
    
    lastUpdateTimestampRef.current.set(comment.post_id, update.timestamp);
  }, [resolveConflict, updatePostInCache, dispatch, debugLog]);
  
  // Setup multiple subscriptions
  const subscriptions = useMultipleRealtimeSubscriptions({
    subscriptions: [
      {
        channelName: 'posts-realtime',
        options: {
          table: 'posts',
          onInsert: handlePostInsert,
          onUpdate: handlePostUpdate,
          onDelete: handlePostDelete,
          onError: (error) => onError?.(error, 'posts-subscription'),
          autoReconnect: true,
          maxReconnectAttempts: 5,
        },
      },
      {
        channelName: 'likes-realtime',
        options: {
          table: 'likes',
          onInsert: (payload) => handleLikeChange(payload, true),
          onDelete: (payload) => handleLikeChange(payload, false),
          onError: (error) => onError?.(error, 'likes-subscription'),
          autoReconnect: true,
          maxReconnectAttempts: 5,
        },
      },
      {
        channelName: 'comments-realtime',
        options: {
          table: 'comments',
          onInsert: (payload) => handleCommentChange(payload, true),
          onDelete: (payload) => handleCommentChange(payload, false),
          onError: (error) => onError?.(error, 'comments-subscription'),
          autoReconnect: true,
          maxReconnectAttempts: 5,
        },
      },
    ],
    onGlobalError: (error, channelName) => {
      debugLog(`Global error on ${channelName}:`, error);
      onError?.(error, `global-${channelName}`);
    },
  });
  
  // Auto-subscribe if enabled
  useEffect(() => {
    if (autoSubscribe && featureFlags.isSupabaseEnabled()) {
      debugLog('Auto-subscribing to realtime posts');
      subscriptions.subscribeAll();
    }
    
    return () => {
      debugLog('Cleaning up realtime posts subscriptions');
      subscriptions.unsubscribeAll();
    };
  }, [autoSubscribe, featureFlags]);
  
  return {
    subscriptions: subscriptions.subscriptions,
    globalConnectionStatus: subscriptions.globalConnectionStatus,
    subscribe: subscriptions.subscribeAll,
    unsubscribe: subscriptions.unsubscribeAll,
    reconnect: subscriptions.reconnectAll,
    invalidateCache: invalidatePostsCache,
    
    // Conflict resolution utilities
    setPendingUpdates: (postId: string, updates: RealtimePostUpdate[]) => {
      pendingUpdatesRef.current.set(postId, updates);
    },
    getPendingUpdates: (postId: string) => {
      return pendingUpdatesRef.current.get(postId) || [];
    },
    clearPendingUpdates: (postId?: string) => {
      if (postId) {
        pendingUpdatesRef.current.delete(postId);
        lastUpdateTimestampRef.current.delete(postId);
      } else {
        pendingUpdatesRef.current.clear();
        lastUpdateTimestampRef.current.clear();
      }
    },
  };
}