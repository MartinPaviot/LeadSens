import { runTask } from '@/agents/_shared/apify'
import { socialOAuth } from '@/agents/_shared/social-oauth'
import { env } from '@/lib/env'

export interface FacebookData {
  source: 'composio_oauth' | 'apify_public'
  followers: number | null
  recentPostsCount: number
  avgEngagement: number | null
  pageFound: boolean
  pageUrl: string | null
}

interface ApifyFacebookPage {
  likes?: number
  followers?: number
  url?: string
  posts?: Array<{ likes?: number; comments?: number; shares?: number }>
}

function computeAvgEngagement(posts: ApifyFacebookPage['posts']): number | null {
  if (!posts?.length) return null
  const total = posts.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0), 0)
  return Math.round(total / posts.length)
}

/**
 * Fetch Facebook data — Composio OAuth if connected, Apify scrape otherwise.
 */
export async function fetchFacebookData(
  brandUrl: string,
  brandName: string,
  composioAccountId?: string,
): Promise<FacebookData | null> {
  // Path 1: Composio OAuth (first-party data)
  if (composioAccountId) {
    try {
      const data = await socialOAuth.getFacebookPageInsights(composioAccountId)
      if (data) {
        return {
          source: 'composio_oauth',
          followers: data.followers_count ?? null,
          recentPostsCount: data.posts?.length ?? 0,
          avgEngagement: data.posts?.length
            ? Math.round(
                data.posts.reduce((s, p) => s + (p.likes ?? 0) + (p.shares ?? 0), 0) /
                  data.posts.length,
              )
            : null,
          pageFound: true,
          pageUrl: null,
        }
      }
    } catch (err) {
      console.warn('[Facebook] Composio failed, falling back to Apify:', String(err))
    }
  }

  // Path 2: Apify scrape (public data)
  try {
    const domain = new URL(brandUrl).hostname.replace(/^www\./, '').split('.')[0]
    const taskId = env.APIFY_TASK_FACEBOOK
    if (!taskId) return null
    const results = await runTask<ApifyFacebookPage>(taskId, {
      startUrls: [
        { url: `https://www.facebook.com/${domain}` },
      ],
      maxPosts: 5,
      maxPostComments: 0,
      maxReviews: 0,
    }, 40)

    if (!results.length) return null

    const page = results[0]!
    return {
      source: 'apify_public',
      followers: page.likes ?? page.followers ?? null,
      recentPostsCount: page.posts?.length ?? 0,
      avgEngagement: computeAvgEngagement(page.posts),
      pageFound: true,
      pageUrl: page.url ?? null,
    }
  } catch {
    return null
  }
}
