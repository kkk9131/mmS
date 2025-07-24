/**
 * 画像アップロード用 RTK Query API
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { supabaseClient } from '../../services/supabase/client';
import { ImageAsset, ProcessedImage, UploadResult, UploadProgress } from '../../types/image';
import { CACHE_TIMES, TAG_TYPES } from './cacheUtils';

// カスタムベースクエリ（Supabase用）
const supabaseBaseQuery = async ({ url, method = 'GET', body }: any) => {
  try {
    // Supabaseクライアントを使用したカスタム実装
    // 実際の実装では、適切なSupabase操作を行う
    return { data: null };
  } catch (error) {
    return {
      error: {
        status: 'CUSTOM_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export const imageApi = createApi({
  reducerPath: 'imageApi',
  baseQuery: supabaseBaseQuery,
  tagTypes: [TAG_TYPES.Post, 'Image', 'Upload'],
  endpoints: (builder) => ({
    // 画像アップロード
    uploadImage: builder.mutation<UploadResult, { image: ProcessedImage; bucket?: string }>({
      queryFn: async ({ image, bucket = 'images' }) => {
        try {
          const { SupabaseImageService } = await import('../../services/image/SupabaseImageService');
          const service = new SupabaseImageService();
          
          const result = await service.uploadImage(image, bucket);
          
          return { data: result };
        } catch (error) {
          return {
            error: {
              status: 'UPLOAD_ERROR',
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          };
        }
      },
      invalidatesTags: ['Image', { type: TAG_TYPES.Post, id: 'LIST' }]
    }),

    // 画像削除
    deleteImage: builder.mutation<void, { path: string; bucket?: string }>({
      queryFn: async ({ path, bucket = 'images' }) => {
        try {
          const { SupabaseImageService } = await import('../../services/image/SupabaseImageService');
          const service = new SupabaseImageService();
          
          await service.deleteImage(path, bucket);
          
          return { data: undefined };
        } catch (error) {
          return {
            error: {
              status: 'DELETE_ERROR',
              error: error instanceof Error ? error.message : 'Delete failed'
            }
          };
        }
      },
      invalidatesTags: ['Image']
    }),

    // 画像一覧取得
    getImages: builder.query<any[], { folder?: string; bucket?: string }>({
      queryFn: async ({ folder = '', bucket = 'images' }) => {
        try {
          const { SupabaseImageService } = await import('../../services/image/SupabaseImageService');
          const service = new SupabaseImageService();
          
          const files = await service.listFiles(folder, bucket);
          
          return { data: files };
        } catch (error) {
          return {
            error: {
              status: 'FETCH_ERROR',
              error: error instanceof Error ? error.message : 'Fetch failed'
            }
          };
        }
      },
      providesTags: ['Image'],
      keepUnusedDataFor: CACHE_TIMES.MEDIUM
    }),

    // 署名付きURL生成
    generateSignedUrl: builder.query<string, { path: string; expiresIn?: number; bucket?: string }>({
      queryFn: async ({ path, expiresIn = 3600, bucket = 'images' }) => {
        try {
          const { SupabaseImageService } = await import('../../services/image/SupabaseImageService');
          const service = new SupabaseImageService();
          
          const signedUrl = await service.generateSignedUrl(path, expiresIn, bucket);
          
          return { data: signedUrl };
        } catch (error) {
          return {
            error: {
              status: 'URL_ERROR',
              error: error instanceof Error ? error.message : 'URL generation failed'
            }
          };
        }
      },
      keepUnusedDataFor: CACHE_TIMES.SHORT
    }),

    // ストレージ使用量取得
    getStorageUsage: builder.query<number, { bucket?: string }>({
      queryFn: async ({ bucket = 'images' }) => {
        try {
          const { SupabaseImageService } = await import('../../services/image/SupabaseImageService');
          const service = new SupabaseImageService();
          
          const usage = await service.getStorageUsage(bucket);
          
          return { data: usage };
        } catch (error) {
          return {
            error: {
              status: 'USAGE_ERROR',
              error: error instanceof Error ? error.message : 'Usage fetch failed'
            }
          };
        }
      },
      providesTags: ['Image'],
      keepUnusedDataFor: CACHE_TIMES.MEDIUM
    })
  })
});

export const {
  useUploadImageMutation,
  useDeleteImageMutation,
  useGetImagesQuery,
  useGenerateSignedUrlQuery,
  useGetStorageUsageQuery
} = imageApi;