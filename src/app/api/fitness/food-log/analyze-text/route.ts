import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { analyzeFoodDescription } from '@/lib/services/food-photo-service';

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  const { description } = body ?? {};

  if (typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Missing required field: description.' }, { status: 400 });
  }
  if (description.length > 2000) {
    return NextResponse.json({ error: 'Description is too long.' }, { status: 413 });
  }

  try {
    const result = await analyzeFoodDescription(description.trim());
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not analyze that description.' }, { status: 500 });
  }
}
