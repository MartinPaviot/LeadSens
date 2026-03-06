import { z } from "zod/v4";
import { mistralClient } from "@/server/lib/llm/mistral-client";

export const enrichmentDataSchema = z.object({
  companySummary: z.string().nullable(),
  products: z.array(z.string()),
  targetMarket: z.string().nullable(),
  valueProposition: z.string().nullable(),
  painPoints: z.array(z.string()),
  recentNews: z.array(z.string()),
  techStack: z.array(z.string()),
  teamSize: z.string().nullable(),
  signals: z.array(z.string()),
  hiringSignals: z.array(z.string()).default([]),
  fundingSignals: z.array(z.string()).default([]),
  productLaunches: z.array(z.string()).default([]),
  leadershipChanges: z
    .array(
      z.object({
        event: z.string(),
        date: z.string().nullable(),
        source: z.string().nullable(),
      }),
    )
    .default([]),
  publicPriorities: z
    .array(
      z.object({
        statement: z.string(),
        source: z.string().nullable(),
        date: z.string().nullable(),
      }),
    )
    .default([]),
  techStackChanges: z
    .array(
      z.object({
        change: z.string(),
        date: z.string().nullable(),
      }),
    )
    .default([]),
  linkedinHeadline: z.string().nullable().default(null),
  recentLinkedInPosts: z.array(z.string()).default([]),
  careerHistory: z.array(z.string()).default([]),
  industry: z.string().nullable(),
});

export type EnrichmentData = z.infer<typeof enrichmentDataSchema>;

const SUMMARIZER_SYSTEM = `Extract structured info from this company website. Return ONLY valid JSON:
{
  "companySummary": "2-3 sentences",
  "products": ["..."],
  "targetMarket": "who they sell to",
  "valueProposition": "main pitch",
  "painPoints": ["pain point 1", "pain point 2"],
  "recentNews": [],
  "techStack": [],
  "teamSize": "estimate or null",
  "signals": ["other buying signals not covered below"],
  "hiringSignals": ["e.g. Recruiting 10 engineers", "New VP Sales hired"],
  "fundingSignals": ["e.g. Series B $15M", "Revenue milestone"],
  "productLaunches": ["e.g. Launched v2.0", "New market entry"],
  "leadershipChanges": [{"event": "New VP Sales: Jane Doe", "date": "2026-02", "source": "press release / blog / careers page"}],
  "publicPriorities": [{"statement": "CEO stated: 'Our #1 priority for 2026 is expanding into APAC'", "date": "2026-01", "source": "blog post / interview"}],
  "techStackChanges": [{"change": "Migrated from Salesforce to HubSpot", "date": "2025-Q4"}],
  "industry": "The company's industry/sector (e.g. SaaS, FinTech, E-commerce, Healthcare, Manufacturing). Deduce from products, clients, and positioning. null if truly unclear."
}
If not found → null or []. NEVER hallucinate.
For hiringSignals, fundingSignals, productLaunches: extract from news, blog, careers, and press pages. Be specific (include numbers, names, dates when available).

STRUCTURED SIGNALS (leadershipChanges, publicPriorities, techStackChanges):
- ALWAYS include dates when available. Signals < 6 months old are 3-5x more valuable for cold email.
- leadershipChanges: new hires, promotions, departures at VP+ level. Include the person's name and new role.
- publicPriorities: CEO/exec quotes about company direction, stated goals, strategic initiatives from blog posts, interviews, press.
- techStackChanges: tool migrations, new tech adoptions, infrastructure changes mentioned on the site.
- If no date is available, use null. If source is unclear, use null.

LinkedIn fields (linkedinHeadline, recentLinkedInPosts, careerHistory) are filled separately — always return null/[] for them.`;

/**
 * Summarizes company website markdown into structured EnrichmentData JSON.
 * LinkedIn data is handled separately by Apify (direct structured JSON).
 * Consumed directly by the email prompt builder.
 */
export async function summarizeCompanyContext(
  markdown: string,
  workspaceId: string,
): Promise<EnrichmentData> {
  return mistralClient.json<EnrichmentData>({
    model: "mistral-small-latest",
    system: SUMMARIZER_SYSTEM,
    prompt: markdown,
    schema: enrichmentDataSchema,
    workspaceId,
    action: "enrichment-summarize",
  });
}
