import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { User as DatabaseUser } from '../../types/supabase';
import { supabaseAuth, MaternalBookCredentials, AuthResult } from '../../services/supabase/auth';

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
      const result: AuthResult = await supabaseAuth.signInWithMaternalBook(credentials);
      
      if (result.error) {
        // Map Supabase errors to user-friendly messages
        const errorMessage = getAuthErrorMessage(result.error);
        return rejectWithValue(errorMessage);
      }

      // Get user profile
      const profile = await supabaseAuth.getUserProfile();
      
      return {
        user: result.user,
        session: result.session,
        profile,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました';
      return rejectWithValue(errorMessage);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabaseAuth.signOut();
      
      if (error) {
        return rejectWithValue(error.message);
      }
      
      return true;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await supabaseAuth.getCurrentUser();
      const session = await supabaseAuth.getCurrentSession();
      const profile = user ? await supabaseAuth.getUserProfile() : null;
      
      return {
        user,
        session,
        profile,
      };
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