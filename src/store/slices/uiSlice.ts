import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SupabaseError } from '../../utils/SupabaseErrorHandler';

export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: SupabaseError | null;
}

export interface UIState {
  loading: LoadingState;
  errors: ErrorState;
  globalError: SupabaseError | null;
  networkStatus: 'online' | 'offline' | 'unknown';
  refreshing: LoadingState;
  modals: {
    [key: string]: boolean;
  };
  notifications: {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
  };
  successMessages: string[];
}

const initialState: UIState = {
  loading: {},
  errors: {},
  globalError: null,
  networkStatus: 'unknown',
  refreshing: {},
  modals: {},
  notifications: {
    visible: false,
    message: '',
    type: 'info',
  },
  successMessages: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Loading states
    setLoading: (state, action: PayloadAction<{ key: string; isLoading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.isLoading;
    },
    clearLoading: (state, action: PayloadAction<string>) => {
      delete state.loading[action.payload];
    },
    clearAllLoading: (state) => {
      state.loading = {};
    },

    // Error states
    setError: (state, action: PayloadAction<SupabaseError>) => {
      state.globalError = action.payload;
      // Also show notification for user-friendly message
      state.notifications = {
        visible: true,
        message: action.payload.userMessage,
        type: 'error',
        duration: 5000,
      };
    },
    setKeyedError: (state, action: PayloadAction<{ key: string; error: SupabaseError | null }>) => {
      state.errors[action.payload.key] = action.payload.error;
    },
    clearError: (state) => {
      state.globalError = null;
    },
    clearKeyedError: (state, action: PayloadAction<string>) => {
      delete state.errors[action.payload];
    },
    clearAllErrors: (state) => {
      state.errors = {};
      state.globalError = null;
    },

    // Network status
    setNetworkStatus: (state, action: PayloadAction<'online' | 'offline' | 'unknown'>) => {
      state.networkStatus = action.payload;
    },

    // Refresh states
    setRefreshing: (state, action: PayloadAction<{ key: string; isRefreshing: boolean }>) => {
      state.refreshing[action.payload.key] = action.payload.isRefreshing;
    },
    clearRefreshing: (state, action: PayloadAction<string>) => {
      delete state.refreshing[action.payload];
    },

    // Modal states
    showModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = true;
    },
    hideModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = false;
    },
    clearModals: (state) => {
      state.modals = {};
    },

    // Notifications
    showNotification: (state, action: PayloadAction<{
      message: string;
      type: 'success' | 'error' | 'warning' | 'info';
      duration?: number;
    }>) => {
      state.notifications = {
        visible: true,
        message: action.payload.message,
        type: action.payload.type,
        duration: action.payload.duration,
      };
    },
    hideNotification: (state) => {
      state.notifications.visible = false;
    },

    // Success messages
    addSuccessMessage: (state, action: PayloadAction<string>) => {
      state.successMessages.push(action.payload);
      // Also show notification
      state.notifications = {
        visible: true,
        message: action.payload,
        type: 'success',
        duration: 3000,
      };
    },
    clearSuccessMessages: (state) => {
      state.successMessages = [];
    },

    // Convenience actions
    setLoadingAndError: (state, action: PayloadAction<{
      key: string;
      isLoading: boolean;
      error?: SupabaseError | null;
    }>) => {
      state.loading[action.payload.key] = action.payload.isLoading;
      if (action.payload.error !== undefined) {
        state.errors[action.payload.key] = action.payload.error;
      }
    },
  },
});

export const {
  setLoading,
  clearLoading,
  clearAllLoading,
  setError,
  setKeyedError,
  clearError,
  clearKeyedError,
  clearAllErrors,
  setNetworkStatus,
  setRefreshing,
  clearRefreshing,
  showModal,
  hideModal,
  clearModals,
  showNotification,
  hideNotification,
  addSuccessMessage,
  clearSuccessMessages,
  setLoadingAndError,
} = uiSlice.actions;

export { uiSlice };