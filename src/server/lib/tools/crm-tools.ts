import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { searchContacts } from "@/server/lib/connectors/hubspot";
import { getCRMProvider } from "@/server/lib/providers";
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

    crm_create_contact: {
      name: "crm_create_contact",
      description: "Create a contact in CRM with all enrichment data for a qualified lead. Use when a lead is classified as interested.",
      parameters: z.object({
        lead_id: z.string().describe("Lead ID to push to CRM"),
      }),
      isSideEffect: true,
      async execute(args) {
        ctx.onStatus?.("Creating CRM contact...");

        const crm = await getCRMProvider(ctx.workspaceId);
        if (!crm) return { error: "No CRM connected. Connect HubSpot or Salesforce in Settings > Integrations." };

        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
        });
        if (!lead) return { error: "Lead not found." };

        // Check if already in CRM
        if (lead.crmContactId) {
          return {
            already_exists: true,
            crm_contact_id: lead.crmContactId,
            lead_id: lead.id,
            message: `Lead already exists in ${crm.name} (contact ID: ${lead.crmContactId}).`,
          };
        }

        const contact = await crm.createContact({
          email: lead.email,
          firstName: lead.firstName ?? undefined,
          lastName: lead.lastName ?? undefined,
          company: lead.company ?? undefined,
          jobTitle: lead.jobTitle ?? undefined,
          phone: lead.phone ?? undefined,
        });

        // Store CRM contact ID on lead
        await prisma.lead.update({
          where: { id: lead.id },
          data: { crmContactId: contact.id },
        });

        return {
          created: true,
          crm: crm.name,
          crm_contact_id: contact.id,
          lead_id: lead.id,
          lead_name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
          company: lead.company,
        };
      },
    },

    crm_create_deal: {
      name: "crm_create_deal",
      description: "Create a deal/opportunity in CRM pipeline for a qualified lead. The lead must already have a CRM contact.",
      parameters: z.object({
        lead_id: z.string().describe("Lead ID"),
        deal_title: z.string().optional().describe("Deal title. Defaults to '{Company} - {Campaign Name}'"),
        deal_value: z.number().optional().describe("Deal value in dollars"),
      }),
      isSideEffect: true,
      async execute(args) {
        ctx.onStatus?.("Creating CRM deal...");

        const crm = await getCRMProvider(ctx.workspaceId);
        if (!crm) return { error: "No CRM connected." };

        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
          include: { campaign: { select: { name: true } } },
        });
        if (!lead) return { error: "Lead not found." };

        // Ensure contact exists in CRM first
        if (!lead.crmContactId) {
          return { error: "Lead has no CRM contact. Create the contact first with crm_create_contact." };
        }

        // HubSpot deal creation via API
        // The CRMProvider interface doesn't have createDeal yet,
        // so we call HubSpot API directly for now
        const integration = await prisma.integration.findFirst({
          where: { workspaceId: ctx.workspaceId, type: "HUBSPOT", status: "ACTIVE" },
        });
        if (!integration?.accessToken) {
          return { error: "HubSpot not connected or missing access token." };
        }

        const { decrypt: decryptToken } = await import("@/lib/encryption");
        const accessToken = decryptToken(integration.accessToken);

        const dealTitle = args.deal_title ?? `${lead.company ?? "Unknown"} - ${lead.campaign?.name ?? "LeadSens"}`;

        const dealRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            properties: {
              dealname: dealTitle,
              pipeline: "default",
              dealstage: "appointmentscheduled",
              ...(args.deal_value ? { amount: String(args.deal_value) } : {}),
            },
          }),
        });

        if (!dealRes.ok) {
          const errText = await dealRes.text().catch(() => "");
          return { error: `Failed to create deal: ${dealRes.status} ${errText.slice(0, 200)}` };
        }

        const deal = await dealRes.json();

        // Associate deal with contact
        await fetch(
          `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts/${lead.crmContactId}/deal_to_contact`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ).catch(() => {
          // Association is best-effort
        });

        return {
          created: true,
          crm: crm.name,
          deal_id: deal.id,
          deal_title: dealTitle,
          lead_id: lead.id,
          contact_id: lead.crmContactId,
        };
      },
    },
  };
}
