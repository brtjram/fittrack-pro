import React, { useRef } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useTheme } from './src/theme/useTheme';
import { useNotifications } from './src/hooks/useNotifications';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/LoginScreen';

function AppContent() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const navigationRef = useRef<any>(null);

  // Register push token, set up local reminders, handle notification taps
  useNotifications(navigationRef);

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
      {user ? <AppNavigator /> : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
