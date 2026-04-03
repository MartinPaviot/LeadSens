import type { CampaignBrief, InfluencerProfile, OnboardingConfig } from '../types';
import { sortByScore } from './scoring';
import { MOCK_INFLUENCERS } from './mockData';
import { MAX_PROFILES_PER_CAMPAIGN } from '../config';

/**
 * Search for influencers matching the campaign brief.
 * Calls the server-side API route which handles:
 * 1. Connected tools (Upfluence, Klear, etc.) in priority order
 * 2. Apify fallback if no tools connected
 * 3. Mock data as last resort
 */
export async function searchInfluencers(
  brief: Partial<CampaignBrief>,
  config?: OnboardingConfig,
): Promise<InfluencerProfile[]> {
  try {
    const res = await fetch('/api/agents/influence/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief,
        config: config ? {
          connectedTools: config.connectedTools.map((t) => ({ id: t.id, apiKey: t.apiKey })),
          priority: config.priority,
          builtinEnabled: config.builtinEnabled,
        } : undefined,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) throw new Error(`Search API error: ${res.status}`);
    const data = await res.json() as { results: InfluencerProfile[] };
    return data.results;
  } catch {
    // Client-side fallback to mock data
    return filterMockData(brief);
  }
}

function filterMockData(brief: Partial<CampaignBrief>): InfluencerProfile[] {
  let results = [...MOCK_INFLUENCERS];

  if (brief.profileType && brief.profileType !== 'mix') {
    results = results.filter((p) => p.type === brief.profileType);
  }
  if (brief.platforms?.length) {
    results = results.filter((p) =>
      p.platforms.some((plat) => brief.platforms!.includes(plat)),
    );
  }
  if (brief.budgetMax) {
    results = results.filter((p) => p.estimatedBudgetMin <= brief.budgetMax!);
  }

  return sortByScore(results).slice(0, MAX_PROFILES_PER_CAMPAIGN);
}
