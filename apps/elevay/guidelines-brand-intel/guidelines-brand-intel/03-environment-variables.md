# 03 — Variables d'environnement

Source : `brand-intel/src/lib/env.ts` (validé par Zod au démarrage).

## Liste complète (17 variables requises)

### Auth + Database

| Var | Contrainte Zod | Rôle | Où obtenir |
|-----|----------------|------|------------|
| `DATABASE_URL` | `url()` | Connexion Postgres (Neon) | Neon dashboard → connection string (format `postgres://user:pass@host/db?sslmode=require`) |
| `BETTER_AUTH_SECRET` | `min(32)` | Secret de signature des sessions | Générer avec `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `url()` default `http://localhost:3000` | Base URL pour les callbacks Better Auth | L'URL publique de ton app |
| `NEXT_PUBLIC_APP_URL` | (utilisée dans routes OAuth) | URL publique pour Composio callback | Idem que `BETTER_AUTH_URL` en général |

### LLM

| Var | Rôle | Où obtenir |
|-----|------|------------|
| `ANTHROPIC_API_KEY` | Claude API | https://console.anthropic.com/settings/keys |

### APIs data externes (clés propriétaires, côté serveur)

| Var | Rôle | Usage | Où obtenir |
|-----|------|-------|------------|
| `SERPAPI_KEY` | Google SERP results | BPI-01 SERP + MTS-02 trends | https://serpapi.com — plan payant |
| `GNEWS_API_KEY` | News articles | BPI-01 press | https://gnews.io — plan gratuit limité |
| `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | Keyword volumes / positions / domain authority | BPI-01 SEO + CIA-03 | https://dataforseo.com — pay-as-you-go |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | BPI-01 YouTube | Google Cloud Console → APIs & Services |
| `FIRECRAWL_API_KEY` | Web scraping structuré | Scraping sites concurrents | https://firecrawl.dev |

### Composio (OAuth Facebook/Instagram)

| Var | Rôle | Où obtenir |
|-----|------|------------|
| `COMPOSIO_API_KEY` | API key Composio | https://app.composio.dev → Settings → API keys |
| `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID` | Auth config Instagram | Composio dashboard → Auth Configs |
| `COMPOSIO_FACEBOOK_AUTH_CONFIG_ID` | Auth config Facebook | Composio dashboard → Auth Configs |

> ⚠️ Les auth config IDs actuels dans brand-intello (`ac_kARFNprSLryc`, `ac_ZN-brYCj4Kf3`) sont liés à **ton compte Composio actuel**. Si Elevay utilise un autre compte Composio, il faut **créer de nouveaux auth configs** et y enregistrer le redirect URI de l'app Elevay. Voir question 13 de `19-open-questions.md`.

### Apify (fallback quand OAuth social pas connecté)

| Var | Rôle |
|-----|------|
| `APIFY_TOKEN` | Token Apify |
| `APIFY_TASK_FACEBOOK` | ID de la task Apify pour scraper Facebook public |
| `APIFY_TASK_INSTAGRAM` | ID de la task Apify pour scraper Instagram public |

> Des tasks additionnelles existent dans le `.env` réel (Twitter, TikTok, LinkedIn, Trustpilot) mais **seulement Facebook et Instagram sont strictement requis par le Zod schema**. Les autres sont optionnels et utilisés par certains modules uniquement.

Apify : https://console.apify.com → créer une task à partir d'un actor existant (Apify store), copier l'ID.

### Runtime

| Var | Rôle |
|-----|------|
| `NODE_ENV` | `development` \| `test` \| `production` — default `development` |

## Exemple `.env` complet

```bash
# ─── Auth + DB ───────────────────────────────────────────
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="<openssl rand -hex 32>"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ─── LLM ─────────────────────────────────────────────────
ANTHROPIC_API_KEY="sk-ant-api03-..."

# ─── Data APIs ───────────────────────────────────────────
SERPAPI_KEY="..."
GNEWS_API_KEY="..."
DATAFORSEO_LOGIN="..."
DATAFORSEO_PASSWORD="..."
YOUTUBE_API_KEY="AIza..."
FIRECRAWL_API_KEY="fc-..."

# ─── Composio (OAuth social) ─────────────────────────────
COMPOSIO_API_KEY="..."
COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID="ac_..."
COMPOSIO_FACEBOOK_AUTH_CONFIG_ID="ac_..."

# ─── Apify (fallback scraping) ───────────────────────────
APIFY_TOKEN="apify_api_..."
APIFY_TASK_FACEBOOK="username/task-facebook"
APIFY_TASK_INSTAGRAM="username/task-instagram"

# ─── Runtime ─────────────────────────────────────────────
NODE_ENV="development"
```

## Validation Zod — code exact (à fusionner dans `src/lib/env.ts` d'Elevay)

```ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),

  SERPAPI_KEY: z.string().min(1),
  GNEWS_API_KEY: z.string().min(1),
  DATAFORSEO_LOGIN: z.string().min(1),
  DATAFORSEO_PASSWORD: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  FIRECRAWL_API_KEY: z.string().min(1),

  COMPOSIO_API_KEY: z.string().min(1),

  APIFY_TOKEN: z.string().min(1),
  APIFY_TASK_FACEBOOK: z.string().min(1),
  APIFY_TASK_INSTAGRAM: z.string().min(1),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export const env = envSchema.parse(process.env)
```

⚠️ **Le schema ci-dessus ne contient pas `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID` ni `COMPOSIO_FACEBOOK_AUTH_CONFIG_ID` ni `NEXT_PUBLIC_APP_URL`** — ces variables sont lues via `process.env.*` directement dans les routes `src/app/api/auth/social/*`. À valider : si Elevay a un schema Zod strict, il faudra les ajouter.

## Merge avec l'env d'Elevay

1. Ouvrir `src/lib/env.ts` d'Elevay.
2. Ajouter chaque champ manquant au schema Zod existant (ne pas remplacer le fichier).
3. Ajouter les variables au `.env` et `.env.example` (créer si absent) d'Elevay.
4. Redémarrer `pnpm dev` — le parse Zod s'exécute au démarrage et **throw** si une var manque.

## Désactivation conditionnelle (si budget API limité)

Les modules dégradent gracieusement : si une API échoue, le champ apparaît dans `degraded_sources` et l'agent continue. Cependant, `env.ts` valide au boot que **toutes** les clés sont présentes. Pour désactiver un module :

**Option A (rapide)** : mettre la var à `"disabled"` (passe la validation Zod `min(1)`), et **ajouter un check dans le module** `composio.ts` pour court-circuiter l'appel.

**Option B (propre)** : passer les champs correspondants en `.optional()` dans le schema et guard dans les modules.

Voir `11-external-data-apis.md` pour la liste par module.

## Sécurité

- ❌ Ne **jamais** commiter `.env` (`.gitignore` doit le lister).
- ✅ Commit `.env.example` avec des placeholders.
- ❌ Les clés `SERPAPI_KEY`, `ANTHROPIC_API_KEY`, `APIFY_TOKEN` sont des **clés propriétaires serveur** : ne jamais préfixer avec `NEXT_PUBLIC_`.
- ✅ Seules les variables préfixées `NEXT_PUBLIC_*` sont exposées côté client (ici : `NEXT_PUBLIC_APP_URL` uniquement).
