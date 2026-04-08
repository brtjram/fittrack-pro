import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { User, LogOut, Check, Save } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import type { ActivityLevel, Goal, ExperienceLevel, WorkoutSplit } from '@fittrack/core';

const goalOptions: { value: Goal; label: string; desc: string }[] = [
  { value: 'fat_loss', label: 'Fat Loss', desc: 'Maximize fat loss, preserve muscle' },
  { value: 'muscle_gain', label: 'Muscle Gain', desc: 'Build muscle with lean surplus' },
  { value: 'recomp', label: 'Recomposition', desc: 'Lose fat and gain muscle simultaneously' },
  { value: 'maintain', label: 'Maintain', desc: 'Maintain current weight and performance' },
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
};

export function SettingsScreen() {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
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
  });

  useEffect(() => {
    api.getUserProfile().then((profile) => {
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
        };
        setForm(loaded);
        savedFormRef.current = JSON.stringify(loaded);
        setSaved(true);
      }
      setLoading(false);
    });
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
                      form.gender === g && { backgroundColor: colors.primary + '15' },
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
          <View style={styles.optionsGrid}>
            {goalOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionBtn,
                  { borderColor: form.goal === opt.value ? colors.primary : colors.border },
                  form.goal === opt.value && { backgroundColor: colors.primary + '15' },
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
                form.activityLevel === opt.value && { backgroundColor: colors.primary + '15' },
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
                  form.experienceLevel === opt.value && { backgroundColor: colors.primary + '15' },
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

        {/* Workout Split */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preferred Split</Text>
          <View style={styles.optionsGrid}>
            {splitOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionBtn,
                  { borderColor: form.preferredSplit === opt.value ? colors.primary : colors.border },
                  form.preferredSplit === opt.value && { backgroundColor: colors.primary + '15' },
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
  content: { padding: 16, gap: 16 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  section: { borderWidth: 1, borderRadius: 12, padding: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '500', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { borderWidth: 1, borderRadius: 8, padding: 10, flexBasis: '47%', flexGrow: 1 },
  listOption: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
});
