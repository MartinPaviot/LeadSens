import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { scoreLead } from "@/server/lib/enrichment/icp-scorer";
import { scrapeLeadCompany } from "@/server/lib/connectors/jina";
import { scrapeLinkedInViaApify, type LinkedInProfileData } from "@/server/lib/connectors/apify";
import { summarizeCompanyContext } from "@/server/lib/enrichment/summarizer";
import type { ToolDefinition, ToolContext } from "./types";
import { resolveCampaignId } from "./resolve-campaign";

/**
 * Merges Apify LinkedIn profile data directly into enrichment result.
 * Skips the summarizer — structured data goes straight in.
 */
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

/**
 * Resolves the best URL to scrape for a lead.
 * Priority: lead.website > guessed domain from company name.
 * Ensures https:// prefix for Jina Reader.
 */
function resolveLeadUrl(
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
    console.log(`[enrich] Using LinkedIn-sourced company URL: ${liUrl}`);
    if (liUrl.startsWith("http://") || liUrl.startsWith("https://")) return liUrl;
    return `https://${liUrl}`;
  }

  // No reliable source — don't guess from company name (too fragile)
  return null;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
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
        lead_ids: z.array(z.string()),
        icp_description: z.string(),
        campaign_id: z.string().optional().describe("Campaign ID to update stats on"),
      }),
      async execute(args) {
        const leads = await prisma.lead.findMany({
          where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId, status: "SOURCED" },
        });

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
            console.error(`[score] Failed to score lead ${lead.id} (${lead.email}):`, err);
            errors++;
          }
        }

        // Update campaign stats (workspace-scoped)
        if (args.campaign_id) {
          await prisma.campaign.update({
            where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
            data: { leadsScored: scored, leadsSkipped: skipped, status: "SCORING" },
          });
        }

        // Auto-render updated lead table with scores
        const scoredLeads = await prisma.lead.findMany({
          where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
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

        return {
          scored,
          skipped,
          errors,
          total: leads.length,
          lead_ids: qualifiedIds,
          __component: "lead-table",
          props: {
            title: `Scored Leads (${scored} qualified, ${skipped} skipped)`,
            leads: scoredLeads,
            campaignId: args.campaign_id,
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
        const enrichedIds: string[] = [];

        // Domain cache: avoid re-scraping the same company for multiple leads
        const domainCache = new Map<string, string | null>();

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Enriching lead ${i + 1}/${leads.length}...`);
          let enrichment: unknown = null;

          // Step 1: LinkedIn via Apify FIRST — may provide company website for Jina
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
            let markdown = domainCache.get(domain);

            if (markdown === undefined) {
              // First time seeing this domain — multi-page scrape
              ctx.onStatus?.(`Scraping ${domain} (multi-page)...`);
              markdown = await scrapeLeadCompany(url);
              domainCache.set(domain, markdown);
            } else if (markdown !== null) {
              console.log(`[enrich] Cache hit for ${domain}`);
            }

            if (markdown) {
              try {
                const companyData = await summarizeCompanyContext(markdown, ctx.workspaceId);
                // Merge company data into existing enrichment (which may already have LinkedIn data)
                enrichment = { ...(enrichment as Record<string, unknown> | null), ...(companyData as Record<string, unknown>) };
              } catch (err) {
                console.warn(`[enrich] Summarization failed for ${lead.company ?? lead.email}:`, err);
              }
              scraped++;
            } else {
              console.warn(`[enrich] Scrape failed for ${lead.company ?? lead.email} (url: ${url})`);
              scrapeFailed++;
            }
          } else {
            console.warn(`[enrich] No URL for ${lead.company ?? lead.email} — skipping scrape`);
            scrapeFailed++;
          }

          // Always advance to ENRICHED — even without scrape data,
          // the lead can still be drafted using basic Instantly data
          const enrichmentTyped = enrichment as Record<string, unknown> | null;
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              ...(enrichment ? {
                enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
              } : {}),
              ...(enrichmentTyped?.industry ? { industry: enrichmentTyped.industry as string } : {}),
              ...(enrichmentTyped?.teamSize ? { companySize: enrichmentTyped.teamSize as string } : {}),
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

        // Auto-render enrichment cards with scraped intel
        const enrichedLeads = await prisma.lead.findMany({
          where: { id: { in: enrichedIds }, workspaceId: ctx.workspaceId },
          select: {
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            icpScore: true,
            enrichmentData: true,
          },
        });

        const leadCards = enrichedLeads.map((l) => ({
          name: [l.firstName, l.lastName].filter(Boolean).join(" ") || "—",
          company: l.company,
          jobTitle: l.jobTitle,
          icpScore: l.icpScore,
          scraped: l.enrichmentData != null,
          enrichment: l.enrichmentData as Record<string, unknown> | null,
        }));

        return {
          enriched,
          scraped,
          scrape_failed: scrapeFailed,
          total: leads.length,
          lead_ids: enrichedIds,
          __component: "enrichment",
          props: {
            title: "Enrichment results",
            leads: leadCards,
            campaignId: campaignId,
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

        // Step 1: LinkedIn via Apify FIRST — may provide company website for Jina
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
          const markdown = await scrapeLeadCompany(url);
          if (markdown) {
            try {
              const companyData = await summarizeCompanyContext(markdown, ctx.workspaceId);
              enrichment = { ...(enrichment as Record<string, unknown> | null), ...(companyData as Record<string, unknown>) };
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

        // Always advance to ENRICHED — even if summarization failed
        const enrichmentTyped = enrichment as Record<string, unknown> | null;
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            ...(enrichment ? {
              enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
            } : {}),
            ...(enrichmentTyped?.industry ? { industry: enrichmentTyped.industry as string } : {}),
            ...(enrichmentTyped?.teamSize ? { companySize: enrichmentTyped.teamSize as string } : {}),
            enrichedAt: new Date(),
            status: "ENRICHED",
          },
        });

        return {
          enriched: true,
          scraped: !!enrichment,
          scrapeError,
          leadId: lead.id,
          enrichment,
        };
      },
    },
  };
}
