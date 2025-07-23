import { PostgrestError } from '@supabase/supabase-js';
import { SerializedError } from '@reduxjs/toolkit';

export type SupabaseErrorType = 
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface SupabaseError {
  type: SupabaseErrorType;
  message: string;
  userMessage: string;
  code?: string;
  details?: any;
  recoverable: boolean;
  retryAfter?: number;
}

export class SupabaseErrorHandler {
  private static errorMessages: Record<string, { type: SupabaseErrorType; userMessage: string; recoverable: boolean }> = {
    // Auth errors
    'invalid_credentials': {
      type: 'AUTH_ERROR',
      userMessage: '認証情報が正しくありません。もう一度お試しください。',
      recoverable: true
    },
    'user_not_found': {
      type: 'AUTH_ERROR',
      userMessage: 'ユーザーが見つかりません。',
      recoverable: true
    },
    'session_not_found': {
      type: 'AUTH_ERROR',
      userMessage: 'セッションの有効期限が切れました。再度ログインしてください。',
      recoverable: true
    },
    
    // Permission errors
    '42501': { // PostgreSQL insufficient_privilege
      type: 'PERMISSION_ERROR',
      userMessage: 'この操作を実行する権限がありません。',
      recoverable: false
    },
    'new row violates row-level security policy': {
      type: 'PERMISSION_ERROR',
      userMessage: 'この操作は許可されていません。',
      recoverable: false
    },
    
    // Validation errors
    '23505': { // PostgreSQL unique_violation
      type: 'VALIDATION_ERROR',
      userMessage: 'この情報は既に登録されています。',
      recoverable: true
    },
    '23502': { // PostgreSQL not_null_violation
      type: 'VALIDATION_ERROR',
      userMessage: '必須項目が入力されていません。',
      recoverable: true
    },
    
    // Network errors
    'FetchError': {
      type: 'NETWORK_ERROR',
      userMessage: 'ネットワーク接続に問題があります。接続を確認してください。',
      recoverable: true
    },
    'NetworkError': {
      type: 'NETWORK_ERROR',
      userMessage: 'インターネット接続を確認してください。',
      recoverable: true
    },
    
    // Rate limiting
    '429': {
      type: 'RATE_LIMIT',
      userMessage: 'リクエストが多すぎます。しばらくしてからお試しください。',
      recoverable: true
    },
    
    // Not found
    'PGRST116': { // Supabase: No rows found
      type: 'NOT_FOUND',
      userMessage: 'データが見つかりませんでした。',
      recoverable: false
    }
  };

  static handle(error: any): SupabaseError {
    // Handle PostgrestError
    if (this.isPostgrestError(error)) {
      return this.handlePostgrestError(error);
    }
    
    // Handle Auth Error
    if (error?.name === 'AuthError' || error?.status === 401) {
      return this.createError('AUTH_ERROR', error.message, '認証エラーが発生しました。', true);
    }
    
    // Handle Network Error
    if (error?.name === 'FetchError' || error?.code === 'NETWORK_ERROR') {
      return this.createError('NETWORK_ERROR', error.message, 'ネットワークエラーが発生しました。', true);
    }
    
    // Handle Rate Limit
    if (error?.status === 429) {
      const retryAfter = error.headers?.get('Retry-After');
      return {
        type: 'RATE_LIMIT',
        message: error.message || 'Rate limit exceeded',
        userMessage: 'リクエストが多すぎます。しばらくしてからお試しください。',
        recoverable: true,
        retryAfter: retryAfter ? parseInt(retryAfter) : 60
      };
    }
    
    // Handle serialized RTK errors
    if (this.isSerializedError(error)) {
      return this.handleSerializedError(error);
    }
    
    // Default error
    return this.createError(
      'UNKNOWN_ERROR',
      error?.message || 'Unknown error occurred',
      '予期しないエラーが発生しました。しばらくしてからお試しください。',
      true,
      error
    );
  }
  
  private static isPostgrestError(error: any): error is PostgrestError {
    return error && typeof error === 'object' && 'code' in error && 'message' in error;
  }
  
  private static isSerializedError(error: any): error is SerializedError {
    return error && typeof error === 'object' && 'name' in error && 'message' in error;
  }
  
  private static handlePostgrestError(error: PostgrestError): SupabaseError {
    // Check for known error codes
    const knownError = this.errorMessages[error.code] || 
                      (error.message && this.errorMessages[error.message]) ||
                      (error.details && this.errorMessages[error.details]);
    
    if (knownError) {
      return this.createError(
        knownError.type,
        error.message,
        knownError.userMessage,
        knownError.recoverable,
        error
      );
    }
    
    // Handle by HTTP status hint
    if (error.hint) {
      if (error.hint.includes('row-level security')) {
        return this.createError(
          'PERMISSION_ERROR',
          error.message,
          'この操作を実行する権限がありません。',
          false,
          error
        );
      }
    }
    
    // Default PostgreSQL error
    return this.createError(
      'SERVER_ERROR',
      error.message,
      'データベースエラーが発生しました。',
      false,
      error
    );
  }
  
  private static handleSerializedError(error: SerializedError): SupabaseError {
    if (error.code === 'NETWORK_ERROR' || error.name === 'NetworkError') {
      return this.createError(
        'NETWORK_ERROR',
        error.message || 'Network error',
        'ネットワーク接続を確認してください。',
        true,
        error
      );
    }
    
    return this.createError(
      'UNKNOWN_ERROR',
      error.message || 'Unknown error',
      'エラーが発生しました。',
      true,
      error
    );
  }
  
  private static createError(
    type: SupabaseErrorType,
    message: string,
    userMessage: string,
    recoverable: boolean,
    details?: any
  ): SupabaseError {
    return {
      type,
      message,
      userMessage,
      recoverable,
      code: details?.code,
      details
    };
  }
  
  static isRecoverable(error: SupabaseError): boolean {
    return error.recoverable;
  }
  
  static getUserMessage(error: SupabaseError): string {
    return error.userMessage;
  }
  
  static shouldRetry(error: SupabaseError): boolean {
    return ['NETWORK_ERROR', 'RATE_LIMIT', 'SERVER_ERROR'].includes(error.type) && error.recoverable;
  }
  
  static getRetryDelay(error: SupabaseError, attempt: number = 1): number {
    if (error.type === 'RATE_LIMIT' && error.retryAfter) {
      return error.retryAfter * 1000;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, max 16s
    return Math.min(1000 * Math.pow(2, attempt - 1), 16000);
  }
}