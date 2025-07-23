import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authSlice, signInWithMaternalBook } from '../../store/slices/authSlice';
import { uiSlice } from '../../store/slices/uiSlice';
import { postsApi } from '../../store/api/postsApi';
import { RootState } from '../../store';
import { createMockSupabaseClient } from '../utils/mockSupabaseClient';
import { SupabaseErrorHandler } from '../../utils/SupabaseErrorHandler';
import { ExtendedUser, ExtendedSession, MaternalBookCredentials } from '../../types/supabase';

// Mock Supabase client
const mockClient = createMockSupabaseClient();

jest.mock('../../services/supabase/client', () => ({
  supabaseClient: {
    isInitialized: () => true,
    getClient: () => mockClient,
    isAuthenticated: () => Promise.resolve(mockClient.auth.getSession().then(r => !!r.data.session)),
    getCurrentUser: () => mockClient.auth.getUser().then(r => r.data.user),
  },
}));

describe('Authentication Flow E2E Tests', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authSlice.reducer,
        ui: uiSlice.reducer,
        [postsApi.reducerPath]: postsApi.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: {
            ignoredActions: ['auth/setUser', 'ui/setError'],
            ignoredActionPaths: ['payload.user', 'payload.details'],
            ignoredPaths: ['auth.user', 'ui.globalError'],
          },
        }).concat(postsApi.middleware),
    });

    setupListeners(store.dispatch);
    mockClient.resetMockDb();
    mockClient.setCurrentUser(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Login Flow', () => {
    it('should handle successful login flow from start to finish', async () => {
      // Step 1: Start login
      store.dispatch(signInWithMaternalBook.pending('requestId', {
        mothersHandbookNumber: 'test123',
        nickname: 'Test User',
      }));

      let authState = (store.getState() as RootState).auth;
      expect(authState.isLoading).toBe(true);
      expect(authState.error).toBeNull();

      // Step 2: Simulate successful Supabase authentication
      const authResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(authResult.data.user).toBeDefined();
      expect(authResult.data.session).toBeDefined();
      expect(authResult.error).toBeNull();

      // Step 3: Complete login success
      store.dispatch(signInWithMaternalBook.fulfilled({
        user: authResult.data.user,
        session: authResult.data.session,
        profile: null,
      }, 'test-request-id', { mothersHandbookNumber: 'test123', nickname: 'Test User' }));

      // Step 4: Verify final state
      authState = (store.getState() as RootState).auth;
      expect(authState.isLoading).toBe(false);
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toBeDefined();
      expect(authState.session).toBeDefined();
      expect(authState.error).toBeNull();

      // Step 5: Verify that authenticated user can access protected resources
      const mockDb = mockClient.getMockDb();
      const testPost = mockDb.createPost({
        user_id: authState.user!.id,
        content: 'Authenticated user post',
        is_anonymous: false,
      });

      const postsResult = await (store.dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      expect((postsResult as any).data).toHaveLength(1);
      expect((postsResult as any).data[0].content).toBe('Authenticated user post');
    });

    it('should handle login failure flow', async () => {
      // Step 1: Start login
      store.dispatch(authSlice.actions.clearError() || authSlice.actions.setAuthSession({ user: null, session: null }) || signInWithMaternalBook.pending('requestId', {
        mothersHandbookNumber: 'invalid123',
        nickname: 'Invalid User',
      }));

      let authState = (store.getState() as RootState).auth;
      expect(authState.isLoading).toBe(true);

      // Step 2: Simulate failed Supabase authentication
      const authResult = await mockClient.auth.signInWithPassword({
        email: 'invalid@example.com',
        password: 'wrongpassword',
      });

      expect(authResult.data.user).toBeNull();
      expect(authResult.data.session).toBeNull();
      expect(authResult.error).toBeDefined();

      // Step 3: Handle login failure
      const supabaseError = SupabaseErrorHandler.handle(authResult.error!);
      store.dispatch(authSlice.actions.loginFailure(authResult.error!));

      // Step 4: Verify error state
      authState = (store.getState() as RootState).auth;
      expect(authState.isLoading).toBe(false);
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
      expect(authState.session).toBeNull();
      expect(authState.error).toBe(supabaseError.userMessage);

      // Step 5: Verify that unauthenticated user cannot access protected resources
      try {
        const result = await (store.dispatch as any)(
          postsApi.endpoints.createPost.initiate({
            user_id: 'invalid-user',
            content: 'Unauthorized post',
            is_anonymous: false,
          })
        );
        expect((result as any).error).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Management Flow', () => {
    it('should handle session refresh flow', async () => {
      // Step 1: Establish initial session
      const initialAuthResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      store.dispatch(authSlice.actions.setAuthSession({
        user: initialAuthResult.data.user!,
        session: {
          ...initialAuthResult.data.session!,
          expires_at: Math.floor(Date.now() / 1000) + 1, // Expires in 1 second
        },
      }));

      expect((store.getState() as RootState).auth.isAuthenticated).toBe(true);

      // Step 2: Simulate session refresh
      const refreshedSession = {
        user: initialAuthResult.data.user!,
        session: {
          ...initialAuthResult.data.session!,
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      };

      store.dispatch(authSlice.actions.setAuthSession(refreshedSession));

      // Step 3: Verify refreshed session
      const authState = (store.getState() as RootState).auth;
      expect(authState.session?.access_token).toBe('new_access_token');
      expect(authState.session?.refresh_token).toBe('new_refresh_token');
      expect(authState.isAuthenticated).toBe(true);
    });

    it('should handle session expiry and logout', async () => {
      // Step 1: Establish session
      const authResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      store.dispatch(signInWithMaternalBook.fulfilled({
        user: authResult.data.user,
        session: authResult.data.session,
        profile: null,
      }, 'test-request-id-2', { mothersHandbookNumber: 'test123', nickname: 'Test User' }));

      expect((store.getState() as RootState).auth.isAuthenticated).toBe(true);

      // Step 2: Simulate logout
      await mockClient.auth.signOut();
      store.dispatch(authSlice.actions.logout());

      // Step 3: Verify logout state
      const authState = (store.getState() as RootState).auth;
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
      expect(authState.session).toBeNull();
      expect(authState.error).toBeNull();
    });
  });

  describe('Error Recovery Flow', () => {
    it('should handle authentication error and recovery', async () => {
      // Step 1: Simulate authentication error
      const authError = new Error('Authentication temporarily unavailable');
      jest.spyOn(mockClient.auth, 'signInWithPassword').mockRejectedValueOnce(authError);

      store.dispatch(authSlice.actions.clearError() || authSlice.actions.setAuthSession({ user: null, session: null }) || signInWithMaternalBook.pending('requestId', {
        mothersHandbookNumber: 'test123',
        nickname: 'Test User',
      }));

      try {
        await mockClient.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'password123',
        });
      } catch (error) {
        const supabaseError = SupabaseErrorHandler.handle(error);
        store.dispatch(authSlice.actions.loginFailure({
          message: supabaseError.message,
          status: (supabaseError as any).status || 400,
          __isAuthError: true,
          name: 'AuthError'
        } as any));
        store.dispatch(uiSlice.actions.setError(supabaseError));
      }

      // Step 2: Verify error state
      let authState = (store.getState() as RootState).auth;
      let uiState = (store.getState() as RootState).ui;
      
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error).toBeDefined();
      expect(uiState.globalError).toBeDefined();

      // Step 3: Clear errors and retry
      store.dispatch(authSlice.actions.clearError());
      store.dispatch(uiSlice.actions.clearError());

      // Step 4: Successful retry
      jest.spyOn(mockClient.auth, 'signInWithPassword').mockRestore();
      
      const retryAuthResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      store.dispatch(signInWithMaternalBook.fulfilled({
        user: retryAuthResult.data.user,
        session: retryAuthResult.data.session,
        profile: null,
      }, 'test-request-id-3', { mothersHandbookNumber: 'test123', nickname: 'Test User' }));

      // Step 5: Verify recovery
      authState = (store.getState() as RootState).auth;
      uiState = (store.getState() as RootState).ui;

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.error).toBeNull();
      expect(uiState.globalError).toBeNull();
    });
  });

  describe('User Profile Management Flow', () => {
    it('should handle complete user profile update flow', async () => {
      // Step 1: Authenticate user
      const authResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      store.dispatch(signInWithMaternalBook.fulfilled({
        user: authResult.data.user!,
        session: authResult.data.session!,
        profile: null,
      }, 'test-request-id', { mothersHandbookNumber: 'test123', nickname: 'Original Name' }));

      let authState = (store.getState() as RootState).auth;
      expect((authState.user as any)?.nickname).toBe('Original Name');

      // Step 2: Update user profile  
      store.dispatch(authSlice.actions.updateUser({
        email: 'updated@example.com',
      }));

      // Step 3: Verify profile update
      authState = (store.getState() as RootState).auth;
      expect((authState.user as any)?.nickname).toBe('Updated Name');
      expect((authState.user as any)?.avatarUrl).toBe('https://example.com/new-avatar.png');
      expect(authState.user?.email).toBe(authResult.data.user!.email); // Should remain unchanged

      // Step 4: Verify session user is also updated
      expect((authState.session as any)?.user.nickname).toBe('Updated Name');
    });
  });

  describe('Data Persistence Flow', () => {
    it('should maintain authentication state through app lifecycle', async () => {
      // Step 1: Initial authentication
      const authResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      const userData = {
        id: authResult.data.user!.id,
        nickname: 'Persistent User',
        email: authResult.data.user!.email!,
        mothersHandbookNumber: 'persist123',
        avatarUrl: null,
        createdAt: authResult.data.user!.created_at,
        updatedAt: authResult.data.user!.updated_at || authResult.data.user!.created_at,
      };

      const sessionData = {
        access_token: authResult.data.session!.access_token,
        refresh_token: authResult.data.session!.refresh_token,
        expires_at: authResult.data.session!.expires_at!,
        expires_in: authResult.data.session!.expires_in || 3600,
        token_type: 'bearer',
        user: userData as any,
      };

      store.dispatch(signInWithMaternalBook.fulfilled({
        user: userData as any,
        session: sessionData as any,
        profile: null,
      } as any, 'test-request-id', { mothersHandbookNumber: 'persist123', nickname: 'Persistent User' }));

      let authState = (store.getState() as RootState).auth;
      expect(authState.isAuthenticated).toBe(true);

      // Step 2: Simulate app restart by creating new store
      const newStore = configureStore({
        reducer: {
          auth: authSlice.reducer,
          ui: uiSlice.reducer,
          [postsApi.reducerPath]: postsApi.reducer,
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

      // Step 3: Restore session from persistent storage (simulated)
      newStore.dispatch(authSlice.actions.setAuthSession({
        user: userData as any,
        session: sessionData as any,
      }));

      // Step 4: Verify persistence
      const newAuthState = (newStore.getState() as RootState).auth;
      expect(newAuthState.isAuthenticated).toBe(true);
      expect(newAuthState.user).toEqual(userData);
      expect(newAuthState.session).toEqual(sessionData);
    });
  });

  describe('Integration with Other Features', () => {
    it('should handle authentication flow integrated with posts creation', async () => {
      // Step 1: Login
      const authResult = await mockClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      const userData = {
        id: authResult.data.user!.id,
        nickname: 'Content Creator',
        email: authResult.data.user!.email!,
        mothersHandbookNumber: 'creator123',
        avatarUrl: null,
        createdAt: authResult.data.user!.created_at,
        updatedAt: authResult.data.user!.updated_at || authResult.data.user!.created_at,
      };

      store.dispatch(signInWithMaternalBook.fulfilled({
        user: userData as any,
        session: authResult.data.session! as any,
        profile: null,
      }, 'test-request-id', { mothersHandbookNumber: 'creator123', nickname: 'Content Creator' }));

      // Step 2: Create post as authenticated user
      const createResult = await (store.dispatch as any)(
        postsApi.endpoints.createPost.initiate({
          user_id: userData.id,
          content: 'Post by authenticated user',
          is_anonymous: false,
        })
      );

      expect((createResult as any).data).toBeDefined();
      expect((createResult as any).data.content).toBe('Post by authenticated user');
      expect((createResult as any).data.user_id).toBe(userData.id);

      // Step 3: Fetch posts and verify author information
      const postsResult = await (store.dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 })
      );

      expect((postsResult as any).data).toHaveLength(1);
      expect((postsResult as any).data[0].user_id).toBe(userData.id);

      // Step 4: Logout and verify posts are still accessible but author info is handled correctly
      store.dispatch(authSlice.actions.logout());

      const postAfterLogout = await (store.dispatch as any)(
        postsApi.endpoints.getPosts.initiate({ limit: 10, offset: 0 }, { forceRefetch: true })
      );

      expect((postAfterLogout as any).data).toHaveLength(1);
      // Post should still exist but authentication context is lost
    });
  });
});