# 02 — Structure de projet et correspondance

## Arbre brand-intello (chemins utiles uniquement)

Tout se trouve sous `brand-intel/` (sous-dossier du repo `brand-intello`). Tous les chemins ci-dessous partent de `brand-intel/`.

```
brand-intel/
├── middleware.ts                          ⚠️ à FUSIONNER avec le middleware d'Elevay
├── tailwind.config.ts                     ⚠️ à FUSIONNER avec celui d'Elevay
├── components.json                        ⚠️ à FUSIONNER si shadcn déjà configuré dans Elevay
├── prisma.config.ts                       📝 config Prisma 7
├── tsconfig.json                          ℹ️ référence pour le path alias @/*
├── next.config.ts                         ℹ️ vide (valeurs par défaut Next)
├── eslint.config.mjs                      ℹ️ flat config v9
├── postcss.config.js                      ℹ️ tailwind + autoprefixer
├── vitest.config.ts                       ℹ️ jsdom + alias @/
├── prisma/
│   ├── schema.prisma                      🔀 à MERGER avec celui d'Elevay (voir 04)
│   └── migrations/
│       └── 20260404201856_init/           ℹ️ migration de référence
├── public/
│   └── logo.jpg                           ✅ à copier si tu veux garder le branding
└── src/
    ├── app/
    │   ├── layout.tsx                     ⚠️ extraire : polices + ThemeProvider + Toaster
    │   ├── globals.css                    🔀 à MERGER avec globals.css d'Elevay
    │   ├── page.tsx                       ℹ️ home placeholder
    │   ├── (auth)/
    │   │   └── login/page.tsx             ⚠️ seulement si Elevay n'a pas déjà de login
    │   ├── (dashboard)/
    │   │   ├── layout.tsx                 ✅ à adapter (sidebar Elevay)
    │   │   └── brand-intel/page.tsx       ✅ monte <BrandIntelDashboard />
    │   └── api/
    │       ├── auth/
    │       │   ├── [...all]/route.ts      ⚠️ handler Better Auth — Elevay a déjà le sien
    │       │   └── social/
    │       │       ├── connect/route.ts   ✅ à copier
    │       │       ├── callback/route.ts  ✅ à copier
    │       │       └── disconnect/route.ts✅ à copier
    │       ├── brand-profile/route.ts     ✅ à copier
    │       └── agents/bmi/
    │           ├── bpi-01/route.ts        ✅ à copier
    │           ├── mts-02/route.ts        ✅ à copier
    │           ├── cia-03/route.ts        ✅ à copier
    │           └── dashboard/route.ts     ✅ à copier
    ├── agents/                            ✅ TOUT à copier (aucun risque de collision)
    │   ├── _shared/
    │   │   ├── llm.ts
    │   │   ├── types.ts
    │   │   ├── composio.ts                (externes APIs : SERP, GNews, YouTube, DFS, Firecrawl)
    │   │   ├── apify.ts
    │   │   ├── social-oauth.ts            (Composio action wrappers)
    │   │   └── utils.ts                   (sanitize, etc.)
    │   ├── bpi-01/
    │   │   ├── index.ts
    │   │   ├── prompt.ts
    │   │   ├── scoring.ts
    │   │   ├── types.ts
    │   │   └── modules/
    │   │       ├── serp.ts
    │   │       ├── press.ts
    │   │       ├── youtube.ts
    │   │       ├── social.ts
    │   │       ├── seo.ts
    │   │       ├── benchmark.ts
    │   │       ├── google-maps.ts
    │   │       └── trustpilot.ts
    │   ├── mts-02/
    │   │   ├── index.ts
    │   │   ├── prompt.ts
    │   │   ├── scoring.ts
    │   │   ├── types.ts
    │   │   └── modules/
    │   │       ├── trends.ts
    │   │       ├── content.ts
    │   │       ├── competitive.ts
    │   │       ├── social-listening.ts
    │   │       └── synthesis.ts
    │   └── cia-03/
    │       ├── index.ts
    │       ├── prompt.ts
    │       ├── scoring.ts
    │       ├── types.ts
    │       └── modules/
    │           ├── product-messaging.ts
    │           ├── seo-acquisition.ts
    │           ├── social-media.ts
    │           ├── content.ts
    │           ├── benchmark.ts
    │           └── recommendations.ts
    ├── components/
    │   ├── ui/                            ⚠️ shadcn primitives — voir 15
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── badge.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── select.tsx
    │   │   └── tabs.tsx
    │   ├── brand-intel/                   ✅ TOUT à copier (domaine isolé)
    │   │   ├── BrandIntelDashboard.tsx    (orchestrateur)
    │   │   ├── OverviewTab.tsx
    │   │   ├── AuditTab.tsx
    │   │   ├── TrendsTab.tsx
    │   │   ├── CompetitiveTab.tsx
    │   │   ├── AgentProgress.tsx
    │   │   ├── BrandProfileForm.tsx
    │   │   ├── TabNav.tsx
    │   │   └── mockDashboardData.ts
    │   ├── app-sidebar.tsx                ⚠️ Elevay a déjà sa sidebar — à fusionner
    │   ├── theme-provider.tsx             ⚠️ Elevay a peut-être déjà next-themes
    │   └── theme-toggle.tsx
    └── lib/
        ├── auth.ts                        🔀 config Better Auth — voir 05
        ├── auth-client.ts                 🔀 client Better Auth
        ├── db.ts                          🔀 client Prisma singleton — voir 04
        ├── env.ts                         🔀 Zod env — à FUSIONNER
        ├── sse.ts                         ✅ à copier tel quel
        ├── design-tokens.ts               ✅ à copier (sauf collision de noms)
        ├── constants.ts                   ✅ WORKSPACE_ID (voir question 3)
        └── utils.ts                       ⚠️ cn helper — Elevay a déjà le sien
```

## Légende

- ✅ **À copier tel quel** — aucun risque de collision, garde le même chemin dans Elevay.
- ⚠️ **À adapter / décision** — collision possible avec Elevay, voir la doc dédiée.
- 🔀 **À merger** — fichier existe dans les deux, fusionner le contenu.
- 📝 **À copier ou à régénérer** — peut être copié mais souvent préférable de régénérer.
- ℹ️ **Référence** — ne pas copier tel quel, utiliser comme modèle.

## Correspondance brand-intello → Elevay (chemins cibles)

Hypothèse : Elevay a la même racine `src/` et le même alias `@/*`.

| brand-intello | Elevay (cible) |
|---------------|----------------|
| `src/agents/**` | `src/agents/**` (nouveau dossier) |
| `src/components/brand-intel/**` | `src/components/brand-intel/**` (nouveau) |
| `src/components/ui/*` | `src/components/ui/*` (voir 15 pour collisions shadcn) |
| `src/app/api/agents/bmi/**` | `src/app/api/agents/bmi/**` (nouveau) |
| `src/app/api/brand-profile/route.ts` | `src/app/api/brand-profile/route.ts` (nouveau) |
| `src/app/api/auth/social/**` | `src/app/api/auth/social/**` (nouveau) |
| `src/app/(dashboard)/brand-intel/page.tsx` | à loger dans le groupe dashboard d'Elevay |
| `src/lib/sse.ts` | `src/lib/sse.ts` (nouveau) |
| `src/lib/design-tokens.ts` | `src/lib/design-tokens.ts` (nouveau) |
| `src/lib/constants.ts` | **merger** : ajouter `WORKSPACE_ID` à tes constants existantes |
| `src/lib/env.ts` | **merger** : ajouter les nouvelles clés au schema Zod d'Elevay |
| `src/lib/db.ts` | **vérifier** : Elevay utilise déjà Prisma singleton, garder sa version |
| `src/lib/auth.ts` | **vérifier** : voir `05-better-auth-and-middleware.md` |
| `prisma/schema.prisma` | **merger** : voir `04-prisma-schema-merge.md` |
| `middleware.ts` | **merger** : ajouter `/brand-intel/:path*` au matcher |
| `tailwind.config.ts` | **merger** : ajouter colors, keyframes, polices |
| `src/app/globals.css` | **merger** : ajouter CSS variables et animations |

## Alias TypeScript

`tsconfig.json` de brand-intello définit :
```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Elevay a normalement le même alias. Vérifier, sinon tous les imports `@/...` casseront.

## Prisma generator path non standard

⚠️ Dans brand-intello, tous les imports Prisma sont :
```ts
import { PrismaClient } from '@/generated/prisma/client'
// ou
import type { BrandProfile } from '@/generated/prisma'
```

Si Elevay utilise le path par défaut `@prisma/client`, deux choix :

1. **Adopter le path custom dans Elevay** : modifier `generator client { output = "../src/generated/prisma" }` + réécrire tous les imports.
2. **Adapter brand-intello au path standard** : supprimer la ligne `output`, et faire un find & replace dans les fichiers copiés (`@/generated/prisma` → `@prisma/client`).

**Recommandation** : choix 2, plus simple, moins invasif pour Elevay.

## Fichiers à créer dans Elevay (nouveaux)

Nombre approximatif : **~70 fichiers** à copier. La majorité dans `src/agents/**` (~40 fichiers) et `src/components/brand-intel/**` (~10 fichiers). Le reste est config + API routes + lib.
