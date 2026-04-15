import { NextResponse } from "next/server"

/**
 * Standardized API error response helper.
 * Ensures consistent error format across all routes:
 * { error: string, message?: string, details?: unknown }
 */
export function apiError(
  code: string,
  status: number,
  message?: string,
  details?: unknown,
): NextResponse {
  const body: Record<string, unknown> = { error: code }
  if (message) body.message = message
  if (details) body.details = details
  return NextResponse.json(body, { status })
}

/** 401 Unauthorized */
export function unauthorized(): NextResponse {
  return apiError("UNAUTHORIZED", 401, "Authentication required")
}

/** 400 No workspace */
export function noWorkspace(): NextResponse {
  return apiError("NO_WORKSPACE", 400, "No workspace found for this user")
}

/** 400 Validation error */
export function validationError(details: unknown): NextResponse {
  return apiError("VALIDATION_ERROR", 400, "Invalid input", details)
}

/** 400 No profile configured */
export function noProfile(): NextResponse {
  return apiError("NO_PROFILE", 400, "Configure your brand profile first")
}

/** 500 Internal error */
export function internalError(message?: string): NextResponse {
  return apiError("INTERNAL_ERROR", 500, message ?? "Internal server error")
}
