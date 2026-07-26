import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trophy, Check } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, PillButton } from '../components/ui';
import * as api from '../services/api';
import type { WorkoutSession } from '@fittrack/core';

type Effort = 'easy' | 'hard' | 'max';
const EFFORT_OPTIONS: { id: Effort; label: string; rating: number; color: string }[] = [
  { id: 'easy', label: 'Easy — I had plenty left', rating: 3, color: '#6C9FD4' },
  { id: 'hard', label: 'Hard but I finished strong', rating: 7, color: '#F59148' },
  { id: 'max', label: 'All I had — form was going', rating: 10, color: '#E4574C' },
];

function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce((a, e) => a + e.sets.reduce((b, set) => b + (set.actualWeight ?? set.targetWeight) * (set.actualReps ?? set.targetReps), 0), 0);
}

export function WorkoutSummaryScreen({ route, navigation }: { route: any; navigation: any }) {
  const { sessionId } = route.params as { sessionId: string };
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [prevVolume, setPrevVolume] = useState<number | null>(null);
  const [newPRs, setNewPRs] = useState<{ exerciseName: string; weight: number; reps: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [effort, setEffort] = useState<Effort | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getWorkoutById(sessionId);
        if (!s) return;
        setSession(s);

        const recent = await api.getRecentWorkouts(30);
        const prior = recent.find((w) => w.sessionId !== sessionId && w.completed && w.splitDay === s.splitDay);
        if (prior) setPrevVolume(sessionVolume(prior));

        const prs: { exerciseName: string; weight: number; reps: number }[] = [];
        for (const ex of s.exercises) {
          const bestSet = ex.sets.reduce((best, set) => {
            const w = set.actualWeight ?? set.targetWeight;
            return w > (best?.actualWeight ?? best?.targetWeight ?? 0) ? set : best;
          }, ex.sets[0]);
          if (!bestSet) continue;
          const weight = bestSet.actualWeight ?? bestSet.targetWeight;
          const reps = bestSet.actualReps ?? bestSet.targetReps;
          const records = await api.getPersonalRecords(ex.exerciseId);
          const bestPrior = records.reduce((max, r) => Math.max(max, r.weight), 0);
          if (weight > bestPrior) {
            prs.push({ exerciseName: ex.exerciseName, weight, reps });
            await api.savePersonalRecord({ exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, weight, reps, date: s.date, sessionId: s.sessionId });
          }
        }
        setNewPRs(prs);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const saveSession = useCallback(async () => {
    if (!session) return;
    setSaving(true);
    try {
      const rating = effort ? EFFORT_OPTIONS.find((o) => o.id === effort)?.rating : undefined;
      await api.saveWorkout({ ...session, rating });
      navigation.navigate('WorkoutsList');
    } finally {
      setSaving(false);
    }
  }, [session, effort, navigation]);

  if (loading || !session) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const volume = sessionVolume(session);
  const volumeChangePct = prevVolume ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const headline = newPRs.length > 0
    ? `You've never lifted this heavy on ${newPRs[0].exerciseName}.`
    : 'Session logged — every set counts toward the trend.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 26 }}>
          {newPRs.length > 0 && (
            <View style={[styles.prPill, { backgroundColor: 'rgba(201,232,74,0.14)' }]}>
              <Trophy size={13} color={colors.progress} strokeWidth={2.4} />
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 10, letterSpacing: 1, color: colors.progress }}>NEW PR</Text>
            </View>
          )}
          <Text style={{ fontFamily: Fonts.serif, fontSize: 32, lineHeight: 38, color: colors.ink, marginTop: 14 }}>{headline}</Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, color: colors.mutedStrong, marginTop: 12 }}>
            {session.name}, done in {session.duration ?? 0} minutes.
          </Text>
        </View>

        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <SectionLabel colors={colors}>Volume vs last time</SectionLabel>
            {volumeChangePct !== null && (
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: volumeChangePct >= 0 ? colors.progress : colors.signal }}>
                {volumeChangePct >= 0 ? '+' : ''}{volumeChangePct}%
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 16 }}>
            <Stat colors={colors} value={volume.toLocaleString()} label="lb moved" highlight />
            <Stat colors={colors} value={String(totalSets)} label="sets" />
            <Stat colors={colors} value={String(session.duration ?? 0)} label="minutes" />
            <Stat colors={colors} value={String(newPRs.length)} label="PR" highlight={newPRs.length > 0} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <SectionLabel colors={colors}>How hard was that?</SectionLabel>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 6, marginBottom: 14 }}>
            Sets your next session's intensity.
          </Text>
          <View style={{ gap: 8 }}>
            {EFFORT_OPTIONS.map((opt) => {
              const selected = effort === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setEffort(opt.id)}
                  style={[
                    styles.effortRow,
                    { backgroundColor: selected ? colors.surfaceInset : colors.surface },
                    selected && { borderWidth: 1.5, borderColor: colors.signal },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.effortDot, { backgroundColor: opt.color }]} />
                  <Text style={{ flex: 1, fontFamily: selected ? Fonts.sansSemiBold : Fonts.sansMedium, fontSize: 13.5, color: selected ? colors.ink : colors.mutedStrong }}>
                    {opt.label}
                  </Text>
                  {selected && <Check size={17} color={colors.signal} strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairline }]}>
        <PillButton label={saving ? 'Saving…' : 'Save session'} colors={colors} onPress={saveSession} disabled={saving} />
      </View>
    </View>
  );
}

function Stat({ colors, value, label, highlight }: { colors: any; value: string; label: string; highlight?: boolean }) {
  return (
    <View>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 20, letterSpacing: -0.3, color: highlight ? colors.progress : colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  prPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  statsCard: { marginHorizontal: 16, marginTop: 28, borderRadius: 18, padding: 20 },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, padding: 15 },
  effortDot: { width: 7, height: 7, borderRadius: 4 },
  footer: { padding: 16, paddingBottom: 30, borderTopWidth: 1 },
});
