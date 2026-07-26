import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StyleSheet, Linking, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Mail } from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { PillButton } from '../components/ui';
import { LogoMark } from '../components/Logo';
import { registerUser } from '../services/api';

const API_BASE = __DEV__
  ? 'http://localhost:3000'
  : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myfittrack.pro');

type Step = 'email' | 'password';

export function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const continueWithEmail = () => {
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address.'); return; }
    setError('');
    setStep('password');
  };

  const handleSubmit = async () => {
    if (!password) return;
    if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return; }
    if (mode === 'signup' && password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') await registerUser(name.trim(), email, password);
      await login(email, password);
    } catch (e: unknown) {
      if (mode === 'signup' && e instanceof Error && e.message.includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
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
    Linking.openURL(`${API_BASE}/mobile-auth`).catch(() => {
      setError('Could not open Google sign-in. Please try again.');
      setGoogleLoading(false);
    });
    setTimeout(() => setGoogleLoading(false), 3000);
  };

  const handleAppleSignIn = () => {
    Alert.alert('Sign in with Apple', 'Coming soon.');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LogoMark size={44} color={colors.progress} secondaryColor={colors.signal} bg={colors.surface} />
          <Text style={{ fontFamily: Fonts.serif, fontSize: 32, lineHeight: 37, color: colors.ink, textAlign: 'center', marginTop: 22 }}>
            A coach that reads{'\n'}your last six weeks.
          </Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, color: colors.mutedForeground, textAlign: 'center', marginTop: 12, maxWidth: 280 }}>
            Your plan changes when your weight trend does. Photograph a plate and it's logged. That's the whole pitch.
          </Text>
        </View>

        <View style={styles.card}>
          {!!error && (
            <View style={[styles.banner, { backgroundColor: 'rgba(228,87,76,0.12)' }]}>
              <Text style={{ color: colors.danger, fontSize: 13, fontFamily: Fonts.sans }}>{error}</Text>
            </View>
          )}

          {step === 'email' ? (
            <>
              <PillButton
                label="Continue with Apple"
                colors={colors}
                tone="ink"
                onPress={handleAppleSignIn}
                icon={<AppleIcon color={colors.canvas} />}
              />
              <View style={{ height: 10 }} />
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.85}
                style={[styles.googleBtn, { backgroundColor: colors.surfaceInset }]}
              >
                {googleLoading ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : <GoogleIcon />}
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15.5, color: colors.ink }}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.hairline }]} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10, letterSpacing: 1.5, color: colors.mutedForeground, textTransform: 'uppercase' }}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.hairline }]} />
              </View>

              <View style={[styles.emailRow, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                <Mail size={17} color={colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, fontFamily: Fonts.sans, fontSize: 14.5, color: colors.ink, paddingVertical: 2 }}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onSubmitEditing={continueWithEmail}
                  returnKeyType="next"
                />
              </View>
              <View style={{ height: 10 }} />
              <PillButton label="Continue with email" colors={colors} onPress={continueWithEmail} />
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => { setStep('email'); setError(''); }} style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12.5, color: colors.mutedForeground }}>{email} · change</Text>
              </TouchableOpacity>

              {mode === 'signup' && (
                <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.hairline, marginBottom: 12 }]}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>FULL NAME</Text>
                  <TextInput
                    style={{ fontFamily: Fonts.sans, fontSize: 15, color: colors.ink }}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
                  {mode === 'signin' && (
                    <TouchableOpacity onPress={() => Linking.openURL(`${API_BASE}/login`)}>
                      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11, color: colors.signal }}>Forgot?</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={{ fontFamily: Fonts.sans, fontSize: 15, color: colors.ink }}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="done"
                />
              </View>

              <View style={{ height: 16 }} />
              <PillButton
                label={loading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in')}
                colors={colors}
                onPress={handleSubmit}
                disabled={loading || !password}
                icon={loading ? <ActivityIndicator color={colors.signalForeground} /> : undefined}
              />

              <TouchableOpacity
                onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                style={{ marginTop: 16, alignSelf: 'center' }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12.5, color: colors.mutedForeground }}>
                  {mode === 'signin' ? "New here? " : 'Already have an account? '}
                  <Text style={{ color: colors.signal, fontFamily: Fonts.sansSemiBold }}>
                    {mode === 'signin' ? 'Create an account' : 'Sign in'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedForeground, textAlign: 'center', marginTop: 26 }}>
            By continuing you agree to the{' '}
            <Text style={{ color: colors.ink, textDecorationLine: 'underline' }}>Terms</Text> and{' '}
            <Text style={{ color: colors.ink, textDecorationLine: 'underline' }}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AppleIcon({ color = '#000' }: { color?: string }) {
  return (
    <Svg width={16} height={20} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 76, paddingBottom: 32, paddingHorizontal: 32 },
  card: { paddingHorizontal: 24 },
  banner: { borderRadius: 10, padding: 12, marginBottom: 14 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15 },
  inputWrap: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  inputLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 10, letterSpacing: 1 },
});
