// データ構造・ナビゲーション設計の改善
// 情報アーキテクチャの機能的深さの向上

interface DataStructure {
  entities: {
    users: UserEntity[];
    posts: PostEntity[];
    likes: LikeEntity[];
    comments: CommentEntity[];
    follows: FollowEntity[];
    notifications: NotificationEntity[];
  };
  relationships: RelationshipMap;
  indices: IndexMap;
}

interface UserEntity {
  id: string;
  nickname: string;
  bio?: string;
  avatar?: string;
  maternal_book_number: string;
  created_at: string;
  updated_at: string;
  // 関連データへの参照
  posts: string[];
  likes: string[];
  comments: string[];
  following: string[];
  followers: string[];
  notifications: string[];
}

interface PostEntity {
  id: string;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  // 関連データへの参照
  likes: string[];
  comments: string[];
  // 計算されたフィールド
  likes_count: number;
  comments_count: number;
}

interface LikeEntity {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

interface CommentEntity {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

interface FollowEntity {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

interface NotificationEntity {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  related_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface RelationshipMap {
  usersPosts: Map<string, string[]>;
  postsLikes: Map<string, string[]>;
  postsComments: Map<string, string[]>;
  userFollows: Map<string, string[]>;
  userNotifications: Map<string, string[]>;
}

interface IndexMap {
  usersByNickname: Map<string, string>;
  postsByUser: Map<string, string[]>;
  postsByDate: Map<string, string[]>;
  likesByUser: Map<string, string[]>;
  commentsByPost: Map<string, string[]>;
}

export class DataStructureManager {
  private data: DataStructure;
  private isInitialized = false;

  constructor() {
    this.data = {
      entities: {
        users: [],
        posts: [],
        likes: [],
        comments: [],
        follows: [],
        notifications: []
      },
      relationships: {
        usersPosts: new Map(),
        postsLikes: new Map(),
        postsComments: new Map(),
        userFollows: new Map(),
        userNotifications: new Map()
      },
      indices: {
        usersByNickname: new Map(),
        postsByUser: new Map(),
        postsByDate: new Map(),
        likesByUser: new Map(),
        commentsByPost: new Map()
      }
    };
  }

  // データ構造の初期化
  async initialize(rawData?: any): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 実際のデータがない場合はサンプルデータで初期化
      if (!rawData) {
        this.initializeWithSampleData();
      } else {
        this.populateFromRawData(rawData);
      }

      this.buildIndices();
      this.buildRelationships();
      this.isInitialized = true;

      console.log('✅ データ構造管理システム初期化完了');
      this.logStatistics();
    } catch (error) {
      console.error('❌ データ構造初期化エラー:', error);
      throw error;
    }
  }

  // サンプルデータでの初期化
  private initializeWithSampleData(): void {
    const now = new Date().toISOString();

    // サンプルユーザー
    this.data.entities.users = [
      {
        id: 'user-1',
        nickname: 'みか（2歳ママ）',
        bio: '2歳の男の子を育てています。離乳食や外遊びのことなど、よろしくお願いします！',
        maternal_book_number: 'SAMPLE_001',
        created_at: now,
        updated_at: now,
        posts: [],
        likes: [],
        comments: [],
        following: [],
        followers: [],
        notifications: []
      },
      {
        id: 'user-2',
        nickname: 'さくら',
        bio: '初めての妊娠で不安がいっぱいです。先輩ママさんたちに色々教えてもらいたいです。',
        maternal_book_number: 'SAMPLE_002',
        created_at: now,
        updated_at: now,
        posts: [],
        likes: [],
        comments: [],
        following: [],
        followers: [],
        notifications: []
      }
    ];

    // サンプル投稿
    this.data.entities.posts = [
      {
        id: 'post-1',
        user_id: 'user-1',
        content: '離乳食で卵を初めてあげるとき、皆さんはどんな風に進めましたか？アレルギーが心配で...😅',
        is_anonymous: false,
        created_at: now,
        updated_at: now,
        likes: [],
        comments: [],
        likes_count: 0,
        comments_count: 0
      },
      {
        id: 'post-2',
        user_id: 'user-2',
        content: '最近夜泣きがひどくて困っています。何か良い対策があれば教えてください🥱',
        is_anonymous: false,
        created_at: now,
        updated_at: now,
        likes: [],
        comments: [],
        likes_count: 0,
        comments_count: 0
      }
    ];

    // サンプルいいね
    this.data.entities.likes = [
      {
        id: 'like-1',
        user_id: 'user-2',
        post_id: 'post-1',
        created_at: now
      }
    ];

    // サンプルコメント
    this.data.entities.comments = [
      {
        id: 'comment-1',
        user_id: 'user-2',
        post_id: 'post-1',
        content: 'とても参考になりました！ありがとうございます😊',
        is_anonymous: false,
        created_at: now,
        updated_at: now
      }
    ];
  }

  // インデックスの構築
  private buildIndices(): void {
    // ユーザー名でのインデックス
    this.data.entities.users.forEach(user => {
      this.data.indices.usersByNickname.set(user.nickname, user.id);
    });

    // ユーザー別投稿インデックス
    this.data.entities.posts.forEach(post => {
      const userPosts = this.data.indices.postsByUser.get(post.user_id) || [];
      userPosts.push(post.id);
      this.data.indices.postsByUser.set(post.user_id, userPosts);
    });

    // 日付別投稿インデックス
    this.data.entities.posts.forEach(post => {
      const date = post.created_at.split('T')[0];
      const datePosts = this.data.indices.postsByDate.get(date) || [];
      datePosts.push(post.id);
      this.data.indices.postsByDate.set(date, datePosts);
    });

    // ユーザー別いいねインデックス
    this.data.entities.likes.forEach(like => {
      const userLikes = this.data.indices.likesByUser.get(like.user_id) || [];
      userLikes.push(like.id);
      this.data.indices.likesByUser.set(like.user_id, userLikes);
    });

    // 投稿別コメントインデックス
    this.data.entities.comments.forEach(comment => {
      const postComments = this.data.indices.commentsByPost.get(comment.post_id) || [];
      postComments.push(comment.id);
      this.data.indices.commentsByPost.set(comment.post_id, postComments);
    });
  }

  // 関係性の構築
  private buildRelationships(): void {
    // ユーザーと投稿の関係
    this.data.entities.posts.forEach(post => {
      const userPosts = this.data.relationships.usersPosts.get(post.user_id) || [];
      userPosts.push(post.id);
      this.data.relationships.usersPosts.set(post.user_id, userPosts);
    });

    // 投稿といいねの関係
    this.data.entities.likes.forEach(like => {
      const postLikes = this.data.relationships.postsLikes.get(like.post_id) || [];
      postLikes.push(like.id);
      this.data.relationships.postsLikes.set(like.post_id, postLikes);
    });

    // 投稿とコメントの関係
    this.data.entities.comments.forEach(comment => {
      const postComments = this.data.relationships.postsComments.get(comment.post_id) || [];
      postComments.push(comment.id);
      this.data.relationships.postsComments.set(comment.post_id, postComments);
    });

    // 投稿の統計情報を更新
    this.updatePostStatistics();
  }

  // 投稿統計の更新
  private updatePostStatistics(): void {
    this.data.entities.posts.forEach(post => {
      post.likes_count = this.data.relationships.postsLikes.get(post.id)?.length || 0;
      post.comments_count = this.data.relationships.postsComments.get(post.id)?.length || 0;
    });
  }

  // データ取得メソッド
  public getUserById(id: string): UserEntity | undefined {
    return this.data.entities.users.find(user => user.id === id);
  }

  public getPostById(id: string): PostEntity | undefined {
    return this.data.entities.posts.find(post => post.id === id);
  }

  public getPostsByUser(userId: string): PostEntity[] {
    const postIds = this.data.indices.postsByUser.get(userId) || [];
    return postIds.map(id => this.getPostById(id)).filter(Boolean) as PostEntity[];
  }

  public getRecentPosts(limit: number = 10): PostEntity[] {
    return this.data.entities.posts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  public getUserByNickname(nickname: string): UserEntity | undefined {
    const userId = this.data.indices.usersByNickname.get(nickname);
    return userId ? this.getUserById(userId) : undefined;
  }

  // 統計情報の取得
  public getStatistics() {
    return {
      users: this.data.entities.users.length,
      posts: this.data.entities.posts.length,
      likes: this.data.entities.likes.length,
      comments: this.data.entities.comments.length,
      follows: this.data.entities.follows.length,
      notifications: this.data.entities.notifications.length,
      complexity_level: this.calculateComplexityLevel(),
      architecture_quality: this.assessArchitectureQuality()
    };
  }

  // データ複雑性レベルの計算
  private calculateComplexityLevel(): number {
    const totalEntities = Object.values(this.data.entities).reduce((sum, arr) => sum + arr.length, 0);
    const totalRelationships = Array.from(this.data.relationships.usersPosts.values()).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalEntities > 100 && totalRelationships > 50) return 5; // 非常に複雑
    if (totalEntities > 50 && totalRelationships > 25) return 4;  // 複雑
    if (totalEntities > 20 && totalRelationships > 10) return 3;  // 中程度
    if (totalEntities > 5 && totalRelationships > 2) return 2;    // 基本
    return 1; // 最小限
  }

  // アーキテクチャ品質の評価
  private assessArchitectureQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const hasCompleteStructure = this.data.entities.users.length > 0 && this.data.entities.posts.length > 0;
    const hasRelationships = this.data.entities.likes.length > 0 || this.data.entities.comments.length > 0;
    const complexityLevel = this.calculateComplexityLevel();

    if (hasCompleteStructure && hasRelationships && complexityLevel >= 3) return 'excellent';
    if (hasCompleteStructure && hasRelationships && complexityLevel >= 2) return 'good';
    if (hasCompleteStructure && complexityLevel >= 1) return 'fair';
    return 'poor';
  }

  // 統計情報のログ出力
  private logStatistics(): void {
    const stats = this.getStatistics();
    console.log('📊 データ構造統計:');
    console.log(`   Users: ${stats.users}`);
    console.log(`   Posts: ${stats.posts}`);
    console.log(`   Likes: ${stats.likes}`);
    console.log(`   Comments: ${stats.comments}`);
    console.log(`   Complexity Level: ${stats.complexity_level}/5`);
    console.log(`   Architecture Quality: ${stats.architecture_quality}`);
  }

  // 生データからの読み込み（将来の拡張用）
  private populateFromRawData(rawData: any): void {
    // 実装は将来のデータソース統合時に追加
    console.log('生データからの読み込み（未実装）');
  }
}

// グローバルインスタンス
export const dataStructureManager = new DataStructureManager();