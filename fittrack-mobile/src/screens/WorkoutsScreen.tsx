import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { Dumbbell, Trash2, RotateCcw, CheckCircle, ChevronRight, Zap, Calendar } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import { toDateString } from '../utils/date';
import type { WorkoutSession } from '@fittrack/core';

export function WorkoutsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [deletedWorkouts, setDeletedWorkouts] = useState<WorkoutSession[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);

  const loadWorkouts = useCallback(async () => {
    try {
      const sessions = await api.getRecentWorkouts(20);
      setWorkouts(sessions);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkouts();
  }, [loadWorkouts]);

  const handleDelete = useCallback((sessionId: string) => {
    const workout = workouts.find((w) => w.sessionId === sessionId);
    if (!workout) return;

    Alert.alert('Delete Workout', `Delete "${workout.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setWorkouts((prev) => prev.filter((w) => w.sessionId !== sessionId));
          setDeletedWorkouts((prev) => [...prev, workout]);
          await api.deleteWorkout(sessionId);
        },
      },
    ]);
  }, [workouts]);

  const handleGenerateWeek = useCallback(async () => {
    setGeneratingWeek(true);
    try {
      const sessions = await api.generateWeekWorkouts();
      if (sessions.length === 0) {
        Alert.alert('Setup Required', 'Complete your profile in Settings before planning your week.');
        return;
      }
      setWorkouts((prev) => {
        const existingIds = new Set(prev.map((w) => w.sessionId));
        const newSessions = sessions.filter((s) => !existingIds.has(s.sessionId));
        return [...newSessions, ...prev].sort((a, b) => a.date.localeCompare(b.date));
      });
      Alert.alert('Week Planned!', `${sessions.length} workouts scheduled for this week.`);
    } catch {
      Alert.alert('Error', 'Could not plan the week. Please try again.');
    } finally {
      setGeneratingWeek(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const session = await api.generateWorkout();
      if (!session) {
        Alert.alert('Setup Required', 'Complete your profile in Settings before generating a workout.');
        return;
      }
      setWorkouts((prev) => [session, ...prev]);
      navigation.navigate('WorkoutDetail', { sessionId: session.sessionId });
    } catch {
      Alert.alert('Error', 'Could not generate workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [navigation]);

  const handleReinstate = useCallback(async (sessionId: string) => {
    const workout = deletedWorkouts.find((w) => w.sessionId === sessionId);
    if (!workout) return;
    await api.saveWorkout(workout);
    setDeletedWorkouts((prev) => prev.filter((w) => w.sessionId !== sessionId));
    setWorkouts((prev) => [...prev, workout].sort((a, b) => b.date.localeCompare(a.date)));
  }, [deletedWorkouts]);

  const today = toDateString();
  const todayWorkouts = workouts.filter((w) => w.date === today && !w.completed);
  const upcomingWorkouts = workouts.filter((w) => !w.completed && w.date > today);
  const inProgressWorkouts = workouts.filter((w) => !w.completed && w.date !== today && w.date <= today);
  const completedWorkouts = workouts.filter((w) => w.completed);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderWorkoutCard = (session: WorkoutSession) => {
    const dateStr = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const exerciseCount = session.exercises.length;
    const completedCount = session.exercises.filter((e) => e.sets.every((s) => s.completed)).length;
    const isToday = session.date === today;

    return (
      <View key={session.sessionId} style={styles.cardRow}>
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: isToday && !session.completed ? colors.primary : colors.border },
            isToday && !session.completed && { borderWidth: 1.5 },
          ]}
          onPress={() => navigation.navigate('WorkoutDetail', { sessionId: session.sessionId })}
          activeOpacity={0.7}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.cardIcon, { backgroundColor: session.completed ? colors.success + '20' : colors.primary + '15' }]}>
              {session.completed
                ? <CheckCircle size={16} color={colors.success} />
                : <Dumbbell size={16} color={colors.primary} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>{session.name}</Text>
              <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                {dateStr} · {exerciseCount} exercises
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            {!session.completed && (
              <Text style={[styles.cardProgress, { color: colors.primary }]}>
                {completedCount}/{exerciseCount}
              </Text>
            )}
            <ChevronRight size={16} color={colors.mutedForeground} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.border }]}
          onPress={() => handleDelete(session.sessionId)}
          activeOpacity={0.6}
        >
          <Trash2 size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Train</Text>
        <View style={styles.generateRow}>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: colors.primary }]}
            onPress={handleGenerate}
            disabled={generating || generatingWeek}
            activeOpacity={0.85}
          >
            {generating
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Zap size={15} color={colors.primaryForeground} />}
            <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
              {generating ? 'Generating…' : 'Next Workout'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleGenerateWeek}
            disabled={generating || generatingWeek}
            activeOpacity={0.85}
          >
            {generatingWeek
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Calendar size={15} color={colors.primary} />}
            <Text style={[styles.generateBtnText, { color: colors.primary }]}>
              {generatingWeek ? 'Planning…' : 'Plan Week'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {todayWorkouts.length > 0 && (
          <Section title="Today" colors={colors}>
            {todayWorkouts.map(renderWorkoutCard)}
          </Section>
        )}

        {upcomingWorkouts.length > 0 && (
          <Section title="Upcoming" colors={colors}>
            {upcomingWorkouts.map(renderWorkoutCard)}
          </Section>
        )}

        {inProgressWorkouts.length > 0 && (
          <Section title="In Progress" colors={colors}>
            {inProgressWorkouts.map(renderWorkoutCard)}
          </Section>
        )}

        {completedWorkouts.length > 0 && (
          <Section title="Recent" colors={colors}>
            {completedWorkouts.slice(0, 5).map(renderWorkoutCard)}
          </Section>
        )}

        {deletedWorkouts.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity onPress={() => setShowDeleted(!showDeleted)} style={styles.deletedToggle}>
              <Trash2 size={13} color={colors.mutedForeground} />
              <Text style={[styles.deletedToggleText, { color: colors.mutedForeground }]}>
                Deleted ({deletedWorkouts.length})  {showDeleted ? '↑' : '↓'}
              </Text>
            </TouchableOpacity>
            {showDeleted && deletedWorkouts.map((session) => (
              <View key={session.sessionId} style={[styles.deletedCard, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.mutedForeground, textDecorationLine: 'line-through' }}>
                    {session.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                    {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.reinstateBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => handleReinstate(session.sessionId)}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={13} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary, marginLeft: 4 }}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {workouts.length === 0 && deletedWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
              <Dumbbell size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No workouts yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tap "Next Workout" to get a plan personalised to your goals and training history.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 12 },
  generateRow: { flexDirection: 'row', gap: 8 },
  generateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 6,
  },
  generateBtnText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  card: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardMeta: { fontSize: 12 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardProgress: { fontSize: 12, fontWeight: '700' },
  deleteBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deletedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  deletedToggleText: { fontSize: 12, fontWeight: '600' },
  deletedCard: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed',
    borderRadius: 12, padding: 12, marginBottom: 8, opacity: 0.65,
  },
  reinstateBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
