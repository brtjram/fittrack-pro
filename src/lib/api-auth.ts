import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

/**
 * Get the authenticated user ID from the current request.
 * Supports both:
 *  1. Cookie-based auth (web app via NextAuth session)
 *  2. Bearer token auth (mobile app via /api/auth/mobile-token)
 * Returns the userId string or a 401 NextResponse.
 */
export async function getAuthUserId(): Promise<string | NextResponse> {
  // Try Bearer token first (mobile)
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.sub) {
        return payload.sub;
      }
    } catch {
      // Invalid token — fall through to cookie auth
    }
  }

  // Fall back to cookie-based session (web)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session.user.id;
}
