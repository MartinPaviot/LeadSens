# Spec — Marketing Budget Controller (BDG-32)

> Tableau de bord marketing unifié avec copilote intelligent — score santé, alertes, simulation What If.
> Référence mapping : `agent_mapping_BDG-32.md`

---

## 1. Requirements

### REQ-BDG-001: Onboarding & configuration budgétaire

**User Story :** En tant que CMO, je veux configurer mon budget, mes canaux et mes objectifs via une conversation pour obtenir un score de santé budgétaire dès le premier jour.

**Critères d'acceptation :**
- Le diagnostic est collecté via le chat : budget annuel, répartition par canal, KPIs cibles (CPL, CAC, ROI min), seuils d'alerte, fréquence rapport, période fiscale
- Le client connecte ses sources via OAuth : Google Ads, Meta Ads, GA4, HubSpot
- Le client peut importer son budget planifié via Google Sheets (lien partagé ou upload)
- L'agent exécute la première synchronisation et calcule le score santé initial
- La configuration est persistée et modifiable via le chat ou les Settings
- Le brief est validé par Zod

### REQ-BDG-002: Synchronisation données hebdomadaire

**User Story :** En tant que CMO, je veux que mes données de dépenses et performances soient consolidées automatiquement chaque semaine pour ne plus compiler manuellement.

**Critères d'acceptation :**
- Sync hebdomadaire automatique via Composio (batch) : Google Ads, Meta Ads, GA4, HubSpot
- Données agrégées par canal (pas par campagne individuelle)
- Métriques collectées : dépenses, clics, conversions, CPL, CAC, ROI/ROAS par canal
- Budget planifié chargé depuis Google Sheets
- Cache historique 12 mois pour les calculs de tendance
- Dégradé gracieux si une source est indisponible (données partielles marquées)
- Le client peut déclencher une sync manuelle via le chat

### REQ-BDG-003: Score santé budgétaire

**User Story :** En tant que CMO, je veux un indicateur unique 0–100 qui me dit immédiatement si mon budget marketing est en bonne santé ou en danger.

**Critères d'acceptation :**
- Score calculé selon 5 composantes pondérées : efficience (30%), respect seuils (25%), atteinte objectifs (25%), maîtrise CAC (15%), stabilité (5%)
- 4 niveaux : CRITIQUE (0–40), ATTENTION (41–65), CORRECT (66–80), OPTIMAL (81–100)
- Score actualisé à chaque sync hebdomadaire
- Score visible en tête du dashboard et dans le chat à la demande
- Historique du score consultable (tendance sur les dernières semaines)

### REQ-BDG-004: Détection d'anomalies & alertes proactives

**User Story :** En tant que CMO, je veux être alerté proactivement quand un canal dérape pour intervenir avant que ça impacte mes objectifs.

**Critères d'acceptation :**
- Détection sur-dépense : canal dépassant le seuil défini (ex : +15%)
- Détection sous-performance : CAC ou CPL hors norme par rapport à la cible
- Détection opportunité : canal avec ROI > 150% de la cible
- Détection dérive CAC : hausse progressive sur 2-3 semaines consécutives
- Alertes CRITIQUE envoyées immédiatement via le canal configuré (email, Slack, SMS)
- Alertes ATTENTION incluses dans le prochain rapport
- Chaque alerte inclut : canal concerné, niveau, impact estimé, recommandation d'action
- Les seuils d'alerte sont configurables par le client

### REQ-BDG-005: Rapport automatique

**User Story :** En tant que CMO, je veux recevoir un rapport de pilotage structuré chaque semaine pour avoir une vue claire sans chercher l'information.

**Critères d'acceptation :**
- Rapport envoyé automatiquement dans le chat (lundi matin ou 1er du mois selon config)
- Contenu : score santé, synthèse par canal (dépenses/ROI/statut feu tricolore), top 3 actions prioritaires, projection annuelle
- Le rapport est exportable en Google Sheets
- Le client peut demander un rapport à tout moment via le chat
- Le rapport est généré par Claude pour la synthèse et les recommandations

### REQ-BDG-006: Arbitrage intelligent

**User Story :** En tant que CMO, je veux des recommandations concrètes et chiffrées pour savoir quoi couper, quoi scaler et quoi tester.

**Critères d'acceptation :**
- L'agent applique l'arbre de décision (6 règles) à chaque analyse
- Recommandations formulées en langage business (pas en métriques brutes)
- Chaque recommandation inclut : action, impact estimé, justification chiffrée
- Recommandations classées par priorité (impact fort / effort faible en premier)
- Le client peut demander « Quel canal couper ? » et obtenir une réponse argumentée

### REQ-BDG-007: Simulation What If

**User Story :** En tant que CMO, je veux simuler l'impact d'une réallocation budgétaire avant de prendre ma décision pour réduire le risque.

**Critères d'acceptation :**
- Le client formule sa question dans le chat : « Que se passe-t-il si je coupe Meta de 30% ? »
- L'agent calcule l'impact estimé sur : leads, CAC global, CA projeté, score santé
- Simulation basée sur les données historiques (pas de modèle ML — calculs proportionnels)
- Le client peut enchaîner plusieurs scénarios
- Le client peut demander une projection fin d'année avec 3 scénarios (optimiste/nominal/pessimiste)

### REQ-BDG-008: Interrogation libre

**User Story :** En tant que CMO, je veux poser n'importe quelle question sur mon budget dans le chat et obtenir une réponse immédiate avec les données à jour.

**Critères d'acceptation :**
- Le client peut demander : « Où en est mon budget ? », « Quel canal a le meilleur ROI ? », « Combien me reste-t-il sur Meta ce mois ? », « Est-ce que je vais atteindre mon objectif de leads ? »
- L'agent répond en langage naturel avec les données consolidées
- Les réponses incluent les chiffres pertinents sans noyer le client dans les détails
- Si les données sont stales (dernière sync > 7 jours), l'agent le signale

---

## 2. Design

### 2.1 Architecture

```
┌─────────────────────────────────────────────┐
│            Dashboard + Chat                  │
│  Score Santé │ Canaux │ What If │ Projection │
└──────────────────────┬──────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌──────────┐ ┌──────────────┐
   │   Data     │ │ Health   │ │  Anomaly     │
   │ Collector  │ │ Scorer   │ │  Detector    │
   │ (Composio) │ │ (0-100)  │ │  + Alerter   │
   └────────────┘ └──────────┘ └──────────────┘
                       │
              ┌────────┼────────┐
              ▼                 ▼
       ┌────────────┐   ┌────────────┐
       │ Arbitrator │   │ What If    │
       │ (recs)     │   │ Simulator  │
       └────────────┘   └────────────┘
              │
              ▼
       ┌────────────┐
       │  Reporter  │
       │  + Export   │
       └────────────┘
```

### 2.2 Structure fichiers

Voir section 10 du mapping.

### 2.3 Types principaux

```typescript
interface BudgetConfig {
  annualBudget: number;
  channels: ChannelBudget[];
  objectives: { annualRevenue: number; quarterlyRevenue: number[]; monthlyLeads: number };
  kpiTargets: { cplTarget: number; cacTarget: number; roiMinimum: number };
  alertThresholds: { overSpendPercent: number; cacDeviationWeeks: number };
  reportFrequency: 'weekly' | 'monthly';
  fiscalYearStart: number; // mois (1-12)
  escalationChannel: 'email' | 'slack' | 'sms';
}

interface ChannelBudget {
  channel: string; // 'google-ads', 'meta-ads', 'seo', 'email', etc.
  annualBudget: number;
  monthlyBudget: number;
}

interface ChannelMetrics {
  channel: string;
  period: string; // 'week-2024-W48' ou 'month-2024-12'
  spend: number;
  budgetAllocated: number;
  clicks: number;
  conversions: number;
  leads: number;
  revenue: number;
  cpl: number;
  cac: number;
  roi: number;
  roas: number;
  status: 'critical' | 'attention' | 'ok' | 'optimal';
}

interface HealthScore {
  total: number; // 0-100
  level: 'critical' | 'attention' | 'ok' | 'optimal';
  components: {
    efficiency: number;     // ROI réel / ROI cible
    budgetCompliance: number; // canaux dans le budget / total
    goalAttainment: number;   // leads ou CA réel / objectif
    cacControl: number;       // CAC cible / CAC réel
    stability: number;        // absence de dérive 4 semaines
  };
  trend: 'improving' | 'stable' | 'declining';
  calculatedAt: string;
}

interface Alert {
  id: string;
  level: 'critical' | 'attention' | 'opportunity';
  channel: string;
  type: 'overspend' | 'underperformance' | 'cac-drift' | 'scaling-opportunity' | 'goal-at-risk';
  message: string;
  impact: string;
  recommendation: string;
  metrics: Record<string, number>;
  createdAt: string;
  acknowledged: boolean;
}

interface WhatIfScenario {
  description: string; // « Meta -30%, Google +30% »
  adjustments: { channel: string; changePercent: number }[];
  projectedImpact: {
    leadsChange: number;
    cacChange: number;
    revenueChange: number;
    newHealthScore: number;
    budgetCompliance: boolean;
  };
}

interface AnnualProjection {
  currentSpend: number;
  projectedSpend: number;
  budgetAllocated: number;
  variance: number;
  revenueAchieved: number;
  revenueTarget: number;
  scenarios: {
    optimistic: { spend: number; revenue: number; healthScore: number };
    nominal: { spend: number; revenue: number; healthScore: number };
    pessimistic: { spend: number; revenue: number; healthScore: number };
  };
}
```

### 2.4 UI/UX — "Financial Command Center"

**Layout dashboard :**

1. **Header :** Score santé budgétaire dans un grand anneau animé (0–100), couleur selon niveau (vert/orange/rouge). Tendance (↑ improving / → stable / ↓ declining).

2. **Grille canaux :** Metric cards par canal. Chaque card : nom du canal, budget consommé vs alloué (barre de progression), ROI actuel vs cible, feu tricolore (vert/orange/rouge). Cards cliquables → détail canal.

3. **Graphique projection :** Line chart Recharts — projection annuelle avec 3 scénarios en overlay (optimiste en vert transparent, nominal en bleu, pessimiste en rouge transparent). Budget planifié en ligne pointillée.

4. **Module What If :** Section interactive en bas. Le client ajuste des sliders par canal (ex : « Meta -30% ») et voit l'impact estimé en temps réel (CAC global, CA projeté, nouveau score santé). Bouton « Appliquer ce scénario » qui envoie la recommandation dans le chat.

5. **Chat sidebar droite (380px) :** Pour les questions libres, les alertes, et les rapports. Les alertes critiques déclenchent un toast Sonner + bandeau persistant en haut du dashboard.

---

## 3. Tasks

### TASK-BDG-001: Scaffolding agent

**Description :** Créer la structure de fichiers, types et constantes.

**Étapes :**
1. Créer `src/agents/budget-controller/` avec la structure complète
2. Définir tous les types dans `core/types.ts`
3. Constantes : HEALTH_SCORE_WEIGHTS, ALERT_LEVELS, DECISION_TREE_RULES
4. Créer les fichiers modules vides

**Dépendances :** Aucune

### TASK-BDG-002: Onboarding & configuration

**Description :** Implémenter le flow d'onboarding conversationnel.

**Étapes :**
1. Schéma Zod `BudgetConfigSchema`
2. Flow conversationnel : collecte budget, canaux, KPIs, seuils, fréquence rapport
3. Connexion OAuth sources (Google Ads, Meta, GA4, HubSpot) via Composio
4. Import budget planifié depuis Google Sheets
5. Persister `BudgetConfig` dans workspace settings
6. Route `/api/agents/budget-controller/configure`

**Dépendances :** TASK-BDG-001

### TASK-BDG-003: Data collector

**Description :** Implémenter la synchronisation hebdomadaire des données.

**Étapes :**
1. Implémenter `data-collector.ts` : batch Composio pour Google Ads, Meta, GA4, HubSpot
2. Agrégation par canal (pas par campagne)
3. Calculer les métriques dérivées : CPL, CAC, ROI, ROAS par canal
4. Implémenter `data-cache.ts` : cache historique 12 mois (mémoire ou DB)
5. Configurer le cron Inngest pour la sync hebdomadaire automatique
6. Route `/api/agents/budget-controller/sync` pour trigger manuel
7. Dégradé gracieux si une source est indisponible

**Dépendances :** TASK-BDG-002

### TASK-BDG-004: Health scorer

**Description :** Implémenter le calcul du score de santé budgétaire.

**Étapes :**
1. Implémenter `health-scorer.ts` : calcul des 5 composantes pondérées
2. Efficience = ROI réel / ROI cible × 100 (plafonné à 100)
3. Compliance = canaux dans le budget / total canaux × 100
4. Goal attainment = leads ou CA réel / objectif × 100 (plafonné à 100)
5. CAC control = min(CAC cible / CAC réel, 1) × 100
6. Stability = absence de dérive sur 4 semaines (binaire ou score progressif)
7. Total = somme pondérée → niveau (CRITIQUE/ATTENTION/OK/OPTIMAL)
8. Calcul de la tendance (improving/stable/declining) vs semaine précédente
9. Historique des scores stocké pour le graphique de tendance

**Dépendances :** TASK-BDG-003

### TASK-BDG-005: Anomaly detector & alerter

**Description :** Détecter les anomalies et envoyer les alertes.

**Étapes :**
1. Implémenter `anomaly-detector.ts` : 6 règles de l'arbre de décision
2. Sur-dépense : dépenses > budget × (1 + seuil configuré)
3. Sous-performance : CAC > 2× cible ou CPL > cible + 30%
4. Dérive CAC : hausse consécutive sur N semaines (configurable)
5. Opportunité scaling : ROI > 150% cible
6. Sous-consommation : < 60% budget à mi-période
7. Objectif menacé : CA projeté < objectif avec < 8 semaines restantes
8. Implémenter `alerter.ts` : envoi notifications (email via Resend, Slack via webhook, SMS via Twilio)
9. Les alertes CRITIQUE sont envoyées immédiatement, les ATTENTION dans le rapport
10. Route `/api/agents/budget-controller/alerts`

**Dépendances :** TASK-BDG-004

### TASK-BDG-006: Arbitrator

**Description :** Générer les recommandations d'arbitrage budgétaire.

**Étapes :**
1. Implémenter `arbitrator.ts` : appliquer l'arbre de décision aux données actuelles
2. Formuler les recommandations en langage business via Claude
3. Chaque recommandation = action + impact estimé + justification chiffrée
4. Classer par priorité : impact fort / effort faible en premier
5. Intégrer dans le rapport et le chat (quand le client demande « Quel canal couper ? »)

**Dépendances :** TASK-BDG-005

### TASK-BDG-007: What If simulator

**Description :** Implémenter le simulateur de réallocation budgétaire.

**Étapes :**
1. Implémenter `what-if-simulator.ts` : prend des ajustements (canal, % changement)
2. Calcul proportionnel basé sur l'historique : si Meta avait X leads pour Y€, +30% de budget ≈ +30% leads × coefficient de rendement décroissant
3. Recalculer : leads projetés, CAC global, CA projeté, nouveau score santé
4. Vérifier la compliance budget (on ne dépasse pas le total)
5. Supporter l'enchaînement de scénarios dans le chat
6. Route `/api/agents/budget-controller/what-if`

**Dépendances :** TASK-BDG-004

### TASK-BDG-008: Projector

**Description :** Implémenter la projection fin d'année et les 3 scénarios.

**Étapes :**
1. Implémenter `projector.ts` : extrapolation linéaire basée sur la tendance actuelle
2. 3 scénarios : optimiste (tendance haute), nominal (tendance actuelle), pessimiste (tendance basse)
3. Pour chaque scénario : spend projeté, revenue projeté, score santé projeté
4. Comparaison avec le budget planifié et l'objectif CA
5. Route `/api/agents/budget-controller/projection`

**Dépendances :** TASK-BDG-004

### TASK-BDG-009: Reporter & export

**Description :** Implémenter le rapport automatique et l'export Sheets.

**Étapes :**
1. Implémenter `reporter.ts` : agrégation + synthèse Claude + recommandations
2. Format du rapport : score santé, tableau par canal (feux tricolores), top 3 actions, projection
3. Configurer le cron Inngest (lundi matin ou 1er du mois)
4. Implémenter `sheets-exporter.ts` : export vers Google Sheets (Composio)
5. Route `/api/agents/budget-controller/report`
6. Le client peut demander un rapport ad-hoc dans le chat

**Dépendances :** TASK-BDG-006, TASK-BDG-008

### TASK-BDG-010: Route API chat SSE

**Description :** Créer la route chat principale avec streaming.

**Étapes :**
1. Créer `src/app/api/agents/budget-controller/chat/route.ts`
2. Auth + workspaceId
3. Charger la BudgetConfig depuis la DB
4. Charger les données consolidées depuis le cache
5. Router les questions vers les bons modules (arbitrage, what-if, projection, rapport, interrogation libre)
6. Streamer les réponses en SSE
7. Sauvegarder les runs dans `ElevayAgentRun`

**Dépendances :** TASK-BDG-009

### TASK-BDG-011: UI Financial Command Center

**Description :** Créer l'interface dashboard avec score, canaux, projection et What If.

**Étapes :**
1. Créer la page `src/app/(dashboard)/budget/page.tsx`
2. **Header :** Composant `HealthScoreRing` — anneau SVG animé 0–100, couleur par niveau, tendance
3. **Grille canaux :** Composant `ChannelCard` × N — barre de progression budget, ROI vs cible, feu tricolore
4. **Projection :** Composant `ProjectionChart` — line chart Recharts avec 3 scénarios superposés
5. **What If :** Composant `WhatIfSimulator` — sliders par canal, impact estimé en temps réel (appel API debounced), bouton « Appliquer ce scénario »
6. **Chat sidebar droite (380px) :** assistant-ui pour les questions libres
7. **Alertes :** Toast Sonner pour les alertes critiques + bandeau persistant en haut
8. Ajouter l'entrée dans la sidebar navigation
9. Respecter la charte Elevay : teal pour score OK, orange pour ATTENTION, rouge pour CRITIQUE

**Dépendances :** TASK-BDG-010

### TASK-BDG-012: Dashboard route

**Description :** Créer la route API qui fournit toutes les données du dashboard.

**Étapes :**
1. Route `/api/agents/budget-controller/dashboard`
2. Retourne : healthScore, channelMetrics[], activeAlerts[], lastProjection, lastReport
3. Les données viennent du cache (pas de sync en live)
4. Inclure la date de dernière sync pour que le frontend affiche la fraîcheur des données

**Dépendances :** TASK-BDG-009
