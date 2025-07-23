import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel, REALTIME_LISTEN_TYPES, REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from '@supabase/supabase-js';
import { supabaseClient } from '../services/supabase/client';
import { FeatureFlagsManager } from '../services/featureFlags';
import { performanceMonitor } from '../utils/performanceMonitor';

export interface RealtimeSubscriptionOptions {
  table: string;
  schema?: string;
  event?: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface RealtimeConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
}

export interface UseRealtimeSubscriptionReturn {
  connectionStatus: RealtimeConnectionStatus;
  subscribe: () => void;
  unsubscribe: () => void;
  reconnect: () => void;
  isSubscribed: boolean;
}

/**
 * リアルタイムサブスクリプションを管理するカスタムフック
 * 
 * @param channelName - チャンネル名
 * @param options - サブスクリプションオプション
 * @returns サブスクリプション管理オブジェクト
 */
export function useRealtimeSubscription(
  channelName: string,
  options: RealtimeSubscriptionOptions
): UseRealtimeSubscriptionReturn {
  const featureFlags = FeatureFlagsManager.getInstance();
  
  // Refs for stable references
  const channelRef = useRef<RealtimeChannel | null>(null);
  const optionsRef = useRef(options);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  
  // State
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
  });
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  
  // Clear reconnect timeout on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);
  
  /**
   * エラーハンドリング
   */
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`Realtime subscription error [${context}]:`, error);
    
    if (!isMountedRef.current) return;
    
    setConnectionStatus(prev => ({
      ...prev,
      error,
      isConnected: false,
      isConnecting: false,
      lastDisconnectedAt: new Date(),
    }));
    
    // Call user's error handler
    optionsRef.current.onError?.(error);
  }, []);
  
  /**
   * 再接続ロジック
   */
  const attemptReconnect = useCallback(() => {
    const { autoReconnect = true, maxReconnectAttempts = 5, reconnectDelay = 1000 } = optionsRef.current;
    
    if (!autoReconnect || !isMountedRef.current) return;
    
    setConnectionStatus(prev => {
      if (prev.reconnectAttempts >= maxReconnectAttempts) {
        handleError(
          new Error(`Max reconnection attempts (${maxReconnectAttempts}) exceeded`), 
          'reconnect-limit'
        );
        return prev;
      }
      
      // Calculate exponential backoff delay
      const delay = reconnectDelay * Math.pow(2, prev.reconnectAttempts);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${prev.reconnectAttempts + 1}/${maxReconnectAttempts})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          subscribe();
        }
      }, delay);
      
      return {
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
        isConnecting: true,
      };
    });
  }, [handleError]);
  
  /**
   * サブスクリプション作成
   */
  const subscribe = useCallback(() => {
    // Check if Supabase is enabled
    if (!featureFlags.isSupabaseEnabled()) {
      console.warn('Realtime subscriptions not available: Supabase disabled');
      return;
    }
    
    if (!supabaseClient.isInitialized()) {
      handleError(new Error('Supabase client not initialized'), 'client-not-initialized');
      return;
    }
    
    // Clean up existing subscription
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    
    if (!isMountedRef.current) return;
    
    setConnectionStatus(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));
    
    try {
      const client = supabaseClient.getClient();
      const channel = client.channel(channelName);
      
      // Set up postgres changes listener
      channel.on(
        'postgres_changes' as any,
        {
          event: optionsRef.current.event || '*',
          schema: optionsRef.current.schema || 'public',
          table: optionsRef.current.table,
          filter: optionsRef.current.filter,
        },
        (payload: any) => {
          if (!isMountedRef.current) return;
          
          console.log(`Realtime update received for ${optionsRef.current.table}:`, payload);
          
          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              optionsRef.current.onInsert?.(payload);
              break;
            case 'UPDATE':
              optionsRef.current.onUpdate?.(payload);
              break;
            case 'DELETE':
              optionsRef.current.onDelete?.(payload);
              break;
            default:
              console.log('Unknown event type:', payload.eventType);
          }
        }
      );
      
      // Subscribe with status callbacks
      channel.subscribe((status, error) => {
        if (!isMountedRef.current) return;
        
        console.log(`Realtime subscription status for ${channelName}: ${status}`);
        
        switch (status) {
          case 'SUBSCRIBED':
            setConnectionStatus(prev => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              error: null,
              reconnectAttempts: 0,
              lastConnectedAt: new Date(),
            }));
            setIsSubscribed(true);
            // Track subscription in performance monitor
            performanceMonitor.trackRealtimeSubscription(channelName, 'subscribe');
            break;
            
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            const errorObj = error || new Error(`Subscription failed with status: ${status}`);
            handleError(errorObj, status.toLowerCase());
            setIsSubscribed(false);
            
            // Attempt to reconnect
            if (optionsRef.current.autoReconnect !== false) {
              attemptReconnect();
            }
            break;
            
          case 'CLOSED':
            setConnectionStatus(prev => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
              lastDisconnectedAt: new Date(),
            }));
            setIsSubscribed(false);
            break;
        }
      });
      
      channelRef.current = channel;
    } catch (error) {
      handleError(error as Error, 'subscription-creation');
      setIsSubscribed(false);
    }
  }, [channelName, featureFlags, handleError, attemptReconnect]);
  
  /**
   * サブスクリプション解除
   */
  const unsubscribe = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (channelRef.current) {
      console.log(`Unsubscribing from channel: ${channelName}`);
      channelRef.current.unsubscribe();
      channelRef.current = null;
      // Track unsubscription in performance monitor
      performanceMonitor.trackRealtimeSubscription(channelName, 'unsubscribe');
    }
    
    setConnectionStatus(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      lastDisconnectedAt: new Date(),
    }));
    setIsSubscribed(false);
  }, [channelName]);
  
  /**
   * 手動再接続
   */
  const reconnect = useCallback(() => {
    console.log(`Manually reconnecting to channel: ${channelName}`);
    
    // Reset reconnection attempts
    setConnectionStatus(prev => ({
      ...prev,
      reconnectAttempts: 0,
      error: null,
    }));
    
    // Resubscribe
    subscribe();
  }, [channelName, subscribe]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [unsubscribe]);
  
  return {
    connectionStatus,
    subscribe,
    unsubscribe,
    reconnect,
    isSubscribed,
  };
}

/**
 * 複数のリアルタイムサブスクリプションを管理するフック
 */
export interface MultiSubscriptionOptions {
  subscriptions: Array<{
    channelName: string;
    options: RealtimeSubscriptionOptions;
  }>;
  onGlobalError?: (error: Error, channelName: string) => void;
}

export function useMultipleRealtimeSubscriptions(config: MultiSubscriptionOptions) {
  const subscriptions = config.subscriptions.map(({ channelName, options }) => {
    const enhancedOptions = {
      ...options,
      onError: (error: Error) => {
        options.onError?.(error);
        config.onGlobalError?.(error, channelName);
      },
    };
    
    return {
      channelName,
      ...useRealtimeSubscription(channelName, enhancedOptions),
    };
  });
  
  const globalConnectionStatus = {
    totalChannels: subscriptions.length,
    connectedChannels: subscriptions.filter(sub => sub.connectionStatus.isConnected).length,
    connectingChannels: subscriptions.filter(sub => sub.connectionStatus.isConnecting).length,
    errorChannels: subscriptions.filter(sub => sub.connectionStatus.error !== null).length,
    allConnected: subscriptions.every(sub => sub.connectionStatus.isConnected),
    anyConnecting: subscriptions.some(sub => sub.connectionStatus.isConnecting),
    hasErrors: subscriptions.some(sub => sub.connectionStatus.error !== null),
  };
  
  const subscribeAll = useCallback(() => {
    subscriptions.forEach(sub => sub.subscribe());
  }, [subscriptions]);
  
  const unsubscribeAll = useCallback(() => {
    subscriptions.forEach(sub => sub.unsubscribe());
  }, [subscriptions]);
  
  const reconnectAll = useCallback(() => {
    subscriptions.forEach(sub => sub.reconnect());
  }, [subscriptions]);
  
  return {
    subscriptions,
    globalConnectionStatus,
    subscribeAll,
    unsubscribeAll,
    reconnectAll,
  };
}