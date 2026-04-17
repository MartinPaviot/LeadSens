/**
 * Structured agent logger.
 * Replaces silent catch blocks with visible, traceable warnings.
 * In production, these would go to a logging service.
 * In development, they appear in the server console.
 */

type LogLevel = "warn" | "error"

interface AgentLogEntry {
  agent: string
  module: string
  level: LogLevel
  message: string
  detail?: unknown
}

const logs: AgentLogEntry[] = []

function log(entry: AgentLogEntry) {
  logs.push(entry)
  const prefix = `[${entry.agent}/${entry.module}]`
  if (entry.level === "error") {
    console.error(prefix, entry.message, entry.detail ?? "")
  } else {
    console.warn(prefix, entry.message, entry.detail ?? "")
  }
}

export function agentWarn(agent: string, module: string, message: string, detail?: unknown) {
  log({ agent, module, level: "warn", message, detail })
}

export function agentError(agent: string, module: string, message: string, detail?: unknown) {
  log({ agent, module, level: "error", message, detail })
}

/** Get recent log entries (useful for debugging in API responses) */
export function getRecentLogs(limit = 20): AgentLogEntry[] {
  return logs.slice(-limit)
}
