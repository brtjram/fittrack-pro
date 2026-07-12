import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { getRecentCoachMemories } from '@/lib/services/coach-memory-service';

// Full coaching memory for this user, for MCP clients that want more context
// than the ~30-entry window injected into the in-app chat's system prompt.
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 100, 1), 500) : 100;

  const memories = await getRecentCoachMemories(userId, limit);
  return NextResponse.json(memories);
}
