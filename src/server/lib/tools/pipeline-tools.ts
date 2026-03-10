/**
 * Pipeline Tools — Post-launch lifecycle management.
 *
 * Tools: classify_reply, draft_reply, reply_to_email, import_leads_csv, campaign_insights
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import { transitionLeadStatus } from "@/server/lib/lead-status";
import { updateLeadInterestStatus } from "@/server/lib/connectors/instantly";
import type { ToolDefinition, ToolContext } from "./types";

// ─── Reply Dedup ────────────────────────────────────────

/** Window in ms to consider a Reply as duplicate (5 minutes). */
export const REPLY_DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Check if a Reply with matching body already exists in a thread within the dedup window.
 * Compares the first 100 characters of the body to handle minor trailing whitespace differences.
 */
export async function isDuplicateReply(
  threadId: string,
  body: string,
  direction: "INBOUND" | "OUTBOUND",
): Promise<boolean> {
  const bodyPrefix = body.slice(0, 100);
  const windowStart = new Date(Date.now() - REPLY_DEDUP_WINDOW_MS);

  const existing = await prisma.reply.findFirst({
    where: {
      threadId,
      direction,
      sentAt: { gte: windowStart },
    },
    select: { body: true },
    orderBy: { sentAt: "desc" },
  });

  if (!existing) return false;
  return existing.body.slice(0, 100) === bodyPrefix;
}

// ─── Helpers ────────────────────────────────────────────

async function getInstantlyApiKey(workspaceId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "INSTANTLY" } },
  });
  if (!integration?.apiKey || integration.status !== "ACTIVE") return null;
  return decrypt(integration.apiKey);
}

async function resolveCampaign(workspaceId: string, campaignId?: string) {
  if (campaignId) {
    return prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
  }
  return prisma.campaign.findFirst({
    where: { workspaceId, status: { in: ["PUSHED", "ACTIVE"] } },
    orderBy: { updatedAt: "desc" },
  });
}

// ─── Instantly Sequence Removal ─────────────────────────

/**
 * Map LeadSens terminal status to Instantly interest status number.
 * See docs/INSTANTLY-API.md §4.2 for enum values.
 */
export function mapToInstantlyInterestStatus(
  status: "INTERESTED" | "NOT_INTERESTED" | "MEETING_BOOKED",
): number {
  const map: Record<string, number> = {
    INTERESTED: 1,
    NOT_INTERESTED: -1,
    MEETING_BOOKED: 2,
  };
  return map[status];
}

/**
 * Remove lead from Instantly sequence by setting interest status.
 * Best-effort: failure doesn't block LeadSens status transition.
 */
async function removeFromInstantlySequence(
  workspaceId: string,
  lead: { instantlyLeadId: string | null },
  targetStatus: "INTERESTED" | "NOT_INTERESTED" | "MEETING_BOOKED",
): Promise<{ removed: boolean; error?: string }> {
  if (!lead.instantlyLeadId) {
    return { removed: false, error: "No Instantly lead ID" };
  }

  const apiKey = await getInstantlyApiKey(workspaceId);
  if (!apiKey) {
    return { removed: false, error: "Instantly not connected" };
  }

  try {
    await updateLeadInterestStatus(apiKey, {
      leadId: lead.instantlyLeadId,
      interestStatus: mapToInstantlyInterestStatus(targetStatus),
    });
    return { removed: true };
  } catch (err) {
    // Best-effort: log but don't block
    const message = err instanceof Error ? err.message : String(err);
    return { removed: false, error: message };
  }
}

// ─── Reply Classification Schema ────────────────────────

const classifyResultSchema = z.object({
  interest_level: z.enum(["interested", "not_interested", "question", "auto_reply", "out_of_office", "unsubscribe"]),
  interest_score: z.number().min(0).max(10),
  reasoning: z.string(),
  suggested_action: z.enum(["draft_reply", "remove_from_sequence", "ignore", "flag_for_review"]),
  meeting_intent: z.boolean(),
});

// ─── CSV Parsing ────────────────────────────────────────

const CSV_FIELD_MAP: Record<string, string> = {
  email: "email",
  "email address": "email",
  "e-mail": "email",
  first_name: "firstName",
  firstname: "firstName",
  "first name": "firstName",
  prenom: "firstName",
  prénom: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  "last name": "lastName",
  nom: "lastName",
  company: "company",
  "company name": "company",
  entreprise: "company",
  société: "company",
  societe: "company",
  job_title: "jobTitle",
  jobtitle: "jobTitle",
  title: "jobTitle",
  "job title": "jobTitle",
  poste: "jobTitle",
  linkedin: "linkedinUrl",
  linkedin_url: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  phone: "phone",
  telephone: "phone",
  téléphone: "phone",
  website: "website",
  "company website": "website",
  country: "country",
  pays: "country",
  industry: "industry",
  industrie: "industry",
  "company size": "companySize",
  company_size: "companySize",
};

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detect delimiter
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : headerLine.includes(";") ? ";" : ",";

  const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const mapped = CSV_FIELD_MAP[headers[j]];
      if (mapped && values[j]) {
        row[mapped] = values[j];
      }
    }
    if (row.email) rows.push(row);
  }

  return rows;
}

// ─── Tool Definitions ───────────────────────────────────

export function createPipelineTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    classify_reply: {
      name: "classify_reply",
      description: "Classify a reply email to determine interest level and suggested next action. Updates lead status automatically.",
      isSideEffect: true,
      parameters: z.object({
        lead_id: z.string().describe("Lead ID"),
        campaign_id: z.string().optional().describe("Campaign ID"),
        reply_content: z.string().describe("The reply email body text"),
        reply_from: z.string().optional().describe("Sender email"),
        thread_id: z.string().optional().describe("Instantly thread ID"),
      }),
      async execute(args) {
        ctx.onStatus?.("Classifying reply...");

        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
          include: { emails: { orderBy: { step: "asc" } } },
        });
        if (!lead) return { error: "Lead not found." };

        const campaign = await resolveCampaign(ctx.workspaceId, args.campaign_id);

        // Build context for classification
        const emailContext = lead.emails
          .map((e) => `Step ${e.step} (${e.frameworkName ?? "unknown"}): ${e.subject}\n${e.body}`)
          .join("\n---\n");

        const result = await mistralClient.json({
          schema: classifyResultSchema,
          system: `You are an email reply classifier for B2B cold outreach.
Classify the reply based on interest level and suggest the next action.

Context — emails sent to this lead:
${emailContext}

Lead: ${lead.firstName} ${lead.lastName} at ${lead.company} (${lead.jobTitle})

Classification rules:
- "interested": positive response, wants to learn more, asks for meeting/demo/call
- "not_interested": explicit rejection, "not the right time", "please remove me"
- "question": asks for more info without clear interest signal
- "auto_reply": automated response (vacation, delivery notification)
- "out_of_office": OOO message
- "unsubscribe": explicit unsubscribe request

interest_score: 0 (hostile) to 10 (ready to buy)
meeting_intent: true if the reply mentions scheduling, meeting, call, demo, or calendar`,
          prompt: `Reply to classify:\n\n${args.reply_content}`,
          model: "mistral-small-latest",
          workspaceId: ctx.workspaceId,
          action: "classify-reply",
        });

        // Store in ReplyThread
        if (campaign) {
          const thread = await prisma.replyThread.upsert({
            where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
            create: {
              workspaceId: ctx.workspaceId,
              leadId: lead.id,
              campaignId: campaign.id,
              instantlyThreadId: args.thread_id ?? null,
              interestScore: result.interest_score,
              classifiedAt: new Date(),
              status: result.interest_level === "interested" ? "INTERESTED"
                : result.interest_level === "not_interested" ? "NOT_INTERESTED"
                : "OPEN",
            },
            update: {
              interestScore: result.interest_score,
              classifiedAt: new Date(),
              status: result.interest_level === "interested" ? "INTERESTED"
                : result.interest_level === "not_interested" ? "NOT_INTERESTED"
                : "OPEN",
            },
          });

          // Store the reply (skip if duplicate from webhook race condition)
          const duplicate = await isDuplicateReply(thread.id, args.reply_content, "INBOUND");
          if (!duplicate) {
            await prisma.reply.create({
              data: {
                threadId: thread.id,
                direction: "INBOUND",
                fromEmail: args.reply_from ?? lead.email,
                toEmail: lead.email,
                body: args.reply_content,
                preview: args.reply_content.slice(0, 200),
                instantlyEmailId: null,
                aiInterest: result.interest_score,
                sentAt: new Date(),
              },
            });
          }
        }

        // Transition lead status based on classification
        let sequenceRemoved = false;
        try {
          if (lead.status === "SENT" || lead.status === "PUSHED") {
            await transitionLeadStatus(lead.id, "REPLIED");
          }
          if (result.interest_level === "interested" && lead.status === "REPLIED") {
            await transitionLeadStatus(lead.id, "INTERESTED");
            const removal = await removeFromInstantlySequence(ctx.workspaceId, lead, "INTERESTED");
            sequenceRemoved = removal.removed;
          }
          if (result.interest_level === "not_interested" && lead.status === "REPLIED") {
            await transitionLeadStatus(lead.id, "NOT_INTERESTED");
            const removal = await removeFromInstantlySequence(ctx.workspaceId, lead, "NOT_INTERESTED");
            sequenceRemoved = removal.removed;
          }
          if (result.meeting_intent && lead.status === "INTERESTED") {
            await transitionLeadStatus(lead.id, "MEETING_BOOKED");
            const removal = await removeFromInstantlySequence(ctx.workspaceId, lead, "MEETING_BOOKED");
            sequenceRemoved = removal.removed;
          }
        } catch {
          // Transition may fail if status already advanced — non-blocking
        }

        return {
          lead_id: lead.id,
          lead_name: `${lead.firstName} ${lead.lastName}`,
          company: lead.company,
          classification: result,
          sequence_removed: sequenceRemoved,
        };
      },
    },

    draft_reply: {
      name: "draft_reply",
      description: "Draft a contextual reply to a lead's email, using enrichment data and conversation history.",
      parameters: z.object({
        lead_id: z.string().describe("Lead ID"),
        campaign_id: z.string().optional().describe("Campaign ID"),
        original_reply: z.string().describe("The lead's reply to respond to"),
        tone: z.string().optional().describe("Tone guidance (e.g. 'warm', 'direct', 'enthusiastic')"),
      }),
      async execute(args) {
        ctx.onStatus?.("Drafting reply...");

        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
          include: { emails: { orderBy: { step: "asc" } } },
        });
        if (!lead) return { error: "Lead not found." };

        const workspace = await prisma.workspace.findUnique({
          where: { id: ctx.workspaceId },
          select: { companyDna: true },
        });

        const emailHistory = lead.emails
          .map((e) => `[Our email - Step ${e.step}]\nSubject: ${e.subject}\n${e.body}`)
          .join("\n---\n");

        const enrichmentContext = lead.enrichmentData
          ? JSON.stringify(lead.enrichmentData, null, 2).slice(0, 2000)
          : "No enrichment data available.";

        const companyDna = workspace?.companyDna
          ? JSON.stringify(workspace.companyDna, null, 2).slice(0, 1500)
          : "No company DNA available.";

        const result = await mistralClient.complete({
          system: `You are a B2B sales email writer. Draft a reply to a prospect's response.

Rules:
- Short (40-80 words max)
- Reference their specific question/comment
- Move toward a meeting/call if they're interested
- If they asked a question, answer it concisely then redirect to a call
- Match the tone of their reply (formal → formal, casual → casual)
- No fluff, no "great to hear from you", no "thanks for getting back"
- End with a clear next step (calendar link placeholder, specific question, or soft close)
${args.tone ? `- Tone: ${args.tone}` : ""}

Company context:
${companyDna}

Enrichment data on this lead:
${enrichmentContext}

Previous emails in the sequence:
${emailHistory}`,
          prompt: `Lead: ${lead.firstName} ${lead.lastName}, ${lead.jobTitle} at ${lead.company}

Their reply:
${args.original_reply}

Draft a reply (plain text, no subject needed):`,
          model: "mistral-large-latest",
          workspaceId: ctx.workspaceId,
          action: "draft-reply",
          temperature: 0.7,
        });

        return {
          lead_id: lead.id,
          lead_name: `${lead.firstName} ${lead.lastName}`,
          company: lead.company,
          draft: result.text.trim(),
          _display_note: "Show the draft to the user for review before sending.",
        };
      },
    },

    reply_to_email: {
      name: "reply_to_email",
      description: "Send a reply to a lead via Instantly Unibox API. Requires the thread/email ID from Instantly.",
      parameters: z.object({
        instantly_email_id: z.string().describe("The Instantly email ID to reply to"),
        body: z.string().describe("The reply body text (HTML or plain text)"),
        lead_id: z.string().optional().describe("Lead ID for tracking"),
        campaign_id: z.string().optional().describe("Campaign ID"),
      }),
      isSideEffect: true,
      async execute(args) {
        ctx.onStatus?.("Sending reply via Instantly...");

        const apiKey = await getInstantlyApiKey(ctx.workspaceId);
        if (!apiKey) return { error: "Instantly not connected." };

        // Call Instantly reply API
        const response = await fetch("https://api.instantly.ai/api/v2/emails/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            reply_to_uuid: args.instantly_email_id,
            body: args.body,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          return { error: `Failed to send reply: ${response.status} ${errText.slice(0, 200)}` };
        }

        const data = await response.json();

        // Track outbound reply in thread
        if (args.lead_id) {
          const lead = await prisma.lead.findFirst({
            where: { id: args.lead_id, workspaceId: ctx.workspaceId },
            select: { email: true },
          });
          const campaign = await resolveCampaign(ctx.workspaceId, args.campaign_id);
          if (campaign) {
            const thread = await prisma.replyThread.findUnique({
              where: { leadId_campaignId: { leadId: args.lead_id, campaignId: campaign.id } },
            });
            if (thread) {
              await prisma.reply.create({
                data: {
                  threadId: thread.id,
                  direction: "OUTBOUND",
                  fromEmail: "", // TODO: resolve sending account email from Instantly
                  toEmail: lead?.email ?? "",
                  body: args.body,
                  preview: args.body.slice(0, 200),
                  instantlyEmailId: data.id ?? null,
                  sentAt: new Date(),
                },
              });
            }
          }
        }

        return {
          sent: true,
          email_id: data.id ?? null,
          lead_id: args.lead_id ?? null,
        };
      },
    },

    import_leads_csv: {
      name: "import_leads_csv",
      description: "Import leads from CSV data. Parses CSV, validates emails, deduplicates against existing leads, and creates new leads.",
      parameters: z.object({
        csv_content: z.string().describe("Raw CSV content (comma, semicolon, or tab delimited)"),
        campaign_id: z.string().optional().describe("Campaign ID to assign leads to"),
      }),
      async execute(args) {
        ctx.onStatus?.("Parsing CSV...");

        const rows = parseCSV(args.csv_content);
        if (rows.length === 0) {
          return { error: "No valid rows found in CSV. Make sure the CSV has an 'email' column." };
        }

        // Validate emails
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validRows = rows.filter((r) => emailRegex.test(r.email));
        const invalidCount = rows.length - validRows.length;

        // Dedup against existing leads
        const emails = validRows.map((r) => r.email.toLowerCase());
        const existing = await prisma.lead.findMany({
          where: { workspaceId: ctx.workspaceId, email: { in: emails } },
          select: { email: true },
        });
        const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));
        const newRows = validRows.filter((r) => !existingSet.has(r.email.toLowerCase()));
        const dupCount = validRows.length - newRows.length;

        if (newRows.length === 0) {
          return {
            imported: 0,
            duplicates: dupCount,
            invalid: invalidCount,
            total_parsed: rows.length,
            message: "All leads already exist in your workspace.",
          };
        }

        ctx.onStatus?.(`Importing ${newRows.length} leads...`);

        // Create leads
        const created = await prisma.lead.createMany({
          data: newRows.map((r) => ({
            workspaceId: ctx.workspaceId,
            email: r.email.toLowerCase(),
            firstName: r.firstName ?? null,
            lastName: r.lastName ?? null,
            company: r.company ?? null,
            jobTitle: r.jobTitle ?? null,
            linkedinUrl: r.linkedinUrl ?? null,
            phone: r.phone ?? null,
            website: r.website ?? null,
            country: r.country ?? null,
            industry: r.industry ?? null,
            companySize: r.companySize ?? null,
            campaignId: args.campaign_id ?? null,
            status: "SOURCED",
          })),
          skipDuplicates: true,
        });

        // If assigned to campaign, update campaign counters
        if (args.campaign_id) {
          await prisma.campaign.update({
            where: { id: args.campaign_id },
            data: { leadsTotal: { increment: created.count } },
          });
        }

        // Fetch created leads for display
        const createdLeads = await prisma.lead.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            email: { in: newRows.map((r) => r.email.toLowerCase()) },
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        return {
          imported: created.count,
          duplicates: dupCount,
          invalid: invalidCount,
          total_parsed: rows.length,
          campaign_id: args.campaign_id ?? null,
          lead_ids: createdLeads.map((l) => l.id),
          sample: createdLeads.map((l) => ({
            email: l.email,
            name: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim(),
            company: l.company,
            jobTitle: l.jobTitle,
          })),
          __component: "lead-table",
          props: {
            title: `Imported ${created.count} leads`,
            leads: createdLeads.map((l) => ({
              id: l.id,
              email: l.email,
              firstName: l.firstName,
              lastName: l.lastName,
              company: l.company,
              jobTitle: l.jobTitle,
              status: l.status,
            })),
            total: created.count,
          },
        };
      },
    },

    campaign_insights: {
      name: "campaign_insights",
      description: "Analyze cross-campaign performance patterns: which segments, industries, signals, and frameworks drive the best reply rates. Suggests ICP refinements.",
      parameters: z.object({
        campaign_id: z.string().optional().describe("Campaign ID to focus on, or omit for cross-campaign analysis"),
      }),
      async execute(args) {
        ctx.onStatus?.("Analyzing campaign patterns...");

        // Gather performance data with drafted email metadata
        const whereClause = args.campaign_id
          ? { campaignId: args.campaign_id, campaign: { workspaceId: ctx.workspaceId } }
          : { campaign: { workspaceId: ctx.workspaceId } };

        const performances = await prisma.emailPerformance.findMany({
          where: whereClause,
          include: {
            lead: {
              select: {
                industry: true, companySize: true, jobTitle: true, country: true,
                icpScore: true, enrichmentData: true,
              },
            },
          },
        });

        if (performances.length < 5) {
          return { message: "Not enough performance data yet. Need at least 5 leads with tracked emails." };
        }

        // Segment analysis
        const byIndustry: Record<string, { sent: number; replied: number }> = {};
        const byCompanySize: Record<string, { sent: number; replied: number }> = {};
        const byCountry: Record<string, { sent: number; replied: number }> = {};

        for (const perf of performances) {
          const industry = perf.lead.industry ?? "Unknown";
          const size = perf.lead.companySize ?? "Unknown";
          const country = perf.lead.country ?? "Unknown";

          if (!byIndustry[industry]) byIndustry[industry] = { sent: 0, replied: 0 };
          byIndustry[industry].sent++;
          if (perf.replyCount > 0) byIndustry[industry].replied++;

          if (!byCompanySize[size]) byCompanySize[size] = { sent: 0, replied: 0 };
          byCompanySize[size].sent++;
          if (perf.replyCount > 0) byCompanySize[size].replied++;

          if (!byCountry[country]) byCountry[country] = { sent: 0, replied: 0 };
          byCountry[country].sent++;
          if (perf.replyCount > 0) byCountry[country].replied++;
        }

        // Step analytics (from DB)
        const stepData = args.campaign_id
          ? await prisma.stepAnalytics.findMany({
              where: { campaignId: args.campaign_id },
              orderBy: { step: "asc" },
            })
          : [];

        // Find top performing segments
        const topIndustries = Object.entries(byIndustry)
          .filter(([, v]) => v.sent >= 3)
          .map(([k, v]) => ({ industry: k, replyRate: Math.round((v.replied / v.sent) * 100), count: v.sent }))
          .sort((a, b) => b.replyRate - a.replyRate)
          .slice(0, 5);

        const totalSent = performances.length;
        const totalReplied = performances.filter((p) => p.replyCount > 0).length;
        const totalBounced = performances.filter((p) => p.bounced).length;
        const avgInterest = performances.filter((p) => p.replyAiInterest != null)
          .reduce((sum, p) => sum + (p.replyAiInterest ?? 0), 0) /
          Math.max(1, performances.filter((p) => p.replyAiInterest != null).length);

        return {
          overview: {
            total_leads: totalSent,
            replied: totalReplied,
            reply_rate: Math.round((totalReplied / totalSent) * 100),
            bounced: totalBounced,
            bounce_rate: Math.round((totalBounced / totalSent) * 100),
            avg_ai_interest: Math.round(avgInterest * 10) / 10,
          },
          top_industries: topIndustries,
          by_company_size: Object.entries(byCompanySize)
            .filter(([, v]) => v.sent >= 2)
            .map(([k, v]) => ({ size: k, replyRate: Math.round((v.replied / v.sent) * 100), count: v.sent }))
            .sort((a, b) => b.replyRate - a.replyRate),
          by_country: Object.entries(byCountry)
            .filter(([, v]) => v.sent >= 2)
            .map(([k, v]) => ({ country: k, replyRate: Math.round((v.replied / v.sent) * 100), count: v.sent }))
            .sort((a, b) => b.replyRate - a.replyRate)
            .slice(0, 5),
          step_breakdown: stepData.map((s) => ({
            step: s.step,
            sent: s.sent,
            opened: s.opened,
            replied: s.replied,
            open_rate: s.openRate,
            reply_rate: s.replyRate,
          })),
          suggestions: buildInsightSuggestions(topIndustries, totalReplied, totalSent, totalBounced),
        };
      },
    },
  };
}

function buildInsightSuggestions(
  topIndustries: Array<{ industry: string; replyRate: number; count: number }>,
  totalReplied: number,
  totalSent: number,
  totalBounced: number,
): string[] {
  const suggestions: string[] = [];
  const overallRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

  if (topIndustries.length > 0 && topIndustries[0].replyRate > overallRate * 1.5) {
    suggestions.push(
      `${topIndustries[0].industry} has ${topIndustries[0].replyRate}% reply rate (${Math.round(overallRate)}% average). Consider focusing next campaign on this industry.`,
    );
  }

  if (totalBounced > totalSent * 0.05) {
    suggestions.push(
      `Bounce rate is ${Math.round((totalBounced / totalSent) * 100)}% — consider enabling email verification (ZeroBounce) before next campaign.`,
    );
  }

  if (overallRate < 5 && totalSent >= 50) {
    suggestions.push(
      "Reply rate below 5% after 50+ emails. Consider reviewing email copy, testing new subject lines, or narrowing ICP.",
    );
  }

  if (overallRate >= 15) {
    suggestions.push(
      `Strong ${Math.round(overallRate)}% reply rate. Consider scaling volume or testing adjacent ICPs.`,
    );
  }

  return suggestions;
}
