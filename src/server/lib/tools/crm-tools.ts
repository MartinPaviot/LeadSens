import { z } from "zod/v4";
import { searchContacts } from "@/server/lib/connectors/hubspot";
import type { ToolDefinition, ToolContext } from "./types";

export function createCrmTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    crm_check_duplicates: {
      name: "crm_check_duplicates",
      description: "Check which lead emails already exist in HubSpot CRM to avoid duplicates.",
      parameters: z.object({
        emails: z.array(z.string()),
      }),
      async execute(args) {
        ctx.onStatus?.("Checking duplicates in your CRM...");

        const existingContacts = await searchContacts(ctx.workspaceId, args.emails);
        const existingEmails = new Set(
          existingContacts
            .map((c) => c.properties.email?.toLowerCase())
            .filter(Boolean),
        );

        const emails: string[] = args.emails;
        const duplicates = emails.filter((email) => existingEmails.has(email.toLowerCase()));
        const newEmails = emails.filter((email) => !existingEmails.has(email.toLowerCase()));

        return {
          duplicates,
          newEmails,
          duplicateCount: duplicates.length,
          newCount: newEmails.length,
        };
      },
    },
  };
}
