import { renderHook, act } from '@testing-library/react-native';
import { useApiState } from '../../src/hooks/useApiState';
import { ApiUtils } from '../../src/utils/apiUtils';
import { ErrorUtils } from '../../src/utils/errorUtils';
import { ApiError } from '../../src/types/api';

jest.mock('../../src/utils/apiUtils');
jest.mock('../../src/utils/errorUtils');

const MockedApiUtils = jest.mocked(ApiUtils);
const MockedErrorUtils = jest.mocked(ErrorUtils);

describe('useApiState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期状態が正しく設定されること', () => {
    const mockApiCall = jest.fn().mockResolvedValue('test-data');
    
    const { result } = renderHook(() => 
      useApiState(mockApiCall)
    );

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.userMessage).toBeNull();
    expect(result.current.lastFetched).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasData).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('immediate: trueで初期データ取得が実行されること', async () => {
    const mockApiCall = jest.fn().mockResolvedValue('initial-data');
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall, { immediate: true })
    );

    expect(result.current.loading).toBe(true);

    // データ取得完了まで待機
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('initial-data');
    expect(result.current.loading).toBe(false);
    expect(result.current.hasData).toBe(true);
  });

  it('手動でfetchを呼び出してデータを取得できること', async () => {
    const mockApiCall = jest.fn().mockResolvedValue('fetched-data');
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall)
    );

    await act(async () => {
      await result.current.fetch();
    });

    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('fetched-data');
    expect(result.current.hasData).toBe(true);
    expect(result.current.lastFetched).toBeInstanceOf(Date);
  });

  it('キャッシュからデータを取得できること', async () => {
    const mockApiCall = jest.fn().mockResolvedValue('cached-data');
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall, { 
        cacheKey: 'test-cache',
        cacheTTL: 5000,
      })
    );

    // 初回取得
    await act(async () => {
      await result.current.fetch();
    });

    expect(mockApiCall).toHaveBeenCalledTimes(1);

    // 2回目はキャッシュから取得（API呼び出しなし）
    await act(async () => {
      await result.current.fetch();
    });

    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('cached-data');
    expect(result.current.isCacheValid).toBe(true);
  });

  it('force: trueでキャッシュを無視してデータを取得できること', async () => {
    const mockApiCall = jest.fn()
      .mockResolvedValueOnce('first-data')
      .mockResolvedValueOnce('refreshed-data');
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall, { 
        cacheKey: 'test-cache',
        cacheTTL: 10000,
      })
    );

    // 初回取得
    await act(async () => {
      await result.current.fetch();
    });

    // refreshでキャッシュを無視して再取得
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockApiCall).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe('refreshed-data');
  });

  it('エラー発生時に適切にエラー状態が設定されること', async () => {
    const error = new Error('API Error');
    const apiError: ApiError = {
      type: 'http',
      status: 500,
      message: 'Internal Server Error',
      timestamp: '2024-07-21T10:00:00Z',
    };

    MockedErrorUtils.handleError.mockReturnValue({
      apiError,
      userMessage: 'サーバーエラーが発生しました',
      shouldRetry: false,
    });
    MockedErrorUtils.isAuthError.mockReturnValue(false);
    MockedErrorUtils.isNetworkError.mockReturnValue(false);
    MockedErrorUtils.isValidationError.mockReturnValue(false);
    MockedErrorUtils.shouldRetry.mockReturnValue(false);

    const mockApiCall = jest.fn().mockRejectedValue(error);
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall)
    );

    await act(async () => {
      try {
        await result.current.fetch();
      } catch (e) {
        // エラーは期待される
      }
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toEqual(apiError);
    expect(result.current.userMessage).toBe('サーバーエラーが発生しました');
    expect(result.current.hasError).toBe(true);
    expect(result.current.isAuthError).toBe(false);
    expect(result.current.isNetworkError).toBe(false);
  });

  it('重複リクエスト防止が正常に動作すること', async () => {
    const mockApiCall = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('data'), 100))
    );
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall, { enableDuplicateRequestPrevention: true })
    );

    // 同時に複数回fetchを呼び出し
    const promises = [
      result.current.fetch(),
      result.current.fetch(),
      result.current.fetch(),
    ];

    await act(async () => {
      await Promise.all(promises);
    });

    // APIは1回だけ呼ばれる
    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('data');
  });

  it('updateDataでデータを直接更新できること', async () => {
    const mockApiCall = jest.fn().mockResolvedValue('initial-data');
    
    const { result } = renderHook(() => 
      useApiState(mockApiCall, { cacheKey: 'test-cache' })
    );

    await act(async () => {
      result.current.updateData('updated-data');
    });

    expect(result.current.data).toBe('updated-data');
    expect(result.current.hasData).toBe(true);
    expect(result.current.lastFetched).toBeInstanceOf(Date);
    expect(result.current.isCacheValid).toBe(true);
  });

  it('clearErrorでエラー状態をクリアできること', async () => {
    const error = new Error('Test Error');
    const apiError: ApiError = {
      type: 'network',
      message: 'Network error',
      timestamp: '2024-07-21T10:00:00Z',
    };

    MockedErrorUtils.handleError.mockReturnValue({
      apiError,
      userMessage: 'ネットワークエラーです',
      shouldRetry: false,
    });

    const mockApiCall = jest.fn().mockRejectedValue(error);
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall)
    );

    // エラーを発生させる
    await act(async () => {
      try {
        await result.current.fetch();
      } catch (e) {
        // エラーは期待される
      }
    });

    expect(result.current.hasError).toBe(true);

    // エラーをクリア
    await act(async () => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.userMessage).toBeNull();
    expect(result.current.hasError).toBe(false);
  });

  it('resetですべての状態をリセットできること', async () => {
    const mockApiCall = jest.fn().mockResolvedValue('test-data');
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall, { cacheKey: 'test-cache' })
    );

    // データを取得
    await act(async () => {
      await result.current.fetch();
    });

    expect(result.current.hasData).toBe(true);
    expect(result.current.isCacheValid).toBe(true);

    // リセット
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.userMessage).toBeNull();
    expect(result.current.lastFetched).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(result.current.isCacheValid).toBe(false);
  });

  it('エラー判定メソッドが正しく動作すること', async () => {
    const authError: ApiError = {
      type: 'http',
      status: 401,
      message: 'Unauthorized',
      timestamp: '2024-07-21T10:00:00Z',
    };

    MockedErrorUtils.handleError.mockReturnValue({
      apiError: authError,
      userMessage: '認証が必要です',
      shouldRetry: false,
    });
    MockedErrorUtils.isAuthError.mockReturnValue(true);
    MockedErrorUtils.isNetworkError.mockReturnValue(false);
    MockedErrorUtils.isValidationError.mockReturnValue(false);
    MockedErrorUtils.shouldRetry.mockReturnValue(false);

    const mockApiCall = jest.fn().mockRejectedValue(new Error('Auth Error'));
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const { result } = renderHook(() => 
      useApiState(mockApiCall)
    );

    await act(async () => {
      try {
        await result.current.fetch();
      } catch (e) {
        // エラーは期待される
      }
    });

    expect(result.current.isAuthError).toBe(true);
    expect(result.current.isNetworkError).toBe(false);
    expect(result.current.isValidationError).toBe(false);
    expect(result.current.shouldRetry).toBe(false);
  });

  it('retryConfigが正しく適用されること', async () => {
    const mockApiCall = jest.fn().mockResolvedValue('data');
    MockedApiUtils.withMonitoring.mockImplementation((apiCall) => apiCall());
    MockedApiUtils.withRetry.mockImplementation((apiCall) => apiCall());

    const retryConfig = {
      maxRetries: 5,
      baseDelay: 2000,
    };

    const { result } = renderHook(() => 
      useApiState(mockApiCall, { 
        retryConfig,
        context: 'test-context',
      })
    );

    await act(async () => {
      await result.current.fetch();
    });

    expect(MockedApiUtils.withRetry).toHaveBeenCalledWith(
      expect.any(Function),
      retryConfig,
      'test-context'
    );
  });
});