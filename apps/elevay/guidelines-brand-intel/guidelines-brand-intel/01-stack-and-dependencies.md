# 01 — Stack et dépendances

## Versions exactes (brand-intello)

Source : `brand-intel/package.json`

| Package | Version | Rôle |
|---------|---------|------|
| `next` | **16.2.2** | Framework (⚠️ breaking changes vs 15) |
| `react` / `react-dom` | **19.2.4** | UI lib |
| `typescript` | `^5` | Types |
| `prisma` / `@prisma/client` | **`^7.6.0`** | ORM |
| `@prisma/adapter-pg` | `^7.6.0` | Adapter Postgres |
| `pg` | `^8.20.0` | Driver Postgres |
| `better-auth` | `^1.5.6` | Auth |
| `@anthropic-ai/sdk` | `^0.82.0` | Claude |
| `zod` | `^4.3.6` | Validation |
| `tailwindcss` | `^3.4.19` | CSS |
| `tailwindcss-animate` | `^1.0.7` | Animations utilitaires |
| `tw-animate-css` | `^1.4.0` | Animations CSS extras |
| `@base-ui/react` | `^1.3.0` | Primitives headless (sous shadcn `base-nova`) |
| `shadcn` | `^4.1.2` | CLI shadcn |
| `class-variance-authority` | `^0.7.1` | Variants composants |
| `clsx` / `tailwind-merge` | `^2.1.1` / `^3.5.0` | Classnames |
| `lucide-react` | `^1.7.0` | Icônes shadcn |
| `@phosphor-icons/react` | `^2.1.10` | Icônes domaine |
| `recharts` | `^3.8.1` | Charts |
| `sonner` | `^2.0.7` | Toasts |
| `next-themes` | `^0.4.6` | Dark mode |
| `composio-core` | `^0.5.39` | OAuth social (Facebook/Instagram) |
| `apify-client` | `^2.22.3` | Fallback scraping |
| `autoprefixer` / `postcss` | `^10.4.27` / `^8.5.8` | Build CSS |

### Dev

| Package | Version |
|---------|---------|
| `vitest` | `^4.1.2` |
| `@vitest/coverage-v8` | `^4.1.2` |
| `@vitejs/plugin-react` | `^6.0.1` |
| `@testing-library/react` | `^16.3.2` |
| `jsdom` | `^29.0.1` |
| `eslint` / `eslint-config-next` | `^9` / `16.2.2` |
| `@types/node` / `@types/pg` | `^20` / `^8.20.0` |
| `@types/react` / `@types/react-dom` | `^19` / `^19` |
| `dotenv` | `^17.4.0` |

## Scripts

```json
{
  "dev":       "next dev",
  "build":     "next build",
  "start":     "next start",
  "lint":      "eslint",
  "typecheck": "tsc --noEmit",
  "test":      "vitest run",
  "test:watch":"vitest"
}
```

## Package manager

`pnpm` (voir `.npmrc` + `pnpm-workspace.yaml` dans brand-intello). Config notable :
```json
"pnpm": {
  "onlyBuiltDependencies": ["@prisma/engines", "prisma"]
}
```

## Ce qui risque de diverger dans Elevay

1. **Next.js version** — brand-intello est en **16.2.2**, avec breaking changes (voir `brand-intel/AGENTS.md`). Si Elevay est en 14/15, prévoir l'upgrade ou des adaptations sur les route handlers. Voir question 1 de `19-open-questions.md`.
2. **React 19** — Si Elevay est en React 18, certains composants (Server Actions, `use`, Suspense boundaries) peuvent nécessiter adaptation.
3. **Prisma 7** — Version majeure récente. Le générateur utilise `provider = "prisma-client"` (pas `prisma-client-js`) avec un `output` custom :
   ```prisma
   generator client {
     provider = "prisma-client"
     output   = "../src/generated/prisma"
   }
   ```
   **Si Elevay est en Prisma 5 ou 6**, soit tu upgrades, soit tu gardes l'ancien générateur (`prisma-client-js`) et tu réécris tous les imports `@/generated/prisma` → `@prisma/client`.
4. **Tailwind 3.4** — Pas de Tailwind 4 dans brand-intello. Si Elevay est en Tailwind 4 (CSS-first), la config `tailwind.config.ts` est à réadapter au format `@theme` / `@plugin`.
5. **shadcn style `base-nova`** — voir `brand-intel/components.json`. Si Elevay utilise le style `default` (New York / Default), les primitives `button.tsx`, `card.tsx` etc. divergent. Voir `15-ui-components.md`.

## Dépendances à ajouter à Elevay

Hypothèse : Elevay a déjà `next`, `react`, `prisma`, `better-auth`, `zod`, `tailwindcss`, `@prisma/client`. À ajouter (si absents) :

```bash
# Agents IA
pnpm add @anthropic-ai/sdk @prisma/adapter-pg pg
# OAuth social
pnpm add composio-core apify-client
# UI domaine
pnpm add @base-ui/react @phosphor-icons/react recharts sonner next-themes
pnpm add class-variance-authority clsx tailwind-merge tailwindcss-animate tw-animate-css
# Icons shadcn (si pas déjà là)
pnpm add lucide-react
# Tests (si pas déjà)
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react @testing-library/react jsdom dotenv
```

## Commandes à connaître

```bash
pnpm dev              # localhost:3000
pnpm build
pnpm typecheck        # valider les types TS
pnpm lint
pnpm test             # Vitest

# Prisma
pnpm prisma generate            # régénérer le client (vers src/generated/prisma)
pnpm prisma migrate dev --name add_brand_intel_agents
pnpm prisma migrate deploy      # production
pnpm prisma studio              # UI DB
```

## Node.js

Pas de champ `engines` figé dans le `package.json` de brand-intello, mais Next 16 + React 19 exigent **Node 18.18+** (recommandé Node 20 LTS ou 22 LTS).

## ESLint flat config

`eslint.config.mjs` en **flat config** (ESLint v9, pas `.eslintrc.*`). Si Elevay est en `.eslintrc.json`, il faudra soit migrer Elevay en flat config, soit back-porter les règles de brand-intello en legacy config.
