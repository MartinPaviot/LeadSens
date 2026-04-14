# 04 — Merge du schéma Prisma

## Principe

**NE PAS** écraser `prisma/schema.prisma` d'Elevay avec celui de brand-intello. Les deux contiennent `User`/`Session`/`Account`/`Verification` (tables Better Auth standard), mais Elevay a probablement ajouté des champs custom (role, orgId, stripeCustomerId, etc.). Stratégie : **ajouter seulement** les deux modèles de domaine.

## Modèles à ajouter (à coller à la fin du schema d'Elevay)

Source : `brand-intel/prisma/schema.prisma` lignes 73-114

```prisma
// ── Brand Intel tables ──────────────────────────────────

model BrandProfile {
  id                String     @id @default(cuid())
  workspaceId       String     @unique
  brand_name        String
  brand_url         String
  country           String
  language          String
  competitors       Json       // Array<{ name: string; url: string }>
  primary_keyword   String
  secondary_keyword String
  sector            String?
  priority_channels String[]
  objective         String?

  // Social OAuth via Composio
  facebookConnected          Boolean  @default(false)
  facebookComposioAccountId  String?
  instagramConnected         Boolean  @default(false)
  instagramComposioAccountId String?

  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  agentRuns  AgentRun[]

  @@map("brand_profile")
}

model AgentRun {
  id              String        @id @default(cuid())
  workspaceId     String
  agentCode       String        // "BPI-01" | "MTS-02" | "CIA-03"
  status          String        @default("COMPLETED")
  output          Json          // AgentOutput<T> — full structured result
  degradedSources String[]      // sources that failed gracefully
  durationMs      Int
  createdAt       DateTime      @default(now())
  brandProfileId  String?
  brandProfile    BrandProfile? @relation(fields: [brandProfileId], references: [id])

  @@index([workspaceId, agentCode, createdAt])
  @@map("agent_run")
}
```

## Vérifications avant migration

### 1. Noms de tables Better Auth

brand-intello mappe :
- `@@map("user")`
- `@@map("session")`
- `@@map("account")`
- `@@map("verification")`

**Compare avec Elevay** :
- Si Elevay a `@@map("users")` (pluriel), `auth_user`, ou pas de `@@map` (laisse Prisma nommer la table `User`), **les migrations vont casser**.
- Solution : ne rien changer côté Elevay, aligner la **config Better Auth** d'Elevay sur sa convention existante. Voir `05-better-auth-and-middleware.md`.

### 2. Champs custom sur `User`

Elevay a peut-être ajouté : `role`, `organizationId`, `stripeCustomerId`, `onboardingComplete`, etc. **Ne pas les supprimer**. Si tu veux, tu peux ajouter une relation `BrandProfile ↔ User` :

```prisma
// Dans le modèle User existant d'Elevay, ajouter :
brandProfiles BrandProfile[]

// Et dans BrandProfile :
userId String?
user   User?   @relation(fields: [userId], references: [id])
```

Voir question 3 de `19-open-questions.md` (workspaceId vs userId).

### 3. Generator path

brand-intello utilise :
```prisma
generator client {
  provider = "prisma-client"     // ⚠️ nouveau provider Prisma 7
  output   = "../src/generated/prisma"
}
```

Si Elevay utilise le générateur classique `prisma-client-js` avec output par défaut, deux choix :

- **Garder Elevay tel quel** : tous les imports dans les fichiers copiés (`import { PrismaClient } from '@/generated/prisma/client'`) doivent être réécrits en `import { PrismaClient } from '@prisma/client'`. Find & replace global.
- **Adopter le nouveau pattern dans Elevay** : upgrade Prisma 7, changer le provider. Plus propre, mais plus invasif. Voir question 15.

## Étape de migration

### A. Ajouter les modèles au `schema.prisma` d'Elevay

Ouvrir `prisma/schema.prisma` d'Elevay, coller les deux modèles `BrandProfile` et `AgentRun` à la fin. **Ne toucher à rien d'autre**.

### B. Générer la migration

```bash
pnpm prisma migrate dev --name add_brand_intel_agents
```

Prisma va détecter :
- `CREATE TABLE brand_profile (...)`
- `CREATE TABLE agent_run (...)`
- `CREATE INDEX agent_run_workspaceId_agentCode_createdAt_idx ON agent_run(...)`
- La foreign key `agent_run.brandProfileId → brand_profile.id`

Vérifier le SQL généré : il ne doit **rien** toucher aux tables `user`/`session`/`account`/`verification`.

Si Prisma propose des ALTER TABLE sur les tables Better Auth (parce que le schema d'Elevay diverge), **annuler la migration** et relire l'étape 1/2 ci-dessus.

### C. Régénérer le client

```bash
pnpm prisma generate
```

Si tu as adopté le path custom : le client va dans `src/generated/prisma`. Sinon, `@prisma/client`.

### D. Vérifier

```bash
pnpm prisma studio
# Ouvrir http://localhost:5555 et vérifier que les 2 nouvelles tables sont présentes
```

## Client Prisma (singleton) — `src/lib/db.ts`

Code exact de brand-intello :

```ts
import '@/lib/env' // force env validation at startup
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

Note : utilise **`@prisma/adapter-pg`** (requis pour les drivers serverless type Neon avec pooling). Si Elevay utilise déjà un autre pattern (driver direct `postgres://` sans adapter), vérifier la compatibilité.

## Seed (optionnel)

Le repo n'a pas de `prisma/seed.ts` — aucun seed à copier. Pour initialiser en dev, créer un `BrandProfile` via l'UI (formulaire dans le dashboard).

## Rollback

Si la migration échoue ou produit un résultat indésirable :

```bash
pnpm prisma migrate reset   # ⚠️ efface TOUTE la DB en dev
# ou manuellement :
pnpm prisma migrate resolve --rolled-back <migration_name>
```

**Ne jamais lancer `migrate reset` en prod**. En prod, créer une migration corrective (`migrate dev --create-only`) et l'éditer.

## Index et performance

L'index composite sur `agent_run` est essentiel :
```prisma
@@index([workspaceId, agentCode, createdAt])
```

Il accélère la query `findFirst({ where: { workspaceId, agentCode }, orderBy: { createdAt: 'desc' } })` utilisée par tous les handlers d'agents pour récupérer le run précédent.

## JSON columns

`BrandProfile.competitors` et `AgentRun.output` sont des `Json` Postgres (JSONB). Prisma retourne ces champs typés `JsonValue` (unknown-ish). Les routes les castent via des double casts documentés (voir `src/app/api/agents/bmi/bpi-01/route.ts:40-42`) :

```ts
const prev = previousRun.output as unknown as AgentOutput<BpiOutput>
```

C'est un compromis assumé. Ne pas supprimer ce pattern sans avoir une alternative validée par Zod à la lecture.
