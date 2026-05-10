import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { generateNextWorkout } from '@/lib/algorithms/workout-generator';
import { computeStepTarget } from '@/lib/algorithms/step-target';
import { toDateString } from '@/lib/utils';
import { getWeekNumber } from '@/lib/utils';
import type { UserProfile, WorkoutSession } from '@/types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

const SEED_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Bharath',
  age: 28,
  gender: 'male',
  heightCm: 178,
  currentWeightLbs: 185,
  targetWeightLbs: 175,
  activityLevel: 'moderate',
  goal: 'fat_loss',
  experienceLevel: 'intermediate',
  preferredSplit: 'upper_lower',
  trackCycle: false,
};

export async function POST() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  // 1. Upsert fitness profile
  const stepTarget = computeStepTarget(SEED_PROFILE.activityLevel, SEED_PROFILE.goal);
  await prisma.fitnessProfile.upsert({
    where: { userId },
    update: { ...SEED_PROFILE, stepTarget },
    create: { userId, ...SEED_PROFILE, stepTarget },
  });

  const profile: UserProfile = {
    ...SEED_PROFILE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 2. Clear existing test data to avoid duplicates
  await prisma.workoutSession.deleteMany({ where: { userId } });
  await prisma.foodLogEntry.deleteMany({ where: { userId } });
  await prisma.weightEntry.deleteMany({ where: { userId } });
  await prisma.dailyActivity.deleteMany({ where: { userId } });

  // 3. Generate 10 completed workout sessions over the past 3 weeks
  const completedSessions: WorkoutSession[] = [];
  const workoutDaysAgo = [21, 19, 17, 14, 12, 10, 7, 5, 3, 1];

  for (const daysBack of workoutDaysAgo) {
    const date = daysAgo(daysBack);
    const generated = generateNextWorkout(profile, completedSessions);
    generated.date = date;
    generated.completed = true;
    // Fill in realistic actual values for completed sets
    generated.exercises = generated.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        actualReps: s.targetReps,
        actualWeight: s.targetWeight,
        completed: true,
      })),
    }));

    await prisma.workoutSession.create({
      data: {
        userId,
        sessionId: generated.sessionId,
        date: generated.date,
        name: generated.name,
        splitDay: generated.splitDay,
        exercises: JSON.stringify(generated.exercises),
        completed: true,
        weekNumber: getWeekNumber(new Date(date + 'T00:00:00')),
        isDeload: generated.isDeload,
        rating: Math.floor(Math.random() * 3) + 7, // rating 7–9
        duration: 45 + Math.floor(Math.random() * 30),
      },
    });
    completedSessions.unshift(generated);
  }

  // 4. Generate today's workout (not yet completed)
  const todayWorkout = generateNextWorkout(profile, completedSessions);
  todayWorkout.date = toDateString();
  todayWorkout.completed = false;
  await prisma.workoutSession.create({
    data: {
      userId,
      sessionId: todayWorkout.sessionId,
      date: todayWorkout.date,
      name: todayWorkout.name,
      splitDay: todayWorkout.splitDay,
      exercises: JSON.stringify(todayWorkout.exercises),
      completed: false,
      weekNumber: getWeekNumber(new Date()),
      isDeload: todayWorkout.isDeload,
    },
  });

  // 5. Seed weight entries — gradual downward trend over 30 days
  const baseWeight = 187;
  for (let i = 30; i >= 0; i--) {
    if (i % 2 === 0) { // every other day
      const weight = +(baseWeight - (30 - i) * 0.07 + (Math.random() - 0.5) * 0.6).toFixed(1);
      await prisma.weightEntry.create({
        data: { userId, date: daysAgo(i), weightLbs: weight },
      });
    }
  }

  // 6. Seed daily activities — step counts for 14 days
  const stepBase = [8200, 11400, 6800, 9500, 7200, 12000, 5400, 10100, 8800, 7600, 9200, 11800, 6400, 8900];
  for (let i = 13; i >= 0; i--) {
    await prisma.dailyActivity.upsert({
      where: { userId_date: { userId, date: daysAgo(i) } },
      update: {},
      create: {
        userId,
        date: daysAgo(i),
        steps: stepBase[i] ?? 8000,
        activeCalories: Math.round((stepBase[i] ?? 8000) * 0.04),
        source: 'seed',
      },
    });
  }

  // 7. Seed food log — today and yesterday
  type SeedFood = { meal: string; foodName: string; calories: number; protein: number; carbs: number; fat: number; servings: number; servingSizeG: number };
  const todayFoods: SeedFood[] = [
    { meal: 'breakfast', foodName: 'Greek Yogurt', calories: 150, protein: 17, carbs: 9, fat: 4, servings: 1, servingSizeG: 170 },
    { meal: 'breakfast', foodName: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0, servings: 1, servingSizeG: 120 },
    { meal: 'lunch', foodName: 'Grilled Chicken Breast', calories: 280, protein: 53, carbs: 0, fat: 6, servings: 1, servingSizeG: 200 },
    { meal: 'lunch', foodName: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 2, servings: 1, servingSizeG: 195 },
    { meal: 'snack', foodName: 'Whey Protein Shake', calories: 130, protein: 25, carbs: 5, fat: 2, servings: 1, servingSizeG: 35 },
  ];
  for (const food of todayFoods) {
    await prisma.foodLogEntry.create({
      data: { userId, date: toDateString(), foodItemId: food.foodName.toLowerCase().replace(/ /g, '_'), ...food },
    });
  }

  const yesterdayFoods: SeedFood[] = [
    { meal: 'breakfast', foodName: 'Oatmeal', calories: 300, protein: 10, carbs: 54, fat: 6, servings: 1, servingSizeG: 240 },
    { meal: 'lunch', foodName: 'Turkey Sandwich', calories: 420, protein: 35, carbs: 48, fat: 12, servings: 1, servingSizeG: 280 },
    { meal: 'dinner', foodName: 'Salmon Fillet', calories: 350, protein: 40, carbs: 0, fat: 18, servings: 1, servingSizeG: 200 },
    { meal: 'dinner', foodName: 'Roasted Vegetables', calories: 120, protein: 4, carbs: 22, fat: 3, servings: 1, servingSizeG: 150 },
    { meal: 'snack', foodName: 'Almonds', calories: 160, protein: 6, carbs: 6, fat: 14, servings: 1, servingSizeG: 28 },
  ];
  for (const food of yesterdayFoods) {
    await prisma.foodLogEntry.create({
      data: { userId, date: daysAgo(1), foodItemId: food.foodName.toLowerCase().replace(/ /g, '_'), ...food },
    });
  }

  return NextResponse.json({
    ok: true,
    seeded: {
      profile: SEED_PROFILE.name,
      workouts: workoutDaysAgo.length + 1,
      weightEntries: 16,
      activityDays: 14,
      foodEntries: todayFoods.length + yesterdayFoods.length,
    },
  });
}

export async function DELETE() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  await Promise.all([
    prisma.workoutSession.deleteMany({ where: { userId } }),
    prisma.foodLogEntry.deleteMany({ where: { userId } }),
    prisma.weightEntry.deleteMany({ where: { userId } }),
    prisma.dailyActivity.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true, cleared: true });
}
