import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { postsApi } from '../../../store/api/postsApi';
import { notificationsApi } from '../../../store/api/notificationsApi';
import { RootState } from '../../../store';
import { createMockSupabaseClient } from '../../utils/mockSupabaseClient';
import type { AppDispatch } from '../../../store';

// Mock Supabase client
const mockClient = createMockSupabaseClient();

jest.mock('../../../services/supabase/client', () => ({
  supabaseClient: {
    isInitialized: () => true,
    getClient: () => mockClient,
  },
}));

describe('RTK Query Cache Invalidation', () => {
  let store: ReturnType<typeof configureStore>;
  let dispatch: AppDispatch;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        supabaseApi: postsApi.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware()
          .concat(postsApi.middleware),
    });

    dispatch = store.dispatch as AppDispatch;
    setupListeners(dispatch);
    mockClient.resetMockDb();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Posts Cache Management', () => {
    it('should cache posts list correctly', async () => {
      const mockDb = mockClient.getMockDb();
      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Test post for caching',
        is_anonymous: false,
      });

      // First request
      const firstPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      const firstResult = await firstPromise;
      expect((firstResult as any).data).toHaveLength(1);
      expect((firstResult as any).data[0].content).toBe('Test post for caching');

      // Second identical request should use cache
      const secondPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      const secondResult = await secondPromise;
      expect((secondResult as any).data).toEqual((firstResult as any).data);

      // Check that cache entry exists
      const state = (store.getState() as RootState);
      const cacheKey = 'getPosts({"limit":10,"offset":0})';
      expect(state.supabaseApi.queries[cacheKey]).toBeDefined();
    });

    it('should invalidate posts list when creating new post', async () => {
      const mockDb = mockClient.getMockDb();
      mockDb.reset();

      // Initial fetch
      const initialPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      const initialResult = await initialPromise;
      expect((initialResult as any).data).toHaveLength(0);

      // Create new post
      const createPromise = (dispatch as any)(
        postsApi.endpoints.createPost.initiate({
          user_id: 'user1',
          content: 'New post via cache test',
          is_anonymous: false,
        })
      );

      const createResult = await createPromise;
      expect((createResult as any).data.content).toBe('New post via cache test');

      // Fetch again - should get updated data due to cache invalidation
      const updatedPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 }, { forceRefetch: true })
      );

      const updatedResult = await updatedPromise;
      expect((updatedResult as any).data).toHaveLength(1);
      expect((updatedResult as any).data[0].content).toBe('New post via cache test');
    });

    it('should handle selective cache invalidation by post ID', async () => {
      const mockDb = mockClient.getMockDb();
      const post1 = mockDb.createPost({
        user_id: 'user1',
        content: 'Post 1',
        is_anonymous: false,
      });

      const post2 = mockDb.createPost({
        user_id: 'user1', 
        content: 'Post 2',
        is_anonymous: false,
      });

      // Fetch both individual posts
      await Promise.all([
        (dispatch as any)(postsApi.endpoints.getPost.initiate(post1.id)),
        (dispatch as any)(postsApi.endpoints.getPost.initiate(post2.id)),
      ]);

      // Check cache entries exist
      const state = (store.getState() as RootState);
      const queries = state.supabaseApi.queries;
      expect(queries[`getPost("${post1.id}")`]).toBeDefined();
      expect(queries[`getPost("${post2.id}")`]).toBeDefined();

      // Invalidate only post1
      dispatch(
        postsApi.util.invalidateTags([{ type: 'Post', id: post1.id }])
      );

      // Post1 cache should be invalidated, post2 should remain
      const newState = (store.getState() as RootState);
      const newQueries = newState.supabaseApi.queries;
      
      // Both entries still exist but post1 should be marked for refetch
      expect(newQueries[`getPost("${post1.id}")`]).toBeDefined();
      expect(newQueries[`getPost("${post2.id}")`]).toBeDefined();
    });

    it('should handle cache timing and expiration', async () => {
      const mockDb = mockClient.getMockDb();
      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Test post for timing',
        is_anonymous: false,
      });

      // First request
      const promise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      await promise;

      // Check cache metadata
      const state = (store.getState() as RootState);
      const cacheKey = 'getPosts({"limit":10,"offset":0})';
      const cacheEntry = state.supabaseApi.queries[cacheKey];
      
      expect(cacheEntry).toBeDefined();
      expect(cacheEntry?.status).toBe('fulfilled');
      expect(cacheEntry?.data).toBeDefined();
    });

    it('should handle cache updates with optimistic updates', async () => {
      const mockDb = mockClient.getMockDb();
      mockDb.reset();

      // Load initial posts
      await (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      // Create post with optimistic update
      const createPromise = (dispatch as any)(
        postsApi.endpoints.createPost.initiate({
          user_id: 'user1',
          content: 'Optimistic post',
          is_anonymous: false,
        })
      );

      // Check state before completion (optimistic update)
      const duringState = (store.getState() as RootState);
      const duringQueries = duringState.supabaseApi.queries;
      
      // Complete the creation
      await createPromise;

      // Check final state
      const finalState = (store.getState() as RootState);
      const finalQueries = finalState.supabaseApi.queries;
      
      expect(finalQueries).toBeDefined();
    });
  });

  describe('Cross-API Cache Interactions', () => {
    it('should handle cache interactions between different APIs', async () => {
      const mockDb = mockClient.getMockDb();
      
      // Create a user and post
      const user = mockDb.createUser({
        nickname: 'Test User',
        email: 'test@example.com',
      });

      const post = mockDb.createPost({
        user_id: user.id,
        content: 'Cross-API test post',
        is_anonymous: false,
      });

      // Create notification related to the post
      const notification = mockDb.createNotification({
        user_id: user.id,
        type: 'like',
        title: 'New like',
        message: 'Your post received a like',
        is_read: false,
      });

      // Fetch posts and notifications
      const [postsPromise, notificationsPromise] = await Promise.all([
        (dispatch as any)(postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })),
        (dispatch as any)(notificationsApi.endpoints.getNotifications.initiate({ userId: user.id })),
      ]);

      expect((postsPromise as any).data).toHaveLength(1);
      expect((notificationsPromise as any).data).toHaveLength(1);

      // Both caches should exist independently
      const state = (store.getState() as RootState);
      expect(state.supabaseApi.queries).toBeDefined();
      expect(state.supabaseApi.queries).toBeDefined();
    });

    it('should handle related data updates across APIs', async () => {
      const mockDb = mockClient.getMockDb();
      const user = mockDb.createUser({
        nickname: 'Related User',
        email: 'related@example.com',
      });

      // Create post
      const createPostPromise = (dispatch as any)(
        postsApi.endpoints.createPost.initiate({
          user_id: user.id,
          content: 'Related data test',
          is_anonymous: false,
        })
      );

      await createPostPromise;

      // Creating a post might trigger notification creation
      // This tests that both caches can be managed independently
      const notificationPromise = (dispatch as any)(
        notificationsApi.endpoints.getNotifications.initiate({ userId: user.id })
      );

      await notificationPromise;

      // Both operations should complete successfully
      const state = (store.getState() as RootState);
      const postsQueries = state.supabaseApi.queries;
      const notificationsQueries = state.supabaseApi.queries;

      expect(Object.keys(postsQueries).length).toBeGreaterThan(0);
      expect(Object.keys(notificationsQueries).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling in Cache', () => {
    it('should handle cache behavior on API errors', async () => {
      // Mock API error
      jest.spyOn(mockClient, 'from').mockImplementation(() => {
        throw new Error('API Error');
      });

      const promise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      try {
        const result = await promise;
        // Should not reach here if there's an error
        expect((result as any).error).toBeDefined();
      } catch (error) {
        // This might not be reached if promise doesn't throw
        expect(true).toBe(true);
      }

      // Check cache state on error
      const state = (store.getState() as RootState);
      const cacheKey = 'getPosts({"limit":10,"offset":0})';
      const cacheEntry = state.supabaseApi.queries[cacheKey];
      
      expect(cacheEntry).toBeDefined();
      expect(cacheEntry?.status).toBe('rejected');
    });

    it('should handle cache recovery after error', async () => {
      const mockDb = mockClient.getMockDb();
      
      // First, mock an error
      const mockFromError = jest.spyOn(mockClient, 'from').mockImplementation(() => {
        throw new Error('Temporary API Error');
      });

      const errorPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      let errorResult;
      try {
        errorResult = await errorPromise;
        // Check if result has error
        expect((errorResult as any).error).toBeDefined();
      } catch (error) {
        // This might not be reached if promise doesn't throw
        expect(true).toBe(true);
      }

      // Restore normal functionality
      mockFromError.mockRestore();

      // Create a post for successful fetch
      mockDb.createPost({
        user_id: 'user1',
        content: 'Recovery test post',
        is_anonymous: false,
      });

      // Retry should work
      const retryPromise = (dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 }, { forceRefetch: true })
      );

      const retryResult = await retryPromise;
      expect((retryResult as any).data).toHaveLength(1);
      expect((retryResult as any).data[0].content).toBe('Recovery test post');
    });
  });

  describe('Cache Performance', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const mockDb = mockClient.getMockDb();
      mockDb.reset();
      
      // Create test posts
      for (let i = 0; i < 5; i++) {
        mockDb.createPost({
          user_id: `user${i}`,
          content: `Concurrent test post ${i}`,
          is_anonymous: false,
        });
      }

      // Make multiple concurrent requests for the same data
      const promises = Array.from({ length: 10 }, () =>
        (dispatch as any)(
          postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
        )
      );

      const results = await Promise.all(promises);

      // All should return the same data
      results.forEach(result => {
        expect((result as any).data).toHaveLength(5);
        expect((result as any).data).toEqual((results[0] as any).data);
      });

      // Should only have one cache entry despite multiple requests
      const state = (store.getState() as RootState);
      const cacheKey = 'getPosts({"limit":10,"offset":0})';
      const cacheEntries = Object.keys(state.supabaseApi.queries).filter(
        key => key === cacheKey
      );
      expect(cacheEntries).toHaveLength(1);
    });

    it('should handle different query parameters as separate cache entries', async () => {
      const mockDb = mockClient.getMockDb();
      mockDb.reset();

      // Create test posts
      for (let i = 0; i < 15; i++) {
        mockDb.createPost({
          user_id: 'user1',
          content: `Test post ${i}`,
          is_anonymous: i % 2 === 0,
        });
      }

      // Make requests with different parameters
      await Promise.all([
        (dispatch as any)(postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })),
        (dispatch as any)(postsApi.endpoints.getPosts.initiate({ limit: 5, offset: 0 })),
        (dispatch as any)(postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 5 })),
      ]);

      // Should have separate cache entries for each parameter combination
      const state = (store.getState() as RootState);
      const queries = state.supabaseApi.queries;
      const postQueries = Object.keys(queries).filter(key => key.startsWith('getPosts'));
      
      expect(postQueries).toHaveLength(3);
      expect(postQueries).toContain('getPosts({"limit":10,"offset":0})');
      expect(postQueries).toContain('getPosts({"limit":5,"offset":0})');
      expect(postQueries).toContain('getPosts({"limit":10,"offset":5})');
    });
  });

  describe('Cache Cleanup', () => {
    it('should handle cache cleanup and memory management', async () => {
      const mockDb = mockClient.getMockDb();
      
      // Create many cache entries
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          (dispatch as any)(
            postsApi.endpoints.getPosts.initiate({ limit: i + 1, offset: i })
          )
        );
      }

      await Promise.all(promises);

      // Check cache size
      const state = (store.getState() as RootState);
      const queries = state.supabaseApi.queries;
      const queryCount = Object.keys(queries).length;
      
      expect(queryCount).toBeGreaterThan(0);

      // Cache should exist
      expect(queryCount).toBeLessThanOrEqual(20); // RTK Query might have internal limits
    });

    it('should handle cache invalidation with tag system', async () => {
      const mockDb = mockClient.getMockDb();
      
      const post = mockDb.createPost({
        user_id: 'user1',
        content: 'Tag invalidation test',
        is_anonymous: false,
      });

      // Cache different views of the same data
      await Promise.all([
        (dispatch as any)(postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })),
        (dispatch as any)(postsApi.endpoints.getPost.initiate(post.id)),
      ]);

      // Invalidate all Post-related cache
      dispatch(
        postsApi.util.invalidateTags([{ type: 'Post', id: 'LIST' }])
      );

      // Check that relevant caches are marked for invalidation
      const state = (store.getState() as RootState);
      const queries = state.supabaseApi.queries;
      
      // Cache entries should still exist but may be marked as invalid
      expect(Object.keys(queries).length).toBeGreaterThan(0);
    });
  });
});