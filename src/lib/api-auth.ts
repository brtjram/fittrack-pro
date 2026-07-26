import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { jwtVerify } from 'jose';
import { looksLikeApiToken, resolveApiToken } from '@/lib/services/api-token-service';
import { prisma } from '@/lib/prisma';

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
          // The token's signature can be valid while its subject no longer exists
          // (e.g. a device holding a token issued against a different/reset
          // database) — writes that upsert a row with a userId foreign key would
          // otherwise crash with an uncaught constraint error instead of a clean 401.
          const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } });
          if (user) return payload.sub;
        }
      } catch {
        // Invalid token — fall through to cookie auth
      }
    }
  }

  // Fall back to cookie-based session (web)
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return session.user.id;
  } catch (e) {
    console.error('[api-auth] session resolution failed:', e);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
