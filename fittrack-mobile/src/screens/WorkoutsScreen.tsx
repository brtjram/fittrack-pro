import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { Dumbbell, Trash2, RotateCcw, Clock, CheckCircle } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import type { WorkoutSession } from '@fittrack/core';

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  return dt.toISOString().split('T')[0];
}

export function WorkoutsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [deletedWorkouts, setDeletedWorkouts] = useState<WorkoutSession[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleReinstate = useCallback(async (sessionId: string) => {
    const workout = deletedWorkouts.find((w) => w.sessionId === sessionId);
    if (!workout) return;
    await api.saveWorkout(workout);
    setDeletedWorkouts((prev) => prev.filter((w) => w.sessionId !== sessionId));
    setWorkouts((prev) => [...prev, workout].sort((a, b) => b.date.localeCompare(a.date)));
  }, [deletedWorkouts]);

  const today = toDateString();
  const todayWorkout = workouts.find((w) => w.date === today && !w.completed);
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

    return (
      <View key={session.sessionId} style={styles.cardRow}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('WorkoutDetail', { sessionId: session.sessionId })}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.foreground }]}>{session.name}</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                {dateStr} · {exerciseCount} exercises
              </Text>
            </View>
            {session.completed ? (
              <CheckCircle size={18} color={colors.success} />
            ) : (
              <View style={styles.progressBadge}>
                <Clock size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginLeft: 4 }}>
                  {completedCount}/{exerciseCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.border }]}
          onPress={() => handleDelete(session.sessionId)}
          activeOpacity={0.6}
        >
          <Trash2 size={16} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.content}>
        {/* Today */}
        {todayWorkout && (
          <Section title="Today" colors={colors}>
            {renderWorkoutCard(todayWorkout)}
          </Section>
        )}

        {/* Upcoming */}
        {upcomingWorkouts.length > 0 && (
          <Section title="Upcoming" colors={colors}>
            {upcomingWorkouts.map(renderWorkoutCard)}
          </Section>
        )}

        {/* In Progress */}
        {inProgressWorkouts.length > 0 && (
          <Section title="In Progress" colors={colors}>
            {inProgressWorkouts.map(renderWorkoutCard)}
          </Section>
        )}

        {/* Completed */}
        {completedWorkouts.length > 0 && (
          <Section title="Recent" colors={colors}>
            {completedWorkouts.slice(0, 5).map(renderWorkoutCard)}
          </Section>
        )}

        {/* Deleted */}
        {deletedWorkouts.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity onPress={() => setShowDeleted(!showDeleted)} style={styles.deletedToggle}>
              <Trash2 size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginBottom: 0, marginLeft: 6 }]}>
                Deleted ({deletedWorkouts.length})
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginLeft: 6 }}>
                {showDeleted ? '(hide)' : '(show)'}
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
                    {' · '}{session.exercises.length} exercises
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.reinstateBtn, { backgroundColor: colors.primary + '15' }]}
                  onPress={() => handleReinstate(session.sessionId)}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '500', color: colors.primary, marginLeft: 4 }}>Reinstate</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Empty */}
        {workouts.length === 0 && deletedWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <Dumbbell size={48} color={colors.mutedForeground} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.foreground, marginTop: 16 }}>
              No workouts yet
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 4, maxWidth: 260 }}>
              Generate your first workout plan from the Dashboard tab.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Section({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  card: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '600' },
  progressBadge: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deletedToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  deletedCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14, marginBottom: 8, opacity: 0.6 },
  reinstateBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
});
