import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '../types/api';
import { ErrorUtils } from '../utils/errorUtils';
import { ApiUtils } from '../utils/apiUtils';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  userMessage: string | null;
  lastFetched: Date | null;
}

interface UseApiStateOptions {
  immediate?: boolean; // 即座にデータを取得するか
  cacheKey?: string; // キャッシュキー
  cacheTTL?: number; // キャッシュの有効期限（ミリ秒）
  retryConfig?: {
    maxRetries?: number;
    baseDelay?: number;
  };
  context?: string;
  enableDuplicateRequestPrevention?: boolean;
}

export function useApiState<T>(
  apiCall: () => Promise<T>,
  options: UseApiStateOptions = {}
) {
  const {
    immediate = false,
    cacheKey,
    cacheTTL = 5 * 60 * 1000, // 5分
    retryConfig = { maxRetries: 2, baseDelay: 1000 },
    context = 'useApiState',
    enableDuplicateRequestPrevention = true,
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    userMessage: null,
    lastFetched: null,
  });

  // 重複リクエスト防止用
  const pendingRequest = useRef<Promise<T> | null>(null);
  
  // キャッシュ
  const cache = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const fetchData = useCallback(async (force: boolean = false): Promise<T> => {
    // キャッシュチェック
    if (!force && cacheKey) {
      const cached = cache.current.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
        setState(prev => ({ ...prev, data: cached.data, lastFetched: new Date(cached.timestamp) }));
        return cached.data;
      }
    }

    // 重複リクエスト防止
    if (enableDuplicateRequestPrevention && pendingRequest.current) {
      return pendingRequest.current;
    }

    setState(prev => ({ ...prev, loading: true, error: null, userMessage: null }));

    try {
      const promise = ApiUtils.withMonitoring(
        () => ApiUtils.withRetry(apiCall, retryConfig, context),
        context
      );

      if (enableDuplicateRequestPrevention) {
        pendingRequest.current = promise;
      }

      const result = await promise;
      const now = Date.now();

      // キャッシュに保存
      if (cacheKey) {
        cache.current.set(cacheKey, { data: result, timestamp: now });
      }

      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        lastFetched: new Date(now),
      }));

      return result;
    } catch (error) {
      const { apiError, userMessage } = ErrorUtils.handleError(error, context);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: apiError,
        userMessage,
      }));

      throw apiError;
    } finally {
      if (enableDuplicateRequestPrevention) {
        pendingRequest.current = null;
      }
    }
  }, [apiCall, cacheKey, cacheTTL, retryConfig, context, enableDuplicateRequestPrevention]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, userMessage: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      userMessage: null,
      lastFetched: null,
    });
    if (cacheKey) {
      cache.current.delete(cacheKey);
    }
    pendingRequest.current = null;
  }, [cacheKey]);

  const updateData = useCallback((newData: T) => {
    const now = Date.now();
    
    // キャッシュを更新
    if (cacheKey) {
      cache.current.set(cacheKey, { data: newData, timestamp: now });
    }

    setState(prev => ({
      ...prev,
      data: newData,
      lastFetched: new Date(now),
    }));
  }, [cacheKey]);

  // 初期データ取得
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData]);

  return {
    ...state,
    fetch: fetchData,
    refresh,
    clearError,
    reset,
    updateData,
    isLoading: state.loading,
    hasData: state.data !== null,
    hasError: !!state.error,
    isAuthError: state.error ? ErrorUtils.isAuthError(state.error) : false,
    isNetworkError: state.error ? ErrorUtils.isNetworkError(state.error) : false,
    isValidationError: state.error ? ErrorUtils.isValidationError(state.error) : false,
    shouldRetry: state.error ? ErrorUtils.shouldRetry(state.error, 1) : false,
    isCacheValid: cacheKey ? (() => {
      const cached = cache.current.get(cacheKey);
      return cached ? (Date.now() - cached.timestamp) < cacheTTL : false;
    })() : false,
  };
}