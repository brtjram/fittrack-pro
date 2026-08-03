import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, StyleSheet, Modal, FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, Play, Repeat, ChartLine,
  CircleCheckBig, Circle, Plus, X,
} from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { Ring, SwipeToDelete } from '../components/ui';
import * as api from '../services/api';
import { getExerciseById, getExercisesByMuscleGroup } from '@fittrack/core/data/exercises';
import type { WorkoutSession, WorkoutSet, Exercise } from '@fittrack/core';

// The mobile site (not www.youtube.com) is the one that renders usably
// inside a plain WebView — its player is a standard HTML5 <video>, where
// the desktop site's is not. Same undocumented-but-stable "Duration: under
// 4 minutes" filter as before, still the closest real filter to "shorts".
function howToSearchUrl(exerciseName: string): string {
  const q = encodeURIComponent(`${exerciseName} exercise form`);
  return `https://m.youtube.com/results?search_query=${q}&sp=EgIYAQ%3D%3D`;
}

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
  const [restRemaining, setRestRemaining] = useState(0);
  const [restExerciseIdx, setRestExerciseIdx] = useState<number | null>(null);
  const [swapExerciseIdx, setSwapExerciseIdx] = useState<number | null>(null);
  const [howToExercise, setHowToExercise] = useState<string | null>(null);
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    api.getWorkoutById(sessionId).then((s) => setSession(s ?? null)).finally(() => setLoading(false));
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

  const lastSetFor = useCallback((exercise: WorkoutSession['exercises'][number], setNumber: number): WorkoutSet | undefined => {
    if (!previousSession) return undefined;
    const priorEx = previousSession.exercises.find((e) => e.exerciseId === exercise.exerciseId);
    return priorEx?.sets.find((s) => s.setNumber === setNumber);
  }, [previousSession]);

  const persist = useCallback(async (updated: WorkoutSession) => {
    setSession(updated);
    await api.saveWorkout(updated);
  }, []);

  const updateSet = useCallback((exerciseIdx: number, setIdx: number, patch: Partial<WorkoutSet>) => {
    if (!session) return;
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => ei !== exerciseIdx ? ex : {
        ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, ...patch }),
      }),
    };
    persist(updated);
  }, [session, persist]);

  const toggleSet = useCallback((exerciseIdx: number, setIdx: number) => {
    if (!session) return;
    const exercise = session.exercises[exerciseIdx];
    const set = exercise.sets[setIdx];
    const willComplete = !set.completed;
    updateSet(exerciseIdx, setIdx, { completed: willComplete });
    if (willComplete && exercise.restSeconds > 0) {
      setRestExerciseIdx(exerciseIdx);
      setRestRemaining(exercise.restSeconds);
    }
  }, [session, updateSet]);

  const addSet = useCallback((exerciseIdx: number) => {
    if (!session) return;
    const exercise = session.exercises[exerciseIdx];
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
  }, [session, persist]);

  const deleteSet = useCallback((exerciseIdx: number, setIdx: number) => {
    if (!session) return;
    const exercise = session.exercises[exerciseIdx];
    if (exercise.sets.length <= 1) return;
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => {
        if (ei !== exerciseIdx) return ex;
        const newSets = ex.sets.filter((_, si) => si !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...ex, sets: newSets };
      }),
    };
    persist(updated);
  }, [session, persist]);

  const swapCandidates = useMemo((): Exercise[] => {
    if (swapExerciseIdx === null || !session) return [];
    const current = session.exercises[swapExerciseIdx];
    const currentDef = getExerciseById(current.exerciseId);
    if (!currentDef) return [];
    return getExercisesByMuscleGroup(currentDef.muscleGroup).filter((e) => e.id !== current.exerciseId);
  }, [swapExerciseIdx, session]);

  const performSwap = useCallback((replacement: Exercise) => {
    if (swapExerciseIdx === null || !session) return;
    const updated = {
      ...session,
      exercises: session.exercises.map((ex, ei) => ei !== swapExerciseIdx ? ex : {
        ...ex,
        exerciseId: replacement.id,
        exerciseName: replacement.name,
        // A different exercise invalidates prior actuals/completion — the
        // rep/weight targets carry over as a starting point, not the log.
        sets: ex.sets.map((s) => ({ ...s, actualReps: undefined, actualWeight: undefined, completed: false })),
      }),
    };
    persist(updated);
    setSwapExerciseIdx(null);
  }, [swapExerciseIdx, session, persist]);

  const finishWorkout = useCallback(async () => {
    if (!session) return;
    const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
    const finished = { ...session, completed: true, duration };
    await api.saveWorkout(finished);
    navigation.replace('WorkoutSummary', { sessionId: finished.sessionId });
  }, [session, navigation]);

  const confirmFinishAnyway = useCallback((remaining: number) => {
    Alert.alert(
      'Finish workout?',
      `You still have ${remaining} set${remaining === 1 ? '' : 's'} left. Finish anyway?`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish anyway', style: 'destructive', onPress: finishWorkout },
      ],
    );
  }, [finishWorkout]);

  if (loading || !session) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const allComplete = totalSets > 0 && doneSets === totalSets;
  const restingExercise = restRemaining > 0 && restExerciseIdx !== null ? session.exercises[restExerciseIdx] : null;

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
            {session.exercises.length} exercises · {elapsed}:00
          </Text>
        </View>
        {/* No overflow actions live here yet — a spacer keeps the title
            centered without a dead tap target. */}
        <View style={styles.circleBtn} />
      </View>

      {/* Overall progress */}
      <View style={[styles.overallCard, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.mutedForeground }}>
            Overall progress
          </Text>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{doneSets}/{totalSets} sets</Text>
        </View>
        <View style={[styles.overallTrack, { backgroundColor: colors.trackMuted }]}>
          <View style={[styles.overallFill, { backgroundColor: colors.progress, width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: 12 }}>
        {session.exercises.map((exercise, ei) => {
          const allSetsComplete = exercise.sets.every((s) => s.completed);
          return (
            <View key={ei} style={[styles.exCard, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 22, lineHeight: 26, color: colors.ink, flex: 1 }}>{exercise.exerciseName}</Text>
                {allSetsComplete && <CircleCheckBig size={18} color={colors.progress} style={{ marginTop: 4 }} />}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 4 }}>
                <Pill colors={colors} onPress={() => setHowToExercise(exercise.exerciseName)} label="How to" icon={<Play size={9} color={colors.canvas} strokeWidth={3} />} highlight />
                <Pill colors={colors} onPress={() => setSwapExerciseIdx(ei)} label="Swap" icon={<Repeat size={13} color={colors.mutedStrong} />} />
                <Pill
                  colors={colors}
                  // Progress is a sibling tab of Train, not a root-stack push — this
                  // screen sits inside TrainStack, so one level up (TrainStack ->
                  // MainTabs) reaches the tab navigator that has it.
                  onPress={() => navigation.getParent()?.navigate('Progress', { screen: 'StrengthDetail', params: { exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName } })}
                  label="History"
                  icon={<ChartLine size={13} color={colors.mutedStrong} />}
                />
              </View>

              <View style={[styles.setTable, { backgroundColor: colors.surfaceInset }]}>
                <View style={[styles.setHeaderRow, { borderBottomColor: colors.hairline }]}>
                  <Text style={[styles.setHeaderText, { color: colors.mutedForeground, width: 34 }]}>Set</Text>
                  <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Weight</Text>
                  <Text style={[styles.setHeaderText, { color: colors.mutedForeground, flex: 1 }]}>Reps</Text>
                  <View style={{ width: 36 }} />
                </View>
                {exercise.sets.map((set, si) => {
                  const last = lastSetFor(exercise, set.setNumber);
                  const isCurrent = !set.completed && exercise.sets.slice(0, si).every((s) => s.completed);
                  const canDelete = exercise.sets.length > 1;
                  return (
                    <SwipeToDelete
                      // Keying on the set count too (not just index) forces every
                      // row to remount after an add/delete — otherwise React
                      // reuses row instances by index and a swiped-open row's
                      // gesture state (and its now-stale `disabled` closure) can
                      // land on the wrong, unrelated row once the array shifts.
                      key={`${exercise.sets.length}-${si}`}
                      colors={colors}
                      disabled={!canDelete}
                      borderRadius={0}
                      onDelete={() => deleteSet(ei, si)}
                    >
                      <View
                        style={[
                          styles.setRow,
                          // SwipeToDelete always keeps its red delete layer mounted
                          // behind the row, only hidden because the row itself is
                          // opaque — a row with no background at all (every row
                          // that isn't the current one) let that layer show
                          // through permanently instead of just on a real swipe.
                          { backgroundColor: colors.surfaceInset },
                          si > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline },
                          isCurrent && { backgroundColor: colors.surface },
                        ]}
                      >
                        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: isCurrent ? colors.signal : colors.mutedForeground, width: 34, textAlign: 'center' }}>
                          {set.setNumber}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            value={set.actualWeight != null ? String(set.actualWeight) : ''}
                            onChangeText={(t) => updateSet(ei, si, { actualWeight: parseFloat(t) || 0 })}
                            keyboardType="numeric"
                            placeholder={String(set.targetWeight)}
                            placeholderTextColor={colors.mutedForeground}
                            style={{ fontFamily: Fonts.sansSemiBold, fontSize: isCurrent ? 23 : 17, color: colors.ink, padding: 0 }}
                          />
                          {last?.actualWeight != null && <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 2 }}>last: {last.actualWeight}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            value={set.actualReps != null ? String(set.actualReps) : ''}
                            onChangeText={(t) => updateSet(ei, si, { actualReps: parseInt(t) || 0 })}
                            keyboardType="numeric"
                            placeholder={String(set.targetReps)}
                            placeholderTextColor={colors.mutedForeground}
                            style={{ fontFamily: Fonts.sansSemiBold, fontSize: isCurrent ? 23 : 17, color: colors.ink, padding: 0 }}
                          />
                          {last?.actualReps != null && <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, marginTop: 2 }}>last: {last.actualReps}</Text>}
                        </View>
                        <TouchableOpacity onPress={() => toggleSet(ei, si)} style={{ width: 36, alignItems: 'center' }}>
                          {set.completed
                            ? <CircleCheckBig size={isCurrent ? 34 : 26} color={colors.progress} />
                            : <Circle size={26} color={colors.trackMuted} />}
                        </TouchableOpacity>
                      </View>
                    </SwipeToDelete>
                  );
                })}
                <TouchableOpacity onPress={() => addSet(ei)} style={[styles.addSetBtn, { borderTopColor: colors.hairline }]}>
                  <Plus size={14} color={colors.mutedForeground} />
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.mutedForeground }}>Add set</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer: rest timer takes over when active, otherwise finish/progress */}
      <View style={[styles.footer, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairline }]}>
        {restingExercise ? (
          <View style={styles.restRow}>
            <Ring size={36} stroke={3.5} percent={1 - restRemaining / restingExercise.restSeconds} trackColor={colors.trackMuted} fillColor={colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>Rest {fmtClock(restRemaining)}</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{restingExercise.exerciseName}</Text>
            </View>
            <TouchableOpacity onPress={() => setRestRemaining(0)}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.info }}>Skip</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <View style={[styles.progressChip, { backgroundColor: colors.surfaceInset }]}>
              <View style={[styles.progressChipTrack, { backgroundColor: colors.trackMuted }]}>
                <View style={[styles.progressChipFill, { backgroundColor: colors.progress, width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }]} />
              </View>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.mutedStrong }}>{doneSets}/{totalSets} sets</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.finishPill,
                {
                  backgroundColor: allComplete ? colors.signal : colors.surfaceInset,
                  borderColor: allComplete ? colors.signal : colors.mutedStrong,
                },
              ]}
              onPress={allComplete ? finishWorkout : () => confirmFinishAnyway(totalSets - doneSets)}
              activeOpacity={0.85}
            >
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: allComplete ? colors.signalForeground : colors.ink }}>
                {allComplete ? 'Finish workout' : 'Finish anyway'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={howToExercise !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHowToExercise(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={styles.modalGrabberRow}>
            <View style={[styles.modalGrabber, { backgroundColor: colors.faint }]} />
          </View>
          <View style={[styles.modalHeader, { borderBottomColor: colors.hairline }]}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink }} numberOfLines={1}>
              How to: {howToExercise}
            </Text>
            <TouchableOpacity onPress={() => setHowToExercise(null)}>
              <X size={20} color={colors.mutedStrong} />
            </TouchableOpacity>
          </View>
          {howToExercise && (
            <WebView
              source={{ uri: howToSearchUrl(howToExercise) }}
              style={{ flex: 1, backgroundColor: colors.canvas }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              startInLoadingState
              renderLoading={() => (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }]}>
                  <ActivityIndicator size="large" color={colors.signal} />
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={swapExerciseIdx !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSwapExerciseIdx(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={styles.modalGrabberRow}>
            <View style={[styles.modalGrabber, { backgroundColor: colors.faint }]} />
          </View>
          <View style={[styles.modalHeader, { borderBottomColor: colors.hairline }]}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink }}>
              Swap {swapExerciseIdx !== null ? session.exercises[swapExerciseIdx].exerciseName : ''}
            </Text>
            <TouchableOpacity onPress={() => setSwapExerciseIdx(null)}>
              <X size={20} color={colors.mutedStrong} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={swapCandidates}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.swapRow, { backgroundColor: colors.surface }]}
                activeOpacity={0.7}
                onPress={() => performSwap(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.ink }}>{item.name}</Text>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 2, textTransform: 'capitalize' }}>
                    {item.equipment} · {item.type}
                  </Text>
                </View>
                <Repeat size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>
                  No other exercises for this muscle group yet.
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
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
  overallCard: { marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 16 },
  overallTrack: { height: 5, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  overallFill: { height: '100%', borderRadius: 3 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99 },
  pillIconWrap: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  exCard: { borderRadius: 18, padding: 18, marginBottom: 14 },
  setTable: { marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
  setHeaderText: { fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderTopWidth: 1 },
  footer: { padding: 16, paddingBottom: 30, borderTopWidth: 1 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  progressChip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 13 },
  progressChipTrack: { width: 34, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressChipFill: { height: '100%', borderRadius: 2 },
  finishPill: { alignItems: 'center', justifyContent: 'center', borderRadius: 99, paddingVertical: 15, paddingHorizontal: 22, borderWidth: 1.5 },
  modalGrabberRow: { alignItems: 'center', paddingTop: 44, paddingBottom: 10 },
  modalGrabber: { width: 36, height: 5, borderRadius: 2.5 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 16 },
});
