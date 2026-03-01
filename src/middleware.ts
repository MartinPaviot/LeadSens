import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "better-auth.session_token";
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

export function middleware(request: NextRequest) {
  const hasSession =
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(SECURE_SESSION_COOKIE);

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  // Skip API routes — they handle auth themselves
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Redirect to login if no session cookie on protected pages
  // (fast reject — avoids server-side DB call for obvious cases)
  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // NOTE: We do NOT redirect "logged in" users away from auth pages here.
  // The cookie might be stale/invalid — only server-side requireUnauth()
  // can verify the session against the DB. Doing it here causes infinite
  // redirect loops when the cookie exists but the session is expired.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
