import { prisma } from '@/lib/prisma';
import { calculateMacroTargets } from '@/lib/algorithms/macro-calculator';
import { getWorkoutPlan } from '@/lib/data/workout-templates';
import { scheduleUpcomingWeek, scheduleCardioSessions, type CardioSessionInput } from './workout-plan-service';
import { toCalcUserProfile } from './fitness-profile-adapter';
import { addCoachMemory } from './coach-memory-service';
import type { FitnessProfile } from '@/generated/prisma/client';
import type { WorkoutSplit } from '@/types';

// Shared with src/lib/algorithms/workout-generator.ts's CoachingNotes shape.
export interface CoachingNotes {
  intensityModifier?: number;
  exerciseOverrides?: Record<string, { intensityModifier?: number; notes?: string }>;
  generalNotes?: string;
  lastUpdated?: string;
}

export function formatCoachingNotes(notes: CoachingNotes): string {
  const parts: string[] = [];
  if (notes.intensityModifier && notes.intensityModifier !== 1.0) {
    const pct = Math.round((notes.intensityModifier - 1) * 100);
    parts.push(`Overall intensity: ${pct > 0 ? '+' : ''}${pct}% on all lifts`);
  }
  if (notes.generalNotes) parts.push(notes.generalNotes);
  if (notes.exerciseOverrides) {
    for (const [exercise, override] of Object.entries(notes.exerciseOverrides)) {
      const parts2: string[] = [];
      if (override.intensityModifier && override.intensityModifier !== 1.0) {
        const pct = Math.round((override.intensityModifier - 1) * 100);
        parts2.push(`${pct > 0 ? '+' : ''}${pct}% load`);
      }
      if (override.notes) parts2.push(override.notes);
      if (parts2.length) parts.push(`${exercise}: ${parts2.join(', ')}`);
    }
  }
  return parts.join('\n- ');
}

export interface ActionResult {
  resultText: string;
  profile: FitnessProfile;
}

export async function saveCoachingInstructionsAction(
  userId: string,
  profile: FitnessProfile,
  input: {
    intensityModifier?: number;
    exerciseOverrides?: Record<string, { intensityModifier?: number; notes?: string }>;
    generalNotes?: string;
  },
): Promise<ActionResult> {
  let existing: CoachingNotes = {};
  if (profile.coachingNotes) {
    try { existing = JSON.parse(profile.coachingNotes); } catch { /* ignore */ }
  }

  const merged: CoachingNotes = {
    ...existing,
    ...(input.intensityModifier !== undefined && { intensityModifier: input.intensityModifier }),
    ...(input.generalNotes && { generalNotes: [existing.generalNotes, input.generalNotes].filter(Boolean).join('. ') }),
    exerciseOverrides: {
      ...existing.exerciseOverrides,
      ...input.exerciseOverrides,
    },
    lastUpdated: new Date().toISOString().split('T')[0],
  };

  await prisma.fitnessProfile.updateMany({
    where: { userId },
    data: { coachingNotes: JSON.stringify(merged) },
  });
  const updated = { ...profile, coachingNotes: JSON.stringify(merged) };

  await addCoachMemory(userId, {
    category: 'action',
    content: `Set training instructions: ${formatCoachingNotes(merged) || 'general update'}`,
  });

  return { resultText: 'Instructions saved successfully. These will now affect future workout generation.', profile: updated };
}

export async function scheduleWorkoutPlanAction(
  userId: string,
  profile: FitnessProfile,
  input: { split?: WorkoutSplit; stepTarget?: number; cardioSessions?: CardioSessionInput[] },
): Promise<ActionResult> {
  let current = profile;

  const profileUpdate: { preferredSplit?: WorkoutSplit; stepTarget?: number } = {};
  if (input.split && input.split !== current.preferredSplit && getWorkoutPlan(input.split)) {
    profileUpdate.preferredSplit = input.split;
  }
  if (input.stepTarget !== undefined) {
    profileUpdate.stepTarget = Math.round(input.stepTarget);
  }
  if (Object.keys(profileUpdate).length > 0) {
    await prisma.fitnessProfile.updateMany({ where: { userId }, data: profileUpdate });
    current = { ...current, ...profileUpdate };
  }

  if (!getWorkoutPlan(current.preferredSplit)) {
    return { resultText: `Could not schedule workouts: unknown split "${current.preferredSplit}".`, profile: current };
  }

  const sessions = await scheduleUpcomingWeek(userId, current);
  const cardioAdded = input.cardioSessions?.length
    ? await scheduleCardioSessions(userId, input.cardioSessions)
    : [];

  const memoryParts = [`Scheduled a week of ${current.preferredSplit} workouts (${sessions.length} sessions)`];
  if (profileUpdate.stepTarget !== undefined) memoryParts.push(`step target set to ${profileUpdate.stepTarget}/day`);
  if (cardioAdded.length > 0) memoryParts.push(`added ${cardioAdded.length} cardio session(s)`);
  await addCoachMemory(userId, { category: 'action', content: `${memoryParts.join('; ')}.` });

  const resultLines = [
    `Scheduled this week's workouts:`,
    `- ${sessions.map((s) => `${s.date}: ${s.name}`).join('\n- ')}`,
  ];
  if (cardioAdded.length > 0) {
    resultLines.push(`\nAdded cardio:\n- ${cardioAdded.map((c) => `${c.date}: ${c.name}`).join('\n- ')}`);
  }
  if (profileUpdate.stepTarget !== undefined) {
    resultLines.push(`\nDaily step target set to ${profileUpdate.stepTarget.toLocaleString()}.`);
  }

  return { resultText: resultLines.join('\n'), profile: current };
}

export async function setNutritionTargetsAction(
  userId: string,
  profile: FitnessProfile,
  input: { calories: number; protein?: number; carbs?: number; fat?: number; reason: string },
): Promise<ActionResult> {
  const baseMacros = calculateMacroTargets(toCalcUserProfile(profile));
  const protein = input.protein ?? baseMacros.protein;
  const proteinCalories = protein * 4;
  const remaining = input.calories - proteinCalories;
  const fat = input.fat ?? Math.max(Math.round((remaining * 0.25) / 9), 30);
  const carbs = input.carbs ?? Math.max(Math.round((remaining - fat * 9) / 4), 50);

  let previousCalories = baseMacros.calories;
  if (profile.nutritionTargetOverride) {
    try {
      const existingOverride = JSON.parse(profile.nutritionTargetOverride) as { calories?: number };
      if (typeof existingOverride.calories === 'number') previousCalories = existingOverride.calories;
    } catch { /* ignore */ }
  }

  const resolved = { calories: input.calories, protein, carbs, fat };
  const today = new Date().toISOString().split('T')[0];
  const overrideJson = JSON.stringify({ ...resolved, reason: input.reason, setAt: today });

  await prisma.fitnessProfile.updateMany({ where: { userId }, data: { nutritionTargetOverride: overrideJson } });
  const updated = { ...profile, nutritionTargetOverride: overrideJson };

  await prisma.nutritionAdjustment.create({
    data: { userId, date: today, previousCalories, newCalories: input.calories, reason: input.reason, weeklyWeightChange: 0 },
  });

  await addCoachMemory(userId, {
    category: 'action',
    content: `Set nutrition target: ${resolved.calories} kcal (${input.reason}), changed from ${previousCalories} kcal.`,
  });

  return {
    resultText: `Nutrition targets updated: ${resolved.calories} kcal, ${resolved.protein}g protein, ${resolved.carbs}g carbs, ${resolved.fat}g fat. These now override the auto-calculated targets everywhere in the app.`,
    profile: updated,
  };
}

export async function setAiCoachGoalAction(
  userId: string,
  profile: FitnessProfile,
  input: { goalDescription: string },
): Promise<ActionResult> {
  await prisma.fitnessProfile.updateMany({
    where: { userId },
    data: { goal: 'ai_coach', aiCoachGoal: input.goalDescription },
  });
  const updated = { ...profile, goal: 'ai_coach', aiCoachGoal: input.goalDescription };

  await addCoachMemory(userId, {
    category: 'action',
    content: `Switched to AI Coach Mode with goal: "${input.goalDescription}"`,
  });

  return {
    resultText: `AI Coach Mode enabled with goal: "${input.goalDescription}". Now set concrete nutrition and workout targets for it with set_nutrition_targets and schedule_workout_plan.`,
    profile: updated,
  };
}

export async function rememberInsightAction(
  userId: string,
  input: { category: 'insight' | 'preference' | 'constraint' | 'outcome'; content: string },
): Promise<{ resultText: string }> {
  await addCoachMemory(userId, {
    category: input.category,
    content: input.content,
    pinned: input.category === 'constraint',
  });
  return { resultText: 'Noted — this will inform coaching in future sessions too.' };
}
