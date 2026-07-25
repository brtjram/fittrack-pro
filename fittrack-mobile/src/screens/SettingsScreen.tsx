import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Linking, StyleSheet,
} from 'react-native';
import { User, LogOut, Check, Save, Shield, FileText, Info, ExternalLink, Bell, ChevronRight, Flame, Sun, Moon, Monitor, Footprints } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useTheme, ThemeMode } from '../theme/useTheme';
import { useAuth } from '../hooks/useAuth';
import { HealthKitSync } from '../components/HealthKitSync';
import * as api from '../services/api';
import { computeStepTarget, stepTargetRationale } from '../utils/step-target';
import { cardElevation } from '../theme/elevation';
import type { ActivityLevel, Goal, ExperienceLevel, WorkoutSplit } from '@fittrack/core';

const SUPPORT_URL_BASE = 'https://myfittrack.pro';

const goalOptions: { value: Goal; label: string; desc: string }[] = [
  { value: 'fat_loss', label: 'Fat Loss', desc: 'Maximize fat loss, preserve muscle' },
  { value: 'muscle_gain', label: 'Muscle Gain', desc: 'Build muscle with lean surplus' },
  { value: 'recomp', label: 'Recomposition', desc: 'Lose fat and gain muscle simultaneously' },
  { value: 'maintain', label: 'Maintain', desc: 'Maintain current weight and performance' },
  { value: 'ai_coach', label: 'AI Coach Mode', desc: 'Describe your goal — the coach sets nutrition & workouts' },
];

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const activityOptions: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, minimal movement' },
  { value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Intense exercise + physical job' },
];

const experienceOptions: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'Less than 1 year' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years consistent' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years serious' },
];

const splitOptions: { value: WorkoutSplit; label: string; desc: string }[] = [
  { value: 'ppl', label: 'Push/Pull/Legs', desc: '6 days/week' },
  { value: 'upper_lower', label: 'Upper/Lower', desc: '4 days/week' },
  { value: 'full_body', label: 'Full Body', desc: '3 days/week' },
  { value: 'bro_split', label: 'Body Part Split', desc: '5 days/week' },
];

type FormState = {
  name: string;
  age: number;
  gender: 'male' | 'female';
  heightCm: number;
  currentWeightLbs: number;
  targetWeightLbs: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  experienceLevel: ExperienceLevel;
  preferredSplit: WorkoutSplit;
  trackCycle: boolean;
  cycleLength: number;
  lastPeriodDate: string;
  aiCoachGoal: string;
};

export function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const { logout } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [currentStepTarget, setCurrentStepTarget] = useState<number | null>(null);
  const savedFormRef = useRef<string>('');
  const [form, setForm] = useState<FormState>({
    name: '',
    age: 25,
    gender: 'male',
    heightCm: 175,
    currentWeightLbs: 175,
    targetWeightLbs: 165,
    activityLevel: 'moderate',
    goal: 'fat_loss',
    experienceLevel: 'intermediate',
    preferredSplit: 'ppl',
    trackCycle: false,
    cycleLength: 28,
    lastPeriodDate: '',
    aiCoachGoal: '',
  });

  useEffect(() => {
    api.getUserProfile()
      .then((profile) => {
        if (profile) {
          const loaded: FormState = {
            name: profile.name,
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            currentWeightLbs: profile.currentWeightLbs,
            targetWeightLbs: profile.targetWeightLbs,
            activityLevel: profile.activityLevel,
            goal: profile.goal,
            experienceLevel: profile.experienceLevel,
            preferredSplit: profile.preferredSplit,
            trackCycle: profile.trackCycle ?? false,
            cycleLength: profile.cycleLength ?? 28,
            lastPeriodDate: profile.lastPeriodDate ?? '',
            aiCoachGoal: profile.aiCoachGoal ?? '',
          };
          setForm(loaded);
          savedFormRef.current = JSON.stringify(loaded);
          setSaved(true);
          setCurrentStepTarget(profile.stepTarget ?? null);
        }
      })
      .catch(() => { /* network error — show empty form */ })
      .finally(() => setLoading(false));
  }, []);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const isDirty = JSON.stringify(next) !== savedFormRef.current;
      setDirty(isDirty);
      if (isDirty) setSaved(false);
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = await api.getUserProfile();
      await api.saveUserProfile({ ...form, id: existing?.id });
      savedFormRef.current = JSON.stringify(form);
      setSaved(true);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const buttonState = saved && !dirty ? 'saved' : saving ? 'saving' : 'save';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Page header */}
      <View style={[styles.pageHeader, { backgroundColor: colors.background }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Profile</Text>
      </View>
      <View style={styles.content}>
        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: buttonState === 'saved' ? colors.success + '20' : colors.primary },
          ]}
          onPress={handleSave}
          disabled={saving || (saved && !dirty)}
          activeOpacity={0.8}
        >
          {buttonState === 'saved' ? <Check size={16} color={colors.success} /> : <Save size={16} color={colors.primaryForeground} />}
          <Text style={{ fontSize: 14, fontWeight: '600', color: buttonState === 'saved' ? colors.success : colors.primaryForeground, marginLeft: 6 }}>
            {buttonState === 'saved' ? 'Saved' : buttonState === 'saving' ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>

        {/* Profile */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <User size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profile</Text>
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Age</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={String(form.age)}
                onChangeText={(v) => updateField('age', parseInt(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Gender</Text>
              <View style={styles.row}>
                {(['male', 'female'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderBtn,
                      { borderColor: form.gender === g ? colors.primary : colors.border },
                      form.gender === g && { backgroundColor: colors.muted },
                    ]}
                    onPress={() => updateField('gender', g)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: form.gender === g ? colors.primary : colors.mutedForeground }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.row, { gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Height (cm)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={String(form.heightCm)}
                onChangeText={(v) => updateField('heightCm', parseInt(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={String(form.currentWeightLbs)}
                onChangeText={(v) => updateField('currentWeightLbs', parseInt(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Target (lbs)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={String(form.targetWeightLbs)}
                onChangeText={(v) => updateField('targetWeightLbs', parseInt(v) || 0)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Goal */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Goal</Text>
          {form.goal === 'challenge' ? (
            <TouchableOpacity
              style={[styles.challengeBanner, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}
              onPress={() => navigation.navigate('TransformationChallenge')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Flame size={16} color="#ef4444" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#ef4444' }}>
                  12-Week Transformation Challenge active
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>
                Your nutrition, step target, and weekly workouts are set automatically by the challenge&apos;s
                current phase. Tap to manage the challenge.
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.optionsGrid}>
              {goalOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionBtn,
                    { borderColor: form.goal === opt.value ? colors.primary : colors.border },
                    form.goal === opt.value && { backgroundColor: colors.muted },
                  ]}
                  onPress={() => updateField('goal', opt.value)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: form.goal === opt.value ? colors.primary : colors.foreground }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {form.goal === 'ai_coach' && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Tell the coach what you&apos;re training for
              </Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.aiCoachGoal}
                onChangeText={(v) => updateField('aiCoachGoal', v)}
                placeholder='e.g. "Train for a marathon in 16 weeks while keeping the muscle I&apos;ve built"'
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6, lineHeight: 16 }}>
                Save this, then open the Coach chat and ask it to build your plan — it will set your daily
                nutrition, training split, step goal, and weekly workouts from this goal, and keep adjusting
                them as you go.
              </Text>
            </View>
          )}
        </View>

        {/* Activity Level */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Activity Level</Text>
          {activityOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.listOption,
                { borderColor: form.activityLevel === opt.value ? colors.primary : colors.border },
                form.activityLevel === opt.value && { backgroundColor: colors.muted },
              ]}
              onPress={() => updateField('activityLevel', opt.value)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: form.activityLevel === opt.value ? colors.primary : colors.foreground }}>
                {opt.label}
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{opt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Experience */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Experience Level</Text>
          <View style={styles.optionsRow}>
            {experienceOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionBtn, { flex: 1 },
                  { borderColor: form.experienceLevel === opt.value ? colors.primary : colors.border },
                  form.experienceLevel === opt.value && { backgroundColor: colors.muted },
                ]}
                onPress={() => updateField('experienceLevel', opt.value)}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: form.experienceLevel === opt.value ? colors.primary : colors.foreground }}>
                  {opt.label}
                </Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Workout Split — AI Coach Mode / the Transformation Challenge decide this themselves */}
        {form.goal !== 'ai_coach' && form.goal !== 'challenge' && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preferred Split</Text>
            <View style={styles.optionsGrid}>
              {splitOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionBtn,
                    { borderColor: form.preferredSplit === opt.value ? colors.primary : colors.border },
                    form.preferredSplit === opt.value && { backgroundColor: colors.muted },
                  ]}
                  onPress={() => updateField('preferredSplit', opt.value)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: form.preferredSplit === opt.value ? colors.primary : colors.foreground }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step Target — auto-computed from goal + activity; AI Coach Mode / the Transformation Challenge set their own instead */}
        {form.goal !== 'ai_coach' && form.goal !== 'challenge' && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Footprints size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Daily Step Goal</Text>
            </View>
            <View style={[styles.stepGoalRow, { backgroundColor: colors.primary + '0D' }]}>
              <Text style={[styles.stepGoalValue, { color: colors.primary }]}>
                {computeStepTarget(form.activityLevel, form.goal).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>steps / day</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
              <Info size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, lineHeight: 16 }}>
                {stepTargetRationale(form.activityLevel, form.goal)}. Updates automatically when you change your goal or activity level.
              </Text>
            </View>
          </View>
        )}

        {/* AI Coach Mode / the Transformation Challenge own the step target — show it read-only instead */}
        {(form.goal === 'ai_coach' || form.goal === 'challenge') && currentStepTarget !== null && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Footprints size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Daily Step Goal</Text>
            </View>
            <View style={[styles.stepGoalRow, { backgroundColor: colors.primary + '0D' }]}>
              <Text style={[styles.stepGoalValue, { color: colors.primary }]}>
                {currentStepTarget.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>steps / day</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
              <Info size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, lineHeight: 16 }}>
                {form.goal === 'challenge'
                  ? 'Set by the current Transformation Challenge phase. Updates automatically as you advance weeks.'
                  : 'Set by your AI coach. Ask it to adjust this in chat if it needs to change.'}
              </Text>
            </View>
          </View>
        )}

        {/* Menstrual Cycle Tracking — only shown for female gender */}
        {form.gender === 'female' && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Cycle Tracking</Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                  Personalizes workout intensity by cycle phase
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => updateField('trackCycle', !form.trackCycle)}
                style={[styles.toggle, { backgroundColor: form.trackCycle ? colors.primary : colors.muted }]}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, form.trackCycle && { transform: [{ translateX: 20 }] }]} />
              </TouchableOpacity>
            </View>
            {form.trackCycle && (
              <View style={[styles.row, { marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 0 }]}>Cycle Length (days)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={String(form.cycleLength)}
                    onChangeText={(v) => updateField('cycleLength', parseInt(v) || 28)}
                    keyboardType="numeric"
                    placeholder="28"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 0 }]}>Last Period Start</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={form.lastPeriodDate}
                    onChangeText={(v) => updateField('lastPeriodDate', v)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Theme */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Theme</Text>
          <View style={styles.optionsRow}>
            {themeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.themeBtn,
                  { borderColor: themeMode === opt.value ? colors.primary : colors.border },
                  themeMode === opt.value && { backgroundColor: colors.muted },
                ]}
                onPress={() => setThemeMode(opt.value)}
              >
                <opt.icon size={18} color={themeMode === opt.value ? colors.primary : colors.mutedForeground} />
                <Text style={{ fontSize: 12, fontWeight: '600', marginTop: 6, color: themeMode === opt.value ? colors.primary : colors.foreground }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Transformation Challenge — hidden once active since the Goal section above already links to it */}
        {form.goal !== 'challenge' && (
          <TouchableOpacity
            style={[styles.section, { backgroundColor: '#ef444410', borderColor: '#ef444430', flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => navigation.navigate('TransformationChallenge')}
            activeOpacity={0.7}
          >
            <Flame size={18} color="#ef4444" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>12-Week Transformation</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Maximum fat loss challenge — steps, food & training</Text>
            </View>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Notification Preferences */}
        <TouchableOpacity
          style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}
          onPress={() => navigation.navigate('NotificationSettings')}
          activeOpacity={0.7}
        >
          <Bell size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>Notifications</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Workout, meal, and weigh-in reminders</Text>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Apple Health Integration */}
        <HealthKitSync />

        {/* Legal & Support */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Legal & Support</Text>
          <TouchableOpacity
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL(`${SUPPORT_URL_BASE}/privacy`)}
            activeOpacity={0.6}
          >
            <Shield size={16} color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.foreground, flex: 1, marginLeft: 10 }}>Privacy Policy</Text>
            <ExternalLink size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL(`${SUPPORT_URL_BASE}/terms`)}
            activeOpacity={0.6}
          >
            <FileText size={16} color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.foreground, flex: 1, marginLeft: 10 }}>Terms of Service</Text>
            <ExternalLink size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('mailto:support@fittrackpro.app')}
            activeOpacity={0.6}
          >
            <Info size={16} color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.foreground, flex: 1, marginLeft: 10 }}>Contact Support</Text>
            <ExternalLink size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>FitTrack Pro</Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
            Version {Constants.expoConfig?.version ?? '1.0.0'} (Build {Constants.expoConfig?.ios?.buildNumber ?? '1'})
          </Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.destructive + '30', backgroundColor: colors.destructive + '08' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={16} color={colors.destructive} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.destructive, marginLeft: 8 }}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  content: { padding: 16, gap: 16 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, ...cardElevation },
  challengeBanner: { borderWidth: 1, borderRadius: 10, padding: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  textarea: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  stepGoalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 },
  stepGoalValue: { fontSize: 22, fontWeight: '800' },
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  themeBtn: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 4, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { borderWidth: 1, borderRadius: 10, padding: 10, flexBasis: '47%', flexGrow: 1 },
  listOption: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 15 },
});
