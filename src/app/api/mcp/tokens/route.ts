import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { createApiToken } from '@/lib/services/api-token-service';

// List this user's personal access tokens (never returns the plaintext token).
export async function GET() {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json(tokens);
}

// Create a new personal access token for connecting an MCP client. The
// plaintext token is only ever returned here — it can't be retrieved again.
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'MCP client';

  const { id, token } = await createApiToken(userId, name);
  return NextResponse.json({ id, name, token });
}
