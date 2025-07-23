import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from '../../../services/supabase/client';
import { mockSupabaseClient, MockSupabaseClient } from '../../utils/mockSupabaseClient';

// Mock the Supabase client creation
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('SupabaseClient', () => {
  beforeEach(() => {
    // Reset client state
    // supabaseClient.reset(); // Method doesn't exist
    mockSupabaseClient.resetMockDb();
  });

  describe('Initialization', () => {
    it('should not be initialized by default', () => {
      expect(supabaseClient.isInitialized()).toBe(false);
    });

    it('should initialize with environment variables', () => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
      expect(supabaseClient.isInitialized()).toBe(true);
    });

    it('should throw error when initializing without environment variables', () => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => supabaseClient.initialize({} as any)).toThrow();
    });

    it('should return existing client on multiple initialize calls', () => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
      const client1 = supabaseClient.getClient();
      
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
      const client2 = supabaseClient.getClient();

      expect(client1).toBe(client2);
    });
  });

  describe('Client Access', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should return initialized client', () => {
      const client = supabaseClient.getClient();
      expect(client).toBeDefined();
      expect(client).toBe(mockSupabaseClient);
    });

    it('should throw error when accessing uninitialized client', () => {
      // supabaseClient.reset(); // Method doesn't exist
      expect(() => supabaseClient.getClient()).toThrow('Supabase client not initialized');
    });
  });

  describe('Authentication State', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should detect authenticated user', async () => {
      // Mock successful authentication
      await mockSupabaseClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      const { data: { user } } = await supabaseClient.getClient().auth.getUser();
      expect(user).toBeTruthy();
    });

    it('should detect unauthenticated user', async () => {
      await mockSupabaseClient.auth.signOut();
      
      const { data: { user } } = await supabaseClient.getClient().auth.getUser();
      expect(user).toBeNull();
    });

    it('should get current user', async () => {
      await mockSupabaseClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      const user = await supabaseClient.getCurrentUser();
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null for current user when not authenticated', async () => {
      await mockSupabaseClient.auth.signOut();
      
      const user = await supabaseClient.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('Database Operations', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should perform select operations', async () => {
      const client = supabaseClient.getClient();
      const result = await client.from('posts').select('*');
      
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should perform insert operations', async () => {
      const client = supabaseClient.getClient();
      const newPost = {
        user_id: 'user_123',
        content: 'Test post content',
        is_anonymous: false,
      };

      const result = await client.from('posts').insert(newPost).select().single();
      
      expect(result.data).toBeDefined();
      expect(result.data.content).toBe('Test post content');
      expect(result.error).toBeNull();
    });

    it('should handle database errors', async () => {
      const client = supabaseClient.getClient();
      
      // Try to get a non-existent post
      const result = await client
        .from('posts')
        .select('*')
        .eq('id', 'non-existent-id')
        .single();
      
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Post not found');
    });
  });

  describe('Realtime Subscriptions', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should create realtime channels', () => {
      const client = supabaseClient.getClient();
      const channel = client.channel('test-channel');
      
      expect(channel).toBeDefined();
      expect(client.channel).toHaveBeenCalledWith('test-channel');
    });

    it('should setup realtime listeners', () => {
      const client = supabaseClient.getClient();
      const channel = client.channel('test-channel');
      const mockCallback = jest.fn();
      
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, mockCallback);
      
      expect(channel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        mockCallback
      );
    });

    it('should handle channel subscriptions', async () => {
      const client = supabaseClient.getClient();
      const channel = client.channel('test-channel');
      const mockCallback = jest.fn();
      
      channel.subscribe(mockCallback);
      
      // Wait for async subscription
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockCallback).toHaveBeenCalledWith('SUBSCRIBED');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should handle authentication errors', async () => {
      const result = await mockSupabaseClient.auth.signInWithPassword({
        email: 'invalid@example.com',
        password: 'wrongpassword',
      });

      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid credentials');
    });

    it('should handle database operation errors', async () => {
      const client = supabaseClient.getClient();
      
      // Mock a database operation that would fail
      const mockDb = mockSupabaseClient.getMockDb();
      jest.spyOn(mockDb, 'getPost').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await client
        .from('posts')
        .select('*')
        .eq('id', 'test-id')
        .single();

      expect(result.error).toBeDefined();
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should maintain single client instance', () => {
      const client1 = supabaseClient.getClient();
      const client2 = supabaseClient.getClient();
      
      expect(client1).toBe(client2);
    });

    it('should handle multiple concurrent requests', async () => {
      const client = supabaseClient.getClient();
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        client.from('posts').insert({
          user_id: `user_${i}`,
          content: `Test content ${i}`,
          is_anonymous: false,
        }).select().single()
      );

      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result.data).toBeDefined();
        expect(result.data.content).toBe(`Test content ${index}`);
        expect(result.error).toBeNull();
      });
    });

    it('should handle connection state changes', async () => {
      // Test connection state monitoring
      const client = supabaseClient.getClient();
      const mockCallback = jest.fn();
      
      client.auth.onAuthStateChange(mockCallback);
      
      // Simulate authentication state change
      await mockSupabaseClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(client.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback);
    });
  });

  describe('Data Consistency', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      supabaseClient.initialize({ url: 'test-url', anonKey: 'test-key' });
    });

    it('should maintain data integrity across operations', async () => {
      const client = supabaseClient.getClient();
      const mockDb = mockSupabaseClient.getMockDb();
      
      // Create a post
      const createResult = await client.from('posts').insert({
        user_id: 'user_123',
        content: 'Original content',
        is_anonymous: false,
      }).select().single();
      
      expect(createResult.data).toBeDefined();
      const postId = createResult.data.id;
      
      // Update the post
      const updateResult = await client
        .from('posts')
        .update({ content: 'Updated content' })
        .eq('id', postId)
        .select()
        .single();
      
      expect(updateResult.data.content).toBe('Updated content');
      
      // Verify the update persisted
      const getResult = await client
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      expect(getResult.data.content).toBe('Updated content');
    });

    it('should handle concurrent updates correctly', async () => {
      const client = supabaseClient.getClient();
      
      // Create initial post
      const createResult = await client.from('posts').insert({
        user_id: 'user_123',
        content: 'Initial content',
        is_anonymous: false,
      }).select().single();
      
      const postId = createResult.data.id;
      
      // Simulate concurrent updates
      const updatePromises = [
        client.from('posts').update({ content: 'Update 1' }).eq('id', postId).select().single(),
        client.from('posts').update({ content: 'Update 2' }).eq('id', postId).select().single(),
      ];
      
      const results = await Promise.all(updatePromises);
      
      // Both updates should succeed (last one wins in this mock implementation)
      results.forEach(result => {
        expect(result.error).toBeNull();
      });
    });
  });
});