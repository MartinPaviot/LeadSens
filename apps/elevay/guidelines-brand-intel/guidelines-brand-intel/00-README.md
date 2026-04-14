# Elevay — Guide d'intégration Brand-Intello

> Documentation exhaustive pour intégrer les 3 agents IA, l'UI/UX dashboard, l'auth OAuth sociale et le schéma Prisma du projet **brand-intello** dans ton autre projet **Elevay** (Next.js App Router + Better Auth + Prisma + Postgres).

## Prérequis confirmés

- **Stack cible** : Next.js App Router + Better Auth + Prisma + Postgres (déjà en place dans Elevay)
- **Périmètre** : tout (3 agents + UI + auth social + schéma DB)
- **Stratégie** : **remplacement** de la version antérieure des agents déjà présente dans Elevay, par celle (plus aboutie) de brand-intello

## Ordre de lecture recommandé

Lis les fichiers **dans cet ordre**, chacun est autonome mais s'appuie sur le précédent.

### Phase 0 — Comprendre et décider

| # | Fichier | Quoi |
|---|---------|------|
| 01 | [01-stack-and-dependencies.md](./01-stack-and-dependencies.md) | Versions exactes + diff attendu avec ton `package.json` Elevay |
| 02 | [02-project-structure.md](./02-project-structure.md) | Arbre de fichiers à copier, correspondance brand-intello → Elevay |
| 19 | [19-open-questions.md](./19-open-questions.md) | **À lire en premier** : 18 questions à trancher avant de commencer |

### Phase 1 — Préparer l'environnement

| # | Fichier | Quoi |
|---|---------|------|
| 03 | [03-environment-variables.md](./03-environment-variables.md) | 17 variables d'env, où obtenir chaque clé |

### Phase 2 — Merger la base

| # | Fichier | Quoi |
|---|---------|------|
| 04 | [04-prisma-schema-merge.md](./04-prisma-schema-merge.md) | Ajouter `BrandProfile` + `AgentRun` **sans écraser** les tables Better Auth existantes d'Elevay |
| 05 | [05-better-auth-and-middleware.md](./05-better-auth-and-middleware.md) | Fusion de la config Better Auth + du matcher middleware |
| 06 | [06-social-oauth-composio.md](./06-social-oauth-composio.md) | OAuth Facebook/Instagram via Composio + fallback Apify |

### Phase 3 — Porter les agents

| # | Fichier | Quoi |
|---|---------|------|
| 07 | [07-agents-architecture.md](./07-agents-architecture.md) | Pattern commun des 3 agents (modules parallèles → scoring → prompt → LLM → Zod parse) |
| 08 | [08-agent-bpi-01.md](./08-agent-bpi-01.md) | **BPI-01** — Brand Presence Intelligence (8 modules) |
| 09 | [09-agent-mts-02.md](./09-agent-mts-02.md) | **MTS-02** — Market Trend Strategist |
| 10 | [10-agent-cia-03.md](./10-agent-cia-03.md) | **CIA-03** — Competitive Intelligence Architect |
| 11 | [11-external-data-apis.md](./11-external-data-apis.md) | SerpAPI, GNews, DataForSEO, YouTube, Firecrawl, Apify |

### Phase 4 — Connecter les endpoints

| # | Fichier | Quoi |
|---|---------|------|
| 12 | [12-api-routes.md](./12-api-routes.md) | 9 endpoints : signatures, auth, Zod, SSE |
| 13 | [13-sse-streaming.md](./13-sse-streaming.md) | Helper `createSSEStream` + pattern de consommation client |

### Phase 5 — Porter l'UI

| # | Fichier | Quoi |
|---|---------|------|
| 14 | [14-ui-design-system.md](./14-ui-design-system.md) | Tailwind, design tokens, polices, CSS variables OKLCH |
| 15 | [15-ui-components.md](./15-ui-components.md) | Composants shadcn + brand-intel, collisions avec Elevay |
| 16 | [16-dashboard-orchestration.md](./16-dashboard-orchestration.md) | `BrandIntelDashboard.tsx` — state machine 4 onglets |

### Phase 6 — Vérifier

| # | Fichier | Quoi |
|---|---------|------|
| 17 | [17-integration-checklist.md](./17-integration-checklist.md) | **Checklist séquentielle** d'intégration en 9 phases |
| 18 | [18-testing-and-verification.md](./18-testing-and-verification.md) | Comment vérifier que ça marche (smoke tests) |

## Arbre de décision d'intégration

```
Ton Elevay est déjà Next.js App Router + Better Auth + Prisma + Postgres ?
│
├─ Même version Next.js (16) ──────────► Copier-coller direct (phase 1→6)
│
├─ Next.js 14 / 15 ─────────────────────► Upgrade Elevay d'abord OU adapter routes
│                                          (voir question 1 dans 19-open-questions.md)
│
└─ Différent ────────────────────────────► Ce guide n'est pas adapté, adapter manuellement
```

## Principe général

**NE PAS** `rm -rf` ton code Elevay puis copier brand-intello : tu perdrais tout le reste de ton app (pages, composants, config, users).

**Stratégie** : merger fichier par fichier en suivant la checklist [17-integration-checklist.md](./17-integration-checklist.md). Les fichiers `.md` de ce dossier te disent exactement, pour chaque pièce technique :

- ✅ **Quoi copier tel quel** (ex: `src/agents/**`, `src/lib/sse.ts`)
- 🔀 **Quoi fusionner** (ex: schéma Prisma, middleware, tailwind config, `.env`)
- ⚠️ **Quoi NE PAS écraser** (tables `User`/`Session`/`Account` existantes dans Elevay)
- 🔧 **Quoi adapter** (workspaceId → vrai ID d'équipe Elevay, imports, etc.)

## Inventaire rapide brand-intello

- **3 agents IA** : BPI-01 (8 modules), MTS-02 (5 modules), CIA-03 (6 modules)
- **LLM** : Anthropic `claude-sonnet-4-6`
- **UI** : Next.js 16 + React 19 + Tailwind 3.4 + shadcn/ui style `base-nova` + Recharts + Sonner
- **Auth** : Better Auth 1.5.6 (email/password) + Composio (OAuth Facebook/Instagram) + Apify (fallback scraping)
- **DB** : Prisma 7 + `@prisma/adapter-pg` + Neon Postgres
- **Streaming** : SSE natif (Server-Sent Events via ReadableStream)
- **Pas de chat conversationnel** : chaque run est stateless, persisté en DB
