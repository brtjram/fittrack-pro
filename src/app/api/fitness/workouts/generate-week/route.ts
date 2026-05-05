import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { generateNextWorkout } from '@/lib/algorithms/workout-generator';
import { getWorkoutPlan } from '@/lib/data/workout-templates';
import type { WorkoutSession } from '@/types';

// Training day offsets from Monday for each split (0=Mon, 1=Tue, …, 6=Sun)
const SPLIT_DAY_OFFSETS: Record<string, number[]> = {
  ppl:         [0, 1, 2, 3, 4, 5],   // Mon–Sat
  upper_lower: [0, 1, 3, 4],          // Mon, Tue, Thu, Fri
  full_body:   [0, 2, 4],             // Mon, Wed, Fri
  bro_split:   [0, 1, 2, 3, 4],       // Mon–Fri
};

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function POST() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Complete your profile first.' }, { status: 400 });
  }

  const split = profile.preferredSplit;
  const plan = getWorkoutPlan(split);
  if (!plan) {
    return NextResponse.json({ error: 'Unknown split.' }, { status: 400 });
  }

  // Build week dates for this split
  const monday = getMondayOfWeek(new Date());
  const offsets = SPLIT_DAY_OFFSETS[split] ?? [0, 2, 4];
  const weekDates = offsets.map((offset) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return toDateString(d);
  });

  // Fetch existing sessions this week (skip dates that already have one)
  const existingThisWeek = await prisma.workoutSession.findMany({
    where: { userId, date: { in: weekDates } },
  });
  const existingDates = new Set(existingThisWeek.map((s) => s.date));

  // Load recent sessions for progression context
  const rawRecent = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 30,
  });

  const userProfile = {
    name: profile.name,
    age: profile.age,
    gender: profile.gender as 'male' | 'female',
    heightCm: profile.heightCm,
    currentWeightLbs: profile.currentWeightLbs,
    targetWeightLbs: profile.targetWeightLbs,
    activityLevel: profile.activityLevel as import('@/types').ActivityLevel,
    goal: profile.goal as import('@/types').Goal,
    experienceLevel: profile.experienceLevel as import('@/types').ExperienceLevel,
    preferredSplit: profile.preferredSplit as import('@/types').WorkoutSplit,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };

  // Running session list grows as we generate each workout so chaining works correctly
  let runningSessions: WorkoutSession[] = rawRecent.map((s) => ({
    ...s,
    exercises: typeof s.exercises === 'string' ? JSON.parse(s.exercises) : s.exercises,
  })) as unknown as WorkoutSession[];

  // Deduplicate existing sessions by date (keep only one per date)
  const seenDates = new Set<string>();
  const results: (typeof rawRecent[0] & { exercises: unknown })[] = existingThisWeek
    .filter((s) => { if (seenDates.has(s.date)) return false; seenDates.add(s.date); return true; })
    .map((s) => ({ ...s, exercises: typeof s.exercises === 'string' ? JSON.parse(s.exercises) : s.exercises }));

  for (const date of weekDates) {
    if (existingDates.has(date)) continue;

    const generated = generateNextWorkout(userProfile, runningSessions);
    generated.date = date;

    const saved = await prisma.workoutSession.create({
      data: {
        userId,
        sessionId: generated.sessionId,
        date: generated.date,
        name: generated.name,
        splitDay: generated.splitDay,
        exercises: JSON.stringify(generated.exercises),
        completed: false,
        weekNumber: generated.weekNumber,
        isDeload: generated.isDeload,
      },
    });

    results.push({ ...saved, exercises: generated.exercises });

    // Mark completed=true for chaining — generateNextWorkout only reads completed sessions
    // to determine the last splitDay. The DB record stays completed: false.
    runningSessions = [
      { ...generated, completed: true } as WorkoutSession,
      ...runningSessions,
    ];
  }

  // Return sorted by date
  results.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json(results);
}
