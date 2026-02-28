# LeadSens

Conversational B2B lead prospecting agent powered by Mistral AI, Instantly, and Jina Reader.

## Stack

- Next.js 15 (App Router)
- TypeScript strict
- Tailwind CSS 4 + shadcn/ui
- Prisma + PostgreSQL (Neon)
- BullMQ + Redis (Upstash)
- Mistral AI (chat, scoring, enrichment, emails)
- Instantly API V2 (lead sourcing, campaigns)
- Jina Reader (web scraping)
- Better Auth
- tRPC + TanStack Query
- assistant-ui (chat interface)

## Development

```bash
pnpm install
pnpm dev
```

## Docs

- `CLAUDE.md` — Project overview and conventions
- `docs/SPEC-BACKEND.md` — Backend implementation patterns
- `docs/SPEC-CHAT.md` — Chat UI specification
- `docs/PROMPTS.md` — Build sequence
