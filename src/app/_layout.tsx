import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ReduxProvider } from '@/providers/ReduxProvider';
import { View, ActivityIndicator } from 'react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import { GlobalErrorNotification } from '@/components/GlobalErrorNotification';

function RootLayoutNav() {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#ff6b9d" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ReduxProvider>
      <ErrorBoundary>
        <AuthProvider>
          <RootLayoutNav />
          <StatusBar style="light" />
          <GlobalErrorNotification />
        </AuthProvider>
      </ErrorBoundary>
    </ReduxProvider>
  );
}