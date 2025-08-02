import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, SafeAreaView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { hideNotification, clearError } from '../store/slices/uiSlice';
import { SupabaseErrorHandler } from '../utils/SupabaseErrorHandler';
import { errorRetryService } from '../services/ErrorRetryService';

export const GlobalErrorNotification: React.FC = () => {
  const dispatch = useDispatch();
  const { notifications, globalError } = useSelector((state: RootState) => state.ui);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (notifications.visible || globalError) {
      // Show notification
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after duration (if specified)
      const duration = notifications.duration || (notifications.type === 'error' ? 5000 : 3000);
      if (duration > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          handleDismiss();
        }, duration);
      }
    } else {
      // Hide notification
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notifications.visible, globalError, fadeAnim, translateY]);

  const handleDismiss = () => {
    dispatch(hideNotification());
    if (globalError) {
      dispatch(clearError());
    }
  };

  const handleRetry = async () => {
    if (globalError && SupabaseErrorHandler.isRecoverable(globalError)) {
      try {
        // エラーコンテキストから操作を推測
        const operation = inferOperationFromError(globalError);
        const success = await errorRetryService.retryOperation(globalError, {
          operation,
          strategyName: 'default'
        });
        
        if (success) {
          console.log('Retry successful for error:', globalError);
          // 成功時は通知を自動で閉じる
          handleDismiss();
          return;
        } else {
          console.log('Retry failed for error:', globalError);
        }
      } catch (retryError) {
        console.error('Retry attempt failed:', retryError);
      }
    }
    
    // 再試行に失敗した場合や再試行できない場合は手動で閉じる
    handleDismiss();
  };
  
  // エラーから操作を推測するヘルパー関数
  const inferOperationFromError = (error: any): string => {
    const message = error.message || error.userMessage || '';
    
    if (message.includes('post') && message.includes('create')) {
      return 'posts/create';
    }
    if (message.includes('post') && message.includes('fetch')) {
      return 'posts/get';
    }
    if (message.includes('like')) {
      return 'posts/like';
    }
    if (message.includes('notification')) {
      return 'notifications/get';
    }
    
    return 'unknown';
  };

  if (!notifications.visible && !globalError) {
    return null;
  }

  const message = globalError 
    ? SupabaseErrorHandler.getUserMessage(globalError)
    : notifications.message;

  const type = globalError ? 'error' : notifications.type;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'info':
      default:
        return '#2196F3';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <SafeAreaView>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleDismiss}
          style={[
            styles.notification,
            { backgroundColor: getBackgroundColor() },
          ]}
        >
          <View style={styles.content}>
            <Ionicons name={getIcon() as any} size={24} color="#FFFFFF" style={styles.icon} />
            <Text style={styles.message} numberOfLines={2}>
              {message}
            </Text>
            {globalError && SupabaseErrorHandler.isRecoverable(globalError) && (
              <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>再試行</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  notification: {
    margin: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  retryButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});