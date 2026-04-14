import { ApifyClient } from "apify-client"
import { env } from "@/lib/env"

const client = env.APIFY_TOKEN
  ? new ApifyClient({ token: env.APIFY_TOKEN })
  : null

/**
 * Run an Apify Task (pre-configured in the Apify console) and return result items.
 * Uses tasks, not actors — task IDs are stored in env (e.g. APIFY_TASK_FACEBOOK).
 */
export async function runTask<T>(
  taskId: string,
  input: Record<string, unknown>,
  timeoutSecs = 45,
): Promise<T[]> {
  if (!client) {
    console.warn("[Apify] APIFY_TOKEN not set, skipping task", taskId)
    return []
  }
  try {
    const run = await client.task(taskId).call(input, { waitSecs: timeoutSecs })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return items as T[]
  } catch (err) {
    console.warn("[Apify] Task failed:", taskId, String(err))
    return []
  }
}
