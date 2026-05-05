import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet,
} from 'react-native';
import { CheckCircle, Circle, Clock, Dumbbell } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import type { WorkoutSession, WorkoutSet } from '@fittrack/core';

export function WorkoutDetailScreen({ route }: { route: any }) {
  const { sessionId } = route.params as { sessionId: string };
  const { colors } = useTheme();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWorkoutById(sessionId).then((s) => {
      setSession(s ?? null);
      setLoading(false);
    });
  }, [sessionId]);

  const toggleSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    if (!session) return;
    const updated = { ...session, exercises: session.exercises.map((ex, ei) => {
      if (ei !== exerciseIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, si) => {
        if (si !== setIdx) return s;
        return { ...s, completed: !s.completed };
      }) };
    }) };

    // Check if all exercises completed
    const allDone = updated.exercises.every((ex) => ex.sets.every((s) => s.completed));
    if (allDone) updated.completed = true;

    setSession(updated);
    await api.saveWorkout(updated);
  }, [session]);

  const updateSetValue = useCallback(async (exerciseIdx: number, setIdx: number, field: keyof WorkoutSet, value: number) => {
    if (!session) return;
    const updated = { ...session, exercises: session.exercises.map((ex, ei) => {
      if (ei !== exerciseIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, si) => {
        if (si !== setIdx) return s;
        return { ...s, [field]: value };
      }) };
    }) };
    setSession(updated);
    await api.saveWorkout(updated);
  }, [session]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Dumbbell size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Workout not found</Text>
      </View>
    );
  }

  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const completedSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header Info */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sessionName, { color: colors.foreground }]}>{session.name}</Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>
          {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, {
            backgroundColor: session.completed ? colors.success : colors.primary,
            width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
          }]} />
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 6 }}>
          {completedSets}/{totalSets} sets completed
        </Text>
      </View>

      {/* Exercises */}
      <View style={styles.exerciseList}>
        {session.exercises.map((exercise, ei) => {
          const allSetsComplete = exercise.sets.every((s) => s.completed);
          return (
            <View key={ei} style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.exerciseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exerciseName, { color: colors.foreground }]}>{exercise.exerciseName}</Text>
                  {exercise.notes ? (
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{exercise.notes}</Text>
                  ) : null}
                </View>
                {allSetsComplete ? (
                  <CheckCircle size={20} color={colors.success} />
                ) : (
                  <Clock size={16} color={colors.mutedForeground} />
                )}
              </View>

              {/* Set Headers */}
              <View style={styles.setHeaderRow}>
                <Text style={[styles.setHeaderText, { color: colors.mutedForeground, width: 36 }]}>Set</Text>
                <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Weight</Text>
                <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Reps</Text>
                <View style={{ width: 36 }} />
              </View>

              {/* Sets */}
              {exercise.sets.map((set, si) => (
                <View key={si} style={[styles.setRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.setNumber, { color: colors.mutedForeground }]}>{si + 1}</Text>
                  <TextInput
                    style={[styles.setInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={set.actualWeight != null ? String(set.actualWeight) : ''}
                    onChangeText={(t) => updateSetValue(ei, si, 'actualWeight', parseFloat(t) || 0)}
                    keyboardType="numeric"
                    placeholder={String(set.targetWeight)}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={[styles.setInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={set.actualReps != null ? String(set.actualReps) : ''}
                    onChangeText={(t) => updateSetValue(ei, si, 'actualReps', parseInt(t) || 0)}
                    keyboardType="numeric"
                    placeholder={String(set.targetReps)}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TouchableOpacity
                    style={{ width: 36, alignItems: 'center' }}
                    onPress={() => toggleSet(ei, si)}
                    activeOpacity={0.6}
                  >
                    {set.completed ? (
                      <CheckCircle size={22} color={colors.success} />
                    ) : (
                      <Circle size={22} color={colors.border} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { margin: 16, borderWidth: 1, borderRadius: 12, padding: 16 },
  sessionName: { fontSize: 20, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  exerciseList: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  exerciseCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  exerciseName: { fontSize: 15, fontWeight: '600' },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  setHeaderText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, gap: 8 },
  setNumber: { width: 36, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  setInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, textAlign: 'center' },
});
