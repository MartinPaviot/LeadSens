/**
 * ESP Tools — Generic tools that work with any connected ESP
 * (Instantly, Smartlead, or Lemlist) via the ESPProvider interface.
 *
 * Tools: list_accounts, create_campaign, add_leads_to_campaign,
 *        activate_campaign, pause_campaign, campaign_sending_status,
 *        campaign_analytics, get_replies
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getESPProvider, getESPType } from "@/server/lib/providers";
import { getEmailVerifier } from "@/server/lib/providers";
import { transitionLeadStatus } from "@/server/lib/lead-status";
import { inngest } from "@/inngest/client";
import {
  buildLeadCustomVars,
  checkVerificationGate,
  ALREADY_CONTACTED_STATUSES,
  analyzeCrossCampaignDedup,
} from "./tool-utils";
import { computeLeadTier, type LeadTier } from "@/server/lib/enrichment/icp-scorer";
import type { ToolDefinition, ToolContext } from "./types";

const NO_ESP_ERROR = "No email sending platform connected. Connect Instantly, Smartlead, or Lemlist in Settings > Integrations.";

// ─── Tier-based Cadences ────────────────────────────────

export const TIER_CADENCES: Record<LeadTier, number[]> = {
  1: [0, 1, 3, 6, 10, 15],   // Aggressive: hot contacts, shorter window
  2: [0, 2, 5, 9, 14, 21],   // Standard (current default)
  3: [0, 3, 7, 14, 21, 30],  // Patient: nurture, no pressure
};

/** Get the predominant tier from a set of lead scores. Returns the most common tier. */
export function getPredominantTier(scores: number[]): LeadTier {
  if (scores.length === 0) return 2;
  const tiers = scores.map((s) => computeLeadTier(s));
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const t of tiers) counts[t]++;
  if (counts[1] >= counts[2] && counts[1] >= counts[3]) return 1;
  if (counts[3] > counts[2] && counts[3] > counts[1]) return 3;
  return 2;
}

export function createESPTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    list_accounts: {
      name: "list_accounts",
      description: "List all email accounts connected to your ESP and render an interactive account picker. Call this BEFORE create_campaign. The user will select account(s) via the inline component.",
      parameters: z.object({
        total_leads: z.number().int().optional().describe("Number of leads to send to, used for multi-mailbox recommendation"),
      }),
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        const accounts = await esp.listAccounts();
        const totalLeads = args.total_leads ?? 0;
        const recommendedCount = Math.max(1, Math.ceil(totalLeads / 30));

        return {
          accounts,
          total_leads: totalLeads,
          recommended_count: recommendedCount,
          esp_name: esp.name,
          __component: "account-picker",
          props: {
            accounts,
            totalLeads,
            recommendedCount,
          },
        };
      },
    },

    create_campaign: {
      name: "create_campaign",
      description:
        "Create a new campaign with 6 email steps (PAS Timeline Hook, Value-add, Social Proof, New Angle, Micro-value, Breakup). " +
        "Steps use {{email_step_N_subject/body}} template variables automatically filled per lead. " +
        "REQUIRED: email_accounts must contain the sending email(s) chosen by the user. " +
        "Call list_accounts first, ask the user which account to use, then pass it here.",
      parameters: z.object({
        name: z.string(),
        daily_limit: z.number().int().optional(),
        email_accounts: z.array(z.string()).min(1).describe("Sending email account(s) selected by the user. REQUIRED."),
        delays: z
          .array(z.number().int())
          .length(6)
          .optional()
          .describe("Days between each step. Default [0, 2, 5, 9, 14, 21]."),
      }),
      isSideEffect: true,
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        let delays = args.delays;
        let tierUsed: LeadTier | undefined;
        if (!delays) {
          // Auto-select cadence based on predominant lead tier
          const existingCampaign = await prisma.campaign.findFirst({
            where: { workspaceId: ctx.workspaceId, status: { in: ["DRAFTING", "READY"] } },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          });
          if (existingCampaign) {
            const leadScores = await prisma.lead.findMany({
              where: { campaignId: existingCampaign.id, icpScore: { not: null } },
              select: { icpScore: true },
            });
            const scores = leadScores.map((l) => l.icpScore!);
            if (scores.length > 0) {
              tierUsed = getPredominantTier(scores);
              delays = TIER_CADENCES[tierUsed];
            }
          }
          if (!delays) delays = TIER_CADENCES[2]; // Default to Tier 2
        }

        const steps = [0, 1, 2, 3, 4, 5].map((i) => ({
          subject: `{{email_step_${i}_subject}}`,
          body: `{{email_step_${i}_body}}`,
          delay: delays[i],
          // A/B subject variants for ESPs that support them
          subjectVariants: [
            `{{email_step_${i}_subject_v2}}`,
            `{{email_step_${i}_subject_v3}}`,
          ],
        }));

        const campaign = await esp.createCampaign({
          name: args.name,
          steps,
          accountEmails: args.email_accounts,
          dailyLimit: args.daily_limit,
        });

        // Store espType on campaign for routing analytics/webhooks later
        const espType = await getESPType(ctx.workspaceId);

        // Link to existing Campaign record if available
        const existingCampaign = await prisma.campaign.findFirst({
          where: { workspaceId: ctx.workspaceId, status: { in: ["DRAFTING", "READY"] } },
          orderBy: { updatedAt: "desc" },
        });

        if (existingCampaign) {
          await prisma.campaign.update({
            where: { id: existingCampaign.id },
            data: {
              espCampaignId: campaign.id,
              espType,
              status: "READY",
            },
          });
        }

        return {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          esp_name: esp.name,
          status: campaign.status,
          ...(tierUsed ? { tier: tierUsed, cadence_note: `Using Tier ${tierUsed} cadence [${delays.join(", ")}]` } : {}),
        };
      },
    },

    add_leads_to_campaign: {
      name: "add_leads_to_campaign",
      description: "Add leads with drafted emails as custom variables to a campaign.",
      parameters: z.object({
        campaign_id: z.string(),
        lead_ids: z.array(z.string()),
        skip_dedup_check: z.boolean().optional().describe("Skip cross-campaign dedup check after user confirmed overlap is intentional"),
      }),
      isSideEffect: true,
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        ctx.onStatus?.("Adding leads to campaign...");

        const leads = await prisma.lead.findMany({
          where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
          include: {
            emails: {
              select: { step: true, subject: true, subjectVariants: true, body: true, userEdit: true },
            },
          },
        });

        // Filter out leads already in active outreach (PUSHED, SENT, REPLIED, etc.)
        const alreadyActive = leads.filter((l) => ALREADY_CONTACTED_STATUSES.has(l.status));
        const safeToPush = leads.filter((l) => !ALREADY_CONTACTED_STATUSES.has(l.status));

        if (safeToPush.length === 0) {
          return {
            added: 0,
            skipped_already_active: alreadyActive.length,
            warning: "All leads have already been pushed or are in active outreach.",
          };
        }

        // Cross-campaign dedup: check if any lead emails were already contacted in OTHER active campaigns
        if (!args.skip_dedup_check) {
          const emails = safeToPush.map((l) => l.email);
          const perfInOther = await prisma.emailPerformance.findMany({
            where: {
              email: { in: emails },
              campaignId: { not: args.campaign_id },
              campaign: {
                workspaceId: ctx.workspaceId,
                status: { in: ["PUSHED", "ACTIVE"] },
              },
            },
            select: {
              email: true,
              campaignId: true,
              campaign: { select: { name: true } },
            },
          });

          if (perfInOther.length > 0) {
            const dedup = analyzeCrossCampaignDedup(
              emails,
              perfInOther.map((p) => ({
                email: p.email,
                campaignId: p.campaignId,
                campaignName: p.campaign.name,
              })),
            );

            return {
              cross_campaign_warning: `⚠️ ${dedup.duplicateCount} leads are already being contacted in active campaigns: ${dedup.campaignNames.join(", ")}. Push ${dedup.safeEmails.length} safe leads only, or re-run with skip_dedup_check to push all.`,
              duplicates: dedup.duplicates.map((d) => ({
                email: d.email,
                active_campaign: d.campaignName,
              })),
              safe_count: dedup.safeEmails.length,
              duplicate_count: dedup.duplicateCount,
              total_leads: safeToPush.length,
            };
          }
        }

        // Pre-push verification gate
        const verifier = await getEmailVerifier(ctx.workspaceId);
        const gate = checkVerificationGate(
          safeToPush.map((l) => ({ verificationStatus: l.verificationStatus })),
          verifier !== null,
        );
        if (!gate.canPush) {
          return {
            added: 0,
            blocked: true,
            verification_gate: gate.warning,
            invalid_count: gate.invalidCount,
            unverified_count: gate.unverifiedCount,
          };
        }

        // Resolve the ESP campaign ID from the internal campaign
        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { espCampaignId: true },
        });
        const espCampaignId = campaign?.espCampaignId;
        if (!espCampaignId) {
          return { error: "Campaign has no ESP campaign ID. Create a campaign first." };
        }

        // Background dispatch for large batches (>20 leads)
        const PUSH_BACKGROUND_THRESHOLD = 20;
        if (safeToPush.length > PUSH_BACKGROUND_THRESHOLD) {
          const jobId = crypto.randomUUID();
          await inngest.send({
            name: "leadsens/campaign.push",
            data: {
              campaignId: args.campaign_id,
              workspaceId: ctx.workspaceId,
              leadIds: safeToPush.map((l) => l.id),
              espCampaignId,
              jobId,
            },
          });

          return {
            status: "queued",
            jobId,
            total: safeToPush.length,
            message: `Pushing ${safeToPush.length} leads to campaign in background.`,
            __component: "job-progress",
            props: {
              jobId,
              label: "Pushing leads to campaign",
              total: safeToPush.length,
            },
          };
        }

        // Build custom variables and push to ESP
        const espLeads = safeToPush.map((lead) => {
          const customVars = buildLeadCustomVars(
            lead.emails.map((e) => ({
              step: e.step,
              subject: e.subject,
              body: e.body,
              userEdit: e.userEdit,
              subjectVariants: e.subjectVariants as string[] | null,
            })),
          );

          return {
            email: lead.email,
            firstName: lead.firstName ?? undefined,
            lastName: lead.lastName ?? undefined,
            company: lead.company ?? undefined,
            customVariables: customVars,
          };
        });

        const result = await esp.addLeads(espCampaignId, espLeads);

        // Transition all pushed leads to PUSHED status
        for (const lead of safeToPush) {
          await transitionLeadStatus(lead.id, "PUSHED");
        }

        return {
          added: result.added,
          ...(result.skipped ? { skipped: result.skipped } : {}),
          ...(alreadyActive.length > 0 ? { skipped_already_active: alreadyActive.length } : {}),
          ...(gate.warning ? { verification_warning: gate.warning } : {}),
          ...(result.errors?.length ? { errors: result.errors } : {}),
        };
      },
    },

    activate_campaign: {
      name: "activate_campaign",
      description: "Activate a campaign. Emails will start sending.",
      parameters: z.object({ campaign_id: z.string() }),
      isSideEffect: true,
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        // Resolve ESP campaign ID
        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { espCampaignId: true },
        });
        if (!campaign?.espCampaignId) {
          return { error: "Campaign has no ESP campaign ID." };
        }

        await esp.activateCampaign(campaign.espCampaignId);
        return { activated: true };
      },
    },

    pause_campaign: {
      name: "pause_campaign",
      description: "Pause a running campaign. Emails will stop sending.",
      parameters: z.object({
        campaign_id: z.string().describe("Internal campaign ID"),
      }),
      isSideEffect: true,
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { espCampaignId: true },
        });
        if (!campaign?.espCampaignId) {
          return { error: "Campaign has no ESP campaign ID." };
        }

        await esp.pauseCampaign(campaign.espCampaignId);
        return { paused: true, campaign_id: args.campaign_id };
      },
    },

    campaign_sending_status: {
      name: "campaign_sending_status",
      description: "Get real-time sending status for a campaign: how many leads are in progress, not yet contacted, and completed. Renders an inline status card.",
      parameters: z.object({
        campaign_id: z.string().describe("Internal campaign ID"),
      }),
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { espCampaignId: true },
        });
        if (!campaign?.espCampaignId) {
          return { error: "Campaign has no ESP campaign ID." };
        }

        const status = await esp.getCampaignStatus(campaign.espCampaignId);

        return {
          ...status,
          __component: "campaign-status",
          props: status,
        };
      },
    },

    campaign_analytics: {
      name: "campaign_analytics",
      description: "Get analytics for a campaign: emails sent, opened, replied, bounced, etc. Renders an inline analytics card.",
      parameters: z.object({
        campaign_id: z.string().describe("Internal campaign ID"),
      }),
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { espCampaignId: true },
        });
        if (!campaign?.espCampaignId) {
          return { error: "Campaign has no ESP campaign ID." };
        }

        const analytics = await esp.getCampaignAnalytics(campaign.espCampaignId);

        return {
          ...analytics,
          __component: "campaign-analytics",
          props: analytics,
        };
      },
    },

    get_replies: {
      name: "get_replies",
      description: "Fetch recent replies (received emails) for a campaign. Useful to check what leads responded and their interest level.",
      parameters: z.object({
        campaign_id: z.string().describe("Internal campaign ID"),
        limit: z.number().int().min(1).max(50).optional().describe("Max replies to fetch (default 25)"),
      }),
      async execute(args) {
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) return { error: NO_ESP_ERROR };

        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { espCampaignId: true },
        });
        if (!campaign?.espCampaignId) {
          return { error: "Campaign has no ESP campaign ID." };
        }

        const res = await esp.getEmails({
          campaignId: campaign.espCampaignId,
          emailType: "received",
          limit: args.limit ?? 25,
        });

        return {
          campaign_id: args.campaign_id,
          total_replies: res.items.length,
          has_more: res.hasMore,
          replies: res.items.map((e) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            subject: e.subject,
            preview: e.preview ?? "",
            timestamp: e.timestamp,
            is_auto_reply: e.isAutoReply ?? false,
            ai_interest: e.aiInterest,
            thread_id: e.threadId,
          })),
        };
      },
    },

    preview_campaign_launch: {
      name: "preview_campaign_launch",
      description: "Show a visual preview of the campaign before launch: lead count, email count, sequence timeline, sample email. Call this BEFORE create_campaign to give the user a clear picture.",
      parameters: z.object({
        campaign_id: z.string().describe("Internal campaign ID"),
      }),
      async execute(args) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
          select: { id: true, name: true, stepsCount: true },
        });
        if (!campaign) return { error: "Campaign not found" };

        const [leadCount, emailCount, sampleEmail] = await Promise.all([
          prisma.lead.count({
            where: { campaignId: campaign.id, status: { not: "SKIPPED" } },
          }),
          prisma.draftedEmail.count({
            where: { campaignId: campaign.id },
          }),
          prisma.draftedEmail.findFirst({
            where: { campaignId: campaign.id, step: 0 },
            select: {
              subject: true,
              subjectVariants: true,
              body: true,
              lead: { select: { firstName: true, company: true } },
            },
          }),
        ]);

        const frameworks = ["PAS", "Value-add", "Social Proof", "New Angle", "Micro-value", "Breakup"];
        const delays = [0, 2, 5, 9, 14, 21];
        const timeline = delays.slice(0, campaign.stepsCount).map((d, i) => ({
          day: d,
          framework: frameworks[i] ?? `Step ${i}`,
        }));

        return {
          __component: "campaign-launch-preview",
          props: {
            campaignName: campaign.name,
            leadCount,
            emailCount,
            stepsCount: campaign.stepsCount,
            timeline,
            sampleEmail: sampleEmail ? {
              subject: sampleEmail.subject,
              bodySnippet: sampleEmail.body.slice(0, 150) + (sampleEmail.body.length > 150 ? "..." : ""),
              leadName: sampleEmail.lead.firstName ?? "Lead",
              company: sampleEmail.lead.company ?? "",
              variantCount: Array.isArray(sampleEmail.subjectVariants) ? (sampleEmail.subjectVariants as string[]).length : 0,
            } : null,
          },
          campaignId: campaign.id,
          leadCount,
          emailCount,
        };
      },
    },
  };
}
