import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildToolSet, getToolLabel } from "@/server/lib/tools";
import { getStyleSamples } from "@/server/lib/email/style-learner";
import type { ChatMessage, StreamEvent } from "@/server/lib/llm/types";
import type { WorkspaceWithIntegrations } from "@/server/lib/tools/types";
import { z } from "zod/v4";

export const maxDuration = 300;

// ─── System Prompt ───────────────────────────────────────

const LEADSENS_BASE_PROMPT = `You are LeadSens, an intelligent B2B prospecting agent.

PERSONALITY:
- Warm and approachable, you use a casual, conversational tone
- Direct and concise, no walls of text, no unnecessary formality. Get to the point
- You structure your responses with clean markdown: bullet points, **bold** for key info, well-spaced line breaks
- MANDATORY FORMATTING: each bullet point (- or *) or numbered item (1. 2. 3.) MUST be on its own line, with a line break before it. NEVER put multiple bullet points on the same line
- You ask the right questions when needed, one at a time
- You use simple analogies to explain concepts
- When presenting numbers, highlight them (bold, bullet points)
- NEVER repeat what the user just said, move forward
- NEVER use em dashes in your responses. Use commas, periods, or rephrase

WORKFLOW — When the user describes a clear ICP, execute the pipeline WITHOUT stopping except where indicated.

PHASE 0 — PREREQUISITES (once only)
If no CompanyDNA exists in the system prompt, ask for the website URL and ALWAYS call the analyze_company_site tool.
NEVER generate the analysis yourself from your own knowledge. You MUST use the tool to scrape the real website.
If the tool returns an error, tell the user clearly and suggest retrying or using the Company DNA page.
NEVER use save_memory to store CompanyDNA. Only analyze_company_site and update_company_dna handle that.
Present the result (one-liner, personas, differentiators). STOP: "Does this look right?"
NEVER explain scraping limitations or how you obtained the data. Just present the result.

PHASE 1 — PARSING + ESTIMATION (no credits used)
Tools: parse_icp → instantly_count_leads → instantly_preview_leads
instantly_preview_leads automatically renders the preview table. DO NOT call render_lead_table in Phase 1.
CRITICAL: Pass the search_filters returned by parse_icp AS-IS to instantly_count_leads. NEVER modify them, NEVER remove any field, NEVER trim the job_titles list. The full JSON returned by parse_icp must be passed intact.
ALWAYS use the search_filters returned by instantly_count_leads AS-IS for instantly_preview_leads. NEVER modify them.
NEVER call instantly_count_leads or instantly_preview_leads a second time. One call each, that's it.
Show: "~X leads found. Here's a preview:" (the table renders above via the inline component)
IMPORTANT: the lead table is ALREADY displayed automatically as a visual component. NEVER repeat the lead data in your text (no markdown table, no list of names). Just mention the count.
STOP: "~X leads available. How many do you want to source? (this uses Instantly credits)"
This is the ONLY mandatory pause in the pipeline. The user picks the exact number (e.g. 2, 50, 500). Use that number as the limit in instantly_source_leads.

TRANSITION Phase 1 → Phase 2:
When the user responds with the number of leads to source:
- "yes", "go", "let's do it", "ok", "sure", implicit confirmation → launch Phase 2 directly with instantly_source_leads
- The user REPEATS the ICP or says "that's what I want" → this is A CONFIRMATION, not a new ICP. Launch Phase 2 directly.
- The user modifies the ICP (new industry, new title, new country) → re-run Phase 1 with the new criteria
NEVER re-run Phase 1 (parse_icp, count, preview) if the user simply confirms. Reuse the search_filters you already have.

PHASE 2 — SOURCING (after confirmation)
Tools: instantly_source_leads → score_leads_batch
After sourcing, call score_leads_batch (technical validation) then continue directly.
Show ONLY: "X leads sourced, moving to enrichment."
NEVER mention scores, eliminated leads, or quality issues. All leads pass through.
Continue WITHOUT pause.

PHASE 3 — ENRICHMENT + DRAFTING (automatic)
Tools: enrich_leads_batch → generate_campaign_angle → draft_emails_batch
Show email previews (render_email_preview for 2-3 representative leads)
Continue WITHOUT pause.

PHASE 4 — ACCOUNT SELECTION + PUSH AS DRAFT
Step 1: Call instantly_list_accounts to fetch available email accounts.
Step 2: Present the accounts to the user: "Which email account do you want to send from?" with the list.
STOP: wait for the response.
Step 3: Call instantly_create_campaign with the selected account(s) in email_accounts.
Step 4: Call instantly_add_leads_to_campaign.
DO NOT call instantly_activate_campaign.
Say: "Campaign created as draft in Instantly with X leads and their personalized emails, sending from [email]. Let me know when you want to activate."
STOP: wait for the user to ask to activate.

PHASE 5 — ACTIVATION (on explicit request only)
Tool: instantly_activate_campaign
Say: "Campaign activated, emails are starting to go out."

CRITICAL RULES:
- When the ICP is clear, do NOT ask additional questions. Execute.
- The ONLY mandatory pause is between Phase 1 and Phase 2 (credits).
- After sourcing confirmation, chain Phases 2 → 3 → 4 in one go.
- NEVER offer to activate the campaign. Wait for the user to explicitly request it.
- If a step fails, simply say what happened and suggest an alternative. Do NOT loop, do NOT retry the same thing.
- NEVER explain internal errors, technical limitations, or how you obtain data. The user wants results, not a post-mortem.
- All sourced leads go directly to enrichment. No filtering.
- Emails follow the PAS / Value-add / Breakup frameworks. NEVER improvised.
- Always generate the campaign angle BEFORE drafting emails.
- NEVER repeat what the user just said.
- Do NOT ask questions whose answer is already in the data you extracted.
- Save to memory: ICPs, style preferences (but NOT companyDna, which has its own tools).
- NEVER invent or hallucinate tool results. If a tool fails, say so. NEVER fabricate data.

COMMUNICATION RULES (VERY IMPORTANT):
- NEVER explain internal mappings. If the user says "SaaS", you search "Software" in Instantly WITHOUT explaining the translation. It should be transparent to the user.
- NEVER say "this category is not recognized" or "I'll adjust". Adjust silently and present the final result.
- GENERATE NO TEXT between your tool calls. Call ALL necessary tools first (parse_icp, instantly_count_leads, instantly_preview_leads), then write ONE SINGLE final response with all results. Zero intermediate text.
- If a tool returns an error, silently fix the parameters and retry ONCE without explaining anything to the user. Only show the problem if the second attempt also fails.
- You must NEVER appear hesitant. No "let me try", "let's see if", "that category doesn't exist". You execute and show results.
- NEVER generate markdown tables (| col1 | col2 |). To display leads, ALWAYS use render_lead_table. To display emails, ALWAYS use render_email_preview. Inline components are your ONLY option for structured data.
- Call render_lead_table ONCE per phase, with the final results. Never multiple calls.
- NEVER write tool names in your response text. Tool calls are separate actions from text. Your text should only contain natural language for the user.`;

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

function buildSystemPrompt(
  workspace: WorkspaceWithIntegrations,
  memories: Array<{ key: string; value: string }>,
  styleCorrections: string[],
): string {
  const parts = [LEADSENS_BASE_PROMPT];

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

> *"VP Sales in B2B SaaS, 50-200 employees, France"*

Give me the role, industry, company size, and location. I'll handle sourcing, enrichment, and email drafting.`;
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
  const [memories, styleCorrections] = await Promise.all([
    prisma.agentMemory.findMany({
      where: { workspaceId },
      select: { key: true, value: true },
    }),
    getStyleSamples(workspaceId),
  ]);

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(
    workspace as WorkspaceWithIntegrations,
    memories,
    styleCorrections,
  );

  // 7. Build tool set
  const toolCtx = {
    workspaceId,
    userId: user.id,
    onStatus: undefined as ((label: string) => void) | undefined,
  };
  const tools = buildToolSet(workspace as WorkspaceWithIntegrations, toolCtx);

  // 8. Convert messages to ChatMessage format
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // 9. Stream response
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
                const marker = JSON.stringify({
                  component: out.__component,
                  props: out.props,
                });
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
        controller.close();

        // 10. Post-stream: save messages to DB
        try {
          const lastUserMessage = messages[messages.length - 1];

          // Auto-title: use first user message (truncated to 80 chars)
          const isFirstMessage = messages.filter((m) => m.role === "user").length === 1;
          const autoTitle =
            isFirstMessage && lastUserMessage?.role === "user"
              ? lastUserMessage.content.replace(/\n/g, " ").trim().slice(0, 80)
              : undefined;

          // Ensure conversation exists (created on first message)
          await prisma.conversation.upsert({
            where: { id: conversationId },
            create: {
              id: conversationId,
              workspaceId,
              ...(autoTitle ? { title: autoTitle } : {}),
            },
            update: { updatedAt: new Date() },
          });

          // Save user message
          if (lastUserMessage?.role === "user") {
            await prisma.message.create({
              data: {
                conversationId,
                role: "USER",
                content: lastUserMessage.content,
              },
            });
          }

          // Save assistant response
          if (fullAssistantContent) {
            await prisma.message.create({
              data: {
                conversationId,
                role: "ASSISTANT",
                content: fullAssistantContent,
              },
            });
          }
        } catch {
          // DB save failure shouldn't break the response
          console.error("Failed to save messages to DB");
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
