import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { scoreLead, computeSignalBoost } from "@/server/lib/enrichment/icp-scorer";
import { getOrScrapeCompany, extractDomain as extractDomainFromUrl } from "@/server/lib/enrichment/company-cache";
import { scrapeLinkedInViaApify, type LinkedInProfileData } from "@/server/lib/connectors/apify";
import { enrichPerson, searchPeople, getApiUsageStats, getEnrichmentLimits, type ApolloPersonResult, type ApolloSearchPeopleParams } from "@/server/lib/connectors/apollo";
import { summarizeCompanyContext, enrichmentDataSchema, extractFlatEnrichmentFields, type LinkedInContext } from "@/server/lib/enrichment/summarizer";
import { getApolloApiKey } from "@/server/lib/providers";
import { logger } from "@/lib/logger";
import type { ToolDefinition, ToolContext } from "./types";
import { resolveCampaignId } from "./resolve-campaign";

/**
 * Merges Apify LinkedIn profile data directly into enrichment result.
 * Skips the summarizer — structured data goes straight in.
 */
export function mergeLinkedInData(
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

/**
 * Merges Apollo person enrichment data into the enrichment result.
 * Apollo provides fresher email verification, phone numbers, and org data.
 */
export function mergeApolloData(
  enrichment: Record<string, unknown> | null,
  apollo: ApolloPersonResult,
): Record<string, unknown> {
  const base = enrichment ?? {};
  return {
    ...base,
    // Apollo-specific fields (don't overwrite existing non-null values)
    apolloEmailStatus: apollo.emailStatus ?? (base.apolloEmailStatus as string | undefined) ?? null,
    apolloHeadline: apollo.headline ?? (base.apolloHeadline as string | undefined) ?? null,
    apolloSeniority: apollo.seniority ?? (base.apolloSeniority as string | undefined) ?? null,
    apolloDepartments: apollo.departments ?? (base.apolloDepartments as string[] | undefined) ?? [],
    // Organization data from Apollo (fills gaps if Jina didn't get it)
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

/**
 * Resolves the best URL to scrape for a lead.
 * Priority: lead.website > guessed domain from company name.
 * Ensures https:// prefix for Jina Reader.
 */
export function resolveLeadUrl(
  lead: { companyDomain?: string | null; website?: string | null; company?: string | null },
  linkedinCompanyUrl?: string | null,
): string | null {
  // Priority 1: companyDomain from Instantly (most reliable)
  const domain = lead.companyDomain?.trim();
  if (domain) {
    if (domain.startsWith("http://") || domain.startsWith("https://")) return domain;
    return `https://${domain}`;
  }

  // Priority 2: explicit website
  const raw = lead.website?.trim();
  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return `https://${raw}`;
  }

  // Priority 3: company website from LinkedIn profile (Apify)
  const liUrl = linkedinCompanyUrl?.trim();
  if (liUrl) {
    logger.debug(`[enrich] Using LinkedIn-sourced company URL: ${liUrl}`);
    if (liUrl.startsWith("http://") || liUrl.startsWith("https://")) return liUrl;
    return `https://${liUrl}`;
  }

  // No reliable source — don't guess from company name (too fragile)
  return null;
}

// Re-use extractDomain from company-cache (aliased as extractDomainFromUrl above)
const extractDomain = extractDomainFromUrl;

/**
 * Extracts LinkedIn context from enrichment for passing to the summarizer.
 */
export function extractLinkedInContext(enrichment: Record<string, unknown> | null): LinkedInContext | null {
  if (!enrichment) return null;
  const headline = enrichment.linkedinHeadline as string | null;
  const career = enrichment.careerHistory as string[] | null;
  const posts = enrichment.recentLinkedInPosts as string[] | null;
  if (!headline && !career?.length && !posts?.length) return null;
  return { headline, career, posts };
}

/**
 * Summarizes enrichment quality in a format that survives LLM compression.
 * The agent sees this instead of raw enrichmentData (which is stripped).
 */
export function summarizeEnrichmentQuality(enrichment: Record<string, unknown> | null): {
  quality: "rich" | "partial" | "minimal" | "none";
  has: string[];
  missing: string[];
} {
  if (!enrichment) return { quality: "none", has: [], missing: ["all fields"] };

  const has: string[] = [];
  const missing: string[] = [];

  if (enrichment.companySummary) has.push("companySummary");
  else missing.push("companySummary");

  const painPoints = Array.isArray(enrichment.painPoints) ? enrichment.painPoints : [];
  if (painPoints.length > 0) has.push(`${painPoints.length} painPoints`);
  else missing.push("painPoints");

  const products = Array.isArray(enrichment.products) ? enrichment.products : [];
  if (products.length > 0) has.push(`${products.length} products`);

  if (enrichment.linkedinHeadline) has.push("linkedinHeadline");
  else missing.push("linkedinHeadline");

  const career = Array.isArray(enrichment.careerHistory) ? enrichment.careerHistory : [];
  if (career.length > 0) has.push(`${career.length} careerHistory`);

  const posts = Array.isArray(enrichment.recentLinkedInPosts) ? enrichment.recentLinkedInPosts : [];
  if (posts.length > 0) has.push(`${posts.length} linkedInPosts`);

  const signalTypes = ["hiringSignals", "fundingSignals", "productLaunches", "leadershipChanges", "publicPriorities", "techStackChanges"];
  let signalCount = 0;
  for (const st of signalTypes) {
    const arr = Array.isArray(enrichment[st]) ? enrichment[st] as unknown[] : [];
    signalCount += arr.length;
  }
  if (signalCount > 0) has.push(`${signalCount} signals`);
  else missing.push("signals");

  if (enrichment.industry) has.push(`industry:${enrichment.industry}`);

  // Apollo-specific fields
  if (enrichment.apolloEmailStatus) has.push(`apolloEmail:${enrichment.apolloEmailStatus}`);
  if (enrichment.apolloSeniority) has.push(`seniority:${enrichment.apolloSeniority}`);

  let quality: "rich" | "partial" | "minimal" | "none";
  if (has.length >= 5) quality = "rich";
  else if (has.length >= 3) quality = "partial";
  else if (has.length >= 1) quality = "minimal";
  else quality = "none";

  return { quality, has, missing };
}

/** Map find_decision_makers tool args to Apollo search params (pure, testable). */
export function mapToolArgsToApolloParams(args: {
  titles: string[];
  seniorities?: string[];
  company_domains?: string[];
  industries?: string[];
  employee_range?: string;
  person_locations?: string[];
  company_locations?: string[];
  tech_stack?: string[];
  hiring_for?: string[];
  strict_titles?: boolean;
  max_results?: number;
}): ApolloSearchPeopleParams {
  const params: ApolloSearchPeopleParams = {};
  if (args.titles.length) params.person_titles = args.titles;
  if (args.seniorities?.length) params.person_seniorities = args.seniorities;
  if (args.company_domains?.length) params.q_organization_domains_list = args.company_domains;
  if (args.industries?.length) params.q_organization_keyword_tags = args.industries;
  if (args.employee_range) params.organization_num_employees_ranges = [args.employee_range];
  if (args.person_locations?.length) params.person_locations = args.person_locations;
  if (args.company_locations?.length) params.organization_locations = args.company_locations;
  if (args.tech_stack?.length) {
    params.currently_using_any_of_technology_uids = args.tech_stack.map(
      (t) => t.replace(/[\s.]/g, "_").toLowerCase(),
    );
  }
  if (args.hiring_for?.length) params.q_organization_job_titles = args.hiring_for;
  params.include_similar_titles = !(args.strict_titles ?? false);
  params.per_page = args.max_results ?? 25;
  return params;
}

export function createEnrichmentTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    search_leads: {
      name: "search_leads",
      description:
        "Find a lead by name, email, or company. " +
        "Use this BEFORE enrich_single_lead or draft_single_email when the user references a lead by name. " +
        "Pass campaign_id if available; otherwise the most recent campaign is used automatically.",
      parameters: z.object({
        query: z.string().describe("Lead name, email, or company to search for"),
        campaign_id: z.string().optional().describe("Campaign ID if known from context"),
      }),
      async execute(args) {
        const query = args.query.trim().toLowerCase();
        if (!query) return { error: "Query cannot be empty" };

        const campaignId = await resolveCampaignId(ctx, args.campaign_id);
        if (!campaignId) return { error: "No campaign found" };

        // Campaign-scoped query: hits @@index([campaignId, status]),
        // then filters in-memory over the campaign's leads (typically 5-500).
        // No full table scan, no ILIKE on 1M rows.
        const campaignLeads = await prisma.lead.findMany({
          where: {
            campaignId,
            workspaceId: ctx.workspaceId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            jobTitle: true,
            status: true,
            icpScore: true,
          },
        });

        // In-memory fuzzy match over the small campaign set
        const matches = campaignLeads.filter((l) => {
          const fullName = [l.firstName, l.lastName].filter(Boolean).join(" ").toLowerCase();
          const email = (l.email ?? "").toLowerCase();
          const company = (l.company ?? "").toLowerCase();
          return fullName.includes(query) || email.includes(query) || company.includes(query);
        });

        if (matches.length === 0) {
          return { results: [], count: 0, message: `No leads matching "${query}" in this campaign (${campaignLeads.length} leads searched)` };
        }

        return { results: matches, count: matches.length };
      },
    },

    score_leads_batch: {
      name: "score_leads_batch",
      description: "Score leads against the ICP using raw Instantly data. Leads scoring below 5 are skipped. Returns lead_ids of qualified leads for chaining to enrich_leads_batch.",
      parameters: z.object({
        lead_ids: z.array(z.string()).optional().describe("Lead IDs if available; omit to auto-find all SOURCED leads in the campaign"),
        icp_description: z.string(),
        campaign_id: z.string().optional().describe("Campaign ID; falls back to most recent"),
      }),
      async execute(args) {
        const campaignId = await resolveCampaignId(ctx, args.campaign_id);

        let leads;
        if (args.lead_ids?.length) {
          leads = await prisma.lead.findMany({
            where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId, status: "SOURCED" },
          });
        } else {
          if (!campaignId) return { error: "No campaign found" };
          leads = await prisma.lead.findMany({
            where: { campaignId, workspaceId: ctx.workspaceId, status: "SOURCED" },
          });
          if (leads.length === 0) return { error: "No SOURCED leads to score in this campaign" };
        }

        let scored = 0;
        let skipped = 0;
        let errors = 0;
        const qualifiedIds: string[] = [];

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Scoring lead ${i + 1}/${leads.length}: ${lead.firstName ?? ""} ${lead.lastName ?? ""}`);

          try {
            const result = await scoreLead(lead, args.icp_description, ctx.workspaceId);

            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                icpScore: result.score,
                icpBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
                status: result.score >= 5 ? "SCORED" : "SKIPPED",
              },
            });

            if (result.score >= 5) {
              scored++;
              qualifiedIds.push(lead.id);
            } else {
              skipped++;
            }
          } catch (err) {
            logger.error(`[score] Failed to score lead ${lead.id} (${lead.email}):`, { error: err instanceof Error ? err.message : String(err) });
            errors++;
          }
        }

        // Update campaign stats (workspace-scoped)
        if (campaignId) {
          await prisma.campaign.update({
            where: { id: campaignId, workspaceId: ctx.workspaceId },
            data: { leadsScored: scored, leadsSkipped: skipped, status: "SCORING" },
          });
        }

        // Auto-render updated lead table with scores
        const allLeadIds = args.lead_ids?.length ? args.lead_ids : leads.map((l) => l.id);
        const scoredLeads = await prisma.lead.findMany({
          where: { id: { in: allLeadIds }, workspaceId: ctx.workspaceId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            jobTitle: true,
            linkedinUrl: true,
            icpScore: true,
            status: true,
          },
          orderBy: { icpScore: { sort: "desc", nulls: "last" } },
        });

        // ICP feedback loop — alert agent if most leads are eliminated
        const skipRate = leads.length > 0 ? skipped / leads.length : 0;
        const icpWarning = skipRate >= 0.7 && leads.length >= 10
          ? {
              alert: "high_skip_rate",
              message: `${Math.round(skipRate * 100)}% of leads scored below 5 and were skipped (${skipped}/${leads.length}). ` +
                `This suggests the ICP criteria may be too narrow or the sourced leads don't match. ` +
                `Consider: (1) broadening the ICP, (2) re-sourcing with different filters, or (3) lowering the scoring threshold.`,
            }
          : undefined;

        return {
          scored,
          skipped,
          errors,
          total: leads.length,
          lead_ids: qualifiedIds,
          ...(icpWarning && { icp_warning: icpWarning }),
          __component: "lead-table",
          props: {
            title: `Scored Leads (${scored} qualified, ${skipped} skipped)`,
            leads: scoredLeads,
            campaignId,
          },
        };
      },
    },

    enrich_leads_batch: {
      name: "enrich_leads_batch",
      description:
        "Enrich leads by scraping company websites via Jina Reader + LinkedIn via Apify.\n" +
        "Two modes:\n" +
        "1. Explicit: pass lead_ids (from score_leads_batch in the SAME session)\n" +
        "2. Auto: omit lead_ids — finds all leads needing (re-)enrichment in the campaign\n" +
        "Pass campaign_id if available; falls back to most recent campaign.",
      parameters: z.object({
        lead_ids: z.array(z.string()).optional().describe("Lead IDs if available from current session"),
        campaign_id: z.string().optional().describe("Campaign ID; falls back to most recent"),
      }),
      async execute(args) {
        const campaignId = await resolveCampaignId(ctx, args.campaign_id);
        if (!campaignId) return { error: "No campaign found" };

        let leads;
        if (args.lead_ids?.length) {
          // Explicit mode: use provided IDs, allow both SCORED and failed ENRICHED (retry)
          leads = await prisma.lead.findMany({
            where: {
              id: { in: args.lead_ids },
              workspaceId: ctx.workspaceId,
              OR: [
                { status: "SCORED", enrichedAt: null },
                { status: "ENRICHED", enrichmentData: { equals: Prisma.DbNull } },
              ],
            },
          });
        } else {
          // Auto mode: find all leads needing enrichment in the campaign
          leads = await prisma.lead.findMany({
            where: {
              campaignId,
              workspaceId: ctx.workspaceId,
              OR: [
                { status: "SCORED", enrichedAt: null },
                { status: "ENRICHED", enrichmentData: { equals: Prisma.DbNull } },
              ],
            },
          });
          if (leads.length === 0) return { error: "No leads needing enrichment in this campaign" };
        }

        let enriched = 0;
        let scraped = 0;
        let scrapeFailed = 0;
        let noUrl = 0;
        let noLinkedin = 0;
        let apolloEnriched = 0;
        const enrichedIds: string[] = [];

        // Check if Apollo is connected (optional enrichment step)
        const apolloApiKey = await getApolloApiKey(ctx.workspaceId);

        // Apollo rate limit pre-check (graceful — skip if unavailable)
        let apolloRateLimitWarning: string | undefined;
        let apolloUsageSummary: string | undefined;
        if (apolloApiKey) {
          try {
            const stats = await getApiUsageStats(apolloApiKey);
            if (stats) {
              const limits = getEnrichmentLimits(stats);
              if (limits) {
                apolloUsageSummary = `Apollo: ${limits.day.consumed}/${limits.day.limit} enrichments used today`;
                if (limits.day.leftOver < leads.length) {
                  apolloRateLimitWarning = `⚠️ Apollo rate limit: ${limits.day.leftOver} enrichments remaining today (need ${leads.length}). Batch will be partially processed.`;
                }
                if (limits.minute.leftOver < 5) {
                  apolloRateLimitWarning = (apolloRateLimitWarning ? apolloRateLimitWarning + " " : "") +
                    `⚠️ Apollo minute rate limit nearly exhausted (${limits.minute.leftOver} left). Adding delays between enrichments.`;
                }
              }
            }
          } catch {
            // Graceful degradation — skip rate limit check
          }
        }

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Enriching lead ${i + 1}/${leads.length}...`);
          let enrichment: unknown = null;

          // Track data gaps
          if (!lead.linkedinUrl) noLinkedin++;

          // Step 0 (optional): Apollo person enrichment — fast, provides verified email + org data
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
                enrichment = mergeApolloData(
                  enrichment as Record<string, unknown> | null,
                  apolloData,
                );
                apolloEnriched++;
              }
            } catch (err) {
              logger.warn(`[enrich] Apollo enrichment failed for ${lead.email}:`, { error: err instanceof Error ? err.message : String(err) });
            }
          }

          // Step 1: LinkedIn via Apify — may provide company website for Jina
          let linkedinCompanyUrl: string | null = null;
          if (lead.linkedinUrl) {
            const linkedinData = await scrapeLinkedInViaApify(
              lead.linkedinUrl,
              (msg) => ctx.onStatus?.(msg),
            );
            if (linkedinData) {
              enrichment = mergeLinkedInData(
                enrichment as Record<string, unknown> | null,
                linkedinData,
              );
              linkedinCompanyUrl = linkedinData.companyWebsite;
            }
          }

          // Step 2: Resolve company URL — now with LinkedIn-sourced website as fallback
          const url = resolveLeadUrl(lead, linkedinCompanyUrl);

          if (url) {
            const domain = extractDomain(url);
            // Persistent cache: checks Prisma CompanyCache (TTL 7d), scrapes on miss
            const markdown = await getOrScrapeCompany(
              domain,
              url,
              (msg) => ctx.onStatus?.(msg),
              ctx.workspaceId,
            );

            if (markdown) {
              try {
                const linkedinCtx = extractLinkedInContext(enrichment as Record<string, unknown> | null);
                const companyData = await summarizeCompanyContext(markdown, ctx.workspaceId, linkedinCtx);
                // LinkedIn raw fields win over summarizer's null/[] defaults
                enrichment = { ...(companyData as Record<string, unknown>), ...(enrichment as Record<string, unknown> | null) };
              } catch (err) {
                logger.warn(`[enrich] Summarization failed for ${lead.company ?? lead.email}:`, { error: err instanceof Error ? err.message : String(err) });
              }
              scraped++;
            } else {
              logger.warn(`[enrich] Scrape failed for ${lead.company ?? lead.email} (url: ${url})`);
              scrapeFailed++;
            }
          } else {
            logger.warn(`[enrich] No URL for ${lead.company ?? lead.email} — skipping scrape`);
            noUrl++;
            scrapeFailed++;
          }

          // LinkedIn-only: no website but we have LinkedIn data — still call summarizer for narrative fields
          const linkedinOnly = extractLinkedInContext(enrichment as Record<string, unknown> | null);
          if (linkedinOnly && !(enrichment && "companySummary" in (enrichment as Record<string, unknown>))) {
            try {
              const companyData = await summarizeCompanyContext("", ctx.workspaceId, linkedinOnly);
              enrichment = { ...(companyData as Record<string, unknown>), ...(enrichment as Record<string, unknown> | null) };
            } catch (err) {
              logger.warn(`[enrich] LinkedIn-only summarization failed for ${lead.company ?? lead.email}:`, { error: err instanceof Error ? err.message : String(err) });
            }
          }

          // Always advance to ENRICHED — even without scrape data,
          // the lead can still be drafted using basic Instantly data
          const enrichmentTyped = enrichment as Record<string, unknown> | null;
          const parsed = enrichment ? enrichmentDataSchema.safeParse(enrichment) : null;
          const flatFields = parsed?.success ? extractFlatEnrichmentFields(parsed.data) : {};

          // Post-enrichment signal boost: upgrade fit-only score to multi-dimensional
          const signalBoost = computeSignalBoost(lead.icpScore ?? 5, parsed?.success ? parsed.data : null);
          const updatedBreakdown = {
            ...(lead.icpBreakdown as Record<string, unknown> | null),
            intentScore: signalBoost.intentScore,
            timingScore: signalBoost.timingScore,
            signals: signalBoost.signals,
            tier: signalBoost.tier,
          };

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              ...(enrichment ? {
                enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
              } : {}),
              ...(enrichmentTyped?.industry ? { industry: enrichmentTyped.industry as string } : {}),
              ...(enrichmentTyped?.teamSize ? { companySize: enrichmentTyped.teamSize as string } : {}),
              ...flatFields,
              icpScore: signalBoost.combinedScore,
              icpBreakdown: updatedBreakdown as unknown as Prisma.InputJsonValue,
              enrichedAt: new Date(),
              status: "ENRICHED",
            },
          });
          enriched++;
          enrichedIds.push(lead.id);
        }

        // Update campaign stats (workspace-scoped)
        if (campaignId) {
          await prisma.campaign.update({
            where: { id: campaignId, workspaceId: ctx.workspaceId },
            data: { leadsEnriched: enriched, status: "ENRICHING" },
          });
        }

        // Auto-render lead table with enrichment data
        const enrichedLeads = await prisma.lead.findMany({
          where: { id: { in: enrichedIds }, workspaceId: ctx.workspaceId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            jobTitle: true,
            linkedinUrl: true,
            icpScore: true,
            status: true,
            enrichmentData: true,
          },
        });

        const enrichedRows = enrichedLeads.map((l) => ({
          name: [l.firstName, l.lastName].filter(Boolean).join(" "),
          company: l.company,
          jobTitle: l.jobTitle,
          icpScore: l.icpScore,
          scraped: !!(l.enrichmentData),
          enrichment: l.enrichmentData as Record<string, unknown> | null,
        }));

        // Per-lead quality summaries (survives compression — agent sees this)
        const enrichment_summary = enrichedLeads.map((l) => {
          const ed = l.enrichmentData as Record<string, unknown> | null;
          const q = summarizeEnrichmentQuality(ed);
          return {
            name: [l.firstName, l.lastName].filter(Boolean).join(" "),
            company: l.company,
            quality: q.quality,
            has: q.has,
            missing: q.missing,
            industry: ed?.industry as string | undefined,
          };
        });

        return {
          enriched,
          scraped,
          scrape_failed: scrapeFailed,
          apollo_enriched: apolloEnriched,
          ...(apolloRateLimitWarning ? { apollo_rate_limit_warning: apolloRateLimitWarning } : {}),
          ...(apolloUsageSummary ? { apollo_usage: apolloUsageSummary } : {}),
          total: leads.length,
          lead_ids: enrichedIds,
          enrichment_summary,
          data_gaps: {
            no_website: noUrl,
            no_linkedin: noLinkedin,
            note: noUrl > 0 || noLinkedin > 0
              ? "Leads without website/LinkedIn were advanced to ENRICHED but emails will rely on basic Instantly data only."
              : undefined,
          },
          __component: "enrichment",
          props: {
            title: `Enriched Leads (${enriched} enriched, ${scraped} scraped)`,
            leads: enrichedRows,
            campaignId,
          },
        };
      },
    },

    enrich_single_lead: {
      name: "enrich_single_lead",
      description:
        "Enrich a single lead. Three ways to identify the lead (in priority order):\n" +
        "1. lead_id — if you have it from a previous tool call in the SAME session\n" +
        "2. lead_name or lead_email — resolved within the campaign\n" +
        "3. Neither — auto-picks the single un-enriched lead in the most recent campaign\n" +
        "Advances to ENRICHED even if scraping fails.",
      parameters: z.object({
        lead_id: z.string().optional().describe("Lead ID if known"),
        lead_name: z.string().optional().describe("Lead name (e.g. 'Luca Bonura') — resolved within campaign"),
        lead_email: z.string().optional().describe("Lead email — resolved within campaign"),
        campaign_id: z.string().optional().describe("Campaign ID if known; falls back to most recent"),
      }),
      async execute(args) {
        // ── Lead resolution: id > name/email > auto ──
        let lead;

        if (args.lead_id) {
          // Mode 1: direct ID lookup
          lead = await prisma.lead.findFirst({
            where: { id: args.lead_id, workspaceId: ctx.workspaceId },
          });
        } else {
          const campaignId = await resolveCampaignId(ctx, args.campaign_id);
          if (!campaignId) return { error: "No campaign found" };

          if (args.lead_name || args.lead_email) {
            // Mode 2: name/email lookup within campaign
            const campaignLeads = await prisma.lead.findMany({
              where: { campaignId, workspaceId: ctx.workspaceId },
            });
            const query = (args.lead_name ?? args.lead_email ?? "").toLowerCase();
            lead = campaignLeads.find((l) => {
              const fullName = [l.firstName, l.lastName].filter(Boolean).join(" ").toLowerCase();
              const email = (l.email ?? "").toLowerCase();
              return fullName.includes(query) || email.includes(query);
            });
          } else {
            // Mode 3: auto — find leads that need (re-)enrichment:
            //   - SCORED + never enriched (normal pipeline)
            //   - ENRICHED + enrichmentData is null (scraping failed, user wants retry)
            const candidates = await prisma.lead.findMany({
              where: {
                campaignId,
                workspaceId: ctx.workspaceId,
                OR: [
                  { status: "SCORED", enrichedAt: null },
                  { status: "ENRICHED", enrichmentData: { equals: Prisma.DbNull } },
                ],
              },
            });
            if (candidates.length === 0) return { error: "No leads needing enrichment in this campaign" };
            if (candidates.length > 1) {
              return {
                error: `${candidates.length} leads need enrichment. Specify which one.`,
                leads: candidates.map((l) => ({
                  id: l.id,
                  name: [l.firstName, l.lastName].filter(Boolean).join(" "),
                  email: l.email,
                  company: l.company,
                  status: l.status,
                })),
              };
            }
            lead = candidates[0];
          }
        }

        if (!lead) return { error: "Lead not found" };

        // Guard: only SCORED leads can be enriched (prevents bypassing scoring)
        if (lead.status !== "SCORED" && lead.status !== "ENRICHED" && lead.status !== "DRAFTED" && lead.status !== "PUSHED") {
          return { error: `Lead must be scored first (current status: ${lead.status}). Call score_leads_batch before enriching.` };
        }

        let enrichment: unknown = null;
        let scrapeError: string | null = null;

        // Step 0 (optional): Apollo person enrichment
        const apolloApiKey = await getApolloApiKey(ctx.workspaceId);
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
              enrichment = mergeApolloData(
                enrichment as Record<string, unknown> | null,
                apolloData,
              );
            }
          } catch (err) {
            logger.warn(`[enrich] Apollo enrichment failed for ${lead.email}:`, { error: err instanceof Error ? err.message : String(err) });
          }
        }

        // Step 1: LinkedIn via Apify — may provide company website for Jina
        let linkedinCompanyUrl: string | null = null;
        if (lead.linkedinUrl) {
          const linkedinData = await scrapeLinkedInViaApify(lead.linkedinUrl);
          if (linkedinData) {
            enrichment = mergeLinkedInData(
              enrichment as Record<string, unknown> | null,
              linkedinData,
            );
            linkedinCompanyUrl = linkedinData.companyWebsite;
          }
        }

        // Step 2: Resolve company URL — now with LinkedIn-sourced website as fallback
        const url = resolveLeadUrl(lead, linkedinCompanyUrl);

        if (url) {
          const domain = extractDomain(url);
          // Persistent cache: checks Prisma CompanyCache (TTL 7d), scrapes on miss
          const markdown = await getOrScrapeCompany(domain, url, undefined, ctx.workspaceId);
          if (markdown) {
            try {
              const linkedinCtx = extractLinkedInContext(enrichment as Record<string, unknown> | null);
              const companyData = await summarizeCompanyContext(markdown, ctx.workspaceId, linkedinCtx);
              // LinkedIn raw fields win over summarizer's null/[] defaults
              enrichment = { ...(companyData as Record<string, unknown>), ...(enrichment as Record<string, unknown> | null) };
            } catch (err) {
              scrapeError = `Summarization failed: ${err instanceof Error ? err.message : String(err)}`;
            }
          } else {
            scrapeError = "Failed to scrape company website";
          }
        } else {
          // Only report as error if we also don't have LinkedIn data
          if (!enrichment) scrapeError = "No website URL available";
        }

        // LinkedIn-only: no website but we have LinkedIn data — still call summarizer for narrative fields
        const linkedinOnly = extractLinkedInContext(enrichment as Record<string, unknown> | null);
        if (linkedinOnly && !(enrichment && "companySummary" in (enrichment as Record<string, unknown>))) {
          try {
            const companyData = await summarizeCompanyContext("", ctx.workspaceId, linkedinOnly);
            enrichment = { ...(companyData as Record<string, unknown>), ...(enrichment as Record<string, unknown> | null) };
          } catch (err) {
            logger.warn(`[enrich] LinkedIn-only summarization failed for ${lead.company ?? lead.email}:`, { error: err instanceof Error ? err.message : String(err) });
          }
        }

        // Always advance to ENRICHED — even if summarization failed
        const enrichmentTyped = enrichment as Record<string, unknown> | null;
        const parsed = enrichment ? enrichmentDataSchema.safeParse(enrichment) : null;
        const flatFields = parsed?.success ? extractFlatEnrichmentFields(parsed.data) : {};

        // Post-enrichment signal boost: upgrade fit-only score to multi-dimensional
        const signalBoost = computeSignalBoost(lead.icpScore ?? 5, parsed?.success ? parsed.data : null);
        const updatedBreakdown = {
          ...(lead.icpBreakdown as Record<string, unknown> | null),
          intentScore: signalBoost.intentScore,
          timingScore: signalBoost.timingScore,
          signals: signalBoost.signals,
          tier: signalBoost.tier,
        };

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            ...(enrichment ? {
              enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
            } : {}),
            ...(enrichmentTyped?.industry ? { industry: enrichmentTyped.industry as string } : {}),
            ...(enrichmentTyped?.teamSize ? { companySize: enrichmentTyped.teamSize as string } : {}),
            ...flatFields,
            icpScore: signalBoost.combinedScore,
            icpBreakdown: updatedBreakdown as unknown as Prisma.InputJsonValue,
            enrichedAt: new Date(),
            status: "ENRICHED",
          },
        });

        const enrichment_summary = summarizeEnrichmentQuality(enrichment as Record<string, unknown> | null);

        return {
          enriched: true,
          scraped: !!enrichment,
          scrapeError,
          leadId: lead.id,
          lead_ids: [lead.id],
          enrichment_summary,
          __component: "enrichment",
          props: {
            title: `Enrichment: ${[lead.firstName, lead.lastName].filter(Boolean).join(" ")}`,
            leads: [{
              name: [lead.firstName, lead.lastName].filter(Boolean).join(" "),
              company: lead.company,
              jobTitle: lead.jobTitle,
              icpScore: lead.icpScore,
              scraped: !!enrichment,
              enrichment: enrichment as Record<string, unknown> | null,
            }],
          },
        };
      },
    },

    find_decision_makers: {
      name: "find_decision_makers",
      description:
        "Find decision makers at target companies using Apollo's 275M+ people database (FREE, no credits). " +
        "Search by title, seniority, industry, company size, tech stack, and hiring signals. " +
        "Does NOT return emails — use enrichment for that.",
      parameters: z.object({
        titles: z.array(z.string()).describe("Job titles to search for, e.g. ['VP of Sales', 'Head of Revenue']"),
        seniorities: z.array(z.enum(["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager", "senior", "entry"])).optional()
          .describe("Seniority levels to filter by"),
        company_domains: z.array(z.string()).max(100).optional()
          .describe("Specific company domains to search within, e.g. ['notion.so', 'stripe.com']"),
        industries: z.array(z.string()).optional()
          .describe("Industry keywords, e.g. ['SaaS', 'fintech']"),
        employee_range: z.string().optional()
          .describe("Employee count range like '50,200' or '201,500'"),
        person_locations: z.array(z.string()).optional()
          .describe("Where the person lives, e.g. ['New York, NY', 'california']"),
        company_locations: z.array(z.string()).optional()
          .describe("Company HQ locations (different from person location)"),
        tech_stack: z.array(z.string()).optional()
          .describe("Technologies the company uses, e.g. ['salesforce', 'hubspot']. Use underscores for spaces."),
        hiring_for: z.array(z.string()).optional()
          .describe("Roles the company is actively hiring for (hiring signal)"),
        strict_titles: z.boolean().optional().default(false)
          .describe("Set true for exact title matching only"),
        max_results: z.number().int().min(1).max(100).optional().default(25),
      }),
      async execute(args) {
        const apolloApiKey = await getApolloApiKey(ctx.workspaceId);
        if (!apolloApiKey) {
          return { error: "Apollo not connected. Add your Apollo API key in Settings > Integrations." };
        }

        ctx.onStatus?.("Searching Apollo for decision makers...");

        const params = mapToolArgsToApolloParams(args);
        const result = await searchPeople(apolloApiKey, params);

        if (!result) {
          return { error: "Apollo People Search returned no results. Try broadening your search criteria." };
        }

        const showing = result.people.length;
        const table = result.people.map((p) => ({
          name: p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" ") ?? "—",
          title: p.title ?? "—",
          company: p.organizationName ?? "—",
          domain: p.organizationDomain ?? "—",
          location: [p.city, p.state, p.country].filter(Boolean).join(", ") || "—",
          seniority: p.seniority ?? "—",
          linkedin: p.linkedinUrl ?? null,
        }));

        return {
          total_found: result.totalEntries,
          showing,
          page: result.currentPage,
          total_pages: result.totalPages,
          people: table,
          suggestion: showing > 0
            ? "To get emails/phones for these contacts, ask me to enrich the top candidates."
            : undefined,
        };
      },
    },
  };
}
