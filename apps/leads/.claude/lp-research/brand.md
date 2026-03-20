# LeadSens Brand Charter

## Brand Positioning

**One-liner:** The AI agent that orchestrates your existing sales tools for automated outbound.

**Key differentiator:** BYOT (Bring Your Own Tools) — LeadSens doesn't replace your stack, it makes it work together.

**Personality:** Confident, precise, technical but accessible. Not corporate, not cute. Think: "staff engineer who also does sales."

## Colors

### Primary Palette (Gradient Mesh)
- **Teal:** `#17C3B2` / oklch(0.72 0.14 185) — trust, intelligence
- **Blue:** `#2C6BED` / oklch(0.55 0.22 264) — technology, reliability
- **Purple:** `#7C3AED` / oklch(0.49 0.27 285) — AI, premium

### Accent
- **Orange:** `#FF7A3D` — energy, action (used sparingly for CTAs)
- **Amber:** `#D97706` — warmth (mesh accent)

### Neutrals
- Use existing shadcn/ui theme tokens (oklch-based)
- Light: white bg, soft gray cards
- Dark: near-black bg, elevated cards

### Gradient Usage
- **Primary gradient:** `from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D]`
- **Apply to:** CTA buttons, hero text gradient, section accents
- **Mesh background:** existing `.bg-leadsens-mesh` class (4 radial gradients)
- **Glass cards:** `bg-card/80 backdrop-blur-sm border-border/60`

## Typography

### Marketing (landing, pricing)
- **Font:** DM Sans (Google Fonts) — modern, geometric, SaaS-standard
- **Scoped:** CSS variable `--font-dm-sans` on marketing wrapper only
- **Dashboard stays Geist** — no breaking changes

### Scale
- Hero headline: `text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight`
- Section headline: `text-3xl md:text-4xl font-bold tracking-tight`
- Body: `text-lg text-muted-foreground`
- Caption: `text-sm text-muted-foreground`
- Badge: `text-xs font-medium uppercase tracking-widest`

## Iconography
- **Style:** Outline (heroicons, 1.5px stroke) for features
- **Integration logos:** Real SVGs from `/public/` when available
- **Fallback:** Colored circle with first-letter initial

## Motion
- **Scroll reveal:** `translateY(24px) → 0`, opacity 0 → 1, cubic-bezier(0.16,1,0.3,1)
- **Stagger:** 100-150ms between sequential elements
- **Chat mockup:** Timed replay with typing indicators
- **Logo bar:** 30s infinite linear scroll
- **Counters:** Ease-out cubic over 2s
- **Hover:** `translateY(-1px)` + shadow lift (existing `.card-hover`)

## Photography / Imagery
- **No stock photos** — product screenshots and abstract gradients only
- **Chat mockup** is the hero image — shows the actual product experience
- **Integration logos** are the social proof imagery
