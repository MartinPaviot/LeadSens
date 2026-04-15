# Spec — Social Media Campaign Manager (SMC-19)

> Performance Marketing Manager autonome — organique + paid × 5 plateformes.
> Référence mapping : `agent_mapping_SMC-19.md`

---

## 1. Requirements

### REQ-SMC-001: Diagnostic initial & planification

**User Story :** En tant que CMO, je veux configurer mes objectifs, mon budget et mes plateformes via une conversation pour obtenir une stratégie opérationnelle complète sans remplir un formulaire complexe.

**Critères d'acceptation :**
- Le diagnostic est collecté via conversation dans le chat (pas un formulaire)
- L'agent collecte : objectif business, budget mensuel global, plateformes actives, mode vertical, audience cible, offre/produit, KPIs prioritaires, niveau d'autonomie
- L'agent importe l'historique de performances si disponible via les APIs connectées
- L'agent propose une stratégie opérationnelle complète : répartition budget, structure campagnes, calendrier organique
- Le client valide ou ajuste la stratégie dans le chat
- La configuration est persistée dans `ElevayAgentRun` et rechargée aux sessions suivantes
- Le brief est validé par Zod côté serveur

### REQ-SMC-002: Calendrier organique & publication

**User Story :** En tant que Content Manager, je veux un calendrier éditorial mensuel généré automatiquement avec publication directe pour ne plus planifier manuellement mes posts.

**Critères d'acceptation :**
- L'agent génère un calendrier mensuel avec posts adaptés par plateforme (format, ton, longueur)
- Le client peut prévisualiser les posts dans le chat avant publication
- La publication se fait via API (Composio) sur Meta, LinkedIn, X, TikTok
- L'agent identifie les posts à fort potentiel de sponsorisation et les signale
- Les horaires de publication sont basés sur les best practices engagement par réseau
- Le client peut modifier, ajouter ou retirer des posts du calendrier

### REQ-SMC-003: Gestion campagnes paid multi-plateforme

**User Story :** En tant que Performance Manager, je veux créer et gérer mes campagnes publicitaires sur 5 plateformes depuis un seul endroit pour unifier ma stratégie paid.

**Critères d'acceptation :**
- L'agent crée des campagnes sur Google Ads, Meta Ads, LinkedIn Ads, X Ads, TikTok Ads
- Chaque campagne a : objectif, audience, placements, budget, enchères, créatifs
- L'agent propose 2 variantes A/B par campagne (objet, créatif ou audience)
- Le séquencing cold → warm → retargeting → conversion est configuré automatiquement
- Les pixels de tracking sont vérifiés/configurés pour chaque plateforme
- En mode semi-auto : le client valide avant lancement. En full auto : lancement direct
- Pause/relance automatique selon les seuils de performance définis

### REQ-SMC-004: Répartition budgétaire dynamique

**User Story :** En tant que CMO, je veux que mon budget soit réalloué automatiquement vers les campagnes performantes pour maximiser mon ROI sans intervention manuelle.

**Critères d'acceptation :**
- Répartition initiale configurable (défaut : 40% cold / 25% retargeting / 25% scaling / 10% tests)
- La répartition évolue chaque semaine selon les KPIs détectés
- Si ROAS > objectif → scaling automatique +20%
- Si CPA > 2× cible → pause + ajustement audience/créatif
- Si CTR < benchmark → rotation créative déclenchée
- Si budget > 110% dépensé → alerte + pause automatique
- Le client peut définir des contraintes : budget min par plateforme, cap de dépense
- Les actions respectent le niveau d'autonomie choisi (full auto / semi-auto / supervision)

### REQ-SMC-005: Rapport hebdomadaire automatique

**User Story :** En tant que CMO, je veux recevoir un rapport hebdomadaire avec les KPIs, les actions prises et les recommandations pour avoir une vue claire de mes performances.

**Critères d'acceptation :**
- Le rapport est envoyé automatiquement chaque lundi dans le chat
- Il contient : KPIs agrégés par plateforme (CPA, ROAS, CPL, CTR, conversions, spend)
- Écarts vs objectifs avec identification des campagnes sous/sur-performantes
- Actions automatiques déjà exécutées (full auto) ou proposées (semi-auto)
- Recommandations pour le cycle suivant
- Le client peut demander un rapport à tout moment via le chat
- Le rapport est exportable en Google Sheets si souhaité

### REQ-SMC-006: Modes verticaux

**User Story :** En tant que marketeur, je veux que l'agent s'adapte à mon secteur d'activité pour prioriser les bons KPIs et les bonnes plateformes automatiquement.

**Critères d'acceptation :**
- 4 modes verticaux disponibles : E-commerce, B2B/Lead gen, SaaS, Personal Branding
- Chaque mode a ses KPIs prioritaires et sa logique de plateforme
- Le mode est détecté ou demandé lors du diagnostic initial
- Les seuils de performance, la répartition budget et les recommandations s'adaptent au mode

---

## 2. Design

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Chat + Dashboard UI                        │
│  Planning (Kanban) │ Campaigns (Liste) │ Performance     │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────────────┐
          │            │                    │
          ▼            ▼                    ▼
   ┌────────────┐ ┌──────────┐     ┌──────────────┐
   │ Organic    │ │  Paid    │     │  Budget      │
   │ Planner +  │ │ Manager  │     │  Allocator   │
   │ Publisher  │ │ ×5 plat. │     │  (dynamic)   │
   └────────────┘ └──────────┘     └──────────────┘
          │            │                    │
          └────────────┼────────────────────┘
                       ▼
              ┌─────────────────┐
              │   Reporter +    │
              │   Optimizer     │
              └─────────────────┘
```

### 2.2 Structure fichiers

```
src/agents/social-campaign-manager/
├── core/
│   ├── types.ts
│   ├── constants.ts
│   └── prompts.ts
├── modules/
│   ├── diagnostic.ts
│   ├── organic-planner.ts
│   ├── organic-publisher.ts
│   ├── paid-manager.ts
│   ├── budget-allocator.ts
│   ├── optimizer.ts
│   ├── reporter.ts
│   └── tracking-setup.ts
├── utils/
│   ├── platform-adapters/
│   │   ├── google-ads.ts
│   │   ├── meta-ads.ts
│   │   ├── linkedin-ads.ts
│   │   ├── x-ads.ts
│   │   └── tiktok-ads.ts
│   ├── audience-cache.ts
│   └── kpi-calculator.ts
└── index.ts
```

### 2.3 Routes API

| Route | Méthode | Description |
|---|---|---|
| `/api/agents/social-campaign-manager/chat` | POST (SSE) | Conversation principale |
| `/api/agents/social-campaign-manager/diagnostic` | POST | Diagnostic initial |
| `/api/agents/social-campaign-manager/organic/calendar` | GET/POST | Calendrier éditorial |
| `/api/agents/social-campaign-manager/organic/publish` | POST | Publication posts |
| `/api/agents/social-campaign-manager/paid/create` | POST | Créer campagne |
| `/api/agents/social-campaign-manager/paid/adjust` | POST | Ajuster campagne |
| `/api/agents/social-campaign-manager/paid/pause` | POST | Pause/relance |
| `/api/agents/social-campaign-manager/report` | GET | Rapport performance |
| `/api/agents/social-campaign-manager/budget` | GET/POST | Allocation budget |
| `/api/agents/social-campaign-manager/dashboard` | GET | Données dashboard |

### 2.4 Modèles de données

```typescript
interface CampaignBrief {
  objective: 'leads' | 'sales' | 'awareness' | 'launch' | 'activation' | 'branding';
  monthlyBudget: number;
  platforms: ('google' | 'meta' | 'linkedin' | 'x' | 'tiktok')[];
  vertical: 'ecommerce' | 'b2b' | 'saas' | 'personal-branding';
  audience: { demographics?: string; sector?: string; behavior?: string; persona?: string };
  product: { name: string; landingPage?: string; promoCode?: string };
  kpis: { cpaCible?: number; roasMin?: number; cplMax?: number; ctrTarget?: number; leadsTarget?: number };
  autonomyLevel: 'full-auto' | 'semi-auto' | 'supervision';
  budgetConstraints?: { minPerPlatform?: Record<string, number>; maxSpend?: number };
}

interface BudgetAllocation {
  cold: number;       // % cold acquisition
  retargeting: number; // % retargeting
  scaling: number;    // % scaling performantes
  tests: number;      // % tests créatifs
  byPlatform: Record<string, number>; // répartition par plateforme en €
}

interface CampaignStructure {
  platform: string;
  name: string;
  type: 'cold' | 'warm' | 'retargeting' | 'conversion';
  budget: number;
  audience: string;
  creatives: { variantA: string; variantB: string };
  kpiTargets: Record<string, number>;
  status: 'draft' | 'active' | 'paused' | 'completed';
}

interface WeeklyReport {
  week: number;
  platforms: Record<string, {
    spend: number;
    cpa: number;
    roas: number;
    cpl: number;
    ctr: number;
    conversions: number;
    status: 'ok' | 'attention' | 'critique';
  }>;
  actionsExecuted: string[];
  recommendations: string[];
  budgetReallocation?: BudgetAllocation;
}
```

### 2.5 UI/UX — "Mission Control"

**3 vues en tabs :**

1. **Planning** — Calendrier Kanban mensuel avec cards par jour/plateforme. Chaque card montre le post, la plateforme (icône), le statut (draft/publié/sponsorisé). Drag & drop pour réorganiser.

2. **Campaigns** — Liste des campagnes actives avec : nom, plateforme (badge), budget consommé (barre de progression), KPIs principaux (CPA, ROAS), statut feu tricolore (vert/orange/rouge), boutons Pause/Scale.

3. **Performance** — Dashboard graphique : spend vs conversions (line chart Recharts), répartition budget (donut chart), comparaison plateformes (bar chart horizontal), A/B test résultats (cards comparatives).

**Chat sidebar droite** pour les interactions avec l'agent (diagnostic, commandes, questions).

---

## 3. Tasks

### TASK-SMC-001: Scaffolding agent

**Description :** Créer la structure de fichiers, types et constantes.

**Étapes :**
1. Créer `src/agents/social-campaign-manager/` avec la structure complète
2. Définir tous les types dans `core/types.ts`
3. Définir les constantes : VERTICAL_CONFIGS (KPIs par vertical), BUDGET_DEFAULTS, KPI_THRESHOLDS, PLATFORM_CONFIGS
4. Créer les fichiers modules vides avec exports typés
5. Créer les platform adapters vides dans `utils/platform-adapters/`

**Dépendances :** Aucune

### TASK-SMC-002: Diagnostic & brief parser

**Description :** Implémenter le diagnostic conversationnel et le parsing du brief.

**Étapes :**
1. Créer le schéma Zod `CampaignBriefSchema`
2. Implémenter `diagnostic.ts` : flow conversationnel qui collecte les 9 champs du brief
3. Implémenter la détection automatique du vertical depuis les réponses
4. Générer la stratégie opérationnelle initiale (répartition budget + structure campagnes + calendrier)
5. Persister le brief dans `ElevayAgentRun`

**Dépendances :** TASK-SMC-001

### TASK-SMC-003: Organic planner + publisher

**Description :** Implémenter la génération du calendrier éditorial et la publication.

**Étapes :**
1. Implémenter `organic-planner.ts` : génération calendrier mensuel avec Claude
2. Adapter les posts par plateforme (format, ton, longueur, hashtags)
3. Calculer les horaires optimaux par réseau
4. Identifier les posts sponsorisables (scoring engagement potentiel)
5. Implémenter `organic-publisher.ts` : publication via Composio (Meta, LinkedIn, X, TikTok APIs)
6. Gérer les statuts de publication et les erreurs

**Dépendances :** TASK-SMC-002

### TASK-SMC-004: Paid campaign manager

**Description :** Implémenter la création et gestion des campagnes paid.

**Étapes :**
1. Créer les 5 platform adapters dans `utils/platform-adapters/` (Google, Meta, LinkedIn, X, TikTok)
2. Chaque adapter expose : `createCampaign()`, `pauseCampaign()`, `adjustBudget()`, `getPerformance()`
3. Implémenter `paid-manager.ts` : orchestration de la création de campagnes multi-plateformes
4. Implémenter le séquencing cold → warm → retargeting → conversion
5. Implémenter la génération de 2 variantes A/B par campagne
6. Gérer les niveaux d'autonomie (full auto / semi-auto / supervision)

**Dépendances :** TASK-SMC-002

### TASK-SMC-005: Budget allocator dynamique

**Description :** Implémenter la logique de répartition et réallocation budgétaire.

**Étapes :**
1. Implémenter `budget-allocator.ts` avec la répartition initiale configurable
2. Implémenter l'arbre de décision automatisé (6 règles : ROAS, CPA, CTR, budget, saturation, 0 conversion)
3. Appliquer les contraintes client (min par plateforme, cap dépense)
4. Respecter le niveau d'autonomie : exécution directe ou proposition à valider
5. Logger chaque réallocation dans l'historique pour le rapport

**Dépendances :** TASK-SMC-004

### TASK-SMC-006: Reporter & optimizer

**Description :** Implémenter le rapport hebdomadaire et l'optimisation continue.

**Étapes :**
1. Implémenter `kpi-calculator.ts` : agrégation des KPIs multi-plateformes
2. Implémenter `reporter.ts` : génération du rapport hebdomadaire (KPIs, écarts, actions, recommandations)
3. Implémenter `optimizer.ts` : analyse des patterns + détection des campagnes sous/sur-performantes
4. Générer les recommandations pour le cycle suivant via Claude
5. Implémenter l'envoi automatique du rapport chaque lundi (via Inngest cron)
6. Implémenter l'export Google Sheets du rapport

**Dépendances :** TASK-SMC-005

### TASK-SMC-007: Routes API

**Description :** Créer toutes les routes API de l'agent.

**Étapes :**
1. Créer la route chat SSE principale avec auth + workspaceId
2. Créer les routes organic (calendar, publish)
3. Créer les routes paid (create, adjust, pause)
4. Créer les routes report et budget
5. Créer la route dashboard (agrégation données pour le frontend)
6. Implémenter le cron Inngest pour le rapport hebdomadaire

**Dépendances :** TASK-SMC-006

### TASK-SMC-008: Tracking setup

**Description :** Implémenter la vérification et configuration des pixels de tracking.

**Étapes :**
1. Implémenter `tracking-setup.ts` : vérification pixels (Meta Pixel, TikTok Pixel, LinkedIn Insight, GA4)
2. Vérifier si les pixels sont déjà installés via les APIs
3. Guider le client pour l'installation si manquants
4. Configurer les conversion goals par plateforme
5. Tester le tracking avant lancement des campagnes

**Dépendances :** TASK-SMC-004

### TASK-SMC-009: UI Mission Control

**Description :** Créer l'interface dashboard 3 vues + chat sidebar.

**Étapes :**
1. Créer la page `src/app/(dashboard)/campaigns/page.tsx`
2. Implémenter les 3 tabs : Planning (Kanban), Campaigns (liste), Performance (graphiques)
3. Composant `CalendarKanban` : grille mensuelle avec cards posts, drag & drop
4. Composant `CampaignList` : tableau avec status badges, barres de progression budget, boutons action
5. Composant `PerformanceDashboard` : graphiques Recharts (line, donut, bar)
6. Implémenter la chat sidebar droite (assistant-ui, 320-380px)
7. Ajouter l'entrée dans la sidebar navigation
8. Respecter la charte Elevay

**Dépendances :** TASK-SMC-007
