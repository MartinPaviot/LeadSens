# Elevay — SEO & GEO Specialist Agents
## Claude Code Implementation Guide

> **Principe d'architecture** : Zero blocking at activation — graceful degradation at every step  
> **Stack** : TypeScript · AWS Bedrock · Composio MCP · Auth0  
> **Accès client** : interface chat (web/mobile)

---

## Table des agents

| Code | Nom | Rôle | Position |
|------|-----|------|----------|
| AGT-SEO-PIO-05 | Performance & Insights Optimizer | Dashboard SEO+GEO dual scoring | Observabilité |
| AGT-SEO-OPT-06 | SEO & GEO Performance Optimizer | Optimisation continue pages existantes | Itération |
| AGT-SEO-TSI-07 | Technical SEO & Indexing Manager | Santé technique, crawl, indexation | **Fondation** |
| AGT-SEO-KGA-08 | Keyword & GEO Action Planner | Stratégie KW + plan d'action 90j | **Orchestrateur** |
| AGT-SEO-WPW-09 | Web Page SEO Writer | Rédaction pages statiques | Production |
| AGT-SEO-BSW-10 | Blog SEO Writer | Articles + Topic Clusters | Production |
| AGT-SEO-MDG-11 | Meta Description Generator | Batch meta descriptions | On-page |
| AGT-SEO-ALT-12 | Image ALT Text Generator | Batch ALT texts | On-page |

**Ordre d'exécution logique** : TSI-07 → KGA-08 → OPT-06 / WPW-09 / BSW-10 → MDG-11 / ALT-12  
**Observabilité transversale** : PIO-05 (peut être activé à tout moment)

---

## Architecture du projet

```
elevay/
├── CLAUDE.md                    # Ce fichier (copié sous ce nom pour Claude Code)
├── core/
│   ├── onboarding/
│   │   ├── ONBOARDING.md        # Flux onboarding commun
│   │   ├── index.ts             # Orchestration onboarding
│   │   └── types.ts             # ClientProfile, OnboardingState
│   ├── tools/
│   │   ├── composio.ts          # Wrapper Composio MCP (auth OAuth, batch, rate limit)
│   │   ├── dataForSeo.ts        # Wrapper DataForSEO (crawl, KW, ranking)
│   │   ├── serpApi.ts           # Wrapper SerpAPI (SERP réel par GEO)
│   │   ├── gsc.ts               # Google Search Console OAuth
│   │   ├── ga.ts                # Google Analytics OAuth
│   │   ├── cms/
│   │   │   ├── wordpress.ts     # WordPress REST API + Yoast/RankMath
│   │   │   ├── hubspot.ts       # HubSpot Pages/Blog/Files API
│   │   │   ├── shopify.ts       # Shopify Admin API
│   │   │   └── webflow.ts       # Webflow CMS API (best effort)
│   │   └── export/
│   │       ├── sheets.ts        # Google Sheets API
│   │       ├── docs.ts          # Google Docs API
│   │       └── csv.ts           # Export CSV universel
│   ├── types/
│   │   ├── agent.ts             # AgentContext, AutomationLevel, WorkflowStep
│   │   ├── seo.ts               # SeoIssue, KwScore, GeoLevel, CmsType
│   │   └── errors.ts            # ElevayError, GracefulFallback
│   └── orchestrator/
│       ├── index.ts             # Routeur inter-agents (KGA-08 comme pivot)
│       └── context.ts           # Circulation contexte inter-agents
├── agents/
│   ├── pio05/
│   │   ├── AGENT.md
│   │   ├── index.ts
│   │   ├── prompt.ts
│   │   ├── workflow.ts
│   │   └── types.ts
│   ├── opt06/
│   ├── tsi07/
│   ├── kga08/
│   ├── wpw09/
│   ├── bsw10/
│   ├── mdg11/
│   └── alt12/
└── package.json
```

---

## Contrat de types communs

```typescript
// core/types/agent.ts

export type AutomationLevel = 'audit' | 'semi-auto' | 'full-auto';
export type CmsType = 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
export type GeoLevel = 'national' | 'regional' | 'city' | 'multi-geo';
export type AlertChannel = 'slack' | 'email' | 'report';

export interface ClientProfile {
  id: string;
  siteUrl: string;
  cmsType: CmsType;
  automationLevel: AutomationLevel;
  geoLevel: GeoLevel;
  targetGeos: string[];          // ex: ['Paris', 'Lyon'] ou ['FR', 'BE']
  priorityPages: string[];
  alertChannels: AlertChannel[];
  // OAuth tokens gérés par Composio — jamais stockés en clair
  connectedTools: {
    gsc: boolean;
    ga: boolean;
    ahrefs: boolean;
    semrush: boolean;
  };
}

export interface AgentContext {
  clientProfile: ClientProfile;
  sessionId: string;
  triggeredBy: string;           // agent source ou 'user'
  inheritedData?: Record<string, unknown>;  // contexte inter-agents
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  fallback?: () => Promise<WorkflowStep>;
}

export interface GracefulFallback {
  missingTool: string;
  fallbackBehavior: string;
  degradedOutput: string;
}
```

```typescript
// core/types/seo.ts

export type IssueLevel = 'critical' | 'high' | 'medium' | 'watch';

export interface SeoIssue {
  type: string;
  level: IssueLevel;
  url: string;
  description: string;
  recommendedAction: string;
  autoFixable: boolean;          // peut être corrigé sans validation humaine
}

export interface KwScore {
  keyword: string;
  score: number;                 // 0-100
  trafficPotential: number;      // poids 30%
  seoDifficulty: number;         // poids 25% (inversé)
  businessValue: number;         // poids 25%
  geoRelevance: number;          // poids 20%
  geo: string;
  intent: 'commercial' | 'informational' | 'navigational' | 'transactional';
  targetPage: string | 'create';
  recommendedAction: 'create' | 'update' | 'blog';
  horizon: 'M1' | 'M2' | 'M3';
}
```

---

## Agent 1 — AGT-SEO-PIO-05 · Performance & Insights Optimizer

### Identité
- **Rôle** : Dashboard dual SEO + GEO — observabilité transversale de la famille
- **Nature** : Agent d'analyse et de reporting — non rédacteur, non correcteur
- **Activation** : À la demande ou en reporting automatique mensuel
- **Canaux GEO mesurés** : Google Search (SEO classique), Google Maps/Local, Google SGE/AI Overview, Bing Copilot, Perplexity/SearchGPT

### Modules fonctionnels
1. **Dashboard dual SEO + GEO** — scoring unifié, tendances, alertes
2. **Score de citabilité LLM (0–100)** — visibilité dans les moteurs génératifs
3. **Audit de structure LLM-friendly** — détection des formats optimaux pour être cité par les IA
4. **Reporting** — export Sheets, Slides, PDF

### Score de citabilité LLM (0–100)
| Axe | Poids | Signal mesuré |
|-----|-------|---------------|
| E-E-A-T | 25% | Autorité auteur, About page, citations |
| Structure contenu | 25% | FAQ schema, HowTo, titres clairs |
| Faits vérifiables | 25% | Chiffres, sources, données datées |
| Backlinks autoritaires | 25% | DA, liens éditoriaux de qualité |

### Formats contenu LLM-friendly
- FAQ structurées avec schema.org `FAQPage`
- Définitions directes (réponse dans les 2 premières phrases)
- Listes numérotées avec contexte
- Tableaux comparatifs balisés
- Citations d'experts avec attribution

### Inputs onboarding
```typescript
interface Pio05Inputs {
  siteUrl: string;
  targetKeywords: string[];
  geoTargets: string[];
  competitorUrls: string[];      // 2-3 concurrents
  reportFrequency: 'monthly' | 'weekly' | 'on-demand';
}
```

### Outputs
| Livrable | Contenu | Fréquence |
|----------|---------|-----------|
| Dashboard dual SEO+GEO | Positions, trafic, citabilité LLM par canal | Mensuel auto |
| Score citabilité LLM | 0-100 avec axes détaillés + recommandations | Mensuel |
| Audit LLM-friendly | Pages à restructurer + format recommandé | Ponctuel |
| Rapport comparatif | Évolution vs mois précédent + concurrents | Mensuel |

### Graceful degradation
```typescript
const pio05Fallbacks: GracefulFallback[] = [
  { missingTool: 'ahrefs', fallbackBehavior: 'GSC uniquement pour autorité', degradedOutput: 'Score DA estimé, non mesuré' },
  { missingTool: 'gsc', fallbackBehavior: 'DataForSEO pour ranking', degradedOutput: 'Données trafic non disponibles' },
  { missingTool: 'perplexity_api', fallbackBehavior: 'Analyse manuelle de structure', degradedOutput: 'Score LLM estimé sur critères structurels' },
];
```

### Structure fichiers
```
agents/pio05/
├── AGENT.md        # Ce spec
├── index.ts        # Activation, routing, session
├── prompt.ts       # System prompt: "Chief SEO Intelligence Officer IA"
├── workflow.ts     # collect_data → dual_scoring → llm_audit → report
└── types.ts        # Pio05Inputs, DualDashboard, LlmCitabilityScore
```

---

## Agent 2 — AGT-SEO-OPT-06 · SEO & GEO Performance Optimizer

### Identité
- **Rôle** : Optimiser les pages existantes pour progresser en ranking — agent d'itération
- **Différence vs TSI-07** : TSI-07 = santé technique. OPT-06 = ranking et contenu.
- **Différence vs WPW-09/BSW-10** : OPT-06 améliore l'existant. WPW-09/BSW-10 créent du neuf.
- **Cible principale** : Pages en position 4–15 ("fruits mûrs")
- **Canaux** : SEO Google + GEO local (Maps) + Moteurs génératifs (SGE, Copilot, Perplexity)

### Modules fonctionnels
1. **Audit ranking & diagnostic** — analyse de chaque page existante vs SERP cible
2. **Scoring Impact/Effort** — priorisation des optimisations
3. **Optimisations on-page** — contenu, balises, schema, maillage interne
4. **GEO & Moteurs génératifs** — Google AI Overview, Bing Copilot, Maps, Perplexity
5. **Surveillance continue** — monitoring différentiel avec alertes

### Modèle de monitoring (équilibre coût/valeur)
| Périmètre | Fréquence | Indicateur | Trigger action |
|-----------|-----------|------------|----------------|
| Top 20 pages | Continu (quotidien) | Ranking + trafic | Alerte si baisse > 3 positions |
| Pages pos. 4-15 | Hebdomadaire | Opportunités gain rapide | Rapport hebdo |
| Toutes autres pages | Mensuel | Vue d'ensemble | Rapport mensuel |
| Nouvelles pages | J+7, J+30 post-pub | Premier ranking | Auto |
| GEO (Maps, SGE) | Mensuel | Visibilité locale/générative | Rapport mensuel |

### Dimension GEO & Moteurs génératifs
| Canal | Objectif | Levier |
|-------|----------|--------|
| Google AI Overview (SGE) | Citations dans réponses IA | E-E-A-T + FAQ + schema.org |
| Bing Copilot | Mentions génératives | Contenu direct + faits vérifiables |
| Google Maps / Local | Pack 3-map | Google Business Profile + NAP cohérent |
| Perplexity / SearchGPT | Visibilité moteurs IA alt. | Sources autoritatives + backlinks |
| Rich Snippets / Position 0 | Featured snippets | FAQ schema + HowTo + Article schema |

### Niveaux d'automatisation
```typescript
// Garde-fous communs à tous les niveaux :
const OPT06_GUARDRAILS = {
  noModificationAboveThreshold: 1000,  // visites/mois → validation humaine obligatoire
  rollbackEnabled: true,               // historique complet des modifications
  pillarPageAlert: true,               // alerte avant tout rewriting de page pilier
};

type Opt06AutoLevel = {
  audit: 'rapport uniquement, zéro modification',
  semiAuto: 'corrections sans risque auto (metas, schema, maillage) — contenu sur validation',
  fullAuto: 'toutes optimisations selon règles configurées — alertes si inconnu',
};
```

### Inputs onboarding
```typescript
interface Opt06Inputs {
  siteUrl: string;
  targetPages: string[];         // pages à optimiser en priorité
  targetKeywords: Record<string, string[]>;  // page → mots-clés cibles
  competitors: string[];
  automationLevel: AutomationLevel;
  geoTargets?: string[];
  googleBusinessProfileId?: string;
}
```

### Outputs
| Livrable | Contenu | Fréquence/Trigger |
|----------|---------|-------------------|
| Audit ranking initial | Ranking actuel + Score Impact/Effort + Plan action | Phase 1 |
| Log modifications | Détail corrections appliquées | Après chaque optimisation |
| Rapport impact | Positions J+7/J+14/J+30 | Auto post-modification |
| Monitoring continu | Alertes ranking + rapport mensuel complet | Continu |

### Workflow
```
Phase 1: audit_ranking → score_impact_effort → plan_action_prioritise
Phase 2: optimise_contenu → optimise_balises → optimise_schema → optimise_maillage
Phase 3: monitor_quotidien → alert_si_baisse → rapport_hebdo → rapport_mensuel
```

### Structure fichiers
```
agents/opt06/
├── AGENT.md
├── index.ts        # Activation, détection mode, session
├── prompt.ts       # System prompt: "Chief SEO & GEO Optimizer IA — itération jusqu'au résultat"
├── workflow.ts     # audit → score → optimise → monitor
└── types.ts        # Opt06Inputs, RankingAudit, OptimizationLog, MonitoringAlert
```

---

## Agent 3 — AGT-SEO-TSI-07 · Technical SEO & Indexing Manager

### Identité
- **Rôle** : Chief Technical SEO Officer IA — fondation de toute stratégie SEO
- **Prérequis** : Doit être exécuté avant KGA-08 et les agents de contenu (WPW-09, BSW-10)
- **Complexité** : Élevée — crawl technique + détection 20+ types d'erreurs + suivi continu
- **Modes** : Audit initial + Surveillance continue + Alertes temps réel

### Pourquoi en premier
Un site avec des problèmes techniques (pages non indexées, erreurs 404, canonical incorrect, Core Web Vitals dégradés) ne peut pas bénéficier de la stratégie KW (KGA-08) ni de la production de contenu (WPW-09, BSW-10). La fondation doit être saine avant tout investissement éditorial.

### Modules fonctionnels
1. **Audit initial complet** — crawl via DataForSEO, analyse indexation, erreurs, structure, pages orphelines, Core Web Vitals
2. **Détection & priorisation** — 4 niveaux d'urgence, 20+ types d'erreurs classifiés
3. **Corrections & recommandations** — du diagnostic à la correction concrète via CMS API
4. **Surveillance continue & alertes** — monitoring permanent, détection avant impact

### Classification des problèmes

```typescript
const TSI07_ISSUE_TAXONOMY: Record<IssueLevel, string[]> = {
  critical: [
    'Erreur 404 sur page à fort trafic ou avec backlinks entrants',
    'Page importante bloquée par robots.txt ou noindex',
    'Canonical incorrect pointant vers URL erronée',
    'Redirection en boucle ou chaîne longue',
    'Baisse soudaine du nombre de pages indexées',
  ],
  high: [
    'Pages orphelines sans lien interne entrant',
    'Duplication de contenu (thin content, pages similaires)',
    'Cannibalisation de mots-clés entre plusieurs URLs',
    'Core Web Vitals dégradés (LCP, CLS, FID) sur pages stratégiques',
    'Sitemap.xml non à jour ou avec URLs en erreur',
  ],
  medium: [
    'Balises meta title / description manquantes ou dupliquées',
    'Problèmes indexation mobile (responsive non optimisé)',
    'URLs paramétriques générant des doublons',
    'Absence de schema.org sur pages cibles',
    'Indexation lente des nouvelles pages',
  ],
  watch: [
    'Pages en noindex volontaire à vérifier périodiquement',
    'Performances Core Web Vitals à surveiller sur mobile',
    'Nouveaux backlinks toxiques détectés',
    'Positions en fluctuation sur mots-clés stratégiques',
  ],
};

// Règle d'alerte : critical + high → alerte immédiate
// En semi-auto ou full-auto : corrections sans risque appliquées immédiatement
// Corrections complexes (canonical, cannibalisation) → validation humaine toujours
```

### Niveaux d'automatisation
| Mode | Comportement |
|------|-------------|
| **Audit seul** | Rapport complet, toutes corrections manuelles |
| **Semi-auto** | Auto : redirections, metas manquantes, sitemap. Validation : canonical, cannibalisation |
| **Full auto** | Toutes corrections selon règles configurées. Alerte uniquement si problème inconnu |

### Inputs onboarding
```typescript
interface Tsi07Inputs {
  siteUrl: string;               // point d'entrée pour le crawl
  cmsType: CmsType;
  automationLevel: AutomationLevel;
  priorityPages: string[];       // top trafic + pages de conversion
  alertChannel: AlertChannel;
  // OAuth via Composio :
  gscConnected: boolean;         // Google Search Console
  gaConnected: boolean;          // Google Analytics
}
```

### Outputs
| Livrable | Contenu | Fréquence/Trigger |
|----------|---------|-------------------|
| Rapport d'audit initial | Problèmes classés + priorité + impact SEO | Ponctuel au démarrage |
| Plan d'action priorisé | Actions triées urgence + facilité + agent cible | Avec audit initial |
| Corrections exécutées | Log corrections appliquées (semi ou full auto) | Après correction |
| Rapport hebdo différentiel | Problèmes apparus, résolus, évolution KPIs | Hebdomadaire auto |
| Alertes critiques | Notification immédiate si problème Critique | Temps réel |
| Dashboard technique | Tendances indexation, erreurs récurrentes, CWV | Chat + Sheets |

### Workflow
```
Step 1: crawl_complet (DataForSEO Crawl API)
Step 2: analyse_indexation (GSC OAuth)
Step 3: detect_errors → classify_by_level
Step 4: audit_cwv (Google PageSpeed API batch)
Step 5: generate_audit_report + plan_action
Step 6: [si semi-auto/full-auto] apply_safe_corrections via CMS API
Step 7: setup_continuous_monitoring → alert_on_critical
Step 8: schedule_weekly_diff_report
```

### Dialogue exemple (référence pour le system prompt)
```
CLIENT : "Lance un audit technique complet de salesflow.io. WordPress + Yoast. Semi-auto."

AGENT :
Audit Technical SEO — salesflow.io — Résultats :

⚠️ CRITIQUE (2) :
- Page /blog/ancien-article en 404 avec 12 backlinks entrants
- Canonical /services/ pointe vers version HTTP au lieu de HTTPS

🔴 HAUTE (5) :
- 8 pages orphelines dont 3 landing pages
- Core Web Vitals LCP > 4s sur mobile (4 pages)
- 2 pages avec meta description dupliquée

🟡 MOYENNE (11) :
- Sitemap.xml contient 6 URLs en 301
- 14 images sans ALT sur pages produit
- Schema.org manquant sur pages blog

Plan d'action :
1) Correction canonical HTTP→HTTPS (je corrige via Yoast maintenant ?)
2) Redirection 301 sur /blog/ancien-article (confirmation ?)
3) Maillage interne vers les 8 pages orphelines
```

### Structure fichiers
```
agents/tsi07/
├── AGENT.md
├── index.ts        # Point d'entrée, détection mode, orchestration phases
├── prompt.ts       # System prompt: "Chief Technical SEO Officer IA"
├── workflow.ts     # crawl → detect → classify → correct → monitor
└── types.ts        # Tsi07Inputs, CrawlResult, TechnicalIssue, MonitoringConfig
```

---

## Agent 4 — AGT-SEO-KGA-08 · Keyword & GEO Action Planner

### Identité
- **Rôle** : Orchestrateur SEO — agent de planning stratégique en amont de la production
- **Nature** : Agent d'analyse et de planification — non rédacteur
- **Livrable principal** : Plan d'action SEO 90 jours + Dashboard KW priorisé par GEO
- **Relation** : Nourrit les agents WPW-09, BSW-10, MDG-11, ALT-12

### Position dans la famille : Agent amont
KGA-08 dit **quoi faire, où et quand**. Les agents WPW-09, BSW-10, MDG-11, ALT-12 **l'exécutent**.

### Modules fonctionnels
1. **Collecte & analyse KW** — DataForSEO + SerpAPI + GSC (fruits mûrs pos. 4-15)
2. **Scoring 4 axes (0-100)** — priorisation objective de chaque opportunité
3. **Scoring GEO** — analyse des marchés locaux et multi-pays
4. **Détection city landing pages** — identification automatique des villes à cibler
5. **Plan d'action 90 jours** — tableau actions par mois, agent cible, KPI
6. **Veille mensuelle** — mode récurrent avec mise à jour du dashboard

### Scoring KW — 4 axes pondérés
```typescript
function scoreKeyword(kw: RawKeyword): number {
  const trafficPotential = kw.volume * estimatedCtr(kw.targetPosition); // 30%
  const seoDifficulty = 100 - kw.kd;                                    // 25% (inversé)
  const businessValue = assessBusinessValue(kw.intent, kw.proximity);   // 25%
  const geoRelevance = kw.localVolume / kw.nationalVolume * 100;        // 20%
  
  return (
    trafficPotential * 0.30 +
    seoDifficulty   * 0.25 +
    businessValue   * 0.25 +
    geoRelevance    * 0.20
  );
}
```

### Granularité GEO
| Niveau | Exemple | Cas d'usage |
|--------|---------|-------------|
| NATIONAL | France, Belgique, Suisse | E-commerce, couverture nationale |
| RÉGIONAL | Île-de-France, PACA | Services régionaux, franchise |
| VILLE / LOCAL | Paris, Lyon, Bordeaux | PME locale, restaurant, agence |
| MULTI-GEO | FR + BE + CH ou EU | Scale-up, SaaS international |

### Détection city landing pages
```typescript
const CITY_PAGE_DETECTION_RULES = {
  minMonthlyVolume: 100,         // volume local minimum
  maxKeywordDifficulty: 40,      // KD maximum pour priorisation haute
  maxCitiesV1: 10,               // limite V1 pour coûts API
  urlPattern: '/services/{slug}-{city}',  // ex: /services/seo-paris
  contentTarget: 'WPW-09',       // agent chargé de la rédaction
  wordCountRange: [600, 1000],
  mustInclude: ['NAP'],          // Nom, Adresse, Téléphone
};
```

### Inputs onboarding
```typescript
interface Kga08Inputs {
  siteUrl: string;
  targetPages: string[];
  businessObjective: 'traffic' | 'lead-gen' | 'sales' | 'local-awareness';
  geoLevel: GeoLevel;
  targetGeos: string[];
  competitors: string[];         // 2-3 concurrents à benchmarker
  monthlyContentCapacity: number; // nb pages/articles créables par mois
  seoMaturity: 'beginner' | 'intermediate' | 'advanced'; // DA < 20 / 20-50 / 50+
  prioritization: 'volume' | 'conversion';
  gscConnected: boolean;
}
```

### Outputs
| Livrable | Contenu | Format |
|----------|---------|--------|
| Dashboard KW | Top KW par priorité + GEO + score + action + horizon | Chat + Sheets |
| Plan d'action 90j | Actions par mois + agent cible + page + KPI | Sheets + Chat |
| City landing map | Pages GEO à créer avec URLs et contenu recommandé | Sheets |
| Cluster map | Regroupement thématique pour BSW-10 | Chat + Sheets |
| Deck CMO | Présentation investisseur/décideur | Slides (module compl.) |

### Workflow
```
Step 1: collect_existing_kw (GSC si disponible — fruits mûrs pos. 4-15)
Step 2: expand_kw_research (DataForSEO + SerpAPI par GEO)
Step 3: score_all_keywords (4 axes pondérés)
Step 4: score_geo_markets (si multi-GEO)
Step 5: detect_city_landing_pages
Step 6: build_90day_action_plan
Step 7: export_dashboard (Sheets) + summary (Chat)
Step 8: [mode récurrent] schedule_monthly_refresh
```

### Structure fichiers
```
agents/kga08/
├── AGENT.md
├── index.ts        # Point d'entrée, modes ponctuel/récurrent
├── prompt.ts       # System prompt: "Orchestrateur SEO Stratégique IA"
├── workflow.ts     # collect → score → plan → export
└── types.ts        # Kga08Inputs, KwScore, GeoScore, ActionPlan90d
```

---

## Agent 5 — AGT-SEO-WPW-09 · Web Page SEO Writer

### Identité
- **Rôle** : Rédacteur SEO complet — de la structure à la publication
- **Périmètre** : About Us, services, landing pages, pillar pages, pages contact, catégories
- **Complémentarité** : WPW-09 = pages statiques du site. BSW-10 = blog. MDG-11 = metas en batch. ALT-12 = ALT texts.
- **Durée manuelle économisée** : 4 à 8 heures par page

### Types de pages couvertes
| Type | Brief requis | Longueur cible | Angle |
|------|-------------|----------------|-------|
| About Us | Histoire, valeurs, équipe, mission | 600–1500 mots | Storytelling + autorité |
| Page service | Détail, bénéfices, process | 800–2000 mots | Problème → solution |
| Landing page | Offre, CTA, urgence, bénéfices | 500–1200 mots | Conversion first |
| Pillar page / Guide | Sujet complet, structure chapitres | 2000–5000 mots | Référence SEO |
| Page contact | Coordonnées, formulaire | 200–500 mots | Clarté + CTA |
| Page catégorie | Définition + produits vedettes | 300–800 mots | Navigation + KW catégorie |

### Livrables structurels par page
```typescript
interface Wpw09PageOutput {
  metaTitle: string[];           // 2 variations, 50-60 car., KW en début
  metaDescription: string;       // 1 version, 155-160 car., CTA intégré
  h1: string[];                  // 2 variations, KW principal intégré
  structure: {                   // Plan H2/H3 validé AVANT rédaction
    h2: string[];
    h3: Record<string, string[]>;
  };
  bodyContent: string;           // Corps complet selon plan + ton + KW
  internalLinks: { anchor: string; url: string }[];  // 2-5 liens
  cta: string[];                 // 1-2 appels à l'action
  imageRecommendations: { description: string; altText: string }[];
}
```

### Formats d'export
| Format | Description technique |
|--------|----------------------|
| HTML | Balises sémantiques H1/H2/H3/p/ul/a, attributs SEO |
| Markdown | Pour Notion, GitBook, Webflow, Framer |
| WordPress (API) | REST API — titres, corps, meta Yoast/RankMath, slug |
| HubSpot (API) | Pages API — titres, body, meta |
| Shopify (API) | Admin API — title, body_html, metafields |
| Google Sheets | URL / H1 / meta title / meta desc / longueur / statut |

### Workflow
```
Step 1: collect_brief (type de page, ton, KW fournis ou à rechercher)
Step 2: benchmark_serp (SerpAPI — top 5 concurrents, structure, longueur)
Step 3: fetch_keywords (DataForSEO si non fournis)
Step 4: propose_structure (H1x2 + H2/H3 complet) → VALIDATION CLIENT
Step 5: [après validation] rediger_contenu_complet
Step 6: validate_quality (longueur, densité KW, maillage, CTA présents)
Step 7: export_format_choisi (HTML / Markdown / CMS API / Sheets)
```

### Inputs onboarding
```typescript
interface Wpw09Inputs {
  pageType: 'about' | 'service' | 'landing' | 'pillar' | 'contact' | 'category';
  pageUrl?: string;              // si mise à jour d'une page existante
  brief: string;                 // description de la page à créer
  targetKeywords?: string[];     // fournis ou récupérés via DataForSEO
  brandTone: string;             // ton de marque
  targetAudience: string;
  internalLinksAvailable: string[];  // pages du site vers lesquelles lier
  cmsType: CmsType;
  exportFormat: 'html' | 'markdown' | 'cms' | 'sheets';
  kga08Context?: KwScore[];      // contexte hérité de KGA-08 si activé avant
}
```

### Structure fichiers
```
agents/wpw09/
├── AGENT.md
├── index.ts        # Activation, détection type de page, session
├── prompt.ts       # System prompt: "Rédacteur SEO Senior IA — structure avant contenu"
├── workflow.ts     # brief → benchmark → structure → validate → rediger → export
└── types.ts        # Wpw09Inputs, PageStructure, Wpw09PageOutput, ExportConfig
```

---

## Agent 6 — AGT-SEO-BSW-10 · Blog SEO Writer

### Identité
- **Rôle** : Rédacteur blog SEO — article unitaire et clusters de contenus
- **Différence vs WPW-09** : WPW-09 = pages statiques (intentions commerciales). BSW-10 = blog (intentions informationnelles). Audiences et maillage distincts.
- **Module clé** : Topic Cluster — 1 pilier + N articles satellites intégrés et maillés
- **Fréquence** : Régulière (1-8 articles/mois) vs ponctuelle pour WPW-09

### 7 formats d'articles
| Format | Intention | Longueur | Angle |
|--------|-----------|----------|-------|
| Guide complet / How-to | Informationnelle | 1500–3000 mots | Référence exhaustive — pillar ou satellite |
| Article liste / Top N | Informationnelle | 800–1500 mots | Scannable, fort trafic |
| Étude de cas | Investigationnelle | 800–1500 mots | Preuve sociale + résultat mesurable |
| Comparatif / Versus | Investigationnelle | 1200–2500 mots | Capte intentions d'achat |
| Opinion / Thought leadership | Informationnelle | 600–1200 mots | Autorité de marque |
| Tutoriel pas-à-pas | Informationnelle | 1000–2000 mots | Fort potentiel position 0 |
| Glossaire / Définition | Navigationnelle | 400–1000 mots | Sémantique + maillage cluster |

### Modes d'utilisation
```typescript
type Bsw10Mode = 
  | 'single'        // 1 article à la demande
  | 'cluster'       // 1 pilier + N satellites avec maillage complet
  | 'calendar';     // Calendrier éditorial 30/60/90 jours planifié
```

### Topic Cluster — logique
Le mode cluster génère :
1. La pillar page (ou brief pour WPW-09 si page statique)
2. La liste des articles satellites avec sujets + mots-clés + format
3. Le calendrier éditorial avec dates et ordre de publication
4. La logique de maillage interne entre tous les articles

### Workflow
```
Step 1: collect_brief (sujet, mode, format, ton, public, objectif)
Step 2: fetch_keywords_paa (DataForSEO — KW + LSI + PAA)
Step 3: benchmark_top5 (SerpAPI — structure concurrents)
Step 4: [mode cluster] build_cluster_architecture → validation
Step 5: propose_titles (2-3 H1 CTR-optimisés) → choix client
Step 6: propose_structure (H2/H3 + plan complet) → validation
Step 7: rediger_article_complet (section par section)
Step 8: integrate_internal_links + CTA
Step 9: export → CMS ou Google Docs ou Sheets
Step 10: [mode calendar] schedule_next_articles
```

### Inputs
```typescript
interface Bsw10Inputs {
  topic: string;
  mode: Bsw10Mode;
  articleFormat: 'guide' | 'list' | 'case-study' | 'comparison' | 'opinion' | 'tutorial' | 'glossary';
  targetAudience: string;
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  objective: 'traffic' | 'lead-gen' | 'conversion' | 'brand-authority';
  brandTone: string;
  targetKeywords?: string[];
  internalLinksAvailable: string[];
  cta: string;
  cmsType: CmsType;
  calendarDuration?: 30 | 60 | 90;  // si mode calendar
  kga08Context?: KwScore[];
}
```

### Structure fichiers
```
agents/bsw10/
├── AGENT.md
├── index.ts        # Activation, détection mode, session
├── prompt.ts       # System prompt: "Rédacteur SEO Éditorial IA — cluster et autorité"
├── workflow.ts     # brief → kw → benchmark → structure → rediger → export
└── types.ts        # Bsw10Inputs, ClusterArchitecture, EditorialCalendar
```

---

## Agent 7 — AGT-SEO-MDG-11 · Meta Description Generator

### Identité
- **Rôle** : Générateur de meta descriptions SEO + CTR optimisées en batch
- **Double objectif** : SEO on-page (mots-clés) + CTR (incitation au clic depuis les SERP)
- **Périmètre** : Toutes les pages d'un site — accueil, services, blog, e-com, fiches produits
- **Duo avec ALT-12** : MDG-11 optimise le clic depuis Google. ALT-12 optimise la compréhension des images.

### Matrice ton × type de page
| Type de page | Ton | CTA type | Angle |
|-------------|-----|----------|-------|
| Page d'accueil | Inspirant + brand promise | Découvrez / Explorez | Vision émotionnelle + KW marque |
| Page service / produit | Persuasif + bénéfices | Essayez / Téléchargez | Problème → solution + KW produit |
| Article de blog | Informatif + curiosité | Découvrez / Lisez | Question ou chiffre + réponse partielle |
| Page catégorie e-com | Pratique + sélectif | Voir la sélection | Nombre produits + attribut clé + CTA |
| Fiche produit | Spécifique + rassurant | Voir les détails | Caractéristique unique + bénéfice |
| Page à propos / contact | Humain + crédibilité | Contactez / En savoir plus | Valeurs + équipe + invitation |

### Standards qualité
```typescript
const MDG11_QUALITY_RULES = {
  lengthRange: [155, 160],       // caractères — ni trop court ni trop long
  keywordPosition: 'début ou milieu de phrase',
  ctaRequired: true,
  uniquenessRequired: true,      // détection et signalement des doublons
  genericPatterns: [             // patterns interdits détectés automatiquement
    'Bienvenue sur notre site',
    'Découvrez nos produits',
    'En savoir plus',
  ],
  variationsPerPage: [1, 3],     // min 1, max 3 variations
};
```

### Injection CMS
| CMS | Méthode | Champ cible |
|-----|---------|-------------|
| WordPress | REST API + Yoast/RankMath/SEOPress | `_yoast_wpseo_metadesc` |
| HubSpot | Pages API — PATCH | `metaDescription` |
| Shopify | Admin API — PUT | SEO description |
| Webflow | CMS API — PATCH | `seo.description` |
| Google Sheets | Export CSV | URL / Meta / Mot-clé / Longueur |

### Workflow
```
Step 1: collect_site_urls (crawl ou liste manuelle)
Step 2: [par batch de 20-50 pages] fetch_page_content + target_keywords (DataForSEO)
Step 3: benchmark_competitor_metas (SerpAPI — réutilisé par catégorie)
Step 4: detect_existing_issues (vides, doublons, trop courtes, trop longues)
Step 5: generate_meta_variations (1-3 par page selon type + ton)
Step 6: quality_check (longueur, KW, CTA, unicité)
Step 7: preview_table → validation client
Step 8: [sur validation] inject_cms OU export_sheets_csv
```

### Inputs
```typescript
interface Mdg11Inputs {
  siteUrl: string;
  scope: 'all' | 'blog' | 'products' | string[];  // périmètre traitement
  cmsType: CmsType;
  brandTone: string;
  targetKeywords?: Record<string, string[]>;  // page → KW (ou récupérés via DataForSEO)
  variationsCount: 1 | 2 | 3;
  language: string;                           // fr, en, etc.
  inject: boolean;                            // true = injection directe, false = export
}
```

### Structure fichiers
```
agents/mdg11/
├── AGENT.md
├── index.ts
├── prompt.ts       # System prompt: "Expert CTR & Meta Description IA"
├── workflow.ts     # collect → fetch_kw → benchmark → generate → validate → inject/export
└── types.ts        # Mdg11Inputs, MetaDescriptionOutput, QualityReport
```

---

## Agent 8 — AGT-SEO-ALT-12 · Image ALT Text Generator

### Identité
- **Rôle** : Générateur d'ALT texts SEO + Accessibilité en batch
- **Double objectif** : SEO on-page (Google Images + ranking) + Accessibilité (WCAG 2.1)
- **Duo avec MDG-11** : Ensemble ils couvrent l'intégralité du SEO on-page lié aux méta-données
- **Spécificité** : Images décoratives reçoivent `alt=""` conforme WCAG (pas de keyword stuffing)

### Règles qualité SEO + Accessibilité
```typescript
const ALT12_QUALITY_RULES = {
  lengthRange: [50, 125],        // caractères
  keywordDensity: 'une fois max, position naturelle',
  decorativeImages: 'alt=""',    // WCAG 2.1 — jamais de KW sur décoratives
  genericPatterns: ['image', 'photo', 'img'],  // interdits
  contextualAlignment: true,     // ALT aligné avec contenu de la page
};
```

### Types d'images traitées
| Type | Contexte | ALT généré (exemple) | KW intégré |
|------|----------|---------------------|------------|
| Photo produit | Fiche chaussure running | "Chaussure de running homme bleue légère pour trail" | chaussure running homme |
| Photo équipe | Page À propos SaaS B2B | "L'équipe produit de [Marque] lors d'une session de travail" | [nom marque] équipe |
| Illustration UI | Page fonctionnalités | "Interface de tableau de bord analytique du logiciel" | logiciel analytique dashboard |
| Icône décorative | Partout sur le site | `alt=""` (conforme WCAG) | Aucun |
| Héro homepage | Accueil agence SEO | "Spécialiste SEO analysant les performances d'un site web" | agence SEO |

### Injection CMS
| CMS | Méthode | Champ cible |
|-----|---------|-------------|
| WordPress | REST API — PATCH `/wp/v2/media/{id}` | `alt_text` |
| HubSpot | Files API — PATCH `/filemanager/api/v3/files/{fileId}` | `alt` |
| Shopify | Admin API — PUT `/products/{id}/images/{image_id}.json` | `alt` |
| Webflow | API — PATCH `/collections/{id}/items/{itemId}` | `alt` (champ asset) |
| Google Sheets | Export CSV | Colonnes : URL / ALT / mot-clé |

### Optimisation coûts API
- Batch par type d'image (toutes images produit ensemble)
- Cache des ALT générés pour templates répétitifs (même produit, plusieurs couleurs)
- Vision API (Google ou OpenAI) uniquement si l'image n'a pas de contexte de page

### Workflow
```
Step 1: crawl_images (extraction balises <img>, ALT existants, URL page de contexte)
Step 2: classify_images (produit / équipe / UI / héro / décorative)
Step 3: fetch_page_keywords (DataForSEO — par page, caché pour la session)
Step 4: [si image sans contexte] vision_api_description (best effort)
Step 5: generate_alt_texts (1-2 variations par image, règles qualité)
Step 6: quality_check (longueur, KW, WCAG décoratives)
Step 7: preview_table → validation client
Step 8: [sur validation] inject_cms OU export_csv OU export_sheets
```

### Inputs
```typescript
interface Alt12Inputs {
  siteUrl: string;
  scope: 'all' | 'blog' | 'products' | string[];
  cmsType: CmsType;
  targetKeywords?: Record<string, string[]>;  // par page ou catégorie
  brandTone: 'descriptive' | 'informative' | 'marketing';
  language: string;
  specialRules?: string[];       // noms de marque, termes proscrits, conventions
  variationsCount: 1 | 2;
  inject: boolean;
}
```

### Structure fichiers
```
agents/alt12/
├── AGENT.md
├── index.ts
├── prompt.ts       # System prompt: "Expert SEO Images & Accessibilité IA — WCAG 2.1"
├── workflow.ts     # crawl → classify → fetch_kw → generate → validate → inject/export
└── types.ts        # Alt12Inputs, ImageClassification, AltTextOutput
```

---

## Onboarding commun — Flux client

### Principe
L'onboarding est commun à toute la famille SEO. Il collecte le profil client une seule fois et le propage à tous les agents activés.

### Étapes
```
1. Présentation Elevay + famille SEO (30 secondes)
2. URL du site
3. CMS utilisé (WordPress / HubSpot / Shopify / Webflow / Autre)
4. Connexion outils (OAuth via Composio) :
   - Google Search Console [recommandé]
   - Google Analytics [recommandé]
   - CMS choisi [selon niveau d'automatisation]
5. Niveau d'automatisation : Audit seul / Semi-auto / Full auto
6. Dimension GEO : National / Régional / Ville / Multi-pays + zones cibles
7. Pages prioritaires (top trafic ou top conversion)
8. Canal d'alerte : Slack / Email / Rapport hebdo uniquement
9. Confirmation profil → activation de l'agent demandé
```

### Graceful degradation à l'onboarding
```typescript
const ONBOARDING_FALLBACKS = {
  noGsc: 'DataForSEO pour ranking et indexation — résultats légèrement moins précis',
  noGa: 'Prioritisation par ranking seul — trafic non disponible',
  noCmsAccess: 'Toutes les corrections exportées en CSV / Sheets pour application manuelle',
  noAhrefs: 'GSC + DataForSEO comme sources principales — backlinks non disponibles',
};
// Aucun outil manquant ne bloque l'activation de l'agent
```

---

## Stack technique & intégrations

### Tier 1 — Outils Elevay-provided (inclus)
| Outil | Usage | Agents |
|-------|-------|--------|
| DataForSEO | Crawl, KW, volumes, difficulté, indexation, ranking | TSI-07, KGA-08, OPT-06, WPW-09, BSW-10, MDG-11, ALT-12 |
| SerpAPI | SERP réel par GEO, structure concurrents, metas | KGA-08, OPT-06, WPW-09, BSW-10, MDG-11 |
| Google PageSpeed API | Core Web Vitals LCP/CLS/FID par lot | TSI-07 |
| Composio MCP | Auth OAuth, batch, rate limit, webhooks | Tous |

### Tier 2 — OAuth client via Composio
| Outil | Usage | Agents |
|-------|-------|--------|
| Google Search Console | Couverture, CTR, impressions, "fruits mûrs" pos. 4-15 | TSI-07, KGA-08, OPT-06, PIO-05 |
| Google Analytics | Trafic par page, priorisation corrections | TSI-07, OPT-06, PIO-05 |
| WordPress REST API + Yoast | Corrections metas, sitemap, redirections, contenu | TSI-07, OPT-06, WPW-09, MDG-11, ALT-12 |
| HubSpot CMS/Pages/Blog/Files API | Corrections metas, contenu, images | TSI-07, OPT-06, WPW-09, BSW-10, MDG-11, ALT-12 |
| Shopify Admin API | Metas, redirections, ALT images produit | TSI-07, OPT-06, WPW-09, MDG-11, ALT-12 |
| Webflow CMS API | Metas, contenu, ALT (best effort V1) | TSI-07, OPT-06, WPW-09, MDG-11, ALT-12 |
| Google Sheets API | Dashboard, export, suivi corrections | Tous |
| Google Docs API | Export articles relecture | BSW-10 |
| Slack / Email (Composio) | Alertes critiques temps réel | TSI-07, OPT-06, PIO-05 |
| Google Business Profile | Fiche locale, citations | OPT-06 |

### Tier 3 — Premium optionnel
| Outil | Usage | Agents |
|-------|-------|--------|
| Ahrefs API | Backlinks + opportunités KW + autorité domaine | KGA-08, OPT-06, WPW-09, BSW-10, PIO-05 |
| SEMrush | Ranking + contenu concurrent + suggestions | KGA-08, OPT-06, BSW-10, MDG-11 |
| Vision API (Google/OpenAI) | Description images sans contexte | ALT-12 |
| Google Slides API | Deck CMO/investisseur | KGA-08 |

### Optimisation coûts API (règles communes)
```typescript
const API_COST_RULES = {
  rankingCache: '24h',           // ne pas rappeler le même ranking dans la journée
  benchmarkCache: 'session',     // benchmark concurrent réutilisé dans la session
  batchSize: {
    metas: 50,                   // pages par lot MDG-11
    altTexts: 30,                // images par lot ALT-12
    cwv: 20,                     // URLs par lot PageSpeed API
  },
  dataForSeoStrategy: 'top-pages-only',  // pas d'analyse massive sur pages à faible valeur
  ahrefsMonthlyOnly: true,       // Ahrefs uniquement en reporting mensuel
};
```

---

## Règles d'implémentation Claude Code

### Conventions TypeScript
```typescript
// Chaque agent exporte une fonction principale activate()
export async function activate(context: AgentContext): Promise<AgentSession>;

// Chaque workflow step est isolé et peut fallback indépendamment
async function runStep(step: WorkflowStep, fallback?: GracefulFallback): Promise<StepResult>;

// Les corrections CMS passent toujours par une validation si automationLevel !== 'full-auto'
async function applyCmsCorrection(correction: CmsCorrection, ctx: AgentContext): Promise<void>;
```

### Validation humaine obligatoire (semi-auto)
Les corrections suivantes nécessitent **toujours** une validation humaine, quel que soit le niveau d'automatisation :
- Canonical tags incorrects
- Cannibalisation de mots-clés (merge ou redirection de pages)
- Modification de pages > 1000 visites/mois (OPT-06)
- Rewriting de pages piliers
- Modification de redirections déjà en production

### Propagation de contexte inter-agents
```typescript
// KGA-08 → WPW-09 / BSW-10
const inheritedKwContext = kga08Session.kwScores.filter(kw => kw.targetPage === 'create');

// TSI-07 → tous les autres agents
const inheritedTechnicalHealth = tsi07Session.criticalIssues;
// Les agents de contenu n'écrivent pas sur des pages en erreur critique

// Format d'héritage
const agentContext: AgentContext = {
  ...baseContext,
  inheritedData: {
    kwPlan: kga08Session?.actionPlan,
    technicalHealth: tsi07Session?.healthScore,
  },
};
```

### Ordre d'implémentation recommandé
1. **Core** : `types/`, `tools/composio.ts`, `tools/dataForSeo.ts`, `core/onboarding/`
2. **TSI-07** : fondation technique — valider le crawl et la connexion GSC
3. **KGA-08** : orchestrateur — valider le scoring et l'export Sheets
4. **WPW-09** : première production de contenu
5. **BSW-10** : extension blog + clusters
6. **MDG-11** + **ALT-12** : batch on-page (pair naturel)
7. **OPT-06** : optimisation continue (nécessite des pages existantes)
8. **PIO-05** : observabilité (nécessite données des autres agents)

---

## Personnalités des agents (System Prompts — résumés)

| Agent | Persona | Ton |
|-------|---------|-----|
| PIO-05 | Chief SEO Intelligence Officer IA | Analytique, data-driven, synthétique |
| OPT-06 | Chief SEO & GEO Optimizer IA | Itératif, orienté résultat, précis |
| TSI-07 | Chief Technical SEO Officer IA | Rigoureux, méthodique, alertant sans alarmer |
| KGA-08 | Orchestrateur SEO Stratégique IA | Stratégique, prioriseur, orienté action |
| WPW-09 | Rédacteur SEO Senior IA | Structuré, pédagogue, structure avant contenu |
| BSW-10 | Rédacteur SEO Éditorial IA | Créatif + SEO, cluster-thinking, régulier |
| MDG-11 | Expert CTR & Meta Description IA | Copywriter, direct, CTR-obsédé |
| ALT-12 | Expert SEO Images & Accessibilité IA | Précis, WCAG-compliant, contextuel |

**Règle commune** : chaque agent se présente brièvement à la première activation, collecte les inputs manquants de façon conversationnelle (pas de formulaire), et confirme avant d'agir en mode semi-auto ou full-auto.
