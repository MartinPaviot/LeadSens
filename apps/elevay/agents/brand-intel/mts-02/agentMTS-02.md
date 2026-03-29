# agentMTS-02.md — Market Trend Strategist

> Claude Code doit lire ce fichier intégralement avant d'écrire ou modifier tout code dans `brand-market-intelligence/mts-02/`.
> Ce fichier fait autorité sur le comportement de l'agent. En cas de conflit avec une autre source, ce fichier prime.

---

## 1. Identité

| Champ | Valeur |
|-------|--------|
| Code | `MTS-02` |
| Nom | Market Trend Strategist |
| Catégorie | Brand & Market Intelligence |
| Statut | Actif — Production V1 |
| Durée d'exécution | 5 à 12 minutes |
| Activation | Bouton quick reply `"Analyser les tendances de mon secteur"` dans le chat |

**Rôle :** Détecter les tendances émergentes du secteur avant qu'elles soient saturées, identifier les angles différenciants inexploités par les concurrents, et générer une roadmap contenu 30 jours prête à exécuter.

**Ce que cet agent n'est pas :** un Google Trends amélioré, un résumé d'articles, un calendrier éditorial statique, un outil de veille passif.

**Relation avec BPI-01 :** BPI-01 audite l'état actuel de la marque (vision rétrospective). MTS-02 détecte les opportunités du marché (vision prospective). Ils sont complémentaires, pas redondants.

---

## 2. Onboarding et profil

L'onboarding est **mutualisé** avec BPI-01 et CIA-03. Le profil `AgentProfile` est chargé depuis la base — jamais redemandé.

```typescript
// Données du profil mutualisé utilisées par MTS-02
{
  brand_name: string        // référence pour l'analyse concurrentielle contenu
  country: string           // segmentation sources et benchmarks
  language: string
  competitors: Competitor[] // 2 à 3 — pour la gap map concurrentielle
  primary_keyword: string   // seed keyword pour Google Trends + DataForSEO
  secondary_keyword: string
}
```

### Questions contextuelles au lancement (dans le chat)

Contrairement à BPI-01, MTS-02 pose **2 questions légères** dans le chat à chaque session avant de lancer les modules. Ces données ne sont **pas** stockées dans le profil permanent.

```typescript
interface MtsSessionContext {
  sector: string           // ex: "SaaS B2B RH" — le plus spécifique possible
  priority_channel: 'SEO' | 'LinkedIn' | 'YouTube' | 'TikTok' | 'multi'
  // Note : objective (lead gen, branding, activation) déduit du profil
}
```

**Confirmation avant lancement :**

```
"Je lance l'analyse tendances pour [Secteur] — [Pays] — vs [Concurrent A] + [Concurrent B] — focus [Canal]. C'est correct ?"
```

---

## 3. Les 5 modules d'analyse

### Pipeline d'exécution

```
Promise.allSettled([
  runTrendsModule(profile, context),         // Module 1
  runContentModule(profile, context),        // Module 2
  runCompetitiveModule(profile),             // Module 3
  runSocialListeningModule(profile, context), // Module 4
])
→ aggregateResults()
→ runSynthesisModule(allResults)             // Module 5 — dépend des 4 autres
→ buildConsolidatedPrompt()
→ callLlm()                                  // 1 seul appel LLM
→ buildOutput()
```

**Note :** le Module 5 (Synthèse) n'est pas dans le `Promise.allSettled` — il s'exécute après les 4 premiers pour construire la roadmap. Il n'appelle pas d'API externe.

---

### Module 1 — Détection tendances macro (Search + Media)

**Fichier :** `modules/trends.ts`
**Sources :** Google Trends + DataForSEO + GNews API + Google News via SerpAPI (Composio)
**Limite :** 3 à 5 mots-clés secteur max — sélection stricte, pas d'analyse exhaustive
**Cache :** Google Trends et DataForSEO mis en cache 7 jours

Données collectées :
- Google Trends : évolution sur 90j + 12 mois des mots-clés secteur
- DataForSEO : volume, difficulté, tendance par mot-clé
- GNews + Google News : thèmes récurrents presse sectorielle

Signaux recherchés :
- Mots-clés émergents : hausse > 30% sur 4 semaines
- Sujets en saturation : ratio volume/nouvelles publications stable
- Thèmes récurrents presse : confirmation d'une tendance multi-sources

**Output du module :**

```typescript
interface TrendsData {
  rising_keywords: KeywordTrend[]   // hausse > 30% sur 4 sem.
  stable_keywords: KeywordTrend[]
  declining_keywords: KeywordTrend[]
  press_themes: string[]
}

interface KeywordTrend {
  keyword: string
  volume: number
  difficulty: number
  growth_30d: number     // % de hausse
  growth_90d: number
}
```

**Cache obligatoire :**

```typescript
const TRENDS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000  // 7 jours
// Clé : `trends:${country}:${primary_keyword}:${sector}`
```

**Mode dégradé :** si Google Trends indisponible → analyse sur DataForSEO uniquement. Score croissance calculé sur volume seul, mention `"Google Trends : données non disponibles — score ajusté"`.

---

### Module 2 — Analyse contenus performants (SEO & Social)

**Fichier :** `modules/content.ts`
**Sources :** SerpAPI + YouTube Data API (OAuth client) + LinkedIn public + Apify (Composio)
**Limite :** 10 à 20 contenus max par plateforme — pas d'aspiration complète

Données collectées :
- SerpAPI : top 10 contenus pour chaque mot-clé en croissance (Module 1)
- YouTube : vidéos à forte traction sur les sujets sélectionnés
- LinkedIn + X + TikTok (Apify) : échantillon 10-20 posts, ton et format dominants

Analyse IA (dans le prompt LLM consolidé) :
- Type de contenu dominant, angle, promesse du titre, structure récurrente
- Format dominant par canal (carrousel, thread, short, live, article long)
- Ton dominant (didactique, polémique, storytelling, stat choc)

**Output du module :**

```typescript
interface ContentPerformanceData {
  serp_top_content: SerpContent[]
  youtube_trending: YoutubeContent[]
  social_samples: SocialSample[]
  dominant_formats: Record<string, string>  // canal → format dominant
  dominant_tones: Record<string, string>    // canal → ton dominant
}
```

**Mode dégradé :** si YouTube quota dépassé → réduction de l'échantillon vidéos. Si TikTok/X inaccessible → analyse sans cette plateforme, signal marqué `"non disponible cette session"`.

---

### Module 3 — Analyse concurrentielle contenu

**Fichier :** `modules/competitive.ts`
**Sources :** RSS feeds + scraping pages blog publiques (Composio)
**Limite :** pas de crawl complet — RSS feeds + pages blog uniquement

Données collectées par concurrent :
- Fréquence de publication, thématiques dominantes, profondeur des articles
- Formats utilisés : ebook, étude de cas, webinar, article long, vidéo, checklist
- CTA et lead magnets détectés : trial, démo, téléchargement

Analyse :
- Angle commun à tous les concurrents → sujet saturé
- Angle absent chez tous les concurrents → opportunité de positionnement
- Sujets à fort volume non couverts par la concurrence → gap exploitable

**Output du module :**

```typescript
interface CompetitiveContentData {
  competitor_content: CompetitorContent[]
  saturated_angles: string[]     // présents chez tous les concurrents
  missing_angles: string[]       // absents chez tous les concurrents
  content_gaps: ContentGap[]     // sujets volume élevé, couverture faible
}

interface ContentGap {
  topic: string
  estimated_volume: number
  competitor_coverage: 'none' | 'low' | 'medium' | 'high'
  opportunity_score: number  // 0-100
}
```

**Mode dégradé :** si RSS concurrent non trouvé → scraping page blog publique uniquement. Gap map calculée sur données partielles avec mention `"[Concurrent] : blog non indexé — analyse partielle"`.

---

### Module 4 — Social listening simplifié

**Fichier :** `modules/social-listening.ts`
**Sources :** LinkedIn public + Apify (TikTok + X) (Composio)
**Limite :** 10 à 20 contenus max par plateforme

| Plateforme | Source | Signal analysé |
|-----------|--------|---------------|
| LinkedIn | API publique | Posts fort engagement secteur — ton + format + hook dominant |
| TikTok | Apify Social Search | Vidéos virales secteur — vues, commentaires, tendances |
| X (Twitter) | API publique + Apify | Threads trending thématique — engagement, ton, format |

**Pas d'analyse de commentaires** — sentiment déduit des titres et de l'engagement uniquement.

**Output du module :**

```typescript
interface SocialListeningData {
  linkedin_signals: SocialSignal[]
  tiktok_signals: SocialSignal[]
  x_signals: SocialSignal[]
}

interface SocialSignal {
  platform: string
  dominant_format: string
  dominant_tone: string
  trending_hooks: string[]
  engagement_benchmark: number
  available: boolean  // false si plateforme indisponible
}
```

**Mode dégradé :** si une plateforme inaccessible → `available: false`, analyse continue sur les plateformes disponibles. Mention `"[Plateforme] : signal non disponible cette session"`.

---

### Module 5 — Synthèse stratégique & Roadmap 30 jours

**Fichier :** `modules/synthesis.ts`
**Sources :** Données agrégées des modules 1-4 uniquement — aucun appel API
**Rôle :** Préparer les données structurées pour l'appel LLM consolidé

Ce module ne fait pas d'appel API. Il :
1. Calcule les scores d'opportunité par sujet (voir section 4)
2. Classe les sujets : signal faible / tendance forte / saturation / buzz temporaire
3. Identifie les top 3 angles différenciants
4. Structure la matrice format × canal
5. Prépare le contexte pour `buildConsolidatedPrompt()`

---

## 4. Logique de scoring des tendances

### 4.1 Score d'opportunité (0-100) par sujet

| Dimension | Max | Règle |
|-----------|-----|-------|
| Croissance Google Trends | 25 pts | Hausse ≥ 30% sur 8 sem. = 25 / Stable = 10 / Baisse = 0 |
| Volume search vs difficulté | 25 pts | Vol ≥ 1000/mois ET diff < 40 = 25 / Compromis = 10-20 |
| Couverture concurrentielle | 25 pts | 0-1 concurrent positionné = 25 / 2-3 = 15 / >3 = 5 |
| Traction sociale | 25 pts | ≥ 10 posts fort engagement = 25 / 5-10 = 15 / <5 = 5 |

### 4.2 Interprétation du score

| Score | Niveau | Directive |
|-------|--------|-----------|
| < 40 | Opportunité faible | Ne pas intégrer à la roadmap |
| 40 — 69 | Opportunité moyenne | Intégrer si angle différenciant disponible |
| ≥ 70 | Opportunité forte | Intégrer en priorité dans la roadmap 30 jours |

### 4.3 Classification des tendances

| Type | Signal | Durée | Action |
|------|--------|-------|--------|
| Signal faible | Croissance détectée, pas encore mainstream | 4-8 sem. | Publier rapidement |
| Tendance forte | Volume élevé, multi-canaux, persistant | 3-6 mois | Contenu de référence |
| Saturation | Concurrents présents, difficulté élevée, engagement baisse | — | Angle différenciant ou autre sujet |
| Buzz temporaire | Pic soudain sans persistance | < 2 sem. | Exploiter vite si pertinent, pas en stratégie long terme |

---

## 5. Structure de l'output — contrat JSON

```typescript
// types.ts
export interface MtsOutput {
  session_context: MtsSessionContext
  trending_topics: TrendingTopic[]       // avec score 0-100
  saturated_topics: SaturatedTopic[]
  content_gap_map: ContentGap[]          // réutilisé par CIA-03 en V2
  format_matrix: FormatEntry[]
  social_signals: SocialSignal[]
  differentiating_angles: string[]       // 3 max — formulés directement
  roadmap_30d: RoadmapEntry[]
  opportunity_scores: Record<string, number>  // topic → score
}

export interface TrendingTopic {
  topic: string
  opportunity_score: number
  classification: 'weak_signal' | 'strong_trend' | 'saturation' | 'buzz'
  source_confirmation: string[]   // sources qui confirment la tendance
  estimated_horizon: string       // ex: "4-8 semaines", "3-6 mois"
  suggested_angle: string
}

export interface RoadmapEntry {
  week: number                    // 1 à 4
  canal: string
  format: string
  suggested_title: string
  topic: string
  priority: 'high' | 'medium' | 'low'
}

export interface FormatEntry {
  canal: string
  dominant_format: string
  dominant_tone: string
  example: string
}
```

---

## 6. Roadmap 30 jours — structure type

Le LLM génère des titres concrets par canal. Volumes recommandés en V1 :

| Canal | Volume | Format prioritaire |
|-------|--------|-------------------|
| Articles SEO | 2-3 / mois | Guide long-form, comparatif, pillar page |
| LinkedIn | 3-4 posts / semaine | Carrousel, post opinion, thread stat |
| YouTube | 1-2 vidéos / mois | Vidéo éducative, analyse tendance |
| Lead magnet | 1 / trimestre | Rapport sectoriel, checklist, template |
| Newsletter | 1 / semaine | Synthèse tendances + recommandations |
| TikTok / Reels | 2-3 / semaine (optionnel) | Short vidéo, take polémique, chiffre clé |

---

## 7. Comportement dans le chat

### Progression communiquée

```
[1/5] Détection tendances macro en cours...
[1/5] Tendances ✓  [2/5] Contenus performants en cours...
```

### Messages de mode dégradé

```
"Google Trends : données non disponibles — score ajusté sur DataForSEO"
"TikTok : signal non disponible cette session"
"[Concurrent] : blog non indexé — analyse partielle"
"YouTube : échantillon réduit — analyse indicative"
```

### Questions de suivi

L'utilisateur peut demander dans le chat :
- `"Détaille la tendance n°1"` → développer avec les données déjà collectées
- `"Propose 3 titres pour LinkedIn sur ce sujet"` → générer depuis le contexte du run
- Pas de nouveaux appels API pour les questions de suivi

---

## 8. Gestion des erreurs par module

| Module | Retry | Délai | Fallback | Impact output |
|--------|-------|-------|----------|--------------|
| Google Trends | ×1 | 1s | DataForSEO seul | Score croissance partiel |
| DataForSEO | ×2 | 1s exp. | Cache 7j si dispo | Score volume/difficulté en cache |
| GNews | ×1 | 500ms | Skip | Pas de confirmation presse |
| SerpAPI | ×2 | 1s exp. | Skip top contenus | Matrice format sans SERP |
| YouTube | ×1 | 500ms | Échantillon réduit | Signaux vidéo partiels |
| LinkedIn (public) | ×0 | — | Apify fallback | Signal social réduit |
| TikTok / X (Apify) | ×1 | 1s | Skip | Signal plateforme absent |
| RSS concurrent | ×0 | — | Page blog scraping | Gap map partielle |

**Règle absolue :** aucun module ne doit `throw`. Toujours `ModuleResult<T>` avec `success: false` et `degraded: true`.

---

## 9. Exports

| Format | Contenu | Déclencheur chat |
|--------|---------|-----------------|
| PDF | Rapport complet — tendances, scores, gap map, matrice, roadmap 30j | `"Exporte en PDF"` |
| Google Docs | Version éditable — annotations par l'équipe contenu | `"Exporte en Google Docs"` |
| Google Slides | Présentation 7-8 slides — 1 slide par section clé + roadmap | `"Génère les slides"` |

---

## 10. Persistance

```typescript
await prisma.agentRun.create({
  data: {
    organisationId,
    agentCode: 'MTS-02',
    status: 'COMPLETED',
    output: output as unknown as Prisma.JsonObject,
    degradedSources: output.degraded_sources,
    durationMs: Date.now() - startTime,
  }
})
```

Pas de comparaison historique en V1 (mode ponctuel uniquement). Le run est persisté pour la V2.

---

## 11. Roadmap V2 — à ne pas implémenter en V1

- Modes récurrents : hebdomadaire (lundi matin), mensuel (1er du mois), trimestriel
- Système d'alertes configurable :
  - Signal fort : sujet dépasse score 80+ → notification immédiate
  - Alerte concurrentielle : concurrent publie sur angle non couvert
  - Alerte viralisation : post/vidéo secteur dépasse 10K interactions
  - Alerte saturation : sujet de la roadmap devient saturé
- Dashboard web avec évolution des tendances dans le temps
- Scoring sectoriel relatif (comparaison benchmarks industrie)
- Personnalisation par ICP (tendances filtrées selon profil client idéal)
- Enchaînement avec Agent Campaign Manager (roadmap → création contenu directe)

**Ce qu'il faut préparer en V1 :**
- `content_gap_map` dans l'output JSON — sera consommé par CIA-03 en V2
- `opportunity_scores` complet — base pour les alertes V2
- `AgentRun` persisté même en V1 ponctuel — base pour la récurrence V2

---

## 12. Optimisation des coûts API — règles à respecter

- Max 3-5 mots-clés secteur — sélection stricte au lancement
- Mêmes mots-clés pour marque + concurrents — 1 appel, N analyses
- 10-20 contenus max par plateforme — pas d'aspiration complète
- Pas de crawl complet — RSS feeds + pages blog uniquement
- Pas d'analyse commentaires — sentiment déduit titres + engagement
- Google Trends + DataForSEO en cache 7 jours (mode récurrent V2)
- 1 seul appel LLM consolidé — aucun appel intermédiaire
- Batch Composio — tous les appels groupés