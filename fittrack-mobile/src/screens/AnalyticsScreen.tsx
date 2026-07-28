import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Footprints, UtensilsCrossed, Flame } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, Sparkline, TargetBarChart } from '../components/ui';
import * as api from '../services/api';
import { calculateMacroTargets, calculateBMR, toDateString } from '@fittrack/core';
import type { WeightEntry, DailyActivity, WorkoutSession, UserProfile, FoodLogEntry } from '@fittrack/core';

const DEFAULT_STEP_TARGET = 10000;

type TabId = 'body' | 'strength' | 'habits';

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
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const today = new Date();
      const sevenDaysAgoStr = toDateString(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
      const todayStr = toDateString(today);
      const [w, a, s, p, f] = await Promise.all([
        api.getWeightEntries(90),
        api.getDailyActivities(60),
        api.getRecentWorkouts(60),
        api.getUserProfile(),
        api.getFoodLogByDateRange(sevenDaysAgoStr, todayStr),
      ]);
      setWeights(w);
      setWorkouts(s);
      setActivities(a);
      setProfile(p);
      setFoodLogs(f);
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

  const stepTarget = profile?.stepTarget ?? DEFAULT_STEP_TARGET;
  const validActivities = activities.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.date));

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentSteps = validActivities.filter((a) => new Date(a.date) >= fourteenDaysAgo);
  const avgDailySteps = recentSteps.length
    ? Math.round(recentSteps.reduce((sum, a) => sum + a.steps, 0) / recentSteps.length)
    : null;
  const stepGoalPct = avgDailySteps !== null ? Math.round((avgDailySteps / stepTarget) * 100) : null;

  const firstWeight = sortedWeights.length ? sortedWeights[0].weightLbs : null;
  const weightToGo = profile && latestWeight !== null ? Math.round(Math.abs(latestWeight - profile.targetWeightLbs) * 10) / 10 : null;
  let weightGoalPct: number | null = null;
  if (profile && firstWeight !== null && latestWeight !== null && firstWeight !== profile.targetWeightLbs) {
    const pct = ((firstWeight - latestWeight) / (firstWeight - profile.targetWeightLbs)) * 100;
    weightGoalPct = Math.round(Math.max(0, Math.min(100, pct)));
  }

  const last7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toDateString(d);
  });
  const dayLabels = last7Dates.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' }));

  const stepsByDate = new Map(validActivities.map((a) => [a.date, a.steps]));
  const stepsSeries = last7Dates.map((d) => stepsByDate.get(d) ?? 0);
  const stepGoalDays = stepsSeries.filter((s) => s >= stepTarget).length;

  const caloriesByDate = new Map<string, number>();
  for (const f of foodLogs) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(f.date)) continue;
    const key = f.date.slice(0, 10);
    caloriesByDate.set(key, (caloriesByDate.get(key) ?? 0) + f.calories);
  }
  const caloriesSeries = last7Dates.map((d) => Math.round(caloriesByDate.get(d) ?? 0));
  const calorieTarget = profile ? calculateMacroTargets(profile).calories : null;
  // "Adherent" means within 10% of target on either side, not just at/over
  // it — the bar highlight has to follow the same band, or a well-logged
  // under-target day (which counts toward the 2/7 badge) renders as a dead
  // muted bar right next to the days that don't count.
  const dietHighlight = calorieTarget !== null
    ? caloriesSeries.map((c) => c > 0 && Math.abs(c - calorieTarget) <= calorieTarget * 0.1)
    : caloriesSeries.map(() => false);
  const calorieGoalDays = dietHighlight.filter(Boolean).length;

  // "Calories out" per day = BMR (maintenance at rest) + that day's actual
  // active calories burned — not the flat calculateTDEE() number, which just
  // assumes a fixed activity-level multiplier and would double-count (or
  // miss) whatever HealthKit actually measured that specific day.
  const bmr = profile ? Math.round(calculateBMR(profile)) : null;
  const activeCaloriesByDate = new Map(validActivities.map((a) => [a.date, a.activeCalories]));
  const caloriesOutSeries = last7Dates.map((d) => (bmr ?? 0) + (activeCaloriesByDate.get(d) ?? 0));
  // A deficit day (consumed <= total burn) is the *good* outcome here, the
  // opposite of the steps/diet charts where meeting-or-beating the line is
  // good — so the highlight rule has to flip too, or every deficit day (the
  // whole point of the "N cal deficit" badge) renders as an invisible muted
  // bar.
  const deficitHighlight = caloriesSeries.map((c, i) => c > 0 && c <= caloriesOutSeries[i]);

  const loggedDayIdx = caloriesSeries.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
  const avgConsumed = loggedDayIdx.length
    ? Math.round(loggedDayIdx.reduce((a, i) => a + caloriesSeries[i], 0) / loggedDayIdx.length)
    : null;
  const avgCaloriesOut = loggedDayIdx.length
    ? Math.round(loggedDayIdx.reduce((a, i) => a + caloriesOutSeries[i], 0) / loggedDayIdx.length)
    : null;
  const avgDeficit = bmr !== null && avgConsumed !== null && avgCaloriesOut !== null ? avgCaloriesOut - avgConsumed : null;

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
            <Tile
              colors={colors}
              label="Weight progress"
              value={weightGoalPct !== null ? weightGoalPct : '--'}
              suffix={weightGoalPct !== null ? '% to goal' : ''}
              sub={weightToGo !== null ? `${weightToGo} lb to go` : 'Log weigh-ins to track'}
            />
            <Tile
              colors={colors}
              label="Avg daily steps"
              value={avgDailySteps !== null ? avgDailySteps.toLocaleString() : '--'}
              suffix={`/ ${stepTarget.toLocaleString()}`}
              sub={stepGoalPct !== null ? `${stepGoalPct}% of goal` : 'Connect Apple Health'}
            />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Footprints size={18} color={colors.info} />
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>Steps vs target</Text>
              </View>
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(63,110,150,0.14)' }]}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.info }}>{stepGoalDays}/7 days</Text>
              </View>
            </View>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, marginBottom: 14 }}>
              {avgDailySteps !== null ? `${avgDailySteps.toLocaleString()} avg` : 'No steps logged yet'} · goal {stepTarget.toLocaleString()}/day
            </Text>
            <TargetBarChart
              values={stepsSeries}
              labels={dayLabels}
              target={stepTarget}
              width={296}
              height={84}
              color={colors.info}
              mutedColor={colors.trackMuted}
              targetColor={colors.mutedStrong}
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <UtensilsCrossed size={18} color={colors.signal} />
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>Diet adherence</Text>
              </View>
              {calorieTarget !== null && (
                <View style={[styles.trendBadge, { backgroundColor: 'rgba(245,145,72,0.14)' }]}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.signal }}>{calorieGoalDays}/7 days</Text>
                </View>
              )}
            </View>
            {calorieTarget !== null ? (
              <>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, marginBottom: 14 }}>
                  Within 10% of goal · target {calorieTarget.toLocaleString()} kcal/day
                </Text>
                <TargetBarChart
                  values={caloriesSeries}
                  labels={dayLabels}
                  target={calorieTarget}
                  highlight={dietHighlight}
                  width={296}
                  height={84}
                  color={colors.signal}
                  mutedColor={colors.trackMuted}
                  targetColor={colors.mutedStrong}
                />
              </>
            ) : (
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground }}>
                Complete your profile to see a calorie target.
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Flame size={18} color={colors.progress} />
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>Calories vs total burn</Text>
              </View>
              {avgDeficit !== null && (
                <View style={[styles.trendBadge, { backgroundColor: 'rgba(201,232,74,0.14)' }]}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.progress }}>
                    {Math.abs(avgDeficit).toLocaleString()} cal {avgDeficit >= 0 ? 'deficit' : 'surplus'}
                  </Text>
                </View>
              )}
            </View>
            {bmr !== null ? (
              <>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, marginBottom: 14 }}>
                  Consumed vs maintenance ({bmr.toLocaleString()}) plus daily active calories burned
                </Text>
                <TargetBarChart
                  values={caloriesSeries}
                  labels={dayLabels}
                  target={caloriesOutSeries}
                  highlight={deficitHighlight}
                  width={296}
                  height={84}
                  color={colors.progress}
                  mutedColor={colors.trackMuted}
                  targetColor={colors.mutedStrong}
                />
              </>
            ) : (
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground }}>
                Complete your profile to see your maintenance calories.
              </Text>
            )}
          </View>
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

function Tile({ colors, label, value, suffix, sub }: { colors: any; label: string; value: number | string; suffix: string; sub: string }) {
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
});
