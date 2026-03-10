import { z } from "zod/v4";
import { mistralClient } from "@/server/lib/llm/mistral-client";

/** Structured signal with optional date/source for recency weighting */
export const structuredSignalSchema = z.object({
  detail: z.string(),
  date: z.string().nullable(),
  source: z.string().nullable(),
});

export type StructuredSignal = z.infer<typeof structuredSignalSchema>;

/**
 * Backward-compatible schema: accepts both plain strings (legacy) and structured objects.
 * Plain strings are auto-converted to { detail: string, date: null, source: null }.
 */
const backwardCompatSignalArray = z
  .array(
    z.union([
      structuredSignalSchema,
      z.string().transform((s) => ({ detail: s, date: null, source: null })),
    ]),
  )
  .default([]);

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
  hiringSignals: backwardCompatSignalArray,
  fundingSignals: backwardCompatSignalArray,
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
  enrichmentContext: z.string().nullable().default(null),
  enrichmentLinkedin: z.string().nullable().default(null),
  enrichmentSignals: z.string().nullable().default(null),
  enrichmentDiagnostic: z.string().nullable().default(null),
});

export type EnrichmentData = z.infer<typeof enrichmentDataSchema>;

/**
 * Derives flat, CSV-ready columns from the full enrichmentData JSON.
 * Called at every enrichment write site (dual-write: flat columns + JSON blob).
 */
export function extractFlatEnrichmentFields(data: EnrichmentData) {
  return {
    companyPositioning: data.industry ?? null,
    companyOneLiner: data.companySummary
      ? data.companySummary.split(/[.!?]\s/)[0] + "."
      : null,
    companyDescription: data.enrichmentContext ?? data.companySummary ?? null,
    painPointsFlat: data.painPoints.length > 0 ? data.painPoints.join("; ") : null,
    productsFlat: data.products.length > 0 ? data.products.join("; ") : null,
    valueProp: data.valueProposition ?? null,
    targetCustomers: data.targetMarket ?? null,
    buyingSignals: buildBuyingSignals(data),
    techStackFlat: data.techStack.length > 0 ? data.techStack.join("; ") : null,
    linkedinHeadline: data.linkedinHeadline ?? null,
    careerHistory: data.careerHistory.length > 0 ? data.careerHistory.join("; ") : null,
    recentPosts: data.recentLinkedInPosts.length > 0 ? data.recentLinkedInPosts.join("; ") : null,
  };
}

function buildBuyingSignals(data: EnrichmentData): string | null {
  const parts: string[] = [
    ...data.signals,
    ...data.hiringSignals.map((s) => s.detail + (s.date ? ` (${s.date})` : "")),
    ...data.fundingSignals.map((s) => s.detail + (s.date ? ` (${s.date})` : "")),
    ...data.productLaunches,
    ...data.leadershipChanges.map((lc) => lc.event),
    ...data.publicPriorities.map((pp) => pp.statement),
    ...data.techStackChanges.map((tc) => tc.change),
  ];
  return parts.length > 0 ? parts.join("; ") : null;
}

const SUMMARIZER_SYSTEM = `Extract structured info from the provided data (company website and/or LinkedIn profile). Return ONLY valid JSON:
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
  "hiringSignals": [{"detail": "Recruiting 10 engineers", "date": "2026-02", "source": "careers page"}, {"detail": "New VP Sales hired", "date": "2026-01", "source": "LinkedIn"}],
  "fundingSignals": [{"detail": "Series B $15M", "date": "2025-11", "source": "press release"}, {"detail": "Revenue milestone $10M ARR", "date": null, "source": "blog"}],
  "productLaunches": ["e.g. Launched v2.0", "New market entry"],
  "leadershipChanges": [{"event": "New VP Sales: Jane Doe", "date": "2026-02", "source": "press release / blog / careers page"}],
  "publicPriorities": [{"statement": "CEO stated: 'Our #1 priority for 2026 is expanding into APAC'", "date": "2026-01", "source": "blog post / interview"}],
  "techStackChanges": [{"change": "Migrated from Salesforce to HubSpot", "date": "2025-Q4"}],
  "industry": "The company's industry/sector (e.g. SaaS, FinTech, E-commerce, Healthcare, Manufacturing). Deduce from products, clients, and positioning. null if truly unclear.",
  "enrichmentContext": "1-3 sentence detailed summary of what this company does, their market position, and business context. Based on website data. Single line, no newlines. null if insufficient data.",
  "enrichmentLinkedin": "1-3 sentence summary of the prospect's LinkedIn profile: their current role and responsibilities, career trajectory, and professional focus. Based on LinkedIn data below. Single line, no newlines. null if no LinkedIn data provided.",
  "enrichmentSignals": "2-4 actionable business signals from BOTH website and LinkedIn (growth, hiring, funding, expansion, tech changes, new role, career move, recent posts about challenges). Separated by semicolons. Single line. null if no clear signals.",
  "enrichmentDiagnostic": "2-3 sentence personalized diagnostic connecting the PERSON's role and challenges to the COMPANY's situation. Why is this lead interesting? How should they be approached? Specific and evidence-based. Single line, no newlines. null if insufficient data."
}
If not found → null or []. NEVER hallucinate.
enrichmentDiagnostic must be evidence-based — no generic statements. Connect person-level insights (role, career, posts) with company-level data (product, market, challenges).
For hiringSignals, fundingSignals, productLaunches: extract from news, blog, careers, and press pages. Be specific (include numbers, names, dates when available).

STRUCTURED SIGNALS (hiringSignals, fundingSignals, leadershipChanges, publicPriorities, techStackChanges):
- ALL structured signals use {"detail": "...", "date": "YYYY-MM" or null, "source": "..." or null}.
- ALWAYS include dates when available. Signals < 6 months old are 3-5x more valuable for cold email.
- hiringSignals: active job postings, team expansions, new hires. Include role titles and team size if mentioned.
- fundingSignals: funding rounds, revenue milestones, IPO plans. Include amounts when available.
- leadershipChanges: new hires, promotions, departures at VP+ level. Include the person's name and new role.
- publicPriorities: CEO/exec quotes about company direction, stated goals, strategic initiatives from blog posts, interviews, press.
- techStackChanges: tool migrations, new tech adoptions, infrastructure changes mentioned on the site.
- If no date is available, use null. If source is unclear, use null.

LinkedIn fields (linkedinHeadline, recentLinkedInPosts, careerHistory) are raw data — always return null/[] for them (they are stored separately). Use the LINKEDIN PROFILE DATA section below (if present) to generate enrichmentLinkedin, enrichmentSignals, and enrichmentDiagnostic.`;

export interface LinkedInContext {
  headline?: string | null;
  career?: string[] | null;
  posts?: string[] | null;
}

/**
 * Summarizes company website markdown + optional LinkedIn data into structured EnrichmentData JSON.
 * Uses both sources to generate enrichmentContext, enrichmentLinkedin, enrichmentSignals, enrichmentDiagnostic.
 * Raw LinkedIn fields (linkedinHeadline, careerHistory, recentLinkedInPosts) are always null/[] — stored separately.
 */
export async function summarizeCompanyContext(
  markdown: string,
  workspaceId: string,
  linkedinContext?: LinkedInContext | null,
): Promise<EnrichmentData> {
  let prompt = markdown;
  if (linkedinContext) {
    const parts: string[] = [];
    if (linkedinContext.headline) parts.push(`LinkedIn headline: ${linkedinContext.headline}`);
    if (linkedinContext.career?.length) parts.push(`Career history: ${linkedinContext.career.join(" → ")}`);
    if (linkedinContext.posts?.length) parts.push(`Recent LinkedIn posts:\n${linkedinContext.posts.slice(0, 3).join("\n")}`);
    if (parts.length) prompt += `\n\n---\nLINKEDIN PROFILE DATA:\n${parts.join("\n")}`;
  }

  return mistralClient.json<EnrichmentData>({
    model: "mistral-small-latest",
    system: SUMMARIZER_SYSTEM,
    prompt,
    schema: enrichmentDataSchema,
    workspaceId,
    action: "enrichment-summarize",
  });
}
