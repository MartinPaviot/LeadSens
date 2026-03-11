import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { syncSingleCampaign } from "@/server/lib/analytics/sync";
import { checkAndPauseLosingVariant } from "@/server/lib/analytics/ab-testing";
import { getESPProvider } from "@/server/lib/providers";
import { inngest } from "./client";

// ─── 1. Analytics Sync Cron (every 30 minutes) ─────────────────────

export const analyticsSyncCron = inngest.createFunction(
  { id: "analytics-sync-cron" },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    // Fetch all PUSHED/ACTIVE campaigns with an ESP campaign ID
    const campaigns = await step.run("fetch-campaigns", async () => {
      const rows = await prisma.campaign.findMany({
        where: {
          status: { in: ["PUSHED", "ACTIVE"] },
          espCampaignId: { not: null },
        },
        select: {
          id: true,
          espCampaignId: true,
          workspaceId: true,
          lastSyncedAt: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        espCampaignId: r.espCampaignId!,
        workspaceId: r.workspaceId,
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      }));
    });

    if (campaigns.length === 0) {
      return { synced: 0, message: "No active campaigns to sync." };
    }

    // Sync each campaign in its own step (durable, isolated failures)
    const results: { campaignId: string; status: "synced" | "skipped" | "error"; error?: string }[] = [];

    for (const campaign of campaigns) {
      // Skip if synced less than 20 minutes ago (avoid overlap with manual chat sync)
      if (campaign.lastSyncedAt) {
        const msSinceSync = Date.now() - new Date(campaign.lastSyncedAt).getTime();
        if (msSinceSync < 20 * 60 * 1000) {
          results.push({ campaignId: campaign.id, status: "skipped", error: "Recently synced (<20min)" });
          continue;
        }
      }

      const result = await step.run(`sync-${campaign.id}`, async () => {
        try {
          // Get ESP provider for this workspace (supports Instantly, Smartlead, Lemlist)
          const esp = await getESPProvider(campaign.workspaceId);
          if (!esp) {
            return { status: "skipped" as const, error: "No ESP connected" };
          }

          const syncResult = await syncSingleCampaign(
            esp,
            campaign.id,
            campaign.espCampaignId,
            campaign.workspaceId,
          );

          // Check for A/B variant auto-pause after syncing performance data
          try {
            const abResult = await checkAndPauseLosingVariant(campaign.id);
            if (abResult.paused) {
              logger.info("[analytics-cron] A/B variant auto-paused", {
                campaignId: campaign.id,
                message: abResult.message,
              });
            }
          } catch (abErr) {
            logger.warn("[analytics-cron] A/B check failed (non-blocking)", {
              campaignId: campaign.id,
              error: abErr instanceof Error ? abErr.message : String(abErr),
            });
          }

          return { status: "synced" as const, ...syncResult };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("Analytics sync failed for campaign", {
            campaignId: campaign.id,
            error: message,
          });
          return { status: "error" as const, error: message };
        }
      });

      results.push({
        campaignId: campaign.id,
        status: result.status,
        error: result.status === "error" || result.status === "skipped" ? result.error : undefined,
      });
    }

    const synced = results.filter((r) => r.status === "synced").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    logger.info("Analytics sync cron completed", { synced, skipped, errors });

    return { synced, skipped, errors, details: results };
  },
);

// ─── 2. Enrichment Batch (event-driven) ─────────────────────────────

export const enrichLeadsBatch = inngest.createFunction(
  {
    id: "enrich-leads-batch",
    concurrency: { limit: 3 },
    throttle: { limit: 18, period: "1m" },
  },
  { event: "leadsens/leads.enrich" },
  async ({ event, step }) => {
    const { leadIds, workspaceId, campaignId } = event.data as {
      leadIds: string[];
      workspaceId: string;
      campaignId: string;
    };

    // Dynamically import the enrichment logic to avoid circular deps
    const { enrichSingleLead } = await import("@/server/lib/enrichment/enrich-lead");

    const results: { leadId: string; status: "enriched" | "skipped" | "error" }[] = [];

    for (const leadId of leadIds) {
      const result = await step.run(`enrich-${leadId}`, async () => {
        try {
          await enrichSingleLead(leadId, workspaceId, campaignId);
          return { status: "enriched" as const };
        } catch (err) {
          logger.error("Enrichment failed", {
            leadId,
            error: err instanceof Error ? err.message : String(err),
          });
          return { status: "error" as const };
        }
      });
      results.push({ leadId, ...result });
    }

    return {
      total: leadIds.length,
      enriched: results.filter((r) => r.status === "enriched").length,
      errors: results.filter((r) => r.status === "error").length,
    };
  },
);

// ─── 3. Email Draft Batch (event-driven) ────────────────────────────

export const draftEmailsBatch = inngest.createFunction(
  {
    id: "draft-emails-batch",
    concurrency: { limit: 5 },
  },
  { event: "leadsens/emails.draft" },
  async ({ event, step }) => {
    const { leadIds, workspaceId, campaignId } = event.data as {
      leadIds: string[];
      workspaceId: string;
      campaignId: string;
    };

    // Dynamically import to avoid circular deps
    const { draftEmailsForLead } = await import("@/server/lib/email/draft-lead");

    const results: { leadId: string; status: "drafted" | "skipped" | "error" }[] = [];

    for (const leadId of leadIds) {
      const result = await step.run(`draft-${leadId}`, async () => {
        try {
          await draftEmailsForLead(leadId, workspaceId, campaignId);
          return { status: "drafted" as const };
        } catch (err) {
          logger.error("Email drafting failed", {
            leadId,
            error: err instanceof Error ? err.message : String(err),
          });
          return { status: "error" as const };
        }
      });
      results.push({ leadId, ...result });
    }

    return {
      total: leadIds.length,
      drafted: results.filter((r) => r.status === "drafted").length,
      errors: results.filter((r) => r.status === "error").length,
    };
  },
);
