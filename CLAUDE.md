# CLAUDE.md — LeadSens

> Ce fichier est lu en premier par Claude Code. Il est la SEULE source de vérité sur le code.
> Pour la vision produit et la roadmap → `docs/STRATEGY.md` (read-only, c'est le product owner).
> En cas de conflit entre ce fichier et STRATEGY.md → STRATEGY.md gagne toujours.

---

## 1. Projet

**LeadSens** — Agent IA conversationnel BYOT (Bring Your Own Tools) qui orchestre les outils de l'utilisateur pour automatiser la prospection B2B : ICP → Sourcing → Scoring → Enrichissement → Rédaction → Envoi → Monitoring → Reply Management → Meeting Booked.

LeadSens n'est pas un outil. C'est le **chef d'orchestre** des outils du user. Chaque utilisateur connecte ses propres comptes (Instantly, Smartlead, Apollo, ZeroBounce…), choisit son niveau d'autonomie (Full auto / Supervisé / Manuel), et LeadSens orchestre le pipeline complet.

La valeur est dans les **décisions entre les appels API** : scoring pré-enrichissement (~40% d'économie), Company DNA, frameworks copywriting hardcodés, clustering par segments, style learner, curseur d'autonomie.

### Score actuel : 6.5/10 (audit v2 2026-03-09 + research cross-ref, était 6.2 → 4.2). Objectif : 8/10. Reply rate cible : 18%.

Voir `docs/STRATEGY.md` §6 pour l'audit détaillé, §7 pour le plan d'amélioration, §9 pour les benchmarks.

---

## 2. Stack

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
| LLM | Mistral (Large + Small) | `@mistralai/mistralai` |
| Validation | Zod | `zod` |
| Scraping web | Jina Reader | `fetch("https://r.jina.ai/{url}")` |
| Scraping LinkedIn | Apify (actor `2SyF0bVxmgGr8IVCZ`) | `apify-client` |
| Web automation | TinyFish | `fetch("https://agent.tinyfish.ai/...")` |
| Toasts | sonner | `sonner` |
| Package mgr | pnpm | — |

### LLM Strategy — Mistral pour tout (V1, à challenger)

| Tâche | Modèle | Raison |
|-------|--------|--------|
| Chat agent (conversation, orchestration) | Mistral Large | Personnalité, tool calling |
| ICP parsing (NL → JSON filters) | Mistral Large | JSON structuré fiable |
| ICP scoring | Mistral Small | Classification rapide, haut volume |
| Enrichment summarization | Mistral Small | Extraction structurée |
| Email drafting | Mistral Large | Budget V1 suffisant |
| Quality gate (à implémenter) | Mistral Small | Score email post-génération |

> **Upgrade path :** Si le reply rate ne dépasse pas 14% après les améliorations Tier 1, switcher le drafting sur Claude Sonnet. L'abstraction est prête — changer le client dans `email/drafting.ts`.

### Scraping — 3 outils complémentaires

| Outil | Usage | Coût |
|-------|-------|------|
| Jina Reader | Scraping web (company pages) | Gratuit 20 req/min |
| Apify | Scraping LinkedIn (profil) | ~$0.01/profil |
| TinyFish | Web automation (recherches marketing) | Variable |

**Monolithique** — tout dans `src/`, pas de séparation backend/frontend, `pnpm dev` pour tout lancer.

---

## 3. État actuel vs état cible

> ⚠️ SECTION CRITIQUE — Claude Code doit TOUJOURS distinguer ce qui EXISTE de ce qui est À CONSTRUIRE.
> Ne jamais présumer qu'une feature existe. Vérifier dans le code source.

### 3.1 Pipeline — ce qui est implémenté

```
IMPLÉMENTÉ (pre-launch) :
  User décrit ICP → Mistral Large parse → Instantly SuperSearch count → source → fetch leads
  → ICP scoring (Mistral Small, fit pre-filter) + feedback loop si >70% skipped
  → Post-enrichment signal boost: fit 40% + intent 35% + timing 25% (deterministic, 0 LLM)
  → Jina scrape 5 pages (homepage+about+blog+careers+press) + cache in-memory par domaine
  → Apify LinkedIn (headline, career, posts) → Mistral Small summarize (18+ champs)
  → Mistral Large draft 6 emails (PAS/Value-add/Social Proof/New Angle/Micro-value/Breakup)
    avec connection bridge, trigger opener, toutes données enrichies, follow-ups cohérents
  → Quality gate 7/10 + 2 retries → 3 subject variants/step (5 patterns formels)
  → Cadence variable [0,2,5,9,14,21] → Preview dans le chat
  → Instantly create campaign + push leads + A/B variants[]

NON IMPLÉMENTÉ (pre-launch) :
  ❌ Cache par domaine PERSISTANT (Prisma CompanyCache TTL 7j) — actuellement Map in-memory par batch
  ❌ Subject line pattern library FORMELLE avec tracking perf par pattern
  ❌ Scoring multi-dimensionnel (fit + intent + timing) — actuellement fit-only
  ❌ Import CSV — Tier A bloquant, STRATEGY §4.2
  ❌ Multi-ESP routing (tools → ESPProvider) — abstractions prêtes, tools appellent Instantly directement

IMPLÉMENTÉ (post-launch) :
  ✅ LeadStatus étendu (8 statuts post-PUSHED) + state machine
  ✅ Webhook Instantly (reply, bounce, unsub, completed)
  ✅ Sync campaign performance (EmailPerformance + StepAnalytics, worker 30min)
  ✅ Reply classification (Mistral Small, 6 interest levels)
  ✅ Reply drafting + sending (Unibox API)
  ✅ CRM push complet (HubSpot create contact + deal)
  ✅ Campaign insights + adaptive drafting + winning patterns

NON IMPLÉMENTÉ (post-launch) :
  ❌ A/B auto-pause variantes faibles
  ❌ Winner propagation automatique
  ❌ Style learner catégorisé (subject vs tone vs CTA)
  ❌ Multi-ESP routing
```

### 3.2 Scores par composant (STRATEGY §6.2)

| Composant | Score actuel | Cible | Réf |
|-----------|-------------|-------|-----|
| Enrichissement prospect | **7/10** | 6/10 | §7.1.1 |
| ICP Scoring | **7/10** | 7/10 | §7.3.3 |
| Email Copywriting | **8/10** | 8/10 | §7.1.2-1.4 |
| Subject Lines | **6/10** | 6/10 | §7.2.1 |
| A/B Testing | **4/10** | 5/10 | §7.2.1 |
| Cadence & Séquence | **7.5/10** | 7/10 | §7.2.2-2.4 |
| Feedback Loop | **5/10** | 5/10 | §7.3.2 |
| Pipeline post-launch | **6/10** | 5/10 | §11 |

### 3.3 Bugs connus

- ~~`industry: null` hardcodé dans `instantly_source_leads`~~ ✅ CORRIGÉ (instantly-tools.ts:289-292)
- `listLeads` limité à 100 sans pagination — STRATEGY §6.2 (à vérifier)
- Filtres avancés supprimés au broadening au lieu de devenir des scoring signals — STRATEGY §6.2

---

## 4. Email Frameworks (état CIBLE — à implémenter)

> ⚠️ L'état actuel est 3 steps avec delays fixes [0, 3, 3] et un seul framework PAS.
> La cible ci-dessous est Tier 2 (STRATEGY §7.2.2).

| Step | Framework | Delay | Mots | Structure |
|------|-----------|-------|------|-----------|
| **0** | **PAS** (Problem-Agitate-Solve) | J+0 | 80 | Trigger event en opener si dispo. Connection bridge. |
| **1** | **Value-add** (insight/ressource) | J+2 | 60 | Insight, ressource, ou case study. |
| **2** | **Social proof** (case study) | J+5 | 60 | Résultat concret d'un client similaire. |
| **3** | **New angle** (different pain point) | J+9 | 70 | Pain point différent du step 0. |
| **4** | **Micro-value** (stat, tip, question) | J+14 | 50 | Un seul insight actionable. Question ouverte. |
| **5** | **Breakup** (dernier message) | J+21 | 40 | Court, direct. Zero pression. |

**Règles cibles (à implémenter) :**
- Frameworks hardcodés dans le system prompt, pas laissés au choix du modèle
- **Connection bridge** : connecter LE pain point le plus pertinent à LA solution spécifique du sender
- **Trigger en opener** : si un trigger existe, il DOIT être l'opener
- **Follow-ups cohérents** : chaque step reçoit le body complet des steps précédents
- **A/B testing** : 2-3 variantes de subject line par step via `variants[]` Instantly
- **Quality gate** : score LLM post-génération, régénération si < 6/10

---

## 5. Conventions obligatoires

1. **Encryption** — Tous les tokens/API keys chiffrés en DB (AES-256-GCM). Pattern : `docs/SPEC-BACKEND.md` section 8.1
2. **Validation** — Zod sur tous les inputs : routes API, tools, env vars, LLM JSON outputs
3. **Streaming** — SSE via `fetch()` + `ReadableStream` pour le chat. RAF batch update. Pattern : `docs/SPEC-CHAT.md` section 10
4. **Tool loop** — Max 5 steps (rounds de tool calling) par message user
5. **Workers** — Graceful shutdown (SIGTERM/SIGINT) sur les workers BullMQ. Pattern : `docs/SPEC-BACKEND.md` section 7.1
6. **Side effects** — Les tools qui consomment des crédits Instantly sont wrappés avec confirmation. Pattern : `docs/SPEC-BACKEND.md` section 8.5
7. **Error handling** — Hiérarchie d'erreurs typées. Pattern : `docs/SPEC-BACKEND.md` section 8.3
8. **AI logging** — Chaque appel LLM est loggé (model, tokens, cost, latency). Pattern : `docs/SPEC-BACKEND.md` section 8.4
9. **Jina rate limit** — Max 20 req/min. Workers d'enrichissement respectent cette limite.
10. **Apify** — LinkedIn via `apify-client`. Env var : `APIFY_API_TOKEN`. Best-effort (null si fail).
11. **TinyFish** — Web automation. Env var : `TINYFISH_API_KEY`. Réservé aux recherches marketing.
12. **Pas de `any`** — TypeScript strict. Zéro `any`, zéro `as any`.
13. **Pas de `console.log`** — Utiliser le logger structuré.
14. **Commits** — Conventional Commits (feat:, fix:, refactor:, perf:).
15. **Tests** — `pnpm typecheck && pnpm test` AVANT chaque commit. Non négociable.

---

## 6. Ce que LeadSens n'est PAS (vs Elevay)

| Concept Elevay | Status LeadSens |
|---------------|-----------------|
| Model `Agent` | ❌ 1 agent implicite par workspace |
| Composio | ❌ API directes |
| Worker campaign:send | ❌ Instantly gère l'envoi |
| MailboxAccount | ❌ Mailboxes dans Instantly |
| CampaignEmail (tracking Gmail) | ❌ Remplacé par DraftedEmail |
| Flow mode | ❌ Chat only |
| Context Panel sidebar | ❌ Pas en V1 |
| Agent templates | ❌ 1 seul agent |
| cheerio scraping | ❌ Jina Reader + Apify + TinyFish |
| Claude pour les emails | ❌ Mistral pour tout en V1 (upgrade path → Claude Sonnet) |

> Note : Le reply management (classify + draft reply) est IN SCOPE Phase 1 (STRATEGY §11, §12).

---

## 7. Fichiers de référence

```
docs/
├── STRATEGY.md       ← SOURCE DE VÉRITÉ PRODUIT (read-only pour Claude Code)
├── SPEC-CHAT.md      ← Spec UI chat (assistant-ui, SSE, streaming, inline components)
├── SPEC-BACKEND.md   ← Patterns backend (encryption, workers, connectors, errors)
├── INSTANTLY-API.md  ← Référence API Instantly (endpoints, gotchas)
└── PROMPTS.md        ← Séquence de prompts de dev (Phase 0 → 11)
```

### Hiérarchie de priorité

1. **STRATEGY.md** — Ce qu'on construit et pourquoi. Roadmap. Benchmarks. **Ne jamais modifier.**
2. **CLAUDE.md** (ce fichier) — Comment on construit. Stack, conventions, état actuel.
3. **SPEC-*.md** — Comment implémenter les patterns spécifiques.
4. **PROMPTS.md** — Ordre d'exécution des tâches de build.

---

## 8. Structure du projet

```
leadsens/
├── CLAUDE.md
├── .claude/
│   ├── commands/               ← Slash commands autonomes
│   │   ├── implement-next.md
│   │   ├── audit.md
│   │   ├── audit-prompts.md
│   │   ├── challenge.md
│   │   └── status.md
│   ├── tasks/
│   │   ├── BACKLOG.md          ← Tâches ordonnées par impact reply rate
│   │   ├── CURRENT.md          ← Tâche en cours
│   │   └── DONE.md             ← Historique
│   ├── findings/               ← Écarts code vs stratégie
│   └── progress.txt            ← Log chronologique de chaque itération
├── scripts/
│   └── loop.sh                 ← Bash wrapper pour boucle autonome
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
│   │   │   ├── webhooks/instantly/route.ts        ← À implémenter (Phase 1)
│   │   │   └── trpc/[trpc]/route.ts
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx
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
│   │       │   ├── mistral-client.ts
│   │       │   └── types.ts
│   │       ├── tools/
│   │       │   ├── index.ts
│   │       │   ├── types.ts
│   │       │   ├── instantly-tools.ts
│   │       │   ├── enrichment-tools.ts
│   │       │   ├── email-tools.ts
│   │       │   ├── crm-tools.ts
│   │       │   ├── memory-tools.ts
│   │       │   ├── icp-parser.ts
│   │       │   ├── csv-tools.ts                   ← À implémenter (Tier A)
│   │       │   ├── reply-tools.ts                 ← À implémenter (Phase 1)
│   │       │   └── analytics-tools.ts             ← À implémenter (Phase 1)
│   │       ├── connectors/
│   │       │   ├── instantly.ts
│   │       │   ├── hubspot.ts
│   │       │   ├── jina.ts
│   │       │   ├── apify.ts
│   │       │   └── tinyfish.ts
│   │       ├── enrichment/
│   │       │   ├── jina-scraper.ts
│   │       │   ├── summarizer.ts
│   │       │   └── icp-scorer.ts
│   │       └── email/
│   │           ├── prompt-builder.ts
│   │           ├── style-learner.ts
│   │           └── drafting.ts
│   ├── lib/
│   │   ├── encryption.ts
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   ├── ai-events.ts
│   │   ├── lead-status.ts                         ← State machine à étendre (Phase 1)
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

---

## 9. Plan Mode

> **Instructions à suivre quand Claude Code entre en Plan Mode.**

**AVANT TOUTE REVIEW :** Lis `docs/STRATEGY.md` §6 (audit) et §7 (plan d'amélioration) pour comprendre les priorités produit. Chaque recommandation technique doit être pondérée par son impact sur le reply rate.

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

### 9.1 Préférences d'ingénierie

- **DRY is important** — flag repetition aggressively.
- **Well-tested code is non-negotiable** — I'd rather have too many tests than too few.
- **"Engineered enough"** — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
- **Handle more edge cases, not fewer** — thoughtfulness > speed.
- **Bias toward explicit over clever.**
- **Impact-first** — prioriser par impact sur le reply rate (Tier 1 > 2 > 3).

### 9.2 Les 4 sections de review

**1. Architecture review** — system design, coupling, data flow, scaling, security.
**2. Code quality review** — DRY, error handling, edge cases, tech debt, over/under-engineering.
**3. Test review** — coverage gaps, quality, edge cases, untested failure modes.
**4. Performance review** — N+1 queries, memory, caching, slow paths.

### 9.3 Pour chaque issue trouvée

- Describe the problem concretely, with file and line references.
- Present 2–3 options, including "do nothing" where that's reasonable.
- For each option: implementation effort, risk, impact on reply rate, maintenance burden.
- Give your recommended option and why.
- Explicitly ask whether I agree before proceeding.

### 9.4 Workflow

**BEFORE YOU START:** Ask if I want:
1. **BIG CHANGE:** Interactive, one section at a time, max 4 issues per section.
2. **SMALL CHANGE:** One question per review section.

**FOR EACH STAGE:** Output exploration + pros/cons + opinionated recommendation. NUMBER issues, LETTER options. Recommended option = 1st option.

### 9.5 Demand Elegance

- For non-trivial changes: "is there a more elegant way?"
- If a fix feels hacky: "implement the elegant solution."
- Skip this for simple, obvious fixes.
- Challenge your own work before presenting it.

---

## 10. Autonomous Improvement Loop

> LeadSens est à **4.2/10**. L'objectif est **8/10** et **18% reply rate**.
> Chaque action doit passer le test : "Est-ce que ça rapproche du 18% reply rate ?"

### 10.1 Principe

Claude Code agit comme un **staff engineer autonome** qui :

1. **Audite** la codebase vs STRATEGY.md → génère des findings
2. **Challenge** chaque décision existante → propose des alternatives
3. **Priorise** par impact reply rate (Tier 1 > Tier 2 > Tier 3)
4. **Implémente** la tâche la plus impactante
5. **Vérifie** (tests + typecheck + review du diff)
6. **Documente** (findings, progress.txt, done log, learnings)
7. **Boucle** → nouvelle session avec contexte frais

### 10.2 Architecture de la boucle

La boucle est orchestrée par `scripts/loop.sh` (bash), PAS par des slash commands chaînées. Chaque itération est une **session Claude Code séparée avec un contexte frais** pour éviter la dégradation de performance.

```
scripts/loop.sh
  │
  ├── Itération 1 : claude -p "..." → BACKLOG task → implement → test → commit
  │                                    → update progress.txt
  │                                    → update CLAUDE.md gotchas
  │                                    → exit
  │
  ├── sleep 30
  │
  ├── Itération 2 : claude -p "..." → contexte frais, lit progress.txt + BACKLOG
  │                                    → next task → implement → test → commit
  │                                    → exit
  │
  └── ... (jusqu'à completion ou max_iterations)
```

### 10.3 4 canaux de mémoire entre itérations

| Canal | Fichier | Ce qu'il persiste |
|-------|---------|-------------------|
| **Git history** | `.git/` | Code + diffs + commit messages |
| **Progress log** | `.claude/progress.txt` | Journal chronologique : tâche, résultat, erreurs, durée, learnings |
| **Task state** | `.claude/tasks/BACKLOG.md` | Statut de chaque tâche (done/pending) |
| **Learnings** | Section 11 de ce fichier | Gotchas, patterns, conventions découverts |

### 10.4 Commandes disponibles

| Commande | Usage | Ce qu'elle fait |
|----------|-------|-----------------|
| `/implement-next` | Interactif | Pioche 1 tâche, planifie, implémente, teste, commit |
| `/audit` | Interactif | Audit complet codebase vs STRATEGY.md, génère findings + tâches |
| `/audit-prompts` | Interactif | Audit des prompts LLM vs STRATEGY.md §5-7 |
| `/challenge [module]` | Interactif | Deep-dive sur 1 module, challenge chaque décision |
| `/status` | Interactif | Dashboard progression |
| `scripts/loop.sh` | Autonome | Boucle bash : 1 tâche par session, contexte frais, max N itérations |

### 10.5 Règles de la boucle

```
TOUJOURS:
- Lire STRATEGY.md AVANT toute action
- Lire le code source AVANT de le modifier
- Finir Tier 1 AVANT de commencer Tier 2
- 1 tâche à la fois dans CURRENT.md
- Tests + typecheck AVANT chaque commit
- Écrire dans progress.txt APRÈS chaque itération
- Ajouter les learnings dans la section 11 de ce CLAUDE.md

STRATEGY.md — Mise à jour autonome autorisée :
- UNIQUEMENT après une phase de recherche avec sources vérifiables
- Chaque modification = un commit séparé "docs(strategy): [description]"
- Ajouter une entrée au changelog en bas de STRATEGY.md : date + ce qui a changé + source + raison
- Toutes les sections sont modifiables si la recherche le justifie avec des données concrètes
- Pas de changement basé sur de l'opinion ou de l'intuition — uniquement des données

JAMAIS:
- Skip les tests
- Implémenter sans plan
- Ignorer un finding
- Commencer Tier N+1 si Tier N incomplet
- Présumer qu'une feature existe sans vérifier dans le code
```

### 10.6 Format des tâches dans BACKLOG.md

Chaque tâche a des **acceptance criteria** testables :

```markdown
- [ ] **T1-ENR-01** Multi-page scraping Jina
  **Fichiers:** `src/server/lib/enrichment/jina-scraper.ts`
  **Réf:** STRATEGY §7.1.1
  **PASS IF:**
  - jina-scraper accepte une URL et retourne le markdown de 3+ pages (homepage + about + blog/careers/press)
  - Les liens internes sont extraits de la homepage et filtrés (about, blog, careers, press)
  - Le rate limit 20 req/min est respecté (delay entre les appels)
  - Un test unitaire vérifie le multi-page avec un mock Jina
  - `pnpm typecheck && pnpm test` passent
```

### 10.7 Format progress.txt

```
=== ITERATION 14 | 2026-03-10 09:42 UTC ===
TASK: T1-ENR-01 Multi-page scraping Jina
STATUS: DONE
DURATION: ~25 min
FILES CHANGED: jina-scraper.ts, enrichment-tools.ts, jina-scraper.test.ts
TESTS: 14/14 passed
COMMIT: feat(enrichment): multi-page scraping with Jina Reader
LEARNINGS:
- Jina retourne des 403 sur certains /blog — fallback nécessaire (try/catch par page)
- Les pages /careers sont souvent des iframes vers un ATS externe — Jina retourne du HTML minimal
- Le markdown concaténé peut dépasser 30K chars — tronquer à 15K avant le summarizer
NEXT: T1-ENR-02 Cache par domaine
```

---

## 11. Gotchas & Patterns (auto-alimenté)

> Cette section est mise à jour par Claude Code après chaque itération.
> Elle sert de mémoire persistante entre les sessions.

### Patterns découverts

- **[enrichment]** : 3-layer fallback (Apollo → LinkedIn → Website → LinkedIn-only → always advance) — non-blocking failures
- **[email]** : 6-step framework with hardcoded names (PAS/Value-add/Social Proof/New Angle/Micro-value/Breakup) via `getFramework(step)`
- **[email]** : Signal prioritization with recency weighting + data-driven weights from correlator
- **[email]** : 5 subject line patterns (question/observation/curiosity/direct/personalized) — each variant must use a different pattern
- **[scoring]** : ICP feedback loop alerts agent when >70% leads eliminated — prevents silent empty campaigns
- **[scoring]** : Two-phase scoring — LLM fit pre-enrichment (cheap filter) → deterministic signal boost post-enrichment (0 LLM cost, uses hiringSignals/fundingSignals/leadershipChanges/techStackChanges/publicPriorities/LinkedIn activity)
- **[providers]** : Adapter pattern at SDK boundaries — `as any` acceptable with eslint-disable at `SourcingProvider`/Mistral SDK interface
- **[email]** : Spam word scanner in quality gate — 100 triggers (phrases + words), runs BEFORE LLM scoring (instant, zero cost). ≥3 matches = flagged, forces retry + penalizes score. Word boundary regex prevents false positives.

### Gotchas

- **[Prisma Json]** : `{ not: null }` doesn't typecheck for Json fields — use `{ not: Prisma.JsonNull }`
- **[Prisma Json]** : Storing arbitrary objects in `Json` fields requires `as unknown as Prisma.InputJsonValue` (not `as any`)
- **[webhook]** : `safeTransition()` must accept `LeadStatus` type, not `string` — import from `@prisma/client`
- **[providers]** : `getActiveIntegration()` parameter should be `IntegrationType` not `string` — callers use `as const` arrays

### Conventions émergentes

- **[type safety]** : At SDK/provider boundaries, use explicit eslint-disable + comment explaining why. Everywhere else, zero `as any`
- **[scoring]** : Threshold alerts on tool outputs (not just raw counts) — agent gets structured warnings it can act on
