# CLAUDE.md — Elevay

> Ce fichier est lu par Claude Code quand on travaille dans `apps/elevay/`.
> Pour le contexte global du monorepo, voir le `CLAUDE.md` racine.

---

## 1. Projet

**Elevay** — Assistant IA marketing conversationnel. Aide les marketeurs avec : content strategy, copywriting, campaign planning, social media, email marketing, brand positioning.

Elevay est une app **indépendante** dans le monorepo LeadSens. Elle partage la base de données (via `@leadsens/db`) mais a son propre code, ses propres routes, et ses propres agents.

---

## 2. Stack

| Composant | Choix |
|-----------|-------|
| Framework | Next.js 15 App Router (Turbopack) |
| Language | TypeScript strict |
| CSS | Tailwind CSS 4 |
| UI | shadcn/ui + Radix |
| Chat UI | assistant-ui |
| Auth | Better Auth (shared config) |
| DB | Prisma 6 + PostgreSQL (Neon) via `@leadsens/db` |
| API | tRPC + TanStack Query |
| LLM | Mistral Large (pour l'instant) |
| Validation | Zod |
| Port | 3001 |

---

## 3. Structure

```
apps/elevay/src/
├── app/
│   ├── (auth)/              # Login + Signup
│   ├── (dashboard)/chat/    # Chat principal
│   ├── api/
│   │   ├── agents/chat/     # SSE streaming (Mistral Large)
│   │   ├── auth/            # Better Auth
│   │   └── trpc/            # tRPC handler
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── chat/                # Chat UI (assistant-ui based)
│   └── ui/                  # shadcn/ui components
├── hooks/
├── lib/                     # Auth, Prisma, SSE, tRPC client, utils
├── server/trpc/             # tRPC (conversation router)
└── middleware.ts             # Auth middleware
```

---

## 4. État actuel

### Ce qui existe
- Auth complète (login/signup + Google OAuth)
- Chat streaming SSE avec Mistral Large
- Gestion des conversations (create, list, switch, rename)
- UI chat complète (assistant-ui, sidebar, theme toggle)
- System prompt basique (marketing assistant personality)

### Ce qui est à construire
- **Agents spécialisés** : chaque domaine marketing = un agent avec son propre prompt + tools
- **Tool calling** : Mistral supporte le tool calling, pas encore implémenté côté Elevay
- **Multi-agent routing** : router vers le bon agent selon la demande
- Intégrations marketing (analytics, social media APIs, etc.)

---

## 5. Conventions

1. **TypeScript strict** — zéro `any`, zéro `as any`
2. **Zod** sur tous les inputs (routes API, tRPC, LLM outputs)
3. **SSE streaming** pour le chat (pattern dans `src/app/api/agents/chat/route.ts`)
4. **Conventional Commits** : `feat(elevay):`, `fix(elevay):`, `refactor(elevay):`
5. **Imports** : `@/` = `apps/elevay/src/`, `@leadsens/db` = shared Prisma
6. **Pas de `console.log`** en production
7. **Typecheck avant commit** : `pnpm --filter @leadsens/elevay typecheck`

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
- Tables communes : `User`, `Workspace`, `Conversation`, `Message`, `Session`, `Account`

### Indépendant (apps/elevay/ only)
- Routes API, server logic, agents, tools
- Components chat (copiés, pas partagés — trop couplés)
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

### Prisma : comment ajouter une table pour Elevay
1. **Parles-en d'abord à Martin** — le schema est partagé, une erreur casse les 2 apps
2. Préfixe tes tables Elevay : `ElevayAgent`, `ElevayTemplate`, etc.
3. Crée une branche `feat/elevay-*`, push, et ouvre une PR
4. Martin review le changement schema → merge

### Workflow git obligatoire
1. **Jamais push sur main** — toujours une branche `feat/elevay-*`
2. Ouvre une PR → si ça touche UNIQUEMENT `apps/elevay/`, merge libre
3. Si ça touche `packages/db/` ou autre → Martin doit review (CODEOWNERS)

---

## 9. Fichiers clés

| Quoi | Où |
|------|-----|
| Chat API (SSE + LLM) | `src/app/api/agents/chat/route.ts` |
| Chat UI | `src/components/chat/` |
| tRPC router | `src/server/trpc/router.ts` |
| Conversation CRUD | `src/server/trpc/routers/conversation.ts` |
| Auth config | `src/lib/auth.ts` |
| Prisma wrapper | `src/lib/prisma.ts` |
| SSE utilities | `src/lib/sse.ts` |
| Middleware | `src/middleware.ts` |
| Shared DB schema | `../../packages/db/prisma/schema.prisma` |
