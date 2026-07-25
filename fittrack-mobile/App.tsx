import React, { useRef, useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ThemeProvider, useTheme } from './src/theme/useTheme';
import { useNotifications } from './src/hooks/useNotifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkStatus } from './src/components/NetworkStatus';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/LoginScreen';

function handleAuthDeepLink(url: string, loginWithToken: (token: string, user: any) => Promise<void>) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '//auth' && parsed.host !== 'auth') return;
    const token = parsed.searchParams.get('token');
    const id = parsed.searchParams.get('id');
    const name = parsed.searchParams.get('name') ?? '';
    const email = parsed.searchParams.get('email') ?? '';
    if (token && id) {
      loginWithToken(token, { id, name, email });
    }
  } catch {
    // ignore malformed URLs
  }
}

function AppContent() {
  const { user, loading, loginWithToken } = useAuth();
  const { colors, isDark } = useTheme();
  const navigationRef = useRef<any>(null);

  // Register push token, set up local reminders, handle notification taps
  useNotifications(navigationRef);

  // Handle Google OAuth deep link: com.brtjram.fittrackpro://auth?token=...
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url, loginWithToken);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleAuthDeepLink(url, loginWithToken);
    });
    return () => sub.remove();
  }, [loginWithToken]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: isDark,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.foreground,
          border: colors.border,
          notification: colors.primary,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' as const },
          medium: { fontFamily: 'System', fontWeight: '500' as const },
          bold: { fontFamily: 'System', fontWeight: '700' as const },
          heavy: { fontFamily: 'System', fontWeight: '800' as const },
        },
      }}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NetworkStatus />
      {user ? <AppNavigator /> : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
