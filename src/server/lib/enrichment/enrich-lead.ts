/**
 * Pure function entry point for enriching a single lead.
 * Used by Inngest background jobs (event-driven).
 *
 * This is a thin wrapper around the same logic as enrich_single_lead tool,
 * but without ToolContext dependency (no onStatus, no inline components).
 *
 * TODO: Extract shared enrichment logic from enrichment-tools.ts into
 * reusable functions when "full auto" mode is activated (STRATEGY §4.5).
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { computeSignalBoost } from "@/server/lib/enrichment/icp-scorer";
import { getOrScrapeCompany, extractDomain } from "@/server/lib/enrichment/company-cache";
import { scrapeLinkedInViaApify, type LinkedInProfileData } from "@/server/lib/connectors/apify";
import { enrichPerson, type ApolloPersonResult } from "@/server/lib/connectors/apollo";
import { summarizeCompanyContext, enrichmentDataSchema, extractFlatEnrichmentFields, type LinkedInContext } from "@/server/lib/enrichment/summarizer";
import { getApolloApiKey } from "@/server/lib/providers";
import { logger } from "@/lib/logger";

function mergeLinkedInData(
  enrichment: Record<string, unknown> | null,
  linkedin: LinkedInProfileData,
): Record<string, unknown> {
  const base = enrichment ?? {};
  return {
    ...base,
    linkedinHeadline: linkedin.linkedinHeadline ?? (base.linkedinHeadline as string | undefined) ?? null,
    recentLinkedInPosts: linkedin.recentLinkedInPosts.length > 0
      ? linkedin.recentLinkedInPosts
      : (base.recentLinkedInPosts as string[] | undefined) ?? [],
    careerHistory: linkedin.careerHistory.length > 0
      ? linkedin.careerHistory
      : (base.careerHistory as string[] | undefined) ?? [],
  };
}

function mergeApolloData(
  enrichment: Record<string, unknown> | null,
  apollo: ApolloPersonResult,
): Record<string, unknown> {
  const base = enrichment ?? {};
  return {
    ...base,
    apolloEmailStatus: apollo.emailStatus ?? (base.apolloEmailStatus as string | undefined) ?? null,
    apolloHeadline: apollo.headline ?? (base.apolloHeadline as string | undefined) ?? null,
    apolloSeniority: apollo.seniority ?? (base.apolloSeniority as string | undefined) ?? null,
    apolloDepartments: apollo.departments ?? (base.apolloDepartments as string[] | undefined) ?? [],
    ...(apollo.organizationIndustry && !base.industry
      ? { industry: apollo.organizationIndustry }
      : {}),
    ...(apollo.organizationEmployeeCount && !base.teamSize
      ? { teamSize: apollo.organizationEmployeeCount }
      : {}),
    ...(apollo.organizationRevenue && !base.revenue
      ? { revenue: apollo.organizationRevenue }
      : {}),
  };
}

function resolveLeadUrl(
  lead: { companyDomain?: string | null; website?: string | null },
  linkedinCompanyUrl?: string | null,
): string | null {
  const domain = lead.companyDomain?.trim();
  if (domain) {
    return domain.startsWith("http") ? domain : `https://${domain}`;
  }
  const raw = lead.website?.trim();
  if (raw) {
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  const liUrl = linkedinCompanyUrl?.trim();
  if (liUrl) {
    return liUrl.startsWith("http") ? liUrl : `https://${liUrl}`;
  }
  return null;
}

function extractLinkedInContext(enrichment: Record<string, unknown> | null): LinkedInContext | null {
  if (!enrichment) return null;
  const headline = enrichment.linkedinHeadline as string | null;
  const career = enrichment.careerHistory as string[] | null;
  const posts = enrichment.recentLinkedInPosts as string[] | null;
  if (!headline && !career?.length && !posts?.length) return null;
  return { headline, career, posts };
}

export async function enrichSingleLead(
  leadId: string,
  workspaceId: string,
  campaignId: string,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
  });
  if (!lead) return;
  if (lead.status !== "SCORED" && lead.status !== "ENRICHED") return;

  // Fetch broadened fields for scoring boost
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { broadenedFields: true },
  });
  const broadenedFields = campaign?.broadenedFields ?? [];

  let enrichment: unknown = null;

  // Step 0: Apollo enrichment (optional)
  const apolloApiKey = await getApolloApiKey(workspaceId);
  if (apolloApiKey && lead.email) {
    try {
      const apolloData = await enrichPerson(apolloApiKey, {
        email: lead.email,
        firstName: lead.firstName ?? undefined,
        lastName: lead.lastName ?? undefined,
        domain: lead.companyDomain ?? undefined,
        linkedinUrl: lead.linkedinUrl ?? undefined,
      });
      if (apolloData) {
        enrichment = mergeApolloData(enrichment as Record<string, unknown> | null, apolloData);
      }
    } catch (err) {
      logger.warn("[enrich-bg] Apollo failed", { leadId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Step 1: LinkedIn via Apify
  let linkedinCompanyUrl: string | null = null;
  if (lead.linkedinUrl) {
    const linkedinData = await scrapeLinkedInViaApify(lead.linkedinUrl);
    if (linkedinData) {
      enrichment = mergeLinkedInData(enrichment as Record<string, unknown> | null, linkedinData);
      linkedinCompanyUrl = linkedinData.companyWebsite;
    }
  }

  // Step 2: Jina scrape
  const url = resolveLeadUrl(lead, linkedinCompanyUrl);
  if (url) {
    const domain = extractDomain(url);
    const markdown = await getOrScrapeCompany(domain, url, undefined, workspaceId);
    if (markdown) {
      try {
        const linkedinCtx = extractLinkedInContext(enrichment as Record<string, unknown> | null);
        const companyData = await summarizeCompanyContext(markdown, workspaceId, linkedinCtx);
        enrichment = { ...(companyData as Record<string, unknown>), ...(enrichment as Record<string, unknown> | null) };
      } catch (err) {
        logger.warn("[enrich-bg] Summarization failed", { leadId, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // LinkedIn-only fallback
  const linkedinOnly = extractLinkedInContext(enrichment as Record<string, unknown> | null);
  if (linkedinOnly && !(enrichment && "companySummary" in (enrichment as Record<string, unknown>))) {
    try {
      const companyData = await summarizeCompanyContext("", workspaceId, linkedinOnly);
      enrichment = { ...(companyData as Record<string, unknown>), ...(enrichment as Record<string, unknown> | null) };
    } catch (err) {
      logger.warn("[enrich-bg] LinkedIn-only summarization failed", { leadId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Persist
  const parsed = enrichment ? enrichmentDataSchema.safeParse(enrichment) : null;
  const flatFields = parsed?.success ? extractFlatEnrichmentFields(parsed.data) : {};
  const signalBoost = computeSignalBoost(lead.icpScore ?? 5, parsed?.success ? parsed.data : null, broadenedFields);
  const enrichmentTyped = enrichment as Record<string, unknown> | null;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(enrichment ? { enrichmentData: enrichment as unknown as Prisma.InputJsonValue } : {}),
      ...(enrichmentTyped?.industry ? { industry: enrichmentTyped.industry as string } : {}),
      ...(enrichmentTyped?.teamSize ? { companySize: enrichmentTyped.teamSize as string } : {}),
      ...flatFields,
      icpScore: signalBoost.combinedScore,
      icpBreakdown: {
        ...(lead.icpBreakdown as Record<string, unknown> | null),
        intentScore: signalBoost.intentScore,
        timingScore: signalBoost.timingScore,
        signals: signalBoost.signals,
        tier: signalBoost.tier,
      } as unknown as Prisma.InputJsonValue,
      enrichedAt: new Date(),
      status: "ENRICHED",
    },
  });
}
