import { SupabaseConfig } from './client';
import { FeatureFlagsManager } from '../featureFlags';

export const createSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';
  
  // 環境変数のデバッグ情報
  console.log('🔧 Supabase Config Debug:', {
    hasUrl: !!url,
    hasAnonKey: !!anonKey,
    useSupabase,
    urlPreview: url ? `${url.substring(0, 30)}...` : 'undefined',
    keyPreview: anonKey ? `${anonKey.substring(0, 20)}...` : 'undefined'
  });
  
  if (!url || !anonKey) {
    const missingVars = [];
    if (!url) missingVars.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!anonKey) missingVars.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    
    throw new Error(
      `Missing Supabase configuration: ${missingVars.join(', ')}. ` +
      'Please check your environment variables in .env files.'
    );
  }

  const featureFlags = FeatureFlagsManager.getInstance();
  
  return {
    url,
    anonKey,
    debug: featureFlags.isDebugModeEnabled(),
  };
};

export const getSupabaseUrl = (): string => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set');
  }
  return url;
};

export const getSupabaseAnonKey = (): string => {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  return anonKey;
};

export const validateSupabaseConfig = (): boolean => {
  try {
    createSupabaseConfig();
    return true;
  } catch {
    return false;
  }
};