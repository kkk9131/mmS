import { SupabaseErrorHandler, SupabaseError } from '../../utils/SupabaseErrorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { SerializedError } from '@reduxjs/toolkit';

describe('SupabaseErrorHandler', () => {
  describe('handle', () => {
    it('should handle PostgrestError with known code', () => {
      const postgrestError: PostgrestError = {
        message: 'duplicate key value violates unique constraint',
        details: 'Key already exists',
        hint: '',
        code: '23505', // unique_violation
        name: 'PostgrestError',
      };

      const result = SupabaseErrorHandler.handle(postgrestError);

      expect(result.type).toBe('VALIDATION_ERROR');
      expect(result.userMessage).toBe('この情報は既に登録されています。');
      expect(result.recoverable).toBe(true);
      expect(result.code).toBe('23505');
    });

    it('should handle PostgrestError with unknown code', () => {
      const postgrestError: PostgrestError = {
        message: 'Unknown database error',
        details: 'Some details',
        hint: '',
        code: '99999', // unknown code
        name: 'PostgrestError',
      };

      const result = SupabaseErrorHandler.handle(postgrestError);

      expect(result.type).toBe('SERVER_ERROR');
      expect(result.userMessage).toBe('データベースエラーが発生しました。');
      expect(result.recoverable).toBe(false);
    });

    it('should handle AuthError', () => {
      const authError = {
        name: 'AuthError',
        message: 'Invalid credentials',
        status: 401,
      };

      const result = SupabaseErrorHandler.handle(authError);

      expect(result.type).toBe('AUTH_ERROR');
      expect(result.userMessage).toBe('認証エラーが発生しました。');
      expect(result.recoverable).toBe(true);
    });

    it('should handle FetchError (network error)', () => {
      const fetchError = {
        name: 'FetchError',
        message: 'Failed to fetch',
        code: 'NETWORK_ERROR',
      };

      const result = SupabaseErrorHandler.handle(fetchError);

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.userMessage).toBe('ネットワークエラーが発生しました。');
      expect(result.recoverable).toBe(true);
    });

    it('should handle rate limit error (429)', () => {
      const rateLimitError = {
        status: 429,
        message: 'Too many requests',
        headers: new Map([['Retry-After', '60']]),
      };

      const result = SupabaseErrorHandler.handle(rateLimitError);

      expect(result.type).toBe('RATE_LIMIT');
      expect(result.userMessage).toBe('リクエストが多すぎます。しばらくしてからお試しください。');
      expect(result.recoverable).toBe(true);
      expect(result.retryAfter).toBe(60);
    });

    it('should handle SerializedError from RTK', () => {
      const serializedError: SerializedError = {
        name: 'NetworkError',
        message: 'Network connection failed',
        code: 'NETWORK_ERROR',
      };

      const result = SupabaseErrorHandler.handle(serializedError);

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.userMessage).toBe('ネットワーク接続を確認してください。');
      expect(result.recoverable).toBe(true);
    });

    it('should handle row-level security errors', () => {
      const rlsError: PostgrestError = {
        message: 'new row violates row-level security policy for table "posts"',
        details: 'Policy violation',
        hint: 'Check your permissions',
        code: '42501',
        name: 'PostgrestError',
      };

      const result = SupabaseErrorHandler.handle(rlsError);

      expect(result.type).toBe('PERMISSION_ERROR');
      expect(result.userMessage).toBe('この操作を実行する権限がありません。');
      expect(result.recoverable).toBe(false);
    });

    it('should handle unknown errors', () => {
      const unknownError = {
        message: 'Something went wrong',
        randomProperty: 'random value',
      };

      const result = SupabaseErrorHandler.handle(unknownError);

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.userMessage).toBe('予期しないエラーが発生しました。しばらくしてからお試しください。');
      expect(result.recoverable).toBe(true);
    });

    it('should handle errors without message', () => {
      const errorWithoutMessage = {
        code: 'SOME_CODE',
      };

      const result = SupabaseErrorHandler.handle(errorWithoutMessage);

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('Unknown error occurred');
      expect(result.recoverable).toBe(true);
    });
  });

  describe('isRecoverable', () => {
    it('should identify recoverable errors', () => {
      const recoverableError: SupabaseError = {
        type: 'NETWORK_ERROR',
        message: 'Network failed',
        userMessage: 'ネットワークエラー',
        recoverable: true,
      };

      expect(SupabaseErrorHandler.isRecoverable(recoverableError)).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      const nonRecoverableError: SupabaseError = {
        type: 'PERMISSION_ERROR',
        message: 'Access denied',
        userMessage: '権限がありません',
        recoverable: false,
      };

      expect(SupabaseErrorHandler.isRecoverable(nonRecoverableError)).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('should return user-friendly message', () => {
      const error: SupabaseError = {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        userMessage: '入力内容を確認してください',
        recoverable: true,
      };

      const userMessage = SupabaseErrorHandler.getUserMessage(error);
      expect(userMessage).toBe('入力内容を確認してください');
    });
  });

  describe('shouldRetry', () => {
    it('should recommend retry for network errors', () => {
      const networkError: SupabaseError = {
        type: 'NETWORK_ERROR',
        message: 'Network failed',
        userMessage: 'ネットワークエラー',
        recoverable: true,
      };

      expect(SupabaseErrorHandler.shouldRetry(networkError)).toBe(true);
    });

    it('should recommend retry for rate limit errors', () => {
      const rateLimitError: SupabaseError = {
        type: 'RATE_LIMIT',
        message: 'Too many requests',
        userMessage: 'リクエスト過多',
        recoverable: true,
      };

      expect(SupabaseErrorHandler.shouldRetry(rateLimitError)).toBe(true);
    });

    it('should recommend retry for server errors', () => {
      const serverError: SupabaseError = {
        type: 'SERVER_ERROR',
        message: 'Internal server error',
        userMessage: 'サーバーエラー',
        recoverable: true,
      };

      expect(SupabaseErrorHandler.shouldRetry(serverError)).toBe(true);
    });

    it('should not recommend retry for auth errors', () => {
      const authError: SupabaseError = {
        type: 'AUTH_ERROR',
        message: 'Authentication failed',
        userMessage: '認証エラー',
        recoverable: true,
      };

      expect(SupabaseErrorHandler.shouldRetry(authError)).toBe(false);
    });

    it('should not recommend retry for permission errors', () => {
      const permissionError: SupabaseError = {
        type: 'PERMISSION_ERROR',
        message: 'Access denied',
        userMessage: '権限エラー',
        recoverable: false,
      };

      expect(SupabaseErrorHandler.shouldRetry(permissionError)).toBe(false);
    });

    it('should not recommend retry for non-recoverable errors', () => {
      const nonRecoverableError: SupabaseError = {
        type: 'VALIDATION_ERROR',
        message: 'Invalid data',
        userMessage: 'データエラー',
        recoverable: false,
      };

      expect(SupabaseErrorHandler.shouldRetry(nonRecoverableError)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return specified retry delay for rate limit errors', () => {
      const rateLimitError: SupabaseError = {
        type: 'RATE_LIMIT',
        message: 'Too many requests',
        userMessage: 'リクエスト過多',
        recoverable: true,
        retryAfter: 30,
      };

      const delay = SupabaseErrorHandler.getRetryDelay(rateLimitError);
      expect(delay).toBe(30000); // 30 seconds in milliseconds
    });

    it('should return exponential backoff delay for other errors', () => {
      const networkError: SupabaseError = {
        type: 'NETWORK_ERROR',
        message: 'Network failed',
        userMessage: 'ネットワークエラー',
        recoverable: true,
      };

      // Test different attempt numbers
      expect(SupabaseErrorHandler.getRetryDelay(networkError, 1)).toBe(1000); // 1s
      expect(SupabaseErrorHandler.getRetryDelay(networkError, 2)).toBe(2000); // 2s
      expect(SupabaseErrorHandler.getRetryDelay(networkError, 3)).toBe(4000); // 4s
      expect(SupabaseErrorHandler.getRetryDelay(networkError, 4)).toBe(8000); // 8s
      expect(SupabaseErrorHandler.getRetryDelay(networkError, 5)).toBe(16000); // 16s (max)
      expect(SupabaseErrorHandler.getRetryDelay(networkError, 10)).toBe(16000); // Still max
    });

    it('should handle rate limit without retry-after header', () => {
      const rateLimitError: SupabaseError = {
        type: 'RATE_LIMIT',
        message: 'Too many requests',
        userMessage: 'リクエスト過多',
        recoverable: true,
      };

      const delay = SupabaseErrorHandler.getRetryDelay(rateLimitError);
      expect(delay).toBe(1000); // Falls back to exponential backoff
    });
  });

  describe('Error Message Localization', () => {
    it('should provide Japanese user messages', () => {
      const testCases = [
        { type: 'AUTH_ERROR', expected: '認証エラーが発生しました。' },
        { type: 'NETWORK_ERROR', expected: 'ネットワークエラーが発生しました。' },
        { type: 'PERMISSION_ERROR', expected: 'この操作を実行する権限がありません。' },
        { type: 'VALIDATION_ERROR', expected: '必須項目が入力されていません。' },
        { type: 'RATE_LIMIT', expected: 'リクエストが多すぎます。しばらくしてからお試しください。' },
        { type: 'NOT_FOUND', expected: 'データが見つかりませんでした。' },
        { type: 'SERVER_ERROR', expected: 'データベースエラーが発生しました。' },
        { type: 'UNKNOWN_ERROR', expected: '予期しないエラーが発生しました。しばらくしてからお試しください。' },
      ];

      testCases.forEach(({ type, expected }) => {
        const error = {
          message: 'Technical error message',
          [type]: true,
        };

        const result = SupabaseErrorHandler.handle(error);
        expect(result.userMessage).toBe(expected);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined errors', () => {
      const nullResult = SupabaseErrorHandler.handle(null);
      expect(nullResult.type).toBe('UNKNOWN_ERROR');

      const undefinedResult = SupabaseErrorHandler.handle(undefined);
      expect(undefinedResult.type).toBe('UNKNOWN_ERROR');
    });

    it('should handle circular reference errors', () => {
      const circularError: any = { message: 'Circular error' };
      circularError.self = circularError;

      const result = SupabaseErrorHandler.handle(circularError);
      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.recoverable).toBe(true);
    });

    it('should handle errors with complex nested objects', () => {
      const complexError = {
        message: 'Complex error',
        nested: {
          deep: {
            property: 'value',
            array: [1, 2, 3],
          },
        },
        code: 'COMPLEX_CODE',
      };

      const result = SupabaseErrorHandler.handle(complexError);
      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.details).toBeDefined();
    });
  });
});