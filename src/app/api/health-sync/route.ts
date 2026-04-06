import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

async function requireToken(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName:
      process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
  });

  if (!token?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { userId: token.id as string };
}

export async function POST(request: NextRequest) {
  const authResult = await requireToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const body = await request.json();

    const { apiKey, date, steps, activeCalories, restingHeartRate, weight } = body;

    if (!apiKey || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, date' },
        { status: 400 }
      );
    }

    const healthData = {
      date: String(date),
      steps: Number(steps) || 0,
      activeCalories: Number(activeCalories) || 0,
      restingHeartRate: restingHeartRate ? Number(restingHeartRate) : undefined,
      weight: weight ? Number(weight) : undefined,
      receivedAt: new Date().toISOString(),
      userId: authResult.userId,
    };

    console.log('Health sync received:', healthData);

    return NextResponse.json({
      success: true,
      message: 'Health data received',
      data: healthData,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireToken(request);
  if ('error' in authResult) return authResult.error;

  return NextResponse.json({
    status: 'Apple Health Sync API is active',
    usage: 'POST with { apiKey, date, steps, activeCalories, restingHeartRate?, weight? }',
    userId: authResult.userId,
  });
}
