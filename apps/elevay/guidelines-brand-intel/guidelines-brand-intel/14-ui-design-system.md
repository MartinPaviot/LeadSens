# 14 — Design system (Tailwind + tokens + polices + globals.css)

## Stack UI

- **Tailwind CSS 3.4.19** avec CSS variables + plugin `tailwindcss-animate`
- **shadcn/ui** style `base-nova` (voir `components.json`)
- **Base UI (`@base-ui/react`)** comme primitives headless (équivalent Radix, utilisé par `base-nova`)
- **next-themes** pour dark mode class-based
- **Polices** : Public Sans (sans-serif) + Geist Mono (monospace) via Google Fonts
- **OKLCH color space** pour les tokens sémantiques

## Fichiers à fusionner dans Elevay

| Fichier brand-intello | Cible Elevay | Action |
|-----------------------|--------------|--------|
| `tailwind.config.ts` | `tailwind.config.ts` | **Merger** colors + keyframes + polices |
| `src/app/globals.css` | `src/app/globals.css` | **Merger** CSS variables + animations |
| `src/lib/design-tokens.ts` | `src/lib/design-tokens.ts` | **Copier** (nouveau) |
| `components.json` | `components.json` | Vérifier style `base-nova` |

## `tailwind.config.ts` — code complet

Source : `brand-intel/tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-public-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        background:  'var(--background)',
        foreground:  'var(--foreground)',
        primary:     { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary:   { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        accent:      { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        card:        { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        muted:       { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        border:  'var(--border)',
        input:   'var(--input)',
        ring:    'var(--ring)',
        sidebar: {
          DEFAULT:               'var(--sidebar)',
          foreground:            'var(--sidebar-foreground)',
          primary:               'var(--sidebar-primary)',
          'primary-foreground':  'var(--sidebar-primary-foreground)',
          accent:                'var(--sidebar-accent)',
          'accent-foreground':   'var(--sidebar-accent-foreground)',
          border:                'var(--sidebar-border)',
          ring:                  'var(--sidebar-ring)',
        },
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        teal:   '#17c3b2',
        orange: '#FF7A3D',
        blue:   '#2c6bed',
        cream:  '#FFF7ED',
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', xl: 'var(--radius-xl)', '2xl': 'var(--radius-2xl)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

### Règle de merge avec Tailwind d'Elevay

⚠️ **NE PAS remplacer** la config d'Elevay. Elevay a sûrement déjà des colors/fonts/plugins. Fusionner :

1. **Garder** la config Elevay.
2. **Ajouter** les CSS variables brand-intello dans `theme.extend.colors` :
   - `primary`, `secondary`, `accent`, `card`, `muted`, `destructive`, `sidebar`, `chart-1..5` (toutes en CSS vars)
   - Les couleurs hardcodées brand (`teal`, `orange`, `blue`, `cream`)
3. **Ajouter** les radii (`sm`, `md`, `lg`, `xl`, `2xl`) en CSS vars.
4. **Ajouter** les fontFamily `sans` et `mono` (si Elevay n'a pas déjà les mêmes).
5. **Ajouter** le keyframe `fade-in-up` et son animation.
6. **Ajouter** `tailwindcss-animate` dans `plugins` (si absent).

Si Elevay définit déjà `primary` avec une autre couleur, **il y aura conflit** : les composants shadcn d'Elevay et ceux copiés ne ressembleront pas aux mêmes. Voir question 10 de `19-open-questions.md`.

## `src/app/globals.css` — à fusionner

Source : `brand-intel/src/app/globals.css` (160 lignes)

### Variables CSS root (light mode)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand colors */
    --primary: #17c3b2;
    --primary-foreground: #ffffff;
    --secondary: #FF7A3D;
    --secondary-foreground: #ffffff;
    --accent: #2c6bed;
    --accent-foreground: #ffffff;

    /* Surfaces */
    --background: #FFF7ED;
    --foreground: oklch(0.141 0.005 285.823);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.141 0.005 285.823);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.141 0.005 285.823);

    /* Semantic */
    --muted: oklch(0.967 0.001 286.375);
    --muted-foreground: oklch(0.552 0.016 285.938);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: #ffffff;

    /* Chrome */
    --border: oklch(0.92 0.004 286.32);
    --input: oklch(0.92 0.004 286.32);
    --ring: oklch(0.705 0.015 286.067);

    /* Radius */
    --radius: 0.625rem;
    --radius-sm:  calc(var(--radius) - 4px);
    --radius-md:  calc(var(--radius) - 2px);
    --radius-lg:  var(--radius);
    --radius-xl:  calc(var(--radius) + 4px);
    --radius-2xl: calc(var(--radius) + 8px);

    /* Sidebar + Charts : voir globals.css complet */
  }

  .dark {
    --primary: #3be8d7;
    --primary-foreground: #0d1117;
    /* ... voir globals.css complet ... */
    --background: #140b00;
    /* ... */
  }

  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}

/* Animations */
@keyframes fade-in-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-up   { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes thinking-spin { to { transform: rotate(360deg); } }

.animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }
.animate-slide-up   { animation: slide-up   0.3s ease-out forwards; }
.thinking-spinner   { animation: thinking-spin 0.8s linear infinite; }

/* Scrollbar thin (custom) + bg-elevay-mesh (radial gradients) : voir fichier complet */

@media (prefers-reduced-motion: reduce) {
  .animate-fade-in-up { animation: none; }
  .animate-slide-up   { animation: none; }
}
```

### Classe utilitaire clé : `.bg-elevay-mesh`

Background mesh multi-gradients radiaux (fixed attachment) — utilisé sur le `<body>` ou conteneur principal pour donner l'effet signature :

```css
.bg-elevay-mesh {
  background:
    radial-gradient(ellipse 80% 60% at 15% 20%, rgba(23,195,178,0.18) 0%, transparent 70%),
    radial-gradient(ellipse 70% 50% at 75% 15%, rgba(255,122,61,0.14)  0%, transparent 65%),
    radial-gradient(ellipse 60% 55% at 60% 70%, rgba(44,107,237,0.12)  0%, transparent 60%),
    radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255,247,237,0.30) 0%, transparent 80%);
  background-attachment: fixed;
}
```

Version `.dark` dans le fichier complet.

## `src/lib/design-tokens.ts` — à copier

Source : `brand-intel/src/lib/design-tokens.ts` (49 lignes)

```ts
export const BRAND = {
  teal:   '#17c3b2',
  orange: '#FF7A3D',
  blue:   '#2c6bed',
  cream:  '#FFF7ED',
  textPrimary:   '#1a1a1a',
  textSecondary: '#6b6b6b',
  border:        'rgba(0,0,0,0.08)',
} as const

export const GRADIENTS = {
  button:    'linear-gradient(90deg, #17c3b2, #FF7A3D)',
  cta:       'linear-gradient(135deg, #17c3b2, #2c6bed)',
  trilogy:   'linear-gradient(160deg, #FFF7ED, #ffffff)',
  cardHover: 'linear-gradient(135deg, rgba(23,195,178,0.06), rgba(44,107,237,0.06))',
  full:      'linear-gradient(135deg, #17c3b2, #FF7A3D, #2c6bed)',
} as const

export function getScoreColor(score: number): string {
  if (score >= 70) return '#17c3b2'  // teal
  if (score >= 50) return '#FF7A3D'  // orange
  return '#E24B4A'                    // rouge
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return '#17c3b2'
  if (delta < 0) return '#E24B4A'
  return '#6b6b6b'
}

export const URGENCY_TOKENS = {
  'Urgent':    { bg: '#FFECE8', color: '#C0390E' },
  'Mid-term':  { bg: '#FFF3DC', color: '#A05C00' },
  'Quick win': { bg: '#E6F9F5', color: '#0A7A68' },
} as const

export const ZONE_TOKENS = {
  red:       { label: 'Red Zone',    bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200' },
  saturated: { label: 'Saturated',   bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  neutral:   { label: 'Neutral',     bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-200' },
  green:     { label: 'Opportunity', bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200' },
} as const

export const AGENT_TOKENS = {
  'BPI-01': { label: 'Online Presence',     bg: 'bg-blue-50',   text: 'text-blue-700',   dot: '#2c6bed' },
  'MTS-02': { label: 'Trends',              bg: 'bg-purple-50', text: 'text-purple-700', dot: '#7c3aed' },
  'CIA-03': { label: 'Competitive Analysis', bg: 'bg-orange-50', text: 'text-orange-700', dot: '#FF7A3D' },
} as const
```

## Polices dans `layout.tsx`

À intégrer dans le layout racine (ou de dashboard) d'Elevay :

```tsx
import { Public_Sans, Geist_Mono } from 'next/font/google'

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', weight: ['400','500','600','700'] })
const geistMono  = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

Si Elevay a déjà des polices chargées, décider :
- **Garder les polices d'Elevay** : ajuster `tailwind.config.ts` pour pointer vers les bonnes CSS variables d'Elevay.
- **Adopter Public Sans + Geist Mono** : remplacer les polices d'Elevay (invasif).

Voir question 9 de `19-open-questions.md`.

## `components.json` (shadcn CLI)

Source : `brand-intel/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle"
}
```

⚠️ **`style: "base-nova"`** — c'est un style shadcn qui s'appuie sur `@base-ui/react` (pas Radix). Si Elevay utilise `style: "default"` ou `"new-york"` (Radix-based), les composants copiés de `src/components/ui/*` ne marcheront pas directement. Voir `15-ui-components.md`.

## Checklist design system

- [ ] Tailwind colors fusionnés (CSS vars + brand hardcoded)
- [ ] `tailwindcss-animate` installé + plugin ajouté
- [ ] Keyframe `fade-in-up` et classes `.animate-*` présents
- [ ] CSS vars root + `.dark` présentes dans `globals.css`
- [ ] Public Sans + Geist Mono chargés (ou équivalent Elevay)
- [ ] `design-tokens.ts` copié
- [ ] Classe `.bg-elevay-mesh` disponible
- [ ] `components.json` compatible (style `base-nova` ou décision de migration)
