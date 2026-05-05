import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { Dumbbell, UtensilsCrossed, BarChart3, Flame, Target, Scale, AlertCircle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@fittrack/core/src/algorithms/macro-calculator';
import { analyzeActivity, shouldSuggestRestDay } from '@fittrack/core/src/algorithms/activity-analyzer';
import type { WorkoutSession } from '@fittrack/core';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  return dt.toISOString().split('T')[0];
}

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [todayCalories, setTodayCalories] = useState({ eaten: 0, target: 0 });
  const [todayProtein, setTodayProtein] = useState({ eaten: 0, target: 0 });
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [insights, setInsights] = useState<string[]>([]);

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

        const insightsList: string[] = [];
        const activityInsight = analyzeActivity(activities);

        if (weights.length > 0) {
          const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
          setLatestWeight(sorted[0].weightLbs);
          const adj = calculateAdaptiveAdjustment(macros.calories, weights, profile.goal);
          if (adj.shouldAdjust) insightsList.push(adj.reason);
        }

        if (activityInsight.averageSteps > 0 && activityInsight.category === 'sedentary') {
          insightsList.push('Your step count is low. Try a 15-minute walk after meals to boost daily movement.');
        }

        const completedThisWeek = w.filter((s) => {
          const d = new Date(s.date);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return s.completed && d >= weekAgo;
        });

        const restSuggestion = shouldSuggestRestDay(activities, completedThisWeek.length);
        if (restSuggestion.suggest) insightsList.push(restSuggestion.reason);

        if (eaten.protein < macros.protein * 0.5 && new Date().getHours() >= 14) {
          insightsList.push(
            `You've only had ${Math.round(eaten.protein)}g protein so far. You need ${Math.round(macros.protein - eaten.protein)}g more today.`,
          );
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
    ? Math.round((todayCalories.eaten / todayCalories.target) * 100)
    : 0;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.primary + '15' }]}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>
          {getGreeting()}, {user?.name || 'there'}
        </Text>
        <Text style={[styles.goalText, { color: colors.mutedForeground }]}>
          Ready to crush your goals today.
        </Text>
      </View>

      <View style={styles.content}>
        {/* Stat Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon={<Flame size={18} color={caloriePercent > 100 ? colors.destructive : colors.primary} />}
            label="Calories Today"
            value={`${Math.round(todayCalories.eaten)} / ${Math.round(todayCalories.target)}`}
            colors={colors}
            borderColor={caloriePercent > 100 ? colors.destructive + '30' : undefined}
          />
          <StatCard
            icon={<Target size={18} color={colors.primary} />}
            label="Protein"
            value={`${Math.round(todayProtein.eaten)}g / ${Math.round(todayProtein.target)}g`}
            colors={colors}
          />
          <StatCard
            icon={<Scale size={18} color={colors.primary} />}
            label="Weight"
            value={latestWeight ? `${latestWeight} lbs` : '--'}
            colors={colors}
          />
          <StatCard
            icon={<Dumbbell size={18} color={colors.primary} />}
            label="Workouts / Week"
            value={String(completedThisWeek)}
            colors={colors}
          />
        </View>

        {/* Today's Workout */}
        <TouchableOpacity
          style={[styles.workoutCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            if (todayWorkout) {
              navigation.navigate('Train', {
                screen: 'WorkoutDetail',
                params: { sessionId: todayWorkout.sessionId },
              });
            } else {
              handleGenerateWorkout();
            }
          }}
          disabled={generating}
          activeOpacity={0.7}
        >
          {todayWorkout ? (
            <View style={styles.workoutRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary, textTransform: 'uppercase' }}>
                  Continue Workout
                </Text>
                <Text style={[styles.workoutName, { color: colors.foreground }]}>{todayWorkout.name}</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                  {todayWorkout.exercises.filter((e) => e.sets.every((s) => s.completed)).length}/{todayWorkout.exercises.length} exercises done
                </Text>
              </View>
              <ArrowRight size={20} color={colors.primary} />
            </View>
          ) : (
            <View style={styles.workoutRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary, textTransform: 'uppercase' }}>
                  {generating ? 'Building your plan…' : 'Ready to train?'}
                </Text>
                <Text style={[styles.workoutName, { color: colors.foreground }]}>
                  {generating ? 'Generating Workout' : "Generate Today's Workout"}
                </Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                  Adapts to your history, ratings &amp; goals
                </Text>
              </View>
              {generating
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Dumbbell size={20} color={colors.primary} />}
            </View>
          )}
        </TouchableOpacity>

        {/* Insights */}
        {insights.length > 0 && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Smart Insights</Text>
            {insights.map((insight, i) => (
              <View key={i} style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <AlertCircle size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.mutedForeground, marginLeft: 8 }}>
                  {insight}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <QuickLink icon={<UtensilsCrossed size={22} color={colors.primary} />} label="Log Food" colors={colors} onPress={() => navigation.navigate('Eat')} />
          <QuickLink icon={<BarChart3 size={22} color={colors.primary} />} label="Analytics" colors={colors} onPress={() => navigation.navigate('Stats')} />
          <QuickLink icon={<Dumbbell size={22} color={colors.primary} />} label="Workouts" colors={colors} onPress={() => navigation.navigate('Train')} />
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, colors, borderColor }: {
  icon: React.ReactNode; label: string; value: string;
  colors: any; borderColor?: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: borderColor || colors.border }]}>
      {icon}
      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function QuickLink({ icon, label, colors, onPress }: {
  icon: React.ReactNode; label: string; colors: any; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '500', color: colors.foreground, marginTop: 6 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  greeting: { fontSize: 22, fontWeight: '700' },
  goalText: { fontSize: 14, marginTop: 4 },
  content: { padding: 16, gap: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', borderWidth: 1, borderRadius: 12, padding: 14, flexGrow: 1, flexBasis: '46%' },
  workoutCard: { borderWidth: 1, borderRadius: 12, padding: 16 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutName: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  insightCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  quickLinks: { flexDirection: 'row', gap: 10 },
  quickLink: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
});
