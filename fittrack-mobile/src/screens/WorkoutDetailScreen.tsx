import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet,
  Animated, PanResponder,
} from 'react-native';
import { CheckCircle, Circle, Clock, Dumbbell, Trash2, Star } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import type { WorkoutSession, WorkoutSet } from '@fittrack/core';

type Phase = 'workout' | 'rating' | 'done';

const SWIPE_WIDTH = 72;
const SWIPE_THRESHOLD = -50;

// ─── Swipeable set row ──────────────────────────────────────────────────────
function SwipeableSetRow({ onDelete, colors, children }: {
  onDelete: () => void;
  colors: any;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        translateX.setValue(Math.max(Math.min(g.dx + (isOpen.current ? -SWIPE_WIDTH : 0), 0), -SWIPE_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        const velocity = g.vx;
        const dx = g.dx + (isOpen.current ? -SWIPE_WIDTH : 0);
        const shouldOpen = dx < SWIPE_THRESHOLD || velocity < -0.5;
        isOpen.current = shouldOpen;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -SWIPE_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  const close = useCallback(() => {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }, [translateX]);

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Delete button underneath */}
      <View style={[styles.deleteUnderlayer, { backgroundColor: colors.destructive }]}>
        <TouchableOpacity
          style={styles.deleteUnderlayerBtn}
          onPress={() => { close(); onDelete(); }}
          activeOpacity={0.8}
        >
          <Trash2 size={18} color="#fff" />
          <Text style={styles.deleteUnderlayerText}>Delete</Text>
        </TouchableOpacity>
      </View>
      {/* Row */}
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Rating button ──────────────────────────────────────────────────────────
function RatingButton({ value, selected, onPress, colors }: {
  value: number; selected: boolean; onPress: () => void; colors: any;
}) {
  const bg = value <= 4 ? '#ef4444' : value <= 6 ? '#f97316' : value <= 8 ? '#22c55e' : '#a855f7';
  return (
    <TouchableOpacity
      style={[styles.ratingBtn, { backgroundColor: selected ? bg : colors.card, borderColor: selected ? bg : colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.ratingBtnText, { color: selected ? '#fff' : colors.foreground }]}>{value}</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export function WorkoutDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { sessionId } = route.params as { sessionId: string };
  const { colors, isDark } = useTheme();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('workout');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    api.getWorkoutById(sessionId).then((s) => {
      setSession(s ?? null);
      if (s?.completed) setPhase('done');
      setLoading(false);
    });
  }, [sessionId]);

  const toggleSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    if (!session) return;
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => {
        if (ei !== exerciseIdx) return ex;
        return {
          ...ex, sets: ex.sets.map((s, si) => {
            if (si !== setIdx) return s;
            return { ...s, completed: !s.completed };
          }),
        };
      }),
    };
    setSession(updated);
    await api.saveWorkout(updated);
  }, [session]);

  const updateSetValue = useCallback(async (exerciseIdx: number, setIdx: number, field: keyof WorkoutSet, value: number) => {
    if (!session) return;
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => {
        if (ei !== exerciseIdx) return ex;
        return { ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value }) };
      }),
    };
    setSession(updated);
    await api.saveWorkout(updated);
  }, [session]);

  const deleteSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    if (!session) return;
    const updated = {
      ...session,
      exercises: session.exercises
        .map((ex, ei) => {
          if (ei !== exerciseIdx) return ex;
          const newSets = ex.sets
            .filter((_, si) => si !== setIdx)
            .map((s, i) => ({ ...s, setNumber: i + 1 }));
          return { ...ex, sets: newSets };
        })
        .filter((ex) => ex.sets.length > 0),
    };
    setSession(updated);
    await api.saveWorkout(updated);
  }, [session]);

  const handleFinish = useCallback(async () => {
    if (!session) return;
    setSaving(true);
    const duration = Math.round((Date.now() - startTimeRef.current) / 60000);
    const finished = { ...session, completed: true, duration };
    setSession(finished);
    await api.saveWorkout(finished);
    setSaving(false);
    setPhase('rating');
  }, [session]);

  const handleRate = useCallback(async (r: number) => {
    if (!session) return;
    setSelectedRating(r);
    const rated = { ...session, rating: r };
    setSession(rated);
    await api.saveWorkout(rated);
    setPhase('done');
  }, [session]);

  // ─── Loading ──────────────────────────────────────────────────────────────
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
  const allDone = totalSets > 0 && completedSets === totalSets;
  const durationMins = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));

  // ─── Rating phase ─────────────────────────────────────────────────────────
  if (phase === 'rating') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: 24 }]}>
        <Star size={40} color={colors.primary} />
        <Text style={[styles.ratingTitle, { color: colors.foreground }]}>How was your workout?</Text>
        <Text style={[styles.ratingSubtitle, { color: colors.mutedForeground }]}>{session.name}</Text>

        <View style={[styles.durationBadge, { backgroundColor: colors.primary + '15' }]}>
          <Clock size={14} color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.primary, marginLeft: 6, fontWeight: '600' }}>
            {durationMins} min
          </Text>
        </View>

        <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>Rate 1–10</Text>
        <View style={styles.ratingGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
            <RatingButton
              key={r}
              value={r}
              selected={selectedRating === r}
              onPress={() => handleRate(r)}
              colors={colors}
            />
          ))}
        </View>

        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 16, textAlign: 'center', lineHeight: 16 }}>
          Your rating helps adapt your next workout intensity
        </Text>
      </View>
    );
  }

  // ─── Done phase ───────────────────────────────────────────────────────────
  if (phase === 'done') {
    const r = session.rating ?? selectedRating;
    const ratingColor = !r ? colors.primary : r <= 4 ? '#ef4444' : r <= 6 ? '#f97316' : r <= 8 ? '#22c55e' : '#a855f7';
    const intensityNote = !r ? '' :
      r <= 7 ? 'Your next session will be slightly more challenging.' :
      r <= 8 ? 'Intensity maintained — you\'re in the sweet spot.' :
      'Great effort! We\'ll monitor for a deload if this continues.';

    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 24, alignItems: 'center' }}>
          <View style={[styles.doneCheck, { backgroundColor: colors.success + '20' }]}>
            <CheckCircle size={40} color={colors.success} />
          </View>
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>Workout Complete!</Text>
          <Text style={[styles.doneSubtitle, { color: colors.mutedForeground }]}>{session.name}</Text>

          <View style={styles.doneBadges}>
            <View style={[styles.doneBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Clock size={16} color={colors.primary} />
              <Text style={[styles.doneBadgeValue, { color: colors.foreground }]}>{session.duration ?? durationMins}</Text>
              <Text style={[styles.doneBadgeLabel, { color: colors.mutedForeground }]}>min</Text>
            </View>
            <View style={[styles.doneBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Dumbbell size={16} color={colors.primary} />
              <Text style={[styles.doneBadgeValue, { color: colors.foreground }]}>{session.exercises.length}</Text>
              <Text style={[styles.doneBadgeLabel, { color: colors.mutedForeground }]}>exercises</Text>
            </View>
            {r && (
              <View style={[styles.doneBadge, { backgroundColor: ratingColor + '15', borderColor: ratingColor + '40' }]}>
                <Star size={16} color={ratingColor} />
                <Text style={[styles.doneBadgeValue, { color: ratingColor }]}>{r}/10</Text>
                <Text style={[styles.doneBadgeLabel, { color: ratingColor }]}>rating</Text>
              </View>
            )}
          </View>

          {intensityNote ? (
            <View style={[styles.intensityNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18 }}>
                {intensityNote}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('WorkoutsList')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primaryForeground }}>Back to Workouts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─── Workout phase ────────────────────────────────────────────────────────
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sessionName, { color: colors.foreground }]}>{session.name}</Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>
          {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, {
            backgroundColor: allDone ? colors.success : colors.primary,
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
                {allSetsComplete
                  ? <CheckCircle size={20} color={colors.success} />
                  : <Clock size={16} color={colors.mutedForeground} />}
              </View>

              <View style={styles.setHeaderRow}>
                <Text style={[styles.setHeaderText, { color: colors.mutedForeground, width: 36 }]}>Set</Text>
                <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Weight</Text>
                <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Reps</Text>
                <View style={{ width: 36 }} />
              </View>

              {exercise.sets.map((set, si) => (
                <SwipeableSetRow
                  key={`${ei}-${si}`}
                  colors={colors}
                  onDelete={() => deleteSet(ei, si)}
                >
                  <View style={[styles.setRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
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
                      {set.completed
                        ? <CheckCircle size={22} color={colors.success} />
                        : <Circle size={22} color={colors.border} />}
                    </TouchableOpacity>
                  </View>
                </SwipeableSetRow>
              ))}
            </View>
          );
        })}
      </View>

      {/* Finish button */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 40, marginTop: 8 }}>
        <TouchableOpacity
          style={[
            styles.finishBtn,
            { backgroundColor: allDone ? colors.success : colors.primary },
            (!allDone) && { opacity: 0.5 },
          ]}
          onPress={handleFinish}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontSize: 16, fontWeight: '700', color: allDone ? '#fff' : colors.primaryForeground }}>
                {allDone ? 'Finish Workout' : `${completedSets}/${totalSets} Sets Done`}
              </Text>}
        </TouchableOpacity>
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
  exerciseList: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  exerciseCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  exerciseName: { fontSize: 15, fontWeight: '600' },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 6 },
  setHeaderText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, gap: 8 },
  setNumber: { width: 36, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  setInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, textAlign: 'center' },
  deleteUnderlayer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: SWIPE_WIDTH, alignItems: 'center', justifyContent: 'center' },
  deleteUnderlayerBtn: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  deleteUnderlayerText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  finishBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  // Rating
  ratingTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  ratingSubtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  durationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 16 },
  ratingLabel: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  ratingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 300 },
  ratingBtn: { width: 52, height: 52, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ratingBtnText: { fontSize: 18, fontWeight: '700' },
  // Done
  doneCheck: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  doneSubtitle: { fontSize: 14, marginTop: 4 },
  doneBadges: { flexDirection: 'row', gap: 12, marginTop: 24 },
  doneBadge: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  doneBadgeValue: { fontSize: 20, fontWeight: '700' },
  doneBadgeLabel: { fontSize: 11, fontWeight: '500' },
  intensityNote: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 20, width: '100%' },
  doneBtn: { marginTop: 24, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center' },
});
