import { SupabaseConfig } from './client';
import { FeatureFlagsManager } from '../featureFlags';

export const createSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
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