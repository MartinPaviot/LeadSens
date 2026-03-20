# Data Flow Diagram — LeadSens Chat System

> Generated: 2026-03-16

---

## 1. Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React)                             │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ GreetingScreen│───▶│   Composer   │───▶│     AgentChat         │  │
│  │ (tools, ICP)  │    │ (input/send) │    │ (orchestrator, 661L)  │  │
│  └──────────────┘    └──────────────┘    │                       │  │
│                                          │  handleSend()          │  │
│                                          │    │                   │  │
│                                          │    ▼                   │  │
│                                          │  POST /api/agents/chat │  │
│                                          │    │ (SSE stream)      │  │
│                                          │    │                   │  │
│                                          │    ▼                   │  │
│  ┌──────────────┐    ┌──────────────┐    │  eventsource-parser   │  │
│  │   Thread     │◀───│ AssistantMsg │◀───│    │                   │  │
│  │ (viewport)   │    │ (markdown +  │    │    ├─ text-delta       │  │
│  │              │    │  inline)     │    │    ├─ tool-input-start │  │
│  │  ┌────────┐  │    └──────────────┘    │    ├─ tool-output      │  │
│  │  │UserMsg │  │                        │    ├─ status           │  │
│  │  └────────┘  │    ┌──────────────┐    │    ├─ step-complete    │  │
│  │              │    │ThinkingBlock │◀───│    ├─ finish           │  │
│  │              │    │ (steps)      │    │    └─ error            │  │
│  │  ┌────────┐  │    └──────────────┘    │                       │  │
│  │  │Suggest │  │                        │  RAF batch update      │  │
│  │  │ Chips  │  │                        │  (pendingContent)      │  │
│  │  └────────┘  │                        └───────────────────────┘  │
│  └──────────────┘                                                   │
│                                                                     │
│  ┌─────────────────── Inline Cards (12) ─────────────────────────┐  │
│  │ lead-table │ email-preview │ enrichment │ account-picker      │  │
│  │ campaign-summary │ campaign-status │ campaign-analytics      │  │
│  │ campaign-launch │ analytics-report │ pipeline-progress       │  │
│  │ job-progress │ progress-bar                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────── Controls ──────────────────────────────────┐  │
│  │ AutonomySelector │ ThemeToggle │ ScrollToBottom │ Sidebar     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ POST (SSE)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVER (Next.js API Route)                       │
│                                                                     │
│  /api/agents/chat/route.ts                                          │
│                                                                     │
│  1. Auth check (better-auth)                                        │
│  2. Load/create conversation (Prisma)                               │
│  3. Build system prompt:                                            │
│     ┌──────────────────────────────────┐                            │
│     │ CORE PROMPT (personality, rules) │                            │
│     │ + PHASE PROMPT (tiered by phase) │                            │
│     │ + COMPANY DNA (from workspace)   │                            │
│     │ + MEMORY (ICPs, style prefs)     │                            │
│     │ + STYLE CORRECTIONS (feedback)   │                            │
│     │ + CONNECTED INTEGRATIONS         │                            │
│     │ + PIPELINE STATE (phase, counts) │                            │
│     │ + AUTONOMY MODE                  │                            │
│     └──────────────────────────────────┘                            │
│  4. Filter tools by phase                                           │
│  5. Mistral tool loop (max 5 rounds):                               │
│     ┌─────────────────────────────────────┐                         │
│     │  Mistral Large (stream: true)       │                         │
│     │    ├─ text tokens → SSE text-delta  │                         │
│     │    └─ tool_calls → execute tool     │                         │
│     │         ├─ SSE tool-input-start     │                         │
│     │         ├─ Tool execution           │──▶ External APIs        │
│     │         ├─ SSE tool-output          │                         │
│     │         │   └─ __component marker?  │                         │
│     │         │      └─ @@INLINE@@...@@   │                         │
│     │         └─ Next round               │                         │
│     └─────────────────────────────────────┘                         │
│  6. Save messages to DB                                             │
│  7. SSE finish event (tokens, steps)                                │
│                                                                     │
│  SSE Encoder (sse.ts):                                              │
│    event: {type}\nid: {n}\ndata: {json}\n\n                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Tool Execution │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     TOOL LAYER                                       │
│                                                                     │
│  Tools Registry (tools/index.ts)                                    │
│  24 tools total, filtered to 14-15 per phase                        │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ ICP Tools   │  │ Pipeline     │  │ ESP Tools                │   │
│  │ parse_icp   │  │ source_leads │  │ create_campaign          │   │
│  │ count_leads │  │ score_batch  │  │ add_leads_to_campaign    │   │
│  │ preview     │  │ enrich_batch │  │ push_campaign            │   │
│  └─────────────┘  │ draft_batch  │  │ list_accounts            │   │
│                    └──────────────┘  │ sync_analytics           │   │
│  ┌─────────────┐  ┌──────────────┐  └──────────────────────────┘   │
│  │ Email Tools │  │ Enrichment   │  ┌──────────────────────────┐   │
│  │ draft_email │  │ jina_scrape  │  │ Analytics Tools          │   │
│  │ edit_email  │  │ apify_linkedin│  │ campaign_report          │   │
│  │ quality_gate│  │ summarize    │  │ get_replies              │   │
│  └─────────────┘  └──────────────┘  │ classify_reply           │   │
│                                      └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐             │
│  │ Mistral  │  │Instantly │  │  Jina  │  │  Apify   │             │
│  │ Large/   │  │Smartlead │  │ Reader │  │ LinkedIn │             │
│  │ Small    │  │ Lemlist  │  │        │  │          │             │
│  └──────────┘  └──────────┘  └────────┘  └──────────┘             │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐                           │
│  │ HubSpot  │  │ Apollo   │  │TinyFish│                           │
│  │ (CRM)    │  │ (enrich) │  │ (auto) │                           │
│  └──────────┘  └──────────┘  └────────┘                           │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                       │
│                                                                     │
│  PostgreSQL (Neon) via Prisma                                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Workspace ──┬── Campaign ──┬── Lead ──── EmailDraft          │   │
│  │             │              │           └── EmailPerformance   │   │
│  │             │              └── StepAnalytics                  │   │
│  │             │              └── ABVariant                      │   │
│  │             ├── Integration (encrypted API keys)              │   │
│  │             ├── CompanyDNA                                    │   │
│  │             └── Conversation ── Message                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Redis (rate limiting, caching)                                     │
│  Inngest (3 background jobs: analytics cron, enrich, draft)         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inline Component Injection Flow

```
Server (route.ts)                         Client (agent-chat.tsx → assistant-message.tsx)
─────────────────                         ──────────────────────────────────────────────

Tool returns:                             eventsource-parser receives text-delta:
{ __component: "lead-table",              "@@INLINE@@{\"component\":\"lead-table\",
  props: { leads: [...] } }                \"props\":{\"leads\":[...]}}@@END@@"
        │                                          │
        ▼                                          ▼
route.ts wraps:                           agent-chat extracts markers
@@INLINE@@{json}@@END@@                   from pendingContent
        │                                          │
        ▼                                          ▼
SSE text-delta event                      Injects into message.content
        │                                          │
        │                                          ▼
        │                                 assistant-message.tsx:
        │                                 1. Regex split on @@INLINE@@...@@END@@
        │                                 2. Text segments → react-markdown
        │                                 3. Component segments → getInlineComponent()
        │                                 4. Lazy load + <Suspense>
        │                                 5. Singleton dedup (last occurrence wins)
        │                                          │
        │                                          ▼
        │                                 Rendered inline card
        │                                 (interactive: sort, edit, export, etc.)
        └──────────────────────────────────────────┘
```

---

## 3. Phase-Based System Prompt Assembly

```
buildSystemPrompt(workspace, campaign, integrations, autonomy):

  ┌─────────────────────────────────┐
  │ 1. CORE PROMPT                  │  ← Always included
  │    - Personality (LeadSens)     │     "You are LeadSens, an AI agent..."
  │    - Communication rules        │     "Be concise, ask clarifying questions..."
  │    - Tool usage rules           │     "Max 5 tool rounds per message"
  │    - Phase transition rules     │     "Score after sourcing, enrich after scoring..."
  └─────────────┬───────────────────┘
                │
  ┌─────────────▼───────────────────┐
  │ 2. PHASE PROMPT (one of 6)     │  ← Based on campaign.status
  │    ONBOARDING: ask for website  │
  │    DISCOVERY: ICP validation    │
  │    SOURCING: score + enrich     │
  │    ENRICHING: enrich + draft    │
  │    PUSHING: accounts + campaign │
  │    ACTIVE: replies + analytics  │
  └─────────────┬───────────────────┘
                │
  ┌─────────────▼───────────────────┐
  │ 3. DYNAMIC CONTEXT             │  ← Workspace-specific
  │    - CompanyDNA (one-liner,     │
  │      buyers, differentiators)   │
  │    - Memory (past ICPs, prefs)  │
  │    - Style corrections          │
  │    - Connected integrations     │
  │    - Pipeline state             │
  │    - Autonomy mode              │
  └─────────────┬───────────────────┘
                │
                ▼
  Final system prompt → Mistral Large
```

---

## 4. Custom Event Flow (Card → Agent)

```
AccountPickerCard                      AgentChat                    Server
────────────────                      ─────────                    ──────
User clicks "Confirm"
  │
  ▼
window.dispatchEvent(
  CustomEvent("leadsens:accounts-selected",
    { detail: { accounts: ["a@b.com"] } })
)
                                      │
                                      ▼
                                    listener catches event
                                    threadRuntime.send(
                                      "Use these accounts: a@b.com"
                                    )
                                      │
                                      ▼
                                    handleSend() → POST /api/agents/chat
                                                          │
                                                          ▼
                                                    Server processes
                                                    (create campaign, etc.)


CampaignLaunchPreviewCard             AgentChat                    Server
─────────────────────────             ─────────                    ──────
User clicks "Launch"
  │
  ▼
window.dispatchEvent(
  CustomEvent("leadsens:campaign-launch",
    { detail: { action: "launch" } })
)
                                      │
                                      ▼
                                    listener catches event
                                    threadRuntime.send("Launch the campaign")
                                      │
                                      ▼
                                    handleSend() → POST /api/agents/chat
                                                          │
                                                          ▼
                                                    push_campaign tool
                                                    → ESP API call
```

---

## 5. Retry & Error Flow

```
handleSend()
  │
  ▼
fetch(POST /api/agents/chat)
  │
  ├─ Success → SSE stream processing (normal flow)
  │
  ├─ AbortError → User cancelled (silent exit)
  │
  └─ Network/Server Error
       │
       ▼
     retryCount < MAX_RETRIES (3)?
       │
       ├─ Yes → delay = baseDelay * 2^(retry-1)
       │         setTimeout(retry, delay)
       │
       └─ No → Show error in chat
                "Something went wrong. Please try again."
```
