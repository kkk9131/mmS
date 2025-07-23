import { renderHook, act } from '@testing-library/react-hooks';
import { useRealtimeSubscription, useMultipleRealtimeSubscriptions } from '../../hooks/useRealtimeSubscription';
import { createMockSupabaseClient } from '../utils/mockSupabaseClient';
import { FeatureFlagsManager } from '../../services/featureFlags';

// Mock dependencies
const mockClient = createMockSupabaseClient();

jest.mock('../../services/supabase/client', () => ({
  supabaseClient: {
    isInitialized: () => true,
    getClient: () => mockClient,
  },
}));

jest.mock('../../services/featureFlags');

// Mock performance monitor
jest.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    trackRealtimeSubscription: jest.fn(() => ({})),
  },
}));

describe('useRealtimeSubscription', () => {
  beforeEach(() => {
    // Mock FeatureFlagsManager
    const mockFeatureFlags = {
      isSupabaseEnabled: jest.fn(() => true),
    };
    (FeatureFlagsManager.getInstance as jest.Mock).mockReturnValue(mockFeatureFlags);

    mockClient.resetMockDb();
    jest.clearAllMocks();
  });

  describe('Basic Subscription Management', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useRealtimeSubscription('test-channel', {
          table: 'posts',
          onInsert: jest.fn(() => ({})),
        })
      );

      expect(result.current.connectionStatus.isConnected).toBe(false);
      expect(result.current.connectionStatus.isConnecting).toBe(false);
      expect(result.current.connectionStatus.error).toBeNull();
      expect(result.current.connectionStatus.reconnectAttempts).toBe(0);
      expect(result.current.isSubscribed).toBe(false);
    });

    it('should handle successful subscription', async () => {
      const onInsert = jest.fn();
      const { result } = renderHook(() =>
        useRealtimeSubscription('test-channel', {
          table: 'posts',
          onInsert,
        })
      );

      // Start subscription
      act(() => {
        result.current.subscribe();
      });

      // Wait for subscription to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isSubscribed).toBe(true);
      expect(result.current.connectionStatus.isConnected).toBe(true);
      expect(result.current.connectionStatus.isConnecting).toBe(false);
      expect(result.current.connectionStatus.error).toBeNull();
    });

    it('should handle subscription errors', async () => {
      const onError = jest.fn();
      
      // Mock channel with error
      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn(),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('CHANNEL_ERROR', new Error('Connection failed')), 100);
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useRealtimeSubscription('error-channel', {
          table: 'posts',
          onError,
          autoReconnect: false, // Disable auto-reconnect for this test
        })
      );

      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.connectionStatus.error).toBeDefined();
      expect(result.current.connectionStatus.isConnected).toBe(false);
      expect(result.current.isSubscribed).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    it('should handle unsubscribe', async () => {
      const { result } = renderHook(() =>
        useRealtimeSubscription('test-channel', {
          table: 'posts',
        })
      );

      // Subscribe first
      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isSubscribed).toBe(true);

      // Then unsubscribe
      act(() => {
        result.current.unsubscribe();
      });

      expect(result.current.isSubscribed).toBe(false);
      expect(result.current.connectionStatus.isConnected).toBe(false);
    });
  });

  describe('Realtime Events', () => {
    it('should handle INSERT events', async () => {
      const onInsert = jest.fn();
      let eventCallback: any;

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn((...args: any[]) => {
          eventCallback = args[2];
          return {};
        }),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('SUBSCRIBED'), 100);
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useRealtimeSubscription('posts-channel', {
          table: 'posts',
          onInsert,
        })
      );

      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Simulate INSERT event
      act(() => {
        eventCallback({
          eventType: 'INSERT',
          new: {
            id: 'new-post-id',
            content: 'New post content',
            user_id: 'user123',
          },
        });
      });

      expect(onInsert).toHaveBeenCalledWith({
        eventType: 'INSERT',
        new: {
          id: 'new-post-id',
          content: 'New post content',
          user_id: 'user123',
        },
      });
    });

    it('should handle UPDATE events', async () => {
      const onUpdate = jest.fn();
      let eventCallback: any;

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn((...args: any[]) => {
          eventCallback = args[2];
          return {};
        }),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('SUBSCRIBED'), 100);
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useRealtimeSubscription('posts-channel', {
          table: 'posts',
          onUpdate,
        })
      );

      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Simulate UPDATE event
      act(() => {
        eventCallback({
          eventType: 'UPDATE',
          old: { id: 'post-123', content: 'Old content' },
          new: { id: 'post-123', content: 'Updated content' },
        });
      });

      expect(onUpdate).toHaveBeenCalledWith({
        eventType: 'UPDATE',
        old: { id: 'post-123', content: 'Old content' },
        new: { id: 'post-123', content: 'Updated content' },
      });
    });

    it('should handle DELETE events', async () => {
      const onDelete = jest.fn();
      let eventCallback: any;

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn((...args: any[]) => {
          eventCallback = args[2];
          return {};
        }),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('SUBSCRIBED'), 100);
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useRealtimeSubscription('posts-channel', {
          table: 'posts',
          onDelete,
        })
      );

      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Simulate DELETE event
      act(() => {
        eventCallback({
          eventType: 'DELETE',
          old: { id: 'deleted-post', content: 'Deleted content' },
        });
      });

      expect(onDelete).toHaveBeenCalledWith({
        eventType: 'DELETE',
        old: { id: 'deleted-post', content: 'Deleted content' },
      });
    });
  });

  describe('Auto-Reconnect Functionality', () => {
    it('should attempt reconnection on connection failure', async () => {
      const onError = jest.fn();
      let subscribeCallback: any;
      let attemptCount = 0;

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn(),
        subscribe: jest.fn((callback: any) => {
          subscribeCallback = callback;
          attemptCount++;
          if (attemptCount === 1) {
            setTimeout(() => callback('CHANNEL_ERROR', new Error('First attempt failed')), 50);
          } else {
            setTimeout(() => callback('SUBSCRIBED'), 50);
          }
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useRealtimeSubscription('reconnect-channel', {
          table: 'posts',
          onError,
          autoReconnect: true,
          maxReconnectAttempts: 3,
          reconnectDelay: 100,
        })
      );

      act(() => {
        result.current.subscribe();
      });

      // Wait for first failure and reconnection attempt
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      expect(result.current.connectionStatus.reconnectAttempts).toBeGreaterThan(0);
      expect(attemptCount).toBe(2); // Original + 1 retry
    });

    it('should stop reconnecting after max attempts', async () => {
      const onError = jest.fn();

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn(),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('CHANNEL_ERROR', new Error('Persistent failure')), 50);
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useRealtimeSubscription('failing-channel', {
          table: 'posts',
          onError,
          autoReconnect: true,
          maxReconnectAttempts: 2,
          reconnectDelay: 50,
        })
      );

      act(() => {
        result.current.subscribe();
      });

      // Wait for max attempts to be reached
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      expect(result.current.connectionStatus.reconnectAttempts).toBe(2);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Max reconnection attempts')
        })
      );
    });

    it('should allow manual reconnection', async () => {
      const { result } = renderHook(() =>
        useRealtimeSubscription('manual-reconnect-channel', {
          table: 'posts',
          autoReconnect: false,
        })
      );

      // Initial connection
      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isSubscribed).toBe(true);

      // Manual reconnect should reset attempts
      act(() => {
        result.current.reconnect();
      });

      expect(result.current.connectionStatus.reconnectAttempts).toBe(0);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup on unmount', async () => {
      const unsubscribeSpy = jest.fn();

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn(),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('SUBSCRIBED'), 100);
        }),
        unsubscribe: unsubscribeSpy,
      })) as any);

      const { result, unmount } = renderHook(() =>
        useRealtimeSubscription('cleanup-channel', {
          table: 'posts',
        })
      );

      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isSubscribed).toBe(true);

      // Unmount should trigger cleanup
      unmount();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should handle options updates without recreating subscription', async () => {
      let onInsert1 = jest.fn();
      let onInsert2 = jest.fn();
      let eventCallback: any;

      jest.spyOn(mockClient, 'channel').mockImplementation((() => ({
        on: jest.fn((...args: any[]) => {
          eventCallback = args[2];
          return {};
        }),
        subscribe: jest.fn((callback: any) => {
          setTimeout(() => callback('SUBSCRIBED'), 50);
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result, rerender } = renderHook(
        (props) => useRealtimeSubscription('update-channel', props),
        {
          initialProps: {
            table: 'posts',
            onInsert: onInsert1,
          },
        }
      );

      act(() => {
        result.current.subscribe();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Trigger event with first callback
      act(() => {
        eventCallback({ eventType: 'INSERT', new: { id: 'test' } });
      });

      expect(onInsert1).toHaveBeenCalled();

      // Update options
      rerender({
        table: 'posts',
        onInsert: onInsert2,
      });

      // Trigger event with updated callback
      act(() => {
        eventCallback({ eventType: 'INSERT', new: { id: 'test2' } });
      });

      expect(onInsert2).toHaveBeenCalled();
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect Supabase enabled flag', () => {
      const mockFeatureFlags = {
        isSupabaseEnabled: jest.fn(() => false),
      };
      (FeatureFlagsManager.getInstance as jest.Mock).mockReturnValue(mockFeatureFlags);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() =>
        useRealtimeSubscription('disabled-channel', {
          table: 'posts',
        })
      );

      act(() => {
        result.current.subscribe();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Realtime subscriptions not available: Supabase disabled'
      );
      expect(result.current.isSubscribed).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});

describe('useMultipleRealtimeSubscriptions', () => {
  beforeEach(() => {
    const mockFeatureFlags = {
      isSupabaseEnabled: jest.fn(() => true),
    };
    (FeatureFlagsManager.getInstance as jest.Mock).mockReturnValue(mockFeatureFlags);

    mockClient.resetMockDb();
    jest.clearAllMocks();
  });

  describe('Multiple Subscription Management', () => {
    it('should handle multiple subscriptions', async () => {
      const onInsert1 = jest.fn();
      const onInsert2 = jest.fn();
      const onGlobalError = jest.fn();

      const { result } = renderHook(() =>
        useMultipleRealtimeSubscriptions({
          subscriptions: [
            {
              channelName: 'posts-channel',
              options: { table: 'posts', onInsert: onInsert1 },
            },
            {
              channelName: 'notifications-channel',
              options: { table: 'notifications', onInsert: onInsert2 },
            },
          ],
          onGlobalError,
        })
      );

      expect(result.current.subscriptions).toHaveLength(2);
      expect(result.current.globalConnectionStatus.totalChannels).toBe(2);
      expect(result.current.globalConnectionStatus.connectedChannels).toBe(0);

      // Subscribe to all channels
      act(() => {
        result.current.subscribeAll();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      expect(result.current.globalConnectionStatus.connectedChannels).toBe(2);
      expect(result.current.globalConnectionStatus.allConnected).toBe(true);
    });

    it('should handle partial connection failures', async () => {
      const onGlobalError = jest.fn();
      let subscribeCount = 0;

      jest.spyOn(mockClient, 'channel').mockImplementation(((name: string) => ({
        on: jest.fn(),
        subscribe: jest.fn((callback: any) => {
          subscribeCount++;
          if (name === 'failing-channel') {
            setTimeout(() => callback('CHANNEL_ERROR', new Error('Channel failed')), 50);
          } else {
            setTimeout(() => callback('SUBSCRIBED'), 50);
          }
          return {};
        }),
        unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
      })) as any);

      const { result } = renderHook(() =>
        useMultipleRealtimeSubscriptions({
          subscriptions: [
            {
              channelName: 'working-channel',
              options: { table: 'posts' },
            },
            {
              channelName: 'failing-channel',
              options: { table: 'notifications', autoReconnect: false },
            },
          ],
          onGlobalError,
        })
      );

      act(() => {
        result.current.subscribeAll();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      const status = result.current.globalConnectionStatus;
      expect(status.connectedChannels).toBe(1);
      expect(status.errorChannels).toBe(1);
      expect(status.allConnected).toBe(false);
      expect(status.hasErrors).toBe(true);
      expect(onGlobalError).toHaveBeenCalledWith(
        expect.any(Error),
        'failing-channel'
      );
    });

    it('should handle global operations', async () => {
      const { result } = renderHook(() =>
        useMultipleRealtimeSubscriptions({
          subscriptions: [
            {
              channelName: 'channel1',
              options: { table: 'posts' },
            },
            {
              channelName: 'channel2', 
              options: { table: 'users' },
            },
          ],
        })
      );

      // Subscribe all
      act(() => {
        result.current.subscribeAll();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.globalConnectionStatus.connectedChannels).toBe(2);

      // Reconnect all
      act(() => {
        result.current.reconnectAll();
      });

      // Unsubscribe all
      act(() => {
        result.current.unsubscribeAll();
      });

      expect(result.current.globalConnectionStatus.connectedChannels).toBe(0);
    });
  });

  describe('Global Status Management', () => {
    it('should provide accurate global connection status', async () => {
      const { result } = renderHook(() =>
        useMultipleRealtimeSubscriptions({
          subscriptions: [
            { channelName: 'ch1', options: { table: 'posts' } },
            { channelName: 'ch2', options: { table: 'users' } },
            { channelName: 'ch3', options: { table: 'notifications' } },
          ],
        })
      );

      const initialStatus = result.current.globalConnectionStatus;
      expect(initialStatus.totalChannels).toBe(3);
      expect(initialStatus.connectedChannels).toBe(0);
      expect(initialStatus.allConnected).toBe(false);
      expect(initialStatus.anyConnecting).toBe(false);
      expect(initialStatus.hasErrors).toBe(false);

      // Start connecting
      act(() => {
        result.current.subscribeAll();
      });

      // During connection
      let duringStatus = result.current.globalConnectionStatus;
      expect(duringStatus.anyConnecting).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // After connection
      const finalStatus = result.current.globalConnectionStatus;
      expect(finalStatus.connectedChannels).toBe(3);
      expect(finalStatus.allConnected).toBe(true);
      expect(finalStatus.anyConnecting).toBe(false);
    });
  });
});