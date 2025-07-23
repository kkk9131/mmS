import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { connect, ConnectedProps } from 'react-redux';
import { AppDispatch } from '../store';
import { setError, clearError } from '../store/slices/uiSlice';
import { SupabaseErrorHandler, SupabaseError } from '../utils/SupabaseErrorHandler';

interface ErrorBoundaryState {
  hasError: boolean;
  error: SupabaseError | null;
}

interface OwnProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

const mapDispatch = (dispatch: AppDispatch) => ({
  setGlobalError: (error: SupabaseError) => dispatch(setError(error)),
  clearGlobalError: () => dispatch(clearError())
});

const connector = connect(null, mapDispatch);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = OwnProps & PropsFromRedux;

class ErrorBoundary extends Component<Props, ErrorBoundaryState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const supabaseError = SupabaseErrorHandler.handle(error);
    return {
      hasError: true,
      error: supabaseError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Set global error state
    if (this.state.error) {
      this.props.setGlobalError(this.state.error);
    }
    
    // Log to error reporting service in production
    if (!__DEV__) {
      // TODO: Send to error reporting service (e.g., Sentry)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.clearGlobalError();
  };

  handleRetry = () => {
    this.handleReset();
    // Force re-render of children
    this.forceUpdate();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Ionicons 
              name={this.getErrorIcon(this.state.error.type)} 
              size={64} 
              color="#FF6B6B" 
              style={styles.icon}
            />
            
            <Text style={styles.title}>エラーが発生しました</Text>
            <Text style={styles.message}>{this.state.error.userMessage}</Text>
            
            {__DEV__ && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>Type: {this.state.error.type}</Text>
                <Text style={styles.debugText}>Message: {this.state.error.message}</Text>
                {this.state.error.code && (
                  <Text style={styles.debugText}>Code: {this.state.error.code}</Text>
                )}
              </View>
            )}
            
            <View style={styles.actions}>
              {this.state.error.recoverable && (
                <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>再試行</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
                <Text style={styles.resetButtonText}>ホームに戻る</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }

  private getErrorIcon(errorType: string): keyof typeof Ionicons.glyphMap {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return 'wifi-outline';
      case 'AUTH_ERROR':
        return 'lock-closed-outline';
      case 'PERMISSION_ERROR':
        return 'shield-outline';
      case 'VALIDATION_ERROR':
        return 'alert-circle-outline';
      case 'RATE_LIMIT':
        return 'time-outline';
      default:
        return 'warning-outline';
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  debugInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 24,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  resetButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default connector(ErrorBoundary);