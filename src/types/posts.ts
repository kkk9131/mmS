export interface Post {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  images?: string[];
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostsResponse {
  posts: Post[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface CommentsResponse {
  comments: Comment[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface CreatePostRequest {
  content: string;
  images?: string[];
}

export interface CreateCommentRequest {
  content: string;
}

export interface PostsQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'likesCount';
  order?: 'asc' | 'desc';
}

export interface CommentsQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
}