# CLAUDE.md — LeadSens

> Ce fichier est lu en premier par Claude Code. Il est la SEULE source de vérité sur le code.
> Pour la vision produit et la roadmap → `docs/STRATEGY.md` (read-only, c'est le product owner).
> En cas de conflit entre ce fichier et STRATEGY.md → STRATEGY.md gagne toujours.

---

## 1. Projet

**LeadSens** — Agent IA conversationnel BYOT (Bring Your Own Tools) qui orchestre les outils de l'utilisateur pour automatiser la prospection B2B : ICP → Sourcing → Scoring → Enrichissement → Rédaction → Envoi → Monitoring → Reply Management → Meeting Booked.

LeadSens n'est pas un outil. C'est le **chef d'orchestre** des outils du user. Chaque utilisateur connecte ses propres comptes (Instantly, Smartlead, Apollo, ZeroBounce…), choisit son niveau d'autonomie (Full auto / Supervisé / Manuel), et LeadSens orchestre le pipeline complet.

La valeur est dans les **décisions entre les appels API** : scoring pré-enrichissement (~40% d'économie), Company DNA, frameworks copywriting hardcodés, clustering par segments, style learner, curseur d'autonomie.

### Score actuel : 7.0/10 (audit v4+ 2026-03-11, était 6.9 → 6.8 → 6.7 → 6.5 → 6.2 → 4.2). Objectif : 8/10. Reply rate cible : 18%.

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
| DB | Prisma 6 + PostgreSQL (Neon) | `prisma` `@prisma/client` |
| Background jobs | Inngest (cron + event-driven) | `inngest` |
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

### 3.1 Pipeline — état d'implémentation

```
PIPELINE COMPLET (ICP → Meeting Booked) :
  ICP parse (Mistral Large, two-phase v2) → SuperSearch count → source → fetch leads
  → ICP scoring (Mistral Small, fit pre-filter) + feedback loop >70% skipped
  → Signal boost post-enrichment (fit 40% + intent 35% + timing 25%, deterministic)
  → Jina 5 pages + Apify LinkedIn → Mistral Small summarize → CompanyCache in-memory
  → 6 emails (6 frameworks hardcodés) + connection bridge + quality gate + 3 subject variants
  → Cadence [0,2,5,9,14,21] → ESP create campaign + push + A/B variants[]
  → Webhook (11 events) → Reply classify → Draft reply → CRM push
  → A/B auto-pause (z-test) → Winner propagation → Style learner (6 categories)
  → Multi-ESP routing (ESPProvider: Instantly/Smartlead/Lemlist)

RESTE À FAIRE :
  ❌ CompanyCache PERSISTANT (Prisma TTL 7j) — actuellement Map in-memory par batch
  ❌ Import CSV — Tier A bloquant, STRATEGY §4.2
```

### 3.2 Scores par composant (STRATEGY §6.2) — tous les objectifs atteints ou dépassés

| Composant | Score | Cible | Composant | Score | Cible |
|-----------|-------|-------|-----------|-------|-------|
| Enrichissement | **7/10** | 6 | Subject Lines | **6/10** | 6 |
| ICP Scoring | **7/10** | 7 | A/B Testing | **7/10** | 5 |
| Email Copywriting | **8/10** | 8 | Feedback Loop | **5.5/10** | 5 |
| Cadence & Séquence | **7.5/10** | 7 | Pipeline post-launch | **7/10** | 5 |

### 3.3 Bugs connus

- `listLeads` limité à 100 sans pagination — STRATEGY §6.2

---

## 4. Email Frameworks (IMPLÉMENTÉ)

6 steps via `getFramework(step)` dans `prompt-builder.ts` :
PAS (J+0, 85w) → Value-add (J+2, 65w) → Social proof (J+5, 70w) → New angle (J+9, 65w) → Micro-value (J+14, 50w) → Breakup (J+21, 45w)

Règles implémentées : frameworks hardcodés, connection bridge 3-step, trigger en opener, follow-ups cohérents (body complet steps précédents, trunc 1500 chars), 3 subject variants/step (5 patterns), quality gate step-aware (Step 0=8/10, autres=7/10).

---

## 5. Conventions obligatoires

1. **Encryption** — Tous les tokens/API keys chiffrés en DB (AES-256-GCM). Pattern : `docs/SPEC-BACKEND.md` section 8.1
2. **Validation** — Zod sur tous les inputs : routes API, tools, env vars, LLM JSON outputs
3. **Streaming** — SSE via `fetch()` + `ReadableStream` pour le chat. RAF batch update. Pattern : `docs/SPEC-CHAT.md` section 10
4. **Tool loop** — Max 5 steps (rounds de tool calling) par message user
5. **Background jobs** — Inngest functions (cron + event-driven) via `src/inngest/`. Served at `/api/inngest`. No long-running workers.
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
16. **Jamais commit sur main** — En mode autonome, toujours vérifier la branche avant de commit. Si on est sur main, créer une branche auto/improve-{date} d'abord. Commande : git checkout -b auto/improve-$(date +%Y%m%d) avant le premier commit.

---

## 6. Différences clés vs Elevay (ancien projet)

LeadSens ≠ Elevay : 1 agent implicite (pas de model Agent), API directes (pas Composio), Instantly gère l'envoi (pas de worker), chat-only (pas de flow mode), Jina+Apify (pas cheerio), Mistral V1 (upgrade path → Claude Sonnet pour drafting si reply rate < 14%).

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
src/
├── app/api/agents/chat/route.ts          ← Chat SSE + system prompts (phase-tiered)
├── app/api/webhooks/instantly/route.ts    ← Webhook handler (11 events)
├── app/api/inngest/route.ts              ← Inngest serve handler
├── app/(dashboard)/chat/                 ← Dashboard (auth required)
├── app/(marketing)/                      ← Landing, pricing, legal (public)
├── server/lib/
│   ├── tools/index.ts                    ← Tool registry + phase filtering
│   ├── tools/icp-parser.ts              ← ICP parsing (two-phase v2)
│   ├── tools/pipeline-tools.ts          ← Reply classify/draft/send, CSV, insights
│   ├── connectors/{instantly,hubspot,jina,apify,tinyfish}.ts
│   ├── providers/index.ts               ← ESPProvider, CRMProvider, EmailVerifier
│   ├── enrichment/{jina-scraper,summarizer,icp-scorer,hiring-signal-extractor}.ts
│   ├── email/{prompt-builder,style-learner,drafting}.ts
│   ├── analytics/{correlator,insights,adaptive,ab-testing,sync,bounce-guard,reply-guard}.ts
│   └── llm/{mistral-client,context-manager}.ts
├── lib/{encryption,lead-status,logger,rate-limit,redis}.ts
├── inngest/{client,functions}.ts         ← 3 bg jobs (analytics cron, enrich, draft)
├── components/chat/                      ← Chat UI (assistant-ui)
docs/STRATEGY.md                          ← Source de vérité produit (read-only)
.claude/tasks/BACKLOG.md                  ← Tâches ordonnées par impact
.claude/progress.txt                      ← Log chronologique des itérations
prisma/schema.prisma                      ← DB schema
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

`scripts/loop.sh` orchestre des sessions Claude Code séparées (contexte frais). Chaque itération : BACKLOG task → implement → test → commit → update progress.txt → exit → sleep 30 → next.

### 10.3 Mémoire entre itérations

| Canal | Fichier |
|-------|---------|
| Git history | `.git/` (code + diffs + commits) |
| Progress log | `.claude/progress.txt` (tâche, résultat, learnings) |
| Task state | `.claude/tasks/BACKLOG.md` (done/pending) |
| Learnings | Section 11 de ce fichier |

### 10.4 Commandes : `/implement-next`, `/audit`, `/audit-prompts`, `/challenge [module]`, `/status`, `scripts/loop.sh` (autonome)

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

RECHERCHE — Règles de validation :
- Chaque nouveau insight doit être CROISÉ avec les findings précédents dans .claude/findings/
- Si un nouveau résultat contredit un finding précédent → ne pas remplacer, documenter les deux sources et noter la contradiction dans le finding
- Pour modifier STRATEGY.md, il faut AU MINIMUM 2 sources indépendantes qui convergent
- Les benchmarks chiffrés (reply rates, pricing) ne sont mis à jour que si la nouvelle source est plus fiable (étude > blog > tweet) ou plus récente
- Conserver l'historique : ne jamais supprimer un ancien finding, ajouter des updates dessus
- En cas de doute, garder la valeur conservative (la plus basse pour les reply rates, la plus haute pour les coûts)

JAMAIS:
- Skip les tests
- Implémenter sans plan
- Ignorer un finding
- Commencer Tier N+1 si Tier N incomplet
- Présumer qu'une feature existe sans vérifier dans le code
```

### 10.6 Formats

**BACKLOG.md** : `- [ ] **T1-ENR-01** Titre` + `Fichiers:` + `Réf: STRATEGY §X` + `PASS IF:` (acceptance criteria testables)

**progress.txt** : `=== ITERATION N | date ===` + TASK + STATUS + FILES CHANGED + TESTS + COMMIT + LEARNINGS + NEXT

---

## 11. Gotchas & Patterns (auto-alimenté)

> Mémoire persistante entre sessions. Garder CONCIS — max 1 ligne par item.
> Details d'implementation → lire le code source directement.

### Patterns architecturaux

- **[enrichment]** : 3-layer fallback (Apollo → LinkedIn+Website → LinkedIn-only → always advance), non-blocking
- **[enrichment]** : Dual TTL cache (null=1h, success=7d), StructuredSignal[] with signalAge() recency multiplier
- **[enrichment]** : Deterministic hiring signals from careers pages (`hiring-signal-extractor.ts`), 0 LLM cost
- **[scoring]** : Two-phase (LLM fit pre-enrichment → deterministic signal boost post-enrichment)
- **[scoring]** : Broadening bonus (+1/match, max +2), Compound bonus (+1/+2/+3 for 3/4/5+ signal types)
- **[scoring]** : ICP feedback loop alerts agent when >70% leads eliminated
- **[email]** : 6-step framework via `getFramework(step)`, maxWords [85,65,70,65,50,45]
- **[email]** : 5 subject patterns (question/observation/curiosity/direct/personalized), 2-5 words enforced
- **[email]** : Connection bridge 3-step: signal → pain reasoning → solution with proof
- **[quality-gate]** : Step 0=8/10, others=7/10. Blocking checks: spam, filler, word count, subject, AI tells. Non-blocking: thin data <40%
- **[analytics]** : ALWAYS `isPositiveReply()` / `POSITIVE_REPLY_SQL`, NEVER raw `replyCount > 0`
- **[analytics]** : Reply guard (3 neg/24h) + bounce guard (>3% after 50 sends) = dual auto-pause
- **[analytics]** : `replied` from EmailPerformance (positive-only), NOT StepAnalytics (raw counts)
- **[ab-testing]** : z-test → auto-pause losers → propagate winners. Thresholds: 100+ sends, 5+ days, |z|>1.96
- **[providers]** : ESPProvider abstraction, zero direct connector imports outside connectors + sourcing
- **[dedup]** : `@@unique([workspaceId, email])`, cross-campaign via EmailPerformance by email, `ALREADY_CONTACTED_STATUSES` (8)
- **[phases]** : MONITORING = valid phase, uses PHASE_ACTIVE prompt. Tool filtering by phase (24→14-15)
- **[pipeline]** : `classify_reply` stale status — transitions don't chain within one call

### Gotchas (bugs you'll hit again)

- **[Prisma]** : Json fields → `Prisma.JsonNull` (not null), `as unknown as Prisma.InputJsonValue` (not as any)
- **[Prisma]** : Upsert always overwrites — use separate `updateMany({where:{field:null}})` for null-only updates
- **[webhook]** : `req.text()` BEFORE `JSON.parse()` (body stream consumed once for HMAC)
- **[webhook]** : `timingSafeEqual` needs equal-length check first
- **[webhook]** : Instantly variant is 1-indexed → `webhookVariantToIndex()` converts to 0-indexed
- **[instantly]** : Lead `status` read-only — use `updateLeadInterestStatus` to stop sequences
- **[instantly]** : `getEmails()` response field is `lead` not `lead_email`
- **[instantly]** : `getCampaignStepAnalytics` has 4 response shapes with different field names
- **[regex]** : `\b` fails after `:` — use `^re:\s` not `^(re:)\b`
- **[enrichment]** : `extractLinkedInContext()` returns `undefined` (not `null`) for absent keys
- **[testing]** : Zod `.default()` = REQUIRED in infer type — tests must include explicitly
- **[testing]** : setTimeout stub for rate-limit: capture `realSetTimeout` before stubbing
- **[types]** : `safeTransition()` needs `LeadStatus` type, `getActiveIntegration()` needs `string` (was `IntegrationType` enum, now plain string)
- **[integrations]** : Registry-driven architecture (`src/server/lib/integrations/registry.ts`). Add new tools there, not per-tool API routes.
- **[integrations]** : `IntegrationType` Prisma enum removed → `type` is now `String`. No migration needed per new tool.
- **[integrations]** : Dynamic route `[tool]/route.ts` handles all API key connect/disconnect. HubSpot OAuth still uses `hubspot/auth/` and `hubspot/callback/`.
- **[types]** : SDK boundaries → explicit eslint-disable + comment. Everywhere else, zero `as any`
- **[csv]** : Delimiter priority: tab > semicolon > comma. French headers mapped. Missing email = skip

## 12. Playwright MCP — Aide-mémoire

```
NAVIGATION: browser_navigate → browser_snapshot (lire) → browser_click (liens/boutons)
RECHERCHE:  browser_type (search bar) → browser_press_key "Enter" → snapshot résultats
MULTI-TAB:  browser_tab_new / browser_tab_list / browser_tab_select
DONNÉES:    browser_snapshot (accessibility tree, 2-5KB) >> browser_take_screenshot (500KB)
VISUEL:     browser_take_screenshot (fullPage=true), sauver dans .claude/findings/screenshots/
FORMS:      browser_click + browser_type + browser_select_option, slowly=true pour JS handlers
DEBUG:      browser_console (erreurs), browser_network (requêtes), browser_wait (chargement)

RÈGLES:
- Toujours 3-5 résultats Google, naviguer les pages internes de chaque site
- Préférer snapshot pour les données, screenshot uniquement pour le visuel
- Synthétiser dans un finding avec URLs sources exactes
```