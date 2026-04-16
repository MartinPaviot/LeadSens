# Elevay — Project Prompt

> Ce fichier decrit le projet Elevay pour qu'un LLM comprenne l'environnement, la stack, la charte graphique, le front-end, le back-end, et les agents implementes.

---

## 1. Vue d'ensemble

### Le monorepo LeadSens

LeadSens est un monorepo pnpm avec deux applications et deux packages partages :

```
LeadSens-1/
├── apps/
│   ├── elevay/          ← Cette app (Brand Intelligence, port 3001)
│   └── leads/           ← LeadSens prospection B2B (port 3000)
├── packages/
│   ├── db/              ← Prisma schema + client PostgreSQL (Neon)
│   └── ui/              ← Composants shadcn/ui + chat primitives
├── docs/                ← STRATEGY.md, specs techniques
├── pnpm-workspace.yaml
└── CLAUDE.md            ← Instructions pour LeadSens (pas Elevay)
```

### Elevay vs LeadSens

| | **Elevay** | **LeadSens** |
|---|---|---|
| **Fonction** | Brand intelligence & marketing AI | Prospection B2B cold email |
| **Utilisateur** | CMO, marketeur, content manager | SDR, growth hacker, sales |
| **Agents** | BPI-01, MTS-02, CIA-03, SEO agents | ICP parser, scorer, email drafter |
| **LLM** | Anthropic (Claude) | Mistral (Large + Small) |
| **Port** | 3001 | 3000 |

**Elevay est une app independante.** Elle partage la DB (via `@leadsens/db`) et les composants UI (via `@leadsens/ui`) mais a son propre code, ses propres routes, et ses propres agents.

---

## 2. Stack technique

| Composant | Choix | Package |
|-----------|-------|---------|
| Runtime | Node.js 22 LTS | — |
| Framework | Next.js 15 App Router (Turbopack) | `next` |
| Language | TypeScript strict | `typescript` |
| CSS | Tailwind CSS 4 | `tailwindcss` |
| UI | shadcn/ui + Radix UI | `@radix-ui/*` |
| Chat UI | assistant-ui | `@assistant-ui/react` |
| Icons | Phosphor Icons | `@phosphor-icons/react` |
| DB | Prisma 6 + PostgreSQL (Neon) | `@leadsens/db` |
| Auth | Better Auth (email + Google OAuth) | `better-auth` |
| API | tRPC + TanStack Query | `@trpc/*` `@tanstack/react-query` |
| LLM | Anthropic Claude | `@anthropic-ai/sdk` |
| Integrations | Composio (OAuth tools) | `composio-core` |
| Scraping | Apify (LinkedIn) | `apify-client` |
| Background jobs | Inngest | `inngest` |
| Validation | Zod | `zod` |
| Charts | Recharts | `recharts` |
| PDF | React PDF | `@react-pdf/renderer` |
| Toasts | Sonner | `sonner` |

---

## 3. Charte graphique

### Couleurs principales

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#17c3b2` (teal) | `#3be8d7` | CTA, liens, accents |
| `--secondary` | `#FF7A3D` (orange) | `#c23d00` | Gradients, highlights |
| `--accent` | `#2c6bed` (bleu) | `#1253d3` | Accents secondaires |
| `--background` | `#FFF7ED` (creme) | `#140b00` | Fond de page |
| `--foreground` | near-black | near-white | Texte principal |

### Gradients

```css
--elevay-gradient: linear-gradient(135deg, #17c3b2, #FF7A3D, #2c6bed);
--elevay-gradient-btn: linear-gradient(90deg, #17c3b2, #FF7A3D);
```

- **Boutons primaires** : `style={{ background: 'var(--elevay-gradient-btn)' }}` + `text-white font-semibold`
- **Fonds hero** : classe `.bg-elevay-mesh` (radial gradients superposes teal + orange + bleu)

### Radius & Spacing

- Base radius : `0.625rem` (10px)
- Headers dashboard : `height: 48px; minHeight: 48px`
- Content max-width : `max-w-3xl` pour les formulaires, `max-w-2xl` pour les modales
- Sidebar : fond `#FFF7ED`, bordure `rgba(23,195,178,0.15)`

### Typographie

- Sans : `var(--font-public-sans)`
- Mono : `var(--font-geist-mono)`

### Composants UI disponibles

**Depuis `@leadsens/ui` :**
Button, Input, Textarea, Card (6 sub-components), Dialog, DropdownMenu, Tabs, Badge, Avatar, Select, Separator, Sheet, Sidebar, Skeleton, Tooltip, AlertDialog, Collapsible, Progress, ScrollArea

**Depuis `@/components/ui-brand-intel/` (Elevay-specific) :**
Button (avec variantes), Input, Label, Card, Badge, Select, Tabs

---

## 4. Structure front-end

### Routes (App Router)

```
src/app/
├── (dashboard)/                    ← Routes protegees (auth requise)
│   ├── page.tsx                    ← / (Agent Marketplace / Home)
│   ├── brand-intel/page.tsx        ← Dashboard Brand Intelligence (BPI-01, MTS-02, CIA-03)
│   ├── chat/page.tsx               ← Chat agent conversationnel
│   ├── seo-chat/page.tsx           ← Chat SEO agents (PIO-05 → ALT-12)
│   ├── influence/page.tsx          ← Agent influenceurs (Chief Influencer Officer)
│   ├── settings/page.tsx           ← Settings (7 onglets)
│   ├── contact/page.tsx            ← Contact support (formulaire + Resend)
│   ├── content-writer/             ← Content Writer (a implementer)
│   ├── crm-campaigns/              ← CRM Campaigns (a implementer)
│   ├── budget/                     ← Budget (a implementer)
│   ├── social-campaigns/           ← Social Campaigns (a implementer)
│   ├── social-inbox/               ← Social Inbox (a implementer)
│   ├── up-next/                    ← Up next (a implementer)
│   ├── notifications/              ← Notifications (a implementer)
│   └── layout.tsx                  ← Layout : auth + sidebar + providers
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── api/                            ← Toutes les routes API (voir section 5)
├── layout.tsx                      ← Root layout
└── globals.css                     ← Design tokens + gradients
```

### Layout Dashboard

```
DashboardShell
├── SidebarProvider (etat persiste en cookie)
├── AppSidebar
│   ├── Header : logo Elevay + collapse
│   ├── Nav :
│   │   ├── Home (/)
│   │   ├── Up next (/up-next)
│   │   ├── Notifications (/notifications)
│   │   ├── Brand Intelligence (/brand-intel)
│   │   ├── Content Writer (/content-writer)
│   │   ├── CRM Campaigns (/crm-campaigns)
│   │   ├── Budget (/budget)
│   │   ├── Social Campaigns (/social-campaigns)
│   │   └── Social Inbox (/social-inbox)
│   ├── New conversation + Search (Ctrl+K)
│   ├── Conversations groupees par date
│   └── Footer : profil + menu (Settings, Dark mode, Contact, Logout)
├── SidebarEdgeTrigger (hamburger mobile)
└── <main> flex-1 h-dvh overflow-hidden
```

### Dashboard Brand Intelligence (page principale)

**Composant :** `BrandIntelDashboard` dans `src/components/brand-intel/`

- Charge les donnees depuis `/api/agents/bmi/dashboard`
- Fallback sur mock data si pas de runs
- Execute 3 agents sequentiellement : BPI → MTS → CIA (SSE streaming)
- **4 onglets :**
  - Overview : scores + cross-signals + actions prioritaires
  - Online Presence : resultats BPI-01
  - Trends : resultats MTS-02
  - Competitive Analysis : resultats CIA-03
- **Profil marque :** brand_name, brand_url, country, language, keywords, sector, channels, competitors
- **Connected Tools :** LinkedIn, Google Analytics, GSC, Facebook, Instagram (OAuth via Composio)

### Page Settings (7 onglets)

| Tab | Composant | Contenu |
|-----|-----------|---------|
| Company | `company-profile-tab.tsx` | Nom, URL, industrie, taille, pays, description, value prop, target markets |
| Competitive Intelligence | `icp-targeting-tab.tsx` | Competitors, verticals marche, keywords veille, secteurs exclus |
| Content & Voice | `brand-voice-tab.tsx` | Langue, ton, brand voice persona, never mention, voice examples |
| Integrations | `integrations-tab.tsx` | LinkedIn, GA, GSC, Facebook, Instagram, Slack, Ahrefs, SEMrush |
| Agents & Automation | `agents-automation-tab.tsx` | Dry Run toggle, content approval, report schedule, timezone |
| Team | `team-tab.tsx` | Membres, invite, roles (owner/admin/viewer) |
| Usage | `billing-usage-tab.tsx` | Chat sessions, agent runs, AI calls, tokens, plan |

---

## 5. Structure back-end

### Routes API

```
src/app/api/
├── agents/
│   ├── bmi/                    ← Brand Market Intelligence
│   │   ├── bpi-01/route.ts     ← POST (SSE) — Brand Presence Intelligence
│   │   ├── mts-02/route.ts     ← POST (SSE) — Market Trends & Signals
│   │   ├── cia-03/route.ts     ← POST (SSE) — Competitive Intelligence
│   │   ├── dashboard/route.ts  ← GET — Charger les runs sauvegardes
│   │   └── export/route.tsx    ← POST — Export PDF
│   ├── chat/route.ts           ← POST (SSE) — Chat agent streaming
│   ├── influence/              ← Agent influenceurs (4 routes)
│   └── seo-geo/                ← SEO agents (8+ routes)
├── auth/
│   ├── [...all]/route.ts       ← Better Auth catch-all
│   ├── social/[platform]/      ← Connect/callback/status (Composio OAuth)
│   └── google-drive/           ← Google Drive OAuth
├── brand-profile/route.ts      ← POST — Sauvegarder profil marque
├── settings/route.ts           ← GET/PATCH — Settings workspace
├── settings/icp/route.ts       ← POST/PUT/DELETE — CRUD ICPs
├── settings/team/route.ts      ← POST/DELETE — Membres equipe
├── contact/route.ts            ← POST — Formulaire contact (Resend, file upload whitelist)
├── trpc/[trpc]/route.ts        ← Handler tRPC
└── inngest/route.ts            ← Background jobs
```

### Pattern auth + tenant scoping

Toutes les routes protegees suivent ce pattern :

```typescript
export const dynamic = 'force-dynamic'  // Obligatoire pour les routes auth (Next.js App Router)

const session = await auth.api.getSession({ headers: await headers() })
if (!session?.user) return 401

// Fallback workspaceId (pas toujours sur l'objet session)
let workspaceId = session.user.workspaceId
if (!workspaceId) {
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { workspaceId: true } })
  workspaceId = user?.workspaceId
}
if (!workspaceId) return 400

// Toutes les queries filtrent par workspaceId
const data = await prisma.xxx.findMany({ where: { workspaceId } })
```

### Pattern RBAC (Role-Based Access Control)

Pour les actions sensibles (gestion equipe, billing), utiliser un context auth avec role :

```typescript
async function getAuthContext(): Promise<{ workspaceId: string; userId: string; role: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  // ... resolve workspaceId ...
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: wid, userId } },
  })
  const role = membership?.role ?? "owner"  // creator du workspace = owner par defaut
  return { workspaceId: wid, userId, role }
}

function isAdmin(role: string): boolean {
  return role === "admin" || role === "owner"
}

// Dans le handler :
if (!isAdmin(ctx.role)) {
  return Response.json({ error: "FORBIDDEN", message: "Admin role required" }, { status: 403 })
}
```

### Audit logging

Les actions sensibles (invite/remove member, etc.) sont loggees via `@/lib/logger` :

```typescript
import { logger } from "@/lib/logger"

logger.info({
  action: "team.invite",
  actorId: ctx.userId,
  targetEmail: parsed.data.email,
  workspaceId: ctx.workspaceId,
  role: parsed.data.role,
}, "Team member invited")
```

### tRPC

```
src/server/trpc/
├── trpc.ts           ← Instance + protectedProcedure (enforce auth + workspaceId)
├── context.ts        ← Cree le contexte avec session + workspace
├── router.ts         ← appRouter = { conversation, brandProfile }
└── routers/
    ├── conversation.ts   ← create, list, getLatest, getMessages, rename, delete, search
    └── brand-profile.ts  ← get, upsert
```

---

## 6. Agents implementes

### BPI-01 — Brand Presence Intelligence

**But :** Scan multi-dimensionnel de la reputation et visibilite de la marque.

**Modules (8, en parallele) :**
- `serp.ts` — Positions Google, visibilite vs competitors
- `press.ts` — Couverture presse, sentiment, angle editorial
- `youtube.ts` — Presence video, opportunites influenceurs
- `social.ts` + `social-facebook.ts` + `social-instagram.ts` — Profils sociaux, engagement
- `seo.ts` — DA, backlinks, positions keywords
- `benchmark.ts` — Comparaison competitors
- `google-maps.ts` — Note, avis
- `trustpilot.ts` — Score confiance

**Output :** Score global + 7 scores par axe + diagnostics + 3 actions prioritaires 90 jours

### MTS-02 — Market Trends & Signals

**But :** Analyse des tendances marche et opportunites de contenu.

**Modules (sequentiels) :**
- `trends.ts` — Google Trends, queries montantes
- `competitive.ts` — Contenu des competitors
- `social-listening.ts` — Signaux sociaux
- `content.ts` — Gaps de contenu (depend de trends)
- `synthesis.ts` — Synthese pure (0 API, aggregation locale)

**Output :** Score opportunite global + topics trending/satures + gaps contenu + matrice formats + 30-day roadmap

### CIA-03 — Competitive Intelligence & Action

**But :** Positionnement competitif et recommandations strategiques.

**Modules (4 en parallele) :**
- `product-messaging.ts` — Scrape homepages, value props, CTAs
- `seo-acquisition.ts` — DA, trafic organique, keyword overlap
- `social-media.ts` — Followers, frequence posts, engagement
- `content.ts` — Blog, YouTube, lead magnets, themes
- `benchmark.ts` — Calcul pur (0 API)
- `recommendations.ts` — Recommandations strategiques (LLM)

**Output :** Score marque + scores competitors (6 dimensions) + zones strategiques + menaces/opportunites + plan 60 jours

### Influence Agent — Chief Influencer Officer

**But :** Decouverte d'influenceurs et generation de briefs de collaboration.

**Localisation :** `agents/influence/` (UI, hooks, core, prompts, onboarding)

**Flow utilisateur :**
1. Chat conversationnel — l'agent collecte un brief campagne (8 parametres)
2. Recherche auto-declenchee une fois le brief complet
3. Resultats affiches avec scoring IA (5 composantes)
4. Generation de briefs personnalises par influenceur
5. Export CSV pour integration CRM

**Brief campagne (9 champs) :**
- Objectif (branding / conversion / engagement / awareness)
- Secteur, Geographie, Plateformes (Instagram, TikTok, YouTube, LinkedIn, X)
- Style de contenu (educational / lifestyle / humor / review / UGC)
- Budget min/max (euros)
- Priorite (reach vs engagement)
- Type de profil (micro / macro / mix)

**Scoring (5 composantes) :**
| Composante | Poids | Description |
|-----------|-------|-------------|
| Reach & Engagement | 40% | Followers x taux d'engagement |
| Affinite thematique | 25% | Match avec le secteur campagne |
| Brand Safety | 20% | Securite contenu & alignement marque |
| Qualite contenu | 10% | Qualite de production |
| Credibilite | 5% | Authenticite, detection fraude |

Seuils : Priority (85+), Recommended (70-84), At Risk (<70)

**UI :**
- Split-pane : liste resultats (gauche) + chat sidebar (droite, 320-380px)
- `InfluencerCard` : avatar, handle, stats (followers, engagement, budget), score ring
- `DetailPanel` : breakdown score, brief IA genere (editable), copy/CRM buttons
- `BriefChips` : recap du brief en haut
- `AgentSidebar` : conversation avec le "Chief Influencer Officer"
- Detection auto de langue (FR/EN)

**API routes (4) :**
- `POST /api/agents/influence/chat` — Conversation brief collection (Claude Sonnet)
- `POST /api/agents/influence/search` — Recherche influenceurs (Apify → mock fallback)
- `POST /api/agents/influence/brief` — Generation brief collaboration (Claude Sonnet)
- `POST /api/agents/influence/validate-key` — Validation cle API outil tiers

**Outils influenceurs supportes (BYOT) :**
Upfluence, Klear, Kolsquare, HypeAuditor, Modash + recherche built-in (fallback)

**Persistance :** Session localStorage (24h TTL), cles API client-side uniquement

### SEO-GEO Agents (framework)

8 agents specialises SEO :

| Code | Nom | Role |
|------|-----|------|
| PIO-05 | Performance & Insights Optimizer | Analyse performance |
| OPT-06 | SEO & GEO Performance Optimizer | Optimisation on-page |
| TSI-07 | Technical SEO & Indexing Manager | Audit technique |
| KGA-08 | Keyword & GEO Action Planner | Analyse keywords |
| WPW-09 | Web Page SEO Writer | Redaction pages web |
| BSW-10 | Blog SEO Writer | Redaction blog |
| MDG-11 | Meta Description Generator | Meta descriptions |
| ALT-12 | Image ALT Text Generator | Textes alternatifs |

### Infrastructure partagee (`src/agents/_shared/`)

- `types.ts` — AgentProfile, ModuleResult, AgentOutput<T>
- `llm.ts` — callLLM() avec Anthropic SDK
- `composio.ts` — Integration outils
- `social-oauth.ts` — Helpers OAuth
- `utils.ts` — Utilitaires agents

**Enveloppe de sortie agent :**
```typescript
interface AgentOutput<T> {
  agent_code: string       // "BPI-01" | "MTS-02" | "CIA-03"
  analysis_date: string    // ISO 8601
  brand_profile: AgentProfile
  payload: T               // Output specifique a l'agent
  degraded_sources: string[]
  version: string
}
```

---

## 7. Base de donnees (modeles cles Elevay)

**Modeles partages (utilises par les deux apps) :**
- `User` — id, email, name, workspaceId
- `Workspace` — tenant principal, name, slug, settings (JSON), dryRunMode, timezone, etc.
- `Conversation` — workspaceId, title, messages[]
- `Message` — role (USER/ASSISTANT/SYSTEM/TOOL), content
- `Integration` — workspaceId, type, apiKey/accessToken, status

**Modeles Elevay-specifiques :**
- `ElevayBrandProfile` — brand_name, brand_url, keywords, channels, competitors, social_connections
- `ElevayAgentRun` — agentCode, output (JSON), degradedSources, durationMs
- `WorkspaceIcp` — personaName, jobTitles, targetIndustries, targetGeos, intentKeywords
- `WorkspaceMember` — userId, role (owner/admin/viewer), invitedAt

---

## 8. Connected Tools (integrations Elevay)

Toutes les integrations passent par **Composio OAuth** via `/api/auth/social/[platform]/connect` (POST → redirectUrl → popup).

| Outil | Key | Usage |
|-------|-----|-------|
| LinkedIn | `linkedin` | Company page analytics |
| Google Analytics | `ga` | Trafic & conversions |
| Google Search Console | `gsc` | Performance recherche |
| Facebook | `facebook` | Page insights |
| Instagram | `instagram` | Profil & engagement |
| Slack | `slack` | Notifications |
| Ahrefs | `ahrefs` | SEO competitif |
| SEMrush | `semrush` | Intelligence keywords |

Les logos sont dans `/public/logos/` (google-analytics.svg, google-search-console.png, slack.png, ahrefs.ico, semrush.ico).

---

## 9. Commandes dev

```bash
# Monorepo
pnpm install                        # Installer les deps
pnpm dev:elevay                     # Lancer Elevay (port 3001)
pnpm dev:all                        # Lancer tout (3000 + 3001)

# Elevay
pnpm --filter @leadsens/elevay typecheck    # Verifier les types
pnpm --filter @leadsens/elevay build        # Build prod

# Database
pnpm db:generate                    # Regenerer le client Prisma
pnpm db:push                        # Appliquer le schema
pnpm db:migrate                     # Creer une migration
pnpm db:studio                      # Interface visuelle
```

---

## 10. Securite & Compliance

### Patterns appliques

| Pattern | Implementation | Fichiers concernes |
|---------|----------------|---------------------|
| **Force dynamic** | `export const dynamic = 'force-dynamic'` sur toutes les routes auth | `/api/settings/*`, `/api/contact`, `/api/brand-profile`, `/api/auth/social/*` |
| **RBAC** | Role check (owner/admin/viewer) avant actions sensibles | `/api/settings/team` (POST/DELETE) |
| **Audit logging** | `logger.info({ action, actorId, targetX, workspaceId })` | `/api/settings/team` |
| **Tenant isolation** | Toutes les queries filtrent par `workspaceId` | Toutes les routes |
| **File upload whitelist** | MIME types limites + max size 5 MB | `/api/contact` |
| **Input validation** | Zod sur tous les inputs | Toutes les routes |
| **Pas de fuite d'erreur** | `catch (err) { void err; return INTERNAL_ERROR }` (pas de stack trace au client) | Toutes les routes |
| **Owner protection** | `CANNOT_REMOVE_OWNER` 403 si tentative de suppression de l'owner | `/api/settings/team` DELETE |

### File upload (pieces jointes contact)

```typescript
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "text/csv", "application/pdf"]
const MAX_SIZE = 5 * 1024 * 1024  // 5 MB

if (!ALLOWED_TYPES.includes(attachment.type)) {
  return Response.json({ error: "File type not allowed" }, { status: 400 })
}
if (attachment.size > MAX_SIZE) {
  return Response.json({ error: "File too large (max 5MB)" }, { status: 400 })
}
```

### OAuth & secrets

- **Better Auth secret** : `BETTER_AUTH_SECRET` env var (jamais commit)
- **Composio OAuth** : token stocke en DB chiffre via `Integration.accessToken`
- **API keys tiers** (Influence agent : Upfluence, Klear, etc.) : **client-side only**, jamais persistes serveur
- **Resend API key** : `RESEND_API_KEY` env var (fallback log si absent en dev)

### Email domain

Toutes les communications sortantes utilisent `noreply@elevay.app` ou `contact@elevay.app` (jamais d'email perso).

---

## 11. Conventions

1. **TypeScript strict** — zero `any`, zero `as any`
2. **Zod** sur tous les inputs (routes API, tRPC, formulaires)
3. **Conventional Commits** : `feat(elevay):`, `fix(elevay):`
4. **Imports** : `@/` = `apps/elevay/src/`, `@leadsens/db` = Prisma, `@leadsens/ui` = UI
5. **Pas de `console.log`** en production
6. **Ne jamais toucher** `apps/leads/` ou `packages/db/` sans coordination (schema partage)
7. **Headers** : 48px de hauteur, aligne avec la sidebar
8. **Formulaires** : composants `ui-brand-intel` (Card, Input, Label, Button)
9. **Boutons primaires** : gradient `var(--elevay-gradient-btn)` + `text-white font-semibold`
10. **Pill selectors** : `rounded-full px-3 py-1.5 text-sm font-medium border` + couleur active
11. **Routes API dynamiques** : toujours ajouter `export const dynamic = 'force-dynamic'` sur les routes qui utilisent `headers()` ou `auth`
12. **Catch blocks** : utiliser `void err;` si la variable d'erreur n'est pas utilisee (convention linter)
13. **Pages a implementer** : les routes sidebar (Content Writer, CRM Campaigns, Budget, Social Campaigns, Social Inbox, Up next, Notifications) existent dans la nav mais pas encore les pages
