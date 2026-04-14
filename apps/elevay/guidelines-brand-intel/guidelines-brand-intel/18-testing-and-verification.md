# 18 — Testing et vérification end-to-end

## Niveaux de vérification

1. **Statique** : `pnpm typecheck`, `pnpm lint`
2. **Démarrage** : `pnpm dev` sans erreur (Zod parse l'env)
3. **Unitaire** : Vitest sur les fonctions pures (scoring, synthesis)
4. **Route** : curl direct sur chaque endpoint (auth, brand-profile, agents, social)
5. **UI** : smoke test manuel dans le browser
6. **Persistence** : vérif DB via Prisma Studio après chaque run

## 1. Vérifications statiques

```bash
pnpm typecheck      # 0 erreurs attendues
pnpm lint           # 0 erreurs bloquantes
```

### Erreurs typiques et leurs causes

| Erreur | Cause | Fix |
|--------|-------|-----|
| `Module '@/generated/prisma/client' not found` | Choix Prisma generator path | Soit adopter le path custom dans Elevay, soit find & replace `@/generated/prisma` → `@prisma/client` dans les fichiers copiés |
| `Property 'brandProfile' does not exist on type 'PrismaClient'` | `prisma generate` pas exécuté | `pnpm prisma generate` |
| `Cannot find module 'composio-core'` | Deps manquantes | Re-check Phase 1 de la checklist |
| `env.ts: Expected string, received undefined at SERPAPI_KEY` | Env var manquante | Ajouter au `.env` |
| `env.ts: String must contain at least 32 characters at BETTER_AUTH_SECRET` | Secret trop court | `openssl rand -hex 32` |

## 2. Démarrage

```bash
pnpm dev
```

Output attendu :
```
  ▲ Next.js 16.2.2
  - Local:        http://localhost:3000

 ✓ Ready in 2.3s
```

Si crash immédiat : c'est probablement Zod qui refuse une env var. Lire le message d'erreur, ajouter la var.

## 3. Tests unitaires (Vitest)

Fichier exemple : `src/agents/bpi-01/scoring.test.ts` (à créer si souhaité).

brand-intello n'a pas de tests automatisés inclus. Scripts disponibles :

```bash
pnpm test           # run all
pnpm test:watch     # watch mode
```

### Suggestions de tests à écrire

- `calculateBpiScores({...})` — cases all-null, all-full, partial → scores attendus
- `parseRobust()` dans `llm.ts` — strings avec fences, trailing commas, garbage prefix
- `runSynthesis({...})` dans `mts-02/modules/synthesis.ts` — input fixtures → output fixtures
- Type guards `isLlmBpiResponse`, `isLlmMtsResponse`, `isLlmCiaResponse` — cas limites

## 4. Tests de routes (curl)

### Prérequis

1. Login via l'UI pour récupérer le cookie de session :
   ```
   Cookie: better-auth.session_token=eyJhbGc...
   ```
2. Copier le cookie dans les commandes curl ci-dessous.

### Route `GET /api/agents/bmi/dashboard`

```bash
curl -s http://localhost:3000/api/agents/bmi/dashboard \
  -H "Cookie: better-auth.session_token=TOKEN" | jq .
```

Si aucun run encore : `{ "bpi": null, "mts": null, "cia": null, "profile": null }`.

### Route `POST /api/brand-profile`

```bash
curl -X POST http://localhost:3000/api/brand-profile \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=TOKEN" \
  -d '{
    "brand_name": "TestBrand",
    "brand_url": "https://testbrand.example",
    "country": "fr",
    "language": "fr",
    "primary_keyword": "test product",
    "secondary_keyword": "test service",
    "priority_channels": ["SEO", "LinkedIn", "YouTube"],
    "competitors": [
      { "name": "Competitor A", "url": "https://competitor-a.example" },
      { "name": "Competitor B", "url": "https://competitor-b.example" }
    ]
  }'
```

Expected : `200` + profile JSON.

### Route `POST /api/agents/bmi/bpi-01` (SSE)

```bash
curl -N -X POST http://localhost:3000/api/agents/bmi/bpi-01 \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=TOKEN" \
  -d '{}'
```

Expected : stream de events `data: ...` pendant ~15-30s, puis close.

Si `400 NO_PROFILE` : créer un brand profile d'abord (voir ci-dessus).

### Idem MTS-02 et CIA-03

Identique mais avec `body={"priority_channels": ["SEO", "LinkedIn"]}` si tu veux override les canaux.

### Route `GET /api/auth/social/connect?platform=facebook`

```bash
curl -I "http://localhost:3000/api/auth/social/connect?platform=facebook" \
  -H "Cookie: better-auth.session_token=TOKEN"
```

Expected : `302 Location: https://www.facebook.com/dialog/oauth?...` (ou URL Composio intermédiaire).

## 5. Smoke test UI

1. Ouvrir `http://localhost:3000/brand-intel`
2. Attendu : spinner → dashboard avec **mock data** (si pas de runs) ou vraies data.
3. Cliquer sur l'icône ⚙️ (Settings / GearSix) → formulaire BrandProfile.
4. Remplir :
   - Brand name
   - URL (valide)
   - Country / Language (dropdowns)
   - 2 keywords
   - ≥ 1 concurrent
   - ≥ 1 priority channel
5. "Save" → toast "Profile saved".
6. Cliquer sur "Run all agents" :
   - Le bouton passe en "Running..."
   - `AgentProgress` affiche BPI en running → progression SSE texte
   - Au bout de ~30s, BPI → done, tab "Online Presence" se met à jour avec les vraies data
   - MTS démarre, puis CIA
7. Naviguer entre les 4 tabs :
   - **Overview** : cross-signals (danger/opportunity/action)
   - **Online Presence** : bar chart 6 axes + diagnostics + priorités 90j
   - **Trends** : trending topics + roadmap 30j + saturated topics
   - **Competitive** : leaderboard + strategic zones + threats/opportunities
8. Cliquer "Connect Facebook" dans le profile form :
   - Redirect vers Facebook/Composio
   - Consent
   - Retour sur `/brand-intel?connected=facebook`
   - Toast success
9. Relancer BPI-01 : `social_data` doit être enrichi avec les insights Composio.

## 6. Vérification DB (Prisma Studio)

```bash
pnpm prisma studio
```

Ouvrir http://localhost:5555 et vérifier :

- Table `brand_profile` : 1 ligne avec les valeurs saisies dans le formulaire
- Table `agent_run` : 3 lignes (BPI-01, MTS-02, CIA-03) avec `status = COMPLETED` (ou `PARTIAL` si certaines APIs ont échoué)
- `output` : JSON non vide, structure `AgentOutput<T>` (`agent_code`, `analysis_date`, `brand_profile`, `payload`, `degraded_sources`, `version`)
- `degradedSources` : array vide si toutes les APIs ont répondu, sinon liste des modules dégradés

## Health checks production (après deploy)

Pour Vercel / prod :

```bash
# 1. Page publique
curl -I https://elevay.example.com/
# Expected: 200

# 2. Route auth (doit fonctionner sans session, c'est Better Auth)
curl -I https://elevay.example.com/api/auth/session
# Expected: 200 avec body { data: null, error: null } si pas loggué

# 3. Route agents sans auth
curl -I -X POST https://elevay.example.com/api/agents/bmi/bpi-01
# Expected: 401 UNAUTHORIZED
```

## Débuggage en cas d'échec d'agent

Les agents loggent verbeusement dans la console serveur :

```
[LLM] { model: 'claude-sonnet-4-6-20250219', tokens: { input: 2847, output: 1203 }, latencyMs: 12043, parsedOk: true }
[API] 429 Too Many Requests — https://serpapi.com/search.json?...
[Apify] Task failed: my-username/facebook-scraper — Error: timeout
```

Si un agent reste en `running` sans jamais finir :
1. Ouvrir la Network tab du browser → voir le stream `/api/agents/bmi/bpi-01`
2. Vérifier qu'il y a bien des events `data: ...`
3. Si pas d'events : le serveur plante silencieusement — vérifier les logs serveur
4. Si events mais pas de `finish` : le module bloque (probablement un fetch sans timeout)

## Monitoring recommandé pour prod

- **Logs structurés** : remplacer `console.info/warn/error` par un logger (Pino, Winston) avec niveau + context.
- **Error tracking** : Sentry sur le frontend et le backend.
- **Metrics LLM** : tracker `tokens.input`, `tokens.output`, `latencyMs` par agent pour surveiller les coûts.
- **Rate limiting** : Upstash ou équivalent sur `/api/agents/bmi/*`.

## Tests unitaires actuels dans brand-intello

Le repo actuel n'a **aucun test unitaire**. La config Vitest existe (`vitest.config.ts`) mais aucun fichier `*.test.ts` n'est présent. C'est à améliorer en Phase post-intégration.
