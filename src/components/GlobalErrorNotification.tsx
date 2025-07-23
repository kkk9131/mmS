import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, SafeAreaView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { hideNotification, clearError } from '../store/slices/uiSlice';
import { SupabaseErrorHandler } from '../utils/SupabaseErrorHandler';

export const GlobalErrorNotification: React.FC = () => {
  const dispatch = useDispatch();
  const { notifications, globalError } = useSelector((state: RootState) => state.ui);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleRetry = () => {
    if (globalError && SupabaseErrorHandler.isRecoverable(globalError)) {
      // TODO: Implement retry logic based on the error context
      console.log('Retry action for error:', globalError);
    }
    handleDismiss();
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