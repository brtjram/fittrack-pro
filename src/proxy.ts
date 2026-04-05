import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const protectedRoutes = ['/', '/workouts', '/nutrition', '/analytics', '/settings'];
const authRoutes = ['/sign-in', '/sign-up'];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth);
  const isAuthPage = matchesRoute(pathname, authRoutes);
  const isProtected = matchesRoute(pathname, protectedRoutes);

  if (!isAuthenticated && isProtected) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
