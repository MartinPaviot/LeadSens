# 12 — API routes (9 endpoints)

## Vue d'ensemble

| Méthode | Path | Handler | Auth | SSE |
|---------|------|---------|------|-----|
| `*` | `/api/auth/[...all]` | Better Auth catch-all | — | Non |
| POST | `/api/brand-profile` | Upsert profil (Zod) | ✅ Session | Non |
| GET | `/api/auth/social/connect?platform=...` | Init OAuth Composio | ✅ Session | Non |
| GET | `/api/auth/social/callback` | Callback Composio | — (depuis provider) | Non |
| DELETE | `/api/auth/social/disconnect?platform=...` | Révoque Composio | ✅ Session | Non |
| POST | `/api/agents/bmi/bpi-01` | Run BPI-01 | ✅ Session | ✅ SSE |
| POST | `/api/agents/bmi/mts-02` | Run MTS-02 | ✅ Session | ✅ SSE |
| POST | `/api/agents/bmi/cia-03` | Run CIA-03 | ✅ Session | ✅ SSE |
| GET | `/api/agents/bmi/dashboard` | Dernier run des 3 agents + profile | ✅ Session | Non |

## Pattern commun de toutes les routes protégées

```ts
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  // ... logique métier
}
```

## Configuration exportée par fichier

Les 3 routes agents déclarent :

```ts
export const maxDuration = 60       // 60s Vercel Pro, 10s hobby
export const dynamic = 'force-dynamic'  // pas de cache Next
```

Les routes non-agent n'ont pas ces exports.

## `POST /api/brand-profile`

### Input (Zod)

```ts
const schema = z.object({
  brand_name: z.string().min(1),
  brand_url: z.string().url(),
  country: z.string().min(2),
  language: z.string().min(2),
  primary_keyword: z.string().min(1),
  secondary_keyword: z.string().min(1),
  sector: z.string().optional(),
  priority_channels: z.array(z.string()),
  objective: z.string().optional(),
  competitors: z.array(z.object({
    name: z.string().min(1),
    url: z.string().url(),
  })),
})
```

### Output

Retourne le `BrandProfile` persisté (via upsert sur `workspaceId`).

### Status codes

- `200` : upsert OK, body = objet BrandProfile
- `400` : body invalide (Zod parse error)
- `401` : pas de session

## `GET /api/agents/bmi/dashboard`

Retourne un snapshot pour hydrater l'UI au montage :

```ts
{
  bpi: AgentOutput<BpiOutput> | null   // dernier run BPI-01
  mts: AgentOutput<MtsOutput> | null   // dernier run MTS-02
  cia: AgentOutput<CiaOutput> | null   // dernier run CIA-03
  profile: BrandProfile | null
}
```

Logique (simplifiée) :

```ts
const [bpiRun, mtsRun, ciaRun, profile] = await Promise.all([
  db.agentRun.findFirst({ where: { workspaceId, agentCode: 'BPI-01' }, orderBy: { createdAt: 'desc' } }),
  db.agentRun.findFirst({ where: { workspaceId, agentCode: 'MTS-02' }, orderBy: { createdAt: 'desc' } }),
  db.agentRun.findFirst({ where: { workspaceId, agentCode: 'CIA-03' }, orderBy: { createdAt: 'desc' } }),
  db.brandProfile.findUnique({ where: { workspaceId } }),
])

return Response.json({
  bpi: bpiRun?.output ?? null,
  mts: mtsRun?.output ?? null,
  cia: ciaRun?.output ?? null,
  profile,
})
```

## `POST /api/agents/bmi/bpi-01` · `/mts-02` · `/cia-03`

Voir `08-agent-bpi-01.md`, `09-agent-mts-02.md`, `10-agent-cia-03.md` pour les détails métier.

### Events SSE émis

Toutes les 3 routes émettent la même séquence :

| Event | Payload | Quand |
|-------|---------|-------|
| `status` | `{ message, index, total, module? }` | Progression (ex: `[3/8] youtube ✓`) |
| `result` | `{ output: <AgentPayload> }` | Une fois la run terminée, avant persist |
| `finish` | `{ durationMs, degraded_sources }` | Fin du stream |
| `error` | `{ message }` | Erreur fatale (throw remonté par createSSEStream) |

Le client consomme ces events (voir `13-sse-streaming.md`).

### Status codes HTTP

- `200` + `Content-Type: text/event-stream` : stream OK
- `400` `{ error: 'NO_PROFILE' }` : pas de BrandProfile pour le workspace → UI ouvre le formulaire
- `401` : pas de session

## `GET /api/auth/social/connect?platform=facebook|instagram`

Input query : `platform`.

Logique :
1. Vérifie session.
2. Appelle l'API Composio pour créer une session OAuth.
3. Récupère l'URL de consent (Facebook ou Instagram).
4. `return NextResponse.redirect(consentUrl)` — redirige le browser vers Facebook/Instagram.

Response : **redirect HTTP 302** vers le provider.

## `GET /api/auth/social/callback?platform=...&session_id=...`

Callback appelé par Composio après le consent Facebook/Instagram.

Logique :
1. Vérifie `session_id` côté Composio (handshake).
2. Récupère le `connectedAccountId` depuis Composio.
3. `db.brandProfile.update({ where: { workspaceId }, data: { facebookConnected: true, facebookComposioAccountId: ... } })`
4. `return NextResponse.redirect(/brand-intel?connected=facebook)`.

Si erreur : redirect `/brand-intel?error=<code>`.

## `DELETE /api/auth/social/disconnect?platform=...`

Logique :
1. Vérifie session.
2. Révoque le compte Composio (`DELETE https://backend.composio.dev/api/v1/connected_accounts/{id}`).
3. `db.brandProfile.update({ data: { facebookConnected: false, facebookComposioAccountId: null } })`.
4. Return `200 { success: true }`.

## Collisions possibles avec Elevay

⚠️ Si Elevay a déjà :

- `/api/agents/*` (autre usage, ex: chat agentique) → **renommer** en `/api/brand-intel/*` ou `/api/audits/*`.
- `/api/auth/social/*` (autre provider social, ex: Stripe Connect) → renommer en `/api/integrations/social/*`.
- `/api/brand-profile` (unlikely mais possible) → renommer en `/api/brand-intel/profile`.

Voir question 4 de `19-open-questions.md`.

## Code status conventions

| Code | Signification côté client |
|------|---------------------------|
| `200` | Succès |
| `302` | Redirect (OAuth flow) |
| `400` | Body invalide ou pre-condition (ex: `NO_PROFILE`) |
| `401` | Session manquante/expirée → redirect `/login` (middleware) |
| `500` | Erreur serveur (throw non catché) |

## Fichiers à copier

```
src/app/api/brand-profile/route.ts                    ✅ copier
src/app/api/agents/bmi/bpi-01/route.ts                ✅ copier
src/app/api/agents/bmi/mts-02/route.ts                ✅ copier
src/app/api/agents/bmi/cia-03/route.ts                ✅ copier
src/app/api/agents/bmi/dashboard/route.ts             ✅ copier
src/app/api/auth/social/connect/route.ts              ✅ copier
src/app/api/auth/social/callback/route.ts             ✅ copier
src/app/api/auth/social/disconnect/route.ts           ✅ copier

src/app/api/auth/[...all]/route.ts                    ❌ NE PAS copier — Elevay a déjà le sien
```

## Checklist

- [ ] 8 routes copiées, imports Prisma ajustés si nécessaire
- [ ] Pas de collision de path avec les routes existantes d'Elevay
- [ ] Middleware d'Elevay protège `/api/agents/bmi/*` et `/api/brand-profile` (ou laisse passer et on vérifie la session dans le handler — brand-intello fait le second)
- [ ] `maxDuration` accepté par le runtime Elevay (Vercel Pro pour 60s)
