import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import { useCallback, useMemo } from 'react';
import type { RootState, AppDispatch } from '../store';
import { FeatureFlagsManager } from '../services/featureFlags';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Feature flag aware hooks
export const useIsReduxEnabled = (): boolean => {
  return useMemo(() => {
    const featureFlags = FeatureFlagsManager.getInstance();
    return featureFlags.isReduxEnabled();
  }, []);
};

// Auth hooks
export const useAuth = () => {
  const auth = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const isReduxEnabled = useIsReduxEnabled();

  const signIn = useCallback((credentials: any) => {
    if (!isReduxEnabled) {
      console.warn('Redux is disabled, auth actions not available');
      return;
    }
    // dispatch auth actions
  }, [dispatch, isReduxEnabled]);

  return useMemo(() => ({
    ...auth,
    signIn,
    isReduxEnabled,
  }), [auth, signIn, isReduxEnabled]);
};

// UI hooks
export const useUI = () => {
  const ui = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    dispatch({ type: 'ui/setLoading', payload: { key, isLoading } });
  }, [dispatch]);

  const setError = useCallback((key: string, error: string | null) => {
    dispatch({ type: 'ui/setError', payload: { key, error } });
  }, [dispatch]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    dispatch({ type: 'ui/showNotification', payload: { message, type } });
  }, [dispatch]);

  return useMemo(() => ({
    ...ui,
    setLoading,
    setError,
    showNotification,
  }), [ui, setLoading, setError, showNotification]);
};

// Settings hooks
export const useSettings = () => {
  const settings = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();

  const updateSetting = useCallback((key: string, value: any) => {
    dispatch({ type: `settings/update${key}`, payload: value });
  }, [dispatch]);

  return useMemo(() => ({
    ...settings,
    updateSetting,
  }), [settings, updateSetting]);
};

// Network status hook
export const useNetworkStatus = () => {
  const networkStatus = useAppSelector((state) => state.ui.networkStatus);
  const dispatch = useAppDispatch();

  const setNetworkStatus = useCallback((status: 'online' | 'offline' | 'unknown') => {
    dispatch({ type: 'ui/setNetworkStatus', payload: status });
  }, [dispatch]);

  return useMemo(() => ({
    status: networkStatus,
    isOnline: networkStatus === 'online',
    isOffline: networkStatus === 'offline',
    setNetworkStatus,
  }), [networkStatus, setNetworkStatus]);
};

// Loading state hook
export const useLoadingState = (key: string) => {
  const isLoading = useAppSelector((state) => state.ui.loading[key] || false);
  const error = useAppSelector((state) => state.ui.errors[key] || null);
  const dispatch = useAppDispatch();

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'ui/setLoading', payload: { key, isLoading: loading } });
  }, [dispatch, key]);

  const setError = useCallback((errorMessage: string | null) => {
    dispatch({ type: 'ui/setError', payload: { key, error: errorMessage } });
  }, [dispatch, key]);

  const clearError = useCallback(() => {
    dispatch({ type: 'ui/clearError', payload: key });
  }, [dispatch, key]);

  return useMemo(() => ({
    isLoading,
    error,
    setLoading,
    setError,
    clearError,
  }), [isLoading, error, setLoading, setError, clearError]);
};

// Modal state hook
export const useModal = (modalKey: string) => {
  const isOpen = useAppSelector((state) => state.ui.modals[modalKey] || false);
  const dispatch = useAppDispatch();

  const show = useCallback(() => {
    dispatch({ type: 'ui/showModal', payload: modalKey });
  }, [dispatch, modalKey]);

  const hide = useCallback(() => {
    dispatch({ type: 'ui/hideModal', payload: modalKey });
  }, [dispatch, modalKey]);

  const toggle = useCallback(() => {
    if (isOpen) {
      hide();
    } else {
      show();
    }
  }, [isOpen, show, hide]);

  return useMemo(() => ({
    isOpen,
    show,
    hide,
    toggle,
  }), [isOpen, show, hide, toggle]);
};