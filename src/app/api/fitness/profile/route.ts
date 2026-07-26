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
  const { name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, trackCycle, cycleLength, lastPeriodDate, aiCoachGoal, weightUnit, heightUnit, energyUnit, weekStartsOn, trainingDays, sessionLengthMin, nutritionTargetOverride } = body;

  // In AI Coach Mode / the Transformation Challenge, stepTarget is set by the
  // coach/current phase (via schedule_workout_plan / applyTransformationChallengePhaseAction)
  // — don't clobber it with the generic activity/goal formula on every save.
  const ownsStepTarget = goal === 'ai_coach' || goal === 'challenge';
  const stepTarget = computeStepTarget(activityLevel, goal);

  const profile = await prisma.fitnessProfile.upsert({
    where: { userId },
    update: {
      name, age, gender, heightCm, currentWeightLbs, targetWeightLbs,
      activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey,
      trackCycle, cycleLength, lastPeriodDate, nutritionTargetOverride,
      weightUnit, heightUnit, energyUnit, weekStartsOn, trainingDays, sessionLengthMin,
      ...(goal === 'ai_coach' && { aiCoachGoal }),
      ...(!ownsStepTarget && { stepTarget }),
    },
    create: {
      userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs,
      activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey,
      trackCycle: trackCycle ?? false, cycleLength, lastPeriodDate, stepTarget,
      nutritionTargetOverride,
      aiCoachGoal: goal === 'ai_coach' ? aiCoachGoal : undefined,
      weightUnit: weightUnit ?? 'lb', heightUnit: heightUnit ?? 'cm',
      energyUnit: energyUnit ?? 'kcal', weekStartsOn: weekStartsOn ?? 'mon',
      trainingDays: trainingDays ?? '1,2,4,5,6', sessionLengthMin: sessionLengthMin ?? 60,
    },
  });

  return NextResponse.json(profile);
}
