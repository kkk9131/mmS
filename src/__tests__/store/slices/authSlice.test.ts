import { configureStore } from '@reduxjs/toolkit';
import { 
  authSlice, 
  initialState as authInitialState,
  signInWithMaternalBook,
  signOut,
  getCurrentUser,
  updateUserProfile,
  clearError,
  setAuthSession,
  setUserProfile,
  resetAuth 
} from '../../../store/slices/authSlice';
import type { AuthState } from '../../../store/slices/authSlice';
import { RootState } from '../../../store';

// Mock the supabase auth module
jest.mock('../../../services/supabase/auth', () => ({
  supabaseAuth: {
    signInWithMaternalBook: jest.fn(),
    signOut: jest.fn(),
    getCurrentUser: jest.fn(),
    getCurrentSession: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
  },
}));

describe('Auth Slice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authSlice.reducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = (store.getState() as RootState).auth as AuthState;
      
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isInitialized).toBe(false);
    });
  });

  describe('Synchronous Actions', () => {
    it('should handle clearError', () => {
      // Set an error first
      store.dispatch(setAuthSession({ user: null, session: null }));
      store.dispatch(authSlice.actions.clearError());
      
      const state = (store.getState() as RootState).auth as AuthState;
      expect(state.error).toBeNull();
    });

    it('should handle setAuthSession', () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      } as any;
      
      const mockSession = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        expires_at: Date.now() + 3600,
      } as any;

      store.dispatch(setAuthSession({ user: mockUser, session: mockSession }));
      
      const state = (store.getState() as RootState).auth as AuthState;
      expect(state.user).toEqual(mockUser);
      expect(state.session).toEqual(mockSession);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle setUserProfile', () => {
      const mockProfile = {
        id: 'user123',
        nickname: 'Test User',
        maternal_book_number: 'test123',
        avatar_url: 'https://example.com/avatar.png',
        bio: null,
        is_anonymous: false,
        privacy_settings: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      store.dispatch(setUserProfile(mockProfile));
      
      const state = (store.getState() as RootState).auth as AuthState;
      expect(state.profile).toEqual(mockProfile);
    });

    it('should handle resetAuth', () => {
      // Set some auth data first
      const mockUser = { id: 'user123' } as any;
      const mockSession = { access_token: 'token123' } as any;
      const mockProfile = { id: 'user123', nickname: 'Test' } as any;

      store.dispatch(setAuthSession({ user: mockUser, session: mockSession }));
      store.dispatch(setUserProfile(mockProfile));
      
      // Reset
      store.dispatch(resetAuth());
      
      const state = (store.getState() as RootState).auth as AuthState;
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Async Thunks', () => {
    const { supabaseAuth } = require('../../../services/supabase/auth');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('signInWithMaternalBook', () => {
      it('should handle successful sign in', async () => {
        const mockUser = { id: 'user123', email: 'test@example.com' } as any;
        const mockSession = { access_token: 'token123' } as any;
        const mockProfile = { id: 'user123', nickname: 'Test User' } as any;

        supabaseAuth.signInWithMaternalBook.mockResolvedValue({
          user: mockUser,
          session: mockSession,
          error: null,
        });
        supabaseAuth.getUserProfile.mockResolvedValue(mockProfile);

        await store.dispatch(signInWithMaternalBook({
          mothersHandbookNumber: 'test123',
          nickname: 'Test User',
        }));

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.user).toEqual(mockUser);
        expect(state.session).toEqual(mockSession);
        expect(state.profile).toEqual(mockProfile);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should handle sign in failure', async () => {
        const mockError = {
          message: 'Invalid login credentials',
          name: 'AuthError',
          status: 400,
        };

        supabaseAuth.signInWithMaternalBook.mockResolvedValue({
          user: null,
          session: null,
          error: mockError,
        });

        await store.dispatch(signInWithMaternalBook({
          mothersHandbookNumber: 'test123',
          nickname: 'Test User',
        }));

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.user).toBeNull();
        expect(state.session).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('認証に失敗しました。母子手帳番号とニックネームを確認してください。');
      });
    });

    describe('signOut', () => {
      it('should handle successful sign out', async () => {
        supabaseAuth.signOut.mockResolvedValue({ error: null });

        await store.dispatch(signOut());

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.user).toBeNull();
        expect(state.session).toBeNull();
        expect(state.profile).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
      });

      it('should handle sign out failure', async () => {
        const errorMessage = 'Sign out failed';
        supabaseAuth.signOut.mockResolvedValue({ 
          error: { message: errorMessage } 
        });

        await store.dispatch(signOut());

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(errorMessage);
      });
    });

    describe('getCurrentUser', () => {
      it('should handle successful user retrieval', async () => {
        const mockUser = { id: 'user123' } as any;
        const mockSession = { access_token: 'token123' } as any;
        const mockProfile = { id: 'user123', nickname: 'Test' } as any;

        supabaseAuth.getCurrentUser.mockResolvedValue(mockUser);
        supabaseAuth.getCurrentSession.mockResolvedValue(mockSession);
        supabaseAuth.getUserProfile.mockResolvedValue(mockProfile);

        await store.dispatch(getCurrentUser());

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.user).toEqual(mockUser);
        expect(state.session).toEqual(mockSession);
        expect(state.profile).toEqual(mockProfile);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isInitialized).toBe(true);
      });

      it('should handle no current user', async () => {
        supabaseAuth.getCurrentUser.mockResolvedValue(null);
        supabaseAuth.getCurrentSession.mockResolvedValue(null);

        await store.dispatch(getCurrentUser());

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.user).toBeNull();
        expect(state.session).toBeNull();
        expect(state.profile).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isInitialized).toBe(true);
      });
    });

    describe('updateUserProfile', () => {
      it('should handle successful profile update', async () => {
        const updates = { nickname: 'New Nickname' };
        const updatedProfile = {
          id: 'user123',
          nickname: 'New Nickname',
          email: 'test@example.com',
        } as any;

        supabaseAuth.updateUserProfile.mockResolvedValue({ error: null });
        supabaseAuth.getUserProfile.mockResolvedValue(updatedProfile);

        await store.dispatch(updateUserProfile(updates));

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.profile).toEqual(updatedProfile);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should handle profile update failure', async () => {
        const updates = { nickname: 'New Nickname' };
        const errorMessage = 'Update failed';

        supabaseAuth.updateUserProfile.mockResolvedValue({ 
          error: { message: errorMessage } 
        });

        await store.dispatch(updateUserProfile(updates));

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(errorMessage);
      });
    });
  });

  describe('Loading States', () => {
    const { supabaseAuth } = require('../../../services/supabase/auth');

    it('should set loading state during signInWithMaternalBook', async () => {
      let resolvePromise: any;
      
      supabaseAuth.signInWithMaternalBook.mockImplementation(() => 
        new Promise(resolve => {
          resolvePromise = resolve;
        })
      );

      const promise = store.dispatch(signInWithMaternalBook({
        mothersHandbookNumber: 'test123',
        nickname: 'Test User',
      }));

      // Check loading state immediately
      let state = (store.getState() as RootState).auth as AuthState;
      expect(state.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise({
        user: null,
        session: null,
        error: null,
      });

      await promise;

      // Check loading state after completion
      state = (store.getState() as RootState).auth as AuthState;
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    const { supabaseAuth } = require('../../../services/supabase/auth');

    it('should map various auth errors to user-friendly messages', async () => {
      const errorCases = [
        {
          error: { message: 'Invalid login credentials' },
          expectedMessage: '認証に失敗しました。母子手帳番号とニックネームを確認してください。',
        },
        {
          error: { message: 'Email not confirmed' },
          expectedMessage: 'メールアドレスが確認されていません。',
        },
        {
          error: { message: 'Too many requests' },
          expectedMessage: 'リクエストが多すぎます。しばらくしてからお試しください。',
        },
        {
          error: { message: 'Network error' },
          expectedMessage: 'ネットワークエラーが発生しました。接続を確認してください。',
        },
        {
          error: { message: 'Connection timeout' },
          expectedMessage: '接続がタイムアウトしました。もう一度お試しください。',
        },
        {
          error: { message: 'Unknown error' },
          expectedMessage: '認証エラーが発生しました。もう一度お試しください。',
        },
      ];

      for (const { error, expectedMessage } of errorCases) {
        supabaseAuth.signInWithMaternalBook.mockResolvedValue({
          user: null,
          session: null,
          error,
        });

        await store.dispatch(signInWithMaternalBook({
          mothersHandbookNumber: 'test123',
          nickname: 'Test User',
        }));

        const state = (store.getState() as RootState).auth as AuthState;
        expect(state.error).toBe(expectedMessage);
      }
    });
  });
});