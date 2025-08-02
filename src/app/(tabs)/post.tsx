import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, ScrollView, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Platform } from 'react-native';
import { Send, Heart, Bot } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PostsService } from '../../services/PostsService';
import { useTheme } from '../../contexts/ThemeContext';
import * as FileSystem from 'expo-file-system';
import { useCreatePostMutation, postsApi } from '../../store/api/postsApi';
import { FeatureFlagsManager } from '../../services/featureFlags';
// import { useAppSelector } from '../../hooks/redux';
import { useAuth } from '../../contexts/AuthContext';
import { MultipleImageUploadComponent } from '../../components/image/MultipleImageUploadComponent';
import { ImageAssetWithCaption } from '../../types/image';
// import { ProcessedImage } from '../../types/image';

// シンプルな画像型定義
interface SimpleImage {
  id: string;
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string;
}
// @ts-ignore - For web DOM events support
declare global {
  namespace JSX {
    interface IntrinsicElements {
      button: any;
    }
  }
}

// ViewのWeb用型拡張（未使用のためコメントアウト）
// interface WebViewProps {
//   onClick?: () => void;
//   onMouseDown?: () => void;
//   onMouseUp?: () => void;
// }

export default function PostScreen() {
  const { theme } = useTheme();
  const [postText, setPostText] = useState('');
  const [aiEmpathyEnabled, setAiEmpathyEnabled] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImageAssetWithCaption[]>([]);
  const textInputRef = useRef<TextInput>(null);

  const maxCharacters = 600;
  const characterCount = postText.length;
  const isOverLimit = characterCount > maxCharacters;
  const postsService = PostsService.getInstance();
  
  // RTK Query hooks for post creation（現在未使用）
  // const [createPost] = useCreatePostMutation();
  const featureFlags = FeatureFlagsManager.getInstance();
  
  // Get current user from AuthContext
  const { user: currentUser, isAuthenticated } = useAuth();

  // 投稿ボタン状態のデバッグ（開発環境のみ）
  useEffect(() => {
    if (__DEV__ && featureFlags.isDebugModeEnabled()) {
      console.log('🔘 投稿ボタン状態:', { disabled: isOverLimit || isPosting });
    }
  }, [isOverLimit, isPosting]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Web版でのフォーカス処理
  const handleTextInputPress = () => {
    if (Platform.OS === 'web' && textInputRef.current) {
      textInputRef.current.focus();
    }
  };

  // 画面読み込み時にフォーカス（Web版対応）
  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // 画像選択ハンドラー（複数画像対応）
  const handleImagesSelected = (images: ImageAssetWithCaption[]) => {
    setSelectedImages(images);
  };

  // 画像削除ハンドラー
  const handleImageRemoved = (imageId: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handlePost = async () => {
    if (__DEV__ && featureFlags.isDebugModeEnabled()) {
      console.log('🚀 投稿処理開始');
      console.log('📊 文字数:', postText.trim().length);
      console.log('📋 状態:', { isOverLimit, isPosting, hasUser: !!currentUser });
    }
    
    // Web環境チェック（開発環境のみ）
    if (__DEV__ && Platform.OS === 'web' && featureFlags.isDebugModeEnabled()) {
      console.log('🌐 Web環境での実行を確認');
    }
    
    if (postText.trim().length === 0) {
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }
    
    
    if (isOverLimit) {
      Alert.alert('エラー', `文字数が上限を超えています (${characterCount}/${maxCharacters})`);
      return;
    }
    
    if (__DEV__ && featureFlags.isDebugModeEnabled()) {
      console.log('✅ 投稿料定前チェック完了');
      console.log('🔍 投稿設定:', {
        hasSupabase: featureFlags.isSupabaseEnabled(),
        hasRedux: featureFlags.isReduxEnabled(),
        isAuthenticated: !!currentUser
      });
    }

    const empathyMessage = aiEmpathyEnabled ? '\n\n※ ママの味方からの共感メッセージが届きます' : '';
    
    if (featureFlags.isDebugModeEnabled()) {
      console.log('🔔 Alert.alertを表示します');
    }
    
    // Web版でのAlert.alert問題を回避するため、直接投稿処理を実行
    if (Platform.OS === 'web') {
      // Web版では確認ダイアログをスキップして直接投稿
      const shouldProceed = window.confirm(`投稿しますか？${empathyMessage}`);
      
      if (!shouldProceed) {
        return;
      }
    }
    
    // 投稿処理の実行
    const executePost = async () => {
      if (__DEV__ && featureFlags.isDebugModeEnabled()) {
        console.log('🔥 投稿実行開始');
      }
      setIsPosting(true);
      try {
        if (__DEV__ && featureFlags.isDebugModeEnabled()) {
          console.log('📨 投稿作成開始:', {
            hasUser: !!currentUser,
            images: selectedImages.length,
            method: featureFlags.isSupabaseEnabled() ? 'Supabase' : 'Mock'
          });
        }
        
        if (!currentUser || !isAuthenticated) {
          throw new Error('ユーザーが認証されていません');
        }
        
        // 画像アップロード処理（キャプション情報も含める）
        let uploadedImageUrls: string[] = [];
        if (selectedImages.length > 0) {
          if (__DEV__ && featureFlags.isDebugModeEnabled()) {
            console.log('📤 画像アップロード開始:', selectedImages.length);
          }
          
          // カスタム認証のユーザー情報を使用
          if (!currentUser || !isAuthenticated) {
            throw new Error('ユーザーが認証されていません。ログインし直してください。');
          }
          
          if (__DEV__ && featureFlags.isDebugModeEnabled()) {
            console.log('✅ 認証確認済み:', {
              userId: currentUser.id,
              nickname: currentUser.nickname
            });
          }
          
          // 認証状態に関係なくアップロードを実行（RLSポリシーを緩和）
          const { SupabaseClientManager } = await import('../../services/supabase/client');
          const manager = SupabaseClientManager.getInstance();
          const supabase = manager.getClient();
          
          if (!supabase) {
            throw new Error('Supabaseクライアントが初期化されていません');
          }
          
          // 画像を順序通りにソートしてアップロード
          const sortedImages = [...selectedImages].sort((a, b) => a.order - b.order);
          
          for (const image of sortedImages) {
            try {
              if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                console.log('📤 画像アップロード中:', image.id, '順序:', image.order);
              }
              
              // ファイル名を生成（ユーザーIDと順序を含む）
              const fileName = `${currentUser.id}_${Date.now()}_${image.order}_${Math.random().toString(36).substr(2, 9)}.jpg`;
              
              // React Native環境での画像アップロード対応
              if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                console.log('📤 アップロード処理開始:', Platform.OS);
              }
              
              if (Platform.OS === 'web') {
                // Web環境では通常のfetch + blob方式
                const response = await fetch(image.uri);
                const blob = await response.blob();
                if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                  console.log('🌐 Web blob作成:', { size: blob.size, type: blob.type });
                }
                
                // blobサイズが0の場合はエラー
                if (blob.size === 0) {
                  throw new Error(`画像データが空です (URI: ${image.uri})`);
                }
                
                // Supabase Storageにアップロード
                const { data, error } = await supabase.storage
                  .from('posts')
                  .upload(fileName, blob, {
                    contentType: image.mimeType || 'image/jpeg',
                    upsert: false
                  });
                
                if (error) {
                  console.error('❌ Webアップロードエラー:', error);
                  throw error;
                }
                
                if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                  console.log('✅ Webアップロード成功:', data?.path);
                }
              } else {
                // React Native環境でのSupabase SDKアップロード（セッション設定後）
                if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                  console.log('📱 React Native環境でSupabase SDKアップロード');
                }
                
                // カスタム認証セッションをSupabaseに設定
                try {
                  const { store } = await import('../../store');
                  const state = store.getState();
                  const customSession = state.auth?.session;
                  
                  if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                    console.log('🔍 カスタムセッション状態:', {
                      hasSession: !!customSession,
                      hasToken: !!(customSession?.access_token)
                    });
                  }
                  
                  if (customSession?.access_token) {
                    // Supabaseにカスタムセッションを設定
                    const { error: sessionError } = await supabase.auth.setSession({
                      access_token: customSession.access_token,
                      refresh_token: customSession.refresh_token || customSession.access_token,
                    });
                    
                    if (sessionError) {
                      if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                        console.warn('⚠️ Supabaseセッション設定エラー:', sessionError.message);
                      }
                    } else {
                      if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                        console.log('✅ Supabaseセッション設定成功');
                      }
                    }
                  } else {
                    if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                      console.warn('⚠️ カスタムセッションが見つかりません');
                    }
                  }
                } catch (sessionSetupError) {
                  if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                    console.warn('⚠️ セッション設定で例外:', sessionSetupError?.message);
                  }
                }
                
                // React Native専用のFormDataオブジェクトを作成
                const fileObject = {
                  uri: image.uri,
                  type: image.mimeType || 'image/jpeg',
                  name: fileName,
                };
                
                if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                  console.log('📋 ファイルオブジェクト作成:', {
                    name: fileObject.name,
                    type: fileObject.type
                  });
                }
                
                // Supabase SDK直接使用（React Native対応）
                const { data, error } = await supabase.storage
                  .from('posts')
                  .upload(fileName, fileObject as any, {
                    contentType: image.mimeType || 'image/jpeg',
                    upsert: false
                  });
                
                if (error) {
                  if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                    console.error('❌ Supabase SDKアップロードエラー:', {
                      message: error.message,
                      statusCode: (error as any).statusCode
                    });
                  }
                  
                  // 認証エラーのハンドリング
                  if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
                    throw new Error('ストレージアクセス権限がありません。管理者にお問い合わせください。');
                  } else if (error.message?.includes('Invalid') && error.message?.includes('JWT')) {
                    throw new Error('認証トークンが無効です。再ログインしてください。');
                  } else {
                    throw new Error(`画像アップロードエラー: ${error.message}`);
                  }
                }
                
                if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                  console.log('✅ React Native SDKアップロード成功:', data?.path);
                }
              }
              
              // 公開URLを取得
              const { data: urlData } = supabase.storage
                .from('posts')
                .getPublicUrl(fileName);
              
              uploadedImageUrls.push(urlData.publicUrl);
              if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                console.log('✅ 画像URL取得成功');
              }
              
            } catch (uploadError) {
              console.error('❌ 画像アップロードエラー:', uploadError);
              throw new Error(`画像のアップロードに失敗しました: ${uploadError}`);
            }
          }
          if (__DEV__ && featureFlags.isDebugModeEnabled()) {
            console.log('✅ 全画像アップロード完了:', uploadedImageUrls.length, '件');
          }
        }
        
        // Supabaseを強制的に使用して投稿作成を試行
        if (__DEV__ && featureFlags.isDebugModeEnabled()) {
          console.log('🟡 PostsServiceで投稿作成を試行');
        }
        
        // 一時的にSupabaseを有効化
        const originalSupabaseFlag = featureFlags.getFlag('USE_SUPABASE');
        featureFlags.setFlag('USE_SUPABASE', true);
        
        try {
          // PostsService を使用 - アップロードされた画像URLを使用
          const result = await postsService.createPost({
            content: postText.trim(),
            userId: currentUser.id, // ユーザーIDを明示的に渡す
            images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined
          });
          if (__DEV__ && featureFlags.isDebugModeEnabled()) {
            console.log('✅ PostsService投稿作成成功:', result?.id || '成功');
          }
        } catch (postsServiceError) {
          console.error('❌ PostsService投稿作成エラー:', postsServiceError);
          throw postsServiceError;
        } finally {
          // フラグを元に戻す
          featureFlags.setFlag('USE_SUPABASE', originalSupabaseFlag);
        }
        
        if (__DEV__ && featureFlags.isDebugModeEnabled()) {
          console.log('✅ 投稿作成成功');
        }
        
        // 投稿完了後の処理
        setPostText('');
        setSelectedImages([]);
        
        // RTK Queryキャッシュを無効化（投稿リストを更新）
        try {
          const { store } = await import('../../store');
          // 全ての投稿関連キャッシュを無効化
          store.dispatch(postsApi.util.invalidateTags(['Post']));
          // ユーザー固有の投稿キャッシュも無効化
          store.dispatch(postsApi.util.invalidateTags([{ type: 'Post', id: `USER_${currentUser.id}` }]));
          if (__DEV__ && featureFlags.isDebugModeEnabled()) {
            console.log('✅ RTK Queryキャッシュ無効化完了');
          }
        } catch (cacheError) {
          if (__DEV__ && featureFlags.isDebugModeEnabled()) {
            console.warn('⚠️ キャッシュ無効化に失敗:', cacheError?.message);
          }
        }
        
        // 少し遅延を入れてからホーム画面に戻る（キャッシュ更新を確実にするため）
        const navigateBack = () => {
          setTimeout(() => {
            router.back();
          }, 100); // 100ms遅延
        };
        
        // Web版での成功メッセージ
        if (Platform.OS === 'web') {
          alert('投稿が正常に送信されました！');
          navigateBack();
        } else {
          Alert.alert('投稿完了', '投稿が正常に送信されました', [
            { 
              text: 'OK', 
              onPress: navigateBack
            }
          ]);
        }
        
      } catch (error) {
        console.error('❌ 投稿エラー:', error);
        
        // エラーの詳細をログ出力（開発環境のみ）
        if (__DEV__ && error && typeof error === 'object' && featureFlags.isDebugModeEnabled()) {
          console.error('エラー詳細:', {
            message: (error as any).message,
            name: (error as any).name
          });
        }
        
        const errorMessage = error instanceof Error ? error.message : '投稿の送信に失敗しました。もう一度お試しください。';
        
        if (Platform.OS === 'web') {
          alert(`投稿エラー: ${errorMessage}`);
        } else {
          Alert.alert('エラー', errorMessage);
        }
      } finally {
        setIsPosting(false);
      }
    };
    
    // モバイル版の場合は従来のAlert.alertを使用
    if (Platform.OS !== 'web') {
      Alert.alert(
        '投稿確認',
        `投稿しますか？${empathyMessage}`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: '投稿する', 
            onPress: executePost
          }
        ]
      );
    } else {
      // Web版はすでに実行済み
      await executePost();
    }
  };

  // Dynamic styles with theme colors
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginTop: 4,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text.primary,
      minHeight: 200,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    textInputError: {
      borderColor: theme.colors.error,
    },
    charCount: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    charCountError: {
      color: theme.colors.error,
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
      marginLeft: 12,
      flex: 1,
    },
    optionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginLeft: 8,
      flex: 1,
    },
    optionDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
      marginLeft: 28,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    postButton: {
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 8,
      minHeight: 48,
    },
    postButtonDisabled: {
      backgroundColor: theme.colors.text.secondary,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>新規ポスト</Text>
        <Text style={dynamicStyles.headerSubtitle}>今の気持ちを共有しませんか？</Text>
      </View>

      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Web版対応: タッチ可能な領域でTextInputを囲む */}
            <TouchableWithoutFeedback onPress={handleTextInputPress}>
              <View style={styles.textInputContainer}>
                <TextInput
                  ref={textInputRef}
                  style={[dynamicStyles.textInput, isOverLimit && dynamicStyles.textInputError]}
                  placeholder="今日はどんな一日でしたか？ママたちと共有しませんか..."
                  placeholderTextColor={theme.colors.text.secondary}
                  multiline
                  value={postText}
                  onChangeText={setPostText}
                  maxLength={maxCharacters}
                  returnKeyType="done"
                  onSubmitEditing={dismissKeyboard}
                  // Web版用の追加プロパティ
                  autoFocus={Platform.OS === 'web'}
                  selectTextOnFocus={Platform.OS === 'web'}
                  // スタイル改善
                  textAlignVertical="top"
                  scrollEnabled={true}
                />
              </View>
            </TouchableWithoutFeedback>
        
        <View style={styles.inputFooter}>
          <Text style={[
            dynamicStyles.charCount,
            isOverLimit && dynamicStyles.charCountError
          ]}>
            {characterCount}/{maxCharacters}
          </Text>
        </View>

        <View style={dynamicStyles.optionCard}>
          <View style={styles.optionHeader}>
            <Bot size={20} color={theme.colors.primary} />
            <Text style={dynamicStyles.optionTitle}>ママの味方</Text>
            <Switch
              value={aiEmpathyEnabled}
              onValueChange={setAiEmpathyEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={aiEmpathyEnabled ? '#fff' : theme.colors.text.secondary}
            />
          </View>
          <Text style={dynamicStyles.optionDescription}>
            {aiEmpathyEnabled 
              ? 'ポスト後に温かい共感メッセージが届きます' 
              : '今回は共感メッセージを受け取りません'}
          </Text>
        </View>

        {/* 複数画像アップロード機能 */}
        <MultipleImageUploadComponent
          onImagesSelected={handleImagesSelected}
          onImageRemoved={handleImageRemoved}
          selectedImages={selectedImages}
          maxImages={5}
          disabled={isPosting}
          showPreview={true}
        />

        <View style={dynamicStyles.infoCard}>
          <Heart size={20} color={theme.colors.primary} />
          <Text style={dynamicStyles.infoText}>
            あなたの気持ちや体験を自由に共有してください。ママたちがあなたの投稿に共感してくれます。
          </Text>
          </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={dynamicStyles.footer}>
        {Platform.OS === 'web' ? (
          // Web版用のボタン（シンプル版）
          <View
            style={[
              dynamicStyles.postButton, 
              (isOverLimit || isPosting) && dynamicStyles.postButtonDisabled,
              // Web専用スタイル
              { 
                ...(Platform.OS === 'web' && {
                  cursor: (isOverLimit || isPosting) ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  pointerEvents: (isOverLimit || isPosting) ? 'none' : 'auto'
                } as any)
              }
            ]}
            // Web用のDOMイベント - 型アサーションで回避
            {...(Platform.OS === 'web' && {
              onClick: () => {
                if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                  console.log('🚨 Webボタンクリック:', { isOverLimit, isPosting });
                }
                
                if (!isOverLimit && !isPosting) {
                  try {
                    handlePost();
                  } catch (error) {
                    console.error('❌ handlePostエラー:', error);
                  }
                } else {
                  if (__DEV__ && featureFlags.isDebugModeEnabled()) {
                    console.log('❌ ボタン無効化中');
                  }
                }
              }
            })}
          >
            {isPosting ? (
              <>
                <ActivityIndicator size={20} color="#fff" />
                <Text style={styles.postButtonText}>ポスト中...</Text>
              </>
            ) : (
              <>
                <Send size={20} color="#fff" />
                <Text style={styles.postButtonText}>ポスト</Text>
              </>
            )}
          </View>
        ) : (
          // モバイル版用のTouchableOpacity
          <TouchableOpacity
            style={[
              dynamicStyles.postButton, 
              (isOverLimit || isPosting) && dynamicStyles.postButtonDisabled
            ]}
            onPress={handlePost}
            disabled={isOverLimit || isPosting}
            activeOpacity={0.7}
          >
            {isPosting ? (
              <>
                <ActivityIndicator size={20} color="#fff" />
                <Text style={styles.postButtonText}>ポスト中...</Text>
              </>
            ) : (
              <>
                <Send size={20} color="#fff" />
                <Text style={styles.postButtonText}>ポスト</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  textInputContainer: {
    flex: 1,
    minHeight: 200,
    marginBottom: 16,
  },
  inputFooter: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});