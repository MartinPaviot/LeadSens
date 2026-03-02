import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getInstantlyClient } from "@/server/lib/connectors/instantly";
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
        // Remove filters from MOST RESTRICTIVE to LEAST.
        // Key insight: job_titles (exact match) is far more restrictive than
        // department + level (categorical). Remove title first, keep dept+level.

        const broadened = { ...args.search_filters };
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

        // ── Progressive auto-broadening ──
        // Priority: ALWAYS keep department (core user intent: "Sales").
        // Remove least important filters first, keep department/level last.
        //
        // Order: extras → employee_count → revenue → job_titles → level → industries → department

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
            console.log(`[instantly_count_leads] Broadening: removed extras: ${removed.join(", ")}`);
            const c = await tryCount("Step 1 (no extras)");
            if (c > 0) return { count: c, search_filters: broadened };
          }
        }

        // Step 2: Remove employee_count (often too restrictive, user may not care about exact range)
        if (broadened.employee_count) {
          delete broadened.employee_count;
          console.log("[instantly_count_leads] Broadening: removed employee_count");
          const c = await tryCount("Step 2 (no employeeCount)");
          if (c > 0) return { count: c, search_filters: broadened };
        }

        // Step 3: Remove revenue filter
        if (broadened.revenue) {
          delete broadened.revenue;
          console.log("[instantly_count_leads] Broadening: removed revenue");
          const c = await tryCount("Step 3 (no revenue)");
          if (c > 0) return { count: c, search_filters: broadened };
        }

        // Step 4: Remove job_titles (keep department + level for broad role coverage)
        if (broadened.job_titles) {
          delete broadened.job_titles;
          console.log("[instantly_count_leads] Broadening: removed job_titles (kept dept+level)");
          const c = await tryCount("Step 4 (no titles)");
          if (c > 0) return { count: c, search_filters: broadened };
        }

        // Step 5: Remove level only (keep department — "Sales" is the core intent)
        if (broadened.level) {
          delete broadened.level;
          console.log("[instantly_count_leads] Broadening: removed level (kept department)");
          const c = await tryCount("Step 5 (no level)");
          if (c > 0) return { count: c, search_filters: broadened };
        }

        // Step 6: Remove industries
        if (broadened.industries) {
          delete broadened.industries;
          console.log("[instantly_count_leads] Broadening: removed industries");
          const c = await tryCount("Step 6 (no industry)");
          if (c > 0) return { count: c, search_filters: broadened };
        }

        // Step 7: Last resort — remove department
        if (broadened.department) {
          delete broadened.department;
          console.log("[instantly_count_leads] Broadening: removed department (last resort)");
          const c = await tryCount("Step 7 (no department)");
          if (c > 0) return { count: c, search_filters: broadened };
        }

        // All broadening steps failed
        console.warn("[instantly_count_leads] All broadening steps exhausted, returning 0");
        return { count: 0, search_filters: broadened };
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

        // Deduplicate by name+company, then cap at 5
        const seen = new Set<string>();
        const unique = rawLeads.filter((l) => {
          const raw = l as unknown as Record<string, unknown>;
          const key = `${raw.first_name ?? raw.firstName ?? ""}|${raw.last_name ?? raw.lastName ?? ""}|${raw.company_name ?? raw.companyName ?? raw.company ?? ""}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const leads = unique.slice(0, 5);

        // Debug: log raw response structure to help diagnose field mapping issues
        if (leads.length > 0) {
          console.log("[instantly_preview_leads] Sample raw lead keys:", Object.keys(leads[0]));
          console.log("[instantly_preview_leads] Sample raw lead:", JSON.stringify(leads[0]).slice(0, 500));
        }

        // Defensive field mapping — handle both snake_case and camelCase API formats
        const raw = leads as unknown as Array<Record<string, unknown>>;
        const leadsData = raw.map((l, i) => ({
          id: `preview-${i}`,
          firstName: (l.first_name ?? l.firstName ?? null) as string | null,
          lastName: (l.last_name ?? l.lastName ?? null) as string | null,
          email: (l.email ?? l.emailAddress ?? "") as string,
          company: (l.company_name ?? l.companyName ?? l.company ?? null) as string | null,
          jobTitle: (l.title ?? l.jobTitle ?? l.job_title ?? null) as string | null,
          icpScore: null,
          status: "PREVIEW",
        }));

        // Minimal context for LLM (avoid it repeating data in text)
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
      description: "Source leads via Instantly SuperSearch. This uses the client's credits.",
      parameters: z.object({
        search_filters: searchFiltersParam,
        limit: z.number().int().min(1).max(10000),
        search_name: z.string(),
        list_name: z.string(),
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

        // Fetch sourced leads
        ctx.onStatus?.("Fetching sourced leads...");
        const { items: leads } = await client.listLeads({ listId: resourceId });

        // Debug: log raw API response field names to diagnose mapping
        if (leads.length > 0) {
          const raw = leads[0] as unknown as Record<string, unknown>;
          console.log("[instantly_source_leads] Raw lead keys:", Object.keys(raw));
          console.log("[instantly_source_leads] Raw lead sample:", JSON.stringify(raw).slice(0, 800));
        }

        // Store in DB — defensive mapping handles both snake_case and camelCase
        let stored = 0;
        for (const lead of leads) {
          const raw = lead as unknown as Record<string, unknown>;
          const email = (raw.email ?? raw.emailAddress ?? "") as string;
          if (!email) continue; // Skip leads without email

          await prisma.lead.upsert({
            where: {
              workspaceId_email: { workspaceId: ctx.workspaceId, email },
            },
            create: {
              workspaceId: ctx.workspaceId,
              email,
              firstName: (raw.first_name ?? raw.firstName ?? null) as string | null,
              lastName: (raw.last_name ?? raw.lastName ?? null) as string | null,
              company: (raw.company_name ?? raw.companyName ?? raw.company ?? null) as string | null,
              jobTitle: (raw.title ?? raw.job_title ?? raw.jobTitle ?? null) as string | null,
              linkedinUrl: (raw.linkedin_url ?? raw.linkedinUrl ?? raw.linkedin ?? null) as string | null,
              phone: (raw.phone ?? raw.phone_number ?? null) as string | null,
              website: (raw.website ?? raw.company_url ?? raw.domain ?? null) as string | null,
              country: (raw.country ?? raw.location ?? null) as string | null,
              companySize: (raw.company_size ?? raw.companySize ?? raw.employee_count ?? null) as string | null,
              industry: (raw.industry ?? null) as string | null,
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
      description: "List all email accounts connected to Instantly. Call this BEFORE instantly_create_campaign to let the user choose their sending account.",
      parameters: z.object({}),
      async execute() {
        const client = await getInstantlyClient(ctx.workspaceId);
        return client.listAccounts();
      },
    },
  };
}
