# Design Document

## Overview

MamapaceアプリにSupabaseバックエンドとRedux Toolkit状態管理を統合し、モックシステムから本格的なデータベース駆動アプリケーションへ移行します。既存のサービス層アーキテクチャを維持しながら、Supabaseの認証、リアルタイム機能、PostgreSQLデータベースを活用します。

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
├─────────────────────────────────────────────────────────────┤
│  Components Layer                                           │
│  ├── Login Screen                                           │
│  ├── Home Screen (Posts)                                    │
│  ├── Notifications Screen                                   │
│  └── Profile Screen                                         │
├─────────────────────────────────────────────────────────────┤
│  Redux State Management Layer                               │
│  ├── Auth Slice (user, session)                            │
│  ├── Posts Slice (posts, likes, comments)                  │
│  ├── Notifications Slice (notifications, unread count)     │
│  ├── UI Slice (loading, errors)                            │
│  └── RTK Query API Slices                                  │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (Existing + Enhanced)                       │
│  ├── UserService → Supabase Users                          │
│  ├── PostsService → Supabase Posts                         │
│  ├── NotificationService → Supabase Notifications          │
│  ├── FollowService → Supabase Follows                      │
│  └── AuthService → Supabase Auth                           │
├─────────────────────────────────────────────────────────────┤
│  Supabase Integration Layer                                 │
│  ├── Supabase Client                                       │
│  ├── Real-time Subscriptions                               │
│  ├── Auth Management                                        │
│  └── Database Operations                                    │
├─────────────────────────────────────────────────────────────┤
│  Feature Flags & Configuration                             │
│  ├── USE_SUPABASE flag                                     │
│  ├── Environment Variables                                  │
│  └── Mock/Supabase Switching                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                         │
├─────────────────────────────────────────────────────────────┤
│  Authentication                                             │
│  ├── Custom Auth with Maternal Book Number                 │
│  ├── JWT Token Management                                   │
│  └── Row Level Security (RLS)                              │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                        │
│  ├── users (profiles, preferences)                         │
│  ├── posts (content, metadata)                             │
│  ├── likes (user_id, post_id)                              │
│  ├── comments (post_id, user_id, content)                  │
│  ├── notifications (user_id, type, data)                   │
│  └── follows (follower_id, following_id)                   │
├─────────────────────────────────────────────────────────────┤
│  Real-time Engine                                           │
│  ├── Post Updates                                          │
│  ├── Like/Comment Notifications                            │
│  └── Follow Notifications                                   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Supabase Client Configuration

```typescript
// src/services/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enableRealtime: boolean;
  enableAuth: boolean;
}

export class SupabaseClient {
  private static instance: SupabaseClient;
  private client: SupabaseClient<Database>;
  private config: SupabaseConfig;

  public static getInstance(): SupabaseClient;
  public getClient(): SupabaseClient<Database>;
  public async initialize(): Promise<void>;
  public async testConnection(): Promise<boolean>;
}
```

### 2. Redux Store Configuration

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

export interface RootState {
  auth: AuthState;
  posts: PostsState;
  notifications: NotificationsState;
  ui: UIState;
  api: ApiState; // RTK Query
}

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    posts: postsSlice.reducer,
    notifications: notificationsSlice.reducer,
    ui: uiSlice.reducer,
    api: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
});
```

### 3. Auth Slice with Supabase Integration

```typescript
// src/store/slices/authSlice.ts
export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => { /* ... */ },
    loginSuccess: (state, action) => { /* ... */ },
    loginFailure: (state, action) => { /* ... */ },
    logout: (state) => { /* ... */ },
    updateUser: (state, action) => { /* ... */ },
  },
});

// Async Thunks
export const loginWithMaternalBook = createAsyncThunk(
  'auth/loginWithMaternalBook',
  async ({ maternalBookNumber, nickname }: LoginCredentials) => {
    // Custom Supabase auth logic
  }
);
```

### 4. RTK Query API Integration

```typescript
// src/store/api/postsApi.ts
export const postsApi = createApi({
  reducerPath: 'postsApi',
  baseQuery: supabaseBaseQuery,
  tagTypes: ['Post', 'Comment', 'Like'],
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], GetPostsParams>({
      query: (params) => ({
        table: 'posts',
        method: 'select',
        params,
      }),
      providesTags: ['Post'],
    }),
    createPost: builder.mutation<Post, CreatePostData>({
      query: (data) => ({
        table: 'posts',
        method: 'insert',
        data,
      }),
      invalidatesTags: ['Post'],
    }),
    likePost: builder.mutation<void, { postId: string; userId: string }>({
      query: ({ postId, userId }) => ({
        table: 'likes',
        method: 'upsert',
        data: { post_id: postId, user_id: userId },
      }),
      invalidatesTags: ['Post', 'Like'],
    }),
  }),
});
```

### 5. Enhanced Service Layer

```typescript
// src/services/PostsService.ts (Enhanced)
export class PostsService {
  private supabaseClient: SupabaseClient;
  private featureFlags: FeatureFlagsManager;

  public async getPosts(params: GetPostsParams): Promise<Post[]> {
    if (this.featureFlags.isSupabaseEnabled()) {
      return this.getPostsFromSupabase(params);
    } else {
      return this.getMockPosts(params);
    }
  }

  private async getPostsFromSupabase(params: GetPostsParams): Promise<Post[]> {
    const { data, error } = await this.supabaseClient
      .from('posts')
      .select(`
        *,
        users:user_id (nickname, avatar),
        likes (count),
        comments (count)
      `)
      .order('created_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) throw error;
    return data;
  }

  // Real-time subscription
  public subscribeToPostUpdates(callback: (post: Post) => void): () => void {
    const subscription = this.supabaseClient
      .channel('posts')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => callback(payload.new as Post)
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }
}
```

## Data Models

### Database Schema

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL,
  maternal_book_number_hash VARCHAR(255) UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 600),
  is_anonymous BOOLEAN DEFAULT false,
  hashtags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Likes table
CREATE TABLE public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  post_id UUID REFERENCES public.posts(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Comments table
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follows table
CREATE TABLE public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) NOT NULL,
  following_id UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);
```

### Row Level Security (RLS) Policies

```sql
-- Users can only see and update their own profile
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Posts are visible to all authenticated users
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by authenticated users" ON public.posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id);

-- Similar policies for likes, comments, notifications, follows...
```

### TypeScript Types

```typescript
// src/types/supabase.ts
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          nickname: string;
          maternal_book_number_hash: string;
          bio: string | null;
          avatar_url: string | null;
          preferences: Json;
          privacy_settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          maternal_book_number_hash: string;
          bio?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          privacy_settings?: Json;
        };
        Update: {
          nickname?: string;
          bio?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          privacy_settings?: Json;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          is_anonymous: boolean;
          hashtags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          content: string;
          is_anonymous?: boolean;
          hashtags?: string[] | null;
        };
        Update: {
          content?: string;
          is_anonymous?: boolean;
          hashtags?: string[] | null;
          updated_at?: string;
        };
      };
      // ... other tables
    };
  };
}
```

## Error Handling

### Supabase Error Handling Strategy

```typescript
// src/utils/supabaseErrorHandler.ts
export class SupabaseErrorHandler {
  public static handleError(error: PostgrestError | AuthError): AppError {
    switch (error.code) {
      case 'PGRST116': // Row not found
        return new AppError('データが見つかりません', 'NOT_FOUND');
      case '23505': // Unique violation
        return new AppError('既に存在するデータです', 'DUPLICATE');
      case 'invalid_credentials':
        return new AppError('認証情報が正しくありません', 'AUTH_ERROR');
      default:
        return new AppError('予期しないエラーが発生しました', 'UNKNOWN');
    }
  }

  public static async withErrorHandling<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PostgrestError || error instanceof AuthError) {
        throw this.handleError(error);
      }
      throw error;
    }
  }
}
```

### Redux Error State Management

```typescript
// src/store/slices/uiSlice.ts
export interface UIState {
  loading: {
    auth: boolean;
    posts: boolean;
    notifications: boolean;
  };
  errors: {
    auth: string | null;
    posts: string | null;
    notifications: string | null;
    global: string | null;
  };
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      const { key, value } = action.payload;
      state.loading[key] = value;
    },
    setError: (state, action) => {
      const { key, error } = action.payload;
      state.errors[key] = error;
    },
    clearError: (state, action) => {
      const { key } = action.payload;
      state.errors[key] = null;
    },
  },
});
```

## Testing Strategy

### Unit Testing with Supabase Mocks

```typescript
// __tests__/services/PostsService.supabase.test.ts
import { createClient } from '@supabase/supabase-js';
import { PostsService } from '../../src/services/PostsService';

jest.mock('@supabase/supabase-js');

describe('PostsService with Supabase', () => {
  let postsService: PostsService;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    } as any;

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    postsService = PostsService.getInstance();
  });

  it('should fetch posts from Supabase', async () => {
    const mockPosts = [{ id: '1', content: 'Test post' }];
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({
            data: mockPosts,
            error: null,
          }),
        }),
      }),
    } as any);

    const result = await postsService.getPosts({ offset: 0, limit: 10 });
    expect(result).toEqual(mockPosts);
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/supabase-redux.test.ts
describe('Supabase Redux Integration', () => {
  it('should sync auth state between Supabase and Redux', async () => {
    // Test auth state synchronization
  });

  it('should handle real-time updates in Redux state', async () => {
    // Test real-time subscriptions
  });

  it('should maintain data consistency between cache and database', async () => {
    // Test RTK Query cache invalidation
  });
});
```

## Performance Considerations

### RTK Query Caching Strategy

```typescript
// src/store/api/baseQuery.ts
export const supabaseBaseQuery: BaseQueryFn = async (args) => {
  const { table, method, data, params } = args;
  
  try {
    let query = supabaseClient.from(table);
    
    switch (method) {
      case 'select':
        query = query.select(params.select || '*');
        if (params.filters) {
          // Apply filters
        }
        break;
      case 'insert':
        query = query.insert(data);
        break;
      // ... other methods
    }

    const { data: result, error } = await query;
    
    if (error) {
      return { error: SupabaseErrorHandler.handleError(error) };
    }
    
    return { data: result };
  } catch (error) {
    return { error: { message: 'Network error' } };
  }
};
```

### Real-time Optimization

```typescript
// src/hooks/useRealtimeSubscription.ts
export function useRealtimeSubscription<T>(
  table: string,
  filter?: string,
  callback?: (payload: T) => void
) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const subscription = supabaseClient
      .channel(`${table}-changes`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table, filter },
        (payload) => {
          // Update Redux state
          dispatch(updateRealtimeData({ table, payload }));
          callback?.(payload.new as T);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [table, filter, callback, dispatch]);
}
```

## Security Considerations

### Authentication Flow

```typescript
// src/services/auth/SupabaseAuthService.ts
export class SupabaseAuthService {
  public async loginWithMaternalBook(
    maternalBookNumber: string,
    nickname: string
  ): Promise<AuthResponse> {
    // Hash the maternal book number for privacy
    const hashedBookNumber = await this.hashMaternalBookNumber(maternalBookNumber);
    
    // Check if user exists
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id')
      .eq('maternal_book_number_hash', hashedBookNumber)
      .single();

    if (existingUser) {
      // Sign in existing user
      return this.signInExistingUser(existingUser.id);
    } else {
      // Create new user
      return this.createNewUser(hashedBookNumber, nickname);
    }
  }

  private async hashMaternalBookNumber(bookNumber: string): Promise<string> {
    // Use crypto-js or similar for hashing
    return CryptoJS.SHA256(bookNumber + SALT).toString();
  }
}
```

### Data Privacy

```typescript
// RLS Policies ensure data privacy
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Anonymous posts hide user identity
CREATE OR REPLACE FUNCTION get_posts_with_privacy()
RETURNS TABLE (
  id UUID,
  content TEXT,
  user_nickname TEXT,
  is_anonymous BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    CASE 
      WHEN p.is_anonymous THEN '匿名'
      ELSE u.nickname
    END as user_nickname,
    p.is_anonymous,
    p.created_at
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This design provides a comprehensive integration of Supabase and Redux while maintaining the existing architecture and ensuring security, performance, and maintainability.