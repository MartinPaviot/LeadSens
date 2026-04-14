# 11 — APIs externes utilisées par les agents

## Récap des 7 fournisseurs

| API | Usage | Module(s) | Clé env |
|-----|-------|-----------|---------|
| **SerpAPI** | Google SERP, Google Trends, Google Maps | BPI-01 serp, google-maps · MTS-02 trends, content · CIA-03 content | `SERPAPI_KEY` |
| **GNews** | Articles de presse | BPI-01 press | `GNEWS_API_KEY` |
| **YouTube Data API v3** | Recherche + stats vidéos | BPI-01 youtube · MTS-02 trends | `YOUTUBE_API_KEY` |
| **DataForSEO** | Positions mots-clés, volumes, domain authority | BPI-01 seo · CIA-03 seo-acquisition | `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` |
| **Firecrawl** | Scraping web structuré (markdown) | BPI-01 trustpilot · MTS-02 content · CIA-03 product-messaging, content | `FIRECRAWL_API_KEY` |
| **Composio** | OAuth Facebook/Instagram (insights authentifiés) | BPI-01 social · CIA-03 social-media | `COMPOSIO_API_KEY` |
| **Apify** | Fallback scraping social (FB, IG, Twitter, TikTok, LinkedIn, Trustpilot) | Partout en fallback | `APIFY_TOKEN` + tasks |

## Client HTTP générique — `_shared/composio.ts`

Ironiquement, le fichier s'appelle `composio.ts` mais gère **toutes les APIs HTTP** (SerpAPI, GNews, YouTube, DataForSEO, Firecrawl). C'est le nom historique — ne pas confondre avec le SDK `composio-core` utilisé pour l'OAuth social.

### Helper retry

```ts
async function fetchWithRetry<T>(url, options, retries): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) })
      if (!res.ok) {
        if (attempt === retries) return null
      } else {
        return (await res.json()) as T
      }
    } catch (err) {
      if (attempt === retries) return null
    }
    await new Promise<void>((r) => setTimeout(r, 1000 * (attempt + 1)))  // backoff linéaire
  }
  return null
}
```

**Comportement** : `retries` tentatives, backoff linéaire (1s, 2s, 3s), timeout 15s par appel, **retourne `null`** en cas d'échec (pas de throw).

### Export

```ts
export const composio = {
  searchSerp,     // SerpAPI : Google SERP results
  searchNews,     // GNews : recherche articles
  getYoutube,     // YouTube API v3 : search + stats
  getKeywords,    // DataForSEO : keyword volumes
  scrapeUrl,      // Firecrawl : scrape URL → markdown
}
```

## SerpAPI

**Endpoint** : `https://serpapi.com/search.json`

```ts
async function searchSerp(q: string, num = 10) {
  const params = new URLSearchParams({
    api_key: env.SERPAPI_KEY,
    q, num: String(num),
    engine: 'google',
  })
  return fetchWithRetry(`https://serpapi.com/search.json?${params}`, { method: 'GET' }, 2)
}
```

**Engines utilisés** : `google` (SERP), `google_maps` (dans `bpi-01/modules/google-maps.ts`), `google_trends` (dans `mts-02/modules/trends.ts`), `youtube` (alternative à l'API native).

**Tarif** : ~$5 / 1000 requêtes. Le plan `developer` permet 5000 searches/mois.

## GNews

**Endpoint** : `https://gnews.io/api/v4/search`

```ts
async function searchNews(q: string, lang = 'fr') {
  const params = new URLSearchParams({
    apikey: env.GNEWS_API_KEY,
    q, lang, max: '10',
  })
  return fetchWithRetry(`https://gnews.io/api/v4/search?${params}`, { method: 'GET' }, 1)
}
```

**Tarif** : gratuit jusqu'à 100 req/jour, payant au-delà.

## YouTube Data API v3

**2 endpoints chaînés** : `search` puis `videos` (pour récupérer les stats).

```ts
async function getYoutube(q: string) {
  // 1. Search → video IDs
  const searchResult = await fetchWithRetry(`.../youtube/v3/search?${params}`, ...)

  // 2. Videos → stats (views, likes, comments)
  const videoIds = searchResult.items.map(i => i.id?.videoId).filter(Boolean).join(',')
  const statsResult = await fetchWithRetry(`.../youtube/v3/videos?${statsParams}`, ...)
  return statsResult ?? searchResult
}
```

**Tarif** : gratuit. Quota par défaut : 10 000 unités/jour (search = 100 unités, videos = 1 unité → ~100 searches/jour ou 10k videos-lookup).

## DataForSEO

**Endpoint** : `https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live`

Auth : Basic auth (Base64 de `login:password`).

```ts
async function getKeywords(keywords: string[], country = 'fr') {
  const auth = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString('base64')
  return fetchWithRetry('.../keywords_data/google_ads/search_volume/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      keywords,
      location_name: country === 'fr' ? 'France' : country === 'us' ? 'United States' : country,
      language_name: 'French',
    }]),
  }, 2)
}
```

**Tarif** : pay-as-you-go, ~$0.05 / 1000 keywords.

**⚠️ `language_name` hardcodé** : `"French"`. Si Elevay veut supporter des brands anglophones, il faut mapper `profile.language` → DataForSEO `language_name`. (Voir question à traiter dans l'adaptation.)

## Firecrawl

**Endpoint** : `https://api.firecrawl.dev/v1/scrape`

```ts
async function scrapeUrl(url: string) {
  const result = await fetchWithRetry<{ success?: boolean; data?: unknown }>(
    'https://api.firecrawl.dev/v1/scrape',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    }, 1,
  )
  return result?.data ?? result
}
```

**Tarif** : $20/mois pour 3000 pages, scale ensuite.

## Apify

Voir `06-social-oauth-composio.md` pour la partie OAuth / fallback. Rappel :

```ts
import { ApifyClient } from 'apify-client'
const client = new ApifyClient({ token: env.APIFY_TOKEN })

export async function runTask<T>(taskId, input, timeoutSecs = 45): Promise<T[]> {
  try {
    const run = await client.task(taskId).call(input, { waitSecs: timeoutSecs })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return items as T[]
  } catch { return [] }
}
```

**Tasks requises (min)** :
- `APIFY_TASK_FACEBOOK`
- `APIFY_TASK_INSTAGRAM`

**Tasks optionnelles** (utilisées par certains modules — social-listening notamment) :
- Twitter, TikTok, LinkedIn, Trustpilot

## Composio (OAuth social)

Voir `06-social-oauth-composio.md`.

**Endpoint backend Composio** : `POST https://backend.composio.dev/api/v1/actions/{action}/execute`

Actions utilisées :
- `FACEBOOK_GET_PAGE_INSIGHTS`
- `INSTAGRAM_GET_USER_PROFILE`

## Rate limiting

⚠️ **Aucun rate limiting côté brand-intello**. Les routes `/api/agents/bmi/*` peuvent être spammées par un utilisateur authentifié. Pour Elevay en prod :

- Ajouter un middleware rate-limit sur les routes agents (ex: Upstash Rate Limit, 3 runs / user / heure).
- Éventuellement introduire une queue (BullMQ, Trigger.dev) pour les runs longs.

Voir question 12 de `19-open-questions.md` pour le budget API.

## Cache

⚠️ **Aucun cache côté brand-intello**. Chaque run hit les APIs en live. Pour économiser :

- Mémoriser les résultats SerpAPI / YouTube pendant 24h (clé = `brand_url + keyword + date`).
- Réutiliser le module `synthesis` (MTS-02) pour les relances dans la même journée.

Solution simple : `unstable_cache` de Next.js ou une table DB `AgentCache`.

## Budget estimatif par run complet (3 agents)

Par brand / par run complet (BPI + MTS + CIA) :

| Source | Appels estimés | Coût |
|--------|----------------|------|
| SerpAPI | ~15 | $0.075 |
| DataForSEO | ~5 | $0.005 |
| GNews | 1-2 | Free tier |
| YouTube | 2-3 | Gratuit (quota) |
| Firecrawl | ~10 | ~$0.10 |
| Apify | 2-4 tasks | ~$0.10 |
| Composio | 0-2 actions | Variable selon plan |
| Anthropic (Claude) | 3 appels | ~$0.10-0.18 |

**Total ≈ $0.40 / run complet**. Donc 2500 runs/mois = $1000/mois d'APIs externes. À prendre en compte dans le plan de prix d'Elevay.

## Checklist APIs

- [ ] Tous les comptes créés, clés dans `.env`
- [ ] Test rapide de chaque API en isolé (curl ou Postman) avant de lancer les agents
- [ ] Rate limit côté Elevay configuré si prod
- [ ] Stratégie de cache définie si volume > 1000 runs/jour
