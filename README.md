# LeadSens Monorepo

## Apps

| App | Port | Description |
|-----|------|-------------|
| [leads](apps/leads/) | 3000 | LeadSens — AI agent for B2B prospecting |
| [elevay](apps/elevay/) | 3001 | Elevay — AI marketing agents |

## Packages

| Package | Description |
|---------|-------------|
| [@leadsens/db](packages/db/) | Prisma schema + client (shared PostgreSQL) |
| [@leadsens/ui](packages/ui/) | Shared UI components (shadcn + chat primitives) |

## Getting Started

```bash
pnpm install
pnpm dev          # LeadSens (port 3000)
pnpm dev:elevay   # Elevay (port 3001)
pnpm dev:all      # Both
```

See each app's README for app-specific setup.
