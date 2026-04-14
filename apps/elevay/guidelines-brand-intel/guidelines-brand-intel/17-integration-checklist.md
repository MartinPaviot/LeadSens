# 17 — Checklist séquentielle d'intégration (9 phases)

> ⚠️ **Lire `19-open-questions.md` AVANT de commencer.** Les décisions prises là-bas changent l'exécution de plusieurs phases.

## Phase 0 — Pré-flight (30 min)

- [ ] Backup : commit / branche sur Elevay (`git checkout -b feat/brand-intel-integration`)
- [ ] Comparer versions de packages clés (Next, React, Prisma, Better Auth)
- [ ] Comparer `schema.prisma` de brand-intello avec celui d'Elevay : tables `user/session/account/verification` — divergences ?
- [ ] Vérifier : `src/components/ui/*` d'Elevay utilise quel style shadcn ? (voir `components.json`)
- [ ] Répondre aux **18 questions ouvertes** (`19-open-questions.md`)

## Phase 1 — Dépendances (15 min)

- [ ] Ajouter au `package.json` d'Elevay les packages manquants (voir `01-stack-and-dependencies.md`) :
  ```bash
  pnpm add @anthropic-ai/sdk @prisma/adapter-pg pg
  pnpm add composio-core apify-client
  pnpm add @base-ui/react @phosphor-icons/react recharts sonner next-themes
  pnpm add class-variance-authority clsx tailwind-merge tailwindcss-animate tw-animate-css
  pnpm add lucide-react
  pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react @testing-library/react jsdom dotenv
  ```
- [ ] `pnpm install` — vérifier pas de conflits de peer-deps
- [ ] Si Next.js diverge : décider upgrade Elevay ou adapter code copié (voir question 1)

## Phase 2 — Variables d'environnement (20 min)

- [ ] Créer comptes si absents : Anthropic, SerpAPI, GNews, DataForSEO, YouTube (Google Cloud), Firecrawl, Composio, Apify
- [ ] Récupérer les 17 clés (voir `03-environment-variables.md`)
- [ ] Ajouter au `.env` d'Elevay
- [ ] Ajouter au `.env.example` (sans valeurs)
- [ ] Créer les 2 auth configs Composio (Facebook, Instagram) avec le bon redirect URI
- [ ] Créer les 2 tasks Apify minimum (Facebook, Instagram)
- [ ] Fusionner le schema Zod de `src/lib/env.ts` d'Elevay avec celui de brand-intello

## Phase 3 — Prisma schema + migration (20 min)

- [ ] Ajouter les modèles `BrandProfile` et `AgentRun` à la fin du `prisma/schema.prisma` d'Elevay (voir `04-prisma-schema-merge.md`)
- [ ] **Vérifier** qu'aucune ALTER sur `user/session/account/verification` n'est planifiée
- [ ] Décision Prisma generator : adopter `output = "../src/generated/prisma"` OU garder path standard → voir question 15
- [ ] `pnpm prisma migrate dev --name add_brand_intel_agents`
- [ ] `pnpm prisma generate`
- [ ] Ouvrir `pnpm prisma studio` — confirmer `brand_profile` + `agent_run` visibles

## Phase 4 — Lib utilities (10 min)

Copier depuis brand-intel/src/lib/ :

- [ ] `sse.ts` → `src/lib/sse.ts` (tel quel)
- [ ] `design-tokens.ts` → `src/lib/design-tokens.ts` (tel quel)
- [ ] `constants.ts` → **merger** : ajouter `WORKSPACE_ID` aux constants d'Elevay (ou remplacer par un helper qui retourne `session.user.activeWorkspaceId`)
- [ ] `env.ts` → **merger** : ajouter les nouveaux champs au schema Zod d'Elevay (déjà fait en Phase 2)
- [ ] `db.ts` → **vérifier** que le pattern singleton d'Elevay est compatible avec `@prisma/adapter-pg`

Si imports `@/generated/prisma` → `@prisma/client` doit être fait : find & replace global dans les fichiers copiés à partir de la Phase 5.

## Phase 5 — Auth + middleware (15 min)

- [ ] Vérifier que `src/lib/auth.ts` d'Elevay exporte bien `auth` avec `auth.api.getSession()`
- [ ] `src/lib/auth-client.ts` : garder celui d'Elevay, ne pas écraser
- [ ] Middleware d'Elevay : ajouter `'/brand-intel/:path*'` au matcher (voir `05-better-auth-and-middleware.md`)
- [ ] **Ne PAS copier** `/api/auth/[...all]/route.ts` — Elevay a déjà le sien

## Phase 6 — API routes (30 min)

Copier depuis brand-intel/src/app/api/ :

- [ ] `brand-profile/route.ts` → `src/app/api/brand-profile/route.ts`
- [ ] `agents/bmi/bpi-01/route.ts` → `src/app/api/agents/bmi/bpi-01/route.ts`
- [ ] `agents/bmi/mts-02/route.ts` → `src/app/api/agents/bmi/mts-02/route.ts`
- [ ] `agents/bmi/cia-03/route.ts` → `src/app/api/agents/bmi/cia-03/route.ts`
- [ ] `agents/bmi/dashboard/route.ts` → `src/app/api/agents/bmi/dashboard/route.ts`
- [ ] `auth/social/connect/route.ts`
- [ ] `auth/social/callback/route.ts`
- [ ] `auth/social/disconnect/route.ts`
- [ ] Renommer les paths si collision avec routes Elevay (voir question 4)
- [ ] Vérifier tous les imports (`@/generated/prisma` vs `@prisma/client`, `WORKSPACE_ID` vs session)

## Phase 7 — Agents (15 min — pur copier-coller)

Copier depuis brand-intel/src/agents/ :

- [ ] `_shared/**` (6 fichiers)
- [ ] `bpi-01/**` (index, prompt, scoring, types, 8 modules)
- [ ] `mts-02/**` (index, prompt, scoring, types, 5 modules)
- [ ] `cia-03/**` (index, prompt, scoring, types, 6 modules)

Aucune collision attendue, le dossier `src/agents/` est nouveau. `pnpm typecheck` après la copie doit passer.

## Phase 8 — UI (45 min)

### Design system

- [ ] Merger `tailwind.config.ts` (voir `14-ui-design-system.md`)
- [ ] Merger `src/app/globals.css` : CSS variables light + dark, animations
- [ ] Polices Public Sans + Geist Mono dans le layout racine ou maintenir celles d'Elevay (question 9)
- [ ] `components.json` : vérifier style `base-nova` vs style Elevay (question 8)

### Composants

- [ ] Décider stratégie `src/components/ui/*` : garder Elevay (A), namespacer (B), migrer (C)
- [ ] Copier `src/components/brand-intel/**` (10 fichiers — voir `15-ui-components.md`)
- [ ] **Ne PAS copier** `src/components/theme-provider.tsx` et `theme-toggle.tsx` si Elevay a déjà l'équivalent
- [ ] **Ne PAS copier** `src/components/app-sidebar.tsx` — fusionner avec sidebar Elevay (ajout d'un lien "Brand Intel")

### Page

- [ ] Créer `src/app/(dashboard)/brand-intel/page.tsx` :
  ```tsx
  import { BrandIntelDashboard } from '@/components/brand-intel/BrandIntelDashboard'
  export default function Page() { return <BrandIntelDashboard /> }
  ```
- [ ] Ajouter lien sidebar Elevay → `/brand-intel`
- [ ] Si `<Toaster />` pas déjà monté dans Elevay, l'ajouter au layout racine

## Phase 9 — Vérification (30 min)

Voir `18-testing-and-verification.md` pour le détail des tests.

- [ ] `pnpm typecheck` → 0 erreurs
- [ ] `pnpm lint` → 0 erreurs bloquantes
- [ ] `pnpm dev` → démarre sans crash (`env.ts` Zod passe)
- [ ] Navigation `/brand-intel` → dashboard affiché (ou spinner + mock data)
- [ ] Créer un BrandProfile via le formulaire → success toast
- [ ] Lancer "Run all agents" → 3 agents progressent, données affichées dans les tabs
- [ ] Connect Facebook OAuth → redirect → callback → toast + données sociales enrichies au prochain run
- [ ] Vérifier en DB (Prisma Studio) : un `BrandProfile` + 3 `AgentRun` créés

## Ordre critique des dépendances

```
Phase 0 (questions)
  ↓
Phase 1 (deps) ──── Phase 2 (env) ──┐
                                     ↓
                              Phase 3 (prisma)
                                     ↓
                              Phase 4 (lib)
                                     ↓
Phase 5 (auth) ─────── Phase 7 (agents) ─── Phase 6 (API)
                                                   ↓
                                            Phase 8 (UI)
                                                   ↓
                                            Phase 9 (tests)
```

**Les agents (Phase 7) sont dépendants de `src/agents/_shared/llm.ts` et `composio.ts` qui eux-mêmes importent `@/lib/env`**. Donc `env.ts` doit avoir tous les champs validés avant que `pnpm typecheck` ne passe sur les agents.

## Temps total estimé

**~3h30 à 5h** selon l'état d'Elevay (shadcn existant, divergence Prisma, divergence Next version). Le plus long est la Phase 8 (UI) si collisions shadcn.

## Quick rollback

À tout moment, si ça tourne mal :
```bash
git checkout main                 # revenir à l'état initial
git branch -D feat/brand-intel-integration  # détruire la branche
pnpm prisma migrate resolve --rolled-back add_brand_intel_agents  # si besoin côté DB
```
