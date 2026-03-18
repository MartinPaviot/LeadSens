import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { draftEmail } from "@/server/lib/email/drafting";
import { draftWithQualityGate } from "@/server/lib/email/quality-gate";
import { getStyleSamples, getWinningEmailPatterns, getWinningSubjects, BODY_STYLE_CATEGORIES } from "@/server/lib/email/style-learner";
import { getSignalRanking, getStepAnnotation } from "@/server/lib/analytics/adaptive";
import { getReplyRateBySubjectPattern } from "@/server/lib/analytics/correlator";
import { formatPatternRanking } from "@/server/lib/analytics/thompson-sampling";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { LeadTier } from "@/server/lib/enrichment/icp-scorer";
import { parseCompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";
import { prioritizeSignals, getFramework } from "@/server/lib/email/prompt-builder";
import { detectSubjectPattern } from "@/server/lib/analytics/correlator";
import type { ToolDefinition, ToolContext } from "./types";
import { resolveCampaignId } from "./resolve-campaign";
import { logger } from "@/lib/logger";
import { transitionLeadStatus } from "@/server/lib/lead-status";
import { inngest } from "@/inngest/client";

/** Classify how much enrichment data is available for a lead */
export function classifyEnrichmentDepth(ed: EnrichmentData | null | undefined): string {
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

/** Build metadata fields for DraftedEmail correlation */
export function buildDraftMetadata(lead: { enrichmentData?: unknown; industry?: string | null }, step: number, body: string, subject: string) {
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
    subjectPattern: detectSubjectPattern(subject),
  };
}

export function createEmailTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    draft_emails_batch: {
      name: "draft_emails_batch",
      description:
        "Draft 6 personalized emails (PAS, Value-add, Social Proof, New Angle, Micro-value, Breakup) for leads.\n" +
        "Two modes:\n" +
        "1. Auto (preferred): pass campaign_id + count — pulls top N enriched leads from DB by ICP score\n" +
        "2. Explicit: pass campaign_id + lead_ids\n" +
        "Batches >3 leads run in background with a live progress bar.",
      parameters: z.object({
        lead_ids: z.array(z.string()).optional().describe("Explicit lead IDs. Omit to auto-select top enriched leads."),
        campaign_id: z.string().optional().describe("Campaign ID; falls back to conversation's campaign"),
        count: z.coerce.number().int().min(1).max(50).optional().describe("Number of top leads to draft (used when lead_ids omitted). Default: 5"),
      }),
      async execute(args) {
        // Resolve campaign
        const campaignId = args.campaign_id ?? (await resolveCampaignId(ctx))!;
        if (!campaignId) return { error: "No campaign found. Source leads first." };

        // Resolve leads: explicit IDs or auto-select top N enriched
        let leadIds: string[];
        if (args.lead_ids?.length) {
          leadIds = args.lead_ids;
        } else {
          const topLeads = await prisma.lead.findMany({
            where: {
              campaignId,
              workspaceId: ctx.workspaceId,
              status: "ENRICHED",
            },
            select: { id: true },
            orderBy: { icpScore: { sort: "desc", nulls: "last" } },
            take: args.count ?? 5,
          });
          if (topLeads.length === 0) return { error: "No enriched leads to draft. Run the pipeline: score → enrich → draft." };
          leadIds = topLeads.map((l) => l.id);
        }

        // ─── Background dispatch for large batches ───────────────
        const BACKGROUND_THRESHOLD = 3;
        if (leadIds.length > BACKGROUND_THRESHOLD) {
          const jobId = crypto.randomUUID();
          await inngest.send({
            name: "leadsens/emails.draft",
            data: {
              leadIds,
              workspaceId: ctx.workspaceId,
              campaignId,
              jobId,
            },
          });

          return {
            status: "queued",
            jobId,
            total: leadIds.length,
            message: `Drafting emails for ${leadIds.length} leads in background.`,
            __component: "job-progress",
            props: {
              jobId,
              label: "Drafting emails",
              total: leadIds.length,
            },
          };
        }

        const [workspace, campaign] = await Promise.all([
          prisma.workspace.findUniqueOrThrow({
            where: { id: ctx.workspaceId },
          }),
          prisma.campaign.findUniqueOrThrow({
            where: { id: campaignId },
            select: { name: true, angle: true, icpDescription: true },
          }),
        ]);

        if (!workspace.companyDna) {
          return { error: "Company DNA not set. Please configure it in settings first." };
        }

        let companyDna: CompanyDna | string;
        try {
          const parsed = parseCompanyDna(workspace.companyDna);
          if (!parsed) return { error: "Company DNA not set. Please configure it in settings first." };
          companyDna = parsed;
        } catch (err) {
          return { error: `Company DNA is malformed: ${err instanceof Error ? err.message : "unknown error"}. Please re-analyze your website.` };
        }
        const campaignAngle = campaign.angle
          ? (campaign.angle as unknown as CampaignAngle)
          : undefined;

        const leads = await prisma.lead.findMany({
          where: {
            id: { in: leadIds },
            workspaceId: ctx.workspaceId,
            status: "ENRICHED",
          },
        });

        // Load style + adaptive data + pattern performance in parallel
        const [styleSamples, subjectStyleSamples, signalWeights, winningPatterns, winningSubjects, patternStats] = await Promise.all([
          getStyleSamples(ctx.workspaceId, 5, BODY_STYLE_CATEGORIES),
          getStyleSamples(ctx.workspaceId, 3, "subject"),
          getSignalRanking(ctx.workspaceId),
          getWinningEmailPatterns(ctx.workspaceId),
          getWinningSubjects(ctx.workspaceId),
          getReplyRateBySubjectPattern(ctx.workspaceId, campaignId),
        ]);
        const patternRanking = formatPatternRanking(patternStats);

        let drafted = 0;
        let failed = 0;

        // Process leads with concurrency of 5
        const CONCURRENCY = 5;
        for (let i = 0; i < leads.length; i += CONCURRENCY) {
          const batch = leads.slice(i, i + CONCURRENCY);
          ctx.onStatus?.(`Drafting emails for leads ${i + 1}-${Math.min(i + CONCURRENCY, leads.length)}/${leads.length}...`);

          const results = await Promise.allSettled(
            batch.map(async (lead) => {
              const previousEmails: { step: number; subject: string; body?: string }[] = [];
              const leadName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim();

              for (let step = 0; step < 6; step++) {
                // Load step annotation lazily (only for this step)
                const stepAnnotation = await getStepAnnotation(ctx.workspaceId, step);

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
                      workspaceId: ctx.workspaceId,
                      previousEmails,
                      styleSamples,
                      subjectStyleSamples,
                      icpDescription: campaign.icpDescription ?? undefined,
                      signalWeights: signalWeights ?? undefined,
                      stepAnnotation: stepAnnotation ?? undefined,
                      winningPatterns: winningPatterns.length > 0 ? winningPatterns : undefined,
                      patternRanking: patternRanking || undefined,
                      winningSubjects: winningSubjects.length > 0 ? winningSubjects : undefined,
                      tier: (lead.icpBreakdown as Record<string, unknown> | null)?.tier as LeadTier | undefined,
                    }),
                  context: {
                    leadName,
                    leadJobTitle: lead.jobTitle,
                    leadCompany: lead.company,
                    step,
                    enrichmentCompleteness: lead.enrichmentCompleteness,
                  },
                  workspaceId: ctx.workspaceId,
                });

                // Filter out the primary subject from variants to store only alternatives
                const altSubjects = subjects?.filter((s) => s !== subject) ?? [];

                const metadata = buildDraftMetadata(lead, step, body, subject);

                await prisma.draftedEmail.upsert({
                  where: {
                    leadId_step: { leadId: lead.id, step },
                  },
                  create: {
                    leadId: lead.id,
                    campaignId,
                    workspaceId: ctx.workspaceId,
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
            }),
          );

          for (const r of results) {
            if (r.status === "fulfilled") drafted++;
            else {
              failed++;
              logger.error("[draft_emails_batch] Lead draft failed:", {
                error: r.reason instanceof Error ? r.reason.message : String(r.reason),
              });
            }
          }
        }

        // Update campaign stats
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { leadsDrafted: drafted },
        });

        // Auto-render email sequence view for the first sample lead (all steps)
        const sampleLead = await prisma.lead.findFirst({
          where: {
            id: { in: leadIds },
            workspaceId: ctx.workspaceId,
            status: "DRAFTED",
          },
          include: {
            emails: {
              orderBy: { step: "asc" },
              select: { id: true, step: true, subject: true, body: true, qualityScore: true, signalType: true, bodyWordCount: true, enrichmentDepth: true },
            },
          },
        });

        const components: Array<{ component: string; props: Record<string, unknown> }> = [];

        if (sampleLead && sampleLead.emails.length > 0) {
          const leadName = `${sampleLead.firstName ?? ""} ${sampleLead.lastName ?? ""}`.trim();
          const sequenceEmails = sampleLead.emails.map((email) => ({
            emailId: email.id,
            step: email.step,
            subject: email.subject,
            body: email.body,
            leadName,
            leadCompany: sampleLead.company,
            qualityScore: email.qualityScore,
            wordCount: email.bodyWordCount,
          }));

          components.push({
            component: "email-sequence",
            props: {
              emails: sequenceEmails,
              campaignName: campaign.name,
              leadCount: drafted,
            },
          });
        }

        return {
          drafted,
          failed,
          total: leads.length,
          ...(components.length > 0
            ? { __components: components }
            : {}),
        };
      },
    },

    draft_single_email: {
      name: "draft_single_email",
      description:
        "Draft a single email for a lead. Three ways to identify the lead:\n" +
        "1. lead_id — if you have it from a previous tool call in the SAME session\n" +
        "2. lead_name or lead_email — resolved within the campaign\n" +
        "3. Neither — auto-picks the single enriched lead in the current conversation's campaign",
      parameters: z.object({
        lead_id: z.string().optional().describe("Lead ID if known"),
        lead_name: z.string().optional().describe("Lead name — resolved within campaign"),
        lead_email: z.string().optional().describe("Lead email — resolved within campaign"),
        campaign_id: z.string().optional().describe("Campaign ID if known; falls back to most recent"),
        step: z.coerce.number().int().min(0).max(5),
      }),
      async execute(args) {
        const workspace = await prisma.workspace.findUniqueOrThrow({
          where: { id: ctx.workspaceId },
        });

        if (!workspace.companyDna) {
          return { error: "Company DNA not set." };
        }

        let companyDna: CompanyDna | string;
        try {
          const parsed = parseCompanyDna(workspace.companyDna);
          if (!parsed) return { error: "Company DNA not set." };
          companyDna = parsed;
        } catch (err) {
          return { error: `Company DNA is malformed: ${err instanceof Error ? err.message : "unknown error"}. Please re-analyze your website.` };
        }

        // ── Lead resolution: id > name/email > auto ──
        let lead;

        if (args.lead_id) {
          lead = await prisma.lead.findFirst({
            where: { id: args.lead_id, workspaceId: ctx.workspaceId },
          });
        } else {
          const campaignId = await resolveCampaignId(ctx, args.campaign_id);
          if (!campaignId) return { error: "No campaign found for this conversation. You must call source_leads first to create a campaign before drafting emails." };

          if (args.lead_name || args.lead_email) {
            const campaignLeads = await prisma.lead.findMany({
              where: { campaignId, workspaceId: ctx.workspaceId },
            });
            const query = (args.lead_name ?? args.lead_email ?? "").toLowerCase();
            lead = campaignLeads.find((l) => {
              const fullName = [l.firstName, l.lastName].filter(Boolean).join(" ").toLowerCase();
              const email = (l.email ?? "").toLowerCase();
              return fullName.includes(query) || email.includes(query);
            });
          } else {
            // Auto: find single eligible lead (ENRICHED+ for drafting)
            const eligible = await prisma.lead.findMany({
              where: {
                campaignId,
                workspaceId: ctx.workspaceId,
                status: { in: ["ENRICHED", "DRAFTED", "PUSHED"] },
              },
            });
            if (eligible.length === 0) return { error: "No enriched leads in this campaign" };
            if (eligible.length > 1) {
              return {
                error: `${eligible.length} enriched leads found. Specify which one.`,
                leads: eligible.map((l) => ({
                  id: l.id,
                  name: [l.firstName, l.lastName].filter(Boolean).join(" "),
                  email: l.email,
                  company: l.company,
                })),
              };
            }
            lead = eligible[0];
          }
        }

        if (!lead) return { error: "Lead not found" };

        // Guard: only ENRICHED+ leads can be drafted (prevents bypassing scoring/enrichment)
        if (lead.status !== "ENRICHED" && lead.status !== "DRAFTED" && lead.status !== "PUSHED") {
          return { error: `Lead must be enriched first (current status: ${lead.status}). Run the full pipeline: score → enrich → draft.` };
        }

        // Fetch campaign angle + ICP description if the lead belongs to a campaign
        let campaignAngle: CampaignAngle | undefined;
        let icpDescription: string | undefined;
        if (lead.campaignId) {
          const campaign = await prisma.campaign.findUnique({
            where: { id: lead.campaignId },
            select: { angle: true, icpDescription: true },
          });
          if (campaign?.angle) {
            campaignAngle = campaign.angle as unknown as CampaignAngle;
          }
          icpDescription = campaign?.icpDescription ?? undefined;
        }

        // Load style + adaptive data + pattern perf in parallel
        const [styleSamples, subjectStyleSamples, singleWeights, singleWinning, singleWinningSubjects, singleStepAnnotation, previousDrafts, singlePatternStats] = await Promise.all([
          getStyleSamples(ctx.workspaceId, 5, BODY_STYLE_CATEGORIES),
          getStyleSamples(ctx.workspaceId, 3, "subject"),
          getSignalRanking(ctx.workspaceId),
          getWinningEmailPatterns(ctx.workspaceId),
          getWinningSubjects(ctx.workspaceId),
          getStepAnnotation(ctx.workspaceId, args.step),
          prisma.draftedEmail.findMany({
            where: { leadId: lead.id, step: { lt: args.step } },
            orderBy: { step: "asc" },
          }),
          getReplyRateBySubjectPattern(ctx.workspaceId, lead.campaignId ?? undefined),
        ]);
        const singlePatternRanking = formatPatternRanking(singlePatternStats);

        const leadName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim();

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
              step: args.step,
              companyDna,
              campaignAngle,
              workspaceId: ctx.workspaceId,
              previousEmails: previousDrafts.map((d) => ({ step: d.step, subject: d.subject, body: d.userEdit ?? d.body })),
              styleSamples,
              subjectStyleSamples,
              icpDescription,
              signalWeights: singleWeights ?? undefined,
              stepAnnotation: singleStepAnnotation ?? undefined,
              winningPatterns: singleWinning.length > 0 ? singleWinning : undefined,
              patternRanking: singlePatternRanking || undefined,
              winningSubjects: singleWinningSubjects.length > 0 ? singleWinningSubjects : undefined,
              tier: (lead.icpBreakdown as Record<string, unknown> | null)?.tier as LeadTier | undefined,
            }),
          context: {
            leadName,
            leadJobTitle: lead.jobTitle,
            leadCompany: lead.company,
            step: args.step,
            enrichmentCompleteness: lead.enrichmentCompleteness,
          },
          workspaceId: ctx.workspaceId,
        });

        // Filter out primary subject from variants (same as batch)
        const altSubjects = subjects?.filter((s) => s !== subject) ?? [];

        // Persist the draft
        const singleMeta = buildDraftMetadata(lead, args.step, body, subject);

        await prisma.draftedEmail.upsert({
          where: {
            leadId_step: { leadId: lead.id, step: args.step },
          },
          create: {
            leadId: lead.id,
            campaignId: lead.campaignId ?? "",
            workspaceId: ctx.workspaceId,
            step: args.step,
            subject,
            subjectVariants: altSubjects.length > 0 ? altSubjects : undefined,
            body,
            qualityScore: qualityScore.overall,
            model: "mistral-large-latest",
            ...singleMeta,
          },
          update: {
            subject,
            subjectVariants: altSubjects.length > 0 ? altSubjects : undefined,
            body,
            qualityScore: qualityScore.overall,
            model: "mistral-large-latest",
            ...singleMeta,
          },
        });

        return {
          subject,
          body,
          leadId: lead.id,
          leadName,
          leadCompany: lead.company,
          step: args.step,
          qualityScore: qualityScore.overall,
          signalType: singleMeta.signalType,
          wordCount: singleMeta.bodyWordCount,
          enrichmentDepth: singleMeta.enrichmentDepth,
          // Auto-render email preview card
          __component: "email-preview",
          props: {
            emailId: lead.id + "-" + args.step,
            leadId: lead.id,
            step: args.step,
            subject,
            body,
            leadName,
            leadCompany: lead.company,
            qualityScore: qualityScore.overall,
            signalType: singleMeta.signalType,
            wordCount: singleMeta.bodyWordCount,
            enrichmentDepth: singleMeta.enrichmentDepth,
          },
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
        email_id: z.string().optional().describe("DraftedEmail ID for persisting edits"),
      }),
      async execute(args) {
        return {
          __component: "email-preview",
          props: {
            emailId: args.email_id,
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

    show_drafted_emails: {
      name: "show_drafted_emails",
      description:
        "Fetch and display all drafted emails for a campaign. " +
        "Use this when the user asks to see their emails, drafted emails, or email previews. " +
        "Shows a full sequence view (all 6 steps) for sample leads by default. " +
        "Optionally filter by step (0=PAS, 1=Value-add, 2=Social Proof, 3=New Angle, 4=Micro-value, 5=Breakup) or specific lead_ids.",
      parameters: z.object({
        campaign_id: z.string(),
        step: z.number().int().min(0).max(5).optional().describe("Filter by email step (0-5). Omit to show sequence view."),
        lead_ids: z.array(z.string()).optional().describe("Show emails for specific leads only"),
      }),
      async execute(args) {
        // When no step filter, show sequence view (all steps for first lead)
        if (args.step == null && !args.lead_ids?.length) {
          const sampleEmails = await prisma.draftedEmail.findMany({
            where: {
              campaignId: args.campaign_id,
              lead: { workspaceId: ctx.workspaceId },
            },
            include: {
              lead: { select: { firstName: true, lastName: true, company: true } },
            },
            orderBy: { step: "asc" },
            take: 20,
          });

          if (sampleEmails.length === 0) {
            return { error: "No drafted emails found for this campaign." };
          }

          // Pick first lead's emails for sequence view
          const firstLeadId = sampleEmails[0].leadId;
          const firstLeadEmails = sampleEmails.filter((e) => e.leadId === firstLeadId);
          const firstLead = firstLeadEmails[0].lead;
          const leadName = `${firstLead.firstName ?? ""} ${firstLead.lastName ?? ""}`.trim();

          const seqCampaign = await prisma.campaign.findUnique({
            where: { id: args.campaign_id },
            select: { name: true, leadsDrafted: true },
          });

          return {
            total: firstLeadEmails.length,
            __component: "email-sequence",
            props: {
              emails: firstLeadEmails.map((e) => ({
                emailId: e.id,
                step: e.step,
                subject: e.subject,
                body: e.body,
                leadName,
                leadCompany: firstLead.company,
                qualityScore: e.qualityScore,
                wordCount: e.bodyWordCount,
              })),
              campaignName: seqCampaign?.name,
              leadCount: seqCampaign?.leadsDrafted ?? 1,
            },
          };
        }

        // Filtered view: show individual email previews
        const where: Record<string, unknown> = {
          campaignId: args.campaign_id,
          lead: { workspaceId: ctx.workspaceId },
        };
        if (args.step != null) where.step = args.step;
        if (args.lead_ids?.length) where.leadId = { in: args.lead_ids };

        const emails = await prisma.draftedEmail.findMany({
          where,
          include: {
            lead: {
              select: { firstName: true, lastName: true, company: true },
            },
          },
          orderBy: [{ lead: { firstName: "asc" } }, { step: "asc" }],
          take: 20,
        });

        if (emails.length === 0) {
          return { error: "No drafted emails found for this campaign." };
        }

        const components = emails.map((e) => ({
          component: "email-preview",
          props: {
            emailId: e.id,
            leadId: e.leadId,
            step: e.step,
            subject: e.subject,
            body: e.body,
            leadName: `${e.lead.firstName ?? ""} ${e.lead.lastName ?? ""}`.trim(),
            leadCompany: e.lead.company,
            qualityScore: e.qualityScore,
            signalType: e.signalType,
            wordCount: e.bodyWordCount,
            enrichmentDepth: e.enrichmentDepth,
          },
        }));

        return {
          total: emails.length,
          __components: components,
        };
      },
    },

    render_lead_table: {
      name: "render_lead_table",
      description:
        "Render an inline table of leads in the chat. " +
        "Use campaign_id to show ALL leads from a campaign, lead_ids for specific leads, " +
        "or pass a leads array directly. Prefer campaign_id when the user asks to see all leads.",
      parameters: z.object({
        title: z.string().optional(),
        campaign_id: z.string().optional().describe("Show all leads from this campaign"),
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

        if (args.campaign_id) {
          leadsData = await prisma.lead.findMany({
            where: { campaignId: args.campaign_id, workspaceId: ctx.workspaceId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              jobTitle: true,
              linkedinUrl: true,
              icpScore: true,
              status: true,
            },
            orderBy: { icpScore: { sort: "desc", nulls: "last" } },
          });
        } else if (args.lead_ids?.length) {
          leadsData = await prisma.lead.findMany({
            where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              jobTitle: true,
              linkedinUrl: true,
              icpScore: true,
              status: true,
            },
          });
        } else if (args.leads?.length) {
          // Try to enrich with DB data (scores, status) by matching emails
          const rawLeads = args.leads;
          const emails = rawLeads.map((l: typeof rawLeads[number]) => l.email);
          const dbLeads = await prisma.lead.findMany({
            where: { email: { in: emails }, workspaceId: ctx.workspaceId },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              company: true,
              jobTitle: true,
              linkedinUrl: true,
              icpScore: true,
              status: true,
            },
          });
          const dbMap = new Map(dbLeads.map((l: typeof dbLeads[number]) => [l.email, l]));

          leadsData = rawLeads.map((l: typeof rawLeads[number], i: number) => {
            const db = dbMap.get(l.email);
            if (db) return db; // Use DB data (has scores)
            return {
              id: `preview-${i}`,
              firstName: l.first_name ?? null,
              lastName: l.last_name ?? null,
              email: l.email,
              company: l.company_name ?? null,
              jobTitle: l.title ?? null,
              icpScore: null,
              status: "PREVIEW",
            };
          });
        } else {
          return { error: "Provide campaign_id, lead_ids, or a leads array" };
        }

        return {
          __component: "lead-table",
          props: {
            title: args.title ?? "Leads",
            leads: leadsData,
            campaignId: args.campaign_id,
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
