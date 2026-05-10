import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

// POST /api/auth/mobile-google-token
// Called by the /mobile-auth page after Google OAuth completes.
// Returns a 30-day mobile JWT (same format as /api/auth/mobile-token).
export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const token = await new SignJWT({
    name: session.user.name ?? '',
    email: session.user.email ?? '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);

  return NextResponse.json({
    token,
    user: {
      id: session.user.id,
      name: session.user.name ?? '',
      email: session.user.email ?? '',
      image: session.user.image ?? null,
    },
  });
}
