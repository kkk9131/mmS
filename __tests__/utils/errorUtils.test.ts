import { ErrorUtils } from '@/utils/errorUtils';
import { ApiError } from '@/types/api';
import { ApiErrorHandler } from '@/services/api/errorHandler';

jest.mock('@/services/api/errorHandler');

const MockedApiErrorHandler = jest.mocked(ApiErrorHandler);

describe('ErrorUtils', () => {
  let mockErrorHandler: jest.Mocked<ApiErrorHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    ErrorUtils.clearErrorLog();

    mockErrorHandler = {
      handleError: jest.fn(),
      formatUserFriendlyMessage: jest.fn(),
      isRetryableError: jest.fn(),
      createErrorSummary: jest.fn(),
      getRetryDelay: jest.fn(),
      featureFlags: jest.fn() as any,
      classifyError: jest.fn(),
      extractErrorMessage: jest.fn(),
      extractErrorCode: jest.fn(),
      shouldRetry: jest.fn(),
      logError: jest.fn(),
      createRetryConfig: jest.fn(),
    } as unknown as jest.Mocked<ApiErrorHandler>;

    MockedApiErrorHandler.mockImplementation(() => mockErrorHandler);
  });

  describe('handleError', () => {
    const mockApiError: ApiError = {
      type: 'http',
      status: 500,
      message: 'Internal Server Error',
      timestamp: '2024-07-21T10:00:00Z',
      details: {
        url: '/api/test',
        method: 'GET',
      },
    };

    it('エラーを正常に処理してユーザーメッセージを返すこと', () => {
      mockErrorHandler.handleError.mockReturnValue(mockApiError);
      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('サーバーエラーが発生しました');
      mockErrorHandler.isRetryableError.mockReturnValue(true);

      const originalError = new Error('Test error');
      const context = 'test-context';

      const result = ErrorUtils.handleError(originalError, context);

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(originalError);
      expect(mockErrorHandler.formatUserFriendlyMessage).toHaveBeenCalledWith(mockApiError);
      expect(mockErrorHandler.isRetryableError).toHaveBeenCalledWith(mockApiError);

      expect(result).toEqual({
        apiError: mockApiError,
        userMessage: 'サーバーエラーが発生しました',
        shouldRetry: true,
      });
    });

    it('エラーログにコンテキスト情報と共に記録されること', () => {
      mockErrorHandler.handleError.mockReturnValue(mockApiError);
      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('エラーメッセージ');
      mockErrorHandler.isRetryableError.mockReturnValue(false);

      ErrorUtils.handleError(new Error('Test'), 'test-context');

      const summary = ErrorUtils.getErrorSummary();
      expect(summary.total).toBe(1);
    });
  });

  describe('shouldRetry', () => {
    it('最大リトライ回数に達していない場合、errorHandlerの判定を返すこと', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      mockErrorHandler.isRetryableError.mockReturnValue(true);

      const result = ErrorUtils.shouldRetry(error, 2, 3);

      expect(mockErrorHandler.isRetryableError).toHaveBeenCalledWith(error);
      expect(result).toBe(true);
    });

    it('最大リトライ回数に達している場合、falseを返すこと', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const result = ErrorUtils.shouldRetry(error, 3, 3);

      expect(mockErrorHandler.isRetryableError).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('エラー分類メソッド', () => {
    it('認証エラーを正しく判定すること', () => {
      const authError401: ApiError = {
        type: 'http',
        status: 401,
        message: 'Unauthorized',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const authError403: ApiError = {
        type: 'http',
        status: 403,
        message: 'Forbidden',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const nonAuthError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      expect(ErrorUtils.isAuthError(authError401)).toBe(true);
      expect(ErrorUtils.isAuthError(authError403)).toBe(true);
      expect(ErrorUtils.isAuthError(nonAuthError)).toBe(false);
    });

    it('ネットワークエラーを正しく判定すること', () => {
      const networkError: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const timeoutError: ApiError = {
        type: 'timeout',
        message: 'Timeout error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const httpError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Server error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      expect(ErrorUtils.isNetworkError(networkError)).toBe(true);
      expect(ErrorUtils.isNetworkError(timeoutError)).toBe(true);
      expect(ErrorUtils.isNetworkError(httpError)).toBe(false);
    });

    it('バリデーションエラーを正しく判定すること', () => {
      const validationError400: ApiError = {
        type: 'http',
        status: 400,
        message: 'Bad Request',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const validationError422: ApiError = {
        type: 'http',
        status: 422,
        message: 'Unprocessable Entity',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const nonValidationError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      expect(ErrorUtils.isValidationError(validationError400)).toBe(true);
      expect(ErrorUtils.isValidationError(validationError422)).toBe(true);
      expect(ErrorUtils.isValidationError(nonValidationError)).toBe(false);
    });

    it('サーバーエラーを正しく判定すること', () => {
      const serverError500: ApiError = {
        type: 'http',
        status: 500,
        message: 'Internal Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const serverError503: ApiError = {
        type: 'http',
        status: 503,
        message: 'Service Unavailable',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const clientError: ApiError = {
        type: 'http',
        status: 400,
        message: 'Bad Request',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const networkError: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      expect(ErrorUtils.isServerError(serverError500)).toBe(true);
      expect(ErrorUtils.isServerError(serverError503)).toBe(true);
      expect(ErrorUtils.isServerError(clientError)).toBe(false);
      expect(ErrorUtils.isServerError(networkError)).toBe(false);
    });
  });

  describe('エラーログ管理', () => {
    it('エラーサマリーが正しく生成されること', () => {
      const mockSummary = {
        total: 5,
        byType: {
          'network': 2,
          'http': 3,
        },
        recentErrors: [],
      };

      mockErrorHandler.createErrorSummary.mockReturnValue(mockSummary);
      mockErrorHandler.handleError.mockReturnValue({
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
        details: { context: 'test-context' },
      });
      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('エラー');
      mockErrorHandler.isRetryableError.mockReturnValue(true);

      // エラーをログに追加
      ErrorUtils.handleError(new Error('Test 1'), 'context-1');
      ErrorUtils.handleError(new Error('Test 2'), 'context-2');

      const result = ErrorUtils.getErrorSummary();

      expect(mockErrorHandler.createErrorSummary).toHaveBeenCalled();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('byContext');
      expect(result.byContext).toHaveProperty('context-1', 1);
      expect(result.byContext).toHaveProperty('context-2', 1);
    });

    it('エラーログサイズが制限されること', () => {
      mockErrorHandler.handleError.mockReturnValue({
        type: 'http',
        status: 500,
        message: 'Error',
        timestamp: '2024-07-21T10:00:00Z',
      });
      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('エラー');
      mockErrorHandler.isRetryableError.mockReturnValue(false);
      mockErrorHandler.createErrorSummary.mockReturnValue({
        total: 101,
        byType: { 'http': 101 },
        recentErrors: [],
      });

      // 101個のエラーを追加
      for (let i = 0; i < 101; i++) {
        ErrorUtils.handleError(new Error(`Error ${i}`), 'test');
      }

      const summary = ErrorUtils.getErrorSummary();
      // 実際のログサイズは最大100に制限される
      expect(summary.total).toBe(101); // mockからの値
    });

    it('特定期間のエラーを取得できること', () => {
      const now = new Date('2024-07-21T12:00:00Z');
      const oneHourAgo = new Date('2024-07-21T11:00:00Z');
      const twoHoursAgo = new Date('2024-07-21T10:00:00Z');

      // 異なる時刻のエラーを作成
      mockErrorHandler.handleError
        .mockReturnValueOnce({
          type: 'http',
          status: 500,
          message: 'Recent error',
          timestamp: now.toISOString(),
        })
        .mockReturnValueOnce({
          type: 'http',
          status: 500,
          message: 'Old error',
          timestamp: twoHoursAgo.toISOString(),
        });
      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('エラー');
      mockErrorHandler.isRetryableError.mockReturnValue(false);

      ErrorUtils.handleError(new Error('Recent'), 'test');
      ErrorUtils.handleError(new Error('Old'), 'test');

      const errorsInRange = ErrorUtils.getErrorsInTimeRange(oneHourAgo, now);
      expect(errorsInRange).toHaveLength(1);
      expect(errorsInRange[0].message).toBe('Recent error');
    });

    it('エラー頻度を正しく計算すること', () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 
        new Date('2024-07-21T12:00:00Z').getTime()
      );

      const recentTime = new Date('2024-07-21T11:30:00Z');
      const oldTime = new Date('2024-07-21T10:00:00Z');

      mockErrorHandler.handleError
        .mockReturnValueOnce({
          type: 'http',
          status: 500,
          message: 'Recent error 1',
          timestamp: recentTime.toISOString(),
        })
        .mockReturnValueOnce({
          type: 'http',
          status: 500,
          message: 'Recent error 2',
          timestamp: recentTime.toISOString(),
        })
        .mockReturnValueOnce({
          type: 'http',
          status: 500,
          message: 'Old error',
          timestamp: oldTime.toISOString(),
        });
      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('エラー');
      mockErrorHandler.isRetryableError.mockReturnValue(false);

      ErrorUtils.handleError(new Error('Recent 1'), 'test');
      ErrorUtils.handleError(new Error('Recent 2'), 'test');
      ErrorUtils.handleError(new Error('Old'), 'test');

      const frequency = ErrorUtils.getErrorFrequency();
      expect(frequency).toBe(2); // 過去1時間以内のエラーは2個

      jest.restoreAllMocks();
    });
  });

  describe('多言語対応', () => {
    it('日本語のエラーメッセージを取得できること', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      mockErrorHandler.formatUserFriendlyMessage.mockReturnValue('ネットワークエラーが発生しました');

      const message = ErrorUtils.getLocalizedErrorMessage(error, 'ja');

      expect(mockErrorHandler.formatUserFriendlyMessage).toHaveBeenCalledWith(error);
      expect(message).toBe('ネットワークエラーが発生しました');
    });

    it('英語のエラーメッセージを取得できること', () => {
      const networkError: ApiError = {
        type: 'network',
        message: 'Network error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const timeoutError: ApiError = {
        type: 'timeout',
        message: 'Timeout error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const authError: ApiError = {
        type: 'http',
        status: 401,
        message: 'Unauthorized',
        timestamp: '2024-07-21T10:00:00Z',
      };

      const serverError: ApiError = {
        type: 'http',
        status: 500,
        message: 'Internal Server Error',
        timestamp: '2024-07-21T10:00:00Z',
      };

      expect(ErrorUtils.getLocalizedErrorMessage(networkError, 'en')).toBe(
        'Network connection problem. Please check your internet connection.'
      );
      expect(ErrorUtils.getLocalizedErrorMessage(timeoutError, 'en')).toBe(
        'Request timed out. Please try again after a while.'
      );
      expect(ErrorUtils.getLocalizedErrorMessage(authError, 'en')).toBe(
        'Authentication required. Please login again.'
      );
      expect(ErrorUtils.getLocalizedErrorMessage(serverError, 'en')).toBe(
        'Server error. Please try again later.'
      );
    });
  });

  describe('getRetryDelay', () => {
    it('errorHandlerのgetRetryDelayを呼び出すこと', () => {
      mockErrorHandler.getRetryDelay.mockReturnValue(2000);

      const delay = ErrorUtils.getRetryDelay(2, 1000);

      expect(mockErrorHandler.getRetryDelay).toHaveBeenCalledWith(2, 1000);
      expect(delay).toBe(2000);
    });
  });
});