import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

// /api/health-sync authenticates itself via an apiKey field in the request body
// (the iOS Shortcuts app can't send custom Authorization headers), so it can't
// go through the cookie/JWT/MCP-token checks below like other API routes.
const publicPaths = ['/login', '/api/auth', '/api/register', '/terms', '/privacy', '/api/health-sync'];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Pass through Bearer token requests from the mobile app
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7);

    // MCP / external LLM client personal access tokens ("ftmcp_..."). Validated
    // for real (hash + DB lookup) in getAuthUserId downstream — this proxy runs
    // on the edge runtime and only does the cheap format check here, matching
    // how the public-paths bypass above works.
    if (bearerToken.startsWith('ftmcp_')) {
      return NextResponse.next();
    }

    try {
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
      await jwtVerify(bearerToken, secret);
      return NextResponse.next();
    } catch {
      // Invalid token — fall through to cookie check then redirect
    }
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Auth.js v5 uses a different cookie name prefix
    cookieName: process.env.NODE_ENV === 'production'
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token',
  });

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|.*\\.svg).*)'],
};
