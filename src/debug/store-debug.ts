/**
 * Store Debug Utility
 * RTK-Query middleware 問題のデバッグ用
 */

import { store, validateStore, performImmediateValidation } from '../store';
import { FeatureFlagsManager } from '../services/featureFlags';
import { supabaseApi } from '../store/api/supabaseApi';
import { imageApi } from '../store/api/imageApi';

export const debugStoreConfiguration = () => {
  console.log('🔍 ===== Store Debug Information =====');
  
  const featureFlags = FeatureFlagsManager.getInstance();
  
  console.log('📋 Feature Flags State:', {
    isReduxEnabled: featureFlags.isReduxEnabled(),
    isSupabaseEnabled: featureFlags.isSupabaseEnabled(),
    isDebugMode: featureFlags.isDebugModeEnabled(),
  });
  
  console.log('🏪 Store State Keys:', Object.keys(store.getState()));
  
  console.log('🔧 API Configuration:', {
    supabaseApiReducerPath: supabaseApi.reducerPath,
    imageApiReducerPath: imageApi.reducerPath,
    supabaseApiInStore: supabaseApi.reducerPath in store.getState(),
    imageApiInStore: imageApi.reducerPath in store.getState(),
  });
  
  // Validate store
  const validation = validateStore();
  console.log('✅ Store Validation:', validation);
  
  // Check middleware
  const state = store.getState();
  console.log('🔍 RTK Query State Check:', {
    hasSupabaseApiInState: 'supabaseApi' in state,
    hasImageApiInState: 'imageApi' in state,
    supabaseApiState: state.supabaseApi ? 'Present' : 'Missing',
    imageApiState: state.imageApi ? 'Present' : 'Missing',
  });
  
  return validation;
};

// Export for use in React DevTools or browser console
if (typeof window !== 'undefined') {
  (window as any).debugStore = debugStoreConfiguration;
}