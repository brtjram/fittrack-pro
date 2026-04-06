import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// In-memory store for server-side (in production, use a real database)
// For now, the API route accepts health data and returns it
// The client will poll or the Shortcut will push data

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const { apiKey, date, steps, activeCalories, restingHeartRate, weight } = body;

    if (!apiKey || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, date' },
        { status: 400 }
      );
    }

    // Validate data types
    const healthData = {
      date: String(date),
      steps: Number(steps) || 0,
      activeCalories: Number(activeCalories) || 0,
      restingHeartRate: restingHeartRate ? Number(restingHeartRate) : undefined,
      weight: weight ? Number(weight) : undefined,
      receivedAt: new Date().toISOString(),
      userId: session.user.id,
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'Apple Health Sync API is active',
    usage: 'POST with { apiKey, date, steps, activeCalories, restingHeartRate?, weight? }',
  });
}
