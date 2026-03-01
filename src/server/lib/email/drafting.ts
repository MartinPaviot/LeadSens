import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildEmailPrompt } from "./prompt-builder";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "./campaign-angle";

interface LeadForDrafting {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  enrichmentData?: EnrichmentData | null;
}

interface DraftedEmailRef {
  step: number;
  subject: string;
}

/**
 * Drafts a single email for a lead using Mistral Large.
 *
 * UPGRADE PATH: To switch to Claude Sonnet, change only the
 * mistralClient.draftEmail() call below. No callers need to change.
 */
export async function draftEmail(params: {
  lead: LeadForDrafting;
  step: number;
  companyDna: CompanyDna | string;
  campaignAngle?: CampaignAngle;
  workspaceId: string;
  previousEmails?: DraftedEmailRef[];
  styleSamples?: string[];
}): Promise<{ subject: string; body: string }> {
  const prompt = buildEmailPrompt({
    lead: params.lead,
    step: params.step,
    companyDna: params.companyDna,
    campaignAngle: params.campaignAngle,
    previousEmails: params.previousEmails,
    styleSamples: params.styleSamples,
  });

  return mistralClient.draftEmail({
    system: "You are a world-class B2B cold email copywriter. Write concise, personalized emails that get replies. JSON output only.",
    prompt,
    workspaceId: params.workspaceId,
  });
}
