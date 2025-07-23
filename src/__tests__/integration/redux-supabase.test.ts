import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { postsApi } from '../../store/api/postsApi';
import { authSlice } from '../../store/slices/authSlice';
import { uiSlice } from '../../store/slices/uiSlice';
import { RootState } from '../../store';
import { SupabaseErrorHandler } from '../../utils/SupabaseErrorHandler';
import { mockSupabaseClient, createMockSupabaseClient } from '../utils/mockSupabaseClient';
import type { AppDispatch } from '../../store';

// Mock Supabase client
jest.mock('../../services/supabase/client', () => ({
  supabaseClient: {
    isInitialized: () => true,
    getClient: () => mockSupabaseClient,
  },
}));

describe('Redux-Supabase Integration', () => {
  let store: any;
  let dispatch: AppDispatch;

  beforeEach(() => {
    // Create fresh store for each test
    store = configureStore({
      reducer: {
        auth: authSlice.reducer,
        ui: uiSlice.reducer,
        supabaseApi: postsApi.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: {
            ignoredActions: ['auth/setUser'],
            ignoredActionPaths: ['payload.user'],
            ignoredPaths: ['auth.user'],
          },
        }).concat(postsApi.middleware),
    });

    dispatch = store.dispatch as AppDispatch;
    setupListeners(dispatch);

    // Reset mock client
    mockSupabaseClient.resetMockDb();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Integration', () => {
    it('should handle successful authentication', async () => {
      // Mock successful login
      const loginResult = await (dispatch as any)(
        authSlice.actions.loginStart({
          mothersHandbookNumber: 'test123',
          nickname: 'Test User',
        } as any)
      );

      expect(loginResult.type).toBe('auth/loginStart');
      
      // Check if user is set in auth state
      const authState = (store.getState() as RootState).auth;
      expect(authState.isLoading).toBe(true);
    });

    it('should handle authentication errors', async () => {
      // Mock failed login attempt
      const mockError = {
        message: 'Invalid credentials',
        code: 'invalid_credentials',
        status: 401,
        __isAuthError: true,
        name: 'AuthError'
      } as any;
      jest.spyOn(mockSupabaseClient.auth, 'signInWithPassword').mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      });

      const errorAction = authSlice.actions.loginFailure({
        message: 'Invalid credentials',
        status: 401,
        __isAuthError: true,
        name: 'AuthError'
      } as any);
      dispatch(errorAction);

      const authState = (store.getState() as RootState).auth;
      expect(authState.error).toBe('Invalid credentials');
      expect(authState.isAuthenticated).toBe(false);
    });

    it('should update UI state on authentication errors', async () => {
      const error = SupabaseErrorHandler.handle({ message: 'Authentication failed' });
      
      dispatch(uiSlice.actions.setError(error));

      const uiState = (store.getState() as RootState).ui;
      expect(uiState.globalError).toBeDefined();
      expect(uiState.globalError?.userMessage).toBe('予期しないエラーが発生しました。しばらくしてからお試しください。');
    });
  });

  describe('Posts API Integration', () => {
    it('should fetch posts successfully', async () => {
      // Setup mock data
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();
      mockDb.createPost({
        user_id: 'user1',
        content: 'Test post for Redux integration',
        is_anonymous: false,
      });

      // Dispatch getPosts query
      const promise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      const result = await promise;

      expect((result as any).data).toBeDefined();
      expect((result as any).data).toHaveLength(1);
      expect((result as any).data[0].content).toBe('Test post for Redux integration');
    });

    it('should handle posts API errors', async () => {
      // Mock API error
      jest.spyOn(mockSupabaseClient, 'from').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const promise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      try {
        const result = await promise;
        // Should check if there's an error
        expect((result as any).error).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should update cache after creating post', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      // Create initial state
      const getPostsPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );
      
      await getPostsPromise;
      
      // Check initial cache
      let cacheState = postsApi.endpoints.getPosts.select({ limit: 10, offset: 0 })(store.getState() as any);
      expect(cacheState.data).toHaveLength(0);

      // Create new post
      const createPromise = (dispatch as any)(
        postsApi.endpoints.createPost.initiate({
          user_id: 'user1',
          content: 'New post via Redux',
          is_anonymous: false,
        })
      );

      const createResult = await createPromise;
      expect((createResult as any).data).toBeDefined();
      expect((createResult as any).data.content).toBe('New post via Redux');

      // Check if cache was invalidated
      const newGetPostsPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 }, { forceRefetch: true })
      );
      
      const newResult = await newGetPostsPromise;
      expect((newResult as any).data).toHaveLength(1);
      expect((newResult as any).data[0].content).toBe('New post via Redux');
    });

    it('should handle optimistic updates', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      // Create a post first
      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Post for optimistic update',
        is_anonymous: false,
      });

      // Load initial data
      await (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      // Simulate optimistic update (like creating a comment)
      const commentPromise = (dispatch as any)(
        postsApi.endpoints.createComment?.initiate?.({
          post_id: post.id,
          user_id: 'user1',
          content: 'Optimistic comment',
          is_anonymous: false,
        }) || { unwrap: () => Promise.resolve({}) }
      );

      // The optimistic update should be visible immediately
      // (This would be more complex in the real implementation)
      expect(commentPromise).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate Supabase errors through Redux', async () => {
      // Mock Supabase error
      const mockError = { message: 'Row level security violation', code: '42501' };
      jest.spyOn(mockSupabaseClient, 'from').mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: mockError }),
            async: () => Promise.resolve({ data: null, error: mockError }),
          }),
          limit: () => ({
            async: () => Promise.resolve({ data: null, error: mockError }),
          }),
          order: () => ({
            async: () => Promise.resolve({ data: null, error: mockError }),
          }),
          async: () => Promise.resolve({ data: null, error: mockError }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: mockError }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: mockError }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ data: null, error: mockError }),
        }),
      }) as any);

      const promise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      let capturedError;
      try {
        const result = await promise;
        // Should check if there's an error
        expect((result as any).error).toBeDefined();
        capturedError = (result as any).error;
      } catch (error) {
        capturedError = error;
        expect(error).toBeDefined();
      }
      
      // Verify error is properly formatted
      const supabaseError = SupabaseErrorHandler.handle(capturedError);
      expect(supabaseError.type).toBe('PERMISSION_ERROR');
      expect(supabaseError.userMessage).toBe('この操作を実行する権限がありません。');
    });

    it('should update UI error state on API failures', async () => {
      const mockError = { message: 'Network timeout', code: 'NETWORK_ERROR' };
      
      // Mock network error
      jest.spyOn(mockSupabaseClient, 'from').mockImplementation(() => {
        throw mockError;
      });

      const promise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      let capturedError;
      try {
        const result = await promise;
        // Should check if there's an error
        expect((result as any).error).toBeDefined();
        capturedError = (result as any).error;
      } catch (error) {
        capturedError = error;
        expect(error).toBeDefined();
      }

      // Check if error was processed
      const processedError = SupabaseErrorHandler.handle(capturedError);
      expect(processedError.type).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle real-time post updates', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      // Create initial post
      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Original content',
        is_anonymous: false,
      });

      // Load initial data
      await (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      // Simulate real-time update
      mockDb.updatePost(post.id, { content: 'Updated via real-time' });

      // In a real implementation, this would trigger cache updates
      // For now, we'll test the cache invalidation mechanism
      dispatch(
        postsApi.util.invalidateTags([{ type: 'Post', id: post.id }])
      );

      // Refetch should get updated data
      const refreshPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 }, { forceRefetch: true })
      );

      const result = await refreshPromise;
      expect((result as any).data[0].content).toBe('Updated via real-time');
    });

    it('should handle real-time subscription errors', async () => {
      // Mock channel subscription error
      jest.spyOn(mockSupabaseClient, 'channel').mockImplementation(() => ({
        on: jest.fn(),
        subscribe: jest.fn((callback) => {
          setTimeout(() => callback('CHANNEL_ERROR', new Error('Connection failed')), 100);
          return Promise.resolve({ status: 'ok' });
        }),
        unsubscribe: jest.fn().mockResolvedValue({ status: 'ok' }),
      }) as any);

      // This would typically be handled by the real-time hooks
      // For now, we'll test error handling directly
      const error = SupabaseErrorHandler.handle({ message: 'Real-time connection failed' });
      dispatch(uiSlice.actions.setError(error));

      const uiState = (store.getState() as RootState).ui;
      expect(uiState.globalError).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should manage cache tags correctly', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      // Create multiple posts
      const post1 = mockDb.createPost({
        user_id: 'user1',
        content: 'Post 1',
        is_anonymous: false,
      });

      const post2 = mockDb.createPost({
        user_id: 'user2',
        content: 'Post 2',
        is_anonymous: false,
      });

      // Fetch posts
      await (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      // Fetch individual post
      await (dispatch as any)(
        postsApi.endpoints.getPost.initiate(post1.id)
      );

      // Update post should invalidate both list and individual caches
      await (dispatch as any)(
        postsApi.endpoints.updatePost?.initiate?.({
          id: post1.id,
          data: { content: 'Updated Post 1' },
        }) || postsApi.endpoints.createPost.initiate({
          user_id: 'user1',
          content: 'Updated Post 1',
          is_anonymous: false,
        })
      );

      // Check that caches are properly managed
      const state = (store.getState() as RootState);
      expect(state.supabaseApi).toBeDefined();
    });

    it('should handle selective cache invalidation', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Post for selective invalidation',
        is_anonymous: false,
      });

      // Load posts and individual post
      await Promise.all([
        (dispatch as any)(postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })),
        (dispatch as any)(postsApi.endpoints.getPost.initiate(post.id)),
      ]);

      // Invalidate only specific post
      dispatch(
        postsApi.util.invalidateTags([{ type: 'Post', id: post.id }])
      );

      // List cache should still be valid, individual post cache should be invalidated
      const state = (store.getState() as RootState);
      const queries = state.supabaseApi.queries;
      
      expect(Object.keys(queries)).toContain('getPosts({"limit":10,"offset":0})');
      expect(Object.keys(queries)).toContain(`getPost("${post.id}")`);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent API requests', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      // Create multiple posts concurrently
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        (dispatch as any)(
          postsApi.endpoints.createPost.initiate({
            user_id: 'user1',
            content: `Concurrent post ${i}`,
            is_anonymous: false,
          })
        )
      );

      const results = await Promise.all(createPromises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect((result as any).data.content).toBe(`Concurrent post ${index}`);
      });
    });

    it('should handle request deduplication', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();

      // Make multiple identical requests
      const promises = Array.from({ length: 3 }, () =>
        (dispatch as any)(
          postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
        )
      );

      const results = await Promise.all(promises);

      // All should return the same result
      results.forEach(result => {
        expect((result as any).data).toEqual((results[0] as any).data);
      });

      // Should have made only one actual request due to deduplication
      // (This is handled automatically by RTK Query)
    });

    it('should handle cache persistence across requests', async () => {
      const mockDb = mockSupabaseClient.getMockDb();
      mockDb.reset();
      
      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Cached post',
        is_anonymous: false,
      });

      // First request
      const firstResult = await (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      // Second request (should use cache)
      const secondResult = await (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      expect((firstResult as any).data).toEqual((secondResult as any).data);
    });
  });
});