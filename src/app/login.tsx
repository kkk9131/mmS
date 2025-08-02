import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native';
import { ImprovedButton } from '../components/ImprovedButton';
import { UserFriendlyError } from '../components/UserFriendlyError';
import { Heart, ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { signInWithMaternalBook, clearError } from '../store/slices/authSlice';
import { FeatureFlagsManager } from '../services/featureFlags';
import { useTheme } from '../contexts/ThemeContext';

export default function LoginScreen() {
  const [maternalBookNumber, setMaternalBookNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [localError, setLocalError] = useState('');
  const { theme } = useTheme();
  
  // Refs for input focusing (Web compatibility)
  const maternalBookRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);
  
  // Redux state and actions
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const featureFlags = FeatureFlagsManager.getInstance();
  const isReduxEnabled = featureFlags.isReduxEnabled();
  
  // Fallback to AuthContext if Redux is disabled
  const { login: contextLogin } = useAuth();
  
  // Clear error when component unmounts or when input changes
  useEffect(() => {
    return () => {
      if (isReduxEnabled) {
        dispatch(clearError());
      }
    };
  }, [dispatch, isReduxEnabled]);
  
  // Clear local error when inputs change
  useEffect(() => {
    if (localError) {
      setLocalError('');
    }
    if (isReduxEnabled && auth.error) {
      dispatch(clearError());
    }
  }, [maternalBookNumber, nickname, localError, auth.error, dispatch, isReduxEnabled]);
  
  // Navigate to home when authentication is successful
  useEffect(() => {
    if (featureFlags.isDebugModeEnabled()) {
      console.log('🔍 認証状態変更:', {
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        user: auth.user,
        session: auth.session,
        profile: auth.profile,
        error: auth.error
      });
    }
    
    if (auth.isAuthenticated && !auth.isLoading) {
      if (featureFlags.isDebugModeEnabled()) {
        console.log('✅ 認証完了 - ホーム画面に遷移します');
      }
      router.replace('/(tabs)');
    } else if (!auth.isAuthenticated && !auth.isLoading && auth.user) {
      if (featureFlags.isDebugModeEnabled()) {
        console.log('⚠️ ユーザーは存在するが認証されていない状態');
      }
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.user]);

  const handleLogin = async () => {
    if (featureFlags.isDebugModeEnabled()) {
      console.log('🚀 ログイン開始');
      console.log('プラットフォーム:', Platform.OS);
      console.log('Redux有効:', isReduxEnabled);
      console.log('Supabase有効:', featureFlags.isSupabaseEnabled());
      console.log('デバッグモード:', featureFlags.isDebugModeEnabled());
    }
    
    // Input validation (簡素化版)
    if (!maternalBookNumber.trim()) {
      setLocalError('母子手帳番号を入力してください');
      return;
    }
    
    // ニックネームが空の場合は自動生成を許可
    const finalNickname = nickname.trim() || null;

    // Clear any previous errors
    setLocalError('');
    if (featureFlags.isDebugModeEnabled()) {
      console.log('✅ バリデーション完了');
    }
    
    try {
      if (isReduxEnabled) {
        if (featureFlags.isDebugModeEnabled()) {
          console.log('🔄 Redux認証開始');
          console.log('認証情報:', { maternalBookNumber: maternalBookNumber.trim(), nickname: nickname.trim() });
        }
        
        // Use Redux for login (ニックネーム自動生成対応)
        const result = await dispatch(signInWithMaternalBook({
          mothersHandbookNumber: maternalBookNumber.trim(),
          nickname: finalNickname || 'ママ',
        }));
        
        if (featureFlags.isDebugModeEnabled()) {
          console.log('📊 Redux結果:', result);
        }
        
        if (signInWithMaternalBook.fulfilled.match(result)) {
          if (featureFlags.isDebugModeEnabled()) {
            console.log('✅ Redux login successful', result.payload);
          }
          // Navigation is handled by useEffect when auth.isAuthenticated changes
        } else {
          if (featureFlags.isDebugModeEnabled()) {
            console.error('❌ Redux login failed:', result.payload);
            console.error('エラータイプ:', result.type);
            console.error('完全な結果:', result);
          }
          
          // Set local error if Redux error is not displayed
          if (!auth.error) {
            setLocalError(typeof result.payload === 'string' ? result.payload : 'ログインに失敗しました');
          }
        }
      } else {
        if (featureFlags.isDebugModeEnabled()) {
          console.log('🔄 Context認証開始');
        }
        
        // Fallback to AuthContext
        await contextLogin(maternalBookNumber.trim(), nickname.trim());

        if (featureFlags.isDebugModeEnabled()) {
          console.log('✅ Context login successful');
        }
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('💥 予期しないエラー:', error);
      if (featureFlags.isDebugModeEnabled()) {
        console.error('エラーの型:', typeof error);
        console.error('エラーメッセージ:', error?.message);
        console.error('エラースタック:', error?.stack);
        console.error('エラーオブジェクト全体:', error);
      }

      // デバッグ用の詳細エラー情報
      const errorDetails = {
        message: error?.message || 'Unknown error',
        code: error?.code,
        status: error?.status,
        type: error?.type,
        details: error?.details,
        hint: error?.hint,
        errorName: error?.name,
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
        platform: Platform.OS,
        version: Platform.Version,
      };
      
      if (featureFlags.isDebugModeEnabled()) {
        console.error('📊 詳細エラー情報:', errorDetails);
      }

      // For non-Redux errors, set local error
      if (!isReduxEnabled) {
        if (error.type === 'network') {
          setLocalError('ネットワークエラーが発生しました。接続を確認してください。');
        } else if (error.status === 401) {
          setLocalError('認証に失敗しました。入力内容を確認してください。');
        } else if (error.type === 'timeout') {
          setLocalError('接続がタイムアウトしました。もう一度お試しください。');
        } else {
          setLocalError(`エラー: ${error?.message || error} (コード: ${error?.code || 'N/A'})`);
        }
      } else {
        // Redux使用時でもローカルエラーを設定
        setLocalError(`エラー: ${error?.message || error} (コード: ${error?.code || 'N/A'})`);
      }
    }
  };

  const dismissKeyboard = () => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
  };

  // Web-specific: Add click handler to focus on inputs
  const handleInputContainerPress = (inputRef: React.RefObject<TextInput | null>) => {
    if (Platform.OS === 'web' && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // 動的スタイル
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 36,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginTop: 16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    welcomeTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.colors.text.primary,
      textAlign: 'center',
      marginBottom: 12,
    },
    welcomeText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    formTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 24,
      textAlign: 'center',
    },
    inputLabel: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginBottom: 8,
      fontWeight: '500',
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text.primary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 48,
    },
    inputHelper: {
      fontSize: 12,
      color: theme.colors.text.disabled,
      marginTop: 6,
      lineHeight: 16,
    },
    infoSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    infoTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 12,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.text.disabled,
      textAlign: 'center',
      marginBottom: 8,
    },
    versionText: {
      fontSize: 10,
      color: theme.colors.text.disabled,
      textAlign: 'center',
    },
    devHelper: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    devHelperText: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      lineHeight: 18,
      marginBottom: 12,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header} accessible={true} accessibilityRole="header">
        <Heart size={48} color={theme.colors.primary} fill={theme.colors.primary} accessibilityElementsHidden={true} />
        <Text style={dynamicStyles.title} accessibilityRole="text">Mamapace</Text>
        <Text style={dynamicStyles.subtitle} accessibilityRole="text">ママの共感コミュニティ</Text>
      </View>

      <View style={styles.welcomeSection} accessible={true}>
        <Text style={dynamicStyles.welcomeTitle} accessibilityRole="text">おかえりなさい</Text>
        <Text style={dynamicStyles.welcomeText} accessibilityRole="text">
          深夜でも早朝でも、いつでもママたちがあなたを待っています。
          今日も一日お疲れさまでした。
        </Text>
      </View>

      <View style={styles.formSection} accessible={true} accessibilityRole="none" accessibilityLabel="ログインフォーム">
        <Text style={dynamicStyles.formTitle} accessibilityRole="text">新規登録・ログイン</Text>
        
        {/* Development Mode Helper */}
        {featureFlags.isDebugModeEnabled() && (
          <View style={dynamicStyles.devHelper}>
            <Text style={styles.devHelperTitle}>🚀 開発モード - テスト用ログイン</Text>
            <Text style={dynamicStyles.devHelperText}>
              母子手帳番号: 任意の8文字以上{'\n'}
              ニックネーム: 任意の2-20文字{'\n'}
              例: 12345678, テストユーザー
            </Text>
            <TouchableOpacity 
              style={styles.devQuickLogin}
              onPress={() => {
                setMaternalBookNumber('12345678');
                setNickname('テストユーザー');
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="クイックログイン"
              accessibilityHint="テスト用の認証情報を自動入力します"
            >
              <Text style={styles.devQuickLoginText}>クイックログイン</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableWithoutFeedback onPress={() => handleInputContainerPress(maternalBookRef)}>
          <View style={styles.inputGroup} accessible={true}>
            <Text style={dynamicStyles.inputLabel} accessibilityRole="text" nativeID="maternalBookLabel">母子手帳番号</Text>
          <TextInput
            ref={maternalBookRef}
            style={dynamicStyles.textInput}
            placeholder="例: 1234-5678-901"
            placeholderTextColor={theme.colors.text.disabled}
            value={maternalBookNumber}
            onChangeText={setMaternalBookNumber}
            keyboardType="default"
            maxLength={15}
            returnKeyType="next"
            onSubmitEditing={() => {
              if (nicknameRef.current) {
                nicknameRef.current.focus();
              }
            }}
            blurOnSubmit={false}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={Platform.OS === 'web'}
            accessible={true}
            accessibilityLabel="母子手帳番号入力"
            accessibilityHint="自治体発行の母子手帳に記載されている番号を入力してください"
            accessibilityLabelledBy="maternalBookLabel"
          />
            <Text style={dynamicStyles.inputHelper}>
              自治体発行の母子手帳に記載されている番号を入力してください
            </Text>
          </View>
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={() => handleInputContainerPress(nicknameRef)}>
          <View style={styles.inputGroup} accessible={true}>
            <Text style={dynamicStyles.inputLabel} accessibilityRole="text" nativeID="nicknameLabel">ニックネーム</Text>
          <TextInput
            ref={nicknameRef}
            style={dynamicStyles.textInput}
            placeholder="例: みさき"
            placeholderTextColor={theme.colors.text.disabled}
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            blurOnSubmit={true}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="words"
            selectTextOnFocus={Platform.OS === 'web'}
            accessible={true}
            accessibilityLabel="ニックネーム入力"
            accessibilityHint="コミュニティ内で表示される名前を2文字から20文字で入力してください"
            accessibilityLabelledBy="nicknameLabel"
          />
            <Text style={dynamicStyles.inputHelper}>
              コミュニティ内で表示される名前（2-20文字）
            </Text>
          </View>
        </TouchableWithoutFeedback>

        {/* Show error with improved component */}
        {((isReduxEnabled && auth.error) || localError) ? (
          <UserFriendlyError 
            message={isReduxEnabled ? auth.error : localError}
            type="error"
          />
        ) : null}

        <TouchableOpacity 
          style={[styles.loginButton, ((isReduxEnabled && auth.isLoading) || (!isReduxEnabled && false)) && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={isReduxEnabled ? auth.isLoading : false}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isReduxEnabled && auth.isLoading ? "認証処理中" : "新規登録・ログイン"}
          accessibilityHint="タップして新規登録またはログインします"
          accessibilityState={{ disabled: isReduxEnabled ? auth.isLoading : false }}
        >
          {(isReduxEnabled && auth.isLoading) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.loginButtonText}>新規登録・ログイン</Text>
              <ArrowRight size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.infoSection} accessible={true} accessibilityRole="none">
        <Text style={dynamicStyles.infoTitle} accessibilityRole="text">🔒 安心・安全な認証システム</Text>
        <Text style={dynamicStyles.infoText} accessibilityRole="text">
          • <Text style={styles.highlightText}>新規ユーザー</Text>: 情報を入力して自動で新規登録{'\n'}
          • <Text style={styles.highlightText}>既存ユーザー</Text>: 同じ情報でログイン{'\n'}
          • 完全匿名でご利用いただけます{'\n'}
          • メールアドレスや電話番号は不要です{'\n'}
          • 母子手帳番号はハッシュ化され安全に保管されます
        </Text>
      </View>

      <View style={styles.footer} accessible={true} accessibilityRole="none">
        <Text style={dynamicStyles.footerText} accessibilityRole="text">
          プライバシーポリシー | 利用規約 | お問い合わせ
        </Text>
        <Text style={dynamicStyles.versionText} accessibilityRole="text">
          Version 1.0.0 | Made with ♡ for moms
        </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff6b9d',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 24,
  },
  formSection: {
    marginBottom: 40,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#e0e0e0',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  inputHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    lineHeight: 16,
  },
  loginButton: {
    backgroundColor: '#ff6b9d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    minHeight: 48,
  },
  loginButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginRight: 8,
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff6b9d',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ff3333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  // Development helper styles
  devHelper: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  devHelperTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
    marginBottom: 8,
  },
  devHelperText: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 18,
    marginBottom: 12,
  },
  devQuickLogin: {
    backgroundColor: '#4ade80',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  devQuickLoginText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  highlightText: {
    fontWeight: '600',
    color: '#ff6b9d',
  },
});