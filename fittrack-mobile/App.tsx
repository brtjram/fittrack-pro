import React, { useRef, useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useTheme } from './src/theme/useTheme';
import { useNotifications } from './src/hooks/useNotifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkStatus } from './src/components/NetworkStatus';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { FontAssets, Fonts } from './src/theme/fonts';

// React Native has no bundled URL polyfill (react-native-url-polyfill isn't a
// dependency here), so `new URL(...).searchParams` leans on whatever partial
// URL/URLSearchParams shim the JS engine happens to ship — which has
// historically decoded percent-escapes and "+"-as-space inconsistently.
// mobile-auth/page.tsx builds this link with URLSearchParams.toString() (so
// names with spaces come through as "+"), so parse it by hand instead of
// trusting the engine's URL implementation to get both encodings right.
function parseAuthDeepLinkParams(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return {};
  const params: Record<string, string> = {};
  for (const pair of url.slice(queryIndex + 1).split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);
    try {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Malformed percent-escape in this pair — skip it rather than fail the whole link
    }
  }
  return params;
}

function handleAuthDeepLink(url: string, loginWithToken: (token: string, user: any) => Promise<void>) {
  const path = url.split('?')[0];
  if (!/:\/\/auth\/?$/.test(path)) return;
  const { token, id, name = '', email = '' } = parseAuthDeepLinkParams(url);
  if (token && id) {
    loginWithToken(token, { id, name, email });
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
          regular: { fontFamily: Fonts.sans, fontWeight: '400' as const },
          medium: { fontFamily: Fonts.sansMedium, fontWeight: '500' as const },
          bold: { fontFamily: Fonts.sansSemiBold, fontWeight: '600' as const },
          heavy: { fontFamily: Fonts.sansBold, fontWeight: '700' as const },
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
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  if (fontError) console.error('[fonts] failed to load', fontError);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0D0B' }}>
        <ActivityIndicator size="large" color="#F59148" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
