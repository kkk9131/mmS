import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native';
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
    console.log('🔍 認証状態変更:', {
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      user: auth.user,
      session: auth.session,
      profile: auth.profile,
      error: auth.error
    });
    
    if (auth.isAuthenticated && !auth.isLoading) {
      console.log('✅ 認証完了 - ホーム画面に遷移します');
      router.replace('/(tabs)');
    } else if (!auth.isAuthenticated && !auth.isLoading && auth.user) {
      console.log('⚠️ ユーザーは存在するが認証されていない状態');
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.user]);

  const handleLogin = async () => {
    console.log('🚀 ログイン開始');
    console.log('プラットフォーム:', Platform.OS);
    console.log('Redux有効:', isReduxEnabled);
    console.log('Supabase有効:', featureFlags.isSupabaseEnabled());
    console.log('デバッグモード:', featureFlags.isDebugModeEnabled());
    
    // Input validation
    if (!maternalBookNumber.trim()) {
      setLocalError('母子手帳番号を入力してください');
      return;
    }
    
    if (!nickname.trim()) {
      setLocalError('ニックネームを入力してください');
      return;
    }

    if (maternalBookNumber.length < 8) {
      setLocalError('母子手帳番号は正しい形式で入力してください');
      return;
    }

    if (nickname.length < 2 || nickname.length > 20) {
      setLocalError('ニックネームは2文字以上20文字以下で入力してください');
      return;
    }

    // Clear any previous errors
    setLocalError('');
    console.log('✅ バリデーション完了');
    
    try {
      if (isReduxEnabled) {
        console.log('🔄 Redux認証開始');
        console.log('認証情報:', { maternalBookNumber: maternalBookNumber.trim(), nickname: nickname.trim() });
        
        // Use Redux for login
        const result = await dispatch(signInWithMaternalBook({
          mothersHandbookNumber: maternalBookNumber.trim(),
          nickname: nickname.trim(),
        }));
        
        console.log('📊 Redux結果:', result);
        
        if (signInWithMaternalBook.fulfilled.match(result)) {
          console.log('✅ Redux login successful', result.payload);
          // Navigation is handled by useEffect when auth.isAuthenticated changes
        } else {
          console.error('❌ Redux login failed:', result.payload);
          console.error('エラータイプ:', result.type);
          console.error('完全な結果:', result);
          
          // Set local error if Redux error is not displayed
          if (!auth.error) {
            setLocalError(typeof result.payload === 'string' ? result.payload : 'ログインに失敗しました');
          }
        }
      } else {
        console.log('🔄 Context認証開始');
        
        // Fallback to AuthContext
        await contextLogin(maternalBookNumber.trim(), nickname.trim());

        console.log('✅ Context login successful');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('💥 予期しないエラー:', error);
      console.error('エラーの型:', typeof error);
      console.error('エラーメッセージ:', error?.message);
      console.error('エラースタック:', error?.stack);
      console.error('エラーオブジェクト全体:', error);

      // For non-Redux errors, set local error
      if (!isReduxEnabled) {
        if (error.type === 'network') {
          setLocalError('ネットワークエラーが発生しました。接続を確認してください。');
        } else if (error.status === 401) {
          setLocalError('認証に失敗しました。入力内容を確認してください。');
        } else if (error.type === 'timeout') {
          setLocalError('接続がタイムアウトしました。もう一度お試しください。');
        } else {
          setLocalError(`予期しないエラーが発生しました: ${error?.message || error}`);
        }
      } else {
        // Redux使用時でもローカルエラーを設定
        setLocalError(`予期しないエラーが発生しました: ${error?.message || error}`);
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
          <View style={styles.header}>
        <Heart size={48} color={theme.colors.primary} fill={theme.colors.primary} />
        <Text style={dynamicStyles.title}>Mamapace</Text>
        <Text style={dynamicStyles.subtitle}>ママの共感コミュニティ</Text>
      </View>

      <View style={styles.welcomeSection}>
        <Text style={dynamicStyles.welcomeTitle}>おかえりなさい</Text>
        <Text style={dynamicStyles.welcomeText}>
          深夜でも早朝でも、いつでもママたちがあなたを待っています。
          今日も一日お疲れさまでした。
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={dynamicStyles.formTitle}>匿名ログイン</Text>
        
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
            >
              <Text style={styles.devQuickLoginText}>クイックログイン</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableWithoutFeedback onPress={() => handleInputContainerPress(maternalBookRef)}>
          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>母子手帳番号</Text>
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
          />
            <Text style={dynamicStyles.inputHelper}>
              自治体発行の母子手帳に記載されている番号を入力してください
            </Text>
          </View>
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={() => handleInputContainerPress(nicknameRef)}>
          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>ニックネーム</Text>
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
          />
            <Text style={dynamicStyles.inputHelper}>
              コミュニティ内で表示される名前（2-20文字）
            </Text>
          </View>
        </TouchableWithoutFeedback>

        {/* Show error from Redux state or local state */}
        {((isReduxEnabled && auth.error) || localError) ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {isReduxEnabled ? auth.error : localError}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity 
          style={[styles.loginButton, ((isReduxEnabled && auth.isLoading) || (!isReduxEnabled && false)) && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={isReduxEnabled ? auth.isLoading : false}
        >
          {(isReduxEnabled && auth.isLoading) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.loginButtonText}>ログイン</Text>
              <ArrowRight size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.infoSection}>
        <Text style={dynamicStyles.infoTitle}>Mamapaceについて</Text>
        <Text style={dynamicStyles.infoText}>
          • 完全匿名でご利用いただけます{'\n'}
          • メールアドレスや電話番号は不要です{'\n'}
          • 24時間いつでも安心して投稿できます{'\n'}
          • AI共感ボットがあなたの気持ちに寄り添います{'\n'}
          • すべての投稿は暖かいコミュニティで共有されます
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={dynamicStyles.footerText}>
          プライバシーポリシー | 利用規約 | お問い合わせ
        </Text>
        <Text style={dynamicStyles.versionText}>
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
});