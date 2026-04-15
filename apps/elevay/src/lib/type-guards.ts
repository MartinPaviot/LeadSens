/**
 * Runtime type guard for AgentOutput<T> from Prisma JSON fields.
 * Replaces unsafe `as unknown as AgentOutput<T>` double casts.
 */
export function isAgentOutput(
  value: unknown,
): value is {
  agent_code: string
  analysis_date: string
  payload: unknown
  degraded_sources: string[]
  version: string
} {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj["agent_code"] === "string" &&
    typeof obj["analysis_date"] === "string" &&
    "payload" in obj &&
    Array.isArray(obj["degraded_sources"])
  )
}

/**
 * Safe extract of agent output from a Prisma JSON field.
 * Returns null if the data doesn't match the expected structure.
 */
export function safeAgentOutput<T>(
  value: unknown,
): { payload: T; degraded_sources: string[] } | null {
  if (!isAgentOutput(value)) return null
  return {
    payload: value.payload as T,
    degraded_sources: value.degraded_sources,
  }
}
