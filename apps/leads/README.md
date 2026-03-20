# LeadSens

Agent IA conversationnel qui pilote le compte Instantly du client pour automatiser la prospection B2B : sourcing, scoring, enrichissement, redaction d'emails personnalises et envoi via campagnes.

## Comment ca marche

```
ICP en langage naturel → Sourcing Instantly → Scoring IA → Enrichissement Jina
→ Redaction emails (PAS / Value-add / Breakup) → Campagne Instantly prete a activer
```

1. L'utilisateur decrit son ICP en francais ou anglais
2. Mistral Large parse le profil en filtres de recherche Instantly
3. SuperSearch source les leads dans une liste Instantly
4. Scoring IA (Mistral Small) sur les donnees brutes — les leads < 5 sont elimines
5. Jina Reader scrape les sites web des leads qualifies uniquement
6. Mistral Small extrait les informations cles (pain points, stack, actus)
7. Mistral Large redige 3 emails par lead (first touch + 2 follow-ups)
8. Preview inline dans le chat, corrections possibles, puis push dans Instantly

## Stack

| Composant | Choix |
|-----------|-------|
| Framework | Next.js 15 App Router |
| Language | TypeScript strict |
| CSS | Tailwind CSS 4 + shadcn/ui |
| Chat UI | assistant-ui |
| Icons | Phosphor Icons |
| DB | Prisma 6 + PostgreSQL (Supabase) |
| Queue | BullMQ + Redis (Upstash) |
| Auth | Better Auth |
| API | tRPC + TanStack Query |
| LLM | Mistral (Large pour chat/ICP/emails, Small pour scoring/enrichissement) |
| Scraping | Jina Reader |
| Validation | Zod |

## Getting Started

### Prerequis

- Node.js 22 LTS
- pnpm
- PostgreSQL (Supabase ou Neon)
- Redis (Upstash)
- Cle API Mistral

### Installation

```bash
# Cloner le repo
git clone https://github.com/MartinPaviot/LeadSens.git
cd LeadSens

# Installer les dependances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les valeurs dans .env

# Initialiser la base de donnees
pnpm exec prisma db push

# Lancer en dev
pnpm dev
```

L'app tourne sur [http://localhost:3000](http://localhost:3000).

## Structure du projet

```
src/
├── app/                    # Routes Next.js (App Router)
│   ├── api/                # API routes (chat, integrations, tRPC)
│   ├── (dashboard)/        # Pages dashboard (chat, campaigns, settings)
│   └── (auth)/             # Pages auth
├── components/
│   ├── chat/               # UI du chat (messages, composer, inline cards)
│   └── ui/                 # Composants shadcn/ui
├── server/
│   ├── lib/
│   │   ├── llm/            # Client Mistral unique
│   │   ├── tools/          # Tool calling (instantly, enrichment, email, CRM)
│   │   ├── connectors/     # APIs externes (Instantly, HubSpot, Jina)
│   │   ├── enrichment/     # Scoring, scraping, summarization
│   │   └── email/          # Drafting, prompt builder, style learner
│   └── trpc/               # Routers tRPC
├── lib/                    # Utilitaires partages (auth, encryption, config)
└── queue/                  # Workers BullMQ (enrichissement, email drafting)
```

## Scripts

```bash
pnpm dev        # Serveur dev (Turbopack)
pnpm build      # Build production
pnpm start      # Serveur production
pnpm lint       # ESLint
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — Vue d'ensemble du projet et conventions
- [docs/SPEC-BACKEND.md](docs/SPEC-BACKEND.md) — Patterns backend
- [docs/SPEC-CHAT.md](docs/SPEC-CHAT.md) — Specification UI chat
- [docs/PROMPTS.md](docs/PROMPTS.md) — Sequence de build

## License

Private — All rights reserved.
