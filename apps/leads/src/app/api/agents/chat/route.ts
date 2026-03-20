import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildToolSet, filterToolsByPhase, getToolLabel } from "@/server/lib/tools";
import { getStyleSamples } from "@/server/lib/email/style-learner";
import {
  prepareMessagesForLLM,
  estimateTokens,
  compressToolOutput,
} from "@/server/lib/llm/context-manager";
import type { ChatMessage, StreamEvent, AutonomyLevel } from "@/server/lib/llm/types";
import type { WorkspaceWithIntegrations } from "@/server/lib/tools/types";
import { parseCompanyDna } from "@/server/lib/enrichment/company-analyzer";
import { rateLimitByIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod/v4";

export const maxDuration = 300;

// ─── System Prompt (tiered by pipeline phase) ───────────

const CORE_PROMPT = `You are LeadSens, an intelligent B2B prospecting agent.

PERSONALITY: Warm, direct, concise. Casual tone, clean markdown (bullets on own lines, **bold** key info). One question at a time. No walls of text, no em dashes, no repeating what the user said.

LANGUAGE: Always respond in English unless the user's last message is in French — then respond in French.

COMMUNICATION:
- Silent execution: never explain internal mappings, adjustments, or limitations. Just do it and show results.
- Zero text between tool calls. Call all needed tools, then ONE response.
- Tool errors: silently fix params, retry ONCE. Only report if retry also fails.
- Questions about past results: When the user asks about a previous error or result ("what went wrong?", "why did it fail?", "qu'est-ce qui s'est passé ?"), ANSWER from conversation history. Do NOT re-run the tool. Only retry if the user explicitly asks to retry ("try again", "relance", "réessaie").
- NEVER suggest "re-launching the search" or "your criteria are too strict" when tools already returned leads. If tools returned an error, explain that error instead.
- Structured data: ALWAYS use render_lead_table / render_email_preview / show_drafted_emails. Never markdown tables, never raw @@INLINE@@ markers, never tool names in text.
- After tool calls that render components (lead-table, enrichment, email-preview), do NOT add descriptive text like "Voici les details" or tables — the component already shows everything. Just comment briefly on the results.
- Never fabricate tool results. Never appear hesitant ("let me try", "let's see if").

LEAD RESOLUTION: enrich_single_lead and draft_single_email auto-resolve leads (by id, name/email, or auto). Never guess lead_ids from history.

ON-DEMAND DISPLAY:
- "show leads" → render_lead_table(campaign_id). Never re-use instantly_preview_leads outside Phase 1.
- "show emails" → show_drafted_emails(campaign_id). Default: step 0. Never confuse with "show leads".
- Save ICPs and style prefs to memory (not CompanyDNA, which has its own tools).`;

// Phase 0: onboarding (no CompanyDNA yet)
const PHASE_ONBOARDING = `
CURRENT PHASE: ONBOARDING
Your first question should ALWAYS be "What's your website URL?" — not about integrations or tools.
After the user provides a URL, call analyze_company_site immediately. Never generate analysis from your own knowledge.
Present result (one-liner, personas, differentiators). Ask: "Does this look right?"
After DNA is confirmed, suggest: "Now describe your ideal customer — I'll find some matches right away."
Do NOT mention integrations until AFTER the user has their Company DNA set and has described an ICP.
Never use save_memory for CompanyDNA.`;

// Phases 0-1: ICP validation + parsing + estimation (no campaign yet)
const PHASE_DISCOVERY = `
WORKFLOW: When the user describes an ICP, execute without stopping except where indicated.

ICP VALIDATION — check for: Role/Department, Industry, Geography.
If any missing, ask ONE question. If all present, proceed. Optional criteria (size, revenue) are not blockers.

PHASE 1 — PARSING + ESTIMATION (no credits)
Tools: parse_icp → count_leads → preview_leads
- Pass search_filters AS-IS between tools. Never modify, remove fields, or trim job_titles.
- After parse_icp, ALWAYS present the human_summary to the user for confirmation before calling count_leads. Example: "Here are the filters: {human_summary}. Does this look right?"
- If filter_approximations is returned, ALWAYS explain each approximation to the user. Instantly uses fixed ranges (e.g. $1M-10M, $10M-50M) so exact thresholds like ">$5M" cannot be applied precisely. Be transparent about this limitation.
- Preview renders automatically. Never repeat lead data in text.
- One count call only. Default preview: 5 leads.
STOP: "~X leads available. How many do you want to source? (this uses Instantly credits)"

TRANSITION: When user confirms or gives a number → call source_leads immediately. New criteria → re-run Phase 1.

SOURCING STEP (CRITICAL — do not skip):
When the user says "yes", "go ahead", "source X", or gives a number:
1. Call source_leads with search_filters, limit, search_name, list_name, and icp_description.
2. source_leads creates the campaign and returns lead_ids + campaign_id.
3. ONLY AFTER source_leads returns, call score_leads_batch (pass lead_ids, campaign_id, icp_description).
4. ONLY AFTER scoring, call enrich_leads_batch with the scored lead_ids.
Do NOT call enrich_leads_batch or draft_emails_batch BEFORE source_leads. The pipeline MUST follow this order.`;

// Phase 2: post-sourcing — score + enrich (never re-source)
const PHASE_SOURCING = `
CURRENT PHASE: SCORING + ENRICHMENT
Leads are ALREADY sourced. NEVER call source_leads again — dedup will return 0 new leads.
- Call score_leads_batch with campaign_id and icp_description. You can omit lead_ids — it auto-finds all SOURCED leads in the campaign.
- After sourcing, NEVER reference preview data. Only describe leads from the sourcing result (sourced_leads_summary). Preview leads and sourced leads are DIFFERENT.
- After scoring, continue to enrich_leads_batch with the qualified lead_ids. Do NOT pause.
- Report results after execution, never before. Never present "scorer et enrichir" as a suggestion — just do it.
- If a tool returns an error (e.g. "No SOURCED leads", "Lead must be scored first"), explain the error to the user clearly. NEVER respond by suggesting to re-search or re-source — the leads are already in the system.`;

// Phase 3: enrichment + drafting
const PHASE_ENRICHING = `
CURRENT PHASE: ENRICHMENT + DRAFTING
Tools: enrich_leads_batch → generate_campaign_angle → draft_emails_batch
- Pass lead_ids + campaign_id through the chain.
- Always generate campaign angle BEFORE drafting.
- Email previews render automatically.
Continue to account selection WITHOUT pause.

ENRICHMENT RESULTS — how to interpret:
- The enrichment_summary in tool results tells you EXACTLY what data was found per lead.
- quality: "rich" = 5+ fields (company, pain points, signals, LinkedIn) — excellent for personalization.
- quality: "partial" = 3-4 fields — good enough, draft will use available data.
- quality: "minimal" = 1-2 fields — drafting will rely more on ICP context.
- quality: "none" = no scrape data — drafting uses basic Instantly profile only.
- NEVER say "enrichment didn't return usable data" if quality is "rich" or "partial". The EnrichmentCard shows the data — trust it.
- NEVER say "no data" when the tool returned enriched: true and scraped: true.
- If a lead's enriched industry doesn't match the ICP vertical, say so explicitly: "This lead is in [industry], which differs from your ICP ([icp_vertical]). The emails will be adapted to their actual vertical."
- After enrichment, comment briefly on the quality (e.g. "Rich data for 8/10 leads, 2 had no website") then proceed to angle + drafting.
- If Apollo is connected, enrichment automatically includes Apollo data (verified emails, org data). Mention "Apollo-enriched" in your summary if apollo_enriched > 0.
- If ZeroBounce is connected and leads have been drafted, call verify_emails before pushing to campaign. Report invalid emails clearly.`;

// Phase 4: account selection + push
const PHASE_PUSHING = `
CURRENT PHASE: CAMPAIGN SETUP
Step 0 (if ZeroBounce connected): verify_emails to check email validity before pushing.
Step 1: list_accounts (account picker renders automatically). STOP: wait for user selection.
Step 2: Call preview_campaign_launch to show the user a visual preview before creating the campaign.
Step 3: After user confirms from the preview, call create_campaign with selected email_accounts.
Step 4: add_leads_to_campaign.
STOP: wait for explicit activation request. Never offer to activate.

DELIVERABILITY PRE-FLIGHT (mention once before pushing):
- Custom tracking domain configured? Shared tracking domains hurt reputation.
- Sending accounts warmed up 2+ weeks? New accounts need gradual ramp (10→50/day over 4 weeks).
- SPF/DKIM/DMARC set up? Non-compliant domains go straight to spam.
- Keep volume under 100 emails/day per sending account.`;

// Phase 5: active — monitoring + reply management + analytics
const PHASE_ACTIVE = `
CURRENT PHASE: CAMPAIGN ACTIVE
Campaign is live. You now manage the full post-launch lifecycle.

ANALYTICS:
When user asks about campaign performance ("how's it going?", "what's working?", "results?"):
1. Call sync_campaign_analytics first (ensures fresh data)
2. Call campaign_performance_report for the specific campaign
3. Share key metrics and actionable insights

When user asks "what should I do differently?" or "what's working best?":
→ Call campaign_insights or performance_insights for cross-campaign learnings

REPLY MANAGEMENT:
When user asks about replies or you detect new replies:
1. Call get_replies to fetch recent replies
2. For each meaningful reply (not auto-reply), call classify_reply with the lead_id and reply content
3. Based on classification:
   - interested → Call draft_reply, show draft to user, wait for approval before reply_to_email
   - not_interested → Inform user, suggest removing from sequence
   - question → Call draft_reply to prepare an answer
   - auto_reply/ooo → Inform user, no action needed

CRM HANDOFF:
When a lead is classified as INTERESTED:
- If CRM is connected, suggest creating a CRM contact (crm_create_contact)
- If user confirms, also offer to create a deal (crm_create_deal)
- Always wait for user confirmation before CRM actions

PROACTIVE INSIGHTS:
- If bounce rate > 3% after 50+ sends, recommend pausing to check list quality
- If reply rate < 2% after 7+ days, suggest reviewing email copy or ICP
- If a specific segment has 3x+ better reply rate, mention it
- If user hasn't set up custom tracking domain, mention it improves deliverability
- When user returns or asks "what have you learned?", call learning_summary to show accumulated intelligence (winning patterns, style corrections, A/B results)

If user describes a new ICP, start a new pipeline from Phase 1.`;

// Pipeline rules (always included, but condensed)
const PIPELINE_RULES = `
PIPELINE RULES:
- ALWAYS pass lead_ids and campaign_id between tools. source_leads returns both — carry them through the entire chain. If you lose track, the tools will resolve campaign_id from the conversation link, but explicit IDs are more reliable.
- Full chain: source_leads → score_leads_batch → enrich_leads_batch → generate_campaign_angle → draft_emails_batch → list_accounts → create_campaign → add_leads_to_campaign.
- CRITICAL ORDERING: You MUST call source_leads BEFORE score_leads_batch. You MUST call score_leads_batch BEFORE enrich_leads_batch. You MUST call enrich_leads_batch BEFORE draft_emails_batch. NEVER skip a step in the chain.
- When the user confirms sourcing (says "yes", "go ahead", gives a number), call source_leads FIRST. Do NOT call enrich_leads_batch or draft_emails_batch before source_leads has returned lead_ids and campaign_id.
- Only 2 mandatory pauses: (1) before sourcing (credits), (2) account selection.
- If a step fails, explain the error clearly. No loops, no retries.
- NEVER suggest "re-launching the search" or "criteria are too strict" when leads are already sourced. If a tool returned an error, explain that error.
- If user describes a new ICP at any point, start Phase 1 fresh.
- Email sequence: ALWAYS 6 steps (PAS, Value-add, Social Proof, New Angle, Micro-value, Breakup). Never say 5.
- HONESTY: Only report tool results that actually happened. If a tool returned an error, say so. Never claim "X leads sourced" unless source_leads actually returned them. Never claim "emails ready" unless draft_emails_batch actually succeeded.`;

type CampaignPhase = "DRAFT" | "SOURCING" | "SCORING" | "ENRICHING" | "DRAFTING" | "READY" | "PUSHED" | "ACTIVE" | "MONITORING";

function getPhasePrompt(
  hasCompanyDna: boolean,
  campaignStatus: CampaignPhase | null,
): string {
  // No campaign yet
  if (!campaignStatus) {
    if (!hasCompanyDna) return PHASE_ONBOARDING + "\n" + PHASE_DISCOVERY;
    return PHASE_DISCOVERY;
  }

  // Map campaign status to relevant phase instructions
  switch (campaignStatus) {
    case "DRAFT":
    case "SOURCING":
    case "SCORING":
      return PHASE_SOURCING + "\n" + PHASE_ENRICHING;
    case "ENRICHING":
    case "DRAFTING":
      return PHASE_ENRICHING + "\n" + PHASE_PUSHING;
    case "READY":
    case "PUSHED":
      return PHASE_PUSHING + "\n" + PHASE_ACTIVE;
    case "ACTIVE":
    case "MONITORING":
      return PHASE_ACTIVE;
    default:
      return PHASE_DISCOVERY;
  }
}

// ─── Request Schema ──────────────────────────────────────

const requestSchema = z.object({
  conversationId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  isGreeting: z.boolean().optional(),
});

// ─── Build Dynamic System Prompt ─────────────────────────

interface PipelineState {
  id: string;
  name: string;
  status: string;
  icpDescription: string;
  leadsTotal: number;
  leadsScored: number;
  leadsSkipped: number;
  leadsEnriched: number;
  leadsDrafted: number;
  leadsPushed: number;
}

// ─── Autonomy Cursor Directives ────────────────────────

function getAutonomyDirective(level: AutonomyLevel): string {
  switch (level) {
    case "AUTO":
      return "\nAUTONOMY: Full auto. Execute all actions immediately. Report completed actions.";
    case "MANUAL":
      return "\nAUTONOMY: Manual mode. Every tool that modifies data requires confirmation. When a tool returns __confirmation_required, present the action clearly and ask: 'Proceed?'. Also ask before batch scoring, enrichment, and drafting.";
    case "SUPERVISED":
    default:
      return "\nAUTONOMY: Supervised mode. When a tool returns __confirmation_required, present the action clearly and ask: 'Go ahead?'. Only side-effect actions (sending, campaign creation, CRM writes) need confirmation.";
  }
}

function buildSystemPrompt(
  workspace: WorkspaceWithIntegrations & { autonomyLevel?: string; tamResult?: unknown },
  memories: Array<{ key: string; value: string }>,
  styleCorrections: string[],
  campaign: PipelineState | null,
): string {
  const hasCompanyDna = !!workspace.companyDna;
  const campaignStatus = campaign?.status as CampaignPhase | null;
  const phasePrompt = getPhasePrompt(hasCompanyDna, campaignStatus);

  const autonomyLevel = (workspace.autonomyLevel ?? "SUPERVISED") as AutonomyLevel;
  const parts = [CORE_PROMPT, getAutonomyDirective(autonomyLevel), phasePrompt, PIPELINE_RULES];

  if (workspace.companyDna) {
    const parsedDna = parseCompanyDna(workspace.companyDna);
    const dna = parsedDna && typeof parsedDna === "object" ? (parsedDna as Record<string, unknown>) : null;
    if (dna && "oneLiner" in dna) {
      const buyers = Array.isArray(dna.targetBuyers)
        ? (dna.targetBuyers as Array<{ role: string; sellingAngle: string }>)
            .map((b) => `${b.role} (${b.sellingAngle})`)
            .join(", ")
        : "";
      const diffs = Array.isArray(dna.differentiators)
        ? (dna.differentiators as string[]).join(", ")
        : "";
      const problems = Array.isArray(dna.problemsSolved)
        ? (dna.problemsSolved as string[]).join(", ")
        : "";
      const results = Array.isArray(dna.keyResults)
        ? (dna.keyResults as string[]).join(", ")
        : "";
      const socialProof = Array.isArray(dna.socialProof)
        ? (dna.socialProof as Array<{ industry: string; clients: string[]; keyMetric?: string }>)
            .map((sp) => `${sp.industry}: ${sp.clients.join(", ")}${sp.keyMetric ? ` (${sp.keyMetric})` : ""}`)
            .join(" | ")
        : "";
      const tone = dna.toneOfVoice as { register?: string; traits?: string[] } | undefined;
      const toneStr = tone
        ? `${tone.register ?? "conversational"}${tone.traits?.length ? `, ${tone.traits.join(", ")}` : ""}`
        : "";
      const ctaLabels = Array.isArray(dna.ctas)
        ? (dna.ctas as Array<{ label: string }>).map((c) => c.label).join(", ")
        : "";
      const sender = dna.senderIdentity as { name?: string; role?: string } | undefined;
      const senderStr = sender?.name ? `${sender.name}${sender.role ? ` (${sender.role})` : ""}` : "";

      let section = `\n## Your client's company\n${dna.oneLiner}\nTarget buyers: ${buyers}\nDifferentiators: ${diffs}`;
      if (problems) section += `\nProblems solved: ${problems}`;
      if (results) section += `\nKey results: ${results}`;
      if (socialProof) section += `\nSocial proof: ${socialProof}`;
      if (toneStr) section += `\nTone: ${toneStr}`;
      if (ctaLabels) section += `\nCTAs: ${ctaLabels}`;
      if (senderStr) section += `\nSender: ${senderStr}`;
      parts.push(section);
    } else {
      parts.push(`\n## Your client's company\n${String(workspace.companyDna)}`);
    }
  }

  // Inject TAM context when available
  if (workspace.tamResult) {
    const tam = workspace.tamResult as Record<string, unknown>;
    const tamCounts = tam.counts as { total?: number } | undefined;
    if (tamCounts?.total) {
      const roles = Array.isArray(tam.roles) ? (tam.roles as string[]).slice(0, 5).join(", ") : "various";
      const burningEstimate = (tam.burningEstimate as number) ?? 0;
      let tamSection = `\n## TAM Context\nTotal addressable market: ${tamCounts.total.toLocaleString()} contacts`;
      if (burningEstimate > 0) {
        tamSection += `\nBurning (3+ signals): ~${burningEstimate.toLocaleString()}`;
      }
      tamSection += `\nTarget roles: ${roles}`;
      tamSection += `\nUse show_tam to display the full TAM table.`;
      tamSection += `\nWhen user says "show my TAM", "my market", or "show market", call show_tam.`;
      parts.push(tamSection);
    }
  }

  if (memories.length > 0) {
    parts.push(
      `\n## What you remember\n${memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")}`,
    );
  }

  if (styleCorrections.length > 0) {
    parts.push(
      `\n## Style Guide (learn from these corrections)\n${styleCorrections.join("\n")}`,
    );
  }

  const connected = workspace.integrations
    .filter((i) => i.status === "ACTIVE")
    .map((i) => i.type);
  parts.push(
    `\n## Connected integrations\n${connected.length > 0 ? connected.join(", ") : "None yet"}`,
  );

  // Demo mode directive — when no lead sourcing tool is connected
  const hasLeadSourcing = connected.includes("INSTANTLY") || connected.includes("APOLLO");
  if (!hasLeadSourcing) {
    parts.push(
      `\n## Demo Mode\nNo lead sourcing tool is connected. Use demo_search_leads to show the user sample leads matching their ICP.` +
      ` After showing results, suggest: "Want more leads with verified emails? Connect your Apollo or Instantly account in Settings > Integrations."` +
      ` Never say "you need to connect tools first" — always try the demo search.`,
    );
  }

  if (campaign) {
    parts.push(
      `\n## Pipeline state\nCampaign: "${campaign.name}" (${campaign.id})\n` +
        `Phase: ${campaign.status}\nICP: ${campaign.icpDescription}\n` +
        `Progress: ${campaign.leadsTotal} sourced → ${campaign.leadsScored} scored ` +
        `(${campaign.leadsSkipped} skipped) → ${campaign.leadsEnriched} enriched → ` +
        `${campaign.leadsDrafted} drafted` +
        (campaign.leadsPushed > 0 ? ` → ${campaign.leadsPushed} pushed` : ""),
    );
  }

  return parts.join("\n");
}

// ─── Contextual Greeting (deterministic, no LLM) ────────

function buildGreeting(workspace: WorkspaceWithIntegrations, firstName?: string): string {
  const hasCompanyDna = !!workspace.companyDna;
  const hasESP = workspace.integrations.some(
    (i) => ["INSTANTLY", "SMARTLEAD", "LEMLIST"].includes(i.type) && i.status === "ACTIVE",
  );

  const name = firstName ? ` ${firstName}` : "";

  // Case 1: No Company DNA — URL-first onboarding (tools don't matter yet)
  if (!hasCompanyDna) {
    return `Hey${name}, welcome to LeadSens! 👋

I'm your prospecting copilot. I'll handle sourcing, enrichment, email drafting, and campaign management — you just describe who to target.

**What's your website URL?** I'll analyze your offer so every email is personalized to what you sell.`;
  }

  // Case 3: Has company DNA but no ESP
  if (hasCompanyDna && !hasESP) {
    const parsedDna = parseCompanyDna(workspace.companyDna);
    const oneLiner =
      parsedDna && typeof parsedDna === "object" && "oneLiner" in parsedDna
        ? String(parsedDna.oneLiner)
        : null;

    return `Hey${name}! ${oneLiner ? `I have your offer in mind: *${oneLiner}*` : "Your offer is configured."}

I just need an **email platform** to start sourcing and sending. Connect Instantly, Smartlead, or Lemlist in *Settings > Integrations*.

Once that's done, we'll launch your first campaign.`;
  }

  // Case 4: Everything ready — ask for ICP
  return `Hello${name}, I've analyzed your offer and your tools are connected. Describe your target for this campaign, the more precise you are on role, industry, geo, company size and revenue, the more accurate sourcing will be.

For example: "VP Sales in B2B SaaS, US + UK, 50 to 500 employees, revenue > $5M"`;
}

// ─── Singleton inline components (only one per message) ──

const SINGLETON_COMPONENTS = new Set([
  "lead-table",
  "account-picker",
  "campaign-summary",
  "progress-bar",
  "enrichment",
  "rich-lead-table",
  "rich-campaign-card",
]);

/** Remove previous @@INLINE@@ markers for a singleton component type */
function removePreviousMarkers(content: string, componentName: string): string {
  if (!SINGLETON_COMPONENTS.has(componentName)) return content;
  return content.replace(/\n*@@INLINE@@([\s\S]*?)@@END@@\n*/g, (match, json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.component === componentName) return "";
    } catch { /* keep non-parseable markers */ }
    return match;
  });
}

// ─── SSE Event Mapping ───────────────────────────────────

function streamEventToSSE(
  sse: SSEEncoder,
  event: StreamEvent,
): Uint8Array {
  switch (event.type) {
    case "text-delta":
      return sse.encode("text-delta", { delta: event.delta });
    case "tool-input-start":
      return sse.encode("tool-input-start", {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });
    case "tool-input-available":
      return sse.encode("tool-input-available", {
        toolCallId: event.toolCallId,
        input: event.input,
      });
    case "tool-output-available":
      return sse.encode("tool-output-available", {
        toolCallId: event.toolCallId,
        output: event.output,
      });
    case "status":
      return sse.encode("status", { label: event.label });
    case "step-complete":
      return sse.encode("step-complete", {
        tokensIn: event.usage.tokensIn,
        tokensOut: event.usage.tokensOut,
      });
    case "finish":
      return sse.encode("finish", {
        tokensIn: event.usage.tokensIn,
        tokensOut: event.usage.tokensOut,
        totalSteps: event.usage.totalSteps,
        finishReason: event.finishReason,
      });
    case "error":
      return sse.encode("error", { message: event.message });
  }
}

// ─── POST Handler ────────────────────────────────────────

export async function POST(req: Request) {
  // 0. Rate limiting — 30 req/min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rl = await rateLimitByIp(ip);
  if (!rl.success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rl.resetInSeconds),
      },
    });
  }

  // 1. Auth — required for everything
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Parse body
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { conversationId, messages, isGreeting } = parsed.data;

  // 3. Load user + workspace
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response(JSON.stringify({ error: "No workspace" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspaceId = user.workspaceId;
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      integrations: { select: { type: true, status: true } },
    },
  });

  // 4. Greeting fast-path — deterministic, no LLM, plain JSON response
  if (isGreeting) {
    const firstName = (user.name ?? "").split(" ")[0] || undefined;
    const greetingText = buildGreeting(workspace as WorkspaceWithIntegrations, firstName);

    // Persist conversation + greeting message to DB
    try {
      await prisma.conversation.upsert({
        where: { id: conversationId },
        create: { id: conversationId, workspaceId },
        update: { updatedAt: new Date() },
      });
      await prisma.message.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: greetingText,
        },
      });
    } catch {
      logger.error("Failed to persist greeting", { conversationId });
    }

    return new Response(
      JSON.stringify({ greeting: greetingText }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // 5. Load context in parallel
  const [memories, styleCorrections, pipelineState] = await Promise.all([
    prisma.agentMemory.findMany({
      where: { workspaceId },
      select: { key: true, value: true },
    }),
    getStyleSamples(workspaceId),
    prisma.conversation
      .findUnique({
        where: { id: conversationId },
        select: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
              icpDescription: true,
              leadsTotal: true,
              leadsScored: true,
              leadsSkipped: true,
              leadsEnriched: true,
              leadsDrafted: true,
              leadsPushed: true,
            },
          },
        },
      })
      .then((c: { campaign: PipelineState | null } | null) => c?.campaign ?? null),
  ]);

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(
    workspace as WorkspaceWithIntegrations,
    memories,
    styleCorrections,
    pipelineState,
  );

  // 7. Build tool set (phase-filtered to reduce LLM confusion)
  const toolCtx = {
    workspaceId,
    userId: user.id,
    conversationId,
    onStatus: undefined as ((label: string) => void) | undefined,
  };
  const allTools = buildToolSet(workspace as WorkspaceWithIntegrations, toolCtx);
  const tools = filterToolsByPhase(allTools, pipelineState?.status as CampaignPhase | null);

  // 8. Convert messages to ChatMessage format + context management
  const rawMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const systemTokens = estimateTokens(systemPrompt);
  // Rough estimate for tool schemas (~150 tokens per tool)
  const toolSchemaTokens = Object.keys(tools).length * 150;
  const contextResult = prepareMessagesForLLM(
    rawMessages,
    systemTokens,
    toolSchemaTokens,
  );
  const chatMessages = contextResult.messages;

  logger.debug(
    `[context] Raw ~${contextResult.rawTokens}tok → Clean ~${contextResult.cleanTokens}tok` +
      (contextResult.markersStripped > 0
        ? ` (stripped ${contextResult.markersStripped} markers)`
        : "") +
      (contextResult.toolResultsCompressed > 0
        ? ` (compressed ${contextResult.toolResultsCompressed} tool results)`
        : "") +
      (contextResult.windowed ? " [windowed]" : ""),
  );

  // 9. Pre-save: create conversation + user message BEFORE streaming
  //    so the sidebar shows the conversation immediately
  const lastUserMessage = messages[messages.length - 1];
  const isFirstMessage = messages.filter((m) => m.role === "user").length === 1;
  const autoTitle =
    isFirstMessage && lastUserMessage?.role === "user"
      ? lastUserMessage.content.replace(/\n/g, " ").trim().slice(0, 80)
      : undefined;

  try {
    await prisma.conversation.upsert({
      where: { id: conversationId },
      create: {
        id: conversationId,
        workspaceId,
        ...(autoTitle ? { title: autoTitle } : {}),
      },
      update: {
        updatedAt: new Date(),
        ...(autoTitle ? { title: autoTitle } : {}),
      },
    });

    if (lastUserMessage?.role === "user") {
      await prisma.message.create({
        data: {
          conversationId,
          role: "USER",
          content: lastUserMessage.content,
        },
      });
    }
  } catch {
    logger.error("Failed to pre-save conversation");
  }

  // 10. Stream response
  const sse = new SSEEncoder();
  let fullAssistantContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      let keepAlive: ReturnType<typeof setInterval> | undefined;
      let streamClosed = false;

      try {
        // Retry directive + stream-start framing
        controller.enqueue(sse.retryDirective(3000));
        controller.enqueue(
          sse.encode("stream-start", {
            streamId: generateStreamId(),
            conversationId,
            ts: Date.now(),
          }),
        );

        // Notify user if context was windowed — both status label and visible message
        if (contextResult.windowed) {
          controller.enqueue(
            sse.encode("status", { label: "Long conversation, refreshing context..." }),
          );
          const windowingNote = "\n\n*(Context refreshed — I may need you to re-state recent details)*\n\n";
          fullAssistantContent += windowingNote;
          controller.enqueue(
            sse.encode("text-delta", { delta: windowingNote }),
          );
        }

        // Keepalive: ping every 15s to prevent proxy timeouts
        keepAlive = setInterval(() => {
          if (!streamClosed) {
            try { controller.enqueue(sse.ping()); } catch { /* stream closed */ }
          }
        }, 15_000);

        // Wire up status callback to emit SSE events
        toolCtx.onStatus = (label: string) => {
          controller.enqueue(sse.encode("status", { label }));
        };

        // ── Auto-execute confirmed tools from previous turn ──
        // Instead of relying on Mistral to re-call the tool (it can't — it doesn't
        // remember tool calls from prior turns), we execute the tool server-side
        // and inject the result into chatMessages before calling Mistral.
        const CONFIRM_RE = /^(ok|oui|yes|go|sure|let'?s do it|parfait|go ahead|d'accord|c'est bon|allez|lance|vas-?y|fais-?le|envoie|do it|proceed|confirm|yep|yeah|yup|go for it|source|source them|let'?s go)[\s!.]*$/i;
        const NUMBER_RE = /^(\d+)$/;
        let autoExecuted = false;
        {
          const lastUserMsg = lastUserMessage?.content?.trim() ?? "";
          const isConfirmation = CONFIRM_RE.test(lastUserMsg);
          const numberMatch = NUMBER_RE.exec(lastUserMsg);

          if (isConfirmation || numberMatch) {
            const lastAssistant = await prisma.message.findFirst({
              where: { conversationId, role: "ASSISTANT" },
              orderBy: { createdAt: "desc" },
              select: { content: true },
            });

            if (lastAssistant?.content) {
              // New format: @@PENDING_CONFIRM@@toolName@@ARGS@@{json}@@END@@
              const argsMatch = lastAssistant.content.match(
                /@@PENDING_CONFIRM@@(\w+)@@ARGS@@([\s\S]*?)@@END@@/,
              );
              // Legacy format: @@PENDING_CONFIRM@@toolName@@END@@
              const legacyMatch = !argsMatch
                ? lastAssistant.content.match(/@@PENDING_CONFIRM@@(\w+)@@END@@/)
                : null;

              if (argsMatch) {
                const pendingToolName = argsMatch[1];
                const pendingArgsRaw = argsMatch[2];
                const toolDef = tools[pendingToolName];

                if (toolDef) {
                  let parsedArgs: unknown;
                  try {
                    parsedArgs = JSON.parse(pendingArgsRaw);
                  } catch {
                    parsedArgs = null;
                  }

                  if (parsedArgs && typeof parsedArgs === "object") {
                    // Number confirmation overrides "limit" arg
                    if (numberMatch && "limit" in (parsedArgs as Record<string, unknown>)) {
                      (parsedArgs as Record<string, unknown>).limit = parseInt(numberMatch[1], 10);
                    }

                    // Emit SSE events so UI shows activity
                    const fakeCallId = `auto-confirm-${Date.now()}`;
                    controller.enqueue(
                      sse.encode("tool-input-start", { toolCallId: fakeCallId, toolName: pendingToolName }),
                    );
                    controller.enqueue(
                      sse.encode("status", { label: getToolLabel(pendingToolName) }),
                    );
                    controller.enqueue(
                      sse.encode("tool-input-available", { toolCallId: fakeCallId, input: parsedArgs }),
                    );

                    // Execute the tool directly (pass full context including conversationId)
                    let output: unknown;
                    try {
                      output = await toolDef.execute(parsedArgs, {
                        workspaceId,
                        userId: user.id,
                        conversationId,
                        onStatus: toolCtx.onStatus,
                      });
                    } catch (err) {
                      output = { error: err instanceof Error ? err.message : "Tool execution failed" };
                    }

                    controller.enqueue(
                      sse.encode("tool-output-available", { toolCallId: fakeCallId, output }),
                    );

                    // Handle inline component markers from tool output
                    const toolOut = output as Record<string, unknown> | null;
                    if (toolOut && typeof toolOut === "object") {
                      if ("__component" in toolOut) {
                        const compName = toolOut.__component as string;
                        const marker = JSON.stringify({ component: compName, props: toolOut.props });
                        fullAssistantContent = removePreviousMarkers(fullAssistantContent, compName);
                        fullAssistantContent += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
                      }
                      if ("__components" in toolOut && Array.isArray(toolOut.__components)) {
                        for (const comp of toolOut.__components as Array<{ component: string; props: Record<string, unknown> }>) {
                          if (comp?.component && comp?.props) {
                            const marker = JSON.stringify({ component: comp.component, props: comp.props });
                            fullAssistantContent += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
                          }
                        }
                      }
                    }

                    // Inject result into chatMessages so Mistral sees it and continues pipeline
                    const compressed = compressToolOutput(output);
                    const truncated = compressed.length > 4000
                      ? compressed.slice(0, compressed.lastIndexOf("\n", 4000) || 4000)
                      : compressed;
                    chatMessages.push({
                      role: "assistant",
                      content: `I executed ${pendingToolName} as the user confirmed. The tool completed successfully. I should now continue the pipeline with the next step (e.g. score_leads_batch, enrich, or draft) — do NOT re-parse the ICP or re-source leads.`,
                    });
                    chatMessages.push({
                      role: "user",
                      content: `[SYSTEM: Tool result from ${pendingToolName} — already executed, do not call ${pendingToolName} or parse_icp again]\n${truncated}`,
                    });

                    autoExecuted = true;
                    logger.info(`[auto-confirm] Executed ${pendingToolName} directly (user said: "${lastUserMsg}")`);
                  }
                }
              } else if (legacyMatch) {
                // Legacy marker without args — inject hint for Mistral (best-effort)
                const pendingToolName = legacyMatch[1];
                chatMessages.push({
                  role: "user",
                  content: `[SYSTEM: The user confirmed execution of ${pendingToolName}. Please call ${pendingToolName} now with the appropriate arguments from the conversation context.]`,
                });
                logger.info(`[auto-confirm] Legacy marker for ${pendingToolName}, injected hint`);
              }
            }
          }
        }

        // When auto-executed, remove the completed tool + parse_icp from available tools
        // so Mistral doesn't waste steps re-calling them
        const streamTools = autoExecuted
          ? Object.fromEntries(
              Object.entries(tools).filter(([name]) =>
                name !== "parse_icp" && name !== "count_leads" && name !== "preview_leads" &&
                !chatMessages.some(m => m.content.includes(`Tool result from ${name} — already executed`))
              ),
            )
          : tools;

        // Pre-confirm side-effect tools when user's message explicitly authorizes the full pipeline
        const PIPELINE_GO_RE = /\b(go|full pipeline|no questions|run everything|lance tout|execute|do it all)\b/i;
        const userWantsFullPipeline = lastUserMessage?.content ? PIPELINE_GO_RE.test(lastUserMessage.content) : false;
        const preConfirmedTools = userWantsFullPipeline
          ? new Set(Object.keys(streamTools).filter(name => streamTools[name].isSideEffect))
          : undefined;

        const generator = mistralClient.chatStream({
          system: systemPrompt,
          messages: chatMessages,
          tools: streamTools,
          workspaceId,
          userId: user.id,
          temperature: 0.7,
          maxSteps: 5,
          onStatus: toolCtx.onStatus,
          signal: req.signal,
          autonomyLevel: (workspace.autonomyLevel ?? "SUPERVISED") as AutonomyLevel,
          confirmedTools: preConfirmedTools,
        });

        // ── Auto-continue: when hitting step limit mid-pipeline, auto-start new turn ──
        const MAX_AUTO_CONTINUES = 3;
        let autoContinueCount = 0;
        let currentGenerator = generator;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          let hadToolCalls = false;
          let hitStepLimit = false;
          let hadConfirmation = false;

          for await (const event of currentGenerator) {
            // Track assistant content for DB save
            if (event.type === "text-delta") {
              fullAssistantContent += event.delta;
            }

            // Track tool activity
            if (event.type === "tool-input-start") hadToolCalls = true;
            if (event.type === "finish" && (event.finishReason === "length" || event.finishReason === "max_steps")) hitStepLimit = true;

            // Inline component markers — injected into content so they
            // persist in DB and render on reload too
            if (event.type === "tool-output-available") {
              const out = event.output as Record<string, unknown> | null;
              if (out && typeof out === "object") {
                // Track pending confirmation for next turn via hidden marker in content
                if ("__confirmation_required" in out && out.tool) {
                  hadConfirmation = true;
                  const savedArgs = out.__saved_args;
                  if (savedArgs) {
                    const argsJson = JSON.stringify(savedArgs);
                    fullAssistantContent += `\n@@PENDING_CONFIRM@@${out.tool}@@ARGS@@${argsJson}@@END@@`;
                  } else {
                    fullAssistantContent += `\n@@PENDING_CONFIRM@@${out.tool}@@END@@`;
                  }
                }
                // Single component
                if ("__component" in out) {
                  const compName = out.__component as string;
                  const marker = JSON.stringify({
                    component: compName,
                    props: out.props,
                  });
                  fullAssistantContent = removePreviousMarkers(fullAssistantContent, compName);
                  fullAssistantContent += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
                }
                // Multiple components (e.g. draft_emails_batch returning email previews)
                if ("__components" in out && Array.isArray(out.__components)) {
                  for (const comp of out.__components as Array<{ component: string; props: Record<string, unknown> }>) {
                    if (comp?.component && comp?.props) {
                      const marker = JSON.stringify({
                        component: comp.component,
                        props: comp.props,
                      });
                      fullAssistantContent += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
                    }
                  }
                }
              }
            }

            // Emit status labels for tool calls
            if (event.type === "tool-input-start") {
              const label = getToolLabel(event.toolName);
              controller.enqueue(sse.encode("status", { label }));
            }

            // Forward all events to client as named SSE events
            controller.enqueue(streamEventToSSE(sse, event));
          }

          // ── Auto-continue decision ──
          // Continue if: hit step limit + had tool calls + no confirmation pending + under limit
          const shouldContinue =
            hadToolCalls &&
            !hadConfirmation &&
            autoContinueCount < MAX_AUTO_CONTINUES &&
            (hitStepLimit || fullAssistantContent.trim().endsWith("?") === false);

          // Heuristic: if the last text ends with a question or has no tool calls, stop
          if (!hadToolCalls || hadConfirmation || autoContinueCount >= MAX_AUTO_CONTINUES) break;
          if (!hitStepLimit) break; // Normal completion, no need to continue

          // Auto-continue: save current content, inject continuation, start new turn
          autoContinueCount++;
          logger.info(`[auto-continue] Turn ${autoContinueCount}: continuing pipeline after step limit`);

          controller.enqueue(
            sse.encode("status", { label: "Continuing pipeline..." }),
          );

          // Build continuation messages from current conversation
          const continueMessages: ChatMessage[] = [
            ...chatMessages,
            { role: "assistant", content: fullAssistantContent },
            { role: "user", content: "[SYSTEM: The pipeline hit the tool step limit. Continue executing the next pipeline steps. Do NOT re-run completed steps. Do NOT ask for confirmation — the user already approved the full pipeline.]" },
          ];

          // Compress for the continuation
          const contContext = prepareMessagesForLLM(
            continueMessages,
            systemTokens,
            toolSchemaTokens,
          );

          // Pre-confirm all side-effect tools in auto-continue (user already approved pipeline)
          const continueConfirmed = new Set(
            Object.keys(tools).filter(name => tools[name].isSideEffect)
          );

          currentGenerator = mistralClient.chatStream({
            system: systemPrompt,
            messages: contContext.messages,
            tools,
            workspaceId,
            userId: user.id,
            temperature: 0.7,
            maxSteps: 5,
            onStatus: toolCtx.onStatus,
            signal: req.signal,
            autonomyLevel: (workspace.autonomyLevel ?? "SUPERVISED") as AutonomyLevel,
            confirmedTools: continueConfirmed,
          });
        }

        // Stream-end framing
        controller.enqueue(sse.encode("stream-end", {}));
      } catch (err) {
        controller.enqueue(
          sse.encode("error", {
            message: err instanceof Error ? err.message : "Stream failed",
          }),
        );
      } finally {
        if (keepAlive) clearInterval(keepAlive);
        streamClosed = true;

        // Post-stream: save assistant response + update conversation timestamp
        try {
          if (fullAssistantContent) {
            await prisma.message.create({
              data: {
                conversationId,
                role: "ASSISTANT",
                content: fullAssistantContent,
              },
            });
          }

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });
        } catch {
          logger.error("Failed to save assistant response to DB");
        }

        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
