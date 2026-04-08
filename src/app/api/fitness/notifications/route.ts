import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import {
  sendWorkoutReminder,
  sendNutritionReminder,
  sendWeightReminder,
} from '@/lib/push-notifications';

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
    default:
      return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, type });
}
