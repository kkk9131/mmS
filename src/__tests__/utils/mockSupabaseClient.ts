import { SupabaseClient, User, Session, AuthResponse, AuthError } from '@supabase/supabase-js';

// Mock data types
export interface MockPost {
  id: string;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockUser {
  id: string;
  nickname: string;
  email?: string;
  avatar_url?: string;
  created_at: string;
}

export interface MockNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Mock database state
class MockDatabase {
  private posts: MockPost[] = [];
  private users: MockUser[] = [];
  private notifications: MockNotification[] = [];
  private follows: { follower_id: string; following_id: string }[] = [];
  private likes: { user_id: string; post_id: string }[] = [];
  private comments: { id: string; post_id: string; user_id: string; content: string }[] = [];

  // Post operations
  getPosts(filters?: any): MockPost[] {
    let result = [...this.posts];
    
    if (filters?.user_id) {
      result = result.filter(p => p.user_id === filters.user_id);
    }
    
    if (filters?.limit) {
      result = result.slice(0, filters.limit);
    }
    
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  getPost(id: string): MockPost | null {
    return this.posts.find(p => p.id === id) || null;
  }

  createPost(post: Omit<MockPost, 'id' | 'created_at' | 'updated_at'>): MockPost {
    const newPost: MockPost = {
      ...post,
      id: `post_${Date.now()}_${Math.random()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.posts.push(newPost);
    return newPost;
  }

  updatePost(id: string, updates: Partial<MockPost>): MockPost | null {
    const postIndex = this.posts.findIndex(p => p.id === id);
    if (postIndex === -1) return null;
    
    this.posts[postIndex] = {
      ...this.posts[postIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return this.posts[postIndex];
  }

  deletePost(id: string): boolean {
    const postIndex = this.posts.findIndex(p => p.id === id);
    if (postIndex === -1) return false;
    
    this.posts.splice(postIndex, 1);
    return true;
  }

  // User operations
  getUsers(): MockUser[] {
    return [...this.users];
  }

  getUser(id: string): MockUser | null {
    return this.users.find(u => u.id === id) || null;
  }

  createUser(user: Omit<MockUser, 'id' | 'created_at'>): MockUser {
    const newUser: MockUser = {
      ...user,
      id: `user_${Date.now()}_${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    this.users.push(newUser);
    return newUser;
  }

  // Notification operations
  getNotifications(userId: string, filters?: any): MockNotification[] {
    let result = this.notifications.filter(n => n.user_id === userId);
    
    if (filters?.unread_only) {
      result = result.filter(n => !n.is_read);
    }
    
    if (filters?.type) {
      result = result.filter(n => n.type === filters.type);
    }
    
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  createNotification(notification: Omit<MockNotification, 'id' | 'created_at'>): MockNotification {
    const newNotification: MockNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    this.notifications.push(newNotification);
    return newNotification;
  }

  markNotificationsAsRead(notificationIds: string[]): number {
    let updatedCount = 0;
    this.notifications.forEach(n => {
      if (notificationIds.includes(n.id) && !n.is_read) {
        n.is_read = true;
        updatedCount++;
      }
    });
    return updatedCount;
  }

  // Follow operations
  follow(followerId: string, followingId: string): boolean {
    const existingFollow = this.follows.find(f => 
      f.follower_id === followerId && f.following_id === followingId
    );
    if (existingFollow) return false;
    
    this.follows.push({ follower_id: followerId, following_id: followingId });
    return true;
  }

  unfollow(followerId: string, followingId: string): boolean {
    const followIndex = this.follows.findIndex(f => 
      f.follower_id === followerId && f.following_id === followingId
    );
    if (followIndex === -1) return false;
    
    this.follows.splice(followIndex, 1);
    return true;
  }

  getFollowStatus(followerId: string, followingId: string): boolean {
    return this.follows.some(f => 
      f.follower_id === followerId && f.following_id === followingId
    );
  }

  // Like operations
  likePost(userId: string, postId: string): boolean {
    const existingLike = this.likes.find(l => l.user_id === userId && l.post_id === postId);
    if (existingLike) return false;
    
    this.likes.push({ user_id: userId, post_id: postId });
    return true;
  }

  unlikePost(userId: string, postId: string): boolean {
    const likeIndex = this.likes.findIndex(l => l.user_id === userId && l.post_id === postId);
    if (likeIndex === -1) return false;
    
    this.likes.splice(likeIndex, 1);
    return true;
  }

  getPostLikes(postId: string): { user_id: string; post_id: string }[] {
    return this.likes.filter(l => l.post_id === postId);
  }

  // Utility methods
  reset(): void {
    this.posts = [];
    this.users = [];
    this.notifications = [];
    this.follows = [];
    this.likes = [];
    this.comments = [];
  }

  seed(): void {
    // Create sample users
    const user1 = this.createUser({
      nickname: 'テストユーザー1',
      email: 'test1@example.com',
    });

    const user2 = this.createUser({
      nickname: 'テストユーザー2',
      email: 'test2@example.com',
    });

    // Create sample posts
    this.createPost({
      user_id: user1.id,
      content: 'これはテスト投稿です',
      is_anonymous: false,
    });

    this.createPost({
      user_id: user2.id,
      content: '匿名テスト投稿',
      is_anonymous: true,
    });

    // Create sample notifications
    this.createNotification({
      user_id: user1.id,
      type: 'like',
      title: 'いいね',
      message: 'あなたの投稿にいいねがつきました',
      is_read: false,
    });
  }
}

// Create mock Supabase client
export class MockSupabaseClient {
  private mockDb = new MockDatabase();
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  
  constructor() {
    this.mockDb.seed();
  }

  // Auth mock
  auth = {
    signInWithPassword: jest.fn(async ({ email, password }: { email: string; password: string }): Promise<AuthResponse> => {
      if (email === 'test@example.com' && password === 'password123') {
        const mockUser: User = {
          id: 'user_123',
          email,
          phone: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: '',
          confirmation_sent_at: undefined,
          recovery_sent_at: undefined,
          email_change_sent_at: undefined,
          new_email: undefined,
          new_phone: undefined,
          invited_at: undefined,
          action_link: undefined,
          phone_confirmed_at: undefined,
          confirmed_at: undefined,
        };

        const mockSession: Session = {
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer',
          user: mockUser,
        };

        this.currentUser = mockUser;
        this.currentSession = mockSession;

        return {
          data: {
            user: mockUser,
            session: mockSession,
          },
          error: null,
        };
      }
      
      const error: AuthError = {
        name: 'AuthError',
        message: 'Invalid credentials',
      } as AuthError;

      return {
        data: {
          user: null,
          session: null,
        },
        error,
      };
    }),

    signOut: jest.fn(async () => {
      this.currentUser = null;
      this.currentSession = null;
      return { error: null };
    }),

    getUser: jest.fn(async () => {
      if (this.currentUser) {
        return { data: { user: this.currentUser }, error: null };
      }
      return { data: { user: null }, error: { message: 'No user found' } };
    }),

    getSession: jest.fn(async () => {
      if (this.currentSession) {
        return { data: { session: this.currentSession }, error: null };
      }
      return { data: { session: null }, error: null };
    }),

    onAuthStateChange: jest.fn((callback) => {
      // Mock subscription
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    }),
  };

  // Database mock
  from = jest.fn((table: string) => {
    return {
      select: jest.fn((columns = '*') => ({
        eq: jest.fn((column: string, value: any) => ({
          single: jest.fn(async () => {
            try {
              switch (table) {
                case 'posts':
                  const post = column === 'id' 
                    ? this.mockDb.getPost(value) 
                    : this.mockDb.getPosts({ [column]: value })[0];
                  
                  if (!post) {
                    return { data: null, error: { message: 'Post not found' } };
                  }
                  return { data: post, error: null };

                case 'users':
                  const user = this.mockDb.getUser(value);
                  if (!user) {
                    return { data: null, error: { message: 'User not found' } };
                  }
                  return { data: user, error: null };

                default:
                  return { data: null, error: { message: 'Table not found' } };
              }
            } catch (error) {
              return { data: null, error };
            }
          }),

          async: jest.fn(async () => {
            try {
              switch (table) {
                case 'posts':
                  const posts = column === 'user_id' 
                    ? this.mockDb.getPosts({ user_id: value })
                    : this.mockDb.getPosts();
                  return { data: posts, error: null };

                case 'notifications':
                  const notifications = this.mockDb.getNotifications(value);
                  return { data: notifications, error: null };

                default:
                  return { data: [], error: null };
              }
            } catch (error) {
              return { data: null, error };
            }
          }),
        })),

        limit: jest.fn((count: number) => ({
          async: jest.fn(async () => {
            switch (table) {
              case 'posts':
                const limitedPosts = this.mockDb.getPosts({ limit: count });
                return { data: limitedPosts, error: null };
              default:
                return { data: [], error: null };
            }
          }),
        })),

        order: jest.fn((column: string, options?: { ascending: boolean }) => ({
          async: jest.fn(async () => {
            switch (table) {
              case 'posts':
                const posts = this.mockDb.getPosts();
                return { data: posts, error: null };
              default:
                return { data: [], error: null };
            }
          }),
        })),

        async: jest.fn(async () => {
          switch (table) {
            case 'posts':
              return { data: this.mockDb.getPosts(), error: null };
            case 'users':
              return { data: this.mockDb.getUsers(), error: null };
            default:
              return { data: [], error: null };
          }
        }),
      })),

      insert: jest.fn((data: any) => ({
        select: jest.fn(() => ({
          single: jest.fn(async () => {
            try {
              switch (table) {
                case 'posts':
                  const newPost = this.mockDb.createPost(data);
                  return { data: newPost, error: null };

                case 'users':
                  const newUser = this.mockDb.createUser(data);
                  return { data: newUser, error: null };

                case 'notifications':
                  const newNotification = this.mockDb.createNotification(data);
                  return { data: newNotification, error: null };

                default:
                  return { data: null, error: { message: 'Table not supported' } };
              }
            } catch (error) {
              return { data: null, error };
            }
          }),
        })),
      })),

      update: jest.fn((data: any) => ({
        eq: jest.fn((column: string, value: any) => ({
          select: jest.fn(() => ({
            single: jest.fn(async () => {
              try {
                switch (table) {
                  case 'posts':
                    const updatedPost = this.mockDb.updatePost(value, data);
                    if (!updatedPost) {
                      return { data: null, error: { message: 'Post not found' } };
                    }
                    return { data: updatedPost, error: null };

                  default:
                    return { data: null, error: { message: 'Update not supported' } };
                }
              } catch (error) {
                return { data: null, error };
              }
            }),
          })),
        })),
      })),

      delete: jest.fn(() => ({
        eq: jest.fn((column: string, value: any) => ({
          async: jest.fn(async () => {
            try {
              switch (table) {
                case 'posts':
                  const deleted = this.mockDb.deletePost(value);
                  if (!deleted) {
                    return { data: null, error: { message: 'Post not found' } };
                  }
                  return { data: null, error: null };

                default:
                  return { data: null, error: { message: 'Delete not supported' } };
              }
            } catch (error) {
              return { data: null, error };
            }
          }),
        })),
      })),
    };
  });

  // Channel mock for realtime
  channel = jest.fn((name: string) => ({
    on: jest.fn(() => ({})),
    subscribe: jest.fn((callback) => {
      // Simulate successful subscription
      setTimeout(() => callback('SUBSCRIBED'), 100);
      return {};
    }),
    unsubscribe: jest.fn(() => Promise.resolve({ status: 'ok' })),
  }));

  // Storage mock (basic)
  storage = {
    from: jest.fn(() => ({
      upload: jest.fn(async () => ({ data: { path: 'mock/path' }, error: null })),
      download: jest.fn(async () => ({ data: new Blob(), error: null })),
      remove: jest.fn(async () => ({ data: null, error: null })),
    })),
  };

  // Utility methods for testing
  getMockDb(): MockDatabase {
    return this.mockDb;
  }

  resetMockDb(): void {
    this.mockDb.reset();
    this.mockDb.seed();
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }
}

// Create singleton instance for tests
export const mockSupabaseClient = new MockSupabaseClient();

// Helper to create a fresh mock client for each test
export const createMockSupabaseClient = (): MockSupabaseClient => {
  return new MockSupabaseClient();
};