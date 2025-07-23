import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabaseClient } from './client';
import { UserInsert, User as DatabaseUser } from '../../types/supabase';
// import { createHash } from 'expo-crypto'; // Not available
import * as Crypto from 'expo-crypto';

export interface MaternalBookCredentials {
  mothersHandbookNumber: string;
  nickname: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error?: AuthError | null;
}

export interface AuthStateChangeEvent {
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY';
  session: Session | null;
}

export class SupabaseAuthService {
  private static instance: SupabaseAuthService;

  private constructor() {}

  public static getInstance(): SupabaseAuthService {
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = new SupabaseAuthService();
    }
    return SupabaseAuthService.instance;
  }

  /**
   * Maternal book number authentication
   * Uses hashed maternal book number as password for consistency
   */
  public async signInWithMaternalBook(credentials: MaternalBookCredentials): Promise<AuthResult> {
    const client = supabaseClient.getClient();
    
    // Hash the maternal book number to use as password
    const hashedPassword = await this.hashMaternalBookNumber(credentials.mothersHandbookNumber);
    
    // Generate email from maternal book number for Supabase auth
    const email = this.generateEmailFromMaternalBook(credentials.mothersHandbookNumber);

    try {
      // Try to sign in first
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: hashedPassword
      });

      if (error && error.message.includes('Invalid login credentials')) {
        // User doesn't exist, create account
        return await this.signUpWithMaternalBook(credentials);
      }

      if (error) {
        return { user: null, session: null, error };
      }

      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Create account with maternal book number
   */
  public async signUpWithMaternalBook(credentials: MaternalBookCredentials): Promise<AuthResult> {
    const client = supabaseClient.getClient();
    
    const hashedPassword = await this.hashMaternalBookNumber(credentials.mothersHandbookNumber);
    const email = this.generateEmailFromMaternalBook(credentials.mothersHandbookNumber);

    try {
      // Create auth user
      const { data: authData, error: authError } = await client.auth.signUp({
        email,
        password: hashedPassword
      });

      if (authError || !authData.user) {
        return { user: null, session: null, error: authError };
      }

      // Create user profile
      const userProfile: UserInsert = {
        id: authData.user.id,
        nickname: credentials.nickname,
        maternal_book_number: credentials.mothersHandbookNumber,
        privacy_settings: {
          profile_visible: true,
          posts_visible: true
        }
      };

      const { error: profileError } = await client
        .from('users')
        .insert(userProfile);

      if (profileError) {
        console.error('Failed to create user profile:', profileError);
        // Auth user was created but profile failed - should handle cleanup
      }

      return { user: authData.user, session: authData.session, error: null };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign out current user
   */
  public async signOut(): Promise<{ error: AuthError | null }> {
    const client = supabaseClient.getClient();
    
    try {
      const { error } = await client.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  }

  /**
   * Get current authenticated user
   */
  public async getCurrentUser(): Promise<User | null> {
    return await supabaseClient.getCurrentUser();
  }

  /**
   * Get current session
   */
  public async getCurrentSession(): Promise<Session | null> {
    return await supabaseClient.getCurrentSession();
  }

  /**
   * Get user profile from database
   */
  public async getUserProfile(userId?: string): Promise<DatabaseUser | null> {
    const client = supabaseClient.getClient();
    const targetUserId = userId || (await this.getCurrentUser())?.id;

    if (!targetUserId) {
      return null;
    }

    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
        console.error('Failed to get user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  public async updateUserProfile(updates: Partial<DatabaseUser>): Promise<{ error: Error | null }> {
    const client = supabaseClient.getClient();
    const currentUser = await this.getCurrentUser();

    if (!currentUser) {
      return { error: new Error('No authenticated user') };
    }

    try {
      const { error } = await client
        .from('users')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) {
        console.error('Failed to update user profile:', error);
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  /**
   * Listen to auth state changes
   */
  public onAuthStateChange(callback: (event: AuthStateChangeEvent) => void) {
    return supabaseClient.onAuthStateChange((event, session) => {
      callback({ event: event as any, session });
    });
  }

  /**
   * Check if maternal book number is already registered
   */
  public async isMaternalBookNumberRegistered(mothersHandbookNumber: string): Promise<boolean> {
    const client = supabaseClient.getClient();

    try {
      const { data, error } = await client
        .from('users')
        .select('id')
        .eq('maternal_book_number', mothersHandbookNumber)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking maternal book number:', error);
        return false;
      }

      return data !== null;
    } catch (error) {
      console.error('Error checking maternal book number:', error);
      return false;
    }
  }

  /**
   * Hash maternal book number for password
   */
  private async hashMaternalBookNumber(mothersHandbookNumber: string): Promise<string> {
    // Use a combination of the maternal book number and a salt for security
    const saltedValue = `mamapace_${mothersHandbookNumber}_auth`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, saltedValue, { encoding: Crypto.CryptoEncoding.HEX });
    return hash.substring(0, 32); // Truncate to 32 characters for consistency
  }

  /**
   * Generate email from maternal book number for Supabase auth
   */
  private generateEmailFromMaternalBook(mothersHandbookNumber: string): string {
    // Create a deterministic email from the maternal book number
    const sanitized = mothersHandbookNumber.replace(/[^a-zA-Z0-9]/g, '');
    return `user_${sanitized}@mamapace.local`;
  }
}

// Default instance
export const supabaseAuth = SupabaseAuthService.getInstance();