import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, Ellipsis, Play, Repeat, ChartLine,
  CircleCheckBig, Circle, Plus, ArrowRight,
} from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { Ring, Divider } from '../components/ui';
import * as api from '../services/api';
import type { WorkoutSession, WorkoutSet } from '@fittrack/core';

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WorkoutSessionScreen({ route, navigation }: { route: any; navigation: any }) {
  const { sessionId } = route.params as { sessionId: string };
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [previousSession, setPreviousSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    api.getWorkoutById(sessionId).then((s) => {
      if (s) {
        const firstIncomplete = s.exercises.findIndex((e) => !e.sets.every((set) => set.completed));
        setExerciseIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
      }
      setSession(s ?? null);
    }).finally(() => setLoading(false));
    api.getRecentWorkouts(30).then((list) => {
      const prior = list.find((w) => w.sessionId !== sessionId && w.completed);
      setPreviousSession(prior ?? null);
    });
  }, [sessionId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startTimeRef.current) / 60000)), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (restRemaining <= 0) return;
    const t = setInterval(() => setRestRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [restRemaining > 0]);

  const exercise = session?.exercises[exerciseIdx];

  const lastSetFor = useCallback((setNumber: number): WorkoutSet | undefined => {
    if (!exercise || !previousSession) return undefined;
    const priorEx = previousSession.exercises.find((e) => e.exerciseId === exercise.exerciseId);
    return priorEx?.sets.find((s) => s.setNumber === setNumber);
  }, [exercise, previousSession]);

  const persist = useCallback(async (updated: WorkoutSession) => {
    setSession(updated);
    await api.saveWorkout(updated);
  }, []);

  const updateSet = useCallback((setIdx: number, patch: Partial<WorkoutSet>) => {
    if (!session) return;
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => ei !== exerciseIdx ? ex : {
        ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, ...patch }),
      }),
    };
    persist(updated);
  }, [session, exerciseIdx, persist]);

  const toggleSet = useCallback((setIdx: number) => {
    if (!exercise) return;
    const set = exercise.sets[setIdx];
    const willComplete = !set.completed;
    updateSet(setIdx, { completed: willComplete });
    if (willComplete && exercise.restSeconds > 0) setRestRemaining(exercise.restSeconds);
  }, [exercise, updateSet]);

  const addSet = useCallback(() => {
    if (!session || !exercise) return;
    const last = exercise.sets[exercise.sets.length - 1];
    const newSet: WorkoutSet = {
      setNumber: exercise.sets.length + 1,
      targetReps: last?.targetReps ?? 10,
      targetWeight: last?.targetWeight ?? 0,
      completed: false,
    };
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => ei !== exerciseIdx ? ex : { ...ex, sets: [...ex.sets, newSet] }),
    };
    persist(updated);
  }, [session, exercise, exerciseIdx, persist]);

  const goToExercise = useCallback((idx: number) => {
    setExerciseIdx(idx);
    setRestRemaining(0);
  }, []);

  const finishWorkout = useCallback(async () => {
    if (!session) return;
    const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
    const finished = { ...session, completed: true, duration };
    await api.saveWorkout(finished);
    navigation.replace('WorkoutSummary', { sessionId: finished.sessionId });
  }, [session, navigation]);

  const notBuilt = (feature: string) => Alert.alert(feature, 'Not available yet — coming in a future update.');

  if (loading || !session || !exercise) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const isLast = exerciseIdx === session.exercises.length - 1;
  const allSetsComplete = exercise.sets.every((s) => s.completed);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>{session.name}</Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 1 }}>
            Exercise {exerciseIdx + 1} of {session.exercises.length} · {elapsed}:00
          </Text>
        </View>
        <TouchableOpacity onPress={() => notBuilt('Options')} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <Ellipsis size={18} color={colors.mutedStrong} />
        </TouchableOpacity>
      </View>

      {/* Exercise progress segments */}
      <View style={styles.segmentRow}>
        {session.exercises.map((ex, i) => (
          <TouchableOpacity key={i} style={{ flex: 1 }} onPress={() => goToExercise(i)}>
            <View style={[styles.segment, {
              backgroundColor: ex.sets.every((s) => s.completed) ? colors.progress : i === exerciseIdx ? colors.signal : colors.surfaceInset,
            }]} />
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 28, lineHeight: 32, color: colors.ink }}>{exercise.exerciseName}</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pill colors={colors} onPress={() => notBuilt('How to')} label="How to" icon={<Play size={9} color={colors.canvas} strokeWidth={3} />} highlight />
          <Pill colors={colors} onPress={() => notBuilt('Swap exercise')} label="Swap" icon={<Repeat size={13} color={colors.mutedStrong} />} />
          <Pill
            colors={colors}
            onPress={() => navigation.getParent()?.navigate('Progress', { screen: 'StrengthDetail', params: { exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName } })}
            label="History"
            icon={<ChartLine size={13} color={colors.mutedStrong} />}
          />
        </View>

        <View style={[styles.setTable, { backgroundColor: colors.surface }]}>
          <View style={[styles.setHeaderRow, { borderBottomColor: colors.hairline }]}>
            <Text style={[styles.setHeaderText, { color: colors.mutedForeground, width: 34 }]}>Set</Text>
            <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Weight</Text>
            <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Reps</Text>
            <View style={{ width: 44 }} />
          </View>
          {exercise.sets.map((set, si) => {
            const last = lastSetFor(set.setNumber);
            const isCurrent = !set.completed && exercise.sets.slice(0, si).every((s) => s.completed);
            return (
              <View
                key={si}
                style={[
                  styles.setRow,
                  si > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline },
                  isCurrent && { backgroundColor: colors.surfaceInset },
                ]}
              >
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: isCurrent ? colors.signal : colors.mutedForeground, width: 34, textAlign: 'center' }}>
                  {set.setNumber}
                </Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={set.actualWeight != null ? String(set.actualWeight) : ''}
                    onChangeText={(t) => updateSet(si, { actualWeight: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                    placeholder={String(set.targetWeight)}
                    placeholderTextColor={colors.mutedForeground}
                    style={{ fontFamily: Fonts.sansSemiBold, fontSize: isCurrent ? 24 : 16, color: colors.ink, padding: 0 }}
                  />
                  {last?.actualWeight != null && <Text style={{ fontFamily: Fonts.sans, fontSize: 10, color: colors.mutedForeground }}>last: {last.actualWeight}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={set.actualReps != null ? String(set.actualReps) : ''}
                    onChangeText={(t) => updateSet(si, { actualReps: parseInt(t) || 0 })}
                    keyboardType="numeric"
                    placeholder={String(set.targetReps)}
                    placeholderTextColor={colors.mutedForeground}
                    style={{ fontFamily: Fonts.sansSemiBold, fontSize: isCurrent ? 24 : 16, color: colors.ink, padding: 0 }}
                  />
                  {last?.actualReps != null && <Text style={{ fontFamily: Fonts.sans, fontSize: 10, color: colors.mutedForeground }}>last: {last.actualReps}</Text>}
                </View>
                <TouchableOpacity onPress={() => toggleSet(si)} style={{ width: 44, alignItems: 'flex-end' }}>
                  {set.completed
                    ? <CircleCheckBig size={isCurrent ? 44 : 24} color={colors.progress} />
                    : <Circle size={24} color={colors.surfaceInset} />}
                </TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity onPress={addSet} style={[styles.addSetBtn, { borderTopColor: colors.hairline }]}>
            <Plus size={14} color={colors.mutedForeground} />
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.mutedForeground }}>Add set</Text>
          </TouchableOpacity>
        </View>

        {restRemaining > 0 && (
          <View style={[styles.restCard, { backgroundColor: colors.surface }]}>
            <Ring size={36} stroke={3.5} percent={1 - restRemaining / exercise.restSeconds} trackColor={colors.trackMuted} fillColor={colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>Rest {fmtClock(restRemaining)}</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Tap when you're back on the bench</Text>
            </View>
            <TouchableOpacity onPress={() => setRestRemaining(0)}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.info }}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer nav */}
      <View style={[styles.footer, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairline }]}>
        <TouchableOpacity
          disabled={exerciseIdx === 0}
          onPress={() => goToExercise(exerciseIdx - 1)}
          style={[styles.footerBackBtn, { backgroundColor: colors.surfaceInset, opacity: exerciseIdx === 0 ? 0.4 : 1 }]}
        >
          <ChevronLeft size={22} color={colors.mutedStrong} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerNextBtn, { backgroundColor: isLast ? colors.signal : colors.ink }]}
          onPress={() => (isLast ? finishWorkout() : goToExercise(exerciseIdx + 1))}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: isLast ? colors.signalForeground : colors.canvas }}>
            {isLast ? (allSetsComplete ? 'Finish workout' : `${exercise.sets.filter((s) => s.completed).length}/${exercise.sets.length} sets done`) : `Next: ${session.exercises[exerciseIdx + 1].exerciseName}`}
          </Text>
          {isLast ? null : <ArrowRight size={18} color={colors.canvas} strokeWidth={2.5} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Pill({ colors, onPress, label, icon, highlight }: { colors: any; onPress: () => void; label: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pillBtn, { backgroundColor: colors.surfaceInset }]} activeOpacity={0.7}>
      {highlight ? <View style={[styles.pillIconWrap, { backgroundColor: colors.signal }]}>{icon}</View> : icon}
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: highlight ? colors.ink : colors.mutedStrong }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmentRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 20, marginTop: 16 },
  segment: { height: 3, borderRadius: 2 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99 },
  pillIconWrap: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  setTable: { marginTop: 24, borderRadius: 18, overflow: 'hidden' },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  setHeaderText: { fontFamily: Fonts.sansMedium, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, gap: 10 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderTopWidth: 1 },
  restCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, borderRadius: 16, padding: 15 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 30, borderTopWidth: 1 },
  footerBackBtn: { width: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerNextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
});
