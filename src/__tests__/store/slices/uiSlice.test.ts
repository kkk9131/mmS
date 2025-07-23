import { configureStore } from '@reduxjs/toolkit';
import { uiSlice } from '../../../store/slices/uiSlice';
import { RootState } from '../../../store';
import { SupabaseError } from '../../../utils/SupabaseErrorHandler';

describe('UI Slice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        ui: uiSlice.reducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = (store.getState() as RootState).ui;
      
      expect(state.loading).toEqual({});
      expect(state.errors).toEqual({});
      expect(state.globalError).toBeNull();
      expect(state.networkStatus).toBe('unknown');
      expect(state.refreshing).toEqual({});
      expect(state.modals).toEqual({});
      expect(state.notifications.visible).toBe(false);
      expect(state.notifications.message).toBe('');
      expect(state.notifications.type).toBe('info');
      expect(state.successMessages).toEqual([]);
    });
  });

  describe('Loading States', () => {
    it('should handle setLoading', () => {
      store.dispatch(uiSlice.actions.setLoading({ key: 'posts', isLoading: true }));
      
      let state = (store.getState() as RootState).ui;
      expect(state.loading.posts).toBe(true);

      store.dispatch(uiSlice.actions.setLoading({ key: 'posts', isLoading: false }));
      
      state = (store.getState() as RootState).ui;
      expect(state.loading.posts).toBe(false);
    });

    it('should handle multiple loading states', () => {
      store.dispatch(uiSlice.actions.setLoading({ key: 'posts', isLoading: true }));
      store.dispatch(uiSlice.actions.setLoading({ key: 'users', isLoading: true }));
      store.dispatch(uiSlice.actions.setLoading({ key: 'notifications', isLoading: false }));
      
      const state = (store.getState() as RootState).ui;
      expect(state.loading.posts).toBe(true);
      expect(state.loading.users).toBe(true);
      expect(state.loading.notifications).toBe(false);
    });

    it('should handle clearLoading', () => {
      store.dispatch(uiSlice.actions.setLoading({ key: 'test', isLoading: true }));
      expect((store.getState() as RootState).ui.loading.test).toBe(true);

      store.dispatch(uiSlice.actions.clearLoading('test'));
      expect((store.getState() as RootState).ui.loading.test).toBeUndefined();
    });

    it('should handle clearAllLoading', () => {
      store.dispatch(uiSlice.actions.setLoading({ key: 'test1', isLoading: true }));
      store.dispatch(uiSlice.actions.setLoading({ key: 'test2', isLoading: true }));
      
      expect(Object.keys((store.getState() as RootState).ui.loading)).toHaveLength(2);

      store.dispatch(uiSlice.actions.clearAllLoading());
      expect((store.getState() as RootState).ui.loading).toEqual({});
    });
  });

  describe('Error States', () => {
    it('should handle setError (global error)', () => {
      const error: SupabaseError = {
        type: 'NETWORK_ERROR',
        message: 'Network failed',
        userMessage: 'ネットワーク接続を確認してください',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setError(error));
      
      const state = (store.getState() as RootState).ui;
      expect(state.globalError).toEqual(error);
      expect(state.notifications.visible).toBe(true);
      expect(state.notifications.message).toBe('ネットワーク接続を確認してください');
      expect(state.notifications.type).toBe('error');
      expect(state.notifications.duration).toBe(5000);
    });

    it('should handle setKeyedError', () => {
      const error: SupabaseError = {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        userMessage: '入力内容を確認してください',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setKeyedError({ key: 'form', error }));
      
      const state = (store.getState() as RootState).ui;
      expect(state.errors.form).toEqual(error);
      expect(state.globalError).toBeNull(); // Should not set global error
    });

    it('should handle clearError (global)', () => {
      const error: SupabaseError = {
        type: 'AUTH_ERROR',
        message: 'Auth failed',
        userMessage: '認証エラー',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setError(error));
      expect((store.getState() as RootState).ui.globalError).toEqual(error);

      store.dispatch(uiSlice.actions.clearError());
      expect((store.getState() as RootState).ui.globalError).toBeNull();
    });

    it('should handle clearKeyedError', () => {
      const error: SupabaseError = {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        userMessage: '入力エラー',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setKeyedError({ key: 'test', error }));
      expect((store.getState() as RootState).ui.errors.test).toEqual(error);

      store.dispatch(uiSlice.actions.clearKeyedError('test'));
      expect((store.getState() as RootState).ui.errors.test).toBeUndefined();
    });

    it('should handle clearAllErrors', () => {
      const error1: SupabaseError = {
        type: 'NETWORK_ERROR',
        message: 'Network error',
        userMessage: 'ネットワークエラー',
        recoverable: true,
      };

      const error2: SupabaseError = {
        type: 'SERVER_ERROR',
        message: 'Server error',
        userMessage: 'サーバーエラー',
        recoverable: false,
      };

      store.dispatch(uiSlice.actions.setError(error1));
      store.dispatch(uiSlice.actions.setKeyedError({ key: 'test', error: error2 }));

      expect((store.getState() as RootState).ui.globalError).toEqual(error1);
      expect((store.getState() as RootState).ui.errors.test).toEqual(error2);

      store.dispatch(uiSlice.actions.clearAllErrors());

      const state = (store.getState() as RootState).ui;
      expect(state.globalError).toBeNull();
      expect(state.errors).toEqual({});
    });
  });

  describe('Network Status', () => {
    it('should handle setNetworkStatus', () => {
      store.dispatch(uiSlice.actions.setNetworkStatus('online'));
      expect((store.getState() as RootState).ui.networkStatus).toBe('online');

      store.dispatch(uiSlice.actions.setNetworkStatus('offline'));
      expect((store.getState() as RootState).ui.networkStatus).toBe('offline');

      store.dispatch(uiSlice.actions.setNetworkStatus('unknown'));
      expect((store.getState() as RootState).ui.networkStatus).toBe('unknown');
    });
  });

  describe('Refresh States', () => {
    it('should handle setRefreshing', () => {
      store.dispatch(uiSlice.actions.setRefreshing({ key: 'posts', isRefreshing: true }));
      
      let state = (store.getState() as RootState).ui;
      expect(state.refreshing.posts).toBe(true);

      store.dispatch(uiSlice.actions.setRefreshing({ key: 'posts', isRefreshing: false }));
      
      state = (store.getState() as RootState).ui;
      expect(state.refreshing.posts).toBe(false);
    });

    it('should handle clearRefreshing', () => {
      store.dispatch(uiSlice.actions.setRefreshing({ key: 'test', isRefreshing: true }));
      expect((store.getState() as RootState).ui.refreshing.test).toBe(true);

      store.dispatch(uiSlice.actions.clearRefreshing('test'));
      expect((store.getState() as RootState).ui.refreshing.test).toBeUndefined();
    });
  });

  describe('Modal States', () => {
    it('should handle showModal', () => {
      store.dispatch(uiSlice.actions.showModal('testModal'));
      expect((store.getState() as RootState).ui.modals.testModal).toBe(true);
    });

    it('should handle hideModal', () => {
      store.dispatch(uiSlice.actions.showModal('testModal'));
      expect((store.getState() as RootState).ui.modals.testModal).toBe(true);

      store.dispatch(uiSlice.actions.hideModal('testModal'));
      expect((store.getState() as RootState).ui.modals.testModal).toBe(false);
    });

    it('should handle multiple modals', () => {
      store.dispatch(uiSlice.actions.showModal('modal1'));
      store.dispatch(uiSlice.actions.showModal('modal2'));
      store.dispatch(uiSlice.actions.hideModal('modal1'));

      const state = (store.getState() as RootState).ui;
      expect(state.modals.modal1).toBe(false);
      expect(state.modals.modal2).toBe(true);
    });

    it('should handle clearModals', () => {
      store.dispatch(uiSlice.actions.showModal('modal1'));
      store.dispatch(uiSlice.actions.showModal('modal2'));
      
      expect(Object.keys((store.getState() as RootState).ui.modals)).toHaveLength(2);

      store.dispatch(uiSlice.actions.clearModals());
      expect((store.getState() as RootState).ui.modals).toEqual({});
    });
  });

  describe('Notifications', () => {
    it('should handle showNotification', () => {
      store.dispatch(uiSlice.actions.showNotification({
        message: 'Test notification',
        type: 'success',
        duration: 3000,
      }));

      const state = (store.getState() as RootState).ui;
      expect(state.notifications.visible).toBe(true);
      expect(state.notifications.message).toBe('Test notification');
      expect(state.notifications.type).toBe('success');
      expect(state.notifications.duration).toBe(3000);
    });

    it('should handle showNotification with default values', () => {
      store.dispatch(uiSlice.actions.showNotification({
        message: 'Simple notification',
        type: 'info',
      }));

      const state = (store.getState() as RootState).ui;
      expect(state.notifications.visible).toBe(true);
      expect(state.notifications.message).toBe('Simple notification');
      expect(state.notifications.type).toBe('info');
      expect(state.notifications.duration).toBeUndefined();
    });

    it('should handle hideNotification', () => {
      store.dispatch(uiSlice.actions.showNotification({
        message: 'Test',
        type: 'warning',
      }));
      
      expect((store.getState() as RootState).ui.notifications.visible).toBe(true);

      store.dispatch(uiSlice.actions.hideNotification());
      expect((store.getState() as RootState).ui.notifications.visible).toBe(false);
    });

    it('should handle different notification types', () => {
      const types = ['success', 'error', 'warning', 'info'] as const;
      
      types.forEach(type => {
        store.dispatch(uiSlice.actions.showNotification({
          message: `${type} notification`,
          type,
        }));

        const state = (store.getState() as RootState).ui;
        expect(state.notifications.type).toBe(type);
        expect(state.notifications.message).toBe(`${type} notification`);
      });
    });
  });

  describe('Success Messages', () => {
    it('should handle addSuccessMessage', () => {
      store.dispatch(uiSlice.actions.addSuccessMessage('Operation successful'));

      const state = (store.getState() as RootState).ui;
      expect(state.successMessages).toEqual(['Operation successful']);
      expect(state.notifications.visible).toBe(true);
      expect(state.notifications.message).toBe('Operation successful');
      expect(state.notifications.type).toBe('success');
      expect(state.notifications.duration).toBe(3000);
    });

    it('should handle multiple success messages', () => {
      store.dispatch(uiSlice.actions.addSuccessMessage('First success'));
      store.dispatch(uiSlice.actions.addSuccessMessage('Second success'));

      const state = (store.getState() as RootState).ui;
      expect(state.successMessages).toEqual(['First success', 'Second success']);
    });

    it('should handle clearSuccessMessages', () => {
      store.dispatch(uiSlice.actions.addSuccessMessage('Success 1'));
      store.dispatch(uiSlice.actions.addSuccessMessage('Success 2'));
      
      expect((store.getState() as RootState).ui.successMessages).toHaveLength(2);

      store.dispatch(uiSlice.actions.clearSuccessMessages());
      expect((store.getState() as RootState).ui.successMessages).toEqual([]);
    });
  });

  describe('Convenience Actions', () => {
    it('should handle setLoadingAndError', () => {
      const error: SupabaseError = {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        userMessage: '入力エラー',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setLoadingAndError({
        key: 'form',
        isLoading: true,
        error,
      }));

      const state = (store.getState() as RootState).ui;
      expect(state.loading.form).toBe(true);
      expect(state.errors.form).toEqual(error);
    });

    it('should handle setLoadingAndError without error', () => {
      store.dispatch(uiSlice.actions.setLoadingAndError({
        key: 'test',
        isLoading: false,
      }));

      const state = (store.getState() as RootState).ui;
      expect(state.loading.test).toBe(false);
      expect(state.errors.test).toBeUndefined();
    });
  });

  describe('State Combinations', () => {
    it('should handle complex state combinations', () => {
      const networkError: SupabaseError = {
        type: 'NETWORK_ERROR',
        message: 'Network failed',
        userMessage: 'ネットワークエラー',
        recoverable: true,
      };

      const validationError: SupabaseError = {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        userMessage: '入力エラー',
        recoverable: true,
      };

      // Set various states
      store.dispatch(uiSlice.actions.setLoading({ key: 'posts', isLoading: true }));
      store.dispatch(uiSlice.actions.setRefreshing({ key: 'notifications', isRefreshing: true }));
      store.dispatch(uiSlice.actions.setError(networkError));
      store.dispatch(uiSlice.actions.setKeyedError({ key: 'form', error: validationError }));
      store.dispatch(uiSlice.actions.showModal('confirmDialog'));
      store.dispatch(uiSlice.actions.setNetworkStatus('offline'));

      const state = (store.getState() as RootState).ui;
      expect(state.loading.posts).toBe(true);
      expect(state.refreshing.notifications).toBe(true);
      expect(state.globalError).toEqual(networkError);
      expect(state.errors.form).toEqual(validationError);
      expect(state.modals.confirmDialog).toBe(true);
      expect(state.networkStatus).toBe('offline');
    });

    it('should handle state cleanup', () => {
      // Set up complex state
      const error: SupabaseError = {
        type: 'SERVER_ERROR',
        message: 'Server error',
        userMessage: 'サーバーエラー',
        recoverable: false,
      };

      store.dispatch(uiSlice.actions.setLoading({ key: 'test1', isLoading: true }));
      store.dispatch(uiSlice.actions.setLoading({ key: 'test2', isLoading: true }));
      store.dispatch(uiSlice.actions.setError(error));
      store.dispatch(uiSlice.actions.setKeyedError({ key: 'key1', error }));
      store.dispatch(uiSlice.actions.showModal('modal1'));
      store.dispatch(uiSlice.actions.addSuccessMessage('Success'));

      // Clean up
      store.dispatch(uiSlice.actions.clearAllLoading());
      store.dispatch(uiSlice.actions.clearAllErrors());
      store.dispatch(uiSlice.actions.clearModals());
      store.dispatch(uiSlice.actions.clearSuccessMessages());
      store.dispatch(uiSlice.actions.hideNotification());

      const state = (store.getState() as RootState).ui;
      expect(state.loading).toEqual({});
      expect(state.errors).toEqual({});
      expect(state.globalError).toBeNull();
      expect(state.modals).toEqual({});
      expect(state.successMessages).toEqual([]);
      expect(state.notifications.visible).toBe(false);
    });
  });

  describe('Error State Integration', () => {
    it('should properly integrate error states with notifications', () => {
      const authError: SupabaseError = {
        type: 'AUTH_ERROR',
        message: 'Authentication failed',
        userMessage: '認証に失敗しました',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setError(authError));

      const state = (store.getState() as RootState).ui;
      expect(state.globalError).toEqual(authError);
      expect(state.notifications.visible).toBe(true);
      expect(state.notifications.message).toBe('認証に失敗しました');
      expect(state.notifications.type).toBe('error');
    });

    it('should handle error clearing with notification state', () => {
      const error: SupabaseError = {
        type: 'RATE_LIMIT',
        message: 'Rate limited',
        userMessage: 'リクエスト制限',
        recoverable: true,
      };

      store.dispatch(uiSlice.actions.setError(error));
      expect((store.getState() as RootState).ui.globalError).toEqual(error);
      expect((store.getState() as RootState).ui.notifications.visible).toBe(true);

      store.dispatch(uiSlice.actions.clearError());
      expect((store.getState() as RootState).ui.globalError).toBeNull();
      // Note: clearError doesn't automatically hide notifications
      expect((store.getState() as RootState).ui.notifications.visible).toBe(true);
    });
  });
});