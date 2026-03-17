import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { setJobProgress } from "@/lib/redis";
import { cacheInvalidatePattern } from "@/lib/cache";
import { syncSingleCampaign } from "@/server/lib/analytics/sync";
import { checkAndPauseLosingVariant, storeCampaignNotification } from "@/server/lib/analytics/ab-testing";
import { getReplyRateByQualityScore, getReplyRateByIcpScore } from "@/server/lib/analytics/correlator";
import { QUALITY_GATE_MEMORY_KEY } from "@/server/lib/email/quality-gate";
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

          // Invalidate correlator cache after sync updates performance data
          await cacheInvalidatePattern(`corr:*:${campaign.workspaceId}:*`);

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

    // ─── Apply Insights: close the feedback loop ─────────────────
    // Group campaigns by workspace to apply insights per-workspace
    const workspaceIds = [...new Set(campaigns.map((c) => c.workspaceId))];

    for (const wsId of workspaceIds) {
      await step.run(`apply-insights-${wsId}`, async () => {
        try {
          await applyInsights(wsId, campaigns.filter((c) => c.workspaceId === wsId).map((c) => c.id));
        } catch (err) {
          logger.warn("[analytics-cron] applyInsights failed (non-blocking)", {
            workspaceId: wsId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    }

    logger.info("Analytics sync cron completed", { synced, skipped, errors });

    return { synced, skipped, errors, details: results };
  },
);

// ─── Feedback Loop: applyInsights ─────────────────────────────────────

const QUALITY_GATE_MIN_SAMPLES = 30;
const ICP_ALERT_MIN_SAMPLES = 30;

/**
 * Close the feedback loop: turn insights into automatic actions.
 *
 * (a) Quality gate threshold — dynamically adjust based on performance data.
 *     If bucket "7-8" has reply rate >= bucket "9-10" (with enough samples),
 *     the threshold can safely drop from 8 → 7 for non-step-0 emails.
 *
 * (b) ICP score alert — notify the user if lower-scored leads outperform
 *     higher-scored ones, suggesting the ICP may be too restrictive.
 */
async function applyInsights(workspaceId: string, campaignIds: string[]): Promise<void> {
  // (a) Quality gate dynamic threshold
  const qualityRows = await getReplyRateByQualityScore(workspaceId);
  const bucket78 = qualityRows.find((r) => r.dimension === "7-8");
  const bucket910 = qualityRows.find((r) => r.dimension === "9-10");

  if (
    bucket78 && bucket910 &&
    bucket78.sent >= QUALITY_GATE_MIN_SAMPLES &&
    bucket910.sent >= QUALITY_GATE_MIN_SAMPLES &&
    bucket78.replyRate >= bucket910.replyRate
  ) {
    // Score 7-8 emails perform as well as 9-10 — safe to lower threshold
    await prisma.agentMemory.upsert({
      where: { workspaceId_key: { workspaceId, key: QUALITY_GATE_MEMORY_KEY } },
      create: {
        workspaceId,
        key: QUALITY_GATE_MEMORY_KEY,
        value: "7",
        category: "GENERAL",
      },
      update: { value: "7" },
    });
    logger.info("[apply-insights] Quality gate threshold lowered to 7", { workspaceId });
  }

  // (b) ICP score alert
  const icpRows = await getReplyRateByIcpScore(workspaceId);
  const icp78 = icpRows.find((r) => r.dimension === "7-8");
  const icp910 = icpRows.find((r) => r.dimension === "9-10");

  if (
    icp78 && icp910 &&
    icp78.sent >= ICP_ALERT_MIN_SAMPLES &&
    icp910.sent >= ICP_ALERT_MIN_SAMPLES &&
    icp78.replyRate > icp910.replyRate
  ) {
    const alertMessage = `Your leads scored 7-8 have a ${icp78.replyRate.toFixed(1)}% reply rate vs ${icp910.replyRate.toFixed(1)}% for score 9-10 leads (${icp78.sent} vs ${icp910.sent} sends). Your ICP might be too restrictive — consider broadening your targeting criteria.`;

    // Send alert to the first active campaign's conversation
    const firstCampaignId = campaignIds[0];
    if (firstCampaignId) {
      await storeCampaignNotification(workspaceId, firstCampaignId, alertMessage, "ICP Calibration Alert");
    }
    logger.info("[apply-insights] ICP calibration alert sent", { workspaceId });
  }
}

// ─── 2. Enrichment Batch (event-driven) ─────────────────────────────

export const enrichLeadsBatch = inngest.createFunction(
  {
    id: "enrich-leads-batch",
    concurrency: { limit: 3 },
    throttle: { limit: 18, period: "1m" },
  },
  { event: "leadsens/leads.enrich" },
  async ({ event, step }) => {
    const { leadIds, workspaceId, campaignId, jobId } = event.data;

    // Dynamically import the enrichment logic to avoid circular deps
    const { enrichSingleLead } = await import("@/server/lib/enrichment/enrich-lead");

    const results: { leadId: string; status: "enriched" | "skipped" | "error" }[] = [];

    for (let i = 0; i < leadIds.length; i++) {
      const leadId = leadIds[i];
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

      // Report progress to Redis for the chat UI progress bar
      await step.run(`progress-enrich-${i}`, async () => {
        await setJobProgress(jobId, {
          current: i + 1,
          total: leadIds.length,
          stage: "enriching",
          status: "running",
        });
      });
    }

    const enrichedIds = results
      .filter((r) => r.status === "enriched")
      .map((r) => r.leadId);
    const errorCount = results.filter((r) => r.status === "error").length;

    // Mark job as done
    await step.run("progress-enrich-done", async () => {
      await setJobProgress(jobId, {
        current: leadIds.length,
        total: leadIds.length,
        stage: "enriching",
        status: "done",
        completedAt: new Date().toISOString(),
      });
    });

    // Event chaining: auto-trigger drafting for enriched leads
    if (enrichedIds.length > 0) {
      await step.sendEvent("auto-draft", {
        name: "leadsens/emails.draft",
        data: {
          leadIds: enrichedIds,
          workspaceId,
          campaignId,
          jobId: `draft-${jobId}`,
        },
      });
    }

    return {
      total: leadIds.length,
      enriched: enrichedIds.length,
      errors: errorCount,
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
    const { leadIds, workspaceId, campaignId, jobId } = event.data;

    // Dynamically import to avoid circular deps
    const { draftEmailsForLead } = await import("@/server/lib/email/draft-lead");

    const results: { leadId: string; status: "drafted" | "skipped" | "error" }[] = [];

    for (let i = 0; i < leadIds.length; i++) {
      const leadId = leadIds[i];
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

      // Report progress
      await step.run(`progress-draft-${i}`, async () => {
        await setJobProgress(jobId, {
          current: i + 1,
          total: leadIds.length,
          stage: "drafting",
          status: "running",
        });
      });
    }

    const draftedCount = results.filter((r) => r.status === "drafted").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    // Mark job as done
    await step.run("progress-draft-done", async () => {
      await setJobProgress(jobId, {
        current: leadIds.length,
        total: leadIds.length,
        stage: "drafting",
        status: "done",
        completedAt: new Date().toISOString(),
      });
    });

    return {
      total: leadIds.length,
      drafted: draftedCount,
      errors: errorCount,
    };
  },
);
