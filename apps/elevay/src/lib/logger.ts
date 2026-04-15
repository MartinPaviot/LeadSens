import pino from "pino"
import * as Sentry from "@sentry/nextjs"

const isDev = process.env.NODE_ENV === "development"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
  redact: {
    paths: [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "cookie",
      "apiKey",
      "*.password",
      "*.token",
      "*.apiKey",
      "req.headers.authorization",
    ],
    remove: true,
  },
})

// Bridge: send logger.error calls to Sentry automatically
const originalError = logger.error.bind(logger)
logger.error = function sentryBridge(
  obj: unknown,
  msg?: string,
  ...args: unknown[]
) {
  if (obj instanceof Error) {
    Sentry.captureException(obj)
  } else if (typeof obj === "object" && obj !== null && "err" in obj) {
    Sentry.captureException(
      (obj as { err: Error }).err,
    )
  }
  return originalError(obj, msg, ...args)
} as typeof logger.error

/**
 * Create a child logger with additional context fields.
 * Usage: const log = createContextLogger({ workspaceId, agentCode })
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context)
}
