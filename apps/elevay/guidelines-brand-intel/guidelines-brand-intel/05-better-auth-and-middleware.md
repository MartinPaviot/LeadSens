# 05 — Better Auth et middleware

## Principe

Elevay a **déjà** Better Auth + Prisma + Postgres. L'objectif n'est **pas** de le remplacer, mais de :

1. Vérifier que la config Better Auth de brand-intello est compatible.
2. Ajouter les bonnes vérifications de session dans les nouvelles API routes copiées.
3. **Fusionner** le middleware (pas remplacer) pour protéger la route `/brand-intel/*`.

## Config Better Auth — brand-intello

Fichier : `brand-intel/src/lib/auth.ts` (11 lignes, minimaliste)

```ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { db } from './db'
import { env } from './env'

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
})
```

### Ce qu'il faut vérifier dans l'`auth.ts` d'Elevay

1. ✅ `prismaAdapter(db, { provider: 'postgresql' })` — identique si Elevay est sur Postgres.
2. ⚠️ `emailAndPassword: { enabled: true }` — si Elevay utilise aussi des providers sociaux (Google, GitHub, etc.) comme méthode de login **principale**, sa config est plus complexe. **Garder la config d'Elevay**, elle englobe email/password + sociaux.
3. ⚠️ `secret` et `baseURL` — Elevay doit utiliser les mêmes variables (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`).

**Aucune modification n'est nécessaire dans l'`auth.ts` d'Elevay** pour les agents. La config minimaliste de brand-intello est un sous-ensemble d'une config Elevay normale.

## Client Better Auth — brand-intello

Fichier : `brand-intel/src/lib/auth-client.ts`

```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
```

Elevay a sûrement déjà un équivalent. **Ne pas copier**, utiliser celui d'Elevay partout où brand-intello importe `authClient`.

## Vérification de session dans les API routes

Toutes les routes `/api/agents/**`, `/api/brand-profile`, et `/api/auth/social/**` commencent par :

```ts
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  // ...
}
```

Cela fonctionne **identiquement** avec la config Better Auth d'Elevay (c'est l'API standard du package).

## Route catch-all Better Auth

Fichier : `brand-intel/src/app/api/auth/[...all]/route.ts`

**Elevay l'a déjà**. Ne pas copier, ne pas écraser. C'est le handler qui gère `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/session`, etc.

## Middleware — merge critique

### Middleware brand-intello

Fichier : `brand-intel/middleware.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function middleware(request: NextRequest) {
  const session = getSessionCookie(request)
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/brand-intel/:path*'],
}
```

### Règle : fusionner, pas remplacer

Si Elevay a déjà un middleware (très probable pour auth, i18n, analytics, etc.), **ne pas écraser** son fichier.

**Stratégie recommandée** : ajouter `/brand-intel/:path*` au matcher existant d'Elevay, et s'assurer que la logique de session d'Elevay traite cette route aussi.

#### Exemple de merge (hypothétique Elevay)

Avant (Elevay) :
```ts
export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
}
```

Après :
```ts
export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/brand-intel/:path*'],
}
```

Si la logique de session d'Elevay est identique (redirect vers `/login` si pas de cookie), **c'est suffisant**. Rien d'autre à changer.

### Logique de session différente

Si Elevay utilise `auth.api.getSession()` dans le middleware au lieu de `getSessionCookie()`, garder cette approche — elle est plus robuste (vérifie la validité DB, pas juste la présence du cookie). brand-intello utilise `getSessionCookie()` uniquement pour la performance edge-runtime.

### Matcher exclusions

Si Elevay exclut des paths comme `/api/auth/*` du middleware (normal, pour ne pas intercepter les handlers Better Auth), garder ces exclusions. Ne pas protéger `/api/auth/*`.

## Route `/login`

Fichier : `brand-intel/src/app/(auth)/login/page.tsx`

**Elevay l'a déjà**. Ne pas copier. Le redirect `/login` du middleware pointera vers le login existant d'Elevay.

## Page protégée `/brand-intel`

Fichier à créer : `src/app/(dashboard)/brand-intel/page.tsx` (dans le groupe de routes protégées d'Elevay).

Contenu minimal :

```tsx
import { BrandIntelDashboard } from '@/components/brand-intel/BrandIntelDashboard'

export default function Page() {
  return <BrandIntelDashboard />
}
```

Si Elevay utilise un layout de dashboard avec sidebar + header, placer cette page dans le même groupe de routes pour hériter du layout. Exemple :

```
src/app/(dashboard)/
├── layout.tsx            ← layout existant d'Elevay (sidebar + header)
├── dashboard/
├── settings/
└── brand-intel/
    └── page.tsx          ← NOUVEAU
```

## Checklist auth

- [ ] Schema Prisma d'Elevay contient déjà `User`/`Session`/`Account`/`Verification` → OK, ne pas toucher
- [ ] `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL` définis dans `.env` d'Elevay → OK
- [ ] `src/lib/auth.ts` d'Elevay exporte `auth` avec la bonne signature → les routes copiées fonctionnent
- [ ] Middleware d'Elevay protège `/brand-intel/:path*` (matcher ajouté)
- [ ] Route `/login` d'Elevay fonctionne en redirect-target depuis le middleware

## Pièges connus

1. **Pas de session mais utilisateur authentifié en prod** — vérifier que `BETTER_AUTH_URL` en prod = domaine de l'app (sinon les cookies sont rejetés pour cross-origin).
2. **Session cookie name** — brand-intello utilise le default (`better-auth.session_token`). Si Elevay a customisé, ajuster.
3. **Stripping headers en reverse proxy** — sur Vercel, OK par défaut. Sur Cloudflare ou Nginx custom, vérifier que `cookie` header est forwardé.
