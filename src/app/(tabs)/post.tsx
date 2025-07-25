import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, ScrollView, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Platform, Pressable } from 'react-native';
import { Send, Heart, Bot } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PostsService } from '../../services/PostsService';
import { useTheme } from '../../contexts/ThemeContext';
import { useCreatePostMutation } from '../../store/api/postsApi';
import { FeatureFlagsManager } from '../../services/featureFlags';
import { useAppSelector } from '../../hooks/redux';
import { ImageUploadButton } from '../../components/image/ImageUploadButton';
import { ProcessedImage } from '../../types/image';
// @ts-ignore - For web DOM events support
declare global {
  namespace JSX {
    interface IntrinsicElements {
      button: any;
    }
  }
}

// ViewのWeb用型拡張
interface WebViewProps {
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
}

export default function PostScreen() {
  const { theme } = useTheme();
  const [postText, setPostText] = useState('');
  const [aiEmpathyEnabled, setAiEmpathyEnabled] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ProcessedImage[]>([]);
  const textInputRef = useRef<TextInput>(null);

  const maxCharacters = 600;
  const characterCount = postText.length;
  const isOverLimit = characterCount > maxCharacters;
  const postsService = PostsService.getInstance();
  
  // RTK Query hooks for post creation
  const [createPost] = useCreatePostMutation();
  const featureFlags = FeatureFlagsManager.getInstance();
  
  // Get current user from Redux state
  const currentUser = useAppSelector((state) => state.auth.user);

  // デバッグログを完全に削除
  // useEffect(() => {
  //   console.log('🔘 投稿ボタン状態:', { disabled: isOverLimit || isPosting });
  // }, [isOverLimit, isPosting]);

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

  // 画像選択ハンドラー
  const handleImageSelected = (images: ProcessedImage[]) => {
    setSelectedImages(prev => [...prev, ...images].slice(0, 4)); // 最大4枚まで
  };

  // 画像削除ハンドラー
  const handleImageRemoved = (imageId: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handlePost = async () => {
    console.log('🚀🚀🚀 === handlePost関数開始 === 🚀🚀🚀');
    console.log('📨 投稿テキスト:', JSON.stringify(postText));
    console.log('📊 文字数:', postText.trim().length);
    console.log('📋 現在の状態:', { isOverLimit, isPosting, currentUser: !!currentUser });
    
    // 即座にアラートでも確認
    if (Platform.OS === 'web') {
      console.log('🌐 Web環境での実行を確認');
    }
    
    if (postText.trim().length === 0) {
      console.log('❌ 投稿内容が空です');
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }
    
    console.log('✅ 投稿内容チェック通過');
    
    if (isOverLimit) {
      console.log('❌ 文字数上限超過');
      Alert.alert('エラー', `文字数が上限を超えています (${characterCount}/${maxCharacters})`);
      return;
    }
    
    console.log('✅ 文字数チェック通過');

    // FeatureFlagsとPostsServiceの状態確認
    console.log('=================== post.tsx デバッグ情報 ===================');
    console.log('🔍 featureFlags.isSupabaseEnabled():', featureFlags.isSupabaseEnabled());
    console.log('🔍 featureFlags.isReduxEnabled():', featureFlags.isReduxEnabled());
    console.log('🔍 currentUser:', currentUser);
    console.log('🔍 PostsService instance exists:', !!postsService);
    console.log('============================================================');

    console.log('✅ Alert表示直前');
    const empathyMessage = aiEmpathyEnabled ? '\n\n※ ママの味方からの共感メッセージが届きます' : '';
    
    console.log('🔔 Alert.alertを表示します');
    
    // Web版でのAlert.alert問題を回避するため、直接投稿処理を実行
    if (Platform.OS === 'web') {
      console.log('🌐 Web版: 直接投稿処理を実行');
      // Web版では確認ダイアログをスキップして直接投稿
      const shouldProceed = window.confirm(`投稿しますか？${empathyMessage}`);
      
      if (!shouldProceed) {
        console.log('❌ ユーザーがキャンセルしました');
        return;
      }
      
      console.log('✅ ユーザーが投稿を確認しました');
    }
    
    // 投稿処理の実行
    const executePost = async () => {
      console.log('🔥🔥🔥 === executePost関数開始 === 🔥🔥🔥');
      console.log('🎯 setIsPosting(true)を実行します');
      setIsPosting(true);
      console.log('✅ setIsPosting(true)完了');
      try {
        console.log('📨 投稿作成開始');
        console.log('=================== 投稿作成処理 ===================');
        console.log('🔍 currentUser exists:', !!currentUser);
        console.log('🔍 currentUser details:', currentUser);
        console.log('🔍 isSupabaseEnabled:', featureFlags.isSupabaseEnabled());
        console.log('🔍 isReduxEnabled:', featureFlags.isReduxEnabled());
        console.log('🔍 使用する投稿作成方法:', featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled() ? 'RTK Query' : 'PostsService');
        console.log('🔍 selectedImages:', selectedImages.length);
        console.log('==================================================');
        
        if (!currentUser) {
          console.error('❌ ユーザー未認証エラー');
          throw new Error('ユーザーが認証されていません');
        }
        
        // 画像アップロード処理
        let uploadedImageUrls: string[] = [];
        if (selectedImages.length > 0) {
          console.log('📤 画像アップロード開始:', selectedImages.length);
          const { ImageUploadManager } = await import('../../services/image/ImageUploadManager');
          const uploadManager = new ImageUploadManager();
          
          for (const image of selectedImages) {
            try {
              console.log('📤 画像アップロード中:', image.id);
              const uploadResult = await uploadManager.uploadImage(image, 'posts');
              
              if (uploadResult.success && uploadResult.url) {
                uploadedImageUrls.push(uploadResult.url);
                console.log('✅ 画像アップロード成功:', uploadResult.url);
              } else {
                console.error('❌ 画像アップロード失敗:', uploadResult.error);
                throw new Error(`画像のアップロードに失敗しました: ${uploadResult.error}`);
              }
            } catch (uploadError) {
              console.error('❌ 画像アップロードエラー:', uploadError);
              throw new Error(`画像のアップロードに失敗しました: ${uploadError}`);
            }
          }
          console.log('✅ 全画像アップロード完了:', uploadedImageUrls);
        }
        
        if (featureFlags.isSupabaseEnabled() && featureFlags.isReduxEnabled()) {
          console.log('🔵 RTK Queryで投稿作成を試行');
          // Use RTK Query for post creation
          // アップロードされた画像URLを使用
          const imageUrl = uploadedImageUrls.length > 0 
            ? uploadedImageUrls.length === 1 
              ? uploadedImageUrls[0] 
              : JSON.stringify(uploadedImageUrls)
            : null;

          const result = await createPost({
            content: postText.trim(),
            user_id: currentUser.id,
            is_anonymous: false,
            image_url: imageUrl,
            likes_count: 0,
            comments_count: 0
          });
          
          if ('error' in result) {
            console.error('❌ RTK Query投稿作成エラー:', result.error);
            throw new Error('投稿の作成に失敗しました');
          }
          
          console.log('✅ RTK Query投稿作成成功:', result.data);
        } else {
          console.log('🟡 PostsServiceで投稿作成を試行');
          console.log('🔍 postText.trim():', JSON.stringify(postText.trim()));
          console.log('🔍 PostsService method:', postsService.createPost);
          
          try {
            // Fallback to PostsService - アップロードされた画像URLを使用
            const result = await postsService.createPost({
              content: postText.trim(),
              images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined
            });
            console.log('✅ PostsService投稿作成成功:', result);
          } catch (postsServiceError) {
            console.error('❌ PostsService投稿作成エラー:', postsServiceError);
            throw postsServiceError;
          }
        }
        
        console.log('✅ 投稿作成成功');
        
        // Web版での成功メッセージ
        if (Platform.OS === 'web') {
          alert('投稿が正常に送信されました！');
        } else {
          Alert.alert('投稿完了', '投稿が正常に送信されました', [
            { 
              text: 'OK', 
              onPress: () => {
                setPostText('');
                setSelectedImages([]);
                router.back();
              }
            }
          ]);
        }
        
        // 投稿後のクリーンアップ
        setPostText('');
        setSelectedImages([]);
        router.back();
        
      } catch (error) {
        console.error('❌ 投稿エラー:', error);
        
        // エラーの詳細をログ出力
        if (error && typeof error === 'object') {
          console.error('エラー詳細:', {
            message: (error as any).message,
            stack: (error as any).stack,
            error: error
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

        {/* 画像アップロード機能 */}
        <ImageUploadButton
          onImageSelected={handleImageSelected}
          onImageRemoved={handleImageRemoved}
          selectedImages={selectedImages}
          maxImages={4}
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
                console.log('🚨🚨🚨 === Web View onClickイベント === 🚨🚨🚨');
                console.warn('CLICK EVENT TRIGGERED!!!'); // warn も使用
                console.error('BUTTON CLICKED!!!'); // error も使用
                
                console.log('状態:', { isOverLimit, isPosting, postText: postText.trim().length });
                console.log('条件チェック:', {
                  '!isOverLimit': !isOverLimit,
                  '!isPosting': !isPosting,
                  '両方true': !isOverLimit && !isPosting
                });
                
                if (!isOverLimit && !isPosting) {
                  console.log('✅ 条件OK - handlePostを呼び出します');
                  console.warn('ABOUT TO CALL handlePost()!!!');
                  try {
                    handlePost();
                    console.log('✅ handlePost呼び出し完了');
                  } catch (error) {
                    console.error('❌ handlePost呼び出しエラー:', error);
                  }
                } else {
                  console.log(`❌ ボタンが無効化されています - isOverLimit: ${isOverLimit}, isPosting: ${isPosting}`);
                }
              },
              onMouseDown: () => console.log('👆 View: Mouse Down'),
              onMouseUp: () => console.log('👆 View: Mouse Up')
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