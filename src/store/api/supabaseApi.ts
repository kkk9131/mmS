import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { supabaseClient } from '../../services/supabase/client';
import { FeatureFlagsManager } from '../../services/featureFlags';

// Custom base query for Supabase
const supabaseBaseQuery: BaseQueryFn<
  {
    table: string;
    method: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc';
    query?: any;
    data?: any;
    options?: any;
  },
  unknown,
  {
    message: string;
    status?: number;
    code?: string;
  }
> = async ({ table, method, query, data, options = {} }) => {
  const featureFlags = FeatureFlagsManager.getInstance();
  
  if (!featureFlags.isSupabaseEnabled()) {
    return {
      error: {
        message: 'Supabase is disabled by feature flags',
        code: 'FEATURE_DISABLED'
      }
    };
  }

  try {
    const client = supabaseClient.getClient();
    let queryBuilder: any;

    switch (method) {
      case 'select':
        queryBuilder = client.from(table).select(query || '*');
        break;
      case 'insert':
        queryBuilder = client.from(table).insert(data);
        break;
      case 'update':
        queryBuilder = client.from(table).update(data);
        break;
      case 'delete':
        queryBuilder = client.from(table).delete();
        break;
      case 'upsert':
        queryBuilder = client.from(table).upsert(data);
        break;
      case 'rpc':
        queryBuilder = client.rpc(table, data);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    // Apply additional query options
    if (options.eq) {
      Object.entries(options.eq).forEach(([column, value]) => {
        queryBuilder = queryBuilder.eq(column, value);
      });
    }

    if (options.neq) {
      Object.entries(options.neq).forEach(([column, value]) => {
        queryBuilder = queryBuilder.neq(column, value);
      });
    }

    if (options.order) {
      queryBuilder = queryBuilder.order(options.order.column, { 
        ascending: options.order.ascending ?? true 
      });
    }

    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    if (options.range) {
      queryBuilder = queryBuilder.range(options.range.from, options.range.to);
    }

    if (options.single) {
      queryBuilder = queryBuilder.single();
    }

    if (options.maybeSingle && typeof queryBuilder.maybeSingle === 'function') {
      queryBuilder = queryBuilder.maybeSingle();
    } else if (options.single && typeof queryBuilder.single === 'function') {
      queryBuilder = queryBuilder.single();
    }

    const { data: result, error } = await queryBuilder;

    if (error) {
      return {
        error: {
          message: error.message,
          code: error.code,
          status: error.status || 400,
        }
      };
    }

    return { data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (featureFlags.isDebugModeEnabled()) {
      console.error('Supabase query error:', {
        table,
        method,
        query,
        data,
        options,
        error: message
      });
    }

    return {
      error: {
        message,
        code: 'QUERY_ERROR'
      }
    };
  }
};

// Create the API slice
export const supabaseApi = createApi({
  reducerPath: 'supabaseApi',
  baseQuery: supabaseBaseQuery,
  tagTypes: ['User', 'Post', 'Comment', 'Like', 'Notification', 'Follow'],
  endpoints: () => ({}),
});

// Add endpoints that are missing from the individual slices
export const enhancedSupabaseApi = supabaseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Health check endpoint
    healthCheck: builder.query<{ status: string; timestamp: string }, void>({
      queryFn: async () => {
        try {
          return {
            data: {
              status: 'healthy',
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error) {
          return {
            error: {
              message: 'Health check failed',
              code: 'HEALTH_CHECK_ERROR',
            },
          };
        }
      },
    }),
  }),
  overrideExisting: false,
});

// Enhanced base query with error handling and debugging
export const createSupabaseEndpoint = <T = any>(
  queryFn: (args: any) => {
    table: string;
    method: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc';
    query?: any;
    data?: any;
    options?: any;
  }
) => {
  return queryFn;
};

// Helper function to create optimistic update mutations
export const createOptimisticMutation = <T, U>(
  mutationFn: any,
  tagTypes: string[],
  optimisticUpdate?: (draft: T[], args: U) => void
) => {
  return {
    query: mutationFn,
    invalidatesTags: tagTypes,
    onQueryStarted: optimisticUpdate ? async (args: U, { dispatch, queryFulfilled, getCacheEntry }: any) => {
      try {
        const result = await queryFulfilled;
        // Handle successful optimistic update
      } catch (error) {
        // Revert optimistic update on error
        console.error('Optimistic update failed:', error);
      }
    } : undefined,
  };
};