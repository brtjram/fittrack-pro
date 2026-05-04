import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import {
  sendWorkoutReminder,
  sendNutritionReminder,
  sendWeightReminder,
  sendStepReminder,
} from '@/lib/push-notifications';
import { prisma } from '@/lib/prisma';

// Trigger a notification for the authenticated user (useful for testing + scheduled jobs)
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { type, meal } = body;

  switch (type) {
    case 'workout_reminder':
      await sendWorkoutReminder(userId);
      break;
    case 'nutrition_reminder':
      await sendNutritionReminder(userId, meal || 'Meal');
      break;
    case 'weight_reminder':
      await sendWeightReminder(userId);
      break;
    case 'step_reminder': {
      const today = new Date().toISOString().split('T')[0];
      const [activity, profile] = await Promise.all([
        prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: today } } }),
        prisma.fitnessProfile.findUnique({ where: { userId } }),
      ]);
      const steps = activity?.steps ?? 0;
      const target = profile?.stepTarget ?? 10000;
      await sendStepReminder(userId, steps, target);
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, type });
}
