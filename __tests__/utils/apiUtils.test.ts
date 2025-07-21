import { ApiUtils } from '../../src/utils/apiUtils';
import { ErrorUtils } from '../../src/utils/errorUtils';
import { ApiError } from '../../src/types/api';

jest.mock('../../src/utils/errorUtils');

const MockedErrorUtils = jest.mocked(ErrorUtils);

describe('ApiUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('成功時は一度だけAPIを呼び出すこと', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('success');

      const result = await ApiUtils.withRetry(mockApiCall);

      expect(mockApiCall).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('失敗時に指定回数リトライすること', async () => {
      const error = new Error('API Error');
      const apiError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Internal Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      MockedErrorUtils.handleError.mockReturnValue({
        apiError,
        userMessage: 'サーバーエラー',
        shouldRetry: false,
      });
      MockedErrorUtils.shouldRetry.mockReturnValue(true);

      const mockApiCall = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await ApiUtils.withRetry(mockApiCall, { maxRetries: 2 });

      expect(mockApiCall).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('最大リトライ回数に達したらエラーを投げること', async () => {
      const error = new Error('API Error');
      const apiError: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      MockedErrorUtils.handleError.mockReturnValue({
        apiError,
        userMessage: 'ネットワークエラー',
        shouldRetry: false,
      });
      MockedErrorUtils.shouldRetry.mockReturnValue(true);

      const mockApiCall = jest.fn().mockRejectedValue(error);

      await expect(
        ApiUtils.withRetry(mockApiCall, { maxRetries: 2 })
      ).rejects.toThrow();

      expect(mockApiCall).toHaveBeenCalledTimes(3); // 初回 + 2回のリトライ
    });

    it('カスタムリトライ条件が適用されること', async () => {
      const error = new Error('API Error');
      const apiError: ApiError = {
        type: 'http',
        status: 400,
        message: 'Bad Request',
        timestamp: '2024-07-21T10:00:00Z',
      };

      MockedErrorUtils.handleError.mockReturnValue({
        apiError,
        userMessage: 'リクエストエラー',
        shouldRetry: false,
      });

      const mockApiCall = jest.fn().mockRejectedValue(error);
      const customRetryCondition = jest.fn().mockReturnValue(false);

      await expect(
        ApiUtils.withRetry(mockApiCall, {
          maxRetries: 2,
          retryCondition: customRetryCondition,
        })
      ).rejects.toThrow();

      expect(mockApiCall).toHaveBeenCalledTimes(1);
      expect(customRetryCondition).toHaveBeenCalledWith(apiError, 1);
    });

    it('指数バックオフが正しく計算されること', async () => {
      const error = new Error('API Error');
      const apiError: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      MockedErrorUtils.handleError.mockReturnValue({
        apiError,
        userMessage: 'ネットワークエラー',
        shouldRetry: false,
      });
      MockedErrorUtils.shouldRetry.mockReturnValue(true);

      const mockApiCall = jest.fn().mockRejectedValue(error);
      
      // 遅延をモック
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return null as any;
      });

      await expect(
        ApiUtils.withRetry(mockApiCall, {
          maxRetries: 2,
          baseDelay: 1000,
          backoffFactor: 2,
        })
      ).rejects.toThrow();

      expect(setTimeout).toHaveBeenCalledTimes(2);
    });
  });

  describe('parallelWithPartialSuccess', () => {
    it('すべて成功した場合の結果を返すこと', async () => {
      const apiCall1 = jest.fn().mockResolvedValue('result1');
      const apiCall2 = jest.fn().mockResolvedValue('result2');
      const apiCall3 = jest.fn().mockResolvedValue('result3');

      const result = await ApiUtils.parallelWithPartialSuccess([
        apiCall1,
        apiCall2,
        apiCall3,
      ]);

      expect(result.results).toEqual(['result1', 'result2', 'result3']);
      expect(result.errors).toEqual([null, null, null]);
      expect(result.successCount).toBe(3);
    });

    it('一部失敗した場合でも成功した結果を返すこと', async () => {
      const apiCall1 = jest.fn().mockResolvedValue('result1');
      const apiCall2 = jest.fn().mockRejectedValue(new Error('Error 2'));
      const apiCall3 = jest.fn().mockResolvedValue('result3');

      const apiError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      MockedErrorUtils.handleError.mockReturnValue({
        apiError,
        userMessage: 'サーバーエラー',
        shouldRetry: false,
      });

      const result = await ApiUtils.parallelWithPartialSuccess([
        apiCall1,
        apiCall2,
        apiCall3,
      ], 2);

      expect(result.results).toEqual(['result1', null, 'result3']);
      expect(result.errors[0]).toBeNull();
      expect(result.errors[1]).toEqual(apiError);
      expect(result.errors[2]).toBeNull();
      expect(result.successCount).toBe(2);
    });

    it('最小成功数に満たない場合はエラーを投げること', async () => {
      const apiCall1 = jest.fn().mockRejectedValue(new Error('Error 1'));
      const apiCall2 = jest.fn().mockRejectedValue(new Error('Error 2'));

      MockedErrorUtils.handleError.mockReturnValue({
        apiError: {
          type: 'network',
          message: 'Network error',
          timestamp: '2024-07-21T10:00:00Z',
        },
        userMessage: 'ネットワークエラー',
        shouldRetry: false,
      });

      await expect(
        ApiUtils.parallelWithPartialSuccess([apiCall1, apiCall2], 2)
      ).rejects.toThrow('Only 0 out of 2 API calls succeeded. Required: 2');
    });
  });

  describe('withTimeout', () => {
    it('タイムアウト前に完了した場合は結果を返すこと', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('success');

      const result = await ApiUtils.withTimeout(mockApiCall, 5000);

      expect(result).toBe('success');
    });

    it('タイムアウトした場合はエラーを投げること', async () => {
      const mockApiCall = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('late'), 2000))
      );

      // setTimeoutをモックしてすぐにタイムアウト
      jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback: any) => {
        callback();
        return null as any;
      });

      await expect(
        ApiUtils.withTimeout(mockApiCall, 1000, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });
  });

  describe('createCachedCall', () => {
    it('初回呼び出しではAPIを実行しキャッシュすること', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('cached-result');
      const cachedCall = ApiUtils.createCachedCall(mockApiCall, 'test-key', 5000);

      const result = await cachedCall();

      expect(mockApiCall).toHaveBeenCalledTimes(1);
      expect(result).toBe('cached-result');
    });

    it('キャッシュ有効期間内では再度API呼び出しをしないこと', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('cached-result');
      const cachedCall = ApiUtils.createCachedCall(mockApiCall, 'test-key', 5000);

      await cachedCall();
      const result = await cachedCall();

      expect(mockApiCall).toHaveBeenCalledTimes(1);
      expect(result).toBe('cached-result');
    });

    it('キャッシュ期限切れ後は再度API呼び出しを行うこと', async () => {
      const mockApiCall = jest.fn()
        .mockResolvedValueOnce('first-result')
        .mockResolvedValueOnce('second-result');

      const cachedCall = ApiUtils.createCachedCall(mockApiCall, 'test-key', 1000);

      const firstResult = await cachedCall();
      
      // 時間を進める
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(2000); // 2秒後

      const secondResult = await cachedCall();

      expect(mockApiCall).toHaveBeenCalledTimes(2);
      expect(firstResult).toBe('first-result');
      expect(secondResult).toBe('second-result');
    });
  });

  describe('createRateLimitedCall', () => {
    it('レート制限内では正常に実行されること', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('success');
      const rateLimitedCall = ApiUtils.createRateLimitedCall(mockApiCall, 3, 60000);

      const result1 = await rateLimitedCall();
      const result2 = await rateLimitedCall();

      expect(result1).toBe('success');
      expect(result2).toBe('success');
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });

    it('レート制限を超えた場合はエラーを投げること', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('success');
      const rateLimitedCall = ApiUtils.createRateLimitedCall(mockApiCall, 2, 60000);

      await rateLimitedCall();
      await rateLimitedCall();

      await expect(rateLimitedCall()).rejects.toThrow('Rate limit exceeded');
    });

    it('期間が経過した後はレート制限がリセットされること', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('success');
      const rateLimitedCall = ApiUtils.createRateLimitedCall(mockApiCall, 1, 1000);

      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(0)     // 初回呼び出し
        .mockReturnValueOnce(0)     // callTimes.push用
        .mockReturnValueOnce(2000); // 2秒後の呼び出し

      await rateLimitedCall();
      const result = await rateLimitedCall();

      expect(result).toBe('success');
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });
  });

  describe('withMonitoring', () => {
    it('成功時に成功ログを出力すること', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('monitoring-success');

      const result = await ApiUtils.withMonitoring(mockApiCall, 'test-operation');

      expect(result).toBe('monitoring-success');
      expect(console.log).toHaveBeenCalledWith(
        '✅ API Success: test-operation',
        expect.objectContaining({
          duration: expect.stringMatching(/\d+ms/),
          timestamp: expect.any(String),
        })
      );
    });

    it('失敗時にエラーログを出力してエラーを再投げすること', async () => {
      const error = new Error('Monitoring test error');
      const apiError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      MockedErrorUtils.handleError.mockReturnValue({
        apiError,
        userMessage: 'サーバーエラー',
        shouldRetry: false,
      });

      const mockApiCall = jest.fn().mockRejectedValue(error);

      await expect(
        ApiUtils.withMonitoring(mockApiCall, 'failing-operation')
      ).rejects.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        '❌ API Error: failing-operation',
        expect.objectContaining({
          error: apiError,
          duration: expect.stringMatching(/\d+ms/),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('batchProcess', () => {
    it('アイテムを指定バッチサイズで処理すること', async () => {
      const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
      const processor = jest.fn().mockImplementation((item: string) => 
        Promise.resolve(item.toUpperCase())
      );

      const result = await ApiUtils.batchProcess(items, processor, 2, 0);

      expect(result).toEqual(['ITEM1', 'ITEM2', 'ITEM3', 'ITEM4', 'ITEM5']);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('バッチ間の遅延が適用されること', async () => {
      const items = ['item1', 'item2', 'item3'];
      const processor = jest.fn().mockImplementation((item: string) => 
        Promise.resolve(item.toUpperCase())
      );

      // setTimeoutをモック
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return null as any;
      });

      await ApiUtils.batchProcess(items, processor, 1, 100);

      expect(setTimeoutSpy).toHaveBeenCalledTimes(2); // 2つのバッチ間の遅延
    });

    it('並列処理が正しく動作すること', async () => {
      const items = ['a', 'b', 'c', 'd'];
      const processingOrder: string[] = [];
      
      const processor = jest.fn().mockImplementation(async (item: string) => {
        processingOrder.push(`start-${item}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        processingOrder.push(`end-${item}`);
        return item.toUpperCase();
      });

      const result = await ApiUtils.batchProcess(items, processor, 2, 0);

      expect(result).toEqual(['A', 'B', 'C', 'D']);
      // バッチ内は並列処理されるため、start が連続する
      expect(processingOrder.slice(0, 2)).toEqual(['start-a', 'start-b']);
    });
  });
});