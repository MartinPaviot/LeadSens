# CLAUDE.md — Elevay

> Ce fichier est lu par Claude Code quand on travaille dans `apps/elevay/`.
> Pour le contexte global du monorepo, voir le `CLAUDE.md` racine.

---

## 1. Projet

**Elevay** — Assistant IA marketing conversationnel avec agents spécialisés. Aide les marketeurs avec : brand intelligence, content writing, campaign planning, social media, influencer discovery, SEO.

Elevay est une app **indépendante** dans le monorepo LeadSens. Elle partage la base de données (via `@leadsens/db`) mais a son propre code, ses propres routes, et ses propres agents.

---

## 2. Stack

| Composant | Choix |
|-----------|-------|
| Framework | Next.js 15 App Router (Turbopack) |
| Language | TypeScript strict |
| CSS | Tailwind CSS 4 |
| UI | shadcn/ui + Radix + `@leadsens/ui` |
| Chat UI | assistant-ui |
| Auth | Better Auth (shared config) |
| DB | Prisma 6 + PostgreSQL (Neon) via `@leadsens/db` |
| API | tRPC + TanStack Query |
| LLM | Claude Sonnet 4 (chat, influence brief), Mistral (agents) |
| Validation | Zod |
| Icons | Phosphor (`@phosphor-icons/react`) + Lucide |
| Port | 3001 |

---

## 3. Structure

```
apps/elevay/
├── agents/                          # Agents hors-src (influence, seo-geo specs)
│   ├── influence/                   # Agent influencer discovery (UI + core + hooks)
│   └── seo-geo/                     # Agents SEO & GEO
├── core/                            # Tools partagés (CMS, DataForSEO, Composio)
│   ├── tools/                       # CMS adapters, DataForSEO, etc.
│   └── types/                       # AgentContext, ClientProfile
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Login + Signup
│   │   ├── (dashboard)/             # Pages dashboard (auth required)
│   │   │   ├── page.tsx             # Home (AgentMarketplace)
│   │   │   ├── brand-intel/
│   │   │   ├── budget/
│   │   │   ├── content-writer/
│   │   │   ├── crm-campaigns/
│   │   │   ├── influence/
│   │   │   ├── notifications/
│   │   │   ├── seo-chat/
│   │   │   ├── settings/
│   │   │   ├── social-campaigns/
│   │   │   ├── social-inbox/
│   │   │   └── up-next/
│   │   ├── api/agents/              # API routes par agent
│   │   │   ├── bmi/                 # Brand Intel (bpi-01, cia-03, mts-02)
│   │   │   ├── budget-controller/
│   │   │   ├── chat/               # Chat général SSE
│   │   │   ├── crm-campaign-manager/
│   │   │   ├── influence/          # Influence (chat, search, brief)
│   │   │   ├── seo-geo/            # SEO agents (8 routes)
│   │   │   ├── social-campaign-manager/
│   │   │   ├── social-content-writer/
│   │   │   └── social-interaction-manager/
│   │   └── onboarding/
│   ├── agents/                      # Agent logic (dans src/)
│   │   ├── _shared/                 # Types partagés, LLM client, Composio wrapper
│   │   ├── bpi-01/                  # Brand Performance Audit
│   │   ├── cia-03/                  # Competitive Intelligence
│   │   ├── mts-02/                  # Market Trends
│   │   ├── budget-controller/
│   │   ├── crm-campaign-manager/
│   │   ├── social-campaign-manager/
│   │   ├── social-content-writer/
│   │   └── social-interaction-manager/
│   ├── components/
│   │   ├── shared/                  # Spinner, EmptyState, PageHeader
│   │   ├── brand-intel/
│   │   ├── budget/
│   │   ├── chat/
│   │   ├── content-writer/
│   │   ├── crm-campaigns/
│   │   ├── marketplace/             # Home page agent cards
│   │   ├── notifications/
│   │   ├── onboarding/
│   │   ├── seo-chat/
│   │   ├── settings/
│   │   ├── social-campaigns/
│   │   ├── social-inbox/
│   │   └── up-next/
│   ├── lib/                         # Auth, Prisma, SSE, tRPC, utils
│   └── middleware.ts
```

---

## 4. État actuel des agents

| Agent | Code | Status | Ce qui fonctionne | Ce qui manque |
|-------|------|--------|-------------------|---------------|
| Brand Audit | BPI-01 | ✅ 90% | Appels API reels, LLM, persistence DB | — |
| Competitive Intel | CIA-03 | ✅ 85% | 4 modules, scoring, LLM strategique | — |
| Market Trends | MTS-02 | ✅ 85% | 3 modules + synthese | — |
| Content Writer | SCW-16 | 🟡 80% | Generation de contenu multi-plateforme | Enrichment BuzzSumo, export |
| Social Campaigns | SMC-19 | 🟡 70% | Strategy generation | Publishing stubbed |
| CRM Campaigns | CRM-27 | 🟡 70% | Email/SMS drafts | Platform adapters (HubSpot...) |
| Social Inbox | SMI-20 | 🟡 70% | Classification, auto-reply | Webhook entrants |
| Budget Controller | BDG-32 | ❌ 20% | Health score calculation | Data collection retourne des zeros |
| Influencer Discovery | CIO | ✅ 85% | Brief LLM, mock data fallback, scoring | Apify env vars, real tools |
| SEO & GEO | 8 agents | 🟡 varies | Routes + workflows | Implementations varies |

---

## 5. Conventions

1. **TypeScript strict** — zéro `any`, zéro `as any`
2. **Zod** sur tous les inputs (routes API, tRPC, LLM outputs)
3. **SSE streaming** — `createSSEStream()` pour agents, `SSEEncoder` pour chat. Tout dans `src/lib/sse.ts`
4. **Conventional Commits** : `feat(elevay):`, `fix(elevay):`, `refactor(elevay):`
5. **Imports** : `@/` = `apps/elevay/src/`, `@agents/` = `apps/elevay/agents/`, `@core/` = `apps/elevay/core/`, `@leadsens/db` = shared Prisma
6. **Pas de `console.log`** en production
7. **Typecheck avant commit** : `pnpm --filter @leadsens/elevay typecheck`
8. **Composants partagés** : `<Spinner />`, `<EmptyState />`, `<PageHeader />` dans `src/components/shared/`
9. **Background gradient** : utiliser la classe CSS `.bg-elevay-page` (supporte dark mode)
10. **Brand colors** : `#17c3b2` (teal), `#FF7A3D` (orange), `#2c6bed` (blue), `#FFF7ED` (cream)

---

## 6. Commandes utiles

```bash
# Dev
pnpm dev:elevay              # Port 3001
pnpm dev:all                 # LeadSens (3000) + Elevay (3001)

# Build & check
pnpm build:elevay
pnpm --filter @leadsens/elevay typecheck

# Database (shared)
pnpm db:generate             # Regenerate Prisma client
pnpm db:push                 # Push schema changes
pnpm db:studio               # Visual DB browser
pnpm db:migrate              # Create migration

# Add a shadcn component
cd apps/elevay && npx shadcn@latest add <component>
```

---

## 7. Partage avec LeadSens

### Partagé (via packages/)
- **`@leadsens/db`** : Prisma schema + client. Même base PostgreSQL.
- **`@leadsens/ui`** : Sidebar, Avatar, Button, Dialog, etc.
- Tables communes : `User`, `Workspace`, `Conversation`, `Message`, `Session`, `Account`

### Indépendant (apps/elevay/ only)
- Routes API, server logic, agents, tools
- Components dashboard
- System prompts, LLM config
- Toute logique marketing-specific

### Si tu modifies le schema Prisma
1. Edite `packages/db/prisma/schema.prisma`
2. `pnpm db:generate` pour regénérer le client
3. `pnpm db:migrate` pour créer une migration
4. Préviens l'autre app (LeadSens) si c'est un breaking change

---

## 8. Zones interdites (IMPORTANT)

> **Elevay vit dans `apps/elevay/`. Ne jamais toucher au reste du monorepo sans coordination.**

```
INTERDIT sans review de Martin :
- apps/leads/          ← LeadSens, ne JAMAIS modifier
- packages/db/         ← Schema Prisma partagé, coordination obligatoire
- CLAUDE.md (racine)   ← Config Claude Code pour LeadSens
- package.json (racine)← Scripts monorepo
- pnpm-workspace.yaml  ← Structure workspace

LIBRE (ton terrain de jeu) :
- apps/elevay/         ← Tout le code Elevay
```

### Workflow git obligatoire
1. **Jamais push sur main** — toujours une branche `feat/elevay-*`
2. Ouvre une PR → si ça touche UNIQUEMENT `apps/elevay/`, merge libre
3. Si ça touche `packages/db/` ou autre → Martin doit review (CODEOWNERS)

---

## 9. Fichiers clés

| Quoi | Où |
|------|-----|
| Chat API (SSE + LLM) | `src/app/api/agents/chat/route.ts` |
| SSE utilities | `src/lib/sse.ts` (SSEEncoder + createSSEStream) |
| Agent shared types | `src/agents/_shared/types.ts` |
| Agent shared LLM | `src/agents/_shared/llm.ts` |
| Composio wrapper | `src/agents/_shared/composio.ts` |
| Workspace context | `src/lib/agent-context.ts` |
| Auth config | `src/lib/auth.ts` |
| Auth guards | `src/lib/auth-utils.ts` |
| Prisma wrapper | `src/lib/prisma.ts` |
| Middleware | `src/middleware.ts` |
| Shared components | `src/components/shared/` |
| Settings page | `src/app/(dashboard)/settings/page.tsx` |
| Onboarding | `src/app/onboarding/page.tsx` + `src/components/onboarding/` |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` (auth + onboarding redirect) |

---

## 10. Architecture des agents

### Principe directeur
**Zero blocking at activation — graceful degradation at every step.**
Un outil manquant ne bloque jamais l'agent : il dégrade proprement l'output.

### Types partagés (`src/agents/_shared/types.ts`)
```typescript
interface AgentProfile { ... }  // Workspace context pour les agents
interface ModuleResult<T> { ... }  // Résultat d'un module avec degraded_sources
interface AgentOutput<T> { ... }  // Output complet d'un agent run
```

### Pattern SSE pour les agents
```typescript
// Route API agent — utiliser createSSEStream
import { createSSEStream } from "@/lib/sse";

export async function POST(req: Request) {
  // ... auth, validation ...
  return createSSEStream(async (emit) => {
    emit("status", { label: "Running analysis..." });
    const result = await runAgent(profile);
    emit("result", { output: result });
    emit("finish", { durationMs: Date.now() - start });
  });
}
```

### Onboarding
- Wizard 5 étapes : Business → CMS → Tools → Automation → Notifications
- Écrit dans `Workspace` via `POST /api/onboarding/complete`
- Set `onboardingCompletedAt` — vérifié par le dashboard layout
- Les mêmes données sont éditables ensuite dans Settings (9 onglets)
