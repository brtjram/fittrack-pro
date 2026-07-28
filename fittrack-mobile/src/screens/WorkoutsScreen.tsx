import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dumbbell, Trash2, RotateCcw, CheckCircle, ChevronRight, Zap, Calendar } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, PillButton, SwipeToDelete } from '../components/ui';
import * as api from '../services/api';
import type { WorkoutSession } from '@fittrack/core';

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function WorkoutsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [deletedWorkouts, setDeletedWorkouts] = useState<WorkoutSession[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  // Deletion is deferred: tapping "Delete" removes the card from view immediately
  // and shows it under "Deleted", but the actual server-side delete (which is
  // permanent — there's no server-side trash/soft-delete) only fires after this
  // grace period. Restoring within the window cancels the pending API call
  // entirely, so a same-second "oops" tap never touches the database.
  const DELETE_GRACE_MS = 8000;
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
        text: 'Delete', style: 'destructive', onPress: () => {
          setWorkouts((prev) => prev.filter((w) => w.sessionId !== sessionId));
          setDeletedWorkouts((prev) => [...prev, workout]);

          // Don't call the (permanent, unrecoverable) delete API right away —
          // give the user a real window to hit "Restore" before it's gone for good.
          const timer = setTimeout(() => {
            pendingDeletes.current.delete(sessionId);
            api.deleteWorkout(sessionId).catch(() => {});
          }, DELETE_GRACE_MS);
          pendingDeletes.current.set(sessionId, timer);
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
      navigation.navigate('WorkoutSession', { sessionId: session.sessionId });
    } catch {
      Alert.alert('Error', 'Could not generate workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [navigation]);

  const handleReinstate = useCallback(async (sessionId: string) => {
    const workout = deletedWorkouts.find((w) => w.sessionId === sessionId);
    if (!workout) return;

    const timer = pendingDeletes.current.get(sessionId);
    if (timer) {
      // Still within the grace window — the API delete never fired, so there's
      // nothing to undo server-side, just cancel it.
      clearTimeout(timer);
      pendingDeletes.current.delete(sessionId);
    } else {
      // Grace period already elapsed and the row is actually gone server-side —
      // recreate it.
      await api.saveWorkout(workout);
    }
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
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  // Swipe left to delete, rather than a permanent Trash2 button riding
  // alongside every card — matches the native iOS row-action pattern and
  // gives the card itself the full row width to breathe.
  const renderWorkoutCard = (session: WorkoutSession) => {
    const dateStr = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const exerciseCount = session.exercises.length;
    const completedCount = session.exercises.filter((e) => e.sets.every((s) => s.completed)).length;
    const isToday = session.date === today;

    return (
      <View key={session.sessionId} style={{ marginBottom: 12 }}>
        <SwipeToDelete colors={colors} onDelete={() => handleDelete(session.sessionId)}>
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: isToday && !session.completed ? colors.signal : colors.hairline },
              isToday && !session.completed && { borderWidth: 1.5 },
            ]}
            onPress={() => navigation.navigate('WorkoutSession', { sessionId: session.sessionId })}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.cardIcon, { backgroundColor: session.completed ? 'rgba(201,232,74,0.14)' : 'rgba(245,145,72,0.14)' }]}>
                {session.completed
                  ? <CheckCircle size={20} color={colors.progress} />
                  : <Dumbbell size={20} color={colors.signal} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: colors.ink }]} numberOfLines={1}>{session.name}</Text>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  {dateStr} · {exerciseCount} exercises
                </Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              {!session.completed && (
                <Text style={[styles.cardProgress, { color: colors.signal }]}>
                  {completedCount}/{exerciseCount}
                </Text>
              )}
              <ChevronRight size={18} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        </SwipeToDelete>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.canvas, paddingTop: insets.top + 16 }]}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 30, color: colors.ink, marginBottom: 14 }}>Train</Text>
        <View style={styles.generateRow}>
          <PillButton
            colors={colors}
            style={{ flex: 1 }}
            onPress={handleGenerate}
            disabled={generating || generatingWeek}
            label={generating ? 'Generating…' : 'Next workout'}
            icon={generating ? <ActivityIndicator size="small" color={colors.signalForeground} /> : <Zap size={15} color={colors.signalForeground} />}
          />
          <PillButton
            colors={colors}
            tone="ghost"
            style={{ flex: 1 }}
            onPress={handleGenerateWeek}
            disabled={generating || generatingWeek}
            label={generatingWeek ? 'Planning…' : 'Plan week'}
            icon={generatingWeek ? <ActivityIndicator size="small" color={colors.ink} /> : <Calendar size={15} color={colors.ink} />}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal} />}
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
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.mutedForeground }}>
                Deleted ({deletedWorkouts.length})  {showDeleted ? '↑' : '↓'}
              </Text>
            </TouchableOpacity>
            {showDeleted && deletedWorkouts.map((session) => (
              <View key={session.sessionId} style={[styles.deletedCard, { borderColor: colors.hairline }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.mutedForeground, textDecorationLine: 'line-through' }}>
                    {session.name}
                  </Text>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                    {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.reinstateBtn, { backgroundColor: 'rgba(245,145,72,0.14)' }]}
                  onPress={() => handleReinstate(session.sessionId)}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={13} color={colors.signal} />
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.signal, marginLeft: 4 }}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {workouts.length === 0 && deletedWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Dumbbell size={32} color={colors.signal} />
            </View>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 19, color: colors.ink, marginBottom: 8 }}>No workouts yet</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, textAlign: 'center', color: colors.mutedForeground }}>
              Tap "Next workout" to get a plan personalised to your goals and training history.
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
      <SectionLabel colors={colors} style={{ marginBottom: 10 }}>{title}</SectionLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 },
  generateRow: { flexDirection: 'row', gap: 10 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: Fonts.sansSemiBold, fontSize: 16, marginBottom: 3 },
  cardMeta: { fontFamily: Fonts.sans, fontSize: 12.5 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardProgress: { fontFamily: Fonts.sansSemiBold, fontSize: 13 },
  deletedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  deletedCard: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed',
    borderRadius: 14, padding: 14, marginBottom: 8, opacity: 0.65,
  },
  reinstateBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
});
