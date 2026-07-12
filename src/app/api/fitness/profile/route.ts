import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { computeStepTarget } from '@/lib/algorithms/step-target';

export async function GET() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, trackCycle, cycleLength, lastPeriodDate, aiCoachGoal } = body;

  // In AI Coach Mode, stepTarget is the coach's call (set via schedule_workout_plan)
  // — don't clobber it with the generic activity/goal formula on every save.
  const stepTarget = computeStepTarget(activityLevel, goal);

  const profile = await prisma.fitnessProfile.upsert({
    where: { userId },
    update: {
      name, age, gender, heightCm, currentWeightLbs, targetWeightLbs,
      activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey,
      trackCycle, cycleLength, lastPeriodDate,
      ...(goal === 'ai_coach' ? { aiCoachGoal } : { stepTarget }),
    },
    create: {
      userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs,
      activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey,
      trackCycle: trackCycle ?? false, cycleLength, lastPeriodDate, stepTarget,
      aiCoachGoal: goal === 'ai_coach' ? aiCoachGoal : undefined,
    },
  });

  return NextResponse.json(profile);
}
