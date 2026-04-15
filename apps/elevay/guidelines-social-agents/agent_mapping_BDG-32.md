# Agent Mapping — Marketing Budget Controller (BDG-32)

> CFO IA du département marketing — modélisation financière, arbitrage, alertes proactives.

---

## 1. Identité de l'agent

| Champ | Valeur |
|-------|--------|
| **Nom** | Marketing Budget Controller |
| **Code interne** | `AGT-MKT-BDG-32` |
| **Version** | 1.0 — Périmètre V1 |
| **Positionnement** | CFO IA du département marketing |
| **Catégorie** | Agent Finance & Pilotage Stratégique |
| **Canal d'accès** | Interface chat B2B + rapports automatiques + alertes |
| **Complexité** | Élevée — modélisation financière multi-horizons |
| **Statut** | Actif — Production V1 |

---

## 2. Problème résolu

**🔴 Sans l'agent :** Le CMO reçoit des rapports mais ne sait pas quoi couper. Les dépenses s'accumulent par canal. Les performances varient sans explication claire. Aucune vue prédictive sur l'impact des arbitrages. Résultat : décisions tardives, budget gaspillé, objectifs CA manqués.

**✅ Avec l'agent :** Vue consolidée multi-canaux avec score de santé budgétaire, détection proactive des dérives, simulateur What If pour les arbitrages, rapport automatique avec recommandations actionnables.

### Positionnement V1 (réaliste)

En V1, cet agent est un **tableau de bord marketing unifié avec copilote intelligent**. Il consolide les données de dépenses et performances, détecte les anomalies, et permet au CMO de poser des questions et simuler des scénarios. Ce n'est PAS un CFO autonome qui prend des décisions financières — c'est un outil d'aide à la décision.

---

## 3. Modules fonctionnels

### Module 1 — Monitoring continu & reporting

Analyse permanente des dépenses et performances par canal.

- Dépenses réelles vs budget planifié par canal (Google Ads, Meta, SEO, Email…)
- CPL, CAC, ROI par canal
- Performance vs objectifs : taux d'atteinte hebdo / mensuel
- Rapport automatique hebdomadaire ou mensuel selon préférence
- Vue consolidée multi-canaux

### Module 2 — Détection d'anomalies & alertes

Surveillance intelligente et notifications proactives.

- Détection sur-dépense : canal dépassant le seuil budgétaire défini
- Détection sous-performance : canal avec CAC ou CPL hors norme
- Identification opportunités de scaling : canal avec ROI > seuil cible
- Alerte dérive CAC : hausse progressive détectée avant le point critique
- Alertes push si niveau critique atteint (configurable)

**4 niveaux de scoring :**

| Score | Niveau | Action |
|---|---|---|
| 0–40 | 🔴 CRITIQUE | Alerte immédiate |
| 41–65 | 🟡 ATTENTION | Review recommandée |
| 66–80 | 🟢 CORRECT | Surveillance normale |
| 81–100 | 🔵 OPTIMAL | Opportunité scaling |

### Module 3 — Arbitrage intelligent

Recommandations concrètes et actionnables en continu.

- Recommandations en langage business : « Réduire Meta Ads de 20% »
- Priorisation des actions : impact fort / effort faible en premier
- Suggestions de réallocation budgétaire inter-canaux
- Justification chiffrée de chaque recommandation (ROI attendu)

**Arbre de décision :**

| Condition | Action recommandée |
|---|---|
| ROI canal < seuil min. ET budget > 15% alloué | Réduire de 20–30% ou Stop |
| CAC en hausse 3 semaines consécutives | Alerte dérive + analyse cause racine |
| ROI canal > 150% du ROI cible | Opportunité scaling : +15–25% |
| Canal < 60% budget consommé à mi-période | Vérification sous-perf ou sous-investissement |
| Dépense > 110% budget alloué | Alerte sur-dépense + rééquilibrage |
| Objectif CA à 30% de la fin de période | Simulation scénarios rattrapage |

### Module 4 — Simulation What If

Vision court / moyen / long terme pour piloter les investissements.

- Simulation d'impact : « Si je coupe Meta de 30%, mon CA baisse de X% »
- Projection fin d'année : budget consommé estimé vs budget planifié
- 3 scénarios : optimiste / nominal / pessimiste selon tendances
- Le client ajuste les hypothèses et relance la simulation

---

## 4. Score Santé Budgétaire (0–100)

| Composante | Poids | Calcul |
|---|---|---|
| Efficience budgétaire | 30% | ROI réel / ROI cible × 100 |
| Respect des seuils | 25% | Canaux dans le budget / total canaux |
| Atteinte objectifs | 25% | Leads/CA réel / objectif × 100 |
| Maîtrise du CAC | 15% | CAC cible / CAC réel (plafonné à 1) |
| Stabilité & tendance | 5% | Absence de dérive sur 4 semaines glissantes |

---

## 5. Intégrations

| Intégration | Données | Fréquence sync | Priorité V1 |
|---|---|---|---|
| Google Ads | Dépenses, clics, conversions, CPC, ROAS | Hebdomadaire | Core V1 |
| Meta Ads | Spend, CPL, reach, fréquence, conversions | Hebdomadaire | Core V1 |
| Google Analytics | Sessions, taux conv., attribution, revenus | Hebdomadaire | Core V1 |
| HubSpot | Leads, MQL, SQL, CAC réel, cycle de vente | Hebdomadaire | Core V1 |
| Google Sheets | Budget planifié, historique, paramètres | À la demande | Core V1 |
| ERP / Comptabilité | Dépenses réelles validées, marges, CA réel | Mensuelle | V2 |
| LinkedIn Ads | Spend B2B, CPL LinkedIn, conversions | Hebdomadaire | V2 |
| Salesforce CRM | Pipeline, revenus attribués, LTV client | Mensuelle | V2 |

Orchestration via Composio — synchronisation en batch hebdomadaire sur données agrégées par canal. Cache historique 12 mois activé.

---

## 6. Inputs & Outputs

### 6.1 — Configuration initiale

| Donnée | Description |
|---|---|
| Budget marketing annuel | Total alloué et répartition par canal |
| Objectifs CA / leads | Cibles annuelles et par trimestre |
| KPIs prioritaires | CPL cible, CAC cible, ROI minimum acceptable |
| Seuils d'alerte | % de dépassement budgétaire déclenchant une alerte |
| Canaux actifs | Liste des canaux avec budget alloué par canal |
| Fréquence rapports | Hebdomadaire ou mensuel |
| Période fiscale | Mois de début / fin d'exercice budgétaire |

### 6.2 — Outputs

| Livrable | Contenu | Fréquence |
|---|---|---|
| Score santé budgétaire | Indice 0–100 | Continu — visible en chat |
| Rapport de pilotage | Synthèse : dépenses, KPIs, écarts, recommandations | Hebdo ou mensuel |
| Liste d'arbitrages | Actions prioritaires classées par impact/effort | À chaque analyse |
| Projection annuelle | Budget consommé estimé vs objectif CA | Mensuel ou à la demande |
| Indice de risque | Score par canal + risque global | Continu |
| Alertes critiques | Notification push si seuil dépassé | Temps réel |
| Scénarios What If | Simulation impact réallocation | À la demande |

---

## 7. Parcours client

### PHASE 1 — Onboarding & configuration (J1 — ~30 min)

1. Le client choisit l'agent dans son tableau de bord
2. L'agent démarre le questionnaire conversationnel
3. Le client fournit : budget annuel, répartition par canal, KPIs cibles, seuils d'alerte
4. Le client connecte ses sources via OAuth : Google Ads, Meta, GA4, HubSpot
5. Le client partage son Google Sheets avec le budget planifié
6. L'agent exécute la première synchronisation et calcule le score santé initial

**Livrable :** Configuration validée + Score santé initial + Premier batch sync programmé

### PHASE 2 — Utilisation courante

1. Rapport automatique chaque lundi (ou 1er du mois) dans le chat
2. Score santé + synthèse par canal + top 3 actions prioritaires
3. Feux tricolores par canal (dépenses / ROI / statut)
4. Le client peut interroger l'agent à tout moment :
   - « Où en est mon budget cette semaine ? »
   - « Quel canal me coûte le plus cher en CAC ? »
   - « Est-ce que je vais atteindre mon objectif de leads ce trimestre ? »

**Livrable :** Réponses en temps réel + Rapport auto + Export Google Sheets

### PHASE 3 — Gestion d'une alerte critique

1. L'agent envoie un message proactif avec contexte complet
2. Recommandation d'action avec justification chiffrée
3. Le client peut demander une simulation What If avant de décider
4. L'agent calcule l'impact de la réallocation proposée

**Livrable :** Alerte détaillée + Simulation What If + Recommandation actionnable

### PHASE 4 — Projection & pilotage stratégique

1. Le client demande une projection annuelle
2. L'agent calcule budget estimé fin d'année selon tendance actuelle
3. 3 scénarios proposés : optimiste / nominal / pessimiste
4. Le client ajuste les hypothèses et relance
5. Recommandation de réallocation par canal pour le trimestre suivant

**Livrable :** Projection annuelle + 3 scénarios + Recommandation mix

---

## 8. Optimisation des coûts API

| Stratégie | Description |
|---|---|
| Synchronisation hebdomadaire | Pas de pull quotidien — agrégats par semaine |
| Données agrégées par canal | Pas de détail campagne — métriques consolidées |
| Cache historique 12 mois | Réutilisation données collectées pour calculs internes |
| Calculs internes prioritaires | Projections et scores calculés côté agent, pas via API externe |
| Alertes critiques uniquement | Push ciblé, pas pull global |
| Batch Composio | Toutes requêtes groupées en 1 appel |

---

## 9. Roadmap

### V1 — en production

- Monitoring hebdomadaire : Google Ads, Meta, GA4, HubSpot, Google Sheets
- Détection anomalies & alertes : 4 niveaux (CRITIQUE / ATTENTION / OK / OPTIMAL)
- Arbitrage intelligent : recommandations avec justification chiffrée
- Score santé budgétaire 0–100 en continu
- Rapport auto hebdo ou mensuel
- Alertes critiques push
- Simulation What If : impact réallocation à la demande
- Export Google Sheets

### Hors V1

| Module | Version |
|---|---|
| Intégration ERP / comptabilité | V2 |
| Dashboard web interactif (graphiques temps réel) | V2 |
| Intégration Salesforce | V2 |
| Benchmark sectoriel IA | V2 |
| Recommandation budget N+1 | V2 |
| Module attribution multi-touch | V2 |

---

## 10. Structure code recommandée

```
src/agents/budget-controller/
├── core/
│   ├── types.ts               ← BudgetConfig, ChannelMetrics, HealthScore, WhatIfScenario
│   ├── constants.ts           ← HEALTH_SCORE_WEIGHTS, ALERT_LEVELS, DECISION_TREE_RULES
│   └── prompts.ts             ← System prompts (reporting, arbitrage, simulation, projection)
├── modules/
│   ├── onboarding.ts          ← Configuration conversationnelle
│   ├── data-collector.ts      ← Sync hebdo Google Ads, Meta, GA4, HubSpot, Sheets (Composio)
│   ├── health-scorer.ts       ← Calcul score santé 0–100 (5 composantes)
│   ├── anomaly-detector.ts    ← Détection sur-dépense, sous-perf, dérive CAC
│   ├── arbitrator.ts          ← Arbre de décision → recommandations actionnables
│   ├── what-if-simulator.ts   ← Simulation réallocation → impact estimé
│   ├── projector.ts           ← Projection fin d'année + 3 scénarios
│   ├── alerter.ts             ← Notifications push (email, Slack, SMS)
│   └── reporter.ts            ← Rapport hebdo/mensuel + export Sheets
├── utils/
│   ├── data-cache.ts          ← Cache historique 12 mois
│   ├── kpi-calculator.ts      ← CPL, CAC, ROI, ROAS par canal
│   └── sheets-exporter.ts     ← Export/import Google Sheets
└── index.ts                   ← Orchestrateur
```

### Routes API

```
src/app/api/agents/budget-controller/
├── chat/route.ts              ← POST (SSE) — Conversation libre + commandes
├── configure/route.ts         ← POST — Configuration onboarding
├── sync/route.ts              ← POST — Trigger sync manuelle
├── health/route.ts            ← GET — Score santé actuel + détails
├── report/route.ts            ← GET — Rapport hebdo/mensuel
├── what-if/route.ts           ← POST — Simulation What If
├── projection/route.ts        ← GET — Projection fin d'année
├── alerts/route.ts            ← GET — Liste des alertes actives
└── dashboard/route.ts         ← GET — Données dashboard complet
```
