import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { SocialData } from '../types'
import { fetchFacebookData, type FacebookData } from './social-facebook'
import { fetchInstagramData, type InstagramData } from './social-instagram'

interface SerpSocialResult {
  organic_results?: Array<{
    link?: string
    snippet?: string
    title?: string
  }>
}

const SOCIAL_PLATFORMS = [
  { name: 'linkedin', pattern: 'linkedin.com' },
  { name: 'instagram', pattern: 'instagram.com' },
  { name: 'twitter', pattern: 'twitter.com' },
  { name: 'tiktok', pattern: 'tiktok.com' },
  { name: 'facebook', pattern: 'facebook.com' },
]

export interface SocialEnrichment {
  facebook: FacebookData | null
  instagram: InstagramData | null
  dataSources: {
    facebook: 'composio_oauth' | 'apify_public' | 'unavailable'
    instagram: 'composio_oauth' | 'apify_public' | 'unavailable'
  }
}

export async function fetchSocial(
  profile: AgentProfile,
): Promise<ModuleResult<SocialData> & { enrichment?: SocialEnrichment }> {
  try {
    // 1. SERP-based social discovery (all platforms)
    const query = `${profile.brand_name} site:linkedin.com OR site:instagram.com OR site:twitter.com OR site:facebook.com`
    const raw = (await composio.searchSerp(query, 10)) as SerpSocialResult | null

    const results = raw?.organic_results ?? []

    // 2. Facebook + Instagram enrichment (Composio or Apify)
    const [facebookResult, instagramResult] = await Promise.allSettled([
      fetchFacebookData(
        profile.brand_url,
        profile.brand_name,
        profile.facebookConnected ? profile.facebookComposioAccountId : undefined,
      ),
      fetchInstagramData(
        profile.brand_url,
        profile.brand_name,
        profile.instagramConnected ? profile.instagramComposioAccountId : undefined,
      ),
    ])

    const facebook = facebookResult.status === 'fulfilled' ? facebookResult.value : null
    const instagram = instagramResult.status === 'fulfilled' ? instagramResult.value : null

    const dataSources = {
      facebook: facebook ? facebook.source : 'unavailable' as const,
      instagram: instagram ? instagram.source : 'unavailable' as const,
    }

    // 3. Build platform list — merge SERP discovery with enriched data
    const platforms = SOCIAL_PLATFORMS.map((p) => {
      const found = results.find((r) => r.link?.includes(p.pattern))

      if (p.name === 'facebook' && facebook) {
        return {
          platform: p.name,
          followers: facebook.followers,
          engagement_rate: null,
          posting_frequency: facebook.source === 'composio_oauth' ? 'Connected (live data)' : 'Public data',
        }
      }
      if (p.name === 'instagram' && instagram) {
        return {
          platform: p.name,
          followers: instagram.followers,
          engagement_rate: null,
          posting_frequency: instagram.source === 'composio_oauth' ? 'Connected (live data)' : 'Public data',
        }
      }

      return {
        platform: p.name,
        followers: null,
        engagement_rate: null,
        posting_frequency: found ? 'Presence detected' : 'Not found',
      }
    })

    const scoredPlatforms = platforms
      .filter((p) => p.posting_frequency !== 'Not found')
      .map((p) => p.platform)

    // Score: base from platform presence + bonus for real data
    const oauthCount = [
      dataSources.facebook === 'composio_oauth',
      dataSources.instagram === 'composio_oauth',
    ].filter(Boolean).length
    const apifyCount = [
      dataSources.facebook === 'apify_public',
      dataSources.instagram === 'apify_public',
    ].filter(Boolean).length

    const baseScore = Math.min(100, scoredPlatforms.length * 18)
    const oauthBonus = oauthCount * 12
    const apifyBonus = apifyCount * 5
    const socialScore = Math.min(100, baseScore + oauthBonus + apifyBonus)
    const brandCoherenceScore = scoredPlatforms.length >= 3 ? 70 : scoredPlatforms.length * 20

    const dominantTopics = results
      .flatMap((r) => (r.snippet ?? '').split(/\s+/).slice(0, 3))
      .filter(Boolean)
      .slice(0, 5)

    return {
      success: true,
      data: {
        platforms,
        social_score: socialScore,
        brand_coherence_score: brandCoherenceScore,
        dominant_topics: dominantTopics,
        scored_platforms: scoredPlatforms,
      },
      source: 'social',
      enrichment: { facebook, instagram, dataSources },
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'social',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
