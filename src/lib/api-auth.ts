import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { jwtVerify } from 'jose';
import { looksLikeApiToken, resolveApiToken } from '@/lib/services/api-token-service';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

/**
 * Get the authenticated user ID from the current request.
 * Supports:
 *  1. Cookie-based auth (web app via NextAuth session)
 *  2. Bearer JWT auth (mobile app via /api/auth/mobile-token)
 *  3. Bearer personal access token auth (MCP server / external LLM clients, "ftmcp_..." tokens)
 * Returns the userId string or a 401 NextResponse.
 */
export async function getAuthUserId(): Promise<string | NextResponse> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (looksLikeApiToken(token)) {
      const userId = await resolveApiToken(token);
      if (userId) return userId;
    } else {
      try {
        const { payload } = await jwtVerify(token, secret);
        if (payload.sub) {
          return payload.sub;
        }
      } catch {
        // Invalid token — fall through to cookie auth
      }
    }
  }

  // Fall back to cookie-based session (web)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session.user.id;
}
