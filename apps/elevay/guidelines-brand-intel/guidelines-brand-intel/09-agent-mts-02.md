# 09 — Agent MTS-02 (Market Trend Strategist)

## Mission

Détection des **sujets tendance** vs **sujets saturés** dans le secteur de la marque, avec un **plan de contenu 30 jours** (8 entrées min, 2 par semaine × 4 semaines) adapté aux canaux prioritaires choisis par l'utilisateur.

## Fichiers

Source : `brand-intel/src/agents/mts-02/`

```
mts-02/
├── index.ts              Orchestrateur (3 phases : parallèle / séquentiel / synthèse)
├── prompt.ts             getSystemPrompt + buildConsolidatedPrompt
├── scoring.ts            calculateMtsScore (global opportunity score)
├── types.ts              MtsOutput, TrendingTopic, SaturatedTopic, RoadmapEntry, SynthesisData, ...
└── modules/
    ├── trends.ts             Google Trends signals (via SerpAPI)
    ├── content.ts            Top-ranking content analysis (dépend de trends.ts)
    ├── competitive.ts        Publication cadence concurrents
    ├── social-listening.ts   Signaux sociaux (Apify)
    └── synthesis.ts          Pure fonction : aggrège tout sans API externe
```

## Endpoint

`POST /api/agents/bmi/mts-02` — SSE streaming. Body : `{ priority_channels?: string[] }` (sinon lit depuis `BrandProfile.priority_channels`).

## Flux d'exécution

Source : `src/agents/mts-02/index.ts`

```ts
export async function runMts02(profile, context): Promise<AgentOutput<MtsOutput>> {
  // Phase 1 — 3 modules en parallèle
  const [trends, competitive, social] = await Promise.allSettled([
    fetchTrends(profile),
    fetchCompetitive(profile),
    fetchSocialListening(profile),
  ])

  // Phase 2 — séquentiel : fetchContent dépend de trends
  const content = await fetchContent(profile, trends)

  // Phase 3 — synthesis pure (zero API)
  const synthesis = runSynthesis({ trends, content, competitive, social, profile })

  // Score global
  const globalScore = calculateMtsScore(synthesis)

  // Phase 4 — 1 seul appel LLM
  const llmResponse = await callLLM({
    system: getSystemPrompt(profile.language),
    user:   buildConsolidatedPrompt(profile, context, synthesis, globalScore),
    maxTokens: 4096,
    temperature: 0.4, // ← légèrement plus créatif que BPI-01
  })

  // Fusion LLM + synthesis
  // ...
  return { agent_code: 'MTS-02', payload, degraded_sources, ... }
}
```

## Context session (input)

```ts
export interface MtsSessionContext {
  sector: string             // héritage BrandProfile.sector
  priority_channels: string[] // ex: ["SEO", "LinkedIn", "YouTube"]
  analysis_period?: string    // "30 jours" par défaut
  mode?: 'ponctuel' | 'ongoing'
}
```

Le context est construit côté route handler à partir du BrandProfile + du body POST.

## Sortie (payload)

```ts
export interface MtsOutput {
  global_score: number        // 0-100 (opportunity score)
  sector: string
  analysis_period: string     // "30 jours"
  mode: 'ponctuel'
  session_context: MtsSessionContext

  trending_topics: TrendingTopic[]      // ≥ 3, scoring LLM-enrichi
  saturated_topics: SaturatedTopic[]    // topics à éviter
  content_gap_map: ContentGap[]         // keywords où brand est absente
  format_matrix: FormatMatrix[]         // canaux × formats dominants
  social_signals: SocialSignal[]        // signaux émergents LinkedIn/Twitter
  differentiating_angles: string[]      // 3-5 angles uniques pour la marque

  roadmap_30d: RoadmapEntry[]           // ≥ 8 entrées, au moins 1/semaine/canal
  opportunity_scores: Record<string, number>  // topic → score (pour O(1) UI)
}
```

### RoadmapEntry

```ts
{
  week: 1 | 2 | 3 | 4
  canal: "SEO" | "LinkedIn" | "YouTube" | "Instagram" | ...
  format: "Long-form article" | "Carousel" | "Short video" | "Tutorial" | ...
  suggested_title: string    // titre concret et accrocheur
  topic: string              // lien avec un trending_topic
  priority: "high" | "medium" | "low"
  objective: "SEO" | "lead_gen" | "branding" | "activation" | ...
}
```

### TrendingTopic

```ts
{
  topic: string
  opportunity_score: number   // 0-100
  growth_4w: number           // % croissance 4 semaines
  best_channel: string
  classification: "strong_trend" | "buzz" | "weak_signal" | "saturation"
  source_confirmation: string[] // ex: ["google_trends", "youtube"]
  estimated_horizon: "< 2 weeks" | "1-3 months" | "3-6 months"  // ⚠️ anglais forcé
  suggested_angle: string
}
```

## Prompt système — règle critique

Source : `prompt.ts:6` (première ligne)

> `CRITICAL: You MUST respond ENTIRELY in ${language}. Every field value must be in ${language}. Never use French if language is English. Use "months" not "mois", "weeks" not "semaines".`

**Raison** : les agents Claude ont tendance à mélanger FR/EN dans les enums. `estimated_horizon` doit rester anglais (pour l'UI qui parse ces strings), même quand tout le reste du texte est en français.

## Règles mandatoires du prompt

- `trending_topics` : **≥ 3** items
- `saturated_topics` : peut être vide
- `differentiating_angles` : 3 à 5 angles
- `roadmap_30d` : **≥ 8 items**, 2 par semaine sur les 4 semaines, couvrant **tous** les canaux dans `priority_channels`
- `classification` ∈ `{ "strong_trend", "buzz", "weak_signal", "saturation" }`
- `estimated_horizon` ∈ `{ "< 2 weeks", "1-3 months", "3-6 months" }`
- `priority` ∈ `{ "high", "medium", "low" }`

## Scoring local (synthesis)

`runSynthesis({ trends, content, competitive, social, profile })` calcule sans LLM :
- `trending_topics` préliminaires (scorés depuis les data Google Trends + YouTube)
- `saturated_topics` (topics avec trop de concurrents et peu de croissance)
- `content_gap_map` (keywords où la marque n'est pas dans le top 10 SERP)
- `format_matrix` (pour chaque canal, formats dominants)
- `social_signals` (top 5 signaux Twitter/LinkedIn)

Le LLM **enrichit** ensuite : il refine les classifications, ajoute des `suggested_angle`, génère la roadmap.

## Fallback si LLM échoue

Si `isLlmMtsResponse(llmResponse.parsed)` est `false` :

```ts
let trendingTopics = synthesis.trending_topics   // locale
let saturatedTopics = synthesis.saturated_topics // locale
let differentiatingAngles: string[] = []         // vide
let roadmap30d: RoadmapEntry[] = []              // vide
```

L'UI affiche un warning mais peut quand même montrer les topics et la heatmap de saturation.

## Modules — dépendances externes

| Module | API | Env requis |
|--------|-----|------------|
| `trends` | SerpAPI (Google Trends + YouTube) | `SERPAPI_KEY`, `YOUTUBE_API_KEY` |
| `content` | SerpAPI + Firecrawl (top-ranking pages) | `SERPAPI_KEY`, `FIRECRAWL_API_KEY` |
| `competitive` | Apify (scraping publications concurrents) | `APIFY_TOKEN` + tasks |
| `social-listening` | Apify (Twitter, LinkedIn posts) | `APIFY_TOKEN` + tasks |
| `synthesis` | (pur, 0 API) | — |

## UI qui consomme la sortie

Composant : `src/components/brand-intel/TrendsTab.tsx`

- **Trending topics** : cards triées par `opportunity_score` DESC, avec badge classification.
- **Saturated topics** : warning cards avec `reason`.
- **Roadmap 30j** : vue calendrier semaine × canal, couleur par priority (high/medium/low).
- **Content gap map** : liste des keywords manqués avec volume.

## Checklist d'intégration MTS-02

- [ ] `src/agents/mts-02/**` copié
- [ ] Route `src/app/api/agents/bmi/mts-02/route.ts` copiée
- [ ] `SERPAPI_KEY`, `YOUTUBE_API_KEY`, `FIRECRAWL_API_KEY`, `APIFY_TOKEN` dans `.env`
- [ ] Test : `curl POST` → doit stream `status` → `result` avec `roadmap_30d` ≥ 8 entrées
- [ ] Vérifier que `priority_channels` du profile est bien propagé au prompt user (sinon roadmap ne respecte pas les canaux)
