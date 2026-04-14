# 06 — OAuth social (Composio + fallback Apify)

## Architecture

brand-intello utilise **Composio** comme proxy OAuth pour Facebook et Instagram, et **Apify** comme fallback quand l'utilisateur n'a pas connecté son compte. Cela permet aux agents (surtout BPI-01 module `social` et CIA-03 module `social-media`) d'enrichir l'analyse avec :

- **Composio connecté** → données authentifiées (insights Facebook page, profil Instagram, posts récents)
- **Apify fallback** → scraping public (compte de follower estimé, derniers posts publics)

## Flow OAuth Composio (Facebook / Instagram)

```
┌─────────────┐  1. Click "Connect Facebook"   ┌────────────────────────┐
│   Client    │ ──────────────────────────────►│  /api/auth/social/     │
│  (Dashboard)│                                 │  connect?platform=fb   │
└─────────────┘                                 └─────────┬──────────────┘
                                                          │ 2. Init Composio session
                                                          ▼
┌──────────────┐  3. Redirect vers OAuth        ┌────────────────────────┐
│  Facebook    │◄─────────────────────────────── │       Composio         │
│  OAuth       │                                 └────────────────────────┘
│  (consent)   │  4. Callback après consent
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐  5. Verify + save account ID  ┌─────────────┐
│  /api/auth/social/       │ ────────────────────────────► │     DB      │
│  callback?platform=fb    │                                 │ BrandProfile│
└──────────────────────────┘                                 └─────────────┘
       │
       ▼
  Redirect /brand-intel?connected=facebook
```

## Routes à copier

Source : `brand-intel/src/app/api/auth/social/`

| Fichier | Méthode | Rôle |
|---------|---------|------|
| `connect/route.ts` | GET `?platform=facebook\|instagram` | Init session Composio, retourne l'URL OAuth |
| `callback/route.ts` | GET `?platform=...&session_id=...` | Valide le callback, écrit `xxxComposioAccountId` + `xxxConnected=true` sur `BrandProfile` |
| `disconnect/route.ts` | DELETE `?platform=...` | Révoque le compte Composio, clear les 2 colonnes sur `BrandProfile` |

**Copie directe** : aucun conflit dans Elevay (routes isolées sous `/api/auth/social/`).

## Champs DB concernés

Déjà définis dans le modèle `BrandProfile` (voir `04-prisma-schema-merge.md`) :

```prisma
facebookConnected          Boolean  @default(false)
facebookComposioAccountId  String?
instagramConnected         Boolean  @default(false)
instagramComposioAccountId String?
```

## Config Composio requise

1. Créer un compte sur https://app.composio.dev
2. Créer 2 **Auth Configs** (Settings → Auth Configs → New) :
   - Facebook → scope `pages_read_engagement`, `pages_show_list`, `read_insights`
   - Instagram → scope `instagram_basic`, `instagram_manage_insights`
3. Pour chaque auth config, enregistrer le **redirect URI** :
   ```
   {NEXT_PUBLIC_APP_URL}/api/auth/social/callback
   ```
   Exemples :
   - Dev : `http://localhost:3000/api/auth/social/callback`
   - Prod : `https://elevay.yourdomain.com/api/auth/social/callback`
4. Copier les IDs générés (format `ac_xxxxxxxx`) dans `.env` :
   ```
   COMPOSIO_FACEBOOK_AUTH_CONFIG_ID="ac_..."
   COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID="ac_..."
   ```

⚠️ Les auth configs sont liées à **un compte développeur Composio** (le tien). Chaque déploiement d'Elevay (dev, staging, prod) peut partager les mêmes IDs si les redirect URIs correspondent, OU nécessiter des auth configs distincts.

## Consommation des données connectées

Fichier : `brand-intel/src/agents/_shared/social-oauth.ts`

```ts
export const socialOAuth = {
  getFacebookPageInsights: (connectedAccountId: string) =>
    composioAction<{
      followers_count?: number
      page_name?: string
      posts?: Array<{ message?: string; likes?: number; shares?: number }>
    }>('FACEBOOK_GET_PAGE_INSIGHTS', connectedAccountId),

  getInstagramProfile: (connectedAccountId: string) =>
    composioAction<{
      followers_count?: number
      username?: string
      media_count?: number
      recent_media?: Array<{ caption?: string; like_count?: number; comments_count?: number }>
    }>('INSTAGRAM_GET_USER_PROFILE', connectedAccountId),
}
```

Ces fonctions appellent l'endpoint `POST https://backend.composio.dev/api/v1/actions/{action}/execute` avec le `connectedAccountId` stocké en DB.

Consommé dans `src/agents/bpi-01/modules/social.ts` et `src/agents/cia-03/modules/social-media.ts` :

```ts
if (profile.facebookConnected && profile.facebookComposioAccountId) {
  const fbData = await socialOAuth.getFacebookPageInsights(profile.facebookComposioAccountId)
  if (fbData) { /* enrichment */ }
}
// Sinon fallback Apify
```

## Fallback Apify

Fichier : `brand-intel/src/agents/_shared/apify.ts`

```ts
import { ApifyClient } from 'apify-client'
import { env } from '@/lib/env'

const client = new ApifyClient({ token: env.APIFY_TOKEN })

export async function runTask<T>(
  taskId: string,
  input: Record<string, unknown>,
  timeoutSecs = 45,
): Promise<T[]> {
  try {
    const run = await client.task(taskId).call(input, { waitSecs: timeoutSecs })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return items as T[]
  } catch (err) {
    console.warn('[Apify] Task failed:', taskId, String(err))
    return []
  }
}
```

### Pattern d'utilisation dans les modules

```ts
if (!profile.facebookConnected) {
  const items = await runTask<FbPost>(env.APIFY_TASK_FACEBOOK, {
    startUrls: [{ url: `https://www.facebook.com/${brandSlug}` }],
  })
  // parse items → SocialData
}
```

### Tasks Apify à configurer

Sur https://console.apify.com :

1. Dans **Store**, trouver un actor qui scrape la plateforme cible (ex: `apify/facebook-pages-scraper`, `apify/instagram-profile-scraper`).
2. Créer une **Task** à partir de cet actor avec une config par défaut (ex: `maxPostsPerPage: 10`).
3. Copier l'ID de la task (format `username/task-name` ou `taskId`) dans `.env` :
   ```
   APIFY_TASK_FACEBOOK="your-username/facebook-scraper"
   APIFY_TASK_INSTAGRAM="your-username/instagram-scraper"
   ```

## UI — bouton de connexion

Dans `BrandProfileForm.tsx`, la logique est (simplifiée) :

```tsx
<Button onClick={() => {
  window.location.href = '/api/auth/social/connect?platform=facebook'
}}>
  {socialStatus.facebookConnected ? 'Reconnect Facebook' : 'Connect Facebook'}
</Button>
```

Après le callback OAuth, l'utilisateur revient sur `/brand-intel?connected=facebook`, et `BrandIntelDashboard.tsx` affiche un toast (`sonner`) :

```ts
useEffect(() => {
  const connected = searchParams.get('connected')
  if (connected) {
    toast.success(`${capitalize(connected)} connected successfully`)
    setSocialStatus((prev) => ({ ...prev, [`${connected}Connected`]: true }))
    router.replace('/brand-intel')
  }
}, [searchParams, router])
```

## Sécurité

- ✅ Toutes les routes `/api/auth/social/**` vérifient la session Better Auth avant tout.
- ✅ Les `connectedAccountId` ne sont jamais exposés côté client (retour `{ connected: true }` sans l'ID).
- ❌ Pas de CSRF token custom — Better Auth + same-site cookies suffisent. Si Elevay a un CSRF middleware custom, vérifier qu'il n'intercepte pas ces routes.

## Checklist

- [ ] Compte Composio créé, API key récupérée
- [ ] 2 Auth Configs Composio créées (FB + IG) avec le bon redirect URI
- [ ] IDs collés dans `.env` d'Elevay
- [ ] Variables Apify dans `.env` d'Elevay (`APIFY_TOKEN` + tasks)
- [ ] Routes `/api/auth/social/{connect,callback,disconnect}` copiées
- [ ] Champs `xxxConnected` + `xxxComposioAccountId` présents dans `BrandProfile` (via migration Prisma)
- [ ] Test : clic sur "Connect Facebook" → redirect FB → consent → retour sur `/brand-intel?connected=facebook` avec toast

## Pièges

1. **Callback URL mismatch** — si `NEXT_PUBLIC_APP_URL` ne correspond pas au URI enregistré dans Composio, Facebook rejette le consent. Vérifier les 3 endroits (env, Composio auth config, Facebook app settings).
2. **HTTPS obligatoire en prod** — Facebook/Instagram refusent les redirect URIs `http://` sauf `localhost`.
3. **Apify timeout** — la task peut prendre >45s sur un gros compte. Le fallback gracieux (`return []`) empêche le crash, mais le module social apparaît alors dans `degraded_sources`.
4. **Tokens périmés** — Composio gère le refresh, mais si le user a révoqué l'accès côté Facebook, l'agent va échouer silencieusement et passer en degraded. Pas de re-prompt automatique — il faut que l'utilisateur clique à nouveau sur "Connect".
