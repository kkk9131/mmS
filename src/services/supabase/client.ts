import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { FeatureFlagsManager } from '../featureFlags';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  debug?: boolean;
}

export interface SupabaseConnectionStatus {
  isConnected: boolean;
  error?: string;
  lastChecked: Date;
  responseTime?: number;
}

export class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;
  private connectionStatus: SupabaseConnectionStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  private constructor() {}

  public static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  public initialize(config: SupabaseConfig): SupabaseClient {
    const featureFlags = FeatureFlagsManager.getInstance();
    
    if (!featureFlags.isSupabaseEnabled()) {
      throw new Error('Supabase is disabled by feature flags');
    }

    this.config = config;
    
    try {
      this.client = createClient(config.url, config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            'X-Client-Info': 'mamapace-mobile'
          }
        }
      });

      if (config.debug) {
        console.log('Supabase client initialized successfully');
        console.log('URL:', config.url);
        console.log('Anon Key:', config.anonKey.substring(0, 20) + '...');
      }

      return this.client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize Supabase client:', errorMessage);
      throw new Error(`Supabase initialization failed: ${errorMessage}`);
    }
  }

  public getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  public async testConnection(): Promise<SupabaseConnectionStatus> {
    if (!this.client) {
      this.connectionStatus = {
        isConnected: false,
        error: 'Client not initialized',
        lastChecked: new Date(),
      };
      return this.connectionStatus;
    }

    const startTime = Date.now();
    
    try {
      // Try to fetch the current user session to test connection
      const { data, error } = await this.client.auth.getSession();
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        this.connectionStatus = {
          isConnected: false,
          error: error.message,
          lastChecked: new Date(),
          responseTime,
        };
      } else {
        this.connectionStatus = {
          isConnected: true,
          lastChecked: new Date(),
          responseTime,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.connectionStatus = {
        isConnected: false,
        error: errorMessage,
        lastChecked: new Date(),
        responseTime,
      };
    }

    return this.connectionStatus;
  }

  public getConnectionStatus(): SupabaseConnectionStatus {
    return { ...this.connectionStatus };
  }

  public async getCurrentUser(): Promise<User | null> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      
      if (error) {
        console.error('Failed to get current user:', error.message);
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  public async getCurrentSession(): Promise<Session | null> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data: { session }, error } = await this.client.auth.getSession();
      
      if (error) {
        console.error('Failed to get current session:', error.message);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  public onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    return this.client.auth.onAuthStateChange(callback);
  }

  public getConfig(): SupabaseConfig | null {
    return this.config ? { ...this.config } : null;
  }

  public isInitialized(): boolean {
    return this.client !== null;
  }

  public dispose(): void {
    this.client = null;
    this.config = null;
    this.connectionStatus = {
      isConnected: false,
      lastChecked: new Date(),
    };
  }
}

// Default instance
export const supabaseClient = SupabaseClientManager.getInstance();