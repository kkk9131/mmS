import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabaseClient } from './client';
import { UserInsert, User as DatabaseUser } from '../../types/supabase';
// import { createHash } from 'expo-crypto'; // Not available
import * as Crypto from 'expo-crypto';
import { supabaseDebugger } from '../../utils/supabaseDebug';

export interface MaternalBookCredentials {
  mothersHandbookNumber: string;
  nickname: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  user_id?: string;
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
   * Uses custom database function for authentication
   */
  public async signInWithMaternalBook(credentials: MaternalBookCredentials): Promise<AuthResult> {
    const client = supabaseClient.getClient();

    try {
      // Call custom authentication function
      console.log('🔵 カスタム認証関数を呼び出し中...', {
        mothersHandbookNumber: credentials.mothersHandbookNumber,
        nickname: credentials.nickname
      });
      
      // ニックネームの詳細チェック
      if (credentials.nickname.includes('_修正')) {
        console.warn('⚠️ 送信されるニックネームに「_修正」が含まれています:', credentials.nickname);
        console.warn('⚠️ これはユーザーが入力した値です');
      }
      
      supabaseDebugger.log('signInWithMaternalBook:start', true, null, {
        hasClient: !!client,
        credentials: { 
          mothersHandbookNumber: credentials.mothersHandbookNumber,
          nickname: credentials.nickname 
        }
      });

      // Try improved auth function first, fallback to original if not exists
      let authResult, functionError;
      
      try {
        const improvedAuth = await client
          .rpc('auth_with_maternal_book_improved', {
            maternal_book_param: credentials.mothersHandbookNumber,
            user_nickname_param: credentials.nickname
          });
        
        if (improvedAuth.data && improvedAuth.data.length > 0 && improvedAuth.data[0].error_message) {
          // Handle user-friendly error from improved function
          console.error('❌ 認証エラー:', improvedAuth.data[0].error_message);
          const authError = new AuthError(
            improvedAuth.data[0].error_message,
            400,
            'custom_auth_error'
          );
          return { 
            user: null, 
            session: null, 
            error: authError
          };
        }
        
        authResult = improvedAuth.data;
        functionError = improvedAuth.error;
      } catch (error) {
        // Fallback to original function if improved doesn't exist
        console.log('🔄 改善された認証関数が見つかりません。元の関数を使用します。');
        const originalAuth = await client
          .rpc('auth_with_maternal_book', {
            maternal_book_param: credentials.mothersHandbookNumber,
            user_nickname_param: credentials.nickname
          });
        authResult = originalAuth.data;
        functionError = originalAuth.error;
      }

      if (functionError) {
        console.error('❌ カスタム認証関数エラー:', functionError);
        const authError = new AuthError(
          functionError.message || 'カスタム認証エラー',
          400,
          'custom_auth_error'
        );
        return { 
          user: null, 
          session: null, 
          error: authError
        };
      }

      if (!authResult || authResult.length === 0) {
        console.error('❌ 認証結果が空です');
        const authError = new AuthError(
          '認証に失敗しました',
          401,
          'authentication_failed'
        );
        return { 
          user: null, 
          session: null, 
          error: authError
        };
      }

      const result = authResult[0];
      console.log('✅ カスタム認証成功:', result);

      // Create mock user and session objects compatible with Supabase auth
      const mockUser: User = {
        id: result.user_id,
        email: `${credentials.mothersHandbookNumber}@maternal.book`,
        app_metadata: { provider: 'maternal_book' },
        user_metadata: { 
          nickname: credentials.nickname,
          maternal_book_number: credentials.mothersHandbookNumber
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: undefined,
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: 'authenticated',
        is_anonymous: false
      };

      const mockSession: Session = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer',
        user: mockUser
      };

      return { 
        user: mockUser, 
        session: mockSession, 
        user_id: result.user_id,
        error: null 
      };
    } catch (error) {
      console.error('💥 signInWithMaternalBook エラー:', error);
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign up is handled by the same function as sign in
   * The database function creates new users automatically
   */
  public async signUpWithMaternalBook(credentials: MaternalBookCredentials): Promise<AuthResult> {
    // Use the same function as sign in - it handles both new and existing users
    return this.signInWithMaternalBook(credentials);
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
   * For custom auth, this returns null - user info is managed by Redux
   */
  public async getCurrentUser(): Promise<User | null> {
    console.log('🔍 getCurrentUser: カスタム認証では null を返します');
    return null;
  }

  /**
   * Get current session
   * For custom auth, this returns null - session is managed by Redux
   */
  public async getCurrentSession(): Promise<Session | null> {
    console.log('🔍 getCurrentSession: カスタム認証では null を返します');
    return null;
  }

  /**
   * Get user profile from database
   */
  public async getUserProfile(userId?: string): Promise<DatabaseUser | null> {
    const client = supabaseClient.getClient();
    const currentUser = await this.getCurrentUser();
    const targetUserId = userId || currentUser?.id;

    console.log('🔍 getUserProfile Debug:', {
      requestedUserId: userId,
      currentUserId: currentUser?.id,
      targetUserId,
      hasCurrentUser: !!currentUser
    });

    if (!targetUserId) {
      console.warn('⚠️ No target user ID available for profile fetch');
      return null;
    }

    try {
      // まず存在確認のためmaybeSingleを使用
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (error) {
        console.error('❌ Failed to get user profile:', {
          error,
          code: error.code,
          message: error.message,
          userId: targetUserId
        });
        
        // PGRST116エラー（レコードが存在しない）の場合、ユーザーを作成
        if (error.code === 'PGRST116' && currentUser) {
          console.log('📝 Creating missing user profile for:', currentUser.id);
          return await this.createUserProfile(currentUser);
        }
        
        return null;
      }

      if (!data) {
        console.warn('⚠️ User profile not found in database:', targetUserId);
        
        // 現在のユーザーで、プロファイルが存在しない場合は作成
        if (currentUser && targetUserId === currentUser.id) {
          console.log('📝 Creating user profile for authenticated user:', currentUser.id);
          return await this.createUserProfile(currentUser);
        }
        
        return null;
      }

      console.log('✅ User profile found:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Create user profile in database
   */
  private async createUserProfile(user: User): Promise<DatabaseUser | null> {
    const client = supabaseClient.getClient();
    
    console.log('📝 Creating user profile for:', user.id);
    
    try {
      const userProfile = {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'ユーザー',
        avatar_url: user.user_metadata?.avatar_url || null,
        bio: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('users')
        .insert(userProfile)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create user profile:', error);
        return null;
      }

      console.log('✅ User profile created successfully:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
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