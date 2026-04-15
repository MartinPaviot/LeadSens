import { env } from "@/lib/env"

const COMPOSIO_API = "https://backend.composio.dev/api/v1"

async function composioAction<T>(
  action: string,
  connectedAccountId: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  const apiKey = env.COMPOSIO_API_KEY
  if (!apiKey) {
    return null
  }
  try {
    const res = await fetch(`${COMPOSIO_API}/actions/${action}/execute`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connectedAccountId,
        input: params,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as { data?: T }
    return data.data ?? (data as unknown as T)
  } catch (err) {
    return null
  }
}

export const socialOAuth = {
  /** Fetch Facebook page insights using a connected account */
  getFacebookPageInsights: (connectedAccountId: string) =>
    composioAction<{
      followers_count?: number
      page_name?: string
      posts?: Array<{
        message?: string
        likes?: number
        shares?: number
      }>
    }>("FACEBOOK_GET_PAGE_INSIGHTS", connectedAccountId),

  /** Fetch Instagram profile using a connected account */
  getInstagramProfile: (connectedAccountId: string) =>
    composioAction<{
      followers_count?: number
      username?: string
      media_count?: number
      recent_media?: Array<{
        caption?: string
        like_count?: number
        comments_count?: number
      }>
    }>("INSTAGRAM_GET_USER_PROFILE", connectedAccountId),
}
