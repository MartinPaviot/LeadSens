import { auth } from "@/lib/auth";
import { z } from "zod";
import type { CampaignBrief, InfluencerProfile, OnboardingConfig } from "../../../../../../agents/influence/types";
import { searchWithApify } from "../../../../../../agents/influence/core/apifySearch";
import { MOCK_INFLUENCERS } from "../../../../../../agents/influence/core/mockData";
import { sortByScore } from "../../../../../../agents/influence/core/scoring";
import { MAX_PROFILES_PER_CAMPAIGN } from "../../../../../../agents/influence/config";

const bodySchema = z.object({
  brief: z.object({
    objective: z.string().optional(),
    sector: z.string().optional(),
    geography: z.string().optional(),
    platforms: z.array(z.string()).optional(),
    contentStyle: z.string().optional(),
    budgetMin: z.number().optional(),
    budgetMax: z.number().optional(),
    priority: z.string().optional(),
    profileType: z.string().optional(),
  }),
  config: z.object({
    connectedTools: z.array(z.object({
      id: z.string(),
      apiKey: z.string(),
    })),
    priority: z.array(z.string()),
    builtinEnabled: z.boolean(),
  }).optional(),
});

function filterMockData(brief: Partial<CampaignBrief>): InfluencerProfile[] {
  let results = [...MOCK_INFLUENCERS];

  if (brief.profileType && brief.profileType !== 'mix') {
    results = results.filter((p) => p.type === brief.profileType);
  }
  if (brief.platforms?.length) {
    results = results.filter((p) =>
      p.platforms.some((plat) => (brief.platforms as string[]).includes(plat)),
    );
  }
  if (brief.budgetMax) {
    results = results.filter((p) => p.estimatedBudgetMin <= brief.budgetMax!);
  }

  return sortByScore(results).slice(0, MAX_PROFILES_PER_CAMPAIGN);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { brief, config } = parsed.data;
  const partialBrief = brief as Partial<CampaignBrief>;

  // 1. Try connected tools in priority order
  if (config && config.connectedTools.length > 0) {
    for (const toolId of config.priority) {
      if (toolId === 'builtin') continue;
      const connected = config.connectedTools.find((t) => t.id === toolId);
      if (!connected) continue;
      // TODO: Implement real tool API calls (Upfluence, Klear, etc.)
      // For now, skip to fallback
    }
  }

  // 2. Apify fallback
  const hasApify = Boolean(process.env.APIFY_TOKEN && process.env.APIFY_TASK_INFLUENCERS);
  if (hasApify) {
    try {
      const results = await searchWithApify(partialBrief);
      if (results.length > 0) {
        return Response.json({ results, source: 'apify' });
      }
    } catch {
      // silent fail → mock data
    }
  }

  // 3. Mock data fallback
  console.warn('[influence-search] No API available — returning mock data');
  const results = filterMockData(partialBrief);
  return Response.json({ results, source: 'mock' });
}
