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

  // RTK-Query middleware setup debug info
  console.log('🔧 Store configuration debug:', {
    isReduxEnabled,
    isSupabaseEnabled,
    isDebugMode,
    willAddMiddleware: isReduxEnabled,
    willAddReducers: isReduxEnabled,
    supabaseReducerPath: supabaseApi.reducerPath,
    imageReducerPath: imageApi.reducerPath,
  });

  if (!isReduxEnabled) {
    console.warn('⚠️ Redux無効時のエラー回避のため、middlewareを強制追加');
  }

  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      ui: uiSlice.reducer,
      settings: settingsSlice.reducer,
      image: imageSlice.reducer,
      // Always include RTK Query reducers to prevent "Middleware for RTK-Query API has not been added" errors
      // Even if features are disabled, the reducers should be present since APIs are imported
      [supabaseApi.reducerPath]: supabaseApi.reducer,
      [imageApi.reducerPath]: imageApi.reducer,
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

      // Always add RTK Query middleware to prevent "Middleware for RTK-Query API has not been added" errors
      // Even if features are disabled, the middleware should be present since APIs are imported
      middlewareArray.push(
        supabaseApi.middleware,
        imageApi.middleware
      );

      return baseMiddleware.concat(...middlewareArray);
    },
    devTools: isDebugMode,
  });

  // Always setup RTK Query listeners to prevent middleware errors
  setupListeners(store.dispatch);
  
  if (isDebugMode) {
    console.log('🔧 RTK Query setup completed:', {
      supabaseApiReducerPath: supabaseApi.reducerPath,
      imageApiReducerPath: imageApi.reducerPath,
      middlewareEnabled: true,
      listenersEnabled: true,
      reduxEnabled: isReduxEnabled,
      supabaseFeatureEnabled: isSupabaseEnabled
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
  // RTK Query is always configured since middleware and reducers are always added
  return true;
};

// Helper function to check if Supabase features are enabled
export const isSupabaseFeaturesEnabled = () => {
  const featureFlags = FeatureFlagsManager.getInstance();
  return featureFlags.isSupabaseEnabled();
};

// Store validation function for debugging (defined after store creation)
export const validateStore = () => {
  try {
    const state = store.getState();
    const hasSupabaseApi = 'supabaseApi' in state;
    const hasImageApi = 'imageApi' in state;
    const featureFlags = FeatureFlagsManager.getInstance();
    
    return {
      isValid: hasSupabaseApi && hasImageApi,
      hasSupabaseApi,
      hasImageApi,
      reducerPaths: {
        supabase: supabaseApi.reducerPath,
        image: imageApi.reducerPath,
      },
      middlewareConfigured: isRTKQueryConfigured(),
      supabaseFeaturesEnabled: isSupabaseFeaturesEnabled(),
      featureFlags: {
        isReduxEnabled: featureFlags.isReduxEnabled(),
        isSupabaseEnabled: featureFlags.isSupabaseEnabled(),
        isDebugMode: featureFlags.isDebugModeEnabled(),
      },
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

// Immediate validation on store creation to catch issues early
export const performImmediateValidation = () => {
  const validation = validateStore();
  console.log('📊 Immediate store validation result:', validation);
  
  if (!validation.isValid) {
    console.error('❗ CRITICAL: RTK Query store validation failed immediately!');
    console.error('This may cause "Middleware for RTK-Query API has not been added" errors');
  }
  
  return validation;
};

// Call immediate validation
setTimeout(() => {
  performImmediateValidation();
}, 0);