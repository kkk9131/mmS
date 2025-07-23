# Implementation Plan

- [x] 1. プロジェクト依存関係とSupabase初期設定
  - Install Supabase client, Redux Toolkit, and RTK Query dependencies
  - Create environment configuration for Supabase URL and anon key
  - Set up feature flags for Supabase/mock switching
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Supabaseクライアント基盤構築
  - [x] 2.1 Supabaseクライアント設定クラス作成
    - Create SupabaseClient singleton class with configuration management
    - Implement connection testing and error handling
    - Add debug logging and connection status monitoring
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 データベーススキーマとRLS設定
    - Create database tables (users, posts, likes, comments, notifications, follows)
    - Implement Row Level Security (RLS) policies for data privacy
    - Set up database functions for anonymous post handling
    - _Requirements: 1.4, 8.1, 8.2_

  - [x] 2.3 TypeScript型定義生成
    - Generate TypeScript types from Supabase schema
    - Create custom type definitions for app-specific data structures
    - Set up type safety for database operations
    - _Requirements: 1.1, 1.4_

- [ ] 3. Redux Toolkit基盤構築
  - [x] 3.1 Redux Store設定
    - Configure Redux store with RTK Query and middleware
    - Set up Redux DevTools for development
    - Create root reducer with all slices
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 基本Slice作成
    - Create UI slice for loading states and errors
    - Create app slice for global application state
    - Implement error handling and loading state management
    - _Requirements: 2.4, 2.5_

  - [x] 3.3 Redux Provider統合
    - Wrap app with Redux Provider
    - Set up store persistence with Redux Persist
    - Configure middleware for async actions and logging
    - _Requirements: 2.1, 2.2_

- [ ] 4. 認証システム統合
  - [x] 4.1 Supabase認証サービス実装
    - Create SupabaseAuthService with maternal book number authentication
    - Implement secure hashing for maternal book numbers
    - Add user creation and sign-in logic
    - _Requirements: 3.1, 3.2, 8.3_

  - [x] 4.2 認証Redux Slice実装
    - Create auth slice with user state and session management
    - Implement async thunks for login, logout, and user updates
    - Add authentication state persistence and restoration
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 4.3 既存ログイン画面のRedux連携
    - Update login screen to use Redux actions and selectors
    - Replace existing auth service calls with Redux thunks
    - Implement loading states and error handling in UI
    - _Requirements: 3.3, 6.1, 6.2_

- [ ] 5. RTK Query API統合
  - [x] 5.1 Supabase Base Query実装
    - Create custom base query function for Supabase operations
    - Implement error handling and response transformation
    - Add request/response logging and debugging
    - _Requirements: 2.3, 7.1, 7.4_

  - [x] 5.2 Posts API Slice実装
    - Create RTK Query endpoints for posts CRUD operations
    - Implement caching strategies and tag invalidation
    - Add optimistic updates for likes and comments
    - _Requirements: 4.1, 4.2, 7.1, 7.3_

  - [x] 5.3 その他API Slices実装
    - Create notifications API slice with real-time updates
    - Create users API slice for profile management
    - Create follows API slice for social features
    - _Requirements: 4.3, 4.4, 4.5_

- [ ] 6. 既存サービス層のSupabase統合
  - [x] 6.1 PostsService Supabase統合
    - Update PostsService to use Supabase client
    - Maintain existing interface for backward compatibility
    - Add feature flag switching between Supabase and mock
    - _Requirements: 4.1, 4.2, 6.1, 6.2_

  - [x] 6.2 UserService Supabase統合
    - Integrate UserService with Supabase users table
    - Implement profile updates and user search with Supabase
    - Add caching layer with RTK Query integration
    - _Requirements: 4.3, 6.1, 6.2_

  - [x] 6.3 NotificationService Supabase統合
    - Connect NotificationService to Supabase notifications table
    - Implement real-time notification subscriptions
    - Add optimistic updates for read status
    - _Requirements: 4.4, 5.2, 6.1_

  - [x] 6.4 FollowService Supabase統合
    - Update FollowService to use Supabase follows table
    - Implement batch operations and follow suggestions
    - Add real-time follow notifications
    - _Requirements: 4.5, 6.1, 6.2_

- [ ] 7. リアルタイム機能実装
  - [x] 7.1 リアルタイム購読システム構築
    - Create useRealtimeSubscription hook for component subscriptions
    - Implement automatic subscription cleanup and error handling
    - Add connection status monitoring and reconnection logic
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 7.2 投稿リアルタイム更新
    - Subscribe to post changes (likes, comments) in real-time
    - Update Redux state automatically when changes occur
    - Implement conflict resolution for concurrent updates
    - _Requirements: 5.1, 5.2_

  - [x] 7.3 通知リアルタイム更新
    - Subscribe to new notifications in real-time
    - Update notification badge and list automatically
    - Implement notification sound and vibration
    - _Requirements: 5.2, 5.3_

- [ ] 8. 画面コンポーネントのRedux統合
  - [x] 8.1 ホーム画面Redux連携
    - Replace existing state management with Redux selectors
    - Use RTK Query hooks for data fetching and caching
    - Implement optimistic updates for user interactions
    - _Requirements: 4.1, 4.2, 7.2, 7.3_

  - [x] 8.2 通知画面Redux連携
    - Connect notification screen to Redux notifications state
    - Implement real-time updates and read status management
    - Add pull-to-refresh and infinite scrolling with RTK Query
    - _Requirements: 4.4, 5.2, 7.1_

  - [x] 8.3 プロフィール画面Redux連携
    - Update profile screen to use Redux user state
    - Implement profile editing with optimistic updates
    - Add follow/unfollow functionality with real-time updates
    - _Requirements: 4.3, 4.5, 6.1_

- [x] 9. エラーハンドリングとパフォーマンス最適化 ✅ **完了**
  - [x] 9.1 統一エラーハンドリング実装 ✅
    - Create SupabaseErrorHandler for consistent error processing
    - Implement global error boundary with Redux error state
    - Add user-friendly error messages and recovery options
    - _Requirements: 6.3, 7.4_

  - [x] 9.2 キャッシュ戦略最適化 ✅
    - Configure RTK Query cache timing and invalidation
    - Implement selective cache updates for real-time data
    - Add background data synchronization
    - _Requirements: 7.1, 7.2_

  - [x] 9.3 パフォーマンス監視実装 ✅
    - Add performance metrics for Supabase operations
    - Implement query optimization and batch operations
    - Add memory usage monitoring for real-time subscriptions
    - _Requirements: 7.1, 7.4_

- [x] 10. テストとデバッグ機能 ✅ **完了**
  - [x] 10.1 Supabase統合テスト作成 ✅
    - Write unit tests for Supabase service integrations
    - Create integration tests for Redux-Supabase data flow
    - Add mock Supabase client for testing environment
    - _Requirements: 6.4, 6.5_

  - [x] 10.2 Redux状態テスト実装 ✅
    - Test Redux slices and async thunks
    - Verify RTK Query cache behavior and invalidation
    - Test real-time subscription state updates
    - _Requirements: 2.1, 2.2, 5.1_

  - [x] 10.3 エンドツーエンドテスト ✅
    - Test complete user flows with Supabase backend
    - Verify authentication and data persistence
    - Test real-time features and error scenarios
    - _Requirements: 3.1, 4.1, 5.1_

- [x] 11. 本番環境準備と最終検証 ✅ **完了**
  - [x] 11.1 環境設定とセキュリティ検証 ✅
    - Configure production Supabase environment
    - Verify RLS policies and security settings
    - Test authentication flow and data privacy
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.2 パフォーマンス最終検証 ✅
    - Load test with realistic data volumes
    - Verify real-time performance under concurrent users
    - Optimize database queries and indexes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 11.3 機能フラグとロールバック準備 ✅
    - Test Supabase/mock switching functionality
    - Prepare rollback procedures for production deployment
    - Document troubleshooting and monitoring procedures
    - _Requirements: 6.2, 6.3, 6.5_