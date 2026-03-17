# Elevay — AI Marketing Agents

> AI-powered marketing assistant for content strategy, copywriting, campaign planning, social media, email marketing, and brand positioning.

## Quick Start

```bash
# 1. Clone the repo & install
git clone <repo-url>
cd LeadSens
pnpm install

# 2. Set up environment
cp .env.example .env
# Fill in DATABASE_URL, MISTRAL_API_KEY, BETTER_AUTH_SECRET, etc.

# 3. Generate Prisma client
pnpm db:generate

# 4. Run Elevay (port 3001)
pnpm dev:elevay

# 5. Run both apps simultaneously (LeadSens:3000 + Elevay:3001)
pnpm dev:all
```

## Architecture

```
apps/elevay/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login + Signup pages
│   │   ├── (dashboard)/         # Chat page (main UI)
│   │   ├── api/
│   │   │   ├── agents/chat/     # SSE chat route (Mistral Large)
│   │   │   ├── auth/            # Better Auth handler
│   │   │   └── trpc/            # tRPC handler
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Tailwind 4 styles
│   ├── components/
│   │   ├── chat/                # Chat UI (assistant-ui based)
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/                   # Custom hooks
│   ├── lib/                     # Auth, Prisma, SSE, tRPC client
│   ├── server/trpc/             # tRPC server (conversation router)
│   └── middleware.ts            # Auth middleware
├── public/                      # Static assets
├── package.json
├── next.config.ts
├── tsconfig.json
└── postcss.config.mjs
```

## Monorepo Structure

```
LeadSens/                        # Root
├── apps/
│   ├── leads/                   # LeadSens B2B prospecting app (port 3000)
│   └── elevay/                  # THIS APP — marketing agents (port 3001)
├── packages/
│   └── db/                      # Shared Prisma schema + client (@leadsens/db)
├── pnpm-workspace.yaml
└── package.json                 # Root scripts
```

### Shared: `@leadsens/db`
Both apps share the same PostgreSQL database via `@leadsens/db`. Import Prisma like:
```ts
import { prisma } from "@/lib/prisma";  // local wrapper
// or directly:
import { prisma } from "@leadsens/db";
```

### NOT shared (independent per app)
- Pipeline, tools, integrations, analytics (LeadSens-specific)
- Chat components (copied, not shared — too coupled to LeadSens features)
- API routes, server logic

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:elevay` | Run Elevay on port 3001 |
| `pnpm dev:all` | Run both apps |
| `pnpm build:elevay` | Build Elevay |
| `pnpm --filter @leadsens/elevay typecheck` | Typecheck Elevay |
| `pnpm typecheck:all` | Typecheck all apps |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:push` | Push schema to DB |
| `pnpm db:studio` | Open Prisma Studio |

## Stack

| What | Technology |
|------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript strict |
| CSS | Tailwind CSS 4 |
| UI | shadcn/ui + Radix |
| Chat | assistant-ui |
| Auth | Better Auth |
| DB | Prisma 6 + PostgreSQL (Neon) |
| API | tRPC + TanStack Query |
| LLM | Mistral Large |
| Validation | Zod |

## Current State

The app is a **working chat interface** with:
- Auth (login/signup with Google OAuth)
- Conversation management (create, list, switch)
- SSE streaming chat with Mistral Large
- Basic system prompt (marketing assistant personality)

### What to build next (agents)
Elevay needs domain-specific marketing agents. Each agent should:
1. Have its own system prompt and tool set
2. Be selectable from the sidebar or auto-routed
3. Use the shared Prisma DB for persistence

Potential agents:
- Content Strategy Agent
- Copywriting Agent
- Social Media Agent
- Email Marketing Agent
- Campaign Planning Agent
- Brand & Positioning Agent
- Analytics & Reporting Agent

## Development Workflow

1. Create a feature branch: `git checkout -b feat/elevay-<feature-name>`
2. Work in `apps/elevay/` — changes here won't affect LeadSens
3. Typecheck: `pnpm --filter @leadsens/elevay typecheck`
4. If you need to modify the Prisma schema (`packages/db/prisma/schema.prisma`):
   - Coordinate with the LeadSens side
   - Run `pnpm db:generate` after changes
   - Create a migration: `pnpm db:migrate`
5. Commit with conventional commits: `feat(elevay):`, `fix(elevay):`
