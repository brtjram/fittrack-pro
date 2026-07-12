import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { calculateMacroTargets } from '@/lib/algorithms/macro-calculator';
import { toCalcUserProfile } from '@/lib/services/fitness-profile-adapter';
import { getRecentCoachMemories, formatCoachMemoriesForPrompt } from '@/lib/services/coach-memory-service';
import { parseExercises } from '@/lib/utils';

// One-call snapshot of everything an external LLM needs to coach this user:
// profile + current targets, recent workouts, recent nutrition, recent
// weight/activity (which is where Apple Health / MacroFactor imports land),
// and accumulated coaching memory. This is the primary read path for MCP
// clients so they don't need a dozen round trips to build context.
export async function GET() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const [profile, recentWorkouts, recentFoodLog, recentWeight, recentActivity, challenge, memories] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.workoutSession.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 }),
    prisma.foodLogEntry.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 50 }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 }),
    prisma.dailyActivity.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 14 }),
    prisma.transformationChallenge.findUnique({ where: { userId } }),
    getRecentCoachMemories(userId, 100),
  ]);

  if (!profile) {
    return NextResponse.json({ error: 'No fitness profile found for this user yet.' }, { status: 400 });
  }

  const macroTargets = calculateMacroTargets(toCalcUserProfile(profile));

  return NextResponse.json({
    profile,
    nutritionTargets: macroTargets,
    recentWorkouts: recentWorkouts.map((s) => ({ ...s, exercises: parseExercises(s.exercises) })),
    recentFoodLog,
    recentWeight,
    recentActivity,
    transformationChallenge: challenge,
    coachMemory: {
      entries: memories,
      formatted: formatCoachMemoriesForPrompt(memories),
    },
  });
}
