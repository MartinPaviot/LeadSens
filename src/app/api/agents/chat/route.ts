import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildToolSet, filterToolsByPhase, getToolLabel } from "@/server/lib/tools";
import { getStyleSamples } from "@/server/lib/email/style-learner";
import {
  prepareMessagesForLLM,
  estimateTokens,
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
Ask for the website URL, call analyze_company_site. Never generate analysis from your own knowledge.
Present result (one-liner, personas, differentiators). Ask: "Does this look right?"
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

TRANSITION: confirmation/number → Phase 2. New criteria → re-run Phase 1. Never re-run if user just confirms.

AFTER SOURCING (same turn): When source_leads returns lead_ids + campaign_id:
1. If HubSpot is connected, call crm_check_duplicates with the lead_ids first to skip existing contacts.
2. Then call score_leads_batch (pass lead_ids, campaign_id, and the original icp_description).
3. Then continue to enrich_leads_batch. Do NOT pause between sourcing → scoring → enrichment.`;

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
STOP: wait for explicit activation request. Never offer to activate.`;

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
- If bounce rate > 5%, alert the user
- If reply rate < 2% after 7+ days, suggest reviewing email copy or ICP
- If a specific segment has 3x+ better reply rate, mention it

If user describes a new ICP, start a new pipeline from Phase 1.`;

// Pipeline rules (always included, but condensed)
const PIPELINE_RULES = `
PIPELINE RULES:
- Pass lead_ids and campaign_id between tools when available. If you lost track of lead_ids or campaign_id, you can omit them — score_leads_batch and enrich_leads_batch auto-resolve from the most recent campaign.
- Full chain: source → score → enrich → angle → draft → accounts → campaign → push.
- Only 2 mandatory pauses: (1) before sourcing (credits), (2) account selection.
- If a step fails, explain briefly and suggest an alternative. No loops, no retries.
- NEVER suggest "re-launching the search" or "criteria are too strict" when leads are already sourced. If a tool returned an error, explain that error.
- If user describes a new ICP at any point, start Phase 1 fresh.`;

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
  workspace: WorkspaceWithIntegrations & { autonomyLevel?: string },
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

  // Case 1: Nothing configured — full onboarding
  if (!hasCompanyDna && !hasESP) {
    return `Hey${name}, welcome to LeadSens! 👋

I'm your prospecting copilot. Describe your target, and I'll handle the rest: sourcing, enrichment, email drafting, and campaign management.

To get started, I need two things:

1. **Your website URL** so I can analyze your offer and personalize every email
2. **Your email platform**: connect Instantly, Smartlead, or Lemlist in *Settings > Integrations*

Start by giving me your website URL, and we'll go step by step.`;
  }

  // Case 2: Has ESP but no company DNA
  if (!hasCompanyDna && hasESP) {
    return `Hey${name}, your email platform is connected, perfect! ⚡

I just need **your website URL** to understand what you sell. I'll analyze your homepage, pricing, about page and extract the key arguments for your emails.

Send me your URL and we'll move on.`;
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
      .then((c) => c?.campaign ?? null),
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

        const generator = mistralClient.chatStream({
          system: systemPrompt,
          messages: chatMessages,
          tools,
          workspaceId,
          userId: user.id,
          temperature: 0.7,
          maxSteps: 5,
          onStatus: toolCtx.onStatus,
          signal: req.signal,
          autonomyLevel: (workspace.autonomyLevel ?? "SUPERVISED") as AutonomyLevel,
        });

        for await (const event of generator) {
          // Track assistant content for DB save
          if (event.type === "text-delta") {
            fullAssistantContent += event.delta;
          }

          // Inline component markers — injected into content so they
          // persist in DB and render on reload too
          if (event.type === "tool-output-available") {
            const out = event.output as Record<string, unknown> | null;
            if (out && typeof out === "object") {
              // Single component
              if ("__component" in out) {
                const compName = out.__component as string;
                const marker = JSON.stringify({
                  component: compName,
                  props: out.props,
                });
                // Remove previous marker for singleton components (last wins)
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
