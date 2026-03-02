import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getInstantlyClient, normalizePreviewLead, normalizeStoredLead } from "@/server/lib/connectors/instantly";
import { parseICP } from "./icp-parser";
import type { ToolDefinition, ToolContext } from "./types";

// Lightweight schema for tool parameters — Mistral only needs to know
// "pass the search_filters object from parse_icp". The full searchFiltersSchema
// validation happens inside parse_icp, not at the tool-call level.
// Using the full schema (~1.9KB of JSON Schema with enums/unions) overwhelms
// Mistral's function calling parser and causes it to emit tool calls as text.
const searchFiltersParam = z
  .record(z.string(), z.unknown())
  .describe("The search_filters object returned by parse_icp. Pass as-is, do not modify.");

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
      description: "Estimate the number of leads available for given search filters. Automatically broadens filters if count is 0. Returns { count, search_filters }. Do NOT call this tool again after getting a result — use the returned search_filters directly for preview/source.",
      parameters: z.object({ search_filters: searchFiltersParam }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);

        // First attempt
        let result: { count: number };

        console.log("[instantly_count_leads] Filters:", JSON.stringify(args.search_filters).slice(0, 500));

        try {
          result = await client.countLeads(args.search_filters);
        } catch (err) {
          console.error("[instantly_count_leads] API error on first attempt:", err);
          return { count: 0, search_filters: args.search_filters };
        }

        console.log(`[instantly_count_leads] Initial count: ${result.count}`);

        if (result.count > 0) {
          return { count: result.count, search_filters: args.search_filters };
        }

        // ── Progressive auto-broadening ──
        // Strategy: NEVER remove department or level (core user intent).
        // Broaden company filters only, then niche-role titles, then industries.
        //
        // Order: extras → expand employee_count → revenue → job_titles → industries → STOP

        const broadened = { ...args.search_filters };
        const broadened_fields: string[] = [];
        const ALL_EMPLOYEE_RANGES = [
          "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
          "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
        ] as const;

        async function tryCount(label: string): Promise<number> {
          try {
            const retry = await client.countLeads(broadened);
            console.log(`[instantly_count_leads] ${label}: ${retry.count} leads`);
            return retry.count;
          } catch (err) {
            console.warn(`[instantly_count_leads] ${label} error:`, err);
            return 0;
          }
        }

        // Step 1: Strip extras the LLM added (news, technologies, etc.)
        {
          const extras = [
            "keyword_filter", "news", "funding_type", "technologies",
            "job_listing", "lookalike_domain",
          ] as const;
          const removed: string[] = [];
          for (const key of extras) {
            if ((broadened as Record<string, unknown>)[key] !== undefined) {
              delete (broadened as Record<string, unknown>)[key];
              removed.push(key);
            }
          }
          if (removed.length > 0) {
            broadened_fields.push(...removed);
            console.log(`[instantly_count_leads] Broadening: removed extras: ${removed.join(", ")}`);
            const c = await tryCount("Step 1 (no extras)");
            if (c > 0) return { count: c, search_filters: broadened, broadened_fields };
          }
        }

        // Step 2: Expand employee_count to ALL ranges (instead of removing)
        if (broadened.employee_count) {
          const current = broadened.employee_count as string[];
          if (current.length < ALL_EMPLOYEE_RANGES.length) {
            broadened.employee_count = [...ALL_EMPLOYEE_RANGES];
            broadened_fields.push("employee_count");
            console.log("[instantly_count_leads] Broadening: expanded employee_count to all ranges");
            const c = await tryCount("Step 2 (all employee ranges)");
            if (c > 0) return { count: c, search_filters: broadened, broadened_fields };
            // If still 0 with all ranges, remove entirely
            delete broadened.employee_count;
            console.log("[instantly_count_leads] Broadening: removed employee_count entirely");
            const c2 = await tryCount("Step 2b (no employee_count)");
            if (c2 > 0) return { count: c2, search_filters: broadened, broadened_fields };
          }
        }

        // Step 3: Remove revenue filter
        if (broadened.revenue) {
          delete broadened.revenue;
          broadened_fields.push("revenue");
          console.log("[instantly_count_leads] Broadening: removed revenue");
          const c = await tryCount("Step 3 (no revenue)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields };
        }

        // Step 4: Remove job_titles (only present for niche roles / Strategy B)
        if (broadened.job_titles) {
          delete broadened.job_titles;
          broadened_fields.push("job_titles");
          console.log("[instantly_count_leads] Broadening: removed job_titles");
          const c = await tryCount("Step 4 (no job_titles)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields };
        }

        // Step 5: Remove industries
        if (broadened.industries) {
          delete broadened.industries;
          broadened_fields.push("industries");
          console.log("[instantly_count_leads] Broadening: removed industries");
          const c = await tryCount("Step 5 (no industries)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields };
        }

        // STOP — never remove department or level (core user intent)
        console.warn("[instantly_count_leads] All broadening steps exhausted (department+level preserved), returning 0");
        return { count: 0, search_filters: broadened, broadened_fields };
      },
    },

    instantly_preview_leads: {
      name: "instantly_preview_leads",
      description:
        "Preview up to 5 sample leads for given search filters and render them as an inline table automatically. " +
        "Use the search_filters returned by instantly_count_leads. " +
        "DO NOT call render_lead_table after this — the table is already rendered. " +
        "DO NOT repeat the lead data in your text response — the table component handles the display.",
      parameters: z.object({ search_filters: searchFiltersParam }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        const rawLeads = await client.previewLeads(args.search_filters);

        // Normalize to consistent format, deduplicate by name+company, cap at 5
        const normalized = rawLeads.map(normalizePreviewLead);
        const seen = new Set<string>();
        const unique = normalized.filter((l) => {
          const key = `${l.firstName ?? ""}|${l.lastName ?? ""}|${l.company ?? ""}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const leads = unique.slice(0, 5);

        const leadsData = leads.map((l, i) => ({
          id: `preview-${i}`,
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          company: l.company,
          jobTitle: l.jobTitle,
          icpScore: null,
          status: "PREVIEW",
        }));

        const summary = leadsData
          .filter((l) => l.firstName || l.company)
          .map((l) => `${l.firstName ?? "?"} ${l.lastName ?? ""} - ${l.company ?? "?"} (${l.jobTitle ?? "?"})`.trim())
          .join(", ");

        return {
          preview_count: leadsData.length,
          sample_summary: summary || "Preview data loaded",
          _display_note: "The lead table is already rendered as an inline component. Do NOT generate a markdown table or list the leads in your text.",
          __component: "lead-table",
          props: {
            title: `Lead preview (${leadsData.length} profiles)`,
            leads: leadsData,
          },
        };
      },
    },

    instantly_source_leads: {
      name: "instantly_source_leads",
      description: "Source leads via Instantly SuperSearch. This uses the client's credits. Returns lead_ids and campaign_id for chaining to score_leads_batch.",
      parameters: z.object({
        search_filters: searchFiltersParam,
        limit: z.number().int().min(1).max(10000),
        search_name: z.string(),
        list_name: z.string(),
        icp_description: z.string().describe("The user's original ICP description in natural language"),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        ctx.onStatus?.("Launching SuperSearch sourcing...");

        // Start sourcing with email enrichment enabled
        const result = await client.sourceLeads({
          searchFilters: args.search_filters,
          limit: args.limit,
          searchName: args.search_name,
          listName: args.list_name,
          enrichment: { work_email_enrichment: true },
        });
        const resourceId = result.resourceId;

        // Poll until complete
        let inProgress = true;
        while (inProgress) {
          await new Promise((r) => setTimeout(r, 3000));
          const status = await client.getEnrichmentStatus(resourceId);
          inProgress = status.inProgress;
          ctx.onStatus?.("Sourcing in progress...");
        }

        // Fetch sourced leads and normalize field names
        ctx.onStatus?.("Fetching sourced leads...");
        const { items: leads } = await client.listLeads({ listId: resourceId });

        const leadIds: string[] = [];
        for (const lead of leads) {
          const n = normalizeStoredLead(lead);
          if (!n.email) continue; // Skip leads without email

          const dbLead = await prisma.lead.upsert({
            where: {
              workspaceId_email: { workspaceId: ctx.workspaceId, email: n.email },
            },
            create: {
              workspaceId: ctx.workspaceId,
              email: n.email,
              firstName: n.firstName,
              lastName: n.lastName,
              company: n.company,
              jobTitle: n.jobTitle,
              linkedinUrl: n.linkedinUrl,
              phone: n.phone,
              website: n.website,
              country: n.location,
              industry: null,
              instantlyListId: resourceId,
              status: "SOURCED",
            },
            update: {},
          });
          leadIds.push(dbLead.id);
        }

        // Create Campaign record to track pipeline progress
        const campaign = await prisma.campaign.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: args.search_name,
            icpDescription: args.icp_description,
            icpFilters: args.search_filters as unknown as Prisma.InputJsonValue,
            instantlyListId: resourceId,
            leadsTotal: leadIds.length,
            status: "SOURCING",
          },
        });

        // Link leads to campaign
        if (leadIds.length > 0) {
          await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { campaignId: campaign.id },
          });
        }

        return {
          sourced: leadIds.length,
          listId: resourceId,
          lead_ids: leadIds,
          campaign_id: campaign.id,
        };
      },
    },

    instantly_create_campaign: {
      name: "instantly_create_campaign",
      description:
        "Create a new campaign in Instantly with 3 email steps (PAS, Value-add, Breakup). " +
        "Steps use {{email_step_N_subject/body}} template variables automatically filled per lead. " +
        "REQUIRED: email_accounts must contain the sending email(s) chosen by the user. " +
        "Call instantly_list_accounts first, ask the user which account to use, then pass it here.",
      parameters: z.object({
        name: z.string(),
        daily_limit: z.number().int().optional(),
        email_accounts: z.array(z.string()).min(1).describe("Sending email account(s) selected by the user. REQUIRED."),
        delays: z
          .array(z.number().int())
          .length(3)
          .optional()
          .describe("Days between each step. Default [0, 3, 3]."),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        const delays = args.delays ?? [0, 3, 3];

        const steps = [0, 1, 2].map((i) => ({
          subject: `{{email_step_${i}_subject}}`,
          body: `{{email_step_${i}_body}}`,
          delay: delays[i],
        }));

        return client.createCampaign({
          name: args.name,
          steps,
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
          include: {
            emails: {
              select: { step: true, subject: true, body: true, userEdit: true },
            },
          },
        });

        let added = 0;
        for (const lead of leads) {
          const customVars: Record<string, string> = {};
          for (const email of lead.emails) {
            const rawBody = email.userEdit ?? email.body;
            // Convert \n to <br> for Instantly HTML rendering
            const htmlBody = rawBody.replace(/\n/g, "<br>");
            customVars[`email_step_${email.step}_subject`] = email.subject;
            customVars[`email_step_${email.step}_body`] = htmlBody;
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
      description: "List all email accounts connected to Instantly and render an interactive account picker. Call this BEFORE instantly_create_campaign. The user will select account(s) via the inline component.",
      parameters: z.object({
        total_leads: z.number().int().optional().describe("Number of leads to send to, used for multi-mailbox recommendation"),
      }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        const accountsData = await client.listAccounts();
        const totalLeads = args.total_leads ?? 0;
        const recommendedCount = Math.max(1, Math.ceil(totalLeads / 30));

        return {
          accounts: accountsData,
          total_leads: totalLeads,
          recommended_count: recommendedCount,
          __component: "account-picker",
          props: {
            accounts: accountsData,
            totalLeads,
            recommendedCount,
          },
        };
      },
    },
  };
}
