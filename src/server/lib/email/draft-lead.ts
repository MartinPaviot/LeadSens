/**
 * Pure function entry point for drafting emails for a single lead.
 * Used by Inngest background jobs (event-driven).
 *
 * This is a thin wrapper around the same logic as draft_emails_batch tool,
 * but without ToolContext dependency (no onStatus, no inline components).
 *
 * TODO: Extract shared drafting logic from email-tools.ts into
 * reusable functions when "full auto" mode is activated (STRATEGY §4.5).
 */

import { prisma } from "@/lib/prisma";
import { draftEmail } from "@/server/lib/email/drafting";
import { draftWithQualityGate } from "@/server/lib/email/quality-gate";
import { getStyleSamples, getWinningEmailPatterns, BODY_STYLE_CATEGORIES } from "@/server/lib/email/style-learner";
import { getDataDrivenWeights, getStepAnnotation } from "@/server/lib/analytics/adaptive";
import { getReplyRateBySubjectPattern } from "@/server/lib/analytics/correlator";
import { formatPatternRanking } from "@/server/lib/analytics/thompson-sampling";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { LeadTier } from "@/server/lib/enrichment/icp-scorer";
import { parseCompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";
import { prioritizeSignals, getFramework } from "@/server/lib/email/prompt-builder";
import { transitionLeadStatus } from "@/server/lib/lead-status";
import { logger } from "@/lib/logger";

function buildDraftMetadata(lead: { enrichmentData?: unknown; industry?: string | null }, step: number, body: string) {
  const ed = lead.enrichmentData as EnrichmentData | null;
  const signals = ed ? prioritizeSignals(ed) : [];
  const framework = getFramework(step);
  return {
    signalType: signals[0]?.type ?? null,
    signalCount: signals.length,
    frameworkName: framework.name,
    enrichmentDepth: classifyEnrichmentDepth(ed),
    bodyWordCount: body.split(/\s+/).filter(Boolean).length,
    leadIndustry: lead.industry ?? (ed?.industry as string | undefined) ?? null,
  };
}

function classifyEnrichmentDepth(ed: EnrichmentData | null | undefined): string {
  if (!ed) return "none";
  let fields = 0;
  if (ed.companySummary) fields++;
  if (ed.painPoints?.length) fields++;
  if (ed.products?.length) fields++;
  if (ed.techStack?.length) fields++;
  if (ed.signals?.length || ed.hiringSignals?.length || ed.fundingSignals?.length || ed.leadershipChanges?.length) fields++;
  if (ed.linkedinHeadline) fields++;
  if (ed.recentLinkedInPosts?.length) fields++;
  if (ed.careerHistory?.length) fields++;
  if (ed.valueProposition) fields++;
  if (ed.targetMarket) fields++;
  if (fields >= 5) return "rich";
  if (fields >= 3) return "partial";
  if (fields >= 1) return "minimal";
  return "none";
}

export async function draftEmailsForLead(
  leadId: string,
  workspaceId: string,
  campaignId: string,
): Promise<void> {
  const [lead, workspace, campaign] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, workspaceId } }),
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { angle: true, icpDescription: true },
    }),
  ]);

  if (!lead || !workspace?.companyDna) return;

  let companyDna: CompanyDna | string;
  try {
    const parsed = parseCompanyDna(workspace.companyDna);
    if (!parsed) return;
    companyDna = parsed;
  } catch {
    logger.error("[draft-bg] Company DNA malformed", { workspaceId });
    return;
  }

  const campaignAngle = campaign?.angle
    ? (campaign.angle as unknown as CampaignAngle)
    : undefined;

  const [styleSamples, subjectStyleSamples, signalWeights, winningPatterns, patternStats] = await Promise.all([
    getStyleSamples(workspaceId, 5, BODY_STYLE_CATEGORIES),
    getStyleSamples(workspaceId, 3, "subject"),
    getDataDrivenWeights(workspaceId),
    getWinningEmailPatterns(workspaceId),
    getReplyRateBySubjectPattern(workspaceId, campaignId),
  ]);
  const patternRanking = formatPatternRanking(patternStats);

  const previousEmails: { step: number; subject: string; body?: string }[] = [];
  const leadName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim();

  for (let step = 0; step < 6; step++) {
    const stepAnnotation = await getStepAnnotation(workspaceId, step);

    const { subject, subjects, body, qualityScore } = await draftWithQualityGate({
      draftFn: () =>
        draftEmail({
          lead: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            jobTitle: lead.jobTitle,
            company: lead.company,
            industry: lead.industry,
            companySize: lead.companySize,
            country: lead.country,
            enrichmentData: lead.enrichmentData as EnrichmentData | null,
          },
          step,
          companyDna,
          campaignAngle,
          workspaceId,
          previousEmails,
          styleSamples,
          subjectStyleSamples,
          icpDescription: campaign?.icpDescription ?? undefined,
          signalWeights: signalWeights ?? undefined,
          stepAnnotation: stepAnnotation ?? undefined,
          winningPatterns: winningPatterns.length > 0 ? winningPatterns : undefined,
          patternRanking: patternRanking || undefined,
          tier: (lead.icpBreakdown as Record<string, unknown> | null)?.tier as LeadTier | undefined,
        }),
      context: { leadName, leadJobTitle: lead.jobTitle, leadCompany: lead.company, step },
      workspaceId,
    });

    const altSubjects = subjects?.filter((s) => s !== subject) ?? [];
    const metadata = buildDraftMetadata(lead, step, body);

    await prisma.draftedEmail.upsert({
      where: { leadId_step: { leadId: lead.id, step } },
      create: {
        leadId: lead.id,
        campaignId,
        step,
        subject,
        subjectVariants: altSubjects.length > 0 ? altSubjects : undefined,
        body,
        qualityScore: qualityScore.overall,
        model: "mistral-large-latest",
        ...metadata,
      },
      update: {
        subject,
        subjectVariants: altSubjects.length > 0 ? altSubjects : undefined,
        body,
        qualityScore: qualityScore.overall,
        model: "mistral-large-latest",
        ...metadata,
      },
    });

    previousEmails.push({ step, subject, body });
  }

  await transitionLeadStatus(lead.id, "DRAFTED");
}
