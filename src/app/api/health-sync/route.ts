import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const body = await request.json();
    const { date, steps, activeCalories, restingHeartRate, weight } = body;

    if (!date) {
      return NextResponse.json({ error: 'Missing required field: date' }, { status: 400 });
    }

    // Upsert daily activity with HealthKit source
    const activity = await prisma.dailyActivity.upsert({
      where: { userId_date: { userId, date: String(date) } },
      update: {
        steps: Number(steps) || 0,
        activeCalories: Number(activeCalories) || 0,
        restingHeartRate: restingHeartRate ? Number(restingHeartRate) : null,
        source: 'healthkit',
      },
      create: {
        userId,
        date: String(date),
        steps: Number(steps) || 0,
        activeCalories: Number(activeCalories) || 0,
        restingHeartRate: restingHeartRate ? Number(restingHeartRate) : null,
        source: 'healthkit',
      },
    });

    // Also sync weight if provided
    if (weight && Number(weight) > 0) {
      await prisma.weightEntry.upsert({
        where: { userId_date: { userId, date: String(date) } },
        update: { weightLbs: Number(weight) },
        create: { userId, date: String(date), weightLbs: Number(weight) },
      });
    }

    return NextResponse.json({ success: true, activity });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Apple Health Sync API is active',
    usage: 'POST with Bearer auth + { date, steps, activeCalories, restingHeartRate?, weight? }',
  });
}
