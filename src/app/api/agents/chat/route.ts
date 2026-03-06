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
import type { ChatMessage, StreamEvent } from "@/server/lib/llm/types";
import type { WorkspaceWithIntegrations } from "@/server/lib/tools/types";
import { z } from "zod/v4";

export const maxDuration = 300;

// ─── System Prompt (tiered by pipeline phase) ───────────

const CORE_PROMPT = `You are LeadSens, an intelligent B2B prospecting agent.

PERSONALITY: Warm, direct, concise. Casual tone, clean markdown (bullets on own lines, **bold** key info). One question at a time. No walls of text, no em dashes, no repeating what the user said.

COMMUNICATION:
- Silent execution: never explain internal mappings, adjustments, or limitations. Just do it and show results.
- Zero text between tool calls. Call all needed tools, then ONE response.
- Tool errors: silently fix params, retry ONCE. Only report if retry also fails.
- Structured data: ALWAYS use render_lead_table / render_email_preview / show_drafted_emails. Never markdown tables, never raw @@INLINE@@ markers, never tool names in text.
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
Tools: parse_icp → instantly_count_leads → instantly_preview_leads
- Pass search_filters AS-IS between tools. Never modify, remove fields, or trim job_titles.
- After parse_icp, ALWAYS present the human_summary to the user for confirmation before calling instantly_count_leads. Example: "Voici les filtres : {human_summary}. C'est bien ça ?"
- Preview renders automatically. Never repeat lead data in text.
- One count call only. Default preview: 5 leads.
STOP: "~X leads available. How many do you want to source? (this uses Instantly credits)"

TRANSITION: confirmation/number → Phase 2. New criteria → re-run Phase 1. Never re-run if user just confirms.`;

// Phase 2: sourcing + scoring
const PHASE_SOURCING = `
CURRENT PHASE: SOURCING + SCORING
Tools: instantly_source_leads → score_leads_batch
- Pass lead_ids AND campaign_id from source result to score.
- Report dedup results. Never mention scores or quality issues.
Continue to enrichment WITHOUT pause.`;

// Phase 3: enrichment + drafting
const PHASE_ENRICHING = `
CURRENT PHASE: ENRICHMENT + DRAFTING
Tools: enrich_leads_batch → generate_campaign_angle → draft_emails_batch
- Pass lead_ids + campaign_id through the chain.
- Always generate campaign angle BEFORE drafting.
- Email previews render automatically.
Continue to account selection WITHOUT pause.`;

// Phase 4: account selection + push
const PHASE_PUSHING = `
CURRENT PHASE: CAMPAIGN SETUP
Step 1: instantly_list_accounts (account picker renders automatically). STOP: wait for user selection.
Step 2: instantly_create_campaign with selected email_accounts.
Step 3: instantly_add_leads_to_campaign.
Say: "Campaign created as draft with X leads. Let me know when you want to activate."
STOP: wait for explicit activation request. Never offer to activate.`;

// Phase 5: active
const PHASE_ACTIVE = `
CURRENT PHASE: CAMPAIGN ACTIVE
Campaign is live. Respond to questions about leads, emails, or new campaigns.
If user describes a new ICP, start a new pipeline from Phase 1.`;

// Pipeline rules (always included, but condensed)
const PIPELINE_RULES = `
PIPELINE RULES:
- Always pass lead_ids and campaign_id between tools. Never skip.
- Full chain: source → score → enrich → angle → draft → accounts → campaign → push.
- Only 2 mandatory pauses: (1) before sourcing (credits), (2) account selection.
- If a step fails, explain briefly and suggest an alternative. No loops, no retries.
- If user describes a new ICP at any point, start Phase 1 fresh.`;

type CampaignPhase = "DRAFT" | "SOURCING" | "SCORING" | "ENRICHING" | "DRAFTING" | "READY" | "PUSHED" | "ACTIVE";

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

function buildSystemPrompt(
  workspace: WorkspaceWithIntegrations,
  memories: Array<{ key: string; value: string }>,
  styleCorrections: string[],
  campaign: PipelineState | null,
): string {
  const hasCompanyDna = !!workspace.companyDna;
  const campaignStatus = campaign?.status as CampaignPhase | null;
  const phasePrompt = getPhasePrompt(hasCompanyDna, campaignStatus);

  const parts = [CORE_PROMPT, phasePrompt, PIPELINE_RULES];

  if (workspace.companyDna) {
    const dna = workspace.companyDna as Record<string, unknown>;
    if (typeof dna === "object" && dna !== null && "oneLiner" in dna) {
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
  const hasInstantly = workspace.integrations.some(
    (i) => i.type === "INSTANTLY" && i.status === "ACTIVE",
  );

  const name = firstName ? ` ${firstName}` : "";

  // Case 1: Nothing configured — full onboarding
  if (!hasCompanyDna && !hasInstantly) {
    return `Hey${name}, welcome to LeadSens! 👋

I'm your prospecting copilot. Describe your target, and I'll handle the rest: sourcing, enrichment, email drafting, and pushing everything into Instantly.

To get started, I need two things:

1. **Your website URL** so I can analyze your offer and personalize every email
2. **Your Instantly account**: connect it in *Settings > Integrations* with your API V2 key

Start by giving me your website URL, and we'll go step by step.`;
  }

  // Case 2: Has Instantly but no company DNA
  if (!hasCompanyDna && hasInstantly) {
    return `Hey${name}, Instantly is connected, perfect! ⚡

I just need **your website URL** to understand what you sell. I'll analyze your homepage, pricing, about page and extract the key arguments for your emails.

Send me your URL and we'll move on.`;
  }

  // Case 3: Has company DNA but no Instantly
  if (hasCompanyDna && !hasInstantly) {
    const dna = workspace.companyDna as Record<string, unknown>;
    const oneLiner =
      typeof dna === "object" && dna !== null && "oneLiner" in dna
        ? String(dna.oneLiner)
        : null;

    return `Hey${name}! ${oneLiner ? `I have your offer in mind: *${oneLiner}*` : "Your offer is configured."}

I just need **Instantly** to start sourcing and sending. Connect your account in *Settings > Integrations* with your API V2 key.

Once that's done, we'll launch your first campaign.`;
  }

  // Case 4: Everything ready — ask for ICP
  const dna = workspace.companyDna as Record<string, unknown>;
  const oneLiner =
    typeof dna === "object" && dna !== null && "oneLiner" in dna
      ? String(dna.oneLiner)
      : null;

  return `Hey${name}, everything's set up! 🚀${oneLiner ? ` I have your offer: *${oneLiner}*` : ""}, Instantly connected.

Describe your target for this campaign. For example:

> *"Marketing managers in fashion, France"*
> *"VP Sales in B2B SaaS, 50-500 employees, US + UK"*

Give me the role, industry, and location. I'll handle sourcing, enrichment, and email drafting.`;
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

  // 4. Greeting fast-path — deterministic, no LLM
  if (isGreeting) {
    const firstName = (user.name ?? "").split(" ")[0] || undefined;
    const greetingText = buildGreeting(workspace as WorkspaceWithIntegrations, firstName);
    const sse = new SSEEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(sse.retryDirective(3000));
          controller.enqueue(
            sse.encode("stream-start", {
              streamId: generateStreamId(),
              conversationId,
              ts: Date.now(),
            }),
          );
          controller.enqueue(
            sse.encode("text-delta", { delta: greetingText }),
          );
          controller.enqueue(
            sse.encode("finish", {
              tokensIn: 0,
              tokensOut: 0,
              totalSteps: 0,
              finishReason: "stop",
            }),
          );
          controller.enqueue(sse.encode("stream-end", {}));

          // Persist conversation + greeting message to DB
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
        } catch (err) {
          controller.enqueue(
            sse.encode("error", {
              message: err instanceof Error ? err.message : "Greeting failed",
            }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
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

  console.log(
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
    console.error("Failed to pre-save conversation");
  }

  // 10. Stream response
  const sse = new SSEEncoder();
  let fullAssistantContent = "";
  const toolCalls: Array<{ toolName: string; input: unknown; output: unknown }> = [];

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

        // Notify user if context was windowed
        if (contextResult.windowed) {
          controller.enqueue(
            sse.encode("status", { label: "Long conversation, refreshing context..." }),
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
          maxSteps: 15,
          onStatus: toolCtx.onStatus,
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

          // Track tool calls for DB save
          if (event.type === "tool-input-available") {
            toolCalls.push({
              toolName: "",
              input: event.input,
              output: null,
            });
          }
          if (event.type === "tool-output-available" && toolCalls.length > 0) {
            toolCalls[toolCalls.length - 1].output = event.output;
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
          console.error("Failed to save assistant response to DB");
        }

        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
