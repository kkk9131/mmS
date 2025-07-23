import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Heart, ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { signInWithMaternalBook, clearError } from '../store/slices/authSlice';
import { FeatureFlagsManager } from '../services/featureFlags';

export default function LoginScreen() {
  const [maternalBookNumber, setMaternalBookNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [localError, setLocalError] = useState('');
  
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
    if (auth.isAuthenticated && !auth.isLoading) {
      router.replace('/(tabs)');
    }
  }, [auth.isAuthenticated, auth.isLoading]);

  const handleLogin = async () => {
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
    
    try {
      if (isReduxEnabled) {
        // Use Redux for login
        const result = await dispatch(signInWithMaternalBook({
          mothersHandbookNumber: maternalBookNumber.trim(),
          nickname: nickname.trim(),
        }));
        
        if (signInWithMaternalBook.fulfilled.match(result)) {
          if (featureFlags.isDebugModeEnabled()) {
            console.log('Redux login successful');
          }
          // Navigation is handled by useEffect when auth.isAuthenticated changes
        } else {
          // Error handling is done in Redux state
          if (featureFlags.isDebugModeEnabled()) {
            console.error('Redux login failed:', result.payload);
          }
        }
      } else {
        // Fallback to AuthContext
        await contextLogin(maternalBookNumber.trim(), nickname.trim());

        if (featureFlags.isDebugModeEnabled()) {
          console.log('Context login successful');
        }

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (featureFlags.isDebugModeEnabled()) {
        console.error('Login failed:', error);
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
          setLocalError('ログインに失敗しました。もう一度お試しください。');
        }
      }
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
        <Heart size={48} color="#ff6b9d" fill="#ff6b9d" />
        <Text style={styles.title}>Mamaspace</Text>
        <Text style={styles.subtitle}>ママの共感コミュニティ</Text>
      </View>

      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>おかえりなさい</Text>
        <Text style={styles.welcomeText}>
          深夜でも早朝でも、いつでもママたちがあなたを待っています。
          今日も一日お疲れさまでした。
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formTitle}>匿名ログイン</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>母子手帳番号</Text>
          <TextInput
            style={styles.textInput}
            placeholder="例: 1234-5678-901"
            placeholderTextColor="#666"
            value={maternalBookNumber}
            onChangeText={setMaternalBookNumber}
            keyboardType="numeric"
            maxLength={15}
            returnKeyType="next"
            onSubmitEditing={() => {
              // Focus next input (nickname)
            }}
            blurOnSubmit={false}
          />
          <Text style={styles.inputHelper}>
            自治体発行の母子手帳に記載されている番号を入力してください
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>ニックネーム</Text>
          <TextInput
            style={styles.textInput}
            placeholder="例: みさき"
            placeholderTextColor="#666"
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            blurOnSubmit={true}
          />
          <Text style={styles.inputHelper}>
            コミュニティ内で表示される名前（2-20文字）
          </Text>
        </View>

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

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Mamapaceについて</Text>
        <Text style={styles.infoText}>
          • 完全匿名でご利用いただけます{'\n'}
          • メールアドレスや電話番号は不要です{'\n'}
          • 24時間いつでも安心して投稿できます{'\n'}
          • AI共感ボットがあなたの気持ちに寄り添います{'\n'}
          • すべての投稿は暖かいコミュニティで共有されます
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          プライバシーポリシー | 利用規約 | お問い合わせ
        </Text>
        <Text style={styles.versionText}>
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
});