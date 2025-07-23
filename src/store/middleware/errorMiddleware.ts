import { Middleware, isRejectedWithValue } from '@reduxjs/toolkit';
import { SupabaseErrorHandler } from '../../utils/SupabaseErrorHandler';
import { setError, showNotification } from '../slices/uiSlice';

export const errorMiddleware: Middleware = (api) => (next) => (action) => {
  // Handle RTK Query errors
  if (isRejectedWithValue(action)) {
    const error = action.payload;
    const supabaseError = SupabaseErrorHandler.handle(error);
    
    // Dispatch error to UI state
    api.dispatch(setError(supabaseError));
    
    // Log error in development
    if (__DEV__) {
      console.error('API Error:', {
        type: supabaseError.type,
        message: supabaseError.message,
        userMessage: supabaseError.userMessage,
        details: supabaseError.details
      });
    }
    
    // Handle specific error types
    switch (supabaseError.type) {
      case 'AUTH_ERROR':
        // Session expired - could trigger logout
        if (supabaseError.message?.includes('session_not_found')) {
          // Dispatch logout action if needed
          // api.dispatch(logout());
        }
        break;
        
      case 'NETWORK_ERROR':
        // Show offline notification
        api.dispatch(showNotification({
          message: 'インターネット接続を確認してください',
          type: 'warning',
          duration: 0 // Persistent until online
        }));
        break;
        
      case 'RATE_LIMIT':
        // Show rate limit notification with retry time
        const retryAfter = supabaseError.retryAfter || 60;
        api.dispatch(showNotification({
          message: `リクエストが多すぎます。${retryAfter}秒後に再試行してください。`,
          type: 'warning',
          duration: retryAfter * 1000
        }));
        break;
    }
  }
  
  return next(action);
};