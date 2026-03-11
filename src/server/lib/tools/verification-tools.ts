import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getEmailVerifier } from "@/server/lib/providers";
import type { ToolDefinition, ToolContext } from "./types";
import { resolveCampaignId } from "./resolve-campaign";

export function createVerificationTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    verify_emails: {
      name: "verify_emails",
      description:
        "Verify email addresses via ZeroBounce before pushing to a campaign.\n" +
        "Checks validity of lead emails: valid, invalid, catch-all, unknown.\n" +
        "Invalid leads are marked SKIPPED. Catch-all leads are flagged but included.\n" +
        "Two modes: pass lead_ids explicitly, or omit to auto-find all enriched/drafted leads in the campaign.",
      parameters: z.object({
        lead_ids: z.array(z.string()).optional().describe("Lead IDs to verify; omit to auto-find from campaign"),
        campaign_id: z.string().optional().describe("Campaign ID; falls back to most recent"),
      }),
      async execute(args) {
        const verifier = await getEmailVerifier(ctx.workspaceId);
        if (!verifier) {
          return { error: "No email verifier connected. Connect ZeroBounce in Settings > Integrations." };
        }

        const campaignId = await resolveCampaignId(ctx, args.campaign_id);
        if (!campaignId) return { error: "No campaign found" };

        let leads;
        if (args.lead_ids?.length) {
          leads = await prisma.lead.findMany({
            where: {
              id: { in: args.lead_ids },
              workspaceId: ctx.workspaceId,
            },
            select: { id: true, email: true, firstName: true, lastName: true, company: true, status: true },
          });
        } else {
          // Auto: find all enriched/drafted leads that haven't been verified
          leads = await prisma.lead.findMany({
            where: {
              campaignId,
              workspaceId: ctx.workspaceId,
              status: { in: ["ENRICHED", "DRAFTED"] },
            },
            select: { id: true, email: true, firstName: true, lastName: true, company: true, status: true },
          });
          if (leads.length === 0) return { error: "No enriched/drafted leads to verify in this campaign" };
        }

        // Check credits first
        if (verifier.getCredits) {
          try {
            const credits = await verifier.getCredits();
            if (credits < leads.length) {
              return {
                error: `Not enough ZeroBounce credits: ${credits} available, ${leads.length} needed. Top up your ZeroBounce account.`,
                credits,
                leads_to_verify: leads.length,
              };
            }
          } catch {
            // Non-blocking — proceed anyway
          }
        }

        ctx.onStatus?.(`Verifying ${leads.length} email addresses...`);

        const emails = leads.map((l) => l.email);
        const result = await verifier.verifyBatch(emails);

        // Map results back to leads
        const resultMap = new Map(result.results.map((r) => [r.email.toLowerCase(), r]));
        let valid = 0;
        let invalid = 0;
        let catchAll = 0;
        let unknown = 0;
        const skippedIds: string[] = [];

        for (const lead of leads) {
          const vr = resultMap.get(lead.email.toLowerCase());
          if (!vr) {
            unknown++;
            await prisma.lead.update({
              where: { id: lead.id },
              data: { verificationStatus: "unknown" },
            });
            continue;
          }

          if (vr.status === "invalid" || vr.status === "spamtrap" || vr.status === "abuse" || vr.status === "disposable") {
            // Mark as SKIPPED with reason + store verification status
            await prisma.lead.update({
              where: { id: lead.id },
              data: { status: "SKIPPED", verificationStatus: vr.status },
            });
            invalid++;
            skippedIds.push(lead.id);
          } else if (vr.status === "valid") {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { verificationStatus: "valid" },
            });
            valid++;
          } else if (vr.status === "catch_all") {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { verificationStatus: "catch_all" },
            });
            catchAll++;
          } else {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { verificationStatus: vr.status },
            });
            unknown++;
          }
        }

        // Update campaign skip count
        if (skippedIds.length > 0) {
          const currentCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { leadsSkipped: true },
          });
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { leadsSkipped: (currentCampaign?.leadsSkipped ?? 0) + skippedIds.length },
          });
        }

        return {
          total: leads.length,
          valid,
          invalid,
          catch_all: catchAll,
          unknown,
          skipped_lead_ids: skippedIds,
          message: invalid > 0
            ? `${invalid} leads with invalid emails were marked as SKIPPED. ${valid} valid, ${catchAll} catch-all (included).`
            : `All ${valid} emails verified as valid. ${catchAll > 0 ? `${catchAll} catch-all addresses included.` : ""}`,
        };
      },
    },
  };
}
