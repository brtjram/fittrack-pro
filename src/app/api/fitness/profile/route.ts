import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { computeStepTarget } from '@/lib/algorithms/step-target';

export async function GET() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
    return NextResponse.json(profile);
  } catch (e: unknown) {
    const err = e as Error & { code?: string; cause?: unknown };
    console.error('[profile GET] error:', err.message, 'code:', err.code, 'cause:', err.cause);
    return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, trackCycle, cycleLength, lastPeriodDate } = body;

  const stepTarget = computeStepTarget(activityLevel, goal);

  const profile = await prisma.fitnessProfile.upsert({
    where: { userId },
    update: {
      name, age, gender, heightCm, currentWeightLbs, targetWeightLbs,
      activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey,
      trackCycle, cycleLength, lastPeriodDate, stepTarget,
    },
    create: {
      userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs,
      activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey,
      trackCycle: trackCycle ?? false, cycleLength, lastPeriodDate, stepTarget,
    },
  });

  return NextResponse.json(profile);
}
