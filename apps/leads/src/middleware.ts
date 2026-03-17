import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "better-auth.session_token";
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

/** Public routes accessible without authentication */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/pricing",
  "/privacy",
  "/terms",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes — they handle auth themselves
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(SECURE_SESSION_COOKIE);

  // Landing page "/" is always public
  if (pathname === "/") {
    // If logged in, redirect to chat (the main app)
    if (hasSession) {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    return NextResponse.next();
  }

  // Public routes (auth pages, legal, pricing)
  const isPublicRoute = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protected routes — redirect to login if no session cookie
  // (fast reject — avoids server-side DB call for obvious cases)
  if (!hasSession) {
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
