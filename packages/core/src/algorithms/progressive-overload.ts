import type { WorkoutSession, WorkoutExercise, PersonalRecord, ExerciseType } from '../types';

interface ProgressionResult {
  newWeight: number;
  reason: string;
  isPR: boolean;
}

const COMPOUND_INCREMENT = 5; // lbs
const ISOLATION_INCREMENT = 2.5; // lbs
const DELOAD_WEIGHT_REDUCTION = 0.2; // 20%
const DELOAD_VOLUME_REDUCTION = 0.4; // 40%
const FAILURE_WEIGHT_REDUCTION = 0.1; // 10%
const CONSECUTIVE_SUCCESS_THRESHOLD = 2;
const CONSECUTIVE_FAILURE_THRESHOLD = 2;
const DELOAD_EVERY_N_WEEKS = 4;

export function calculateProgression(
  exerciseId: string,
  exerciseType: ExerciseType,
  currentWeight: number,
  targetReps: number,
  recentSessions: WorkoutSession[],
): ProgressionResult {
  const exerciseHistory = recentSessions
    .filter(s => s.completed && !s.isDeload)
    .map(s => s.exercises.find(e => e.exerciseId === exerciseId))
    .filter((e): e is WorkoutExercise => e !== undefined)
    .slice(0, 5);

  if (exerciseHistory.length < CONSECUTIVE_SUCCESS_THRESHOLD) {
    return { newWeight: currentWeight, reason: 'Not enough history yet', isPR: false };
  }

  const recentTwo = exerciseHistory.slice(0, CONSECUTIVE_SUCCESS_THRESHOLD);
  const allSucceeded = recentTwo.every(exercise =>
    exercise.sets.every(set =>
      set.completed && (set.actualReps ?? 0) >= set.targetReps
    )
  );

  const allFailed = recentTwo.every(exercise =>
    exercise.sets.some(set =>
      set.completed && (set.actualReps ?? 0) < (set.targetReps - 2)
    )
  );

  const increment = exerciseType === 'compound' ? COMPOUND_INCREMENT : ISOLATION_INCREMENT;

  if (allSucceeded) {
    const newWeight = currentWeight + increment;
    return {
      newWeight,
      reason: `Hit all target reps for ${CONSECUTIVE_SUCCESS_THRESHOLD} sessions. Increasing by ${increment} lbs.`,
      isPR: true,
    };
  }

  if (allFailed) {
    const newWeight = Math.round((currentWeight * (1 - FAILURE_WEIGHT_REDUCTION)) / increment) * increment;
    return {
      newWeight,
      reason: `Missed minimum reps for ${CONSECUTIVE_FAILURE_THRESHOLD} sessions. Reducing by 10%.`,
      isPR: false,
    };
  }

  return { newWeight: currentWeight, reason: 'Keep current weight. Working toward target reps.', isPR: false };
}

export function shouldDeload(weekNumber: number): boolean {
  return weekNumber > 0 && weekNumber % DELOAD_EVERY_N_WEEKS === 0;
}

export function applyDeload(weight: number, sets: number): { weight: number; sets: number } {
  return {
    weight: Math.round(weight * (1 - DELOAD_WEIGHT_REDUCTION) / 5) * 5,
    sets: Math.max(2, Math.round(sets * (1 - DELOAD_VOLUME_REDUCTION))),
  };
}

export function checkPersonalRecord(
  exerciseId: string,
  weight: number,
  reps: number,
  existingPRs: PersonalRecord[],
): boolean {
  const exercisePRs = existingPRs.filter(pr => pr.exerciseId === exerciseId);
  if (exercisePRs.length === 0) return true;

  const newE1RM = weight * (36 / (37 - reps));
  const bestE1RM = Math.max(...exercisePRs.map(pr => pr.weight * (36 / (37 - pr.reps))));

  return newE1RM > bestE1RM;
}

export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps > 12) return weight * (1 + reps / 30);
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
}
