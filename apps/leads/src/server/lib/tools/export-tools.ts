import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getExportProvider } from "@/server/lib/providers";
import type { ToolDefinition, ToolContext } from "./types";
import { resolveCampaignId } from "./resolve-campaign";
import type { ExportRow } from "@/server/lib/providers/export-provider";

export function createExportTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    export_leads: {
      name: "export_leads",
      description:
        "Export leads or campaign results to a connected export destination (Airtable, Notion).\n" +
        "Pass a campaign_id to export all leads from that campaign, or pass lead_ids for specific leads.\n" +
        "Optionally specify a destination table/database ID.",
      parameters: z.object({
        campaign_id: z.string().optional().describe("Campaign ID; falls back to most recent"),
        lead_ids: z.array(z.string()).optional().describe("Specific lead IDs to export"),
        destination: z.string().optional().describe("Target table/database ID (e.g. baseId/tableId for Airtable, database ID for Notion)"),
      }),
      async execute(args) {
        const provider = await getExportProvider(ctx.workspaceId);
        if (!provider) {
          return { error: "No export destination connected. Connect Airtable or Notion in Settings > Integrations." };
        }

        let leads;
        if (args.lead_ids?.length) {
          leads = await prisma.lead.findMany({
            where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
            select: {
              email: true, firstName: true, lastName: true, company: true,
              jobTitle: true, linkedinUrl: true, phone: true, status: true,
              icpScore: true, country: true,
            },
          });
        } else {
          const campaignId = await resolveCampaignId(ctx, args.campaign_id);
          if (!campaignId) return { error: "No campaign found" };

          leads = await prisma.lead.findMany({
            where: { campaignId, workspaceId: ctx.workspaceId },
            select: {
              email: true, firstName: true, lastName: true, company: true,
              jobTitle: true, linkedinUrl: true, phone: true, status: true,
              icpScore: true, country: true,
            },
          });
        }

        if (leads.length === 0) return { error: "No leads to export" };

        ctx.onStatus?.(`Exporting ${leads.length} leads to ${provider.name}...`);

        const rows: ExportRow[] = leads.map((lead) => ({
          Email: lead.email,
          "First Name": lead.firstName ?? "",
          "Last Name": lead.lastName ?? "",
          Company: lead.company ?? "",
          "Job Title": lead.jobTitle ?? "",
          LinkedIn: lead.linkedinUrl ?? "",
          Phone: lead.phone ?? "",
          Status: lead.status,
          "ICP Score": lead.icpScore ?? 0,
          Country: lead.country ?? "",
        }));

        const result = await provider.exportRows(rows, args.destination);

        if (result.error) {
          return { error: result.error, exported: result.exported };
        }

        return {
          exported: result.exported,
          destination: provider.name,
          message: `Successfully exported ${result.exported} leads to ${provider.name}.`,
        };
      },
    },
  };
}
