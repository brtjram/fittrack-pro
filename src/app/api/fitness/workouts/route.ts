import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const sessionId = url.searchParams.get('sessionId');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  if (sessionId) {
    const session = await prisma.workoutSession.findFirst({
      where: { userId, sessionId },
    });
    return NextResponse.json(session);
  }

  const where: Record<string, unknown> = { userId };
  if (startDate && endDate) {
    where.date = { gte: startDate, lte: endDate };
  }

  const sessions = await prisma.workoutSession.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit,
  });

  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { sessionId, date, name, splitDay, exercises, duration, completed, weekNumber, isDeload, notes, rating, cardioLog } = body;

  const existing = await prisma.workoutSession.findFirst({
    where: { userId, sessionId },
  });

  if (existing) {
    const updated = await prisma.workoutSession.update({
      where: { id: existing.id },
      data: {
        exercises: JSON.stringify(exercises),
        duration, completed, notes,
        ...(rating !== undefined && { rating }),
        ...(cardioLog !== undefined && { cardioLog }),
      },
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.workoutSession.create({
    data: {
      userId, sessionId, date, name, splitDay,
      exercises: JSON.stringify(exercises),
      duration, completed: completed ?? false,
      weekNumber: weekNumber ?? 1,
      isDeload: isDeload ?? false,
      notes,
      rating,
      cardioLog,
    },
  });
  return NextResponse.json(created);
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  await prisma.workoutSession.deleteMany({
    where: { userId, sessionId },
  });

  return NextResponse.json({ success: true });
}
