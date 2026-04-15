import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const SESSION_COOKIE = "better-auth.session_token"
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`

const PUBLIC_PATHS = ["/login", "/signup"]

// ── Auth endpoint rate limiter (10 requests / 15 min per IP) ──
let authRateLimit: Ratelimit | null = null
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    authRateLimit = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "rl:auth",
      analytics: false,
    })
  }
} catch {
  // Redis unavailable — auth rate limiting disabled
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limit auth endpoints (brute force protection)
  if (pathname.startsWith("/api/auth") && authRateLimit) {
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "anonymous"
      const { success } = await authRateLimit.limit(ip)
      if (!success) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests" }),
          {
            status: 429,
            headers: {
              "Retry-After": "900",
              "Content-Type": "application/json",
            },
          },
        )
      }
    } catch {
      // Redis error — don't block the request
    }
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  const hasSession =
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(SECURE_SESSION_COOKIE)

  if (pathname === "/") {
    if (hasSession) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const isPublicRoute = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  )
  if (isPublicRoute) {
    return NextResponse.next()
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
