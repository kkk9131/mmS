import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { HandPreferenceProvider } from '@/contexts/HandPreferenceContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ReduxProvider } from '@/providers/ReduxProvider';
import { View, ActivityIndicator } from 'react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import { GlobalErrorNotification } from '@/components/GlobalErrorNotification';

function RootLayoutNav() {
  const { isLoading, isAuthenticated } = useAuth();
  const { theme, isLightMode } = useTheme();

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isLightMode ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="liked-posts" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="follow-list" />
        <Stack.Screen name="post-history" />
        <Stack.Screen name="chat-list" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="room" />
        <Stack.Screen name="complaint-room" />
        <Stack.Screen name="notifications/settings" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ReduxProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <HandPreferenceProvider>
            <AuthProvider>
              <RootLayoutNav />
              <GlobalErrorNotification />
            </AuthProvider>
          </HandPreferenceProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </ReduxProvider>
  );
}