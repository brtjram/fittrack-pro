import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getWorkoutPlan } from '@/lib/data/workout-templates';
import { scheduleUpcomingWeek } from '@/lib/services/workout-plan-service';

export async function POST() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Complete your profile first.' }, { status: 400 });
  }

  if (!getWorkoutPlan(profile.preferredSplit)) {
    return NextResponse.json({ error: 'Unknown split.' }, { status: 400 });
  }

  const results = await scheduleUpcomingWeek(userId, profile);
  return NextResponse.json(results);
}
