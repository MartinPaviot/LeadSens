# 10 — Agent CIA-03 (Competitive Intelligence Architect)

## Mission

Benchmark de la marque vs concurrents sur **5 axes stratégiques** (SEO, product messaging, social, content, positioning), identifie les **zones rouges** (vulnérabilités) et **zones vertes** (opportunités blue-ocean), puis génère un **plan d'action 60 jours**.

## Fichiers

Source : `brand-intel/src/agents/cia-03/`

```
cia-03/
├── index.ts              Orchestrateur (4 modules + benchmark + recommendations)
├── prompt.ts             getSystemPrompt + buildConsolidatedPrompt (refine LLM)
├── scoring.ts
├── types.ts              CiaOutput, CompetitorScore, StrategicZone, Threat, Opportunity, ...
└── modules/
    ├── product-messaging.ts     Scraping landing pages concurrents (Firecrawl)
    ├── seo-acquisition.ts       Keywords positions concurrents (DataForSEO)
    ├── social-media.ts          Présence sociale concurrents (Apify)
    ├── content.ts               Publications concurrents (Firecrawl + analyse)
    ├── benchmark.ts             Pure fonction : scoring + strategic_zones
    └── recommendations.ts       Pure fonction : threats + opportunities + plan 60j
```

## Endpoint

`POST /api/agents/bmi/cia-03` — SSE streaming.

## Input spécifique : `brandSocialScore`

Le route handler lit le **dernier run BPI-01** pour en extraire `scores.social` et le passer à `runCia03()` comme 3e argument :

```ts
// route.ts
const lastBpi = await db.agentRun.findFirst({
  where: { workspaceId: WORKSPACE_ID, agentCode: 'BPI-01' },
  orderBy: { createdAt: 'desc' },
})
const brandSocialScore = lastBpi
  ? (lastBpi.output as AgentOutput<BpiOutput>).payload.scores.social
  : undefined

await runCia03(profile, context, brandSocialScore)
```

**Conséquence** : l'UI lance les agents dans l'ordre **BPI → MTS → CIA** pour que CIA puisse croiser avec le score social calculé par BPI.

## Flux d'exécution

Source : `src/agents/cia-03/index.ts`

```ts
export async function runCia03(profile, context, brandSocialScore?) {
  // Phase 1 — 4 modules en parallèle
  const [messaging, seo, social, content] = await Promise.allSettled([
    fetchProductMessaging(profile),
    fetchSeoAcquisition(profile),
    fetchSocialMedia(profile),
    fetchContentAnalysis(profile),
  ])

  // Phase 2 — Benchmark (pure, 0 API)
  const { scores, strategic_zones } = fetchBenchmark({
    messaging, seo, social, content, brandSocialScore, profile,
  })

  // Phase 2b — Recommendations (pure, 0 API)
  const { threats, opportunities, action_plan_60d } = buildRecommendations({
    scores, zones: strategic_zones, content, seo, context,
  })

  // Phase 3 — LLM refinement
  const llmResponse = await callLLM({
    system: getSystemPrompt(profile.language),
    user:   buildConsolidatedPrompt(profile, scores, strategic_zones, threats, opportunities),
    maxTokens: 4096,
    temperature: 0.3,
  })

  // Merge : le LLM ne change pas les scores, il refine les descriptions
  if (isLlmCiaResponse(llmResponse.parsed)) {
    // merge description/directive des zones, mise à jour threats/opportunities
  }

  return { agent_code: 'CIA-03', payload: { scores, strategic_zones, threats, opportunities, action_plan_60d, ... } }
}
```

## Pattern "LLM refinement"

Contrairement à BPI-01 (le LLM **invente** les diagnostics/priorities) et MTS-02 (le LLM enrichit et génère la roadmap), **CIA-03 utilise le LLM uniquement pour reformuler** :

- Les scores : calculés **localement** à partir des modules → le LLM n'y touche pas.
- Les zones stratégiques : calculées localement (axe + zone couleur) → le LLM **enrichit** `description` et `directive` avec un langage plus actionnable.
- Les threats/opportunities : calculés localement → le LLM les réécrit si le parse réussit, sinon on garde la version pure.

**Avantage** : déterminisme des scores. **Inconvénient** : le LLM ne peut pas ajouter de threats/opportunities hors du signal local.

## Sortie (payload)

```ts
export interface CiaOutput {
  brand_score: number                // score global de la brand
  analysis_date: string
  analysis_context: CiaSessionContext
  competitor_scores: CompetitorScore[]   // brand + concurrents, triés
  strategic_zones: StrategicZone[]       // 5 axes × zone couleur
  product_messaging: ProductMessaging[]  // phrases-clés concurrents
  seo_data: { brand_seo, competitors_seo }
  social_matrix: SocialMatrix[]
  content_gap_map: ContentGap[]
  content_competitors: ContentCompetitor[]
  threats: Threat[]         // ≥ 1
  opportunities: Opportunity[]  // ≥ 1
  action_plan_60d: ActionPlanEntry[]
}
```

### CompetitorScore

```ts
{
  entity: string           // nom brand ou concurrent
  is_client: boolean       // true pour la brand elle-même
  global_score: number     // 0-100
  level: "leader" | "challenger" | "follower" | "niche"
  seo_score: number
  product_score: number
  social_score: number
  content_score: number
  positioning_score: number
}
```

### StrategicZone

```ts
{
  axis: "seo" | "product" | "social" | "content" | "positioning"
  zone: "red" | "saturated" | "neutral" | "green"  // ← utilise ZONE_TOKENS du design system
  description: string   // enrichi par LLM
  directive: string     // enrichi par LLM
}
```

### Threat / Opportunity

```ts
// Threat
{
  description: string
  urgency: "high" | "medium" | "low"
  source: string   // "SEO gap", "Social engagement drop", ...
}

// Opportunity
{
  description: string
  effort: "low" | "medium" | "high"
  impact: "high" | "medium" | "low"
  timeframe: "< 30 days" | "30-60 days"
}
```

## Prompt système (extrait — `prompt.ts:10-34`)

```
CRITICAL: You MUST respond ENTIRELY in ${language}.

You are CIA-03, an expert Competitive Intelligence Architect.
Your role is to refine and enrich competitive analysis data with qualitative insights.

You receive pre-calculated scores, strategic zones, threats, and opportunities.
Your job is to:
1. Enrich the strategic_zones directives with specific, actionable language
2. Refine threats with more precise descriptions and context
3. Refine opportunities with concrete action steps

You MUST respond with raw JSON only (no markdown fences, no text before/after):
{
  "strategic_zones": [
    { "axis": "seo", "zone": "red|saturated|neutral|green", "description": "...", "directive": "..." }
  ],
  "threats": [
    { "description": "...", "urgency": "high|medium|low", "source": "..." }
  ],
  "opportunities": [
    { "description": "...", "effort": "low|medium|high", "impact": "high|medium|low", "timeframe": "< 30 days|30-60 days" }
  ]
}
IMPORTANT: Return raw JSON only. No ```json fences. At least 1 threat and 1 opportunity.
```

## Modules — dépendances externes

| Module | API | Env requis |
|--------|-----|------------|
| `product-messaging` | Firecrawl (scrape landing pages concurrents) | `FIRECRAWL_API_KEY` |
| `seo-acquisition` | DataForSEO | `DATAFORSEO_LOGIN/PASSWORD` |
| `social-media` | Apify (scraping public concurrents) | `APIFY_TOKEN` + tasks |
| `content` | Firecrawl + SerpAPI | `FIRECRAWL_API_KEY`, `SERPAPI_KEY` |
| `benchmark` | (pur, 0 API) | — |
| `recommendations` | (pur, 0 API) | — |

## UI qui consomme la sortie

Composant : `src/components/brand-intel/CompetitiveTab.tsx`

- **Leaderboard** : `competitor_scores` triés DESC (bars Recharts).
- **Strategic zones map** : 5 axes × 4 couleurs (red/saturated/neutral/green), utilise `ZONE_TOKENS` de `design-tokens.ts`.
- **Threats** : cards rouges avec badge urgency.
- **Opportunities** : cards vertes avec badges effort/impact/timeframe.
- **Action plan 60j** : timeline avec priorités.

## Checklist d'intégration CIA-03

- [ ] `src/agents/cia-03/**` copié
- [ ] Route `src/app/api/agents/bmi/cia-03/route.ts` copiée
- [ ] Lance BPI-01 **d'abord** pour que CIA-03 puisse cross-référencer `scores.social`
- [ ] Vérifier que le `action_plan_60d` est généré même si le LLM échoue (fallback `buildRecommendations` pure)
- [ ] `FIRECRAWL_API_KEY`, `DATAFORSEO_*`, `APIFY_TOKEN`, `SERPAPI_KEY` dans `.env`
