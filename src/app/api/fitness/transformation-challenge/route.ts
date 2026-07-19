import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { applyTransformationChallengePhaseAction, releaseTransformationChallengeAction } from '@/lib/services/coach-actions-service';

export async function GET() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const challenge = await prisma.transformationChallenge.findUnique({ where: { userId } });
  if (!challenge) return NextResponse.json(null);

  return NextResponse.json({
    ...challenge,
    weeklyData: JSON.parse(challenge.weeklyData),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: 'Complete your profile first.' }, { status: 400 });
  }

  const body = await request.json() as { targetWeightLbs?: number };
  const targetWeight = body.targetWeightLbs ?? profile.targetWeightLbs;

  const existing = await prisma.transformationChallenge.findUnique({ where: { userId } });
  const today = new Date().toISOString().split('T')[0];

  if (existing) {
    const updated = await prisma.transformationChallenge.update({
      where: { userId },
      data: {
        startDate: today,
        startWeightLbs: profile.currentWeightLbs,
        targetWeightLbs: targetWeight,
        currentWeek: 1,
        isActive: true,
        weeklyData: '[]',
        notes: null,
      },
    });
    await applyTransformationChallengePhaseAction(userId, profile, { currentWeek: 1 });
    return NextResponse.json({ ...updated, weeklyData: [] });
  }

  const created = await prisma.transformationChallenge.create({
    data: {
      userId,
      startDate: today,
      startWeightLbs: profile.currentWeightLbs,
      targetWeightLbs: targetWeight,
      currentWeek: 1,
      isActive: true,
      weeklyData: '[]',
    },
  });
  await applyTransformationChallengePhaseAction(userId, profile, { currentWeek: 1 });
  return NextResponse.json({ ...created, weeklyData: [] });
}

export async function PUT(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json() as {
    currentWeek?: number;
    isActive?: boolean;
    weeklyCheckIn?: {
      week: number;
      endWeight?: number;
      avgDailySteps?: number;
      workoutsCompleted?: number;
      workoutsTargeted?: number;
      foodComplianceDays?: number;
      notes?: string;
    };
  };

  const existing = await prisma.transformationChallenge.findUnique({ where: { userId } });
  if (!existing) {
    return NextResponse.json({ error: 'No active challenge found.' }, { status: 404 });
  }

  const weeklyData: object[] = JSON.parse(existing.weeklyData);

  if (body.weeklyCheckIn) {
    const idx = weeklyData.findIndex((w: any) => w.week === body.weeklyCheckIn!.week);
    if (idx >= 0) {
      weeklyData[idx] = { ...weeklyData[idx], ...body.weeklyCheckIn };
    } else {
      weeklyData.push(body.weeklyCheckIn);
    }
  }

  const updated = await prisma.transformationChallenge.update({
    where: { userId },
    data: {
      ...(body.currentWeek !== undefined && { currentWeek: body.currentWeek }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      weeklyData: JSON.stringify(weeklyData),
    },
  });

  // Advancing to a new week may mean a new phase — re-apply nutrition/step/workout
  // targets so the plan actually updates, not just the challenge's own record.
  if (body.currentWeek !== undefined && body.currentWeek !== existing.currentWeek && updated.isActive) {
    const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
    if (profile) {
      await applyTransformationChallengePhaseAction(userId, profile, { currentWeek: updated.currentWeek });
    }
  }

  return NextResponse.json({ ...updated, weeklyData });
}

export async function DELETE() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  await prisma.transformationChallenge.updateMany({
    where: { userId },
    data: { isActive: false },
  });

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (profile) {
    await releaseTransformationChallengeAction(userId, profile);
  }

  return NextResponse.json({ ok: true });
}
