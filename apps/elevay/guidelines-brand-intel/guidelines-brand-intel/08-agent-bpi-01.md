# 08 — Agent BPI-01 (Brand Presence Intelligence)

## Mission

Audit **360°** de la présence en ligne d'une marque sur 8 dimensions, avec diagnostic qualitatif IA + 3 priorités d'action 90 jours.

## Fichiers

Source : `brand-intel/src/agents/bpi-01/`

```
bpi-01/
├── index.ts              Orchestrateur principal
├── prompt.ts             getSystemPrompt + buildConsolidatedPrompt
├── scoring.ts            calculateBpiScores (pure, déterministe)
├── types.ts              BpiOutput, BpiScores, AxisDiagnostic, Priority90d, ...
└── modules/
    ├── serp.ts           Google SERP (SerpAPI)
    ├── press.ts          Articles de presse (GNews)
    ├── youtube.ts        Vidéos + stats (YouTube Data API v3)
    ├── social.ts         Insights Facebook/Instagram (Composio + Apify fallback)
    ├── seo.ts            Positions mots-clés + domain authority (DataForSEO)
    ├── benchmark.ts      Comparaison vs concurrents
    ├── google-maps.ts    Reputation Google Maps
    └── trustpilot.ts     Trustpilot reviews (Firecrawl scrape)
```

## Endpoint

`POST /api/agents/bmi/bpi-01` — SSE streaming. Body : `{ }` (tout vient du BrandProfile persisté en DB).

## Flux d'exécution

Source : `src/agents/bpi-01/index.ts` lignes 26-132

```ts
export async function runBpi01(profile: AgentProfile): Promise<AgentOutput<BpiOutput>> {
  // 1. 8 modules en parallèle
  const [serp, press, youtube, social, seo, benchmark, googleMaps, trustpilot] =
    await Promise.allSettled([
      fetchSerp(profile), fetchPress(profile), fetchYoutube(profile), fetchSocial(profile),
      fetchSeo(profile), fetchBenchmark(profile), fetchGoogleMaps(profile), fetchTrustpilot(profile),
    ])

  // 2. Extraction + degradedSources
  // ... (voir code)

  // 3. Scoring local (déterministe, 0-100 par axe)
  const scores = calculateBpiScores({ serp, press, youtube, social, seo, benchmark })

  // 4. 1 seul appel LLM
  const llmResponse = await callLLM({
    system: getSystemPrompt(profile.language ?? 'English'),
    user:   buildConsolidatedPrompt(profile, scores, modules, socialEnrichment),
    maxTokens: 4096,
    temperature: 0.3,
  })

  // 5. Parse + merge
  // 6. Retourne AgentOutput<BpiOutput>
}
```

## Scores (axes)

6 scores axes + 1 score global + completeness :

```ts
export interface BpiScores {
  global: number        // 0-100, moyenne pondérée des 6 axes
  completeness: number  // % de modules avec data valide (0-100)
  serp: number
  press: number
  youtube: number
  social: number
  seo: number
  benchmark: number
  previous?: { /* run précédent pour delta UI */ }
}
```

Les 2 modules `googleMaps` et `trustpilot` ne contribuent **pas** au score global — ils servent uniquement d'enrichissement qualitatif dans le prompt et la sortie.

## Sortie (payload)

```ts
export interface BpiOutput {
  scores: BpiScores
  serp_data: SerpData | null
  press_data: PressData | null
  youtube_data: YoutubeData | null
  social_data: SocialData | null
  seo_data: SeoData | null
  benchmark_data: BenchmarkData | null
  googleMapsReputation: GoogleMapsData | null
  trustpilot: TrustpilotData | null
  axis_diagnostics: AxisDiagnostic[]   // [{ axis, diagnostic }] x 6
  priorities_90d: Priority90d[]        // [{ action, tag, source_problem }] x 3
  warning?: string                     // si LLM parse a échoué
}
```

## Prompt système (extrait — `prompt.ts:15-44`)

```
CRITICAL: You MUST respond ENTIRELY in ${language}. Every single field value must be in ${language}.

You are an expert Brand Presence Intelligence analyst.
Analyse the provided data and return a JSON object with exactly this structure:

{
  "axis_diagnostics": [
    {"axis": "serp",      "diagnostic": "One sentence analysis of SERP visibility"},
    {"axis": "press",     "diagnostic": "One sentence analysis of press coverage"},
    {"axis": "youtube",   "diagnostic": "One sentence analysis of YouTube presence"},
    {"axis": "social",    "diagnostic": "One sentence analysis of social media"},
    {"axis": "seo",       "diagnostic": "One sentence analysis of SEO performance"},
    {"axis": "benchmark", "diagnostic": "One sentence analysis vs competitors"}
  ],
  "priorities_90d": [
    {"action": "...", "tag": "Urgent",    "source_problem": "..."},
    {"action": "...", "tag": "Mid-term",  "source_problem": "..."},
    {"action": "...", "tag": "Quick win", "source_problem": "..."}
  ]
}

MANDATORY RULES:
- Return ONLY the JSON object. No markdown fences. No text before or after.
- axis_diagnostics MUST have exactly 6 items with these axis keys: serp, press, youtube, social, seo, benchmark
- priorities_90d MUST have exactly 3 items. NEVER return an empty array.
- tag MUST be one of: "Urgent", "Mid-term", "Quick win"
```

## Prompt user (structure)

Sections injectées dans l'ordre :

1. Brand Profile (name, URL, sector, country, keywords, competitors)
2. **Global Score** + completeness
3. **Axis Scores** (les 6 chiffres)
4. **Raw Data Summary** par module (SERP positions, press article count, YouTube top videos, social enrichment Composio/Apify, SEO keyword positions, benchmark ranking, Google Maps rating, Trustpilot rating)
5. Instruction finale : `"Produce your diagnosis and 90-day priorities in ${lang}."`

## Modules — dépendances externes

| Module | API | Env requis | Coût approx / call |
|--------|-----|------------|---------------------|
| `serp` | SerpAPI | `SERPAPI_KEY` | $5 / 1k calls |
| `press` | GNews | `GNEWS_API_KEY` | Free tier = 100/jour |
| `youtube` | YouTube Data API v3 | `YOUTUBE_API_KEY` | Gratuit (quotas) |
| `social` | Composio OR Apify | `COMPOSIO_API_KEY` + `APIFY_*` | Apify = $ / run |
| `seo` | DataForSEO | `DATAFORSEO_LOGIN/PASSWORD` | Pay-as-you-go |
| `benchmark` | Combinaison | (utilise les autres) | Gratuit |
| `google-maps` | SerpAPI (Maps engine) | `SERPAPI_KEY` | $5 / 1k |
| `trustpilot` | Firecrawl scrape | `FIRECRAWL_API_KEY` | $ / scrape |

## Route handler — points critiques

Source : `src/app/api/agents/bmi/bpi-01/route.ts`

```ts
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // 1. Auth
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // 2. Load profile (guard NO_PROFILE)
  const profileRow = await db.brandProfile.findUnique({ where: { workspaceId: WORKSPACE_ID } })
  if (!profileRow) {
    return Response.json({ error: 'NO_PROFILE', message: '...' }, { status: 400 })
  }

  // 3. Previous run pour delta
  const previousRun = await db.agentRun.findFirst({
    where: { workspaceId: WORKSPACE_ID, agentCode: 'BPI-01' },
    orderBy: { createdAt: 'desc' },
  })

  // 4. Build AgentProfile depuis DB row (incluant Composio IDs)
  // 5. Ouvrir SSE stream
  return createSSEStream(async (emit) => {
    emit('status', { message: "[0/8] Démarrage de l'audit...", index: 0, total: 8 })
    // ...
    const output = await runBpi01(profile)

    // Attach previous scores pour delta UI
    if (previousScores) {
      output.payload.scores.previous = { /* snapshot N-1 */ }
    }

    // Emit module completion statuses
    modulesEmitted.forEach((mod, i) => {
      const degraded = output.degraded_sources.includes(mod)
      emit('status', { message: `[${i + 1}/8] ${mod} ${degraded ? '⚠' : '✓'}`, ... })
    })

    // Persist
    await db.agentRun.create({ data: { /* ... */ } })

    emit('result', { output: output.payload })
    emit('finish', { durationMs: Date.now() - startedAt, degraded_sources: output.degraded_sources })
  })
}
```

## UI qui consomme la sortie

Composant : `src/components/brand-intel/AuditTab.tsx`

- Affiche un **bar chart Recharts** avec les 6 scores d'axe.
- Affiche les `axis_diagnostics` sous forme de cards.
- Affiche les `priorities_90d` avec badge Urgent/Mid-term/Quick win (couleurs `URGENCY_TOKENS` de `design-tokens.ts`).
- Affiche le delta vs `scores.previous` si présent (flèche haut/bas + couleur `getDeltaColor`).

## Checklist d'intégration BPI-01

- [ ] `src/agents/bpi-01/**` copié intégralement
- [ ] Vars d'env `SERPAPI_KEY`, `GNEWS_API_KEY`, `YOUTUBE_API_KEY`, `DATAFORSEO_*`, `FIRECRAWL_API_KEY` présentes
- [ ] `src/app/api/agents/bmi/bpi-01/route.ts` copié et imports réajustés si `@/generated/prisma` → `@prisma/client`
- [ ] Profile test créé dans la DB (via UI ou Prisma Studio)
- [ ] Appel curl de smoke test :
  ```bash
  curl -N -X POST http://localhost:3000/api/agents/bmi/bpi-01 \
    -H "Cookie: better-auth.session_token=..."
  ```
  → doit streamer des events `data: {"event":"status",...}` puis `data: {"event":"result",...}` puis `finish`.
