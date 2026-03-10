import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getInstantlyClient, normalizePreviewLead, normalizeStoredLead } from "@/server/lib/connectors/instantly";
import { parseICPv2, buildFilterSummary } from "./icp-parser";
import type { ToolDefinition, ToolContext } from "./types";
import { transitionLeadStatus } from "@/server/lib/lead-status";

/**
 * Build custom variables for a lead's emails to push to Instantly.
 * Exported for testing. Always sets v2/v3 subject vars to prevent
 * raw {{placeholder}} text from being sent to prospects.
 */
export function buildLeadCustomVars(
  emails: { step: number; subject: string; body: string; userEdit?: string | null; subjectVariants?: string[] | null }[],
): Record<string, string> {
  const customVars: Record<string, string> = {};
  for (const email of emails) {
    const rawBody = email.userEdit ?? email.body;
    const htmlBody = rawBody.replace(/\n/g, "<br>");
    customVars[`email_step_${email.step}_subject`] = email.subject;
    customVars[`email_step_${email.step}_body`] = htmlBody;

    // Always set v2/v3 custom vars — if no variants exist, fall back to primary subject
    // to prevent Instantly rendering raw {{email_step_N_subject_v2}} placeholder text
    const primarySubject = email.subject;
    customVars[`email_step_${email.step}_subject_v2`] = email.subjectVariants?.[0] ?? primarySubject;
    customVars[`email_step_${email.step}_subject_v3`] = email.subjectVariants?.[1] ?? primarySubject;
  }
  return customVars;
}

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
        const { filters, inferredIndustries, parseWarnings, approximations, clarificationNeeded } = await parseICPv2(args.description, ctx.workspaceId);

        // Description too vague — ask the user to clarify before proceeding
        if (clarificationNeeded) {
          return {
            status: "clarification_needed",
            message: clarificationNeeded,
          };
        }

        const result: Record<string, unknown> = {
          search_filters: filters,
          human_summary: buildFilterSummary(filters),
        };
        if (inferredIndustries?.length) {
          result.confirmation_needed = `J'ai déduit l'industrie « ${inferredIndustries.join(", ")} » de ta description car elle n'était pas explicitement spécifiée. Confirme que c'est correct ou précise l'industrie souhaitée avant de continuer.`;
        }
        if (parseWarnings?.length) {
          result.filter_warnings = parseWarnings;
        }
        if (approximations?.length) {
          result.filter_approximations = approximations;
        }
        return result;
      },
    },

    instantly_count_leads: {
      name: "instantly_count_leads",
      description: "Estimate the number of leads available for given search filters. Automatically broadens filters if count is 0. Returns { count, search_filters }. Do NOT call this tool again after getting a result — use the returned search_filters directly for preview/source.",
      parameters: z.object({ search_filters: searchFiltersParam }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);

        // First attempt
        let result: { count: number; warnings: string[] };

        console.log("[instantly_count_leads] Filters:", JSON.stringify(args.search_filters).slice(0, 500));

        try {
          result = await client.countLeads(args.search_filters);
        } catch (err) {
          console.error("[instantly_count_leads] API error on first attempt:", err);
          return { count: 0, search_filters: args.search_filters };
        }

        console.log(`[instantly_count_leads] Initial count: ${result.count}`);

        // Surface filter warnings (e.g. unresolved locations) to the LLM so it informs the user
        const filterWarnings = result.warnings.length > 0
          ? { filter_warnings: result.warnings }
          : {};

        if (result.count > 0) {
          return { count: result.count, search_filters: args.search_filters, ...filterWarnings };
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
            // Accumulate warnings from broadening attempts
            if (retry.warnings.length > 0) {
              for (const w of retry.warnings) {
                if (!result.warnings.includes(w)) result.warnings.push(w);
              }
            }
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
            if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
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
            if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
            // If still 0 with all ranges, remove entirely
            delete broadened.employee_count;
            console.log("[instantly_count_leads] Broadening: removed employee_count entirely");
            const c2 = await tryCount("Step 2b (no employee_count)");
            if (c2 > 0) return { count: c2, search_filters: broadened, broadened_fields, ...filterWarnings };
          }
        }

        // Step 3: Remove revenue filter
        if (broadened.revenue) {
          delete broadened.revenue;
          broadened_fields.push("revenue");
          console.log("[instantly_count_leads] Broadening: removed revenue");
          const c = await tryCount("Step 3 (no revenue)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
        }

        // Step 4: Remove job_titles (only present for niche roles / Strategy B)
        if (broadened.job_titles) {
          delete broadened.job_titles;
          broadened_fields.push("job_titles");
          console.log("[instantly_count_leads] Broadening: removed job_titles");
          const c = await tryCount("Step 4 (no job_titles)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
        }

        // Step 5: Remove industries
        if (broadened.industries) {
          delete broadened.industries;
          broadened_fields.push("industries");
          console.log("[instantly_count_leads] Broadening: removed industries");
          const c = await tryCount("Step 5 (no industries)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
        }

        // STOP — never remove department or level (core user intent)
        console.warn("[instantly_count_leads] All broadening steps exhausted (department+level preserved), returning 0");
        return { count: 0, search_filters: broadened, broadened_fields, ...filterWarnings };
      },
    },

    instantly_preview_leads: {
      name: "instantly_preview_leads",
      description:
        "Preview sample leads for given search filters and render them as an inline table automatically. " +
        "Default: 30 leads. The user can request more or less. " +
        "Use the search_filters returned by instantly_count_leads. " +
        "DO NOT call render_lead_table after this — the table is already rendered. " +
        "DO NOT repeat the lead data in your text response — the table component handles the display.",
      parameters: z.object({
        search_filters: searchFiltersParam,
        limit: z.number().int().min(1).max(50).optional().describe("Number of leads to preview. Default 30."),
      }),
      async execute(args) {
        const previewLimit = args.limit ?? 30;
        const client = await getInstantlyClient(ctx.workspaceId);
        const { leads: rawLeads, warnings } = await client.previewLeads(args.search_filters);

        // Normalize to consistent format, deduplicate by name+company
        const normalized = rawLeads.map(normalizePreviewLead);
        const seen = new Set<string>();
        const unique = normalized.filter((l) => {
          const key = `${l.firstName ?? ""}|${l.lastName ?? ""}|${l.company ?? ""}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const leads = unique.slice(0, previewLimit);

        const leadsData = leads.map((l, i) => ({
          id: `preview-${i}`,
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          company: l.company,
          jobTitle: l.jobTitle,
          linkedinUrl: l.linkedinUrl,
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
          ...(warnings.length > 0 ? { filter_warnings: warnings } : {}),
          _display_note: "The lead table is already rendered as an inline component. Do NOT generate a markdown table or list the leads in your text. If filter_warnings is present, WARN the user about these issues BEFORE showing results.",
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
        const sourceWarnings = result.warnings;

        // Poll until complete
        let inProgress = true;
        while (inProgress) {
          await new Promise((r) => setTimeout(r, 3000));
          const status = await client.getEnrichmentStatus(resourceId);
          inProgress = status.inProgress;
          ctx.onStatus?.("Sourcing in progress...");
        }

        // Fetch ALL sourced leads with pagination
        ctx.onStatus?.("Fetching sourced leads...");
        const allLeads: Awaited<ReturnType<typeof client.listLeads>>["items"] = [];
        let cursor: string | undefined;
        do {
          const page = await client.listLeads({ listId: resourceId, limit: 100, startingAfter: cursor });
          allLeads.push(...page.items);
          cursor = page.nextStartingAfter;
        } while (cursor);

        // Extract industry from ICP filters (available at sourcing time)
        const filters = args.search_filters as Record<string, unknown>;
        const icpIndustries = Array.isArray(filters.industries) ? filters.industries as string[] : [];
        const icpIndustry = icpIndustries.length > 0 ? icpIndustries.join(", ") : null;

        // ── Dedup: batch-query existing leads by email ──
        const allEmails = allLeads
          .map((l) => normalizeStoredLead(l).email)
          .filter((e): e is string => !!e);
        const uniqueEmails = [...new Set(allEmails.map((e) => e.toLowerCase()))];

        const existingLeads = uniqueEmails.length > 0
          ? await prisma.lead.findMany({
              where: { workspaceId: ctx.workspaceId, email: { in: uniqueEmails } },
              select: { id: true, email: true, status: true, campaignId: true },
            })
          : [];
        const existingByEmail = new Map(
          existingLeads.map((l) => [l.email.toLowerCase(), l]),
        );

        // Count existing leads by status for dedup report
        const statusCounts: Record<string, number> = {};
        let inActiveCampaign = 0;
        for (const ex of existingLeads) {
          statusCounts[ex.status] = (statusCounts[ex.status] ?? 0) + 1;
          if (ex.campaignId) inActiveCampaign++;
        }

        const newLeadIds: string[] = [];
        const skippedExisting: string[] = [];
        let totalWithEmail = 0;

        for (const lead of allLeads) {
          const n = normalizeStoredLead(lead);
          if (!n.email) continue;
          totalWithEmail++;

          const emailLower = n.email.toLowerCase();

          // Skip leads that already exist in the workspace
          if (existingByEmail.has(emailLower)) {
            skippedExisting.push(emailLower);
            continue;
          }

          try {
            const dbLead = await prisma.lead.create({
              data: {
                workspaceId: ctx.workspaceId,
                email: n.email,
                firstName: n.firstName,
                lastName: n.lastName,
                company: n.company,
                jobTitle: n.jobTitle,
                linkedinUrl: n.linkedinUrl,
                phone: n.phone,
                website: n.website,
                companyDomain: n.companyDomain,
                country: n.location,
                industry: icpIndustry,
                instantlyListId: resourceId,
                status: "SOURCED",
              },
            });
            newLeadIds.push(dbLead.id);
          } catch (err) {
            // P2002 = unique constraint violation (race condition) → treat as existing
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              skippedExisting.push(emailLower);
              continue;
            }
            throw err;
          }
        }

        // Create Campaign record to track pipeline progress
        const campaign = await prisma.campaign.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: args.search_name,
            icpDescription: args.icp_description,
            icpFilters: args.search_filters as unknown as Prisma.InputJsonValue,
            instantlyListId: resourceId,
            leadsTotal: newLeadIds.length,
            status: "SOURCING",
          },
        });

        // Link campaign ↔ conversation (1:1) so subsequent turns
        // can resolve the campaign from conversationId alone
        if (ctx.conversationId) {
          await prisma.conversation.update({
            where: { id: ctx.conversationId },
            data: { campaignId: campaign.id },
          });
        }

        // Link only NEW leads to campaign (existing leads keep their original campaign)
        if (newLeadIds.length > 0) {
          await prisma.lead.updateMany({
            where: { id: { in: newLeadIds } },
            data: { campaignId: campaign.id },
          });
        }

        // Fetch actual sourced lead details for LLM context + UI
        const sourcedLeads = newLeadIds.length > 0
          ? await prisma.lead.findMany({
              where: { id: { in: newLeadIds } },
              select: { id: true, firstName: true, lastName: true, company: true, jobTitle: true, email: true },
            })
          : [];

        const sourcedSummary = sourcedLeads
          .map((l) => `${l.firstName ?? "?"} ${l.lastName ?? ""} - ${l.company ?? "?"} (${l.jobTitle ?? "?"}) <${l.email}>`.trim())
          .join(", ");

        return {
          sourced: newLeadIds.length,
          sourced_leads_summary: sourcedSummary || "No lead details available",
          listId: resourceId,
          lead_ids: newLeadIds,
          campaign_id: campaign.id,
          ...(sourceWarnings.length > 0 ? { filter_warnings: sourceWarnings } : {}),
          dedup: {
            existing_count: skippedExisting.length,
            by_status: statusCounts,
            in_active_campaign: inActiveCampaign,
            total_from_api: totalWithEmail,
          },
          __component: "lead-table",
          props: {
            title: `Sourced leads (${sourcedLeads.length} profiles)`,
            leads: sourcedLeads.map((l) => ({
              id: l.id,
              firstName: l.firstName,
              lastName: l.lastName,
              email: l.email,
              company: l.company,
              jobTitle: l.jobTitle,
              linkedinUrl: null,
              icpScore: null,
              status: "SOURCED",
            })),
          },
        };
      },
    },

    instantly_create_campaign: {
      name: "instantly_create_campaign",
      description:
        "Create a new campaign in Instantly with 6 email steps (PAS Timeline Hook, Value-add, Social Proof, New Angle, Micro-value, Breakup). " +
        "Steps use {{email_step_N_subject/body}} template variables automatically filled per lead. " +
        "REQUIRED: email_accounts must contain the sending email(s) chosen by the user. " +
        "Call instantly_list_accounts first, ask the user which account to use, then pass it here.",
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
        const client = await getInstantlyClient(ctx.workspaceId);
        const delays = args.delays ?? [0, 2, 5, 9, 14, 21];

        const steps = [0, 1, 2, 3, 4, 5].map((i) => ({
          subject: `{{email_step_${i}_subject}}`,
          subjects: [
            `{{email_step_${i}_subject}}`,
            `{{email_step_${i}_subject_v2}}`,
            `{{email_step_${i}_subject_v3}}`,
          ],
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
              select: { step: true, subject: true, subjectVariants: true, body: true, userEdit: true },
            },
          },
        });

        // Filter out leads already pushed (prevent spam / double-push)
        const alreadyPushed = leads.filter((l) => l.status === "PUSHED");
        const safeToPush = leads.filter((l) => l.status !== "PUSHED");

        if (safeToPush.length === 0) {
          return {
            added: 0,
            skipped_already_pushed: alreadyPushed.length,
            warning: "All leads have already been pushed to a campaign.",
          };
        }

        let added = 0;
        for (const lead of safeToPush) {
          const customVars = buildLeadCustomVars(
            lead.emails.map((e) => ({
              step: e.step,
              subject: e.subject,
              body: e.body,
              userEdit: e.userEdit,
              subjectVariants: e.subjectVariants as string[] | null,
            })),
          );

          await client.createLead({
            email: lead.email,
            firstName: lead.firstName ?? undefined,
            lastName: lead.lastName ?? undefined,
            companyName: lead.company ?? undefined,
            campaign: args.campaign_id,
            customVariables: customVars,
          });

          await transitionLeadStatus(lead.id, "PUSHED");
          added++;
        }

        return {
          added,
          ...(alreadyPushed.length > 0 ? { skipped_already_pushed: alreadyPushed.length } : {}),
        };
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

    // ─── Monitoring Tools ──────────────────────────────────

    instantly_campaign_sending_status: {
      name: "instantly_campaign_sending_status",
      description: "Get real-time sending status for a campaign: how many leads are in progress, not yet contacted, and completed. Renders an inline status card.",
      parameters: z.object({
        campaign_id: z.string().describe("Instantly campaign ID"),
      }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        const status = await client.getCampaignSendingStatus(args.campaign_id);

        return {
          ...status,
          __component: "campaign-status",
          props: status,
        };
      },
    },

    instantly_pause_campaign: {
      name: "instantly_pause_campaign",
      description: "Pause a running campaign. Emails will stop sending.",
      parameters: z.object({
        campaign_id: z.string().describe("Instantly campaign ID"),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        await client.pauseCampaign(args.campaign_id);
        return { paused: true, campaign_id: args.campaign_id };
      },
    },

    instantly_campaign_analytics: {
      name: "instantly_campaign_analytics",
      description: "Get analytics for a campaign: emails sent, opened, replied, bounced, etc. Renders an inline analytics card.",
      parameters: z.object({
        campaign_id: z.string().describe("Instantly campaign ID"),
      }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        const analytics = await client.getCampaignAnalytics(args.campaign_id);

        return {
          ...analytics,
          __component: "campaign-analytics",
          props: analytics,
        };
      },
    },

    instantly_get_replies: {
      name: "instantly_get_replies",
      description: "Fetch recent replies (received emails) for a campaign. Useful to check what leads responded and their interest level.",
      parameters: z.object({
        campaign_id: z.string().describe("Instantly campaign ID"),
        limit: z.number().int().min(1).max(50).optional().describe("Max replies to fetch (default 25)"),
      }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        const res = await client.getEmails({
          campaign_id: args.campaign_id,
          email_type: "2", // ue_type 2 = received (reply)
          limit: args.limit ?? 25,
        });

        const replies = res.items.map((e) => ({
          id: e.id,
          from: e.from_address,
          to: e.to_address,
          subject: e.subject,
          preview: e.content_preview ?? "",
          timestamp: e.timestamp_created,
          is_auto_reply: e.is_auto_reply === 1,
          ai_interest: e.ai_interest_value,
          thread_id: e.thread_id,
        }));

        return {
          campaign_id: args.campaign_id,
          total_replies: replies.length,
          has_more: !!res.next_starting_after,
          replies,
        };
      },
    },
  };
}
