import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '90');

  const entries = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
  });

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { date, weightLbs, bodyFatPercent, waistIn, note } = body;

  // Upsert: one entry per user per date
  const entry = await prisma.weightEntry.upsert({
    where: { userId_date: { userId, date } },
    update: { weightLbs, bodyFatPercent, waistIn, note },
    create: { userId, date, weightLbs, bodyFatPercent, waistIn, note },
  });

  // Keep the profile's canonical currentWeightLbs in sync with the weigh-in
  // log — this route is the single write path both HealthKit syncs and
  // manual weigh-ins go through (see mobile healthkit.ts syncWeight /
  // WeighInScreen), so whichever wrote most recently naturally wins here.
  // Only applies when this write is (or ties) the most recent entry on
  // file, so editing/backfilling an older date can't clobber a newer one.
  const latest = await prisma.weightEntry.findFirst({ where: { userId }, orderBy: { date: 'desc' } });
  if (latest && latest.date <= date) {
    await prisma.fitnessProfile.updateMany({ where: { userId }, data: { currentWeightLbs: entry.weightLbs } });
  }

  return NextResponse.json(entry);
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await prisma.weightEntry.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
