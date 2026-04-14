# 15 — Composants UI — inventaire et collisions

## Deux catégories de composants

### 1. `src/components/ui/` — primitives shadcn

Installées via `npx shadcn@latest add <component>` avec style **`base-nova`**. Implémentées sur `@base-ui/react` (pas Radix).

Liste :
- `button.tsx`
- `card.tsx`
- `badge.tsx`
- `input.tsx`
- `label.tsx`
- `select.tsx`
- `tabs.tsx`

**Pattern CVA** : chaque primitive utilise `class-variance-authority` pour ses variants, avec `cn()` helper pour merge des classNames.

### 2. `src/components/brand-intel/` — composants domaine

Construits à partir des primitives `ui/*` + logique métier brand. Aucun risque de collision avec Elevay (dossier isolé).

Liste :
- `BrandIntelDashboard.tsx` — orchestrateur (340 lignes, voir 16-dashboard-orchestration.md)
- `OverviewTab.tsx` — vue d'ensemble cross-agent
- `AuditTab.tsx` — résultats BPI-01 (Recharts bar charts, axis diagnostics, priorities 90j)
- `TrendsTab.tsx` — résultats MTS-02 (trending topics, roadmap 30j, saturation map)
- `CompetitiveTab.tsx` — résultats CIA-03 (scores leaderboard, strategic zones, threats/opportunities)
- `AgentProgress.tsx` — cards d'état des 3 agents (idle/running/done/error + spinner + message SSE)
- `BrandProfileForm.tsx` — formulaire brand + concurrents + OAuth social
- `TabNav.tsx` — tab switcher horizontal
- `mockDashboardData.ts` — jeu de données de démo utilisé si aucun run n'existe

### 3. Composants globaux

- `src/components/app-sidebar.tsx` — sidebar applicative (navigation)
- `src/components/theme-provider.tsx` — wrapper `next-themes`
- `src/components/theme-toggle.tsx` — bouton light/dark

## Stratégie anti-collision pour `src/components/ui/`

⚠️ **Scenario problématique** : Elevay a déjà shadcn installé avec un style différent (`default`, `new-york`). Ses `button.tsx`, `card.tsx` etc. s'appuient sur Radix. Ceux de brand-intello s'appuient sur `@base-ui/react`. **Les deux ne peuvent pas coexister sous `src/components/ui/`**.

### Option A (recommandée) — Garder les primitives d'Elevay

Si Elevay a déjà un design system shadcn qui marche, **garder ses primitives**.

Dans les fichiers copiés de `src/components/brand-intel/*`, les imports :

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
```

→ vont automatiquement pointer sur les composants d'Elevay. Tant que les **props** sont compatibles (même signature `variant`, `size`, etc.), ça marchera.

**Points à vérifier** :
- Le `Button` d'Elevay supporte-t-il la prop `size="sm"` ? (oui en général)
- Le `Card`, `Input`, `Select`, `Tabs` d'Elevay ont-ils la même structure d'enfants ? (ex: `<Tabs><TabsList><TabsTrigger>...</TabsTrigger></TabsList></Tabs>`)
- Si divergence mineure, adapter les imports dans les composants brand-intel.

### Option B — Namespacer les primitives brand-intello

Créer `src/components/ui-brand-intel/` et y mettre les 7 primitives copiées. Puis find & replace dans les composants `brand-intel/*` :

```bash
# Dans src/components/brand-intel/**/*.tsx
# Remplacer :
@/components/ui/button  →  @/components/ui-brand-intel/button
@/components/ui/card    →  @/components/ui-brand-intel/card
# ...etc
```

**Avantage** : pas de conflit, style `base-nova` isolé.
**Inconvénient** : duplication, deux design systems dans Elevay.

### Option C — Migrer Elevay vers `base-nova`

Remplacer toutes les primitives d'Elevay par celles de brand-intello. Invasif, risque de casser l'UI existante d'Elevay.

**Recommandation** : Option A d'abord, fallback sur B si conflits (props qui divergent). Voir question 8 de `19-open-questions.md`.

## Dépendances inter-composants

```
BrandIntelDashboard
├── AgentProgress
│   └── ui/Button, Phosphor icons
├── TabNav
│   └── ui/Tabs (optionnel, peut être custom)
├── OverviewTab
│   ├── ui/Card, ui/Badge
│   └── design-tokens (URGENCY_TOKENS, ZONE_TOKENS, AGENT_TOKENS)
├── AuditTab
│   ├── ui/Card, ui/Badge
│   ├── Recharts (BarChart, Bar, XAxis, YAxis, ResponsiveContainer)
│   └── design-tokens (getScoreColor, getDeltaColor, URGENCY_TOKENS)
├── TrendsTab
│   ├── ui/Card, ui/Badge
│   └── design-tokens (AGENT_TOKENS)
├── CompetitiveTab
│   ├── ui/Card, ui/Badge
│   ├── Recharts
│   └── design-tokens (ZONE_TOKENS)
├── BrandProfileForm
│   ├── ui/Input, ui/Label, ui/Select, ui/Button
│   └── Phosphor icons, Facebook/Instagram OAuth buttons
├── ThemeToggle
│   └── next-themes, lucide/Sun, lucide/Moon
└── sonner (toast globale)
```

## Icônes

### Lucide (pour les primitives shadcn)

Installée via `lucide-react@^1.7.0`.

Note : shadcn standard utilise Lucide. brand-intello respecte cette convention dans ses primitives.

### Phosphor Icons (pour le domaine)

Installée via `@phosphor-icons/react@^2.1.10`.

Utilisée dans `BrandIntelDashboard.tsx` (ex: `GearSix`), `AgentProgress`, `BrandProfileForm`.

```tsx
import { GearSix, FacebookLogo, InstagramLogo } from '@phosphor-icons/react'
```

Les 2 librairies cohabitent sans conflit — elles exportent des composants différents.

## Recharts

Installé en `^3.8.1`. Usage dans `AuditTab` et `CompetitiveTab` :

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={scoresData}>
    <XAxis dataKey="axis" />
    <YAxis domain={[0, 100]} />
    <Tooltip />
    <Bar dataKey="score">
      {scoresData.map((entry, i) => (
        <Cell key={i} fill={getScoreColor(entry.score)} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

Si Elevay utilise déjà Recharts, OK. Sinon, ajouter en dépendance.

## Sonner (toasts)

```tsx
// Dans layout.tsx (root ou dashboard)
import { Toaster } from 'sonner'
// ...
<Toaster position="top-right" richColors />

// Dans les composants
import { toast } from 'sonner'
toast.success('Profile saved')
toast.error('Connection failed')
```

Si Elevay a déjà un système de toasts (Sonner ou autre), ne pas dupliquer le `<Toaster />` — garder celui d'Elevay.

## Helper `cn` (classname merger)

Fichier : `src/lib/utils.ts` (présent dans brand-intello, Elevay l'a sûrement déjà).

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Ne pas copier** — garder celui d'Elevay.

## Theme provider

Fichier : `src/components/theme-provider.tsx`

```tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

Si Elevay a déjà un `ThemeProvider` similaire (très probable), **utiliser celui d'Elevay**.

## Theme toggle

Fichier : `src/components/theme-toggle.tsx` — bouton sun/moon, monte/démonte safely (guard hydration).

Utilisé dans le header du dashboard. Si Elevay a son propre toggle, l'utiliser.

## App sidebar

Fichier : `src/components/app-sidebar.tsx` — sidebar applicative avec :
- Navigation items (Home, Brand Intel, Settings, etc.)
- Profil utilisateur en bas
- Theme toggle

⚠️ **Elevay a sûrement déjà sa sidebar**. Ne pas copier. Ajouter juste un item "Brand Intel" à la sidebar existante d'Elevay qui link vers `/brand-intel`.

## Checklist composants

- [ ] Décision prise : Option A / B / C pour `src/components/ui/*` (voir question 8)
- [ ] `src/components/brand-intel/**` copié (10 fichiers)
- [ ] Imports `@/components/ui/*` fonctionnent (pointent sur Elevay ou namespacés)
- [ ] Recharts installé
- [ ] Sonner installé + `<Toaster />` monté dans le layout
- [ ] `@phosphor-icons/react` installé
- [ ] Navigation Elevay : lien "Brand Intel" ajouté vers `/brand-intel`
- [ ] Page `src/app/(dashboard)/brand-intel/page.tsx` créée : `<BrandIntelDashboard />`
