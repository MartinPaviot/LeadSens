# CLAUDE.md — LeadSens

> Ce fichier est lu en premier par Claude Code. Il définit le projet, les conventions, et pointe vers les specs de référence.

## Projet

**LeadSens** — Agent IA conversationnel qui pilote le compte Instantly du client pour automatiser la prospection B2B : sourcing → scoring → enrichissement → rédaction → envoi.

Le client connecte SON compte Instantly. LeadSens utilise ses crédits SuperSearch pour sourcer, score les leads sur les données brutes Instantly, enrichit uniquement les leads qualifiés via Jina Reader, rédige des emails personnalisés via Mistral, et pousse le tout dans une campagne Instantly prête à activer.

## Stack

| Composant | Choix | Package |
|-----------|-------|---------|
| Runtime | Node.js 22 LTS | — |
| Framework | Next.js 15 App Router | `next` |
| Language | TypeScript strict | `typescript` |
| CSS | Tailwind CSS 4 | `tailwindcss` |
| UI | shadcn/ui + Radix | `@radix-ui/*` |
| Chat UI | assistant-ui | `@assistant-ui/react` `@assistant-ui/react-markdown` |
| Icons | Phosphor | `@phosphor-icons/react` |
| DB | Prisma 6 + PostgreSQL (Supabase) | `prisma` `@prisma/client` |
| Queue | BullMQ + Redis | `bullmq` `ioredis` |
| Auth | Better Auth | `better-auth` |
| API layer | tRPC + TanStack Query | `@trpc/*` `@tanstack/react-query` |
| **LLM (tout)** | **Mistral** | `@mistralai/mistralai` |
| Validation | Zod | `zod` |
| **Scraping** | **Jina Reader** | `fetch("https://r.jina.ai/{url}")` — pas de package |
| Toasts | sonner | `sonner` |
| Package mgr | pnpm | — |

### LLM Strategy — Mistral pour tout (V1)

| Tâche | Modèle | Raison |
|-------|--------|--------|
| Chat agent (conversation, orchestration) | Mistral Large | Personnalité, tool calling |
| ICP parsing (NL → JSON filters) | Mistral Large | JSON structuré fiable |
| ICP scoring (données brutes Instantly) | Mistral Small | Classification rapide, haut volume |
| Enrichment summarization (markdown Jina → JSON) | Mistral Small | Extraction structurée |
| **Email drafting (first touch + follow-ups)** | **Mistral Large** | **Budget 15$ suffit pour la démo + premiers mois** |

> **Upgrade path :** Si la qualité des emails ne suffit pas en production, switcher le drafting sur Claude Sonnet (`@anthropic-ai/sdk`). L'abstraction LLM est prête pour ça — il suffit de changer le client dans `email/drafting.ts`.

### Scraping — Jina Reader (pas cheerio)

```typescript
// UN SEUL appel, zéro parsing
const response = await fetch(`https://r.jina.ai/${url}`, {
  headers: { Accept: "text/markdown" }
});
const markdown = await response.text();
```

- Retourne du markdown clean, prêt pour le LLM
- Gratuit jusqu'à 20 req/min (suffisant pour la démo)
- Pas de cheerio, pas de gestion d'edge cases HTML
- Fallback : si Jina fail (timeout, 429), on skip l'enrichissement pour ce lead

**Monolithique** — tout dans `src/`, pas de séparation backend/frontend, `pnpm dev` pour tout lancer.

## Flow principal

```
User décrit son ICP en langage naturel (FR ou EN)
  │
  ▼
Mistral Large parse → JSON search_filters Instantly
  │
  ▼
Instantly SuperSearch count → "~2,400 leads trouvés, combien tu veux ?"
  │
  ▼
Instantly SuperSearch source → leads dans une list Instantly
  │
  ▼
Fetch leads via API → stockage local (model Lead)
  │
  ▼
HubSpot dedup (si connecté) → skip les contacts existants
  │
  ▼
ICP scoring (Mistral Small) sur données BRUTES Instantly → skip si score < 5
  │                                                         (économise ~40% des appels Jina)
  ▼
Jina Reader (r.jina.ai/{url}) sur leads qualifiés UNIQUEMENT → markdown clean
  │
  ▼
Mistral Small summarize le markdown → JSON structuré (pain points, actus, stack)
  │
  ▼
Mistral Large draft 3 emails par lead (first touch + 2 follow-ups)
  │                                    avec frameworks copywriting (PAS, value-add, breakup)
  ▼
Preview dans le chat (inline components) → corrections user → style learner
  │
  ▼
Instantly create campaign + add leads avec custom_variables → prêt à activer
```

**Point clé : le scoring se fait AVANT le scraping.** On ne scrape que les leads qui valent le coup (score ≥ 5). Sur 500 leads sourcés, si 200 sont éliminés au scoring, ça économise 200 appels Jina + 200 appels Mistral Small.

## Email Frameworks (copywriting structuré)

Les emails ne sont PAS improvisés. Chaque step a un framework défini :

| Step | Framework | Structure |
|------|-----------|-----------|
| **First touch** (step 0) | **PAS** (Problem-Agitate-Solve) | 1. Identifier un problème spécifique au prospect, 2. Amplifier la douleur, 3. Présenter la solution |
| **Follow-up 1** (step 1) | **Value-add** | Apporter un insight, une ressource, ou un case study pertinent. Pas de relance "just checking in" |
| **Follow-up 2** (step 2) | **Breakup** | Court, direct. "Dernière tentative, pas de souci si ce n'est pas le bon moment" |

Ces frameworks sont hardcodés dans le system prompt email, pas laissés au choix du modèle.

## Conventions obligatoires

1. **Encryption** — Tous les tokens/API keys chiffrés en DB (AES-256-GCM). Pattern : `docs/SPEC-BACKEND.md` section 8.1
2. **Validation** — Zod sur tous les inputs : routes API, tools, env vars, LLM JSON outputs
3. **Streaming** — SSE via `fetch()` + `ReadableStream` pour le chat. RAF batch update. Pattern : `docs/SPEC-CHAT.md` section 10
4. **Tool loop** — Max 5 steps (rounds de tool calling) par message user
5. **Workers** — Graceful shutdown (SIGTERM/SIGINT) sur les workers BullMQ. Pattern : `docs/SPEC-BACKEND.md` section 7.1
6. **Side effects** — Les tools qui consomment des crédits Instantly sont wrappés avec confirmation. Pattern : `docs/SPEC-BACKEND.md` section 8.5
7. **Error handling** — Hiérarchie d'erreurs typées. Pattern : `docs/SPEC-BACKEND.md` section 8.3
8. **AI logging** — Chaque appel LLM est loggé. Pattern : `docs/SPEC-BACKEND.md` section 8.4
9. **Jina rate limit** — Max 20 req/min. Les workers d'enrichissement respectent cette limite via un delay entre les jobs.

## Ce que LeadSens n'est PAS (vs Elevay)

| Concept Elevay | Status LeadSens |
|---------------|-----------------|
| Model `Agent` | ❌ 1 agent implicite par workspace |
| Composio | ❌ API directes |
| Worker campaign:send | ❌ Instantly gère l'envoi |
| Worker campaign:check-replies | ❌ Hors scope V1 |
| MailboxAccount | ❌ Mailboxes dans Instantly |
| CampaignEmail (tracking Gmail) | ❌ Remplacé par DraftedEmail |
| Flow mode | ❌ Chat only |
| Context Panel sidebar | ❌ Pas en V1 |
| Agent templates | ❌ 1 seul agent |
| cheerio scraping | ❌ Jina Reader |
| Claude pour les emails | ❌ Mistral pour tout en V1 |

## Fichiers de référence

```
docs/
├── SPEC-CHAT.md      ← Spec UI chat (ex Chat.md d'Elevay)
├── SPEC-BACKEND.md   ← Patterns backend nettoyés pour LeadSens
└── PROMPTS.md        ← Séquence de prompts de dev (Phase 0 → 11)
```

### `docs/SPEC-CHAT.md`
**Quand le lire :** pour tout ce qui touche au frontend chat.
**Sections à utiliser :** 1-7, 9, 10, 12, 13, 14, 18
**Sections à ignorer :** 8 (Context Panel), 11 (Flow mode), 15 (Agent templates)

### `docs/SPEC-BACKEND.md`
**Quand le lire :** pour les patterns d'implémentation backend.
**Sections à utiliser :** 1-8 (tout)
**Rien à ignorer** — ce fichier est déjà nettoyé pour LeadSens.

### `docs/PROMPTS.md`
**C'est le plan de build.** Phase 0 → 11, exécuter dans l'ordre.

## Structure du projet

```
leadsens/
├── CLAUDE.md
├── docs/
│   ├── SPEC-CHAT.md
│   ├── SPEC-BACKEND.md
│   └── PROMPTS.md
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/chat/route.ts
│   │   │   ├── integrations/instantly/route.ts
│   │   │   ├── integrations/hubspot/{auth,callback}/route.ts
│   │   │   └── trpc/[trpc]/route.ts
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx                         # Chat = page principale
│   │   │   ├── campaigns/page.tsx
│   │   │   └── settings/integrations/page.tsx
│   │   ├── (auth)/login/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/
│   │   │   ├── agent-chat.tsx
│   │   │   ├── agent-runtime-provider.tsx
│   │   │   ├── thread.tsx
│   │   │   ├── assistant-message.tsx
│   │   │   ├── user-message.tsx
│   │   │   ├── composer.tsx
│   │   │   ├── greeting-loader.tsx
│   │   │   ├── scroll-to-bottom.tsx
│   │   │   ├── tool-ui-registry.tsx
│   │   │   └── inline/
│   │   │       ├── lead-table-card.tsx
│   │   │       ├── email-preview-card.tsx
│   │   │       ├── campaign-summary-card.tsx
│   │   │       └── progress-bar.tsx
│   │   └── ui/
│   ├── server/
│   │   ├── trpc/
│   │   │   ├── router.ts
│   │   │   ├── context.ts
│   │   │   └── routers/
│   │   └── lib/
│   │       ├── llm/
│   │       │   ├── mistral-client.ts            # UNIQUE client LLM (chat + classify + emails)
│   │       │   └── types.ts
│   │       ├── tools/
│   │       │   ├── index.ts
│   │       │   ├── types.ts
│   │       │   ├── instantly-tools.ts
│   │       │   ├── enrichment-tools.ts
│   │       │   ├── email-tools.ts
│   │       │   ├── crm-tools.ts
│   │       │   ├── memory-tools.ts
│   │       │   └── icp-parser.ts
│   │       ├── connectors/
│   │       │   ├── instantly.ts
│   │       │   ├── hubspot.ts
│   │       │   └── jina.ts                      # Jina Reader wrapper
│   │       ├── enrichment/
│   │       │   ├── jina-scraper.ts              # fetch r.jina.ai → markdown
│   │       │   ├── summarizer.ts                # Mistral Small → JSON structuré
│   │       │   └── icp-scorer.ts                # Mistral Small scoring
│   │       └── email/
│   │           ├── prompt-builder.ts
│   │           ├── style-learner.ts
│   │           └── drafting.ts                  # Mistral Large (upgrade path → Claude)
│   ├── lib/
│   │   ├── encryption.ts
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   ├── ai-events.ts
│   │   ├── utils.ts
│   │   ├── auth.ts
│   │   ├── auth-client.ts
│   │   ├── trpc-client.ts
│   │   └── inline-component-registry.ts
│   └── queue/
│       ├── factory.ts
│       ├── enrichment-worker.ts
│       └── email-draft-worker.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── package.json
└── tsconfig.json
```
