import type { UserProfile, WorkoutSession, WorkoutExercise, WorkoutSet } from '@/types';
import { getWorkoutPlan, getNextWorkoutTemplate } from '@/lib/data/workout-templates';
import { getExerciseById } from '@/lib/data/exercises';
import { shouldDeload, applyDeload, calculateProgression } from './progressive-overload';
import { generateId, getWeekNumber } from '@/lib/utils';

export function generateNextWorkout(
  profile: UserProfile,
  recentSessions: WorkoutSession[],
): WorkoutSession {
  const plan = getWorkoutPlan(profile.preferredSplit);
  if (!plan) {
    throw new Error(`Unknown split: ${profile.preferredSplit}`);
  }

  // Determine which template to use next
  const lastSession = recentSessions.find(s => s.completed);
  const template = getNextWorkoutTemplate(profile.preferredSplit, lastSession?.splitDay);
  if (!template) {
    throw new Error('No workout template available');
  }

  const today = new Date();
  const weekNumber = getWeekNumber(today);
  const isDeload = shouldDeload(weekNumber);

  // Find the rating from the last completed session with the same split day
  const lastSameSplitRating = recentSessions
    .find(s => s.completed && s.splitDay === template.splitDay)
    ?.rating;

  const exercises: WorkoutExercise[] = template.exercises.map(templateExercise => {
    const exerciseInfo = getExerciseById(templateExercise.exerciseId);
    const exerciseType = exerciseInfo?.type ?? 'compound';

    // Find last weight used for this exercise
    let lastWeight = getLastWeight(templateExercise.exerciseId, recentSessions);

    // If no history, estimate starting weight based on experience
    if (lastWeight === 0) {
      lastWeight = estimateStartingWeight(templateExercise.exerciseId, profile.experienceLevel, profile.gender);
    }

    // Calculate progression (pass rating so algorithm can adjust intensity)
    const progression = calculateProgression(
      templateExercise.exerciseId,
      exerciseType,
      lastWeight,
      templateExercise.reps,
      recentSessions,
      lastSameSplitRating,
    );

    let targetWeight = progression.newWeight;
    let sets = templateExercise.sets;
    let reps = templateExercise.reps;

    // Apply deload if needed
    if (isDeload) {
      const deloaded = applyDeload(targetWeight, sets);
      targetWeight = deloaded.weight;
      sets = deloaded.sets;
    }

    // Adjust for fat loss goal: slightly higher reps, shorter rest
    let restSeconds = templateExercise.restSeconds;
    if (profile.goal === 'fat_loss') {
      reps = Math.min(reps + 2, 15);
      restSeconds = Math.max(restSeconds - 15, 45);
    }

    const workoutSets: WorkoutSet[] = Array.from({ length: sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: reps,
      targetWeight: targetWeight,
      completed: false,
    }));

    return {
      exerciseId: templateExercise.exerciseId,
      exerciseName: exerciseInfo?.name ?? templateExercise.exerciseId,
      sets: workoutSets,
      restSeconds,
      isSuperset: templateExercise.isSuperset,
      supersetWith: templateExercise.supersetWith,
    };
  });

  return {
    sessionId: generateId(),
    date: today.toISOString().split('T')[0],
    name: isDeload ? `${template.name} (Deload)` : template.name,
    splitDay: template.splitDay,
    exercises,
    completed: false,
    weekNumber,
    isDeload,
  };
}

function getLastWeight(exerciseId: string, sessions: WorkoutSession[]): number {
  for (const session of sessions) {
    const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
    if (exercise && exercise.sets.length > 0) {
      const completedSets = exercise.sets.filter(s => s.completed && s.actualWeight);
      if (completedSets.length > 0) {
        return completedSets[0].actualWeight!;
      }
      return exercise.sets[0].targetWeight;
    }
  }
  return 0;
}

function estimateStartingWeight(exerciseId: string, experience: string, gender: string): number {
  // Base weights for a beginner male (in lbs)
  const baseWeights: Record<string, number> = {
    'bench-press': 95, 'incline-bench': 75, 'db-bench-press': 30, 'incline-db-press': 25,
    'ohp': 55, 'db-shoulder-press': 20, 'arnold-press': 15,
    'squat': 95, 'front-squat': 65, 'goblet-squat': 25,
    'deadlift': 115, 'rdl': 85, 'db-rdl': 30,
    'barbell-row': 75, 'db-row': 30, 'pull-up': 0,
    'barbell-curl': 35, 'db-curl': 15, 'hammer-curl': 15,
    'tricep-pushdown': 30, 'overhead-extension': 20, 'skull-crusher': 35,
    'leg-press': 135, 'leg-curl': 45, 'leg-extension': 45,
    'hip-thrust': 95, 'standing-calf-raise': 65, 'seated-calf-raise': 45,
    'lateral-raise': 10, 'front-raise': 10, 'reverse-fly': 10, 'face-pull': 20,
    'cable-crossover': 20, 'cable-curl': 20, 'cable-row': 55, 'lat-pulldown': 65,
    'close-grip-bench': 65, 'rope-pushdown': 25, 'cable-kickback': 10,
    'pec-deck': 45, 'machine-chest-press': 55, 'machine-shoulder-press': 45,
    'machine-row': 55, 'straight-arm-pulldown': 30,
    'bulgarian-split': 20, 'lunge': 20, 'hack-squat': 90,
    'cable-pull-through': 30, 'cable-kickback-glute': 15, 'step-up': 15,
    'seated-leg-curl': 45, 'good-morning': 45, 'incline-curl': 12,
    'preacher-curl': 25, 'concentration-curl': 12, 'cable-lateral-raise': 10,
    'upright-row': 45, 't-bar-row': 55,
  };

  let weight = baseWeights[exerciseId] ?? 20;

  // Adjust for experience
  if (experience === 'intermediate') weight *= 1.5;
  if (experience === 'advanced') weight *= 2;

  // Adjust for gender
  if (gender === 'female') weight *= 0.6;

  return Math.round(weight / 5) * 5; // Round to nearest 5 lbs
}

export function generateWeekPlan(
  profile: UserProfile,
  recentSessions: WorkoutSession[],
): WorkoutSession[] {
  const plan = getWorkoutPlan(profile.preferredSplit);
  if (!plan) {
    throw new Error(`Unknown split: ${profile.preferredSplit}`);
  }

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  // Start from next Monday (or today if Monday)
  const monday = new Date(today);
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  monday.setDate(today.getDate() + daysUntilMonday);

  const weekNumber = getWeekNumber(monday);
  const isDeload = shouldDeload(weekNumber);
  const sessions: WorkoutSession[] = [];

  // Use all templates in the plan for the week
  let accumulated = [...recentSessions];
  for (let i = 0; i < plan.templates.length; i++) {
    const template = plan.templates[i];
    const sessionDate = new Date(monday);
    // Spread workouts across the week with rest days
    const dayOffsets3 = [0, 2, 4];
    const dayOffsets4 = [0, 1, 3, 4];
    if (plan.daysPerWeek <= 3) {
      sessionDate.setDate(monday.getDate() + (dayOffsets3[i] !== undefined ? dayOffsets3[i] : i * 2));
    } else if (plan.daysPerWeek <= 4) {
      sessionDate.setDate(monday.getDate() + (dayOffsets4[i] !== undefined ? dayOffsets4[i] : i));
    } else {
      sessionDate.setDate(monday.getDate() + i);
    }

    const exercises: WorkoutExercise[] = template.exercises.map(templateExercise => {
      const exerciseInfo = getExerciseById(templateExercise.exerciseId);
      const exerciseType = exerciseInfo?.type ?? 'compound';
      let lastWeight = getLastWeight(templateExercise.exerciseId, accumulated);
      if (lastWeight === 0) {
        lastWeight = estimateStartingWeight(templateExercise.exerciseId, profile.experienceLevel, profile.gender);
      }
      const progression = calculateProgression(
        templateExercise.exerciseId, exerciseType, lastWeight, templateExercise.reps, accumulated,
      );
      let targetWeight = progression.newWeight;
      let sets = templateExercise.sets;
      let reps = templateExercise.reps;
      if (isDeload) {
        const deloaded = applyDeload(targetWeight, sets);
        targetWeight = deloaded.weight;
        sets = deloaded.sets;
      }
      let restSeconds = templateExercise.restSeconds;
      if (profile.goal === 'fat_loss') {
        reps = Math.min(reps + 2, 15);
        restSeconds = Math.max(restSeconds - 15, 45);
      }
      const workoutSets: WorkoutSet[] = Array.from({ length: sets }, (_, j) => ({
        setNumber: j + 1, targetReps: reps, targetWeight, completed: false,
      }));
      return {
        exerciseId: templateExercise.exerciseId,
        exerciseName: exerciseInfo?.name ?? templateExercise.exerciseId,
        sets: workoutSets, restSeconds,
        isSuperset: templateExercise.isSuperset,
        supersetWith: templateExercise.supersetWith,
      };
    });

    const session: WorkoutSession = {
      sessionId: generateId(),
      date: sessionDate.toISOString().split('T')[0],
      name: isDeload ? `${template.name} (Deload)` : template.name,
      splitDay: template.splitDay,
      exercises,
      completed: false,
      weekNumber,
      isDeload,
    };
    sessions.push(session);
    accumulated = [session, ...accumulated];
  }

  return sessions;
}

export function getWorkoutSplitDescription(split: string): string {
  const descriptions: Record<string, string> = {
    ppl: 'Push/Pull/Legs - 6 days/week. High volume, great for intermediate+.',
    upper_lower: 'Upper/Lower - 4 days/week. Balanced frequency, good for all levels.',
    full_body: 'Full Body - 3 days/week. Efficient, great for beginners.',
    bro_split: 'Body Part Split - 5 days/week. Each muscle group once per week.',
  };
  return descriptions[split] ?? '';
}
