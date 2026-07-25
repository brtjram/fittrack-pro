import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { Dumbbell, UtensilsCrossed, BarChart3, Flame, Target, Scale, Zap, ChevronRight, TrendingUp, Footprints } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { useAuth } from '../hooks/useAuth';
import { LogoMark } from '../components/Logo';
import * as api from '../services/api';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@fittrack/core/src/algorithms/macro-calculator';
import { shouldSuggestRestDay } from '@fittrack/core/src/algorithms/activity-analyzer';
import { toDateString } from '../utils/date';
import type { WorkoutSession } from '@fittrack/core';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [todayCalories, setTodayCalories] = useState({ eaten: 0, target: 0 });
  const [todayProtein, setTodayProtein] = useState({ eaten: 0, target: 0 });
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [todaySteps, setTodaySteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(10000);

  const loadDashboard = useCallback(async () => {
    try {
      const [profile, w, weights, activities] = await Promise.all([
        api.getUserProfile(),
        api.getRecentWorkouts(20),
        api.getWeightEntries(30),
        api.getDailyActivities(14),
      ]);

      setWorkouts(w);

      if (profile) {
        const macros = calculateMacroTargets(profile);
        const todayLog = await api.getFoodLogByDate(toDateString());
        const eaten = todayLog.reduce(
          (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein }),
          { calories: 0, protein: 0 },
        );

        setTodayCalories({ eaten: eaten.calories, target: macros.calories });
        setTodayProtein({ eaten: eaten.protein, target: macros.protein });

        const today = toDateString();
        const todayActivity = activities.find((a) => a.date === today);
        setTodaySteps(todayActivity?.steps ?? 0);
        setStepGoal(profile.stepTarget ?? 10000);

        const insightsList: string[] = [];

        if (weights.length > 0) {
          const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
          setLatestWeight(sorted[0].weightLbs);
          const adj = calculateAdaptiveAdjustment(macros.calories, weights, profile.goal);
          if (adj.shouldAdjust) insightsList.push(adj.reason);
        }

        const completedThisWeek = w.filter((s) => {
          const d = new Date(s.date);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return s.completed && d >= weekAgo;
        });

        const restSuggestion = shouldSuggestRestDay(activities, completedThisWeek.length);
        if (restSuggestion.suggest) insightsList.push(restSuggestion.reason);

        if (eaten.protein < macros.protein * 0.5 && new Date().getHours() >= 14) {
          insightsList.push(`Only ${Math.round(eaten.protein)}g protein logged. You need ${Math.round(macros.protein - eaten.protein)}g more today.`);
        }

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
        navigation.navigate('Train', {
          screen: 'WorkoutDetail',
          params: { sessionId: session.sessionId },
        });
      } else {
        Alert.alert('Setup Required', 'Complete your profile in Settings before generating a workout.');
      }
    } catch {
      Alert.alert('Error', 'Could not generate workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [navigation]);

  const completedThisWeek = workouts.filter((w) => {
    const d = new Date(w.date);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return w.completed && d >= weekAgo;
  }).length;

  const todayWorkout = workouts.find((w) => w.date === toDateString() && !w.completed);
  const caloriePercent = todayCalories.target > 0
    ? Math.min(Math.round((todayCalories.eaten / todayCalories.target) * 100), 100)
    : 0;
  const proteinPercent = todayProtein.target > 0
    ? Math.min(Math.round((todayProtein.eaten / todayProtein.target) * 100), 100)
    : 0;
  const stepsPercent = stepGoal > 0 ? Math.min(Math.round((todaySteps / stepGoal) * 100), 100) : 0;
  const stepsRemaining = Math.max(stepGoal - todaySteps, 0);
  const stepsMessage = todaySteps === 0
    ? 'Get moving — every step counts.'
    : stepsPercent >= 100
      ? 'Goal crushed! Amazing work today.'
      : stepsPercent >= 75
        ? `Almost there — ${stepsRemaining.toLocaleString()} steps to go.`
        : stepsPercent >= 40
          ? `Good pace — ${stepsRemaining.toLocaleString()} steps left for your goal.`
          : `${stepsRemaining.toLocaleString()} steps to go. A short walk adds up fast.`;

  const bg = colors.background;
  const accent = colors.primary;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: bg }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name?.split(' ')[0] || 'Athlete'}</Text>
        </View>
        <LogoMark size={36} color={accent} bg={isDark ? '#1A1A1A' : '#F0F0F0'} />
      </View>

      {/* Train CTA */}
      <TouchableOpacity
        style={[styles.trainCta, { backgroundColor: accent }]}
        onPress={() => {
          if (todayWorkout) {
            navigation.navigate('Train', { screen: 'WorkoutDetail', params: { sessionId: todayWorkout.sessionId } });
          } else {
            handleGenerateWorkout();
          }
        }}
        disabled={generating}
        activeOpacity={0.85}
      >
        <View style={styles.trainCtaContent}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trainCtaLabel, { color: colors.primaryForeground + 'BB' }]}>
              {todayWorkout ? 'CONTINUE' : 'TODAY'}
            </Text>
            <Text style={[styles.trainCtaTitle, { color: colors.primaryForeground }]}>
              {generating ? 'Building plan…' : todayWorkout ? todayWorkout.name : "Generate Workout"}
            </Text>
            {todayWorkout && (
              <Text style={{ fontSize: 13, color: colors.primaryForeground + 'AA', marginTop: 2 }}>
                {todayWorkout.exercises.filter((e) => e.sets.every((s) => s.completed)).length}/{todayWorkout.exercises.length} exercises done
              </Text>
            )}
            {!todayWorkout && !generating && (
              <Text style={{ fontSize: 13, color: colors.primaryForeground + 'AA', marginTop: 2 }}>
                Adapts to your history &amp; goals
              </Text>
            )}
          </View>
          {generating
            ? <ActivityIndicator color={colors.primaryForeground} />
            : <View style={[styles.trainCtaArrow, { backgroundColor: colors.primaryForeground + '20' }]}>
                <ChevronRight size={20} color={colors.primaryForeground} />
              </View>
          }
        </View>
      </TouchableOpacity>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <MacroRing
          label="Calories"
          value={Math.round(todayCalories.eaten)}
          target={Math.round(todayCalories.target)}
          percent={caloriePercent}
          unit="kcal"
          colors={colors}
          accent={accent}
        />
        <MacroRing
          label="Protein"
          value={Math.round(todayProtein.eaten)}
          target={Math.round(todayProtein.target)}
          percent={proteinPercent}
          unit="g"
          colors={colors}
          accent={accent}
        />
        <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Dumbbell size={16} color={accent} />
          <Text style={[styles.statPillValue, { color: colors.foreground }]}>{completedThisWeek}</Text>
          <Text style={[styles.statPillLabel, { color: colors.mutedForeground }]}>this week</Text>
        </View>
        {latestWeight !== null && (
          <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Scale size={16} color={accent} />
            <Text style={[styles.statPillValue, { color: colors.foreground }]}>{latestWeight}</Text>
            <Text style={[styles.statPillLabel, { color: colors.mutedForeground }]}>lbs</Text>
          </View>
        )}
      </View>

      {/* Today's Steps */}
      <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stepsHeaderRow}>
          <View style={[styles.stepsIconWrap, { backgroundColor: accent + '18' }]}>
            <Footprints size={20} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepsLabel, { color: colors.mutedForeground }]}>TODAY&apos;S STEPS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[styles.stepsValue, { color: colors.foreground }]}>{todaySteps.toLocaleString()}</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>/ {stepGoal.toLocaleString()}</Text>
            </View>
          </View>
          <Text style={[styles.stepsPercent, { color: stepsPercent >= 100 ? colors.success : accent }]}>
            {stepsPercent}%
          </Text>
        </View>
        <View style={[styles.stepsBarTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.stepsBarFill, {
            width: `${stepsPercent}%` as any,
            backgroundColor: stepsPercent >= 100 ? colors.success : accent,
          }]} />
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 10, lineHeight: 17 }}>
          {stepsMessage}
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK ACTIONS</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction
          icon={<UtensilsCrossed size={20} color={accent} />}
          label="Log Food"
          colors={colors}
          onPress={() => navigation.navigate('Eat')}
        />
        <QuickAction
          icon={<Dumbbell size={20} color={accent} />}
          label="Train"
          colors={colors}
          onPress={() => navigation.navigate('Train')}
        />
        <QuickAction
          icon={<BarChart3 size={20} color={accent} />}
          label="Analytics"
          colors={colors}
          onPress={() => navigation.navigate('Stats')}
        />
        <QuickAction
          icon={<TrendingUp size={20} color={accent} />}
          label="AI Coach"
          colors={colors}
          onPress={() => navigation.navigate('Coach')}
        />
      </View>

      {/* Insights */}
      {insights.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SMART INSIGHTS</Text>
          </View>
          {insights.map((insight, i) => (
            <View key={i} style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.insightDot, { backgroundColor: accent }]} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.foreground }}>
                {insight}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function MacroRing({ label, value, target, percent, unit, colors, accent }: {
  label: string; value: number; target: number; percent: number;
  unit: string; colors: any; accent: string;
}) {
  return (
    <View style={[styles.macroRing, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.macroValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.macroUnit, { color: accent }]}>{unit}</Text>
      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.macroBar, { backgroundColor: colors.border }]}>
        <View style={[styles.macroBarFill, { width: `${percent}%` as any, backgroundColor: accent }]} />
      </View>
      <Text style={[styles.macroTarget, { color: colors.mutedForeground }]}>{target}{unit}</Text>
    </View>
  );
}

function QuickAction({ icon, label, colors, onPress }: {
  icon: React.ReactNode; label: string; colors: any; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: colors.border }]}>
        {icon}
      </View>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.foreground, marginTop: 8 }}>{label}</Text>
    </TouchableOpacity>
  );
}

// Soft elevation used across Home's cards for a bit of depth beyond the flat
// 1px border — mostly visible in light mode; dark mode leans on the border.
const cardElevation = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
  },
  greeting: { fontSize: 14, fontWeight: '500', letterSpacing: 0.3 },
  name: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  trainCta: {
    marginHorizontal: 16, borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
  },
  trainCtaContent: { flexDirection: 'row', alignItems: 'center' },
  trainCtaLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  trainCtaTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  trainCtaArrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  macroRing: {
    flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: 'center', ...cardElevation,
  },
  macroValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  macroUnit: { fontSize: 10, fontWeight: '700', marginTop: -2 },
  macroLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  macroBar: { width: '100%', height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  macroBarFill: { height: 3, borderRadius: 2 },
  macroTarget: { fontSize: 9, marginTop: 4 },
  statPill: {
    flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 2, ...cardElevation,
  },
  statPillValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statPillLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  stepsCard: {
    marginHorizontal: 16, marginBottom: 24, borderWidth: 1, borderRadius: 18, padding: 16, ...cardElevation,
  },
  stepsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepsIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  stepsValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  stepsPercent: { fontSize: 15, fontWeight: '800' },
  stepsBarTrack: { width: '100%', height: 8, borderRadius: 4, marginTop: 14, overflow: 'hidden' },
  stepsBarFill: { height: 8, borderRadius: 4 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  quickGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 24 },
  quickAction: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', ...cardElevation },
  quickActionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: 16, borderWidth: 1, borderRadius: 14,
    padding: 14, marginBottom: 8, ...cardElevation,
  },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
});
