import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '90');
  const date = url.searchParams.get('date');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  if (date) {
    const activity = await prisma.dailyActivity.findUnique({
      where: { userId_date: { userId, date } },
    });
    return NextResponse.json(activity);
  }

  const where: Record<string, unknown> = { userId };
  if (startDate && endDate) {
    where.date = { gte: startDate, lte: endDate };
  }

  const activities = await prisma.dailyActivity.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit,
  });

  return NextResponse.json(activities);
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { date, steps, activeCalories, restingHeartRate, source } = body;

  // Upsert: one entry per user per date
  const activity = await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date } },
    update: { steps, activeCalories, restingHeartRate, source },
    create: { userId, date, steps, activeCalories, restingHeartRate, source: source ?? 'manual' },
  });

  return NextResponse.json(activity);
}

export async function PUT(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { originalDate, date, steps, activeCalories, restingHeartRate, source } = body;

  if (!originalDate || !date) {
    return NextResponse.json({ error: 'originalDate and date required' }, { status: 400 });
  }

  // Moving the entry to a different date (e.g. fixing a late-night entry
  // that landed on the wrong day) — drop the old row, then upsert the new
  // one so it overwrites correctly if the target date already has data.
  if (date !== originalDate) {
    await prisma.dailyActivity.deleteMany({ where: { userId, date: originalDate } });
  }

  const activity = await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date } },
    update: { steps, activeCalories, restingHeartRate, source: source ?? 'manual' },
    create: { userId, date, steps, activeCalories, restingHeartRate, source: source ?? 'manual' },
  });

  return NextResponse.json(activity);
}
