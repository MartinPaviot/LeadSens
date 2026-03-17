import { z } from "zod/v4";
import { getSchedulingProvider } from "@/server/lib/providers";
import type { ToolDefinition, ToolContext } from "./types";

export function createSchedulingTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    get_scheduling_links: {
      name: "get_scheduling_links",
      description:
        "Get available scheduling/booking links from the connected scheduling tool (e.g. Calendly).\n" +
        "Use this to retrieve booking URLs for email templates — include the link in email CTAs.",
      parameters: z.object({
        slug: z.string().optional().describe("Filter by event type slug or name"),
      }),
      async execute(args) {
        const provider = await getSchedulingProvider(ctx.workspaceId);
        if (!provider) {
          return { error: "No scheduling tool connected. Connect Calendly in Settings > Integrations." };
        }

        ctx.onStatus?.("Fetching scheduling links...");

        if (args.slug) {
          const link = await provider.getLink(args.slug);
          if (!link) return { error: `No scheduling link found matching "${args.slug}"` };
          return { links: [link] };
        }

        const links = await provider.getLinks();
        if (links.length === 0) {
          return { error: "No scheduling links found. Make sure you have event types configured in your scheduling tool." };
        }

        return {
          links,
          message: `Found ${links.length} scheduling link(s). Use these URLs in email CTAs.`,
        };
      },
    },
  };
}
