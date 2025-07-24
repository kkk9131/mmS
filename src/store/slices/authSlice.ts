import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { User as DatabaseUser } from '../../types/supabase';
import { supabaseAuth, MaternalBookCredentials, AuthResult } from '../../services/supabase/auth';
import { AuthService } from '../../services/api/auth';
import { FeatureFlagsManager } from '../../services/featureFlags';

// Helper function to convert auth errors to user-friendly messages
const getAuthErrorMessage = (error: AuthError): string => {
  switch (error.message) {
    case 'Invalid login credentials':
    case 'Invalid credentials':
      return '認証に失敗しました。母子手帳番号とニックネームを確認してください。';
    case 'Email not confirmed':
      return 'メールアドレスが確認されていません。';
    case 'Too many requests':
      return 'リクエストが多すぎます。しばらくしてからお試しください。';
    case 'Network error':
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    case 'Signup requires a valid password':
      return '無効な認証情報です。';
    default:
      if (error.message.includes('timeout')) {
        return '接続がタイムアウトしました。もう一度お試しください。';
      }
      return '認証エラーが発生しました。もう一度お試しください。';
  }
};

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,
};

// Async thunks
export const signInWithMaternalBook = createAsyncThunk(
  'auth/signInWithMaternalBook',
  async (credentials: MaternalBookCredentials, { rejectWithValue }) => {
    try {
      const featureFlags = FeatureFlagsManager.getInstance();
      
      if (featureFlags.isDebugModeEnabled()) {
        console.log('🔑 authSlice signInWithMaternalBook 開始');
        console.log('フィーチャーフラグ設定:', {
          isSupabaseEnabled: featureFlags.isSupabaseEnabled(),
          isApiEnabled: featureFlags.isApiEnabled(),
          isReduxEnabled: featureFlags.isReduxEnabled(),
          isDebugModeEnabled: featureFlags.isDebugModeEnabled()
        });
        console.log('認証情報:', credentials);
      }
      
      if (featureFlags.isSupabaseEnabled()) {
        console.log('🔵 Supabase認証を使用');
        
        try {
          // Use Supabase authentication
          const result: AuthResult = await supabaseAuth.signInWithMaternalBook(credentials);
          console.log('Supabase認証結果:', result);
          
          if (result.error) {
            console.log('❌ Supabase認証エラー:', result.error);
            // Map Supabase errors to user-friendly messages
            const errorMessage = getAuthErrorMessage(result.error);
            return rejectWithValue(errorMessage);
          }

          // Get user profile
          const profile = await supabaseAuth.getUserProfile();
          console.log('✅ Supabase認証成功, プロフィール:', profile);
          
          return {
            user: result.user,
            session: result.session,
            profile,
          };
        } catch (supabaseError) {
          console.error('💥 Supabase認証でエラー発生:', supabaseError);
          throw supabaseError;
        }
      } else {
        console.log('🟡 モック認証を使用');
        try {
          // Use mock authentication via AuthService
          const authService = AuthService.getInstance();
          const mockCredentials = {
            maternalBookNumber: credentials.mothersHandbookNumber,
            nickname: credentials.nickname,
          };
          
          console.log('モック認証の認証情報:', mockCredentials);
          const result = await authService.login(mockCredentials);
          console.log('✅ モック認証成功:', result);
        
          // Convert mock response to expected format
          const convertedResult = {
            user: {
              id: result.user.id,
              email: `${result.user.id}@mock.local`,
              app_metadata: {},
              user_metadata: { nickname: result.user.nickname },
              aud: 'authenticated',
              created_at: result.user.createdAt,
            } as User,
            session: {
              access_token: result.accessToken,
              refresh_token: result.refreshToken,
              expires_in: 3600,
              token_type: 'bearer',
              user: {
                id: result.user.id,
                email: `${result.user.id}@mock.local`,
                app_metadata: {},
                user_metadata: { nickname: result.user.nickname },
                aud: 'authenticated',
                created_at: result.user.createdAt,
              } as User,
            } as Session,
            profile: {
              id: result.user.id,
              nickname: result.user.nickname,
              created_at: result.user.createdAt,
            },
          };
          
          console.log('🎉 モック認証結果変換完了:', convertedResult);
          return convertedResult;
        } catch (mockError) {
          console.error('💥 モック認証でエラー発生:', mockError);
          throw mockError;
        }
      }
    } catch (error) {
      console.error('🔴 authSlice 最終エラーキャッチ:', error);
      console.error('エラーの型:', typeof error);
      console.error('エラーメッセージ:', (error as any)?.message);
      console.error('エラースタック:', (error as any)?.stack);
      
      const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました';
      console.error('リジェクト値:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      const featureFlags = FeatureFlagsManager.getInstance();
      
      if (featureFlags.isSupabaseEnabled()) {
        const { error } = await supabaseAuth.signOut();
        
        if (error) {
          return rejectWithValue(error.message);
        }
      } else {
        // Use mock authentication logout
        const authService = AuthService.getInstance();
        await authService.logout();
      }
      
      return true;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue, getState }) => {
    try {
      const featureFlags = FeatureFlagsManager.getInstance();
      
      if (featureFlags.isSupabaseEnabled()) {
        console.log('🔍 getCurrentUser: Supabase カスタム認証モード');
        
        // カスタム認証では、既存の認証状態を保持
        const state = getState() as any;
        const currentAuth = state.auth;
        
        // 既に認証済みの場合は現在の状態を返す
        if (currentAuth.isAuthenticated && currentAuth.user) {
          console.log('✅ 既存の認証状態を保持します');
          return {
            user: currentAuth.user,
            session: currentAuth.session,
            profile: currentAuth.profile,
          };
        }
        
        // 認証されていない場合は null を返す
        console.log('❌ 認証されていません');
        return {
          user: null,
          session: null,
          profile: null,
        };
      } else {
        // Use mock authentication
        const authService = AuthService.getInstance();
        const hasValidToken = await authService.checkAuthStatus();
        
        if (hasValidToken) {
          const storedUser = await authService.getStoredUser();
          const tokens = await authService.getStoredTokens();
          
          if (storedUser && tokens) {
            return {
              user: {
                id: storedUser.id,
                email: `${storedUser.id}@mock.local`,
                app_metadata: {},
                user_metadata: { nickname: storedUser.nickname },
                aud: 'authenticated',
                created_at: storedUser.createdAt,
              } as User,
              session: {
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
                expires_in: 3600,
                token_type: 'bearer',
                user: {
                  id: storedUser.id,
                  email: `${storedUser.id}@mock.local`,
                  app_metadata: {},
                  user_metadata: { nickname: storedUser.nickname },
                  aud: 'authenticated',
                  created_at: storedUser.createdAt,
                } as User,
              } as Session,
              profile: {
                id: storedUser.id,
                nickname: storedUser.nickname,
                created_at: storedUser.createdAt,
              },
            };
          }
        }
        
        return {
          user: null,
          session: null,
          profile: null,
        };
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async (updates: Partial<DatabaseUser>, { rejectWithValue, getState }) => {
    try {
      const { error } = await supabaseAuth.updateUserProfile(updates);
      
      if (error) {
        return rejectWithValue(error.message);
      }

      // Get updated profile
      const profile = await supabaseAuth.getUserProfile();
      return profile;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    // Get current session on app start
    await dispatch(getCurrentUser());
    return true;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setAuthSession: (state, action: PayloadAction<{ user: User | null; session: Session | null }>) => {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.isAuthenticated = !!action.payload.user;
    },
    setUserProfile: (state, action: PayloadAction<any>) => {
      state.profile = action.payload;
    },
    resetAuth: (state) => {
      state.user = null;
      state.session = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<AuthError>) => {
      state.isLoading = false;
      state.error = getAuthErrorMessage(action.payload);
      state.isAuthenticated = false;
    },
    logout: (state) => {
      state.user = null;
      state.session = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.error = null;
      state.isLoading = false;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    // Sign in with maternal book
    builder
      .addCase(signInWithMaternalBook.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithMaternalBook.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.profile = action.payload.profile;
        state.isAuthenticated = !!action.payload.user;
        state.error = null;
      })
      .addCase(signInWithMaternalBook.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Sign out
    builder
      .addCase(signOut.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.session = null;
        state.profile = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Get current user
    builder
      .addCase(getCurrentUser.pending, (state) => {
        if (!state.isInitialized) {
          state.isLoading = true;
        }
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.profile = action.payload.profile;
        state.isAuthenticated = !!action.payload.user;
        state.isInitialized = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload as string;
      });

    // Update user profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Initialize auth
    builder
      .addCase(initializeAuth.fulfilled, (state) => {
        state.isInitialized = true;
      });
  },
});

export const { clearError, setAuthSession, setUserProfile, resetAuth, loginStart, loginFailure, logout, setUser, updateUser } = authSlice.actions;
export { authSlice, initialState };