import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Fonts } from '../theme/fonts';
import { Ring, Sparkline, SectionLabel } from '../components/ui';
import * as api from '../services/api';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@fittrack/core/src/algorithms/macro-calculator';
import { analyzeActivity, shouldSuggestRestDay } from '@fittrack/core/src/algorithms/activity-analyzer';
import type { WorkoutSession, WeightEntry, DailyActivity } from '@fittrack/core';

// Mirrors the day-count baked into each split's label elsewhere (Settings'
// SPLIT_LABEL, workout-generator's getWorkoutSplitDescription) — used only
// to gauge weekly workout pace for the evening nudge below, not to render.
const SPLIT_DAYS_PER_WEEK: Record<string, number> = {
  ppl: 6, upper_lower: 4, full_body: 3, bro_split: 5,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initials(name?: string | null): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || parts[0]?.slice(0, 2).toUpperCase() || '·';
}

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [todayCalories, setTodayCalories] = useState({ eaten: 0, target: 0 });
  const [todayProtein, setTodayProtein] = useState({ eaten: 0, target: 0 });
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [todaySteps, setTodaySteps] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      const [profile, w, weightEntries, activities] = await Promise.all([
        api.getUserProfile(),
        api.getRecentWorkouts(20),
        api.getWeightEntries(30),
        api.getDailyActivities(14),
      ]);

      setWorkouts(w);
      setWeights(weightEntries);

      const todayActivity = activities.find((a: DailyActivity) => a.date === toDateString());
      setTodaySteps(todayActivity?.steps ?? 0);

      if (profile) {
        const macros = calculateMacroTargets(profile);
        const todayLog = await api.getFoodLogByDate(toDateString());
        const eaten = todayLog.reduce(
          (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein }),
          { calories: 0, protein: 0 },
        );

        setTodayCalories({ eaten: eaten.calories, target: macros.calories });
        setTodayProtein({ eaten: eaten.protein, target: macros.protein });

        const insightsList: string[] = [];
        const activityInsight = analyzeActivity(activities);
        const hour = new Date().getHours();

        if (weightEntries.length > 0) {
          const sorted = [...weightEntries].sort((a, b) => b.date.localeCompare(a.date));
          const adj = calculateAdaptiveAdjustment(macros.calories, weightEntries, profile.goal);
          if (adj.shouldAdjust) insightsList.push(adj.reason);
        }

        // Evening "how far behind today" comparison. Steps, weekly workout
        // pace, and protein are all the same kind of signal — you're short
        // of a target right now — so instead of a fixed code-order priority
        // (which always favored whichever check happened to run first),
        // score each by how far behind it actually is and lead with the
        // worst one. A day where you're miles behind on steps but fine on
        // protein should say so, and vice versa.
        if (hour >= 17) {
          const stepTarget = profile.stepTarget ?? 10000;
          const todaySteps = todayActivity?.steps ?? 0;
          const stepsSeverity = Math.max(0, (stepTarget - todaySteps) / stepTarget);

          const startOfWeek = new Date();
          startOfWeek.setHours(0, 0, 0, 0);
          startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
          const dayIndex = (new Date().getDay() + 6) % 7; // Monday = 0 .. Sunday = 6
          const completedThisCalendarWeek = w.filter((s) => s.completed && new Date(s.date) >= startOfWeek);
          const workedOutToday = w.some((s) => s.completed && s.date === toDateString());
          const daysPerWeekGoal = SPLIT_DAYS_PER_WEEK[profile.preferredSplit] ?? 4;
          const expectedByToday = Math.round((daysPerWeekGoal * (dayIndex + 1)) / 7);
          const workoutSeverity = workedOutToday
            ? 0
            : Math.max(0, (expectedByToday - completedThisCalendarWeek.length) / Math.max(expectedByToday, 1));

          const proteinSeverity = Math.max(0, (macros.protein - eaten.protein) / macros.protein);

          const candidates = [
            {
              severity: stepsSeverity,
              qualifies: stepsSeverity > 0.2,
              text: `${(stepTarget - todaySteps).toLocaleString()} steps to go tonight — a walk closes the gap.`,
            },
            {
              severity: workoutSeverity,
              qualifies: workoutSeverity > 0,
              text: `${completedThisCalendarWeek.length}/${daysPerWeekGoal} workouts this week — a session tonight keeps you on pace.`,
            },
            {
              severity: proteinSeverity,
              qualifies: proteinSeverity > 0.3,
              text: `Only ${Math.round(eaten.protein)}g protein logged. You need ${Math.round(macros.protein - eaten.protein)}g more today.`,
            },
          ]
            .filter((c) => c.qualifies)
            .sort((a, b) => b.severity - a.severity);

          candidates.slice(0, 2).forEach((c) => insightsList.push(c.text));
        }

        if (activityInsight.averageSteps > 0 && activityInsight.category === 'sedentary') {
          insightsList.push('Step count low. Try a 15-min walk after meals.');
        }

        const completedThisWeek = w.filter((s) => {
          const d = new Date(s.date);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return s.completed && d >= weekAgo;
        });

        const restSuggestion = shouldSuggestRestDay(activities, completedThisWeek.length);
        if (restSuggestion.suggest) insightsList.push(restSuggestion.reason);

        setInsights(insightsList);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const handleGenerateWorkout = useCallback(async () => {
    setGenerating(true);
    try {
      const session = await api.generateWorkout();
      if (session) {
        setWorkouts((prev) => [session, ...prev]);
        navigation.navigate('Train', { screen: 'WorkoutSession', params: { sessionId: session.sessionId } });
      } else {
        Alert.alert('Setup Required', 'Complete your profile before generating a workout.');
      }
    } catch {
      Alert.alert('Error', 'Could not generate workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [navigation]);

  const todayWorkout = workouts.find((w) => w.date === toDateString() && !w.completed);
  const caloriesLeft = Math.max(0, Math.round(todayCalories.target - todayCalories.eaten));
  const caloriePercent = todayCalories.target > 0 ? Math.min(todayCalories.eaten / todayCalories.target, 1) : 0;
  const proteinPercent = todayProtein.target > 0 ? Math.min(todayProtein.eaten / todayProtein.target, 1) : 0;
  const stepsPercent = Math.min(todaySteps / 10000, 1);

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].weightLbs : null;
  const weeklyRate = sortedWeights.length >= 2
    ? sortedWeights[sortedWeights.length - 1].weightLbs - sortedWeights[Math.max(0, sortedWeights.length - 8)].weightLbs
    : 0;
  const totalChange = sortedWeights.length >= 2 ? sortedWeights[sortedWeights.length - 1].weightLbs - sortedWeights[0].weightLbs : 0;
  const sinceDate = sortedWeights.length >= 2
    ? new Date(sortedWeights[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const completedExercises = todayWorkout ? todayWorkout.exercises.filter((e) => e.sets.every((s) => s.completed)).length : 0;
  const totalExercises = todayWorkout?.exercises.length ?? 0;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <SectionLabel colors={colors}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </SectionLabel>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 30, lineHeight: 34, color: colors.ink, marginTop: 8 }}>
            Good {getGreeting().toLowerCase()},{'\n'}{user?.name?.split(' ')[0] || 'there'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.getParent()?.navigate('Profile')}
          style={[styles.avatar, { backgroundColor: colors.surfaceInset }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.mutedStrong }}>{initials(user?.name)}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero: workout resume / start */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.heroImage, { backgroundColor: colors.surfaceInset }]}>
          <View style={[styles.heroImageWash, { backgroundColor: colors.canvas, opacity: 0.55 }]} />
          <View style={{ position: 'absolute', left: 20, bottom: 16 }}>
            <View style={[styles.pill, { backgroundColor: 'rgba(201,232,74,0.16)' }]}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.progress }} />
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 9.5, letterSpacing: 1, color: colors.progress, textTransform: 'uppercase' }}>
                {todayWorkout ? 'In progress' : 'Today'}
              </Text>
            </View>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 25, letterSpacing: -0.4, color: colors.ink, marginTop: 10 }}>
              {generating ? 'Building plan…' : todayWorkout ? todayWorkout.name : 'Ready to train'}
            </Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>
              {todayWorkout ? `${totalExercises} exercises` : 'Adapts to your history & goals'}
            </Text>
          </View>
        </View>
        <View style={{ padding: 20 }}>
          {todayWorkout && (
            <View style={styles.progressRow}>
              {Array.from({ length: totalExercises }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressSeg, { backgroundColor: i < completedExercises ? colors.progress : colors.surfaceInset }]}
                />
              ))}
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: colors.mutedForeground, marginLeft: 4 }}>
                {completedExercises}/{totalExercises}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.heroBtn, { backgroundColor: colors.signal }]}
            activeOpacity={0.85}
            disabled={generating}
            onPress={() => {
              if (todayWorkout) {
                navigation.navigate('Train', { screen: 'WorkoutSession', params: { sessionId: todayWorkout.sessionId } });
              } else {
                handleGenerateWorkout();
              }
            }}
          >
            {generating ? <ActivityIndicator color={colors.signalForeground} /> : (
              <>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15.5, color: colors.signalForeground }}>
                  {todayWorkout ? 'Pick up where you left off' : 'Generate today’s workout'}
                </Text>
                <ArrowRight size={18} color={colors.signalForeground} strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's targets */}
      <View style={styles.sectionHeaderRow}>
        <SectionLabel colors={colors}>Today's targets</SectionLabel>
        <TouchableOpacity onPress={() => navigation.getParent()?.navigate('FoodLog')}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11.5, color: colors.signal }}>Log food</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ringRow}>
        <RingStat colors={colors} percent={caloriePercent} color={colors.progress} value={String(caloriesLeft)} label="kcal left" />
        <RingStat
          colors={colors} percent={proteinPercent} color={colors.progress}
          value={`${Math.round(todayProtein.eaten)}`} suffix={`/${Math.round(todayProtein.target)}`} label="protein"
        />
        <RingStat colors={colors} percent={stepsPercent} color={colors.info} value={formatSteps(todaySteps)} label="steps" />
      </View>

      {/* Weight trend */}
      {sortedWeights.length >= 2 && latestWeight !== null && (
        <TouchableOpacity
          style={[styles.trendCard, { backgroundColor: colors.surface }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Progress')}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <SectionLabel colors={colors}>Weight trend</SectionLabel>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 28, letterSpacing: -0.5, color: colors.ink }}>{latestWeight}</Text>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: colors.mutedForeground, marginLeft: 7 }}>lb</Text>
              </View>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: weeklyRate <= 0 ? 'rgba(201,232,74,0.14)' : 'rgba(245,145,72,0.14)' }]}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: weeklyRate <= 0 ? colors.progress : colors.signal }}>
                {weeklyRate === 0 ? 'steady' : `${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(1)} lb/wk`}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <Sparkline values={sortedWeights.map((w) => w.weightLbs)} width={296} height={64} color={colors.progress} dotColor={colors.faint} />
          </View>
          {sinceDate && (
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 6 }}>
              {Math.abs(totalChange).toFixed(1)} lb {totalChange <= 0 ? 'down' : 'up'} since {sinceDate}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Coach nudge */}
      <View style={[styles.coachCard, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={[styles.coachIcon, { backgroundColor: colors.signal }]}>
            <Sparkles size={12} color={colors.signalForeground} strokeWidth={2.5} />
          </View>
          <SectionLabel colors={colors}>One thing tonight</SectionLabel>
        </View>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 19, lineHeight: 26, color: colors.ink }}>
          {insights[0] ?? 'You’re on track — keep the streak going!'}
        </Text>
        {insights[1] && (
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.mutedStrong, marginTop: 10 }}>
            {insights[1]}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function RingStat({ colors, percent, color, value, suffix, label }: {
  colors: any; percent: number; color: string; value: string; suffix?: string; label: string;
}) {
  return (
    <View style={[styles.ringStat, { backgroundColor: colors.surface }]}>
      <Ring percent={percent} trackColor={colors.trackMuted} fillColor={color} />
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 17, letterSpacing: -0.3, color: colors.ink, marginTop: 10 }}>
        {value}{suffix ? <Text style={{ color: colors.mutedForeground }}>{suffix}</Text> : null}
      </Text>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  heroCard: { marginHorizontal: 16, marginTop: 24, borderRadius: 20, overflow: 'hidden' },
  heroImage: { height: 172, position: 'relative', justifyContent: 'flex-end' },
  heroImageWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 30, marginBottom: 14 },
  ringRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  ringStat: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  trendCard: { marginHorizontal: 16, marginTop: 24, borderRadius: 18, padding: 18 },
  trendBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  coachCard: { marginHorizontal: 16, marginTop: 20, borderRadius: 18, padding: 20 },
  coachIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
