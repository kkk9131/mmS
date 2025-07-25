import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface UserFriendlyErrorProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
}

export const UserFriendlyError: React.FC<UserFriendlyErrorProps> = ({
  message,
  type = 'error',
  onRetry,
}) => {
  const iconName = type === 'error' ? 'alert-circle' : 
                   type === 'warning' ? 'alert-triangle' : 'info';
  const iconColor = type === 'error' ? colors.semantic.error :
                    type === 'warning' ? colors.semantic.warning : colors.semantic.info;

  return (
    <View style={[styles.container, styles[type]]}>
      <Feather name={iconName} size={20} color={iconColor} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>再試行</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  error: {
    backgroundColor: '#FFF1F0',
    borderColor: '#FFCCC7',
    borderWidth: 1,
  },
  warning: {
    backgroundColor: '#FFFBE6',
    borderColor: '#FFE58F',
    borderWidth: 1,
  },
  info: {
    backgroundColor: '#E6F7FF',
    borderColor: '#91D5FF',
    borderWidth: 1,
  },
  message: {
    flex: 1,
    marginLeft: 8,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
  },
  retryText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral.white,
    fontWeight: typography.fontWeight.medium,
  },
});
