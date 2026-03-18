# agentCIA-03.md — Competitive Intelligence Architect

> Claude Code doit lire ce fichier intégralement avant d'écrire ou modifier tout code dans `brand-market-intelligence/cia-03/`.
> Ce fichier fait autorité sur le comportement de l'agent. En cas de conflit avec une autre source, ce fichier prime.

---

## 1. Identité

| Champ | Valeur |
|-------|--------|
| Code | `CIA-03` |
| Nom | Competitive Intelligence Architect |
| Catégorie | Brand & Market Intelligence |
| Statut | Actif — Production V1 |
| Durée d'exécution | 8 à 20 minutes (selon nombre de concurrents) |
| Activation | Bouton quick reply `"Analyser mes concurrents"` dans le chat |

**Rôle :** Produire une analyse compétitive complète sur 6 axes, générer un score de compétitivité par concurrent, détecter les zones d'attaque disponibles (Zone Verte) et les faiblesses critiques (Zone Rouge), et produire un plan d'action 60 jours calibré selon l'objectif.

**Ce que cet agent n'est pas :** un audit SEO isolé, un tableau comparatif statique, un veilleur passif, un outil de surveillance de prix.

**Position dans la trilogie :** CIA-03 est le plus "consommateur" des trois agents. En V2, il importera les outputs JSON de BPI-01 (SERP + SEO) et MTS-02 (content_gap_map) sans recollecte, réduisant le temps d'analyse de 20 à moins de 8 minutes.

---

## 2. Onboarding et profil

### Profil mutualisé (chargé automatiquement)

```typescript
// Données du profil mutualisé utilisées par CIA-03
{
  brand_name: string         // référence centrale du benchmark
  brand_url: string          // référence DA et SEO
  country: string
  language: string
  competitors: Competitor[]  // 2 à 3 depuis l'onboarding — extensible à 5 au lancement
  primary_keyword: string    // 3 requêtes SERP batch
  secondary_keyword: string
}
```

**Défaut :** 3 concurrents (optimal qualité/coût). Maximum : 5. Au-delà de 5, les coûts explosent et la qualité de l'analyse se dilue.

### Questions contextuelles au lancement (dans le chat)

CIA-03 pose **2 questions légères** dans le chat à chaque session. Ces données ne sont **pas** stockées dans le profil permanent — elles varient selon l'objectif du moment.

```typescript
interface CiaSessionContext {
  priority_channel: 'SEO' | 'paid' | 'social' | 'product' | 'global'
  objective: 'attack' | 'domination' | 'investor'
}
```

**L'utilisateur peut également ajouter un 4e ou 5e concurrent à la volée** lors de la confirmation du périmètre. Valider que le total reste ≤ 5.

**Confirmation obligatoire avant lancement :**

```
"Je lance l'analyse de [marque] vs [Concurrent A] + [Concurrent B] + [Concurrent C] — marché [Pays] — focus [Canal] — objectif : [Objectif]. [N] concurrents — estimation : [durée]. Je confirme et lance ?"
```

---

## 3. Les 6 modules d'analyse

### Pipeline d'exécution

```
Promise.allSettled([
  runProductMessagingModule(profile),  // Module 1 — scraping pages web
  runSeoAcquisitionModule(profile),    // Module 2 — DataForSEO + SerpAPI
  runSocialMediaModule(profile),       // Module 3 — réseaux sociaux
  runContentModule(profile),           // Module 4 — blog + YouTube
])
→ aggregateResults()
→ runBenchmarkModule(allResults)       // Module 5 — réutilise données 1-4, 0 appel API
→ runRecommendationsModule(allResults, context) // Module 6 — calibration selon objectif
→ buildConsolidatedPrompt()
→ callLlm()                            // 1 seul appel LLM
→ buildOutput()
```

**Modules 5 et 6 n'appellent pas d'API externe.** Ils structurent et interprètent les données déjà collectées.

---

### Module 1 — Analyse Produit & Messaging

**Fichier :** `modules/product-messaging.ts`
**Sources :** Scraping pages web via Composio (Apify)
**Scraping ciblé :** homepage + pricing + features uniquement — jamais de crawl complet

Pages scrapées par concurrent :

| Page | Données | Analyse IA (dans le prompt) |
|------|---------|----------------------------|
| Homepage | Hero message, value prop, CTA principal | Angle dominant : ROI / simplicité / sécurité / émotion / authority |
| Pricing | Tiers, positionnement tarifaire, ancrage | Posture : premium / mid-market / low-cost / freemium |
| Features | Ce qui est mis en avant vs minimisé | Score clarté messaging (0-100) + Score différenciation (0-100) |

**Output du module :**

```typescript
interface ProductMessagingData {
  competitors: MessagingAnalysis[]
}

interface MessagingAnalysis {
  competitor_url: string
  hero_message: string
  value_prop: string
  primary_cta: string
  pricing_posture: 'premium' | 'mid-market' | 'low-cost' | 'freemium' | 'unknown'
  dominant_angle: string
  messaging_clarity_score: number      // 0-100
  differentiation_score: number        // 0-100
  scraping_success: boolean
}
```

**Mode dégradé :** retry ×2 (1s). Si homepage échoue → analyse sur données partielles. Si pricing inaccessible → score pricing non calculé, mention `"[Concurrent] pricing : non accessible"`.

---

### Module 2 — Analyse SEO & Acquisition

**Fichier :** `modules/seo-acquisition.ts`
**Sources :** DataForSEO + SerpAPI via Composio
**Optimisation clé :** les mêmes 3 requêtes SERP servent pour la marque ET tous les concurrents — 1 appel, N analyses

Données collectées :
- DataForSEO : DA relative, nombre de mots-clés positionnés, trafic estimé, backlinks approximatifs
- SerpAPI : résultats SERP réels sur 3 requêtes stratégiques, featured snippets, Google Ads visibles

**Output du module :**

```typescript
interface SeoAcquisitionData {
  brand_seo: SeoMetrics
  competitors_seo: SeoMetrics[]
}

interface SeoMetrics {
  entity_url: string
  domain_authority: number
  estimated_keywords: number
  estimated_traffic: number
  backlink_count: number
  serp_positions: Record<string, number | null>  // keyword → position
  has_google_ads: boolean
  featured_snippets: number
  seo_score: number    // 0-100 relatif au groupe analysé
  cached_at?: string   // ISO 8601 si données depuis cache
}
```

**Cache :** DA et backlinks en cache 30 jours.

```typescript
const SEO_CACHE_TTL = 30 * 24 * 60 * 60 * 1000
// Clé : `seo:${entity_url}:${country}`
```

**Mode dégradé :** retry ×2 (1s exponentiel). Si DataForSEO timeout → utiliser cache si disponible. Si pas de cache → score SEO calculé sans nouvelles données, mention `"SEO : données en cache utilisées ou indisponibles"`.

---

### Module 3 — Analyse Social Media

**Fichier :** `modules/social-media.ts`
**Sources :** LinkedIn public + Instagram public + X public + Apify (Composio)
**Limite :** 10-20 posts max par concurrent par plateforme — jamais d'aspiration complète

| Plateforme | Source | Données |
|-----------|--------|---------|
| LinkedIn | API publique | Posts, engagement, fréquence, formats |
| Instagram | Profil public + Apify | Contenu, tone, hooks récurrents |
| X (Twitter) | API publique + Apify | Threads, engagement, ton |
| TikTok | Apify Social Search | Vidéos, vues, tendances |

Analyse :
- Fréquence publication + engagement moyen + formats dominants
- Ton détecté : didactique / authority / émotionnel / polémique / humor
- Hooks récurrents : ce qui revient dans les posts à fort engagement

**Pas d'analyse de commentaires** — sentiment déduit titres + engagement uniquement.

**Output du module :**

```typescript
interface SocialMediaData {
  competitors: SocialProfile[]
}

interface SocialProfile {
  competitor_url: string
  platforms: PlatformData[]
  social_score: number  // 0-100
}

interface PlatformData {
  platform: string
  publication_frequency: string   // ex: "3-4 posts/semaine"
  avg_engagement: number
  dominant_formats: string[]
  dominant_tone: string
  recurring_hooks: string[]
  available: boolean
}
```

**Mode dégradé :** si plateforme inaccessible → `available: false`, score social calculé sur plateformes disponibles. Mention `"[Concurrent] [Plateforme] : données non disponibles"`.

---

### Module 4 — Analyse Contenu

**Fichier :** `modules/content.ts`
**Sources :** RSS feeds + scraping blog public + YouTube Data API (OAuth client) (Composio)

Données collectées par concurrent :
- Blog : thématiques dominantes, fréquence, profondeur des articles
- CTA et lead magnets : ebook, étude de cas, webinar, template, trial
- YouTube : nombre de vidéos, angle dominant, vidéos à forte traction

Analyse :
- Angle commun à tous les concurrents → saturé
- Angle inexploité → opportunité de positionnement
- Sujets volume élevé non couverts → content gap

**Output du module :**

```typescript
interface ContentAnalysisData {
  competitors: CompetitorContent[]
  editorial_gap_map: ContentGap[]
}

interface CompetitorContent {
  competitor_url: string
  blog_frequency: string
  dominant_themes: string[]
  lead_magnet_types: string[]
  youtube_video_count: number
  youtube_dominant_angle: string | null
  content_score: number  // 0-100
}

interface ContentGap {
  angle: string
  competitor_coverage: 'none' | 'low' | 'medium' | 'high'
  opportunity: string
}
```

---

### Module 5 — Benchmark consolidé & Zones stratégiques

**Fichier :** `modules/benchmark.ts`
**Sources :** Réutilisation données modules 1-4 uniquement — **zéro appel API**

Ce module :
1. Construit le tableau comparatif 5 axes pour tous les concurrents
2. Calcule le score de compétitivité 0-100 pour la marque ET chaque concurrent
3. Détecte automatiquement les zones stratégiques par axe

**Les 4 zones stratégiques — définitions exactes :**

| Zone | Condition | Directive |
|------|-----------|-----------|
| 🔴 Zone Rouge | Axe où la marque est significativement derrière 2+ concurrents | Plan d'action prioritaire — rattrapage ou repositionnement |
| 🟠 Zone Saturée | Axe où tous les concurrents sont très présents | Trouver angle différenciant ou investir ailleurs |
| ⬜ Zone Neutre | Niveau comparable à la concurrence | Maintenir, optimiser légèrement |
| 🟢 Zone Verte | Axe peu exploité par les concurrents, volume disponible | Investir en priorité — première mise sur le marché |

**Output du module :**

```typescript
interface BenchmarkData {
  competitor_scores: CompetitorScore[]
  strategic_zones: StrategicZone[]
  radar_data: RadarEntry[]
}

interface CompetitorScore {
  entity: string           // marque client ou nom concurrent
  is_client: boolean
  seo_score: number
  product_score: number
  social_score: number
  content_score: number
  positioning_score: number
  global_score: number     // 0-100
  level: 'vulnerable' | 'weak' | 'competitive' | 'strong' | 'dominant'
}

interface StrategicZone {
  axis: 'seo' | 'product' | 'social' | 'content' | 'paid' | 'youtube'
  zone: 'red' | 'saturated' | 'neutral' | 'green'
  description: string
  directive: string
}
```

---

### Module 6 — Recommandations stratégiques & Plan 60 jours

**Fichier :** `modules/recommendations.ts`
**Sources :** Données agrégées modules 1-5 + `CiaSessionContext.objective`
**Calibration :** le plan d'action change de focus selon l'objectif déclaré au lancement

| Objectif | Focus du plan |
|----------|--------------|
| `attack` | Zones Vertes en priorité — canaux libres à saisir rapidement. Ton offensif. Quick wins. |
| `domination` | Zones Rouges en priorité — rattrapage faiblesses critiques. Consolidation avant expansion. |
| `investor` | Vue équilibrée forces/faiblesses. Format due diligence. Données chiffrées et comparatives. |

Ce module prépare les données structurées pour le prompt LLM consolidé. Il ne fait pas d'appel API.

**Output du module (entrée dans le prompt LLM) :**

```typescript
interface RecommendationsContext {
  repositioning_angle: string      // basé sur failles concurrentes détectées
  priority_channel: string         // où la concurrence est absente ou faible
  content_type_to_exploit: string  // format + sujet + angle spécifique
  threats: Threat[]                // 3 max
  opportunities: Opportunity[]     // 3 max
  action_plan_template: ActionPhase[]  // structure 2 phases pour le LLM
}

interface Threat {
  description: string
  urgency: 'critical' | 'medium' | 'monitor'
  source: string
}

interface Opportunity {
  description: string
  effort: 'low' | 'medium' | 'high'
  impact: 'high' | 'medium' | 'low'
  timeframe: '< 30 jours' | '30-60 jours'
}

interface ActionPhase {
  phase: 1 | 2
  label: string      // ex: "J1-30 : Capture des zones vertes"
  objective: string
  actions: string[]
}
```

---

## 4. Logique de scoring — Compétitivité 0-100

### Pondération des 4 composantes (poids égaux)

| Composante | Poids | Sources |
|-----------|-------|---------|
| SEO & Visibilité organique | 25% | DA relative + mots-clés positionnés + position SERP |
| Produit & Messaging | 25% | Clarté value prop + différenciation + sophistication pricing |
| Social & Contenu | 25% | Engagement moyen + fréquence + formats + traction YouTube |
| Positionnement | 25% | Angle dominant + cohérence cross-canal + solidité messages |

### Grille d'interprétation

| Score | Niveau | Signification |
|-------|--------|---------------|
| 0 — 39 | VULNERABLE | Plusieurs failles critiques |
| 40 — 59 | FAIBLE | Retard stratégique |
| 60 — 74 | COMPETITIF | Parité sectorielle |
| 75 — 89 | FORT | Avantage sur 1-2 axes |
| 90 — 100 | DOMINANT | Leader sur son marché |

---

## 5. Structure de l'output — contrat JSON

```typescript
// types.ts
export interface CiaOutput {
  analysis_context: CiaSessionContext
  competitor_scores: CompetitorScore[]
  strategic_zones: StrategicZone[]
  product_messaging: MessagingAnalysis[]
  seo_data: SeoAcquisitionData          // réutilisé depuis BPI-01 en V2
  social_matrix: SocialProfile[]
  content_gap_map: ContentGap[]          // alimenté depuis MTS-02 en V2
  threats: Threat[]                      // 3 max, avec urgency
  opportunities: Opportunity[]           // 3 max, avec effort estimé
  action_plan_60d: ActionPhase[]         // exactement 2 phases : J1-30 + J31-60
  previous_scores?: Record<string, number>  // scores run précédent si disponible
}
```

---

## 6. Comparaison historique

CIA-03 compare automatiquement avec l'analyse précédente.

```typescript
const previousRun = await prisma.agentRun.findFirst({
  where: { organisationId, agentCode: 'CIA-03', status: 'COMPLETED' },
  orderBy: { createdAt: 'desc' },
})
```

Affichage dans le rapport :

```
HubSpot : 91/100 (= stable)
Pipedrive : 72/100 (▼ -3 vs analyse précédente)
Monday CRM : 71/100 (▲ +3 vs analyse précédente)
```

Si premier run : pas de comparaison, baseline enregistrée.

---

## 7. Comportement dans le chat

### Progression communiquée

```
[1/6] Produit & Messaging en cours...
[1/6] Produit ✓  [2/6] SEO & Acquisition en cours...
```

### Messages de mode dégradé

```
"[Concurrent] homepage : scraping indisponible — analyse messaging partielle"
"[Concurrent] pricing : non accessible"
"[Concurrent] LinkedIn : données limitées — score social indicatif"
"SEO : données en cache utilisées (30j)"
"YouTube : échantillon réduit"
```

### Questions de suivi

```
"Détaille la faille de HubSpot sur le contenu"
→ Répondre avec les données content_gap_map et ContentAnalysisData déjà collectées

"Quel est le score de Pipedrive sur le SEO ?"
→ Répondre avec competitor_scores filtré sur Pipedrive
```

Pas de nouveaux appels API pour les questions de suivi.

---

## 8. Gestion des erreurs par module

| Module | Retry | Délai | Fallback | Impact score |
|--------|-------|-------|----------|-------------|
| Homepage scraping | ×2 | 1s | Analyse messaging partielle | Score messaging réduit |
| Pricing scraping | ×1 | 500ms | Skip | Score différenciation réduit |
| DataForSEO | ×2 | 1s exp. | Cache 30j si dispo | Score SEO en cache |
| SerpAPI | ×2 | 1s exp. | Score SERP partiel | Positions non disponibles |
| LinkedIn (public) | ×0 | — | Apify fallback | Score social réduit |
| Instagram/X/TikTok | ×0 | — | Skip | Score social partiel |
| YouTube | ×1 | 500ms | Échantillon réduit | Score contenu vidéo partiel |
| RSS concurrent | ×0 | — | Scraping page blog | Gap map partielle |
| Module 5 Benchmark | — | — | Aucun appel API | Toujours disponible |
| Module 6 Reco | — | — | Aucun appel API | Toujours disponible |

**Règle absolue :** aucun module ne doit `throw`. Toujours `ModuleResult<T>` avec `success: false` et `degraded: true`.

---

## 9. Exports

| Format | Contenu | Déclencheur chat |
|--------|---------|-----------------|
| PDF | Rapport complet — scores, zones, radar, menaces, opportunités, plan 60j | `"Exporte en PDF"` |
| Google Docs | Version éditable | `"Exporte en Google Docs"` |
| Google Slides | 9-10 slides — zones stratégiques visuelles + plan 60j | `"Génère les slides"` |
| Notion | Export structuré pour suivi concurrentiel récurrent | `"Exporte vers Notion"` |

Notion est le seul export spécifique à CIA-03 (non présent dans BPI-01 et MTS-02).

---

## 10. Persistance

```typescript
await prisma.agentRun.create({
  data: {
    organisationId,
    agentCode: 'CIA-03',
    status: 'COMPLETED',
    output: output as unknown as Prisma.JsonObject,
    degradedSources: output.degraded_sources,
    durationMs: Date.now() - startTime,
  }
})
```

---

## 11. Roadmap V2 — à ne pas implémenter en V1

- Modes récurrents : hebdomadaire / mensuel / trimestriel avec rapport différentiel
- Alertes changement pricing concurrent (monitoring grille tarifaire)
- Enchaînement BPI-01 + MTS-02 → CIA-03 : import JSON direct sans recollecte
  - `serp_data` et `seo_data` depuis BPI-01 `AgentRun`
  - `content_gap_map` depuis MTS-02 `AgentRun`
- Dashboard web (radar visuel + historique graphiqué des scores)
- Rapport investisseur auto-généré (template PDF format due diligence)
- Reddit / forums sectoriels (mentions et sentiment communautés)
- Ahrefs premium (backlinks approfondis)

**Ce qu'il faut préparer en V1 :**

```typescript
// Ces champs doivent être présents dans CiaOutput même en V1
// pour que CIA-03 V2 puisse les alimenter depuis BPI-01 et MTS-02
seo_data: SeoAcquisitionData       // sera remplacé par BPI-01 output en V2
content_gap_map: ContentGap[]      // sera enrichi par MTS-02 output en V2
```

Helper à créer dans `lib/` dès la V1 :

```typescript
// lib/agent-history.ts
export async function getLatestOutputByAgent(
  organisationId: string,
  agentCode: 'BPI-01' | 'MTS-02' | 'CIA-03'
): Promise<AgentOutput<unknown> | null>
```

---

## 12. Optimisation des coûts API — règles à respecter

- Max 3 concurrents par défaut (5 max — décision qualité, pas seulement coût)
- Max 3 requêtes SERP — mêmes requêtes pour la marque + tous les concurrents
- Scraping ciblé : homepage + pricing + features uniquement
- 10-20 posts max par concurrent et par plateforme
- Pas d'analyse commentaires — sentiment déduit titres + engagement
- DA et backlinks : cache 30 jours obligatoire
- Modules 5 et 6 : zéro appel API
- 1 seul appel LLM consolidé — aucun appel intermédiaire
- Batch Composio — tous les appels groupés par concurrent