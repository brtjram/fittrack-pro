import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Register or update a push token
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { token, platform } = body;

  if (!token) {
    return NextResponse.json({ error: 'Missing required field: token' }, { status: 400 });
  }

  // Upsert: if this token already exists (maybe from another user), reassign it
  const pushToken = await prisma.pushToken.upsert({
    where: { token },
    update: { userId, platform: platform ?? 'ios' },
    create: { userId, token, platform: platform ?? 'ios' },
  });

  return NextResponse.json(pushToken);
}

// Remove a push token (on logout or uninstall)
export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (token) {
    // Delete specific token
    await prisma.pushToken.deleteMany({
      where: { userId, token },
    });
  } else {
    // Delete all tokens for this user
    await prisma.pushToken.deleteMany({
      where: { userId },
    });
  }

  return NextResponse.json({ success: true });
}

// List user's registered tokens
export async function GET() {
  // Not exposed to end users but useful for debugging
  return NextResponse.json({ message: 'Push token endpoint active' });
}
