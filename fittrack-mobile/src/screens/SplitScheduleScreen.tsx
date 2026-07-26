import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SegmentedControl, AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import type { UserProfile, WorkoutSplit } from '@fittrack/core';
import { getWorkoutPlan, getExerciseById } from '@fittrack/core';

const SPLIT_OPTIONS: { value: WorkoutSplit; label: string; desc: string }[] = [
  { value: 'ppl', label: 'Push / Pull / Legs', desc: 'each muscle ~1.7x a week' },
  { value: 'upper_lower', label: 'Upper / Lower', desc: 'easiest to keep when work bites' },
  { value: 'full_body', label: 'Full body', desc: 'longest sessions' },
  { value: 'bro_split', label: 'Body Part Split', desc: 'one muscle group per day' },
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon-indexed 1..7
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SESSION_LENGTHS = [45, 60, 90];

function parseDays(s: string): Set<number> {
  return new Set(s.split(',').map(Number).filter((n) => n >= 1 && n <= 7));
}

export function SplitScheduleScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.getUserProfile().then((p) => {
      setProfile(p ?? null);
      setLoading(false);
    });
  }, []);

  const commit = useCallback(async (patch: Partial<UserProfile>) => {
    if (!profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    setApplied(false);
    try {
      await api.saveUserProfile({ ...next, id: profile.id });
      setApplied(true);
    } catch {
      setProfile(profile);
    }
  }, [profile]);

  const selectedDays = useMemo(() => parseDays(profile?.trainingDays ?? '1,2,4,5,6'), [profile?.trainingDays]);

  const toggleDay = (day: number) => {
    const next = new Set(selectedDays);
    if (next.has(day)) next.delete(day); else next.add(day);
    commit({ trainingDays: [...next].sort().join(',') });
  };

  const weekPreview = useMemo(() => {
    if (!profile) return [];
    const plan = getWorkoutPlan(profile.preferredSplit);
    if (!plan) return [];
    let templateIdx = 0;
    return DAY_NAMES.map((name, i) => {
      const dayNum = i + 1;
      if (!selectedDays.has(dayNum)) return { day: name, rest: true };
      const template = plan.templates[templateIdx % plan.templates.length];
      templateIdx += 1;
      const exerciseNames = template.exercises.slice(0, 3).map((e) => getExerciseById(e.exerciseId)?.name ?? e.exerciseId);
      return { day: name, rest: false, name: template.name, exercises: exerciseNames.join(' · ') };
    });
  }, [profile, selectedDays]);

  if (loading || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const plan = getWorkoutPlan(profile.preferredSplit);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Split & schedule</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 22, lineHeight: 27, color: colors.ink }}>
          {plan ? `${plan.daysPerWeek} days, ${SPLIT_OPTIONS.find((o) => o.value === profile.preferredSplit)?.label.toLowerCase()}` : 'Pick a split'}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {SPLIT_OPTIONS.map((opt, i) => {
            const selected = profile.preferredSplit === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => commit({ preferredSplit: opt.value })}
                style={[styles.splitRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }, selected && { backgroundColor: 'rgba(201,232,74,.07)' }]}
              >
                <View style={[styles.radio, { borderColor: selected ? colors.progress : colors.faint, backgroundColor: selected ? colors.progress : 'transparent' }]}>
                  {selected && <Check size={12} color={colors.canvas} strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{opt.label}</Text>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                    {getWorkoutPlan(opt.value)?.daysPerWeek} days · {opt.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>Training days</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, padding: 16 }]}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAY_LABELS.map((label, i) => {
              const dayNum = i + 1;
              const active = selectedDays.has(dayNum);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleDay(dayNum)}
                  style={[styles.dayChip, { backgroundColor: active ? colors.ink : colors.surfaceInset }]}
                >
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: active ? colors.canvas : colors.mutedForeground }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 16, paddingTop: 15 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>Session length</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Trims accessories, never main lifts</Text>
            </View>
            <SegmentedControl
              colors={colors}
              value={profile.sessionLengthMin ?? 60}
              onChange={(v) => commit({ sessionLengthMin: v })}
              options={SESSION_LENGTHS.map((m) => ({ value: m, label: `${m}m` }))}
            />
          </View>
        </View>

        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>Your week</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {weekPreview.map((d, i) => (
            <View key={d.day + i} style={[styles.weekRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
              <Text style={{ width: 34, fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: d.rest ? colors.faint : colors.mutedForeground }}>{d.day}</Text>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: d.rest ? colors.mutedForeground : colors.ink }}>
                  {d.rest ? 'Rest' : d.name}
                </Text>
                {!d.rest && (
                  <Text numberOfLines={1} style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 2 }}>
                    {d.exercises}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, overflow: 'hidden' },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayChip: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 11 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  appliedRow: { height: 20, justifyContent: 'center' },
});
