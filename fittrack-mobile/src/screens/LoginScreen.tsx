import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StyleSheet, Linking,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/useTheme';
import { LogoMark } from '../components/Logo';
import { registerUser } from '../services/api';

const API_BASE = __DEV__
  ? 'http://localhost:3000'
  : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myfittrack.pro');

type View = 'signin' | 'signup';

export function LoginScreen() {
  const { login } = useAuth();
  const { colors, isDark } = useTheme();
  const [view, setView] = useState<View>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const switchView = (v: View) => {
    setView(v);
    setError('');
    setInfo('');
  };

  const handleSubmit = async () => {
    if (!email || !password) return;
    if (view === 'signup' && !name.trim()) { setError('Please enter your name.'); return; }
    if (view === 'signup' && password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (view === 'signup') {
        await registerUser(name.trim(), email, password);
      }
      await login(email, password);
    } catch (e: unknown) {
      if (view === 'signup' && e instanceof Error && e.message.includes('already exists')) {
        setError('An account with this email already exists. Sign in instead.');
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError('');
    // Opens the web OAuth page which redirects back via deep link after signing in
    Linking.openURL(`${API_BASE}/mobile-auth`).catch(() => {
      setError('Could not open Google sign-in. Please try again.');
      setGoogleLoading(false);
    });
    // Reset loading after a moment — the app will be in background while OAuth completes
    setTimeout(() => setGoogleLoading(false), 3000);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.outer, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LogoMark size={56} color={colors.primary} bg={isDark ? '#1A1A1A' : '#F0F0F0'} />
          <Text style={[styles.wordmark, { color: colors.foreground }]}>
            FIT<Text style={{ color: colors.primary }}>TRACK</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Train smarter. Eat better. Track everything.
          </Text>
        </View>

        <View style={styles.card}>
          {/* Tab toggle */}
          <View style={[styles.tabs, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, view === 'signin' && { backgroundColor: colors.card }]}
              onPress={() => switchView('signin')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, { color: view === 'signin' ? colors.foreground : colors.mutedForeground }]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, view === 'signup' && { backgroundColor: colors.card }]}
              onPress={() => switchView('signup')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, { color: view === 'signup' ? colors.foreground : colors.mutedForeground }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <GoogleIcon />
            )}
            <Text style={[styles.googleLabel, { color: colors.foreground }]}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Error / info */}
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '40' }]}>
              <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
            </View>
          ) : info ? (
            <View style={[styles.banner, { backgroundColor: colors.success + '12', borderColor: colors.success + '40' }]}>
              <Text style={{ color: colors.success, fontSize: 13 }}>{info}</Text>
            </View>
          ) : null}

          {/* Name (sign-up only) */}
          {view === 'signup' && (
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>FULL NAME</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
          )}

          {/* Email */}
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, marginTop: view === 'signup' ? 12 : 0 }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
            <View style={styles.passwordHeader}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
              {view === 'signin' && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`${API_BASE}/login`)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.forgotLink, { color: colors.primary }]}>Forgot?</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={password}
              onChangeText={setPassword}
              placeholder={view === 'signup' ? 'Min 8 characters' : 'Your password'}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: loading || !email || !password ? 0.55 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={loading || !email || !password}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitLabel, { color: colors.primaryForeground }]}>
                {view === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 80, paddingBottom: 36, paddingHorizontal: 24 },
  wordmark: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginTop: 14 },
  tagline: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  card: { paddingHorizontal: 24 },
  tabs: {
    flexDirection: 'row', borderRadius: 12, padding: 3,
    borderWidth: 1, marginBottom: 20,
  },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  tabLabel: { fontSize: 13, fontWeight: '700' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, paddingVertical: 14,
  },
  googleLabel: { fontSize: 15, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  banner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  inputWrap: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  input: { fontSize: 15, paddingVertical: 2 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  forgotLink: { fontSize: 11, fontWeight: '700' },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
