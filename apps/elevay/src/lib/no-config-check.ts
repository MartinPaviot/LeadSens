/**
 * Lightweight NO_CONFIG detection for existing fetch-based agent calls.
 * Use this when refactoring to useAgentCall is too invasive.
 *
 * Usage:
 *   const res = await fetch('/api/agents/...')
 *   const noConfig = await checkNoConfig(res)
 *   if (noConfig) { setNoConfig(noConfig); return }
 *   // proceed with SSE streaming...
 */

export interface NoConfigInfo {
  missing: string[]
  tab: string
}

export async function checkNoConfig(res: Response): Promise<NoConfigInfo | null> {
  if (res.ok) return null

  if (res.status === 400) {
    try {
      const cloned = res.clone()
      const json = (await cloned.json()) as Record<string, unknown>
      if (json.error === 'NO_CONFIG') {
        return {
          missing: (json.missing as string[]) ?? [],
          tab: (json.tab as string) ?? 'company',
        }
      }
    } catch {
      // not JSON — fall through
    }
  }

  return null
}
