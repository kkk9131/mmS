import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authSlice } from './slices/authSlice';
import { uiSlice } from './slices/uiSlice';
import { settingsSlice } from './slices/settingsSlice';
import { supabaseApi } from './api/supabaseApi';
import { postsApi } from './api/postsApi';
import { usersApi } from './api/usersApi';
import { notificationsApi } from './api/notificationsApi';
import { followsApi } from './api/followsApi';
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
      ...(isReduxEnabled && isSupabaseEnabled ? {
        [supabaseApi.reducerPath]: supabaseApi.reducer,
      } : {}),
    },
    middleware: (getDefaultMiddleware) => {
      const baseMiddleware = getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [
            'persist/PERSIST',
            'persist/REHYDRATE',
            'ui/setError',
            'ui/setKeyedError'
          ],
          ignoredActionPaths: ['payload.details', 'payload.error'],
          ignoredPaths: ['ui.errors', 'ui.globalError'],
        },
      });

      const middlewareArray = [errorMiddleware];

      if (isReduxEnabled && isSupabaseEnabled) {
        middlewareArray.push(
          supabaseApi.middleware
        );
      }

      return baseMiddleware.concat(...middlewareArray);
    },
    devTools: isDebugMode,
  });

  // Setup listeners for RTK Query
  if (isReduxEnabled) {
    setupListeners(store.dispatch);
  }

  return store;
};

export const store = createStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Enhanced types for better type safety
export type AppStore = typeof store;