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
  "signals": ["buying signals"]
}
If not found → null or []. NEVER hallucinate.`;

/**
 * Summarizes company website markdown into structured EnrichmentData JSON.
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
