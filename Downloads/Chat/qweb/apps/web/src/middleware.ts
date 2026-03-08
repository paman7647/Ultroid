import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/chat', '/settings'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has('access_token');

  // Redirect unauthenticated users away from protected pages
  if (!hasToken && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (hasToken && AUTH_PAGES.some((p) => pathname === p)) {
    const chatUrl = request.nextUrl.clone();
    chatUrl.pathname = '/chat';
    return NextResponse.redirect(chatUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/settings/:path*', '/login', '/register', '/forgot-password'],
};
