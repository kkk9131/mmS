import { FeatureFlags } from '../types/api';

export class FeatureFlagsManager {
  private static instance: FeatureFlagsManager;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = this.loadFlags();
  }

  public static getInstance(): FeatureFlagsManager {
    if (!FeatureFlagsManager.instance) {
      FeatureFlagsManager.instance = new FeatureFlagsManager();
    }
    return FeatureFlagsManager.instance;
  }

  private loadFlags(): FeatureFlags {
    const isDevelopment = __DEV__ ?? false;
    
    return {
      USE_API: !isDevelopment,
      DEBUG_MODE: isDevelopment,
      MOCK_DELAY: isDevelopment ? 500 : 0,
    };
  }

  public getFlag<K extends keyof FeatureFlags>(flagName: K): FeatureFlags[K] {
    return this.flags[flagName];
  }

  public getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public setFlag<K extends keyof FeatureFlags>(flagName: K, value: FeatureFlags[K]): void {
    this.flags[flagName] = value;
  }

  public updateFlags(updates: Partial<FeatureFlags>): void {
    this.flags = { ...this.flags, ...updates };
  }

  public resetFlags(): void {
    this.flags = this.loadFlags();
  }

  public enableApiMode(): void {
    this.flags.USE_API = true;
    this.flags.DEBUG_MODE = false;
    this.flags.MOCK_DELAY = 0;
  }

  public enableMockMode(): void {
    this.flags.USE_API = false;
    this.flags.DEBUG_MODE = true;
    this.flags.MOCK_DELAY = 500;
  }

  public enableDebugMode(): void {
    this.flags.DEBUG_MODE = true;
  }

  public disableDebugMode(): void {
    this.flags.DEBUG_MODE = false;
  }

  public isApiEnabled(): boolean {
    return this.flags.USE_API;
  }

  public isDebugModeEnabled(): boolean {
    return this.flags.DEBUG_MODE;
  }

  public getMockDelay(): number {
    return this.flags.MOCK_DELAY;
  }
}