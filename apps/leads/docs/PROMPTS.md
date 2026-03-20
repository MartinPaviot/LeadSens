# LeadSens — Prompts de Dev (Claude Code)

> **Objectif :** Séquence ordonnée de prompts à exécuter dans Claude Code pour builder LeadSens.
> Chaque prompt est autonome, référence les specs (`SPEC-CHAT.md` + `SPEC-BACKEND.md`), et produit du code production-ready.
>
> **Stack :** Next.js 15 App Router, Prisma 6 + Supabase, BullMQ + Redis, Mistral AI (tout), Instantly API V2, Jina Reader, assistant-ui, shadcn/ui, Tailwind CSS 4, tRPC, Better Auth, Zod
>
> **Règle :** Monolithique — tout dans `src/`, `pnpm dev` pour tout lancer.

---

## Phase 0 — Setup Projet

### Prompt 0.1 — Init projet Next.js

```
Crée un projet Next.js 15 App Router appelé "leadsens".

Stack exacte :
- Next.js 15 (App Router, src/ directory)
- TypeScript strict
- Tailwind CSS 4
- pnpm
- ESLint + Prettier
- Path alias @ → src/

Dépendances :
- @mistralai/mistralai (LLM — Mistral pour tout en V1)
- @trpc/server @trpc/client @trpc/react-query @trpc/next
- @tanstack/react-query
- @assistant-ui/react @assistant-ui/react-markdown
- @prisma/client prisma
- bullmq ioredis
- zod
- better-auth
- sonner
- @phosphor-icons/react
- clsx tailwind-merge

PAS de @anthropic-ai/sdk en V1. Mistral pour tout. On ajoutera Claude plus tard si la qualité des emails ne suffit pas.
PAS de cheerio. On utilise Jina Reader (simple fetch, pas de package).

Structure initiale (dossiers vides) — voir CLAUDE.md pour l'arbre complet.

Crée .env.example avec :
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
REDIS_URL=redis://...
MISTRAL_API_KEY=...
ENCRYPTION_KEY=<64 hex chars>
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
JINA_RATE_LIMIT_PER_MIN=18

Crée src/lib/config.ts avec validation Zod (pattern SPEC-BACKEND.md section 8.2). Crash au boot si var requise manque.

Initialise Prisma avec provider postgresql.
```

### Prompt 0.2 — shadcn/ui + Design tokens

```
Configure shadcn/ui (thème "zinc" dark mode).

Composants shadcn : button, input, badge, card, dialog, dropdown-menu, scroll-area, separator, toast, tooltip, avatar

Crée src/lib/utils.ts avec cn() (clsx + tailwind-merge).

Design tokens CSS global (référence SPEC-CHAT.md section 18) :
- Animation typing-dot : bouncing dots (3 dots, 150ms stagger)
- Animation fade-in-up : translateY(8px) → 0, opacity 0 → 1, 0.3s ease-out
- Scrollbar fine (webkit)
- Message font: text-[13.5px], Composer: text-[14px]
- Content max-w: 720px, Message max-w: 85%
- Avatar header: size-7, Avatar message: size-8
- Border radius assistant: rounded-[16px_16px_16px_4px]
- Border radius user: rounded-[16px_16px_4px_16px]
```

---

## Phase 1 — Schema Prisma + Auth

### Prompt 1.1 — Schema Prisma complet

```
Crée le schema Prisma complet dans prisma/schema.prisma.

MODELS :

1. User — id (cuid), email (unique), name?, avatarUrl?, workspaceId → Workspace, sessions Session[]. @@map("user")

2. Session — id (cuid), userId → User, token (unique), expiresAt. @@map("session")

3. Workspace — id (cuid), name, slug (unique), companyUrl?, companyDna? (@db.Text). Relations → User[], Integration[], Conversation[], Lead[], Campaign[], AgentMemory[], AgentFeedback[]. @@map("workspace")

4. Integration — id (cuid), workspaceId → Workspace, type IntegrationType (INSTANTLY, HUBSPOT, SALESFORCE, GOOGLE_SHEETS), apiKey? (@db.Text, chiffré), accessToken? (@db.Text, chiffré), refreshToken? (@db.Text, chiffré), expiresAt?, accountEmail?, accountName?, status IntegrationStatus (ACTIVE, ERROR, EXPIRED, DISCONNECTED, default ACTIVE). @@unique([workspaceId, type]). @@map("integration")

5. Conversation — id (cuid), workspaceId → Workspace, title?, messages Message[], campaignId? (unique) → Campaign?. @@map("conversation")

6. Message — id (cuid), conversationId → Conversation (onDelete Cascade), role MessageRole (USER, ASSISTANT, SYSTEM, TOOL), content (@db.Text), toolName?, toolInput? (Json), toolOutput? (Json), componentName?, componentProps? (Json). @@index([conversationId, createdAt]). @@map("message")

7. Lead — id (cuid), workspaceId → Workspace, email, firstName?, lastName?, company?, jobTitle?, linkedinUrl?, phone?, website?, country?, companySize?, industry?, instantlyLeadId?, instantlyListId?, enrichmentData? (Json — type EnrichmentData avec painPoints, signals, etc.), enrichedAt?, icpScore? (Int), icpBreakdown? (Json), campaignId? → Campaign?, emails DraftedEmail[], crmContactId?, status LeadStatus (SOURCED, SCORED, ENRICHED, DRAFTED, PUSHED, SKIPPED, default SOURCED). @@unique([workspaceId, email]). @@index([campaignId, status]). @@map("lead")

8. Campaign — id (cuid), workspaceId → Workspace, name, status CampaignStatus (DRAFT, SOURCING, SCORING, ENRICHING, DRAFTING, READY, PUSHED, ACTIVE, default DRAFT), icpDescription (@db.Text), icpFilters (Json), tone? (@db.Text), stepsCount (Int default 3), instantlyCampaignId?, instantlyListId?, stats: leadsTotal, leadsScored, leadsEnriched, leadsDrafted, leadsPushed, leadsSkipped (tous Int default 0). @@map("campaign")

9. DraftedEmail — id (cuid), leadId → Lead (onDelete Cascade), campaignId → Campaign, step (Int), subject, body (@db.Text), model (String), tokensUsed? (Int), approved (Boolean default false), userEdit? (@db.Text). @@unique([leadId, step]). @@map("drafted_email")

10. AgentMemory — id (cuid), workspaceId → Workspace (onDelete Cascade), key, value (@db.Text), category MemoryCategory (GENERAL, COMPANY_CONTEXT, ICP_HISTORY, STYLE). @@unique([workspaceId, key]). @@map("agent_memory")

11. AgentFeedback — id (cuid), workspaceId, type FeedbackType (THUMBS_UP, THUMBS_DOWN, USER_EDIT), originalOutput (@db.Text), userEdit? (@db.Text), metadata? (Json). @@index([workspaceId, createdAt]). @@map("agent_feedback")

12. AIEvent — id (cuid), workspaceId, provider (String default "mistral"), model, action, tokensIn (Int), tokensOut (Int), cost (Float), latencyMs (Int), metadata? (Json). @@index([workspaceId, createdAt]). @@map("ai_event")

NOTE IMPORTANTE :
- Pas de model Agent. L'agent est implicite (1 par workspace).
- Pas de MailboxAccount. Les mailboxes sont gérées dans Instantly.
- Pas de CampaignEmail. On a DraftedEmail (juste les drafts, l'envoi est dans Instantly).
- Le Lead a les champs country, companySize, industry pour le scoring sur données brutes Instantly.
- Le CampaignStatus inclut SCORING (entre SOURCING et ENRICHING).

Fais prisma migrate dev.
```

### Prompt 1.2 — Auth (Better Auth)

```
Configure Better Auth avec :
- Email/password (dev)
- Google OAuth (prod)
- Session cookies

Crée :
1. src/lib/auth.ts — Config Better Auth + Prisma adapter
2. src/app/api/auth/[...all]/route.ts — Catch-all route
3. src/lib/auth-client.ts — useSession hook
4. src/app/(auth)/login/page.tsx — Login minimaliste
5. src/middleware.ts — Protège (dashboard)/, redirige vers /login

Auto-création du workspace au signup (1 workspace par user, nom = user name).
```

---

## Phase 2 — LLM Client (Mistral uniquement)

### Prompt 2.1 — Mistral Client unifié

```
Crée src/server/lib/llm/mistral-client.ts — Le client Mistral unifié pour LeadSens.

En V1, Mistral fait TOUT : chat, ICP parsing, scoring, enrichment, email drafting.

Le client utilise @mistralai/mistralai et expose :

1. chatStream(options) — AsyncGenerator<StreamEvent> pour le chat agent
   - Model : mistral-large-latest
   - Supporte le tool calling loop (max 5 steps)
   - Convertit les tools Zod en format Mistral function calling
   - Log chaque appel via logAIEvent

2. complete(options) — Appel simple sans streaming
   - Supporte mistral-large-latest et mistral-small-latest
   - Retourne { text: string, usage: Usage }

3. json<T>(options) — Appel avec JSON output forcé
   - Ajoute "JSON only, no markdown, no comments" au system prompt
   - Parse le résultat avec le schema Zod fourni
   - Retourne T ou throw ValidationError si parse fail

4. draftEmail(options) — Spécialisé pour l'email drafting
   - Model : mistral-large-latest
   - Temperature 0.8
   - Max 1024 tokens
   - Retourne { subject: string, body: string }
   - UPGRADE PATH : cette méthode peut être swappée vers @anthropic-ai/sdk (Claude Sonnet) plus tard en changeant juste l'implémentation, sans toucher aux callers

Types StreamEvent (SPEC-BACKEND.md section 2.1) :
- text-delta, tool-input-start, tool-input-available, tool-output-available, status, step-complete, finish, error

Crée aussi src/server/lib/llm/types.ts avec les types partagés.
Crée aussi src/lib/ai-events.ts avec logAIEvent + calculateCost (SPEC-BACKEND.md section 8.4). Provider "mistral" uniquement en V1.
```

---

## Phase 3 — Instantly Connector + Jina + Encryption

### Prompt 3.1 — Instantly API V2 Client

```
Crée src/server/lib/connectors/instantly.ts — Client API Instantly V2.

Auth : Bearer token (API key du client, stockée chiffrée en DB).
Base URL : https://api.instantly.ai/api/v2

Endpoints à implémenter :

SUPERSEARCH :
- countLeads(apiKey, searchFilters) → { count }
  POST /api/v2/supersearch-enrichment/count-leads-from-supersearch
- previewLeads(apiKey, searchFilters) → Lead[]
  POST /api/v2/supersearch-enrichment/preview-leads-from-supersearch
- sourceLeads(apiKey, { searchFilters, limit, searchName, listName, ... }) → { id, resourceId }
  POST /api/v2/supersearch-enrichment/enrich-leads-from-supersearch
- getEnrichmentStatus(apiKey, resourceId) → { inProgress, exists, enrichmentPayload }
  GET /api/v2/supersearch-enrichment/{resourceId}

LEADS :
- listLeads(apiKey, { listId?, campaignId?, limit, startingAfter? }) → { items, nextStartingAfter? }
  POST /api/v2/leads/list
- createLead(apiKey, { email, firstName, lastName, companyName, campaign, customVariables }) → Lead
  POST /api/v2/leads

CAMPAIGNS :
- createCampaign(apiKey, { name, sequences, dailyLimit, emailList, ... }) → Campaign
  POST /api/v2/campaigns
- activateCampaign(apiKey, campaignId) → void
  POST /api/v2/campaigns/{id}/activate
- listCampaigns(apiKey) → Campaign[]
  GET /api/v2/campaigns

ACCOUNTS :
- listAccounts(apiKey) → Account[]
  GET /api/v2/accounts

Pour chaque méthode : Zod input validation, retry 3x avec exponential backoff sur 429/5xx, types TS stricts.

search_filters Zod schema — voir CLAUDE.md architecture doc pour les types exacts (title, level, department, locations, employeeCount, revenue, industry, funding_type, etc.)

Crée aussi getInstantlyClient(workspaceId) qui récupère l'API key chiffrée, la déchiffre, et retourne un client prêt.
```

### Prompt 3.2 — Jina Reader wrapper

```
Crée src/server/lib/connectors/jina.ts — Wrapper Jina Reader.

Jina Reader transforme n'importe quelle URL en markdown clean via un simple fetch.

```typescript
const JINA_BASE = "https://r.jina.ai";

export async function scrapeViaJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: { Accept: "text/markdown" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const md = await res.text();
    return md.slice(0, 5000); // Limiter pour le context window
  } catch {
    return null;
  }
}
```

C'est tout. Pas de package, pas de config, pas de cheerio.

Rate limit : 20 req/min gratuit. Les workers BullMQ respectent cette limite (concurrency 3, limiter 18/min).

Si Jina fail (timeout, 429, erreur réseau) → on skip l'enrichissement pour ce lead. Le lead reste en status SCORED, on peut toujours drafter un email avec les données brutes Instantly.
```

### Prompt 3.3 — Encryption utility

```
Crée src/lib/encryption.ts — AES-256-GCM (SPEC-BACKEND.md section 8.1).

encrypt(plaintext) → "iv:authTag:ciphertext" en base64
decrypt(ciphertext) → plaintext

RÈGLE : TOUS les tokens (API keys Instantly, OAuth HubSpot) passent par encrypt() avant DB.
```

---

## Phase 4 — Tool System

### Prompt 4.1 — Tool registry + Instantly tools

```
Crée le système de tools.

1. src/server/lib/tools/types.ts — ToolDefinition, ToolContext (SPEC-BACKEND.md section 3.1)

2. src/server/lib/tools/index.ts — buildToolSet() (SPEC-BACKEND.md section 3.2)
   Merge les tools dynamiquement selon les intégrations connectées.

3. src/server/lib/tools/instantly-tools.ts :

- instantly_count_leads : Estime le nombre de leads pour un ICP
  Input: { search_filters }
  
- instantly_preview_leads : Aperçu de 5 leads
  Input: { search_filters }

- instantly_source_leads : Lance le sourcing SuperSearch
  Input: { search_filters, limit, search_name, list_name }
  isSideEffect: true (consomme les crédits du client)
  Action: source → poll status → fetch leads → store en DB

- instantly_create_campaign : Crée une campagne
  Input: { name, timezone, steps[], dailyLimit, emailAccounts[] }
  isSideEffect: true

- instantly_add_leads_to_campaign : Ajoute des leads avec les emails draftés en custom_variables
  Input: { campaignId, leadIds[] }
  isSideEffect: true

- instantly_activate_campaign : Active la campagne
  Input: { campaignId }
  isSideEffect: true

- instantly_list_accounts : Liste les email accounts
  Input: {}

Les tools side-effect sont wrappés avec le pattern autonomy (SPEC-BACKEND.md section 8.5) — confirmation avant exécution.
```

### Prompt 4.2 — Enrichment tools (Score → Jina → Summarize)

```
Crée les outils d'enrichissement.

ORDRE CRITIQUE : Score AVANT Scraping. Voir SPEC-BACKEND.md section 4.

1. src/server/lib/enrichment/icp-scorer.ts :
- scoreLead(lead, icpDescription) → { score, breakdown, reason }
- Utilise Mistral Small sur données BRUTES Instantly (pas besoin de scraping)
- Score 1-10, leads < 5 → SKIPPED

2. src/server/lib/enrichment/jina-scraper.ts :
- scrapeViaJina(url) → markdown | null
- Simple fetch vers r.jina.ai/{url}
- Timeout 15s, tronqué à 5000 chars
- Null si fail (pas bloquant)

3. src/server/lib/enrichment/summarizer.ts :
- summarizeCompanyContext(markdown) → EnrichmentData (JSON structuré)
- Mistral Small avec output : companySummary, products, targetMarket, valueProposition, painPoints, recentNews, techStack, teamSize, signals
- Le JSON est directement consommé par buildEmailPrompt()

4. src/server/lib/tools/enrichment-tools.ts :

- score_leads_batch : Score N leads contre l'ICP sur données brutes
  Input: { leadIds[], icpDescription }
  Action: score chaque lead → update icpScore, icpBreakdown, status (SCORED ou SKIPPED)
  Progress: "Scoring lead 42/500..."

- enrich_leads_batch : Scrape + summarize les leads qualifiés (score ≥ 5)
  Input: { leadIds[] }
  Action: pour chaque lead SCORED, Jina → Mistral Small → update enrichmentData
  Progress: "Enriching lead 42/300..."
  Respecte le rate limit Jina (18/min)

- enrich_single_lead : Enrichit 1 lead (synchrone, pour le chat)
  Input: { leadId }
```

### Prompt 4.3 — Email drafting tools

```
Crée les outils de rédaction d'emails.

1. src/server/lib/email/prompt-builder.ts :
- buildEmailPrompt() avec les 3 frameworks copywriting (SPEC-BACKEND.md section 5.2) :
  - Step 0 : PAS (Problem-Agitate-Solve)
  - Step 1 : Value-add (insight, ressource, case study)
  - Step 2 : Breakup (court, direct, dernière chance)
- Le prompt consomme directement l'EnrichmentData JSON (painPoints, signals, recentNews)
- Inclut les styleSamples du style learner

2. src/server/lib/email/drafting.ts :
- draftEmail(lead, step, companyDna, previousEmails?, styleSamples?) → { subject, body }
- Utilise mistralClient.draftEmail() (Mistral Large, temperature 0.8)
- UPGRADE PATH : changer cette seule fonction pour passer à Claude Sonnet

3. src/server/lib/email/style-learner.ts :
- captureStyleCorrection(workspaceId, original, edit, contentType)
- getStyleSamples(workspaceId, limit=5)
- Pattern SPEC-BACKEND.md section 5.3

4. src/server/lib/tools/email-tools.ts :

- draft_emails_batch : Rédige 3 emails par lead
  Input: { leadIds[], campaignId }
  Action: pour chaque lead × 3 steps → buildEmailPrompt → draftEmail → store DraftedEmail
  Concurrency 5

- draft_single_email : Preview 1 email dans le chat
  Input: { leadId, step }

- render_email_preview : Inline component pour afficher un email
  Input: { leadId, step, subject, body, leadName, leadCompany }

- render_lead_table : Inline component tableau de leads
  Input: { leads[], title? }

- render_campaign_summary : Inline component résumé campagne
  Input: { campaignName, totalLeads, scored, enriched, drafted, pushed, skipped }
```

### Prompt 4.4 — CRM dedup + Memory tools

```
Crée les outils CRM et mémoire.

1. src/server/lib/tools/crm-tools.ts — HubSpot dedup :
- crm_check_duplicates : { emails[] } → { duplicates[], newEmails[] }
  Batch de 50 via HubSpot Search API (SPEC-BACKEND.md section 6.1)

2. src/server/lib/connectors/hubspot.ts :
- searchContacts, createContact, updateContact
- OAuth helpers (SPEC-BACKEND.md section 6.2)

3. src/server/lib/tools/memory-tools.ts :
- save_memory, get_memories, delete_memory
- Stockés dans AgentMemory (par workspace, pas par conversation)
```

---

## Phase 5 — Chat API + Streaming

### Prompt 5.1 — SSE Chat Route

```
Crée src/app/api/agents/chat/route.ts — LE endpoint principal.

Route POST qui :
1. Auth → session → user → workspace
2. Validation Zod : conversationId, messages[{ role, content }], isGreeting?
3. Si isGreeting → fast path : juste un message d'accueil Mistral
4. Charge en parallèle : intégrations, memories, style corrections
5. Construit le system prompt dynamique (SPEC-BACKEND.md section 2.2)
6. buildToolSet() avec les tools conditionnels
7. Convertit tools Zod → format Mistral function calling
8. Mistral Large chatStream() avec max 5 steps, temperature 0.7
9. Streame les events SSE
10. Post-stream : sauvegarde messages en DB, log AI events

SYSTEM PROMPT LeadSens (à hardcoder) :

"""
Tu es LeadSens, un agent de prospection B2B intelligent.

PERSONNALITÉ :
- Direct et efficace, pas de blabla
- Tu montres ton travail en temps réel (status updates)
- Tu poses les bonnes questions quand c'est nécessaire
- Ton décontracté mais professionnel

WORKFLOW PRINCIPAL :
1. Comprendre l'ICP (description en langage naturel)
2. Parser en filtres Instantly SuperSearch
3. Estimer le nombre de leads, demander confirmation
4. Sourcer via SuperSearch (crédits du client)
5. Vérifier doublons CRM (si connecté)
6. Scorer les leads sur données brutes Instantly (skip < 5)
7. Enrichir les leads qualifiés via Jina Reader + Mistral
8. Demander le ton/angle pour les emails
9. Rédiger 3 emails par lead (PAS, Value-add, Breakup)
10. Montrer des previews, permettre les corrections
11. Créer la campagne Instantly et pousser les leads
12. Confirmer que tout est prêt

RÈGLES :
- Ne source JAMAIS sans confirmation (crédits du client)
- Montre TOUJOURS un aperçu avant de créer dans Instantly
- Score AVANT d'enrichir — on ne gaspille pas de crédits Jina sur des leads non qualifiés
- Les emails suivent les frameworks PAS / Value-add / Breakup — JAMAIS improvisés
- Sauvegarde en mémoire : companyDna, ICPs, préférences de style

{company_dna}
{memories}
{style_corrections}
{connected_integrations}
"""

Format SSE : data: {json}\n\n (SPEC-CHAT.md section 10)
Constante : export const maxDuration = 300;
```

---

## Phase 6 — Frontend Chat UI

### Prompt 6.1 — Chat Layout + Thread

```
Crée l'interface chat en suivant EXACTEMENT SPEC-CHAT.md.

1. src/app/(dashboard)/page.tsx → <AgentChat />

2. src/components/chat/agent-chat.tsx — Container principal
   State, refs, handleSend, handleCancel, auto-greeting, RAF batch text streaming, 500K char limit
   (SPEC-CHAT.md sections 10, 11, 16)

3. src/components/chat/agent-runtime-provider.tsx — Bridge assistant-ui
   useExternalStoreRuntime (SPEC-CHAT.md section 9)

4. src/components/chat/thread.tsx — ThreadPrimitive, bg-elevay-mesh, max-w-[720px]

5. src/components/chat/assistant-message.tsx — Avatar gradient indigo-violet, rounded-[16px_16px_16px_4px], typing indicator + activity label

6. src/components/chat/user-message.tsx — rounded-[16px_16px_4px_16px], bg-primary/90

7. src/components/chat/composer.tsx — Textarea auto-resize, Enter=send, Shift+Enter=newline

8. src/components/chat/greeting-loader.tsx — Avatar large + typing dots

9. src/components/chat/scroll-to-bottom.tsx — Pill flottant ResizeObserver
```

### Prompt 6.2 — Inline components

```
Crée les 4 inline components LeadSens (SPEC-CHAT.md section 12 pattern).

1. src/components/chat/inline/lead-table-card.tsx :
   Tableau leads (Name, Email, Company, Title, ICP Score), badge coloré, max 10 rows

2. src/components/chat/inline/email-preview-card.tsx :
   Email draft avec tabs step 0/1/2, boutons Edit (textarea inline) + Approve
   Edit → onResponse avec le texte → captureStyleCorrection()
   Approve → onResponse({ approved: true })

3. src/components/chat/inline/campaign-summary-card.tsx :
   Stats : sourced → scored → enriched → drafted → pushed (progress bars)
   "Open in Instantly" link

4. src/components/chat/inline/progress-bar.tsx :
   "Scoring leads... 234/500" avec barre animée

5. src/lib/inline-component-registry.ts : tool name → lazy component
6. src/components/chat/tool-ui-registry.tsx : monte les tool UIs
```

---

## Phase 7 — ICP Parsing

### Prompt 7.1 — ICP Parser (Mistral Large → Instantly filters)

```
Crée src/server/lib/tools/icp-parser.ts

Fonction parseICP(description: string): Promise<InstantlySearchFilters>

System prompt qui transforme du langage naturel (FR ou EN) en JSON search_filters Instantly.
Inclut tous les filtres disponibles : title, level, department, locations, employeeCount, revenue, industry, funding_type, news, keyword_filter, skip_owned_leads, show_one_lead_per_company.

Ajoute TOUJOURS skip_owned_leads: true.
Pour les job titles, ajoute les variations courantes.

Utilise mistralClient.json<InstantlySearchFilters>().
```

---

## Phase 8 — BullMQ Workers

### Prompt 8.1 — Queue setup + Workers

```
Configure BullMQ (SPEC-BACKEND.md section 7).

1. src/queue/factory.ts — createQueue + createWorker avec graceful shutdown

2. src/queue/enrichment-worker.ts :
   Queue "enrichment:batch", concurrency 3, limiter 18/min (Jina)
   Pour chaque lead SCORED :
     a. scrapeViaJina(url) → markdown
     b. summarizeCompanyContext(markdown) → EnrichmentData JSON
     c. Update lead (enrichmentData, enrichedAt, status ENRICHED)
   Si Jina fail → skip (lead reste SCORED, pas bloquant)

3. src/queue/email-draft-worker.ts :
   Queue "email:draft", concurrency 5
   Pour chaque lead × 3 steps :
     a. buildEmailPrompt(lead, step, companyDna, previousEmails, styleSamples)
     b. mistralClient.draftEmail() → { subject, body }
     c. Create DraftedEmail en DB
     d. logAIEvent

Le chat route déclenche les workers via tool execute(), puis poll le status pour streamer la progression.
```

---

## Phase 9 — Integrations Page

### Prompt 9.1 — Settings + Connect Instantly

```
Crée la page settings/integrations :

- Instantly : input API key V2 → valide via GET /api/v2/accounts → encrypt → store
- HubSpot : bouton OAuth → flow complet (SPEC-BACKEND.md section 6.2)
- Salesforce : grisé "Coming soon"
- CSV Import : "Always available"

Routes API pour Instantly (POST/DELETE) et HubSpot OAuth (auth + callback).
tRPC router integration (list, disconnect).
```

---

## Phase 10 — tRPC Routers

### Prompt 10.1 — tRPC setup + routers

```
Configure tRPC :
1. src/server/trpc/context.ts — Auth context (SPEC-BACKEND.md section 1.1)
2. src/server/trpc/router.ts — Root router
3. Routers : campaign (list, get, getLeads), conversation (create, list, getMessages), feedback (submitEdit, submitThumbs), integration (list, disconnect)
4. src/app/api/trpc/[trpc]/route.ts
5. src/lib/trpc-client.ts
```

---

## Phase 11 — Polish + Gaps

### Prompt 11.1 — Error handling

```
Implémente la gestion d'erreurs (SPEC-BACKEND.md section 8.3).

- Tool fail → agent communique l'erreur gracefully
- Mistral fail → SSE error event
- Instantly 401 → "API key invalid, reconnect in Settings"
- Instantly 429 → "Rate limit, retrying..."
- Jina fail → skip enrichment pour ce lead (non bloquant)
- Workers : retry 3x exponential backoff, puis SKIPPED

Logging structuré : [LeadSens] prefix, timestamp, contexte.
```

### Prompt 11.2 — Onboarding flow

```
L'agent gère l'onboarding via le system prompt (pas de code hardcodé) :

1. Greeting : "Je suis LeadSens. J'ai besoin de 3 choses : Instantly connecté, URL de ton site, ta cible."
2. URL du site → scrape via Jina → Mistral summarize → store companyDna + memory
3. ICP sans Instantly → parse et store en mémoire, prévient que Instantly est requis
4. Tout prêt → enchaîne sur le sourcing
```

### Prompt 11.3 — Message adapter (assistant-ui bridge)

```
Crée src/lib/assistant-ui-adapter.ts

Convertit ChatMessageExtended → ThreadMessageLike (SPEC-CHAT.md section 9) :
- user → { role: "user", content: [text] }
- assistant text → { role: "assistant", content: [text], status: complete }
- component → { role: "assistant", content: [text, tool-call], status: requires-action }
- tool result → { role: "assistant", content: [text, tool-call], status: running/complete }

Règles : chaque message assistant a au moins un text part (même vide).
Tool names : PascalCase → render_snake_case.

Hook useLeadSensRuntime() wrapping useExternalStoreRuntime.
```

### Prompt 11.4 — Campaigns page

```
src/app/(dashboard)/campaigns/page.tsx

Liste des campagnes (tRPC campaign.list), cards avec :
- Nom, status badge, stats (sourced → scored → enriched → drafted → pushed)
- "Continue in chat" link
- Empty state → redirect to chat
```

### Prompt 11.5 — Autonomy wrapper

```
src/server/lib/tools/autonomy.ts

Side-effect tools wrappés avec confirmation (SPEC-BACKEND.md section 8.5) :
- instantly_source_leads → "About to source {limit} leads using your credits. Proceed?"
- instantly_create_campaign → "About to create campaign '{name}'. Proceed?"
- instantly_add_leads_to_campaign → "About to add {count} leads. Proceed?"
- instantly_activate_campaign → "About to activate. Emails will start sending. Proceed?"

Inline approval component (render_inline_approval) → Proceed / Cancel.
En V1, tous les side-effect tools sont en mode "confirm".
```

---

## Notes

### Ordre d'exécution
Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

### Budget V1
- 15$ crédits Mistral ≈ 75M tokens Small (scoring, summarize) + ~2.5M tokens Large (chat, emails)
- Jina Reader : gratuit (20 req/min)
- Instantly : crédits du client

### Upgrade path Claude
Si la qualité des emails Mistral ne suffit pas :
1. `pnpm add @anthropic-ai/sdk`
2. Ajouter ANTHROPIC_API_KEY à .env
3. Changer l'implémentation de `draftEmail()` dans `email/drafting.ts`
4. Ajouter le pricing Claude dans `calculateCost()`
Aucun autre fichier ne change.
