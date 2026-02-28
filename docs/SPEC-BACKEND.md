# SPEC-BACKEND.md — Patterns d'implémentation Backend

> **Origine :** Specs Elevay, nettoyées et adaptées pour LeadSens.
> **Rôle :** Référence d'implémentation. Les prompts de `docs/PROMPTS.md` citent les sections de ce fichier.

---

## 1. tRPC Layer

### 1.1 Context (Auth → User → Workspace)

```typescript
// src/server/trpc/context.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createContext(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) throw new AuthError();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { workspace: true },
  });
  if (!user) throw new AuthError();

  return {
    userId: user.id,
    workspaceId: user.workspaceId,
    workspace: user.workspace,
  };
}
```

### 1.2 Router Pattern

```typescript
export const leadRouter = router({
  list: protectedProcedure
    .input(z.object({
      campaignId: z.string().optional(),
      status: z.nativeEnum(LeadStatus).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.lead.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...(input.campaignId && { campaignId: input.campaignId }),
          ...(input.status && { status: input.status }),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });
    }),
});
```

---

## 2. Streaming Protocol (SSE)

```
Client                                    Server
  │                                         │
  │  POST /api/agents/chat                  │
  │  { conversationId, messages }           │
  │ ──────────────────────────────────────→ │
  │                                         │  Auth + load workspace + build context
  │                                         │  Compose system prompt
  │                                         │  Merge tools (buildToolSet)
  │                                         │  Call Mistral chatStream()
  │                                         │
  │  data: {"type":"status","label":"Estimating available leads..."}
  │ ←────────────────────────────────────── │
  │                                         │
  │  data: {"type":"text-delta","delta":"I found"}
  │  data: {"type":"text-delta","delta":" 2,400 leads"}
  │ ←────────────────────────────────────── │
  │                                         │
  │  data: {"type":"tool-input-start","toolName":"instantly_count_leads"}
  │ ←────────────────────────────────────── │
  │                                         │
  │  data: {"type":"tool-output-available","output":{count:2400}}
  │ ←────────────────────────────────────── │
  │                                         │
  │  data: {"type":"text-delta","delta":"Tu veux que j'en source combien ?"}
  │ ←────────────────────────────────────── │
  │                                         │
  │  data: {"type":"finish","usage":{...}}  │
  │ ←────────────────────────────────────── │
```

### 2.1 StreamEvent Types

```typescript
type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-available"; toolCallId: string; input: unknown }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "status"; label: string }
  | { type: "step-complete"; usage: { tokensIn: number; tokensOut: number } }
  | { type: "finish"; usage: TotalUsage; finishReason: string }
  | { type: "error"; message: string };
```

### 2.2 Context Building

Le system prompt est composé dynamiquement avant chaque appel LLM :

```typescript
const systemPrompt = [
  LEADSENS_BASE_PROMPT,
  workspace.companyDna
    ? `\n## Your client's company\n${workspace.companyDna}`
    : "",
  styleCorrections.length > 0
    ? `\n## Style Guide (learn from these corrections)\n${styleCorrections.join("\n")}`
    : "",
  memories.length > 0
    ? `\n## What you remember\n${memories.map(m => `- ${m.key}: ${m.value}`).join("\n")}`
    : "",
  `\n## Connected integrations\n${connectedIntegrations.join(", ") || "None yet"}`,
].join("\n");
```

---

## 3. Tool System

### 3.1 Tool Definition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (args: any, ctx: ToolContext) => Promise<any>;
  isSideEffect?: boolean;
}

interface ToolContext {
  workspaceId: string;
  userId: string;
  onStatus?: (label: string) => void;
}
```

### 3.2 Tool Registry (Dynamic Loading)

```typescript
export function buildToolSet(workspace: WorkspaceWithIntegrations, ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    ...createMemoryTools(ctx),
    ...(hasIntegration(workspace, "INSTANTLY") ? createInstantlyTools(workspace, ctx) : {}),
    ...(hasIntegration(workspace, "HUBSPOT") ? createHubSpotTools(workspace, ctx) : {}),
    ...createEnrichmentTools(ctx),
    ...createEmailTools(ctx),
    ...createInlineTools(),
  };
}
```

### 3.3 Activity Labels

```typescript
const TOOL_LABELS: Record<string, string> = {
  instantly_count_leads: "Estimating available leads...",
  instantly_source_leads: "Sourcing leads via SuperSearch...",
  instantly_preview_leads: "Previewing leads...",
  crm_check_duplicates: "Checking duplicates in your CRM...",
  score_leads_batch: "Scoring leads against your ICP...",
  enrich_leads_batch: "Enriching lead profiles via Jina...",
  draft_emails_batch: "Writing personalized emails...",
  instantly_create_campaign: "Creating campaign in Instantly...",
  instantly_add_leads_to_campaign: "Adding leads to campaign...",
  instantly_activate_campaign: "Activating campaign...",
  crm_sync_contacts: "Syncing contacts to your CRM...",
  save_memory: "Saving to memory...",
};

// Fallback
if (toolName.startsWith("render_")) return "Preparing response...";
```

---

## 4. Lead Pipeline — Score → Enrich → Draft

> **Ordre critique : scoring AVANT scraping.** Seuls les leads avec score ≥ 5 sont enrichis via Jina. Sur 500 leads sourcés, si 200 sont éliminés au scoring, ça économise 200 appels Jina + 200 appels Mistral Small.

### 4.1 ICP Scoring sur données brutes Instantly (Mistral Small)

Le scoring utilise UNIQUEMENT les données retournées par Instantly SuperSearch (titre, entreprise, industrie, taille). Pas besoin de scraping pour scorer.

```typescript
async function scoreLead(lead: Lead, icpDescription: string): Promise<IcpScore> {
  return await mistralClient.json<IcpScore>({
    model: "mistral-small-latest",
    system: "You are an ICP scoring engine. Score 1-10 with breakdown. JSON only, no comments.",
    prompt: `
ICP: ${icpDescription}

Lead (raw Instantly data):
- Name: ${lead.firstName} ${lead.lastName}
- Job Title: ${lead.jobTitle}
- Company: ${lead.company}
- Industry: ${lead.industry || "unknown"}
- Company Size: ${lead.companySize || "unknown"}
- Location: ${lead.country || "unknown"}

Score this lead 1-10. JSON: {"score": N, "breakdown": {"jobTitleFit": N, "companyFit": N, "industryRelevance": N, "locationFit": N}, "reason": "one sentence"}`,
  });
}
```

**Leads avec score < 5 → status SKIPPED. Pas de Jina dessus.**

### 4.2 Enrichment via Jina Reader (leads qualifiés uniquement)

```typescript
// src/server/lib/enrichment/jina-scraper.ts
const JINA_BASE = "https://r.jina.ai";

async function scrapeViaJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: { Accept: "text/markdown" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const md = await res.text();
    return md.slice(0, 5000); // Tronquer pour le context window
  } catch {
    return null; // Fail → skip, lead reste SCORED
  }
}
```

### 4.3 Summarization → JSON structuré (Mistral Small)

L'output DOIT être un JSON structuré consommable par le prompt email.

```typescript
const SUMMARIZER_SYSTEM = `Extract structured info from this company website. Return ONLY valid JSON:
{
  "companySummary": "2-3 sentences",
  "products": ["..."],
  "targetMarket": "who they sell to",
  "valueProposition": "main pitch",
  "painPoints": ["pain point 1", "pain point 2"],
  "recentNews": [],
  "techStack": [],
  "teamSize": "estimate or null",
  "signals": ["buying signals"]
}
If not found → null or []. NEVER hallucinate.`;
```

```typescript
type EnrichmentData = {
  companySummary: string | null;
  products: string[];
  targetMarket: string | null;
  valueProposition: string | null;
  painPoints: string[];           // Clé pour le framework PAS
  recentNews: string[];
  techStack: string[];
  teamSize: string | null;
  signals: string[];
};
```

### 4.4 Batch Pipeline (BullMQ + Jina rate limit)

```typescript
const enrichmentWorker = createWorker("enrichment:batch", async (job) => {
  const { leadId, workspaceId } = job.data;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.status === "SKIPPED") return;

  const url = lead.website || `${lead.company?.toLowerCase().replace(/\s+/g, "")}.com`;
  const markdown = await scrapeViaJina(url);
  if (!markdown) return; // Jina fail → lead stays SCORED

  const enrichment = await summarizeCompanyContext(markdown);
  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichmentData: enrichment, enrichedAt: new Date(), status: "ENRICHED" },
  });
}, {
  concurrency: 3,
  limiter: { max: 18, duration: 60_000 }, // 18/min (marge vs Jina 20/min)
});
```

---

## 5. Email Drafting Pipeline

### 5.1 Frameworks (copywriting structuré — pas improvisé)

| Step | Framework | Max words | Structure |
|------|-----------|-----------|-----------|
| 0 | **PAS** (Problem-Agitate-Solve) | 150 | Problème → douleur → solution |
| 1 | **Value-add** | 100 | Insight, ressource, case study |
| 2 | **Breakup** | 80 | Court, direct, dernière chance |

### 5.2 Prompt Construction

```typescript
function buildEmailPrompt(params: {
  lead: LeadWithEnrichment;
  step: number;
  companyDna: string;
  previousEmails?: DraftedEmail[];
  styleSamples?: string[];
}): string {
  const fw = getFramework(params.step);
  return `
## Qui tu es
${params.companyDna}

## Le prospect
- Prénom: ${params.lead.firstName}
- Poste: ${params.lead.jobTitle}
- Entreprise: ${params.lead.company}
${params.lead.enrichmentData?.companySummary ? `- Activité: ${params.lead.enrichmentData.companySummary}` : ""}
${params.lead.enrichmentData?.painPoints?.length ? `- Pain points: ${params.lead.enrichmentData.painPoints.join(", ")}` : ""}
${params.lead.enrichmentData?.signals?.length ? `- Signaux: ${params.lead.enrichmentData.signals.join(", ")}` : ""}
${params.lead.enrichmentData?.recentNews?.length ? `- Actus: ${params.lead.enrichmentData.recentNews.join(", ")}` : ""}

## Framework
${fw.instructions}

## Objectif
${fw.objective}

${params.previousEmails?.length ? `## Emails précédents (NE PAS répéter)\n${params.previousEmails.map((e, i) => `Email ${i + 1}: "${e.subject}"`).join("\n")}` : ""}
${params.styleSamples?.length ? `## Style guide\n${params.styleSamples.join("\n")}` : ""}

## Contraintes
- Max ${fw.maxWords} mots. 1 CTA. 1 élément spécifique minimum.
- Pas de flatterie creepy, pas de signature.
- Langue : français si prospect FR, sinon anglais.
- Commence par le prénom.

JSON uniquement : {"subject": "...", "body": "..."}`.trim();
}
```

### 5.3 Style Learner

```typescript
async function captureStyleCorrection(workspaceId: string, original: string, edit: string, type: string) {
  await prisma.agentFeedback.create({
    data: { workspaceId, type: "USER_EDIT", originalOutput: original, userEdit: edit, metadata: { contentType: type } },
  });
}

async function getStyleSamples(workspaceId: string, limit = 5): Promise<string[]> {
  const corrections = await prisma.agentFeedback.findMany({
    where: { workspaceId, type: "USER_EDIT" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return corrections.map(c => `Original: "${c.originalOutput}"\nCorrected: "${c.userEdit}"`);
}
```

---

## 6. CRM Connector (HubSpot)

### 6.1 Dedup Strategy

**Démo (100 leads) :** HubSpot Search API, batch de 50 emails.
**Prod (25K/mois) :** Export CRM complet → comparaison locale.

> **Rate limit HubSpot gratuit :** 100 calls/10s.

### 6.2 OAuth Flow

```
Connect → GET /api/integrations/hubspot/auth → 302 HubSpot OAuth
  → Approve → callback?code=ABC → exchange → encrypt → store → redirect
```

### 6.3 Token Refresh — auto-refresh si expire dans < 5 min (voir SPEC-BACKEND v1 pour le code complet).

---

## 7. BullMQ Workers

### 7.1 Factory + Graceful Shutdown

```typescript
const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export function createQueue(name: string) { return new Queue(name, { connection: redis }); }

export function createWorker(name: string, processor: any, opts?: any) {
  const worker = new Worker(name, processor, { connection: redis, ...opts });
  const shutdown = async () => { await worker.close(); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return worker;
}
```

### 7.2 Queues

| Queue | Concurrency | Rate limit | Notes |
|-------|-------------|------------|-------|
| `enrichment:batch` | 3 | 18/min (Jina) | Scrape + summarize leads qualifiés |
| `email:draft` | 5 | — | Mistral Large draft 3 emails/lead |

---

## 8. Patterns Obligatoires

### 8.1 Encryption — AES-256-GCM. Tous tokens chiffrés. Jamais en clair.
### 8.2 Config — Zod envSchema. Crash au boot si var manquante. Pas de ANTHROPIC_API_KEY en V1.
### 8.3 Errors — AppError hierarchy (Connector, Enrichment, EmailDraft, Auth, RateLimit).
### 8.4 AI Events — logAIEvent() avec provider "mistral", calculateCost() avec pricing Mistral.
### 8.5 Autonomy — Side-effect tools wrappés avec confirmation (render_inline_approval avant exécution).

> Voir les sections 8.x de la v1 complète pour le code. Les patterns sont identiques, seuls les providers/models changent.
