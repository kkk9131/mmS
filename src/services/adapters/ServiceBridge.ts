import { FeatureFlagsManager } from '../featureFlags';
import type { RootState } from '../../store';

/**
 * Service bridge that provides a safe way to access Redux store from services
 * without creating circular dependencies
 */
export class ServiceBridge {
  private static store: any = null;
  private static featureFlags = FeatureFlagsManager.getInstance();

  /**
   * Initialize the bridge with the Redux store
   */
  public static initialize(store: any) {
    this.store = store;
  }

  /**
   * Get the Redux store instance
   */
  public static getStore() {
    if (!this.store) {
      throw new Error('ServiceBridge not initialized. Call initialize() with the Redux store first.');
    }
    return this.store;
  }

  /**
   * Check if Redux integration is available
   */
  public static isReduxAvailable(): boolean {
    return this.store !== null && this.featureFlags.isReduxEnabled();
  }

  /**
   * Check if Supabase integration is available
   */
  public static isSupabaseAvailable(): boolean {
    return this.featureFlags.isSupabaseEnabled() && this.isReduxAvailable();
  }

  /**
   * Safely dispatch an action
   */
  public static async dispatch(action: any) {
    if (!this.isReduxAvailable()) {
      throw new Error('Redux not available');
    }
    return this.store.dispatch(action);
  }

  /**
   * Get current state
   */
  public static getState() {
    if (!this.isReduxAvailable()) {
      throw new Error('Redux not available');
    }
    return this.store.getState() as RootState;
  }
}