/**
 * Demo Tools — Free sample search using Composio Apollo connector.
 *
 * Available ONLY when the user has no lead sourcing tool connected (no Instantly).
 * Returns max 5 leads to show value before requiring API keys.
 */

import { z } from "zod/v4";
import { isComposioEnabled } from "@/server/lib/composio/client";
import { searchPeopleComposio } from "@/server/lib/connectors/apollo-composio";
import { logger } from "@/lib/logger";
import type { ToolDefinition, ToolContext } from "./types";

interface DemoLead {
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  linkedin: string | null;
  isDemo: true;
}

export function createDemoTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    demo_search_leads: {
      name: "demo_search_leads",
      description:
        "Search for leads matching an ICP description. Returns up to 5 sample leads for free — no API key needed. Emails are hidden in demo mode. Use this when the user describes an ICP but has no lead sourcing tool connected.",
      parameters: z.object({
        titles: z
          .array(z.string())
          .describe("Job titles to search for (e.g. ['VP Sales', 'Head of Marketing'])"),
        locations: z
          .array(z.string())
          .optional()
          .describe("Geographic locations (e.g. ['United States', 'United Kingdom'])"),
      }),
      async execute(args) {
        if (!isComposioEnabled()) {
          return {
            error: "Demo search is not configured. Connect your Apollo account in Settings > Integrations for lead sourcing.",
          };
        }

        try {
          ctx.onStatus?.("Searching for matching leads...");

          const results = await searchPeopleComposio(ctx.workspaceId, {
            titles: args.titles,
            locations: args.locations,
            perPage: 5,
            page: 1,
          });

          if (results.length === 0) {
            return {
              error: "No leads found for those criteria. Try broader job titles or different locations.",
            };
          }

          const demoLeads: DemoLead[] = results.slice(0, 5).map((p) => ({
            name: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown",
            title: p.title ?? "Unknown",
            company: p.organizationName ?? "Unknown",
            industry: p.organizationIndustry ?? "—",
            location: [p.city, p.state, p.country].filter(Boolean).join(", ") || "—",
            linkedin: p.linkedinUrl ?? null,
            isDemo: true as const,
          }));

          logger.info("[demo] Returned demo leads", {
            count: demoLeads.length,
            titles: args.titles,
          });

          return {
            __component: "lead-table",
            props: {
              leads: demoLeads.map((l) => ({
                name: l.name,
                title: l.title,
                company: l.company,
                industry: l.industry,
                location: l.location,
                linkedin: l.linkedin,
                email: "Connect Apollo to reveal",
                isDemo: true,
              })),
              isDemo: true,
            },
            count: demoLeads.length,
            isDemo: true,
            message: `Found ${demoLeads.length} matching leads. Connect your Apollo or Instantly account for full access with verified emails and unlimited results.`,
          };
        } catch (err) {
          logger.error("[demo] Demo search failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          return {
            error: "Demo search is temporarily unavailable. Connect your Apollo account for full access.",
          };
        }
      },
    },
  };
}
