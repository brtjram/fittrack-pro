import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { generateNextWorkout, type CoachingNotes } from '@/lib/algorithms/workout-generator';
import { parseExercises } from '@/lib/utils';
import type { WorkoutSession } from '@/types';

export async function POST() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Complete your profile first.' }, { status: 400 });
  }

  // Fetch recent sessions and parse exercises JSON
  const raw = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 30,
  });

  const recentSessions: WorkoutSession[] = raw.map((s) => ({
    ...s,
    exercises: parseExercises(s.exercises),
  })) as unknown as WorkoutSession[];

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

  let coachingNotes: CoachingNotes | undefined;
  if (profile.coachingNotes) {
    try { coachingNotes = JSON.parse(profile.coachingNotes); } catch { /* ignore */ }
  }

  const generated = generateNextWorkout(userProfile, recentSessions, coachingNotes);

  // Save and return
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

  return NextResponse.json({
    ...saved,
    exercises: generated.exercises,
  });
}
