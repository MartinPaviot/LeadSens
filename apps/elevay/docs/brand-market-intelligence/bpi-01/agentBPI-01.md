# agentBPI-01.md — Brand Presence Intelligence

> Claude Code doit lire ce fichier intégralement avant d'écrire ou modifier tout code dans `brand-market-intelligence/bpi-01/`.
> Ce fichier fait autorité sur le comportement de l'agent. En cas de conflit avec une autre source, ce fichier prime.

---

## 1. Identité

| Champ | Valeur |
|-------|--------|
| Code | `BPI-01` |
| Nom | Brand Presence Intelligence |
| Catégorie | Brand & Market Intelligence |
| Statut | Actif — Production V1 |
| Durée d'exécution | 8 à 15 minutes |
| Activation | Bouton quick reply `"Auditer ma marque"` dans le chat |

**Rôle :** Auditer la présence complète d'une marque sur 6 axes en une session — SERP, presse, YouTube, réseaux sociaux, SEO, benchmark concurrentiel. Produit un score global /100, 4 sous-scores, 5 risques, 5 quick wins et une feuille de route 90 jours.

**Ce que cet agent n'est pas :** un rapport SEO isolé, un outil de veille passif, un dashboard de données brutes.

---

## 2. Onboarding et profil

L'onboarding est **mutualisé** avec MTS-02 et CIA-03. Le profil `AgentProfile` est chargé depuis la base — jamais redemandé après la première saisie.

```typescript
// Données requises dans AgentProfile pour BPI-01
{
  brand_name: string        // utilisé dans toutes les requêtes
  brand_url: string         // ancrage SEO + SERP
  country: string           // contexte requêtes + presse
  language: string
  competitors: Competitor[] // 2 à 3 — mêmes requêtes réutilisées
  primary_keyword: string   // SEO + SERP organique
  secondary_keyword: string // gaps de contenu
}
```

**Reformulation obligatoire avant lancement :** l'agent affiche une confirmation du périmètre dans le chat avant de déclencher les modules. Si un homonyme est détecté sur `brand_name`, l'agent le signale et demande clarification.

---

## 3. Les 6 modules d'audit

### Pipeline d'exécution

```
Promise.allSettled([
  runSerpModule(profile),       // Module 1
  runPressModule(profile),      // Module 2
  runYoutubeModule(profile),    // Module 3
  runSocialModule(profile),     // Module 4
  runSeoModule(profile),        // Module 5
  runBenchmarkModule(profile),  // Module 6 — réutilise les données des modules 1-5
])
→ aggregateResults()
→ buildConsolidatedPrompt()
→ callLlm()                     // 1 seul appel LLM, à la fin
→ buildOutput()
```

---

### Module 1 — Audit SERP intelligent

**Fichier :** `modules/serp.ts`
**Source :** SerpAPI via Composio
**Limite :** 7 requêtes max par audit (optimisation coûts)

Requêtes lancées :

| Requête | Signal recherché |
|---------|-----------------|
| `[Marque]` | Position site officiel en résultats organiques |
| `[Marque + avis]` | Présence et sentiment avis page 1 |
| `[Marque + problème]` | Détection contenus négatifs ou critiques |
| `[Marque + scam]` | Détection signaux réputationnels critiques |
| `[Mot-clé principal]` | Position organique vs concurrents |
| `[Concurrent A]` + `[Concurrent B]` | Réutilisation — 0 appel supplémentaire |

**Output du module :**

```typescript
interface SerpData {
  official_site_position: number | null
  negative_snippets: string[]
  competitor_positions: Record<string, number | null>
  visibility_score: number   // 0-100
  reputation_score: number   // 0-100
}
```

**Mode dégradé :** retry ×2 (délai 1s exponentiel). Si échec : `degraded: true`, score SERP marqué non disponible.

---

### Module 2 — Analyse presse & mentions web

**Fichier :** `modules/press.ts`
**Sources :** GNews API + Google News via SerpAPI (Composio)

Données collectées :
- Nombre d'articles récents + domaines couvrants + autorité moyenne
- Sentiment global des articles (positif / neutre / négatif)
- Angle éditorial dominant : produit / leadership / crise / innovation

**Output du module :**

```typescript
interface PressData {
  article_count: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  editorial_angle: string
  top_domains: string[]
  pr_opportunities: string[]
}
```

**Mode dégradé :** retry ×1 (500ms). Si échec : skip, score presse non calculé.

---

### Module 3 — Audit YouTube

**Fichier :** `modules/youtube.ts`
**Source :** YouTube Data API v3 (OAuth client — clé Google du client)
**Limite :** 10 commentaires max par vidéo, échantillon sur 3 requêtes

Requêtes : `[Marque review]`, `[Marque test]`, `[Marque avis]`

Données collectées :
- Titre, vues, date, chaîne par vidéo
- Sentiment commentaires (échantillon 10 max/vidéo)
- Identification créateurs influents (vues élevées)

**Output du module :**

```typescript
interface YoutubeData {
  video_count: number
  top_videos: VideoEntry[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  influencer_opportunities: string[]
  reputation_score: number  // 0-100
}
```

**Mode dégradé :** retry ×1 (500ms). Si quota dépassé : réduction de l'échantillon. Score calculé sur données partielles avec mention `"YouTube : échantillon réduit"`.

---

### Module 4 — Analyse réseaux sociaux

**Fichier :** `modules/social.ts`
**Sources :** LinkedIn OAuth (client) + profils publics + Apify fallback (Composio)

| Plateforme | Source | Statut V1 |
|-----------|--------|-----------|
| LinkedIn | API OAuth client | Requis |
| Instagram | Profil public + Apify | Best effort |
| X (Twitter) | Profil public + Apify | Best effort |
| TikTok | Apify Social Search | Best effort |

Données collectées :
- Fréquence publication, engagement estimé, cohérence branding (compte officiel)
- Volume mentions, sentiment, sujets dominants (mentions non officielles)

**Output du module :**

```typescript
interface SocialData {
  platforms: PlatformData[]
  social_score: number        // 0-100
  brand_coherence_score: number  // 0-100
  dominant_topics: string[]
}
```

**Mode dégradé :** si LinkedIn indisponible → profil public uniquement. Si plateforme inaccessible → Apify fallback. Score social partiel avec mention par plateforme. L'agent ne se bloque jamais sur une plateforme manquante.

---

### Module 5 — SEO & Visibilité organique

**Fichier :** `modules/seo.ts`
**Source :** DataForSEO via Composio
**Cache :** DA et backlinks mis en cache 30 jours — ne pas re-fetcher si cache valide

Données collectées :
- Position mot-clé principal + secondaire
- Domain Authority (DA) + backlinks approximatifs
- Comparaison positionnement vs 2-3 concurrents
- Gaps de mots-clés exploitables

**Output du module :**

```typescript
interface SeoData {
  keyword_positions: Record<string, number | null>
  domain_authority: number
  backlink_count: number
  competitor_comparison: CompetitorSeoData[]
  keyword_gaps: string[]
  seo_score: number  // 0-100
  cached_at?: string // ISO 8601 — présent si données depuis cache
}
```

**Cache obligatoire :**

```typescript
const SEO_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 jours en ms
// Vérifier le cache avant tout appel DataForSEO
// Clé de cache : `seo:${brand_url}:${country}`
```

**Mode dégradé :** retry ×2 (1s exponentiel). Si échec et cache disponible : utiliser le cache avec mention `"SEO : données en cache utilisées"`. Si pas de cache : score SEO non calculé.

---

### Module 6 — Benchmark concurrentiel & Réputation

**Fichier :** `modules/benchmark.ts`
**Sources :** Réutilisation données modules 1-5 + Google Maps API (OAuth client) + Trustpilot scraping
**Règle absolue :** ce module ne génère aucun appel API supplémentaire pour les données déjà collectées

Axes comparés :
- Volume mentions presse (Module 2)
- Position SEO + DA (Module 5)
- Part de voix SERP (Module 1)
- Dominance YouTube (Module 3)
- Avis Google Maps : note + volume + sentiment
- Trustpilot : note + sentiment (scraping public)

**Output du module :**

```typescript
interface BenchmarkData {
  competitive_score: number  // 0-100
  radar: CompetitorRadarEntry[]
  google_maps: ReviewData | null
  trustpilot: ReviewData | null
}
```

---

## 4. Appel LLM — prompt consolidé

**Fichier :** `prompt.ts`

L'appel LLM est **unique**, déclenché après `Promise.allSettled` sur tous les modules. Il reçoit l'intégralité des données agrégées.

```typescript
// prompt.ts
export function buildConsolidatedPrompt(
  profile: AgentProfile,
  results: ModuleResults,
  previousRun?: BpiOutput // pour comparaison historique
): string {
  // Construire le prompt avec :
  // - Toutes les données des 6 modules (ou données partielles si dégradé)
  // - Le profil de la marque
  // - Les scores du run précédent si disponible (pour afficher les deltas)
  // - Instructions de scoring (pondération section 5)
  // - Format de sortie JSON attendu (section 5.2)
}
```

**Format de réponse attendu du LLM :** JSON strict correspondant à `BpiOutput` (voir section 5).

**Modèle :** `claude-sonnet-4-6` — ne pas changer sans mise à jour de ce fichier.

---

## 5. Logique de scoring

### 5.1 Score global /100 — pondération

| Composante | Poids | Sources |
|-----------|-------|---------|
| Réputation | 35% | SERP avis + presse + YouTube + Google Maps + Trustpilot |
| Visibilité organique | 30% | Position SEO + SERP + backlinks + YouTube reach |
| Présence sociale | 20% | Activité comptes + cohérence + mentions |
| Dominance concurrentielle | 15% | Part de voix comparée sur toutes les sources |

### 5.2 Grille d'interprétation

| Score | Niveau | Directive |
|-------|--------|-----------|
| 0 — 39 | CRITIQUE | Actions urgentes requises |
| 40 — 59 | FAIBLE | Plan d'action immédiat |
| 60 — 74 | MOYEN | Axes d'amélioration clairs |
| 75 — 89 | BON | Optimisation ciblée |
| 90 — 100 | EXCELLENT | Maintien et scaling |

### 5.3 Score en mode dégradé

Si une ou plusieurs sources sont indisponibles :
- Redistribuer le poids de la composante manquante proportionnellement sur les autres
- Mentionner explicitement dans le rapport : `"Score calculé sur données partielles — [source] indisponible"`
- Ajouter la source dans `degraded_sources` de l'output

---

## 6. Structure de l'output — contrat JSON

```typescript
// types.ts
export interface BpiOutput {
  scores: {
    global: number
    reputation: number
    visibility: number
    social: number
    competitive: number
    previous?: {  // présent si run précédent disponible
      global: number
      reputation: number
      visibility: number
      social: number
      competitive: number
      date: string
    }
  }
  serp_data: SerpData         // réutilisé par CIA-03 en V2
  seo_data: SeoData           // mis en cache 30j
  press_data: PressData
  youtube_data: YoutubeData
  social_data: SocialData
  benchmark_data: BenchmarkData
  top_risks: Risk[]           // 5 items max, avec urgency: 'high' | 'medium' | 'low'
  quick_wins: QuickWin[]      // 5 items max, avec effort: 'low' | 'medium' | 'high'
  roadmap_90d: RoadmapPhase[] // exactement 3 phases : mois 1, mois 2, mois 3
}

export interface Risk {
  description: string
  urgency: 'high' | 'medium' | 'low'
  source: string  // quelle source a révélé ce risque
}

export interface QuickWin {
  action: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  estimated_time: string  // ex: "2h", "1 jour"
}

export interface RoadmapPhase {
  phase: 1 | 2 | 3
  label: string  // ex: "Mois 1 — Activation réseaux"
  objective: string
  actions: string[]
}
```

---

## 7. Comportement dans le chat

### Progression communiquée module par module

L'agent envoie un message de progression dans le chat après chaque module terminé :

```
[1/6] SERP ✓  [2/6] Presse en cours...
[1/6] SERP ✓  [2/6] Presse ✓  [3/6] YouTube en cours...
```

### Messages de mode dégradé

Afficher dans le chat (pas dans le rapport final) :

```
"LinkedIn : données limitées — score social indicatif"
"YouTube : échantillon réduit — analyse sur données partielles"
"Trustpilot : aucun profil détecté pour cette marque"
```

### Questions de suivi

Après réception du rapport, l'utilisateur peut poser des questions de suivi dans le chat. L'agent doit être capable de répondre en utilisant les données déjà collectées dans le run — pas de nouveaux appels API pour les questions de suivi.

---

## 8. Gestion des erreurs par module

| Module | Retry | Délai | Fallback | Impact score |
|--------|-------|-------|----------|-------------|
| SERP (SerpAPI) | ×2 | 1s exp. | Score SERP partiel | Visibilité réduite |
| Presse (GNews) | ×1 | 500ms | Skip | Score réputation -presse |
| YouTube | ×1 | 500ms | Échantillon réduit | Score vidéo partiel |
| Social (LinkedIn) | ×0 | — | Profil public + Apify | Score social réduit |
| Social (autres) | ×0 | — | Apify ou skip | Score social partiel |
| SEO (DataForSEO) | ×2 | 1s exp. | Cache 30j si dispo | Score SEO en cache |
| Benchmark | ×0 | — | Réutilise données dispo | Score compétitif partiel |
| Google Maps | ×1 | 500ms | Skip | Score réputation -avis |
| Trustpilot | ×1 | 500ms | Skip | Score réputation -avis |

**Règle absolue :** aucun module ne doit `throw`. Toujours retourner `ModuleResult<T>` avec `success: false` et `degraded: true` en cas d'échec.

---

## 9. Exports

Déclenchés à la demande dans le chat après réception du rapport.

| Format | Contenu | Déclencheur chat |
|--------|---------|-----------------|
| PDF | Rapport complet mis en page | `"Exporte en PDF"` |
| Google Docs | Version éditable | `"Exporte en Google Docs"` |
| Google Slides | Présentation 8-10 slides | `"Génère les slides"` |

L'export ne recharge pas les données — il formate le `BpiOutput` déjà généré.

---

## 10. Persistance

```typescript
// Toujours persister avant de retourner le résultat
await prisma.agentRun.create({
  data: {
    organisationId,
    agentCode: 'BPI-01',
    status: 'COMPLETED',
    output: output as unknown as Prisma.JsonObject,
    degradedSources: output.degraded_sources,
    durationMs: Date.now() - startTime,
  }
})
```

**Chargement du run précédent :**

```typescript
const previousRun = await prisma.agentRun.findFirst({
  where: { organisationId, agentCode: 'BPI-01', status: 'COMPLETED' },
  orderBy: { createdAt: 'desc' },
})
// Passer previousRun.output.scores à buildConsolidatedPrompt()
```

---

## 11. Roadmap V2 — à ne pas implémenter en V1

Ces fonctionnalités sont documentées pour guider les décisions d'architecture, pas pour être codées.

- Audit mensuel automatisé (job schedulé + comparaison mois à mois)
- Alertes réputationnelles (notification si contenu négatif détecté)
- Dashboard web (évolution des scores dans le temps)
- Ahrefs premium (backlinks avancés)
- Enchaînement automatique vers CIA-03

**Ce qu'il faut préparer en V1 pour ne pas bloquer la V2 :**
- `serp_data`, `seo_data`, `press_data`, `youtube_data` dans l'output JSON — même si personne ne les consomme encore en externe
- `AgentRun` jamais supprimé — l'historique est permanent
- Schéma JSON strict (pas de champs optionnels non documentés)

---

## 12. Optimisation des coûts API — règles à respecter

- Max 7 requêtes SerpAPI par audit (batch stratégique)
- Les mêmes requêtes SERP servent pour la marque ET les concurrents — jamais de doublon
- YouTube : 10 commentaires max par vidéo, 3 requêtes de recherche
- Pas de crawl complet du site — SEO via DataForSEO uniquement
- DA et backlinks : cache 30 jours obligatoire
- Profils sociaux publics analysés sans appel API si accessible
- 1 seul appel LLM consolidé — aucun appel intermédiaire