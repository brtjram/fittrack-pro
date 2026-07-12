import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  saveCoachingInstructionsAction,
  scheduleWorkoutPlanAction,
  setNutritionTargetsAction,
  setAiCoachGoalAction,
  rememberInsightAction,
} from '@/lib/services/coach-actions-service';
import type { WorkoutSplit } from '@/types';

// The same coaching actions the in-app AI coach chat can take (save training
// instructions, schedule workouts, set nutrition targets, enable AI Coach
// Mode, and write to long-term coaching memory), exposed directly so any
// MCP-connected LLM can act on a user's FitTrack Pro data itself instead of
// only reading it.
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'Missing "action" field.' }, { status: 400 });
  }

  const { action, input } = body as { action: string; input?: Record<string, unknown> };

  if (action === 'remember_insight') {
    const result = await rememberInsightAction(userId, input as { category: 'insight' | 'preference' | 'constraint' | 'outcome'; content: string });
    return NextResponse.json(result);
  }

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: 'No fitness profile found for this user yet.' }, { status: 400 });
  }

  switch (action) {
    case 'save_coaching_instructions': {
      const result = await saveCoachingInstructionsAction(userId, profile, input as {
        intensityModifier?: number;
        exerciseOverrides?: Record<string, { intensityModifier?: number; notes?: string }>;
        generalNotes?: string;
      });
      return NextResponse.json({ resultText: result.resultText, profile: result.profile });
    }
    case 'schedule_workout_plan': {
      const result = await scheduleWorkoutPlanAction(userId, profile, input as {
        split?: WorkoutSplit;
        stepTarget?: number;
        cardioSessions?: { dayOffset: number; name: string; durationMinutes?: number; notes?: string }[];
      });
      return NextResponse.json({ resultText: result.resultText, profile: result.profile });
    }
    case 'set_nutrition_targets': {
      const result = await setNutritionTargetsAction(userId, profile, input as { calories: number; protein?: number; carbs?: number; fat?: number; reason: string });
      return NextResponse.json({ resultText: result.resultText, profile: result.profile });
    }
    case 'set_ai_coach_goal': {
      const result = await setAiCoachGoalAction(userId, profile, input as { goalDescription: string });
      return NextResponse.json({ resultText: result.resultText, profile: result.profile });
    }
    default:
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  }
}
