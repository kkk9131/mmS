import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store, validateStore } from '../store';
import { FeatureFlagsManager } from '../services/featureFlags';
import { supabaseClient } from '../services/supabase/client';
import { createSupabaseConfig } from '../services/supabase/config';
import { initializeAuth } from '../store/slices/authSlice';
import { ServiceBridge } from '../services/adapters/ServiceBridge';
import { performStartupEnvironmentCheck, logDetailedEnvironmentInfo } from '../utils/envValidator';
import { logSupabaseDiagnostic, performQuickFix } from '../utils/debugSupabase';

interface ReduxProviderProps {
  children: React.ReactNode;
}

const ReduxInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const initializeApp = async () => {
      // 環境変数の検証とデバッグ情報出力
      const envValid = performStartupEnvironmentCheck();
      
      const featureFlags = FeatureFlagsManager.getInstance();
      
      // デバッグモード時は詳細な環境情報を出力
      if (featureFlags.isDebugModeEnabled()) {
        logDetailedEnvironmentInfo();
        // Supabase診断も実行
        setTimeout(() => logSupabaseDiagnostic(), 1000);
      }
      
      // 環境設定に問題がある場合はクイック修復を試行
      if (!envValid) {
        performQuickFix();
      }
      
      if (!envValid) {
        console.warn('⚠️ Environment validation failed, some features may not work correctly');
      }
      
      try {
        // Initialize ServiceBridge with store
        ServiceBridge.initialize(store);
        console.log('✅ ServiceBridge initialized');

        // Initialize Supabase if enabled and properly configured
        if (featureFlags.isSupabaseEnabled()) {
          try {
            const config = createSupabaseConfig();
            supabaseClient.initialize(config);
            console.log('✅ Supabase client initialized');
            
            // Test connection
            const connectionStatus = await supabaseClient.testConnection();
            if (connectionStatus.isConnected) {
              console.log('✅ Supabase connection test successful');
            } else {
              console.warn('⚠️ Supabase connection test failed:', connectionStatus.error);
            }
          } catch (supabaseError) {
            console.error('❌ Supabase initialization failed:', supabaseError);
            // Supabase初期化失敗時はフラグを無効化
            featureFlags.disableSupabaseMode();
            console.log('⚠️ Supabase disabled due to initialization failure');
          }
        } else {
          console.log('🔧 Supabase is disabled by feature flags');
        }

        // Initialize auth state if Redux is enabled
        if (featureFlags.isReduxEnabled()) {
          store.dispatch(initializeAuth());
          console.log('✅ Auth state initialized');
          
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
        console.error('❌ ReduxProvider初期化失敗:', error);
        // 緊急フォールバックモード
        featureFlags.enableMockMode();
        console.log('🔧 Enabled fallback mock mode due to initialization failure');
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