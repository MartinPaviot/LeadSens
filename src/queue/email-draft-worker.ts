import { prisma } from "@/lib/prisma";
import { draftEmail } from "@/server/lib/email/drafting";
import { getStyleSamples } from "@/server/lib/email/style-learner";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";
import { createWorker } from "./factory";

interface EmailDraftJobData {
  leadId: string;
  campaignId: string;
  workspaceId: string;
}

export const emailDraftWorker = createWorker(
  "email:draft",
  async (job: { data: EmailDraftJobData }) => {
    const { leadId, campaignId, workspaceId } = job.data;

    const [lead, workspace, campaign, styleSamples] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { angle: true },
      }),
      getStyleSamples(workspaceId),
    ]);

    if (!lead || !workspace?.companyDna) return;

    const companyDna = workspace.companyDna as unknown as CompanyDna | string;
    const campaignAngle = campaign?.angle
      ? (campaign.angle as unknown as CampaignAngle)
      : undefined;

    const previousEmails: { step: number; subject: string }[] = [];

    for (let step = 0; step < 3; step++) {
      const result = await draftEmail({
        lead: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          jobTitle: lead.jobTitle,
          company: lead.company,
          companySize: lead.companySize,
          enrichmentData: lead.enrichmentData as EnrichmentData | null,
        },
        step,
        companyDna,
        campaignAngle,
        workspaceId,
        previousEmails,
        styleSamples,
      });

      await prisma.draftedEmail.upsert({
        where: {
          leadId_step: { leadId: lead.id, step },
        },
        create: {
          leadId: lead.id,
          campaignId,
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
  },
  {
    concurrency: 5,
  },
);
