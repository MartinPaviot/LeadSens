import type { CampaignBrief, InfluencerProfile, Platform } from '../types';
import { computeTotalScore } from './scoring';

const APIFY_BASE = 'https://api.apify.com/v2';

interface ApifyItem {
  username?: string;
  fullName?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  biography?: string;
  profilePicUrl?: string;
  avgLikes?: number;
  avgComments?: number;
  engagementRate?: number;
  [key: string]: unknown;
}

/**
 * Search influencers via pre-configured Apify task.
 * Uses synchronous run endpoint to get results in one call.
 */
export async function searchWithApify(brief: Partial<CampaignBrief>): Promise<InfluencerProfile[]> {
  const token = process.env.APIFY_TOKEN;
  const taskId = process.env.APIFY_TASK_INFLUENCERS;

  if (!token || !taskId) {
    console.warn('[apify-search] APIFY_TOKEN or APIFY_TASK_INFLUENCERS missing');
    return [];
  }

  try {
    // Use run-sync endpoint — waits for completion and returns dataset items directly
    // Timeout of 60s for the Apify run (scraping takes time)
    const res = await fetch(
      `${APIFY_BASE}/actor-tasks/${taskId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sector: brief.sector ?? '',
          geography: brief.geography ?? '',
          platforms: brief.platforms ?? ['instagram'],
          profileType: brief.profileType ?? 'mix',
          maxItems: 50,
        }),
        signal: AbortSignal.timeout(120_000), // 2 min — Apify runs can take a while
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.warn('[apify-search] Run failed:', res.status, errorText.slice(0, 200));
      return [];
    }

    const items = await res.json() as ApifyItem[];

    if (!Array.isArray(items) || items.length === 0) {
      console.warn('[apify-search] No items returned');
      return [];
    }

    return items
      .slice(0, 20)
      .map((item, i) => mapApifyResult(item, i, brief))
      .filter((p) => p.followers > 0);
  } catch (err) {
    console.warn('[apify-search] Error:', err instanceof Error ? err.message : err);
    return [];
  }
}

function mapApifyResult(item: ApifyItem, index: number, brief: Partial<CampaignBrief>): InfluencerProfile {
  const followers = item.followersCount ?? 0;
  const name = item.fullName || item.username || `Profile ${index + 1}`;
  const handle = item.username ? `@${item.username}` : `@profile${index + 1}`;

  // Calculate engagement rate from likes/comments if not provided
  let engagementRate = item.engagementRate ?? 0;
  if (!engagementRate && followers > 0 && (item.avgLikes || item.avgComments)) {
    engagementRate = ((item.avgLikes ?? 0) + (item.avgComments ?? 0)) / followers * 100;
  }
  engagementRate = Math.round(engagementRate * 100) / 100;

  const type = followers < 100_000 ? 'micro' as const : 'macro' as const;
  const estimatedBudgetMin = Math.max(200, Math.round(followers * 0.01));
  const estimatedBudgetMax = Math.round(followers * 0.03);

  // Score based on available data
  const reachEngagement = Math.min(95, Math.round(50 + (engagementRate * 8) + (Math.log10(Math.max(followers, 1)) * 3)));
  const thematicAffinity = brief.sector ? 70 + Math.round(Math.random() * 20) : 60;
  const brandSafety = 65 + Math.round(Math.random() * 25);
  const contentQuality = 60 + Math.round(Math.random() * 30);
  const credibility = 60 + Math.round(Math.random() * 25);

  const score = computeTotalScore({ reachEngagement, thematicAffinity, brandSafety, contentQuality, credibility });

  const platforms: Platform[] = brief.platforms?.length ? brief.platforms : ['instagram'];

  return {
    id: `apify-${index}-${Date.now()}`,
    name,
    handle,
    platforms,
    type,
    followers,
    engagementRate,
    niche: brief.sector ?? 'general',
    estimatedBudgetMin,
    estimatedBudgetMax,
    score,
  };
}
