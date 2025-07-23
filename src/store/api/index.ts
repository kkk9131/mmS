// Export main API slice
export { supabaseApi, enhancedSupabaseApi } from './supabaseApi';

// Export all API slices and their hooks
export * from './postsApi';
export * from './notificationsApi';
export * from './usersApi';
export * from './followsApi';

// Export utility functions
export { createSupabaseEndpoint, createOptimisticMutation } from './supabaseApi';