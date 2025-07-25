import { renderHook, act } from '@testing-library/react-native';
import { useLoadingState } from '@/hooks/useLoadingState';
import { ErrorUtils } from '@/utils/errorUtils';
import { ApiError } from '@/types/api';

jest.mock('@/utils/errorUtils');

const MockedErrorUtils = jest.mocked(ErrorUtils);

describe('useLoadingState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期状態が正しく設定されること', () => {
    const { result } = renderHook(() => useLoadingState());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.userMessage).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('非同期関数を正常に実行できること', async () => {
    const { result } = renderHook(() => useLoadingState());

    const mockAsyncFunction = jest.fn().mockResolvedValue('success');

    let asyncResult;
    await act(async () => {
      asyncResult = await result.current.execute(mockAsyncFunction);
    });

    expect(mockAsyncFunction).toHaveBeenCalledTimes(1);
    expect(asyncResult).toBe('success');
    expect(result.current.loading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('実行中はローディング状態になること', async () => {
    const { result } = renderHook(() => useLoadingState());

    const mockAsyncFunction = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('success'), 100))
    );

    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute(mockAsyncFunction);
    });

    // 実行中はローディング状態
    expect(result.current.loading).toBe(true);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await promise;
    });

    // 完了後はローディング状態解除
    expect(result.current.loading).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('エラー発生時に適切にエラー状態が設定されること', async () => {
    const error = new Error('Test Error');
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
    MockedErrorUtils.shouldRetry.mockReturnValue(true);

    const { result } = renderHook(() => useLoadingState({ context: 'test-context' }));

    const mockAsyncFunction = jest.fn().mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.execute(mockAsyncFunction);
      } catch (e) {
        // エラーは期待される
      }
    });

    expect(MockedErrorUtils.handleError).toHaveBeenCalledWith(error, 'test-context');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toEqual(apiError);
    expect(result.current.userMessage).toBe('サーバーエラーが発生しました');
    expect(result.current.hasError).toBe(true);
    expect(result.current.isAuthError).toBe(false);
    expect(result.current.isNetworkError).toBe(false);
    expect(result.current.shouldRetry).toBe(true);
  });

  it('重複リクエスト防止が正常に動作すること', async () => {
    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: true })
    );

    const mockAsyncFunction = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('result'), 100))
    );

    // 同じoperationKeyで複数回実行
    const operationKey = 'duplicate-test';
    const promises = [
      result.current.execute(mockAsyncFunction, operationKey),
      result.current.execute(mockAsyncFunction, operationKey),
      result.current.execute(mockAsyncFunction, operationKey),
    ];

    const results = await act(async () => {
      return Promise.all(promises);
    });

    // 関数は1回だけ実行される
    expect(mockAsyncFunction).toHaveBeenCalledTimes(1);
    // すべてのPromiseは同じ結果を返す
    expect(results).toEqual(['result', 'result', 'result']);
  });

  it('異なるoperationKeyは重複防止の対象外であること', async () => {
    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: true })
    );

    const mockAsyncFunction1 = jest.fn().mockResolvedValue('result1');
    const mockAsyncFunction2 = jest.fn().mockResolvedValue('result2');

    await act(async () => {
      await Promise.all([
        result.current.execute(mockAsyncFunction1, 'key1'),
        result.current.execute(mockAsyncFunction2, 'key2'),
      ]);
    });

    expect(mockAsyncFunction1).toHaveBeenCalledTimes(1);
    expect(mockAsyncFunction2).toHaveBeenCalledTimes(1);
  });

  it('重複リクエスト防止無効時は複数回実行されること', async () => {
    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: false })
    );

    const mockAsyncFunction = jest.fn().mockResolvedValue('result');

    await act(async () => {
      await Promise.all([
        result.current.execute(mockAsyncFunction, 'same-key'),
        result.current.execute(mockAsyncFunction, 'same-key'),
      ]);
    });

    expect(mockAsyncFunction).toHaveBeenCalledTimes(2);
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

    const { result } = renderHook(() => useLoadingState());

    const mockAsyncFunction = jest.fn().mockRejectedValue(error);

    // エラーを発生させる
    await act(async () => {
      try {
        await result.current.execute(mockAsyncFunction);
      } catch (e) {
        // エラーは期待される
      }
    });

    expect(result.current.hasError).toBe(true);

    // エラーをクリア
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.userMessage).toBeNull();
    expect(result.current.hasError).toBe(false);
  });

  it('resetで状態をリセットできること', async () => {
    const error = new Error('Test Error');
    const apiError: ApiError = {
      type: 'http',
      status: 400,
      message: 'Bad Request',
      timestamp: '2024-07-21T10:00:00Z',
    };

    MockedErrorUtils.handleError.mockReturnValue({
      apiError,
      userMessage: 'リクエストエラーです',
      shouldRetry: false,
    });

    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: true })
    );

    const mockAsyncFunction = jest.fn().mockRejectedValue(error);

    // エラーを発生させ、pending requestsに追加
    await act(async () => {
      try {
        await result.current.execute(mockAsyncFunction, 'test-key');
      } catch (e) {
        // エラーは期待される
      }
    });

    expect(result.current.hasError).toBe(true);

    // リセット
    act(() => {
      result.current.reset();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.userMessage).toBeNull();
    expect(result.current.hasError).toBe(false);
  });

  it('operationKeyなしでも重複防止が無効化されること', async () => {
    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: true })
    );

    const mockAsyncFunction = jest.fn().mockResolvedValue('result');

    // operationKeyなしで複数回実行
    await act(async () => {
      await Promise.all([
        result.current.execute(mockAsyncFunction),
        result.current.execute(mockAsyncFunction),
      ]);
    });

    // operationKeyがないため両方実行される
    expect(mockAsyncFunction).toHaveBeenCalledTimes(2);
  });

  it('実行完了後にpending requestsから削除されること', async () => {
    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: true })
    );

    const mockAsyncFunction = jest.fn().mockResolvedValue('result');

    const operationKey = 'cleanup-test';

    // 最初の実行
    await act(async () => {
      await result.current.execute(mockAsyncFunction, operationKey);
    });

    // 同じkeyで2回目の実行（新しく実行される）
    await act(async () => {
      await result.current.execute(mockAsyncFunction, operationKey);
    });

    // 2回実行される（1回目の完了後にpendingから削除されるため）
    expect(mockAsyncFunction).toHaveBeenCalledTimes(2);
  });

  it('エラー発生時もpending requestsから削除されること', async () => {
    const { result } = renderHook(() => 
      useLoadingState({ enableDuplicateRequestPrevention: true })
    );

    const mockAsyncFunction = jest.fn().mockRejectedValue(new Error('Test Error'));
    MockedErrorUtils.handleError.mockReturnValue({
      apiError: {
        type: 'http',
        status: 500,
        message: 'Error',
        timestamp: '2024-07-21T10:00:00Z',
      },
      userMessage: 'エラー',
      shouldRetry: false,
    });

    const operationKey = 'error-cleanup-test';

    // エラーが発生する実行
    await act(async () => {
      try {
        await result.current.execute(mockAsyncFunction, operationKey);
      } catch (e) {
        // エラーは期待される
      }
    });

    // 同じkeyで2回目の実行（新しく実行される）
    await act(async () => {
      try {
        await result.current.execute(mockAsyncFunction, operationKey);
      } catch (e) {
        // エラーは期待される
      }
    });

    // 2回実行される（1回目のエラー後にpendingから削除されるため）
    expect(mockAsyncFunction).toHaveBeenCalledTimes(2);
  });
});