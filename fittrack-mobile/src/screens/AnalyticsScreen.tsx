import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Footprints } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, Sparkline } from '../components/ui';
import * as api from '../services/api';
import type { WeightEntry, DailyActivity, WorkoutSession, UserProfile } from '@fittrack/core';

type TabId = 'body' | 'strength' | 'habits';

const SPLIT_DAYS_PER_WEEK: Record<string, number> = { ppl: 6, upper_lower: 4, full_body: 3, bro_split: 5 };

function estimatedOneRM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

interface LiftTrend {
  exerciseId: string;
  exerciseName: string;
  points: number[];
  current: number;
  deltaVsEarliest: number;
  sessionCount: number;
}

function buildLiftTrends(workouts: WorkoutSession[]): LiftTrend[] {
  const byExercise = new Map<string, { name: string; points: { date: string; oneRM: number }[] }>();
  const sorted = [...workouts].filter((w) => w.completed).sort((a, b) => a.date.localeCompare(b.date));
  for (const w of sorted) {
    for (const ex of w.exercises) {
      const best = ex.sets.reduce((max, s) => {
        const rm = estimatedOneRM(s.actualWeight ?? s.targetWeight, s.actualReps ?? s.targetReps);
        return rm > max ? rm : max;
      }, 0);
      if (best <= 0) continue;
      const entry = byExercise.get(ex.exerciseId) ?? { name: ex.exerciseName, points: [] };
      entry.points.push({ date: w.date, oneRM: best });
      byExercise.set(ex.exerciseId, entry);
    }
  }
  const trends: LiftTrend[] = [];
  for (const [exerciseId, { name, points }] of byExercise) {
    if (points.length < 1) continue;
    const values = points.map((p) => p.oneRM);
    trends.push({
      exerciseId,
      exerciseName: name,
      points: values,
      current: Math.round(values[values.length - 1]),
      deltaVsEarliest: Math.round(values[values.length - 1] - values[0]),
      sessionCount: values.length,
    });
  }
  return trends.sort((a, b) => b.sessionCount - a.sessionCount);
}

export function AnalyticsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>('body');
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [profile, setProfile] = useState<UserProfile | undefined>();

  const loadData = useCallback(async () => {
    try {
      const [w, a, s, p] = await Promise.all([
        api.getWeightEntries(90),
        api.getDailyActivities(60),
        api.getRecentWorkouts(60),
        api.getUserProfile(),
      ]);
      setWeights(w);
      setWorkouts(s);
      setActivities(a);
      setProfile(p);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weightLbs : null;
  const weeklyRate = sortedWeights.length >= 2
    ? sortedWeights[sortedWeights.length - 1].weightLbs - sortedWeights[Math.max(0, sortedWeights.length - 8)].weightLbs
    : 0;

  const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  const recentCompleted = workouts.filter((w) => w.completed && new Date(w.date) >= sixWeeksAgo);
  const daysPerWeek = profile ? (SPLIT_DAYS_PER_WEEK[profile.preferredSplit] ?? 4) : 4;
  const sessionsPlanned = daysPerWeek * 6;
  const daysLoggedSet = new Set([
    ...activities.filter((a) => new Date(a.date) >= sixWeeksAgo).map((a) => a.date),
    ...weights.filter((w) => new Date(w.date) >= sixWeeksAgo).map((w) => w.date),
  ]);

  let projectionText: string | null = null;
  if (profile && latestWeight !== null && weeklyRate !== 0) {
    const remaining = latestWeight - profile.targetWeightLbs;
    const movingTowardGoal = (remaining > 0 && weeklyRate < 0) || (remaining < 0 && weeklyRate > 0);
    if (movingTowardGoal) {
      const weeksToGoal = Math.abs(remaining / weeklyRate);
      const projected = new Date(Date.now() + weeksToGoal * 7 * 24 * 60 * 60 * 1000);
      projectionText = `On this rate you'll hit ${profile.targetWeightLbs} lb in the week of ${projected.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`;
    }
  }

  const liftTrends = buildLiftTrends(workouts);
  const mainLifts = liftTrends.slice(0, 3);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 28, color: colors.ink }}>Progress</Text>
        <View style={[styles.tabRow, { backgroundColor: colors.surface }]}>
          {(['body', 'strength', 'habits'] as TabId[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { backgroundColor: colors.surfaceInset }]}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 10.5, color: tab === t ? colors.ink : colors.mutedForeground }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'body' && (
        <View style={{ paddingBottom: 24 }}>
          {latestWeight !== null ? (
            <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, marginTop: 22 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <SectionLabel colors={colors}>Weight trend</SectionLabel>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 34, letterSpacing: -0.4, color: colors.ink }}>{latestWeight}</Text>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginLeft: 8 }}>lb</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.trendBadge, { backgroundColor: weeklyRate <= 0 ? 'rgba(201,232,74,0.14)' : 'rgba(245,145,72,0.14)' }]}>
                    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: weeklyRate <= 0 ? colors.progress : colors.signal }}>
                      {weeklyRate === 0 ? 'steady' : `${weeklyRate.toFixed(1)} lb/wk`}
                    </Text>
                  </View>
                </View>
              </View>
              {sortedWeights.length >= 2 && (
                <View style={{ marginTop: 12 }}>
                  <Sparkline values={sortedWeights.map((w) => w.weightLbs)} width={296} height={104} color={colors.progress} dotColor={colors.faint} />
                </View>
              )}
            </View>
          ) : (
            <EmptyState colors={colors} text="Log a weigh-in to start your trend." />
          )}

          {projectionText && (
            <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, marginTop: 16 }]}>
              <Text style={{ fontFamily: Fonts.serif, fontSize: 17, lineHeight: 23, color: colors.ink }}>{projectionText}</Text>
            </View>
          )}

          <View style={styles.tileRow}>
            <Tile colors={colors} label="Sessions" value={recentCompleted.length} suffix={`/ ${sessionsPlanned} planned`} sub="6 weeks" />
            <Tile colors={colors} label="Days logged" value={daysLoggedSet.size} suffix="/ 42" sub={`${Math.round((daysLoggedSet.size / 42) * 100)}%`} />
          </View>

          {mainLifts.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.sectionHeaderRow}>
                <SectionLabel colors={colors}>Main lifts</SectionLabel>
                <TouchableOpacity onPress={() => setTab('strength')}>
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: colors.signal }}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, padding: 0 }]}>
                {mainLifts.map((lift, i) => (
                  <LiftRow key={lift.exerciseId} lift={lift} colors={colors} isLast={i === mainLifts.length - 1} navigation={navigation} />
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {tab === 'strength' && (
        <View style={{ paddingBottom: 24, paddingTop: 22 }}>
          {liftTrends.length === 0 ? (
            <EmptyState colors={colors} text="Complete workouts to see strength trends." />
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, marginHorizontal: 16, padding: 0 }]}>
              {liftTrends.map((lift, i) => (
                <LiftRow key={lift.exerciseId} lift={lift} colors={colors} isLast={i === liftTrends.length - 1} navigation={navigation} />
              ))}
            </View>
          )}
        </View>
      )}

      {tab === 'habits' && (
        <View style={{ paddingBottom: 24, paddingTop: 22, paddingHorizontal: 16, gap: 16 }}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Footprints size={18} color={colors.info} />
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>Average daily steps</Text>
            </View>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 28, color: colors.ink }}>
              {activities.length > 0 ? `${(activities.reduce((a, d) => a + d.steps, 0) / activities.length / 1000).toFixed(1)}k` : '--'}
            </Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>
              Connect Apple Health from Profile to auto-track steps.
            </Text>
          </View>
          {activities.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, padding: 0 }]}>
              {[...activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((a, i, arr) => (
                <View key={i} style={[styles.habitRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, color: colors.mutedForeground }}>
                    {new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{a.steps.toLocaleString()} steps</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function LiftRow({ lift, colors, isLast, navigation }: { lift: LiftTrend; colors: any; isLast: boolean; navigation: any }) {
  return (
    <TouchableOpacity
      style={[styles.liftRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
      onPress={() => navigation.navigate('StrengthDetail', { exerciseId: lift.exerciseId, exerciseName: lift.exerciseName })}
      activeOpacity={0.6}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{lift.exerciseName}</Text>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 2 }}>est. 1RM</Text>
      </View>
      {lift.points.length >= 2 && <Sparkline values={lift.points} width={60} height={22} color={colors.progress} showEndDot={false} />}
      <View style={{ alignItems: 'flex-end', minWidth: 62 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink }}>{lift.current} lb</Text>
        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, color: lift.deltaVsEarliest > 0 ? colors.progress : colors.mutedForeground, marginTop: 2 }}>
          {lift.deltaVsEarliest > 0 ? `+${lift.deltaVsEarliest}` : lift.deltaVsEarliest === 0 ? 'flat' : lift.deltaVsEarliest}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function Tile({ colors, label, value, suffix, sub }: { colors: any; label: string; value: number; suffix: string; sub: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }]}>
      <SectionLabel colors={colors} style={{ fontSize: 10 }}>{label}</SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 7 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 22, color: colors.ink, letterSpacing: -0.3 }}>{value}</Text>
        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: colors.mutedForeground, marginLeft: 4 }}>{suffix}</Text>
      </View>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 9 }}>{sub}</Text>
    </View>
  );
}

function EmptyState({ colors, text }: { colors: any; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 }}>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabRow: { flexDirection: 'row', borderRadius: 9, padding: 3, gap: 3 },
  tabBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  card: { borderRadius: 18, padding: 20 },
  trendBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  tileRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 24 },
  tile: { flex: 1, borderRadius: 16, padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  habitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 13 },
});
