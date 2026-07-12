import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// This endpoint is hit by the iOS Shortcut described in Settings > Apple Health,
// which authenticates with an `apiKey` field in the JSON body (there's no way to
// set a custom Authorization header from the Shortcuts app UI) rather than a
// Bearer token. It's listed in proxy.ts's publicPaths so requests reach this
// handler at all, and auth happens here by resolving the profile that owns the key.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, date, steps, activeCalories, restingHeartRate, weight } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing required field: apiKey' }, { status: 400 });
    }

    const profile = await prisma.fitnessProfile.findFirst({ where: { healthSyncApiKey: apiKey } });
    if (!profile) {
      return NextResponse.json({ error: 'Invalid apiKey' }, { status: 401 });
    }
    const userId = profile.userId;

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
    usage: 'POST with { apiKey, date, steps, activeCalories, restingHeartRate?, weight? }',
  });
}
