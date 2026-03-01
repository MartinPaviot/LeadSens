import { z } from "zod/v4";
import { mistralClient } from "@/server/lib/llm/mistral-client";

const icpScoreSchema = z.object({
  score: z.number().int().min(1).max(10),
  breakdown: z.object({
    jobTitleFit: z.number().int().min(1).max(10),
    companyFit: z.number().int().min(1).max(10),
    industryRelevance: z.number().int().min(1).max(10),
    locationFit: z.number().int().min(1).max(10),
  }),
  reason: z.string(),
});

export type IcpScore = z.infer<typeof icpScoreSchema>;

interface LeadForScoring {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  companySize?: string | null;
  country?: string | null;
}

/**
 * Scores a lead against an ICP description using raw Instantly data only.
 * No scraping needed — uses Mistral Small for fast classification.
 */
export async function scoreLead(
  lead: LeadForScoring,
  icpDescription: string,
  workspaceId: string,
): Promise<IcpScore> {
  return mistralClient.json<IcpScore>({
    model: "mistral-small-latest",
    system: "You are an ICP scoring engine. Score 1-10 with breakdown. JSON only, no comments.",
    prompt: `
ICP: ${icpDescription}

Lead (raw Instantly data):
- Name: ${lead.firstName ?? ""} ${lead.lastName ?? ""}
- Job Title: ${lead.jobTitle ?? "unknown"}
- Company: ${lead.company ?? "unknown"}
- Industry: ${lead.industry ?? "unknown"}
- Company Size: ${lead.companySize ?? "unknown"}
- Location: ${lead.country ?? "unknown"}

Score this lead 1-10. JSON: {"score": N, "breakdown": {"jobTitleFit": N, "companyFit": N, "industryRelevance": N, "locationFit": N}, "reason": "one sentence"}`,
    schema: icpScoreSchema,
    workspaceId,
    action: "icp-scoring",
  });
}
