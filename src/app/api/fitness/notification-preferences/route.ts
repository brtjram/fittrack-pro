import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Get notification preferences (returns defaults if none saved)
export async function GET() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  let prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    // Return defaults without creating a record
    prefs = {
      id: '',
      userId,
      enabled: true,
      workoutReminder: true,
      workoutReminderHour: 9,
      workoutReminderMinute: 0,
      breakfastReminder: true,
      breakfastHour: 8,
      breakfastMinute: 0,
      lunchReminder: true,
      lunchHour: 12,
      lunchMinute: 0,
      dinnerReminder: true,
      dinnerHour: 18,
      dinnerMinute: 0,
      weighInReminder: true,
      weighInDay: 1,
      weighInHour: 8,
      weighInMinute: 0,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 7,
      stepReminder: false,
      stepReminderHour: 20,
      stepReminderMinute: 0,
      updatedAt: new Date(),
    };
  }

  return NextResponse.json(prefs);
}

// Save notification preferences
export async function PUT(request: Request) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();

  // Strip id, userId, updatedAt from body — only allow preference fields
  const {
    enabled, workoutReminder, workoutReminderHour, workoutReminderMinute,
    breakfastReminder, breakfastHour, breakfastMinute,
    lunchReminder, lunchHour, lunchMinute,
    dinnerReminder, dinnerHour, dinnerMinute,
    weighInReminder, weighInDay, weighInHour, weighInMinute,
    quietHoursEnabled, quietHoursStart, quietHoursEnd,
    stepReminder, stepReminderHour, stepReminderMinute,
  } = body;

  const data = {
    enabled, workoutReminder, workoutReminderHour, workoutReminderMinute,
    breakfastReminder, breakfastHour, breakfastMinute,
    lunchReminder, lunchHour, lunchMinute,
    dinnerReminder, dinnerHour, dinnerMinute,
    weighInReminder, weighInDay, weighInHour, weighInMinute,
    quietHoursEnabled, quietHoursStart, quietHoursEnd,
    stepReminder, stepReminderHour, stepReminderMinute,
  };

  // Remove undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  const prefs = await prisma.notificationPreferences.upsert({
    where: { userId },
    update: cleanData,
    create: { userId, ...cleanData },
  });

  return NextResponse.json(prefs);
}
