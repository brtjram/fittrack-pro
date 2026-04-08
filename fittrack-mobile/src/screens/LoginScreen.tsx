import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/useTheme';

export function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.primary + '15' }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
          <Text style={[styles.iconText, { color: colors.primaryForeground }]}>FT</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>FitTrack Pro</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your expert workout planner, nutrition tracker & analytics dashboard
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '30' }]}>
            <Text style={{ color: colors.destructive, fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Sign In</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 80, paddingBottom: 40, paddingHorizontal: 24 },
  iconBox: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '700', marginTop: 20 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 6, maxWidth: 280 },
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  footerText: { fontSize: 12, textAlign: 'center', marginTop: 32 },
});
