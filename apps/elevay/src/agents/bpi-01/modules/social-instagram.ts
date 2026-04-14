import { runTask } from '@/agents/_shared/apify'
import { socialOAuth } from '@/agents/_shared/social-oauth'
import { env } from '@/lib/env'

export interface InstagramData {
  source: 'composio_oauth' | 'apify_public'
  followers: number | null
  following: number | null
  postsCount: number | null
  avgLikes: number | null
  profileFound: boolean
  profileUrl: string | null
}

interface ApifyInstagramProfile {
  followersCount?: number
  followsCount?: number
  postsCount?: number
  private?: boolean
  latestPosts?: Array<{ likesCount?: number; commentsCount?: number }>
  username?: string
}

/**
 * Fetch Instagram data — Composio OAuth if connected, Apify scrape otherwise.
 */
export async function fetchInstagramData(
  brandUrl: string,
  brandName: string,
  composioAccountId?: string,
): Promise<InstagramData | null> {
  // Path 1: Composio OAuth (first-party data)
  if (composioAccountId) {
    try {
      const data = await socialOAuth.getInstagramProfile(composioAccountId)
      if (data) {
        return {
          source: 'composio_oauth',
          followers: data.followers_count ?? null,
          following: null,
          postsCount: data.media_count ?? null,
          avgLikes: data.recent_media?.length
            ? Math.round(
                data.recent_media.reduce((s, p) => s + (p.like_count ?? 0), 0) /
                  data.recent_media.length,
              )
            : null,
          profileFound: true,
          profileUrl: null,
        }
      }
    } catch (err) {
      console.warn('[Instagram] Composio failed, falling back to Apify:', String(err))
    }
  }

  // Path 2: Apify scrape (public data)
  try {
    const handle = new URL(brandUrl).hostname.replace(/^www\./, '').split('.')[0]
    const taskId = env.APIFY_TASK_INSTAGRAM
    if (!taskId) return null
    const results = await runTask<ApifyInstagramProfile>(taskId, {
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: 'details',
      resultsLimit: 1,
    }, 40)

    if (!results.length) return null

    const profile = results[0]!
    return {
      source: 'apify_public',
      followers: profile.followersCount ?? null,
      following: profile.followsCount ?? null,
      postsCount: profile.postsCount ?? null,
      avgLikes: profile.latestPosts?.length
        ? Math.round(
            profile.latestPosts.reduce((s, p) => s + (p.likesCount ?? 0), 0) /
              profile.latestPosts.length,
          )
        : null,
      profileFound: !profile.private,
      profileUrl: profile.username ? `https://www.instagram.com/${profile.username}/` : null,
    }
  } catch {
    return null
  }
}
