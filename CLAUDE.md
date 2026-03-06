# CLAUDE.md — LeadSens

> Ce fichier est lu en premier par Claude Code. Il définit le projet, les conventions, et pointe vers les specs de référence.

## Projet

**LeadSens** — Agent IA conversationnel BYOT (Bring Your Own Tools) qui orchestre les outils de l'utilisateur pour automatiser la prospection B2B : sourcing → scoring → enrichissement → rédaction → envoi.

LeadSens n'est pas un outil. C'est le **chef d'orchestre** des outils du user. Chaque utilisateur connecte ses propres comptes (Instantly, Smartlead, Apollo, ZeroBounce…), choisit son niveau d'autonomie (Full auto / Supervisé / Manuel), et LeadSens orchestre le pipeline complet.

La valeur est dans les **décisions entre les appels API** : scoring pré-enrichissement (~40% d'économie), Company DNA, frameworks copywriting hardcodés, clustering par segments, style learner, curseur d'autonomie.

> Voir `docs/STRATEGY.md` pour la vision complète, l'audit, et la roadmap.

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
| **Scraping web** | **Jina Reader** | `fetch("https://r.jina.ai/{url}")` — pas de package |
| **Scraping LinkedIn** | **Apify** (actor `2SyF0bVxmgGr8IVCZ`) | `apify-client` |
| **Web automation** | **TinyFish** | `fetch("https://agent.tinyfish.ai/...")` — recherches web/marketing |
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

### Scraping — 3 outils complémentaires

| Outil | Usage | Coût |
|-------|-------|------|
| **Jina Reader** | Scraping web (company pages : homepage, about, blog, careers, press) | Gratuit 20 req/min |
| **Apify** | Scraping LinkedIn (profil : headline, about, career history, posts) | ~$0.01/profil |
| **TinyFish** | Web automation pour recherches marketing, données contextuelles | Variable |

```typescript
// Jina — company website → markdown
const markdown = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/markdown" } }).then(r => r.text());

// Apify — LinkedIn profile → structured JSON (headline, career, posts)
const client = new ApifyClient({ token });
const run = await client.actor("2SyF0bVxmgGr8IVCZ").call({ profileUrls: [linkedinUrl] });

// TinyFish — web automation (marketing research, etc.)
await fetch("https://agent.tinyfish.ai/v1/automation/run-sse", { method: "POST", ... });
```

- **Jina** : multi-page scraping (3-5 pages/entreprise), cache par domaine, fallback si fail
- **Apify** : données LinkedIn directement structurées, pas de LLM summarization nécessaire
- **TinyFish** : browser automation pour les cas plus complexes (pas encore en production)

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
Jina Reader multi-page (homepage + about + blog + careers + press) → markdown clean
  │                                                                   cache par domaine
  ▼
Apify LinkedIn scrape (headline, career, posts) → JSON structuré direct
  │
  ▼
Mistral Small summarize le markdown web → JSON structuré (pain points, actus, stack, signals)
  │
  ▼
Mistral Large draft 5-6 emails par lead (séquence complète)
  │                                    avec frameworks copywriting hardcodés par step
  ▼
Preview dans le chat (inline components) → corrections user → style learner
  │
  ▼
Instantly create campaign + add leads avec custom_variables → prêt à activer
```

**Point clé : le scoring se fait AVANT le scraping.** On ne scrape que les leads qui valent le coup (score ≥ 5). Sur 500 leads sourcés, si 200 sont éliminés au scoring, ça économise 200 appels Jina + 200 appels Apify + 200 appels Mistral Small.

## Email Frameworks (copywriting structuré)

Les emails ne sont PAS improvisés. Chaque step a un framework défini et hardcodé :

| Step | Framework | Delay | Mots | Structure |
|------|-----------|-------|------|-----------|
| **0** | **PAS** (Problem-Agitate-Solve) | J+0 | 80 | Pain point → agitation → solution du sender. Trigger event en opener si dispo. |
| **1** | **Value-add** (insight/ressource) | J+2 | 60 | Apporter un insight, une ressource, ou un case study pertinent. Pas de "just checking in". |
| **2** | **Social proof** (case study) | J+5 | 60 | Résultat concret d'un client similaire. Chiffres si possible. |
| **3** | **New angle** (different pain point) | J+9 | 70 | Aborder un pain point différent du step 0. Nouvelle perspective. |
| **4** | **Micro-value** (stat, tip, question) | J+14 | 50 | Un seul insight actionable. Question ouverte. |
| **5** | **Breakup** (dernier message) | J+21 | 40 | Court, direct. "Dernière tentative, pas de souci si ce n'est pas le bon moment." |

**Règles critiques :**
- Frameworks hardcodés dans le system prompt, pas laissés au choix du modèle
- **Connection bridge** : chaque email connecte LE pain point le plus pertinent à LA solution spécifique du sender
- **Trigger en opener** : si un trigger existe (funding, hiring, nouveau poste, lancement), il DOIT être l'opener
- **Follow-ups cohérents** : chaque step reçoit le body complet des steps précédents pour construire une narration
- **A/B testing** : 2-3 variantes de subject line par step via `variants[]` Instantly
- **Quality gate** : score LLM post-génération, régénération si < 6/10

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
10. **Apify** — LinkedIn scraping via `apify-client`. Env var : `APIFY_API_TOKEN`. Best-effort (null si fail).
11. **TinyFish** — Web automation. Env var : `TINYFISH_API_KEY`. Réservé aux recherches marketing (pas LinkedIn).

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
| cheerio scraping | ❌ Jina Reader + Apify + TinyFish |
| Claude pour les emails | ❌ Mistral pour tout en V1 (upgrade path → Claude Sonnet) |

## Fichiers de référence

```
docs/
├── STRATEGY.md       ← Vision produit, audit, roadmap, benchmarks (LIRE EN PREMIER)
├── SPEC-CHAT.md      ← Spec UI chat (ex Chat.md d'Elevay)
├── SPEC-BACKEND.md   ← Patterns backend nettoyés pour LeadSens
├── INSTANTLY-API.md   ← Référence API Instantly (endpoints, gotchas)
└── PROMPTS.md        ← Séquence de prompts de dev (Phase 0 → 11)
```

### `docs/STRATEGY.md`
**Quand le lire :** pour comprendre la vision produit, le positionnement BYOT, l'audit qualité, et la roadmap d'amélioration.
**Sections clés :** 2 (BYOT), 3 (Curseur autonomie), 5 (Briques intelligence), 6 (Audit), 7 (Plan amélioration), 12 (Roadmap)

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
│   ├── STRATEGY.md
│   ├── SPEC-CHAT.md
│   ├── SPEC-BACKEND.md
│   ├── INSTANTLY-API.md
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
│   │       │   ├── jina.ts                      # Jina Reader wrapper (company websites)
│   │       │   ├── apify.ts                     # Apify LinkedIn profile scraper
│   │       │   └── tinyfish.ts                  # TinyFish web automation (marketing research)
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

## 9. PROMPT POUR PLAN MODE

> **Instructions à suivre quand Claude Code entre en Plan Mode.**

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

### 9.1 Préférences d'ingénierie

Utilise ces préférences pour guider tes recommandations :

- **DRY is important** — flag repetition aggressively.
- **Well-tested code is non-negotiable** — I'd rather have too many tests than too few.
- **"Engineered enough"** — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
- **Handle more edge cases, not fewer** — thoughtfulness > speed.
- **Bias toward explicit over clever.**

### 9.2 Les 4 sections de review

**1. Architecture review**
Evaluate:
- Overall system design and component boundaries.
- Dependency graph and coupling concerns.
- Data flow patterns and potential bottlenecks.
- Scaling characteristics and single points of failure.
- Security architecture (auth, data access, API boundaries).

**2. Code quality review**
Evaluate:
- Code organization and module structure.
- DRY violations — be aggressive here.
- Error handling patterns and missing edge cases (call these out explicitly).
- Technical debt hotspots.
- Areas that are over-engineered or under-engineered relative to my preferences.

**3. Test review**
Evaluate:
- Test coverage gaps (unit, integration, e2e).
- Test quality and assertion strength.
- Missing edge case coverage — be thorough.
- Untested failure modes and error paths.

**4. Performance review**
Evaluate:
- N+1 queries and database access patterns.
- Memory-usage concerns.
- Caching opportunities.
- Slow or high-complexity code paths.

### 9.3 Pour chaque issue trouvée

For every specific issue (bug, smell, design concern, or risk):
- Describe the problem concretely, with file and line references.
- Present 2–3 options, including "do nothing" where that's reasonable.
- For each option, specify: implementation effort, risk, impact on other code, and maintenance burden.
- Give me your recommended option and why, mapped to my preferences above.
- Then explicitly ask whether I agree or want to choose a different direction before proceeding.

### 9.4 Workflow et interaction

- Do not assume my priorities on timeline or scale.
- After each section, pause and ask for my feedback before moving on.

**BEFORE YOU START:** Ask if I want one of two options:
1. **BIG CHANGE:** Work through this interactively, one section at a time (Architecture → Code Quality → Tests → Performance) with at most 4 top issues in each section.
2. **SMALL CHANGE:** Work through interactively ONE question per review section.

**FOR EACH STAGE OF REVIEW:** Output the exploration and pros and cons of each stage's questions AND your opinionated recommendation and why, and then use `AskUserQuestion`. Also NUMBER issues and then give LETTERS for options, and when using `AskUserQuestion` make sure each option clearly labels the issue NUMBER and option LETTER so the user doesn't get confused. Make the recommended option always the 1st option.

### 9.5 Demand Elegance

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it.
