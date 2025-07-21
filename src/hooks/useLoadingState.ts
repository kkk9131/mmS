import { useState, useCallback, useRef } from 'react';
import { ApiError } from '../types/api';
import { ErrorUtils } from '../utils/errorUtils';

interface LoadingState {
  loading: boolean;
  error: ApiError | null;
  userMessage: string | null;
}

interface UseLoadingStateOptions {
  enableDuplicateRequestPrevention?: boolean;
  context?: string;
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { enableDuplicateRequestPrevention = true, context } = options;
  
  const [state, setState] = useState<LoadingState>({
    loading: false,
    error: null,
    userMessage: null,
  });

  // 重複リクエスト防止用のマップ
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());

  const execute = useCallback(async <T>(
    asyncFunction: () => Promise<T>,
    operationKey?: string
  ): Promise<T> => {
    // 重複リクエスト防止
    if (enableDuplicateRequestPrevention && operationKey) {
      const existing = pendingRequests.current.get(operationKey);
      if (existing) {
        return existing;
      }
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      userMessage: null,
    }));

    try {
      const promise = asyncFunction();
      
      // 重複防止用にpromiseを保存
      if (enableDuplicateRequestPrevention && operationKey) {
        pendingRequests.current.set(operationKey, promise);
      }

      const result = await promise;

      setState(prev => ({
        ...prev,
        loading: false,
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
      // pending requestsから削除
      if (enableDuplicateRequestPrevention && operationKey) {
        pendingRequests.current.delete(operationKey);
      }
    }
  }, [enableDuplicateRequestPrevention, context]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      userMessage: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      userMessage: null,
    });
    pendingRequests.current.clear();
  }, []);

  return {
    ...state,
    execute,
    clearError,
    reset,
    isLoading: state.loading,
    hasError: !!state.error,
    isAuthError: state.error ? ErrorUtils.isAuthError(state.error) : false,
    isNetworkError: state.error ? ErrorUtils.isNetworkError(state.error) : false,
    shouldRetry: state.error ? ErrorUtils.shouldRetry(state.error, 1) : false,
  };
}