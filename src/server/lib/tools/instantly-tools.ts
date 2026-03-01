import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import {
  getInstantlyClient,
  searchFiltersSchema,
} from "@/server/lib/connectors/instantly";
import { parseICP } from "./icp-parser";
import type { ToolDefinition, ToolContext } from "./types";

export function createInstantlyTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    parse_icp: {
      name: "parse_icp",
      description: "Parse a natural language ICP description into Instantly SuperSearch filters. ALWAYS call this FIRST before instantly_count_leads/instantly_preview_leads/instantly_source_leads. Handles all mapping (industry, employee ranges, locations, job titles) automatically. Returns { search_filters } to pass directly to the other tools.",
      parameters: z.object({
        description: z.string().describe("The user's ICP description in natural language"),
      }),
      async execute(args) {
        const filters = await parseICP(args.description, ctx.workspaceId);
        return { search_filters: filters };
      },
    },

    instantly_count_leads: {
      name: "instantly_count_leads",
      description: "Estimate the number of leads available for given search filters.",
      parameters: z.object({ search_filters: searchFiltersSchema }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        return client.countLeads(args.search_filters);
      },
    },

    instantly_preview_leads: {
      name: "instantly_preview_leads",
      description: "Preview up to 5 sample leads for given search filters.",
      parameters: z.object({ search_filters: searchFiltersSchema }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        return client.previewLeads(args.search_filters);
      },
    },

    instantly_source_leads: {
      name: "instantly_source_leads",
      description: "Source leads via Instantly SuperSearch. This uses the client's credits.",
      parameters: z.object({
        search_filters: searchFiltersSchema,
        limit: z.number().int().min(1).max(10000),
        search_name: z.string(),
        list_name: z.string(),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        ctx.onStatus?.("Launching SuperSearch sourcing...");

        // Start sourcing
        const { resourceId } = await client.sourceLeads({
          searchFilters: args.search_filters,
          limit: args.limit,
          searchName: args.search_name,
          listName: args.list_name,
        });

        // Poll until complete
        let inProgress = true;
        while (inProgress) {
          await new Promise((r) => setTimeout(r, 3000));
          const status = await client.getEnrichmentStatus(resourceId);
          inProgress = status.inProgress;
          ctx.onStatus?.("Sourcing in progress...");
        }

        // Fetch sourced leads
        ctx.onStatus?.("Fetching sourced leads...");
        const { items: leads } = await client.listLeads({ listId: resourceId });

        // Store in DB
        let stored = 0;
        for (const lead of leads) {
          await prisma.lead.upsert({
            where: {
              workspaceId_email: { workspaceId: ctx.workspaceId, email: lead.email },
            },
            create: {
              workspaceId: ctx.workspaceId,
              email: lead.email,
              firstName: lead.first_name,
              lastName: lead.last_name,
              company: lead.company_name,
              jobTitle: lead.title,
              linkedinUrl: lead.linkedin_url,
              phone: lead.phone,
              website: lead.website,
              country: lead.country,
              companySize: lead.company_size,
              industry: lead.industry,
              instantlyListId: resourceId,
              status: "SOURCED",
            },
            update: {},
          });
          stored++;
        }

        return { sourced: stored, listId: resourceId };
      },
    },

    instantly_create_campaign: {
      name: "instantly_create_campaign",
      description: "Create a new campaign in Instantly.",
      parameters: z.object({
        name: z.string(),
        steps: z.array(z.object({
          subject: z.string().optional(),
          body: z.string(),
          type: z.string().optional(),
        })),
        daily_limit: z.number().int().optional(),
        email_accounts: z.array(z.string()).optional(),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        return client.createCampaign({
          name: args.name,
          sequences: [{ steps: args.steps }],
          dailyLimit: args.daily_limit,
          emailList: args.email_accounts,
        });
      },
    },

    instantly_add_leads_to_campaign: {
      name: "instantly_add_leads_to_campaign",
      description: "Add leads with drafted emails as custom variables to a campaign.",
      parameters: z.object({
        campaign_id: z.string(),
        lead_ids: z.array(z.string()),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        ctx.onStatus?.("Adding leads to campaign...");

        const leads = await prisma.lead.findMany({
          where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
          include: { emails: true },
        });

        let added = 0;
        for (const lead of leads) {
          const customVars: Record<string, string> = {};
          for (const email of lead.emails) {
            customVars[`email_step_${email.step}_subject`] = email.subject;
            customVars[`email_step_${email.step}_body`] = email.body;
          }

          await client.createLead({
            email: lead.email,
            firstName: lead.firstName ?? undefined,
            lastName: lead.lastName ?? undefined,
            companyName: lead.company ?? undefined,
            campaign: args.campaign_id,
            customVariables: customVars,
          });

          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "PUSHED" },
          });
          added++;
        }

        return { added };
      },
    },

    instantly_activate_campaign: {
      name: "instantly_activate_campaign",
      description: "Activate a campaign. Emails will start sending.",
      parameters: z.object({ campaign_id: z.string() }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        await client.activateCampaign(args.campaign_id);
        return { activated: true };
      },
    },

    instantly_list_accounts: {
      name: "instantly_list_accounts",
      description: "List all email accounts connected to Instantly.",
      parameters: z.object({}),
      async execute() {
        const client = await getInstantlyClient(ctx.workspaceId);
        return client.listAccounts();
      },
    },
  };
}
