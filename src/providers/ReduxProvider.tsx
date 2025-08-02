import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store, validateStore } from '../store';
import { FeatureFlagsManager } from '../services/featureFlags';
import { supabaseClient } from '../services/supabase/client';
import { createSupabaseConfig } from '../services/supabase/config';
import { initializeAuth } from '../store/slices/authSlice';
import { ServiceBridge } from '../services/adapters/ServiceBridge';

interface ReduxProviderProps {
  children: React.ReactNode;
}

const ReduxInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const initializeApp = async () => {
      const featureFlags = FeatureFlagsManager.getInstance();
      
      try {
        // Initialize ServiceBridge with store
        ServiceBridge.initialize(store);

        // Initialize Supabase if enabled
        if (featureFlags.isSupabaseEnabled()) {
          const config = createSupabaseConfig();
          supabaseClient.initialize(config);
          
          // Test connection
          await supabaseClient.testConnection();
        }

        // Initialize auth state if Redux is enabled
        if (featureFlags.isReduxEnabled()) {
          store.dispatch(initializeAuth());
          
          // Validate RTK Query setup in debug mode
          if (featureFlags.isDebugModeEnabled()) {
            setTimeout(() => {
              const validation = validateStore();
              console.log('🔍 RTK Query ストア検証結果:', validation);
              
              if (!validation.isValid) {
                console.error('⚠️ RTK Query設定に問題があります:', {
                  missingSupabaseApi: !validation.hasSupabaseApi,
                  missingImageApi: !validation.hasImageApi,
                  middlewareConfigured: validation.middlewareConfigured,
                  storeKeys: validation.storeKeys
                });
              } else {
                console.log('✅ RTK Query が正しく設定されています');
              }
            }, 500);
          }
        }

      } catch (error) {
        console.error('ReduxProvider初期化失敗:', error);
      }
    };

    initializeApp();
  }, []);

  return <>{children}</>;
};

export const ReduxProvider: React.FC<ReduxProviderProps> = ({ children }) => {
  const featureFlags = FeatureFlagsManager.getInstance();
  const isReduxEnabled = featureFlags.isReduxEnabled();

  if (!isReduxEnabled) {
    console.warn('Redux is disabled by feature flags, using fallback provider');
    return <ReduxInitializer>{children}</ReduxInitializer>;
  }

  return (
    <Provider store={store}>
      <ReduxInitializer>
        {children}
      </ReduxInitializer>
    </Provider>
  );
};