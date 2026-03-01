import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { draftEmail } from "@/server/lib/email/drafting";
import { getStyleSamples } from "@/server/lib/email/style-learner";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";
import type { ToolDefinition, ToolContext } from "./types";

export function createEmailTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    draft_emails_batch: {
      name: "draft_emails_batch",
      description: "Draft 3 personalized emails (PAS, Value-add, Breakup) for each lead.",
      parameters: z.object({
        lead_ids: z.array(z.string()),
        campaign_id: z.string(),
      }),
      async execute(args) {
        const [workspace, campaign] = await Promise.all([
          prisma.workspace.findUniqueOrThrow({
            where: { id: ctx.workspaceId },
          }),
          prisma.campaign.findUniqueOrThrow({
            where: { id: args.campaign_id },
            select: { angle: true },
          }),
        ]);

        if (!workspace.companyDna) {
          return { error: "Company DNA not set. Please configure it in settings first." };
        }

        const companyDna = workspace.companyDna as unknown as CompanyDna | string;
        const campaignAngle = campaign.angle
          ? (campaign.angle as unknown as CampaignAngle)
          : undefined;

        const leads = await prisma.lead.findMany({
          where: {
            id: { in: args.lead_ids },
            workspaceId: ctx.workspaceId,
            status: "ENRICHED",
          },
        });

        const styleSamples = await getStyleSamples(ctx.workspaceId);
        let drafted = 0;
        let failed = 0;

        // Process leads with concurrency of 5
        const CONCURRENCY = 5;
        for (let i = 0; i < leads.length; i += CONCURRENCY) {
          const batch = leads.slice(i, i + CONCURRENCY);
          ctx.onStatus?.(`Drafting emails for leads ${i + 1}-${Math.min(i + CONCURRENCY, leads.length)}/${leads.length}...`);

          const results = await Promise.allSettled(
            batch.map(async (lead) => {
              const previousEmails: { step: number; subject: string }[] = [];

              for (let step = 0; step < 3; step++) {
                const result = await draftEmail({
                  lead: {
                    firstName: lead.firstName,
                    lastName: lead.lastName,
                    jobTitle: lead.jobTitle,
                    company: lead.company,
                    enrichmentData: lead.enrichmentData as EnrichmentData | null,
                  },
                  step,
                  companyDna,
                  campaignAngle,
                  workspaceId: ctx.workspaceId,
                  previousEmails,
                  styleSamples,
                });

                await prisma.draftedEmail.upsert({
                  where: {
                    leadId_step: { leadId: lead.id, step },
                  },
                  create: {
                    leadId: lead.id,
                    campaignId: args.campaign_id,
                    step,
                    subject: result.subject,
                    body: result.body,
                    model: "mistral-large-latest",
                  },
                  update: {
                    subject: result.subject,
                    body: result.body,
                    model: "mistral-large-latest",
                  },
                });

                previousEmails.push({ step, subject: result.subject });
              }

              await prisma.lead.update({
                where: { id: lead.id },
                data: { status: "DRAFTED" },
              });
            }),
          );

          for (const r of results) {
            if (r.status === "fulfilled") drafted++;
            else failed++;
          }
        }

        // Update campaign stats
        await prisma.campaign.update({
          where: { id: args.campaign_id },
          data: { leadsDrafted: drafted },
        });

        return { drafted, failed, total: leads.length };
      },
    },

    draft_single_email: {
      name: "draft_single_email",
      description: "Draft a single email for a lead (for chat preview).",
      parameters: z.object({
        lead_id: z.string(),
        step: z.number().int().min(0).max(2),
      }),
      async execute(args) {
        const workspace = await prisma.workspace.findUniqueOrThrow({
          where: { id: ctx.workspaceId },
        });

        if (!workspace.companyDna) {
          return { error: "Company DNA not set." };
        }

        const companyDna = workspace.companyDna as unknown as CompanyDna | string;

        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
        });

        if (!lead) return { error: "Lead not found" };

        // Fetch campaign angle if the lead belongs to a campaign
        let campaignAngle: CampaignAngle | undefined;
        if (lead.campaignId) {
          const campaign = await prisma.campaign.findUnique({
            where: { id: lead.campaignId },
            select: { angle: true },
          });
          if (campaign?.angle) {
            campaignAngle = campaign.angle as unknown as CampaignAngle;
          }
        }

        const styleSamples = await getStyleSamples(ctx.workspaceId);

        // Get previously drafted emails for this lead
        const previousDrafts = await prisma.draftedEmail.findMany({
          where: { leadId: lead.id, step: { lt: args.step } },
          orderBy: { step: "asc" },
        });

        const result = await draftEmail({
          lead: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            jobTitle: lead.jobTitle,
            company: lead.company,
            enrichmentData: lead.enrichmentData as EnrichmentData | null,
          },
          step: args.step,
          companyDna,
          campaignAngle,
          workspaceId: ctx.workspaceId,
          previousEmails: previousDrafts.map((d) => ({ step: d.step, subject: d.subject })),
          styleSamples,
        });

        return {
          subject: result.subject,
          body: result.body,
          leadId: lead.id,
          leadName: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
          leadCompany: lead.company,
          step: args.step,
        };
      },
    },

    render_email_preview: {
      name: "render_email_preview",
      description: "Render an inline email preview component in the chat.",
      parameters: z.object({
        lead_id: z.string(),
        step: z.number().int(),
        subject: z.string(),
        body: z.string(),
        lead_name: z.string(),
        lead_company: z.string().optional(),
      }),
      async execute(args) {
        return {
          __component: "email-preview",
          props: {
            leadId: args.lead_id,
            step: args.step,
            subject: args.subject,
            body: args.body,
            leadName: args.lead_name,
            leadCompany: args.lead_company,
          },
        };
      },
    },

    render_lead_table: {
      name: "render_lead_table",
      description:
        "Render an inline table of leads in the chat. " +
        "Use lead_ids for database leads, or pass a leads array directly (e.g. from instantly_preview_leads results).",
      parameters: z.object({
        title: z.string().optional(),
        lead_ids: z.array(z.string()).optional(),
        leads: z
          .array(
            z.object({
              email: z.string(),
              first_name: z.string().optional(),
              last_name: z.string().optional(),
              company_name: z.string().optional(),
              title: z.string().optional(),
            }),
          )
          .optional(),
      }),
      async execute(args) {
        let leadsData;

        if (args.lead_ids?.length) {
          leadsData = await prisma.lead.findMany({
            where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              jobTitle: true,
              icpScore: true,
              status: true,
            },
          });
        } else if (args.leads?.length) {
          const rawLeads = args.leads;
          leadsData = rawLeads.map((l: typeof rawLeads[number], i: number) => ({
            id: `preview-${i}`,
            firstName: l.first_name ?? null,
            lastName: l.last_name ?? null,
            email: l.email,
            company: l.company_name ?? null,
            jobTitle: l.title ?? null,
            icpScore: null,
            status: "PREVIEW",
          }));
        } else {
          return { error: "Provide either lead_ids or a leads array" };
        }

        return {
          __component: "lead-table",
          props: {
            title: args.title ?? "Leads",
            leads: leadsData,
          },
        };
      },
    },

    render_campaign_summary: {
      name: "render_campaign_summary",
      description: "Render an inline campaign summary component in the chat.",
      parameters: z.object({
        campaign_name: z.string(),
        total_leads: z.number().int(),
        scored: z.number().int(),
        enriched: z.number().int(),
        drafted: z.number().int(),
        pushed: z.number().int(),
        skipped: z.number().int(),
      }),
      async execute(args) {
        return {
          __component: "campaign-summary",
          props: {
            campaignName: args.campaign_name,
            totalLeads: args.total_leads,
            scored: args.scored,
            enriched: args.enriched,
            drafted: args.drafted,
            pushed: args.pushed,
            skipped: args.skipped,
          },
        };
      },
    },
  };
}
