import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authSlice } from './slices/authSlice';
import { uiSlice } from './slices/uiSlice';
import { settingsSlice } from './slices/settingsSlice';
import { imageSlice } from './slices/imageSlice';
import { supabaseApi } from './api/supabaseApi';
import { imageApi } from './api/imageApi';
// Note: postsApi, usersApi, notificationsApi, followsApi are all created via supabaseApi.injectEndpoints()
// so they share the same reducerPath ('supabaseApi') and don't need separate imports for store configuration
import { FeatureFlagsManager } from '../services/featureFlags';
import { errorMiddleware } from './middleware/errorMiddleware';

// Create store with conditional middleware based on feature flags
export const createStore = () => {
  const featureFlags = FeatureFlagsManager.getInstance();
  const isReduxEnabled = featureFlags.isReduxEnabled();
  const isSupabaseEnabled = featureFlags.isSupabaseEnabled();
  const isDebugMode = featureFlags.isDebugModeEnabled();

  if (!isReduxEnabled) {
    console.warn('Redux is disabled by feature flags');
  }

  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      ui: uiSlice.reducer,
      settings: settingsSlice.reducer,
      image: imageSlice.reducer,
      ...(isReduxEnabled && isSupabaseEnabled ? {
        // supabaseApi includes all injected endpoints (posts, users, notifications, follows)
        [supabaseApi.reducerPath]: supabaseApi.reducer,
        // imageApi is a separate API with its own reducerPath
        [imageApi.reducerPath]: imageApi.reducer,
      } : {}),
    },
    middleware: (getDefaultMiddleware) => {
      const baseMiddleware = getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [
            'persist/PERSIST',
            'persist/REHYDRATE',
            'ui/setError',
            'ui/setKeyedError',
            // RTK Query actions
            'supabaseApi/executeMutation/pending',
            'supabaseApi/executeMutation/fulfilled',
            'supabaseApi/executeMutation/rejected',
            'supabaseApi/executeQuery/pending',
            'supabaseApi/executeQuery/fulfilled',
            'supabaseApi/executeQuery/rejected',
            'imageApi/executeMutation/pending',
            'imageApi/executeMutation/fulfilled',
            'imageApi/executeMutation/rejected',
          ],
          ignoredActionPaths: [
            'payload.details', 
            'payload.error',
            'payload.originalArgs',
            'payload.baseQueryMeta',
            'meta.arg',
            'meta.baseQueryMeta'
          ],
          ignoredPaths: [
            'ui.errors', 
            'ui.globalError',
            'supabaseApi',
            'imageApi'
          ],
        },
      });

      const middlewareArray = [errorMiddleware];

      if (isReduxEnabled && isSupabaseEnabled) {
        // Add RTK Query middleware for both APIs
        middlewareArray.push(
          supabaseApi.middleware,
          imageApi.middleware
        );
      }

      return baseMiddleware.concat(...middlewareArray);
    },
    devTools: isDebugMode,
  });

  // Setup listeners for RTK Query with proper configuration
  if (isReduxEnabled && isSupabaseEnabled) {
    setupListeners(store.dispatch);
    
    if (isDebugMode) {
      console.log('🔧 RTK Query setup completed:', {
        supabaseApiReducerPath: supabaseApi.reducerPath,
        imageApiReducerPath: imageApi.reducerPath,
        middlewareEnabled: true,
        listenersEnabled: true
      });
      
      // Validate store configuration in debug mode
      setTimeout(() => {
        const validation = validateStore();
        console.log('📋 Store validation result:', validation);
        
        if (!validation.isValid) {
          console.error('⚠️ RTK Query store validation failed! Some APIs may not work correctly.');
        }
      }, 100);
    }
  }

  return store;
};

export const store = createStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Enhanced types for better type safety
export type AppStore = typeof store;

// RTK Query specific types for better developer experience
export type SupabaseApiState = RootState['supabaseApi'];
export type ImageApiState = RootState['imageApi'];

// Helper function to check if RTK Query is properly configured
export const isRTKQueryConfigured = () => {
  const featureFlags = FeatureFlagsManager.getInstance();
  return featureFlags.isReduxEnabled() && featureFlags.isSupabaseEnabled();
};

// Store validation function for debugging (defined after store creation)
export const validateStore = () => {
  try {
    const state = store.getState();
    const hasSupabaseApi = 'supabaseApi' in state;
    const hasImageApi = 'imageApi' in state;
    
    return {
      isValid: hasSupabaseApi && hasImageApi,
      hasSupabaseApi,
      hasImageApi,
      reducerPaths: {
        supabase: supabaseApi.reducerPath,
        image: imageApi.reducerPath,
      },
      middlewareConfigured: isRTKQueryConfigured(),
      storeKeys: Object.keys(state),
    };
  } catch (error) {
    console.error('Store validation error:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};