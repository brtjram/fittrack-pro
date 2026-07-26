import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, Sparkline } from '../components/ui';
import * as api from '../services/api';
import type { WorkoutSession, WorkoutSet } from '@fittrack/core';

function estimatedOneRM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

interface SessionRow {
  date: string;
  topSet: WorkoutSet;
  oneRM: number;
  rpeWord: string;
}

export function StrengthDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { exerciseId, exerciseName } = route.params as { exerciseId: string; exerciseName: string };
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxWeightSingle, setMaxWeightSingle] = useState(0);
  const [bestVolumeSet, setBestVolumeSet] = useState<{ weight: number; reps: number } | null>(null);
  const [bestSessionVolume, setBestSessionVolume] = useState(0);

  useEffect(() => {
    api.getRecentWorkouts(120).then((workouts: WorkoutSession[]) => {
      const relevant = workouts
        .filter((w) => w.completed && w.exercises.some((e) => e.exerciseId === exerciseId))
        .sort((a, b) => b.date.localeCompare(a.date));

      let maxW = 0;
      let bestSet: { weight: number; reps: number; volume: number } | null = null;
      let bestVol = 0;
      const built: SessionRow[] = [];

      for (const w of relevant) {
        const ex = w.exercises.find((e) => e.exerciseId === exerciseId)!;
        const sessionVolume = ex.sets.reduce((a, s) => a + (s.actualWeight ?? s.targetWeight) * (s.actualReps ?? s.targetReps), 0);
        bestVol = Math.max(bestVol, sessionVolume);

        const top = ex.sets.reduce((best, s) => {
          const rm = estimatedOneRM(s.actualWeight ?? s.targetWeight, s.actualReps ?? s.targetReps);
          return rm > estimatedOneRM(best.actualWeight ?? best.targetWeight, best.actualReps ?? best.targetReps) ? s : best;
        }, ex.sets[0]);

        for (const s of ex.sets) {
          const weight = s.actualWeight ?? s.targetWeight;
          const reps = s.actualReps ?? s.targetReps;
          maxW = Math.max(maxW, weight);
          const volume = weight * reps;
          if (!bestSet || volume > bestSet.volume) bestSet = { weight, reps, volume };
        }

        const rpeWord = w.rating == null ? '—' : w.rating <= 4 ? 'easy' : w.rating <= 7 ? 'hard' : 'max';
        built.push({ date: w.date, topSet: top, oneRM: Math.round(estimatedOneRM(top.actualWeight ?? top.targetWeight, top.actualReps ?? top.targetReps)), rpeWord });
      }

      setRows(built);
      setMaxWeightSingle(maxW);
      setBestVolumeSet(bestSet ? { weight: bestSet.weight, reps: bestSet.reps } : null);
      setBestSessionVolume(Math.round(bestVol));
      setLoading(false);
    });
  }, [exerciseId]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const currentOneRM = rows[0]?.oneRM ?? 0;
  const oldestOneRM = rows[rows.length - 1]?.oneRM ?? currentOneRM;
  const delta = currentOneRM - oldestOneRM;
  const chartValues = [...rows].reverse().map((r) => r.oneRM);

  const recent = rows.slice(0, 3);
  const sameWeight = recent.length >= 3 && recent.every((r) => (r.topSet.actualWeight ?? r.topSet.targetWeight) === (recent[0].topSet.actualWeight ?? recent[0].topSet.targetWeight));
  const allHitTarget = recent.every((r) => (r.topSet.actualReps ?? r.topSet.targetReps) >= r.topSet.targetReps);
  const recentWeight = recent[0] ? (recent[0].topSet.actualWeight ?? recent[0].topSet.targetWeight) : 0;
  const recentReps = recent[0] ? (recent[0].topSet.actualReps ?? recent[0].topSet.targetReps) : 0;

  let recommendation = 'Log a few more sessions to get a next-session recommendation.';
  let nextSession = '—';
  if (recent.length >= 3) {
    if (sameWeight && allHitTarget) {
      recommendation = `Three sessions at ${recentWeight} × ${recentReps} — you're ready for more.`;
      nextSession = `${recentWeight + 5} lb × ${Math.max(4, recentReps - 2)}, then a back-off set`;
    } else {
      recommendation = `Recent sets at ${recentWeight} lb — keep building consistency before adding weight.`;
      nextSession = `${recentWeight} lb × ${recentReps}, match or beat last time`;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>{exerciseName}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <SectionLabel colors={colors}>Estimated 1 rep max</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 42, letterSpacing: -0.6, color: colors.ink }}>{currentOneRM}</Text>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: colors.mutedForeground }}>lb</Text>
            {delta !== 0 && (
              <View style={[styles.deltaPill, { backgroundColor: delta > 0 ? 'rgba(201,232,74,0.14)' : 'rgba(228,87,76,0.14)', marginLeft: 'auto' }]}>
                <TrendingUp size={13} color={delta > 0 ? colors.progress : colors.danger} strokeWidth={2.4} />
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: delta > 0 ? colors.progress : colors.danger }}>
                  {delta > 0 ? '+' : ''}{delta} recorded
                </Text>
              </View>
            )}
          </View>
        </View>

        {chartValues.length >= 2 && (
          <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, marginTop: 20 }]}>
            <Sparkline values={chartValues} width={296} height={118} color={colors.progress} dotColor={colors.faint} />
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, marginTop: 16 }]}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 17, lineHeight: 23, color: colors.ink }}>{recommendation}</Text>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 15, paddingTop: 15 }}>
            <SectionLabel colors={colors} style={{ fontSize: 10.5 }}>Next session</SectionLabel>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 16, color: colors.signal, marginTop: 5 }}>{nextSession}</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <SectionLabel colors={colors}>Personal records</SectionLabel>
        </View>
        <View style={styles.prGrid}>
          <PrTile colors={colors} value={String(maxWeightSingle)} label="1 rep max" />
          <PrTile colors={colors} value={bestVolumeSet ? String(bestVolumeSet.weight) : '—'} label={bestVolumeSet ? `${bestVolumeSet.reps} reps` : ''} highlight />
          <PrTile colors={colors} value={bestSessionVolume.toLocaleString()} label="best volume" />
        </View>

        <View style={styles.sectionHeaderRow}>
          <SectionLabel colors={colors}>Every session</SectionLabel>
        </View>
        {rows.length === 0 ? (
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, color: colors.mutedForeground, paddingHorizontal: 20 }}>No sessions logged yet for this exercise.</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, padding: 0 }]}>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.hairline }]}>
              <Text style={[styles.th, { color: colors.mutedForeground, width: 56 }]}>Date</Text>
              <Text style={[styles.th, { color: colors.mutedForeground, flex: 1 }]}>Top set</Text>
              <Text style={[styles.th, { color: colors.mutedForeground, width: 52, textAlign: 'right' }]}>1RM</Text>
              <Text style={[styles.th, { color: colors.mutedForeground, width: 46, textAlign: 'right' }]}>RPE</Text>
            </View>
            {rows.map((r, i) => (
              <View key={i} style={[styles.tableRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, width: 56 }}>
                  {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink, flex: 1 }}>
                  {r.topSet.actualWeight ?? r.topSet.targetWeight} × {r.topSet.actualReps ?? r.topSet.targetReps}
                </Text>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink, width: 52, textAlign: 'right' }}>{r.oneRM}</Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.signal, width: 46, textAlign: 'right' }}>{r.rpeWord}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PrTile({ colors, value, label, highlight }: { colors: any; value: string; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.prTile, { backgroundColor: colors.surface }]}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 20, letterSpacing: -0.3, color: highlight ? colors.progress : colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 10, color: colors.mutedForeground, marginTop: 3 }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, padding: 19 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  sectionHeaderRow: { paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
  prGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  prTile: { flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  tableHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 1 },
  th: { fontFamily: Fonts.sansMedium, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13 },
});
