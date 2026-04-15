# Agent Mapping — Social Media Campaign Manager (SMC-19)

> Performance Marketing Manager autonome — organique + paid × 5 plateformes.

---

## 1. Identité de l'agent

| Champ | Valeur |
|-------|--------|
| **Nom** | Social Media Campaign Manager |
| **Code interne** | `AGT-MKT-SMC-19` |
| **Version** | 1.0 — Périmètre V1 |
| **Positionnement** | Performance Marketing Manager autonome |
| **Catégorie** | Agent Performance — Organique + Paid |
| **Canaux** | Google Ads, Meta Ads, LinkedIn Ads, X Ads, TikTok Ads + Organic |
| **Relation** | Complémentaire Agent 15 (Ads Strategy) — Agent 19 exécute, Agent 15 stratégise |
| **Canal d'accès** | Interface chat B2B + automations hebdomadaires |
| **Complexité** | Élevée — orchestration multi-plateforme + logique budgétaire dynamique |
| **Statut** | Actif — Production V1 |

---

## 2. Problème résolu

**🔴 Sans l'agent :** L'organique et le paid sont gérés séparément. Les budgets sont mal répartis. Les campagnes ne sont pas alignées avec le contenu. Les tests A/B sont mal structurés. Le retargeting est sous-exploité. L'optimisation se fait trop tard. Résultat : ROI instable.

**✅ Avec l'agent :** Cet agent structure tout : il planifie, lance, gère et optimise simultanément les posts organiques et les campagnes paid sur 5 réseaux. Il réalloue le budget dynamiquement selon les performances et synchronise le contenu organique avec le paid.

### Relation avec l'Agent 15 — Ads Strategy

| Agent 15 — Ads Strategy | Agent 19 — SMC |
|---|---|
| Définit la stratégie globale | Exécute la stratégie opérationnellement |
| Choisit les plateformes prioritaires | Crée et lance toutes les campagnes |
| Fixe les objectifs KPI | Publie le contenu organique |
| Définit les audiences stratégiques | Réalloue le budget dynamiquement |
| Arbitre les grandes orientations budget | Optimise et ajuste en continu |

---

## 3. Modules fonctionnels

### Module 1 — Diagnostic initial & planification

Cadrage complet avant toute action — structuration du plan opérationnel.

- Collecte objectifs business : leads, ventes, notoriété, lancement, activation
- Budget global mensuel + répartition souhaitée par plateforme
- Plateformes actives + audience cible + offre/produit promu
- KPIs prioritaires : CPA, ROAS, CPL, CTR selon le mode vertical (e-com, B2B, SaaS, personal branding)
- Historique performances si disponible — calibration du modèle d'optimisation
- Construction : calendrier organique mensuel + mapping posts sponsorisables
- Structure des campagnes paid : cold, warm, retargeting, conversion

### Module 2 — Création & publication organique

Génération et publication automatisée du contenu social sur toutes les plateformes.

- Génération de posts adaptés à chaque plateforme (format, ton, longueur)
- Planification automatique selon best practices engagement par réseau
- Publication via API : Meta, LinkedIn, X, TikTok
- Identification des posts à fort potentiel de sponsorisation
- Variation des formats : texte, image, vidéo, carousel, stories
- Batch créatif via Claude — génération groupée pour réduire les coûts

### Module 3 — Gestion des campagnes paid (5 plateformes)

Création, lancement et gestion opérationnelle de toutes les campagnes publicitaires.

- **Google Ads** : Search, Display, YouTube — objectifs, audiences, enchères, tracking
- **Meta Ads** : Facebook + Instagram — ad sets, placements, créatifs, pixel
- **LinkedIn Ads** : Sponsored Content, Message Ads — ciblage professionnel
- **X Ads** : Promoted Posts, campagnes Reach / Engagement
- **TikTok Ads** : In-Feed Ads, TopView — ciblage gen Z + créatifs vidéo
- Séquencing acquisition : Cold audience → Warm → Retargeting → Conversion
- Pause/relance automatique selon seuils de performance

### Module 4 — Répartition budgétaire dynamique

Allocation et réallocation intelligente du budget selon les performances.

**Répartition initiale par défaut :**

| Segment | Part | Description |
|---|---|---|
| Cold acquisition | 40% | Nouvelles audiences |
| Retargeting | 25% | Visiteurs + engagés |
| Scaling | 25% | Campagnes performantes |
| Tests créatifs | 10% | Nouvelles variantes |

La répartition évolue dynamiquement chaque semaine selon les performances. Le client peut définir des contraintes : budget minimum par plateforme, cap de dépense, validation avant scaling.

**Arbre de décision automatisé :**

| Condition détectée | Seuil | Action automatique | Validation requise |
|---|---|---|---|
| ROAS > objectif fixé | ex. > 4× | Scaling +20% budget campagne | Non (full auto) |
| CPA > seuil maximum | ex. > 2× cible | Pause + ajustement audience ou créatif | Configurable |
| CTR < benchmark | ex. < 0,8% | Rotation créative déclenchée | Non (full auto) |
| Budget à 110% dépensé | Avant fin période | Alerte + pause automatique | Oui |
| Retargeting audience saturée | Freq. > 8× | Rotation audience + créatifs | Non (full auto) |
| Campagne 0 conversion 7j | Performance nulle | Pause + analyse cause | Oui |

### Module 5 — Optimisation continue & apprentissage

Analyse hebdomadaire des performances + ajustements systématiques.

- Analyse performance agrégée hebdomadaire par campagne (pas par annonce)
- Pause des campagnes sous-performantes + réallocation budget
- Lancement de nouvelles variantes créatives basées sur les gagnants
- Optimisation pilotage par KPI business, pas par métrique vanité
- Agrégation data multi-plateformes avant traitement IA — réduction coûts
- Rapport hebdomadaire automatique dans le chat
- Recommandations pour le cycle suivant

---

## 4. Niveaux d'autonomie (choix du client)

| Mode | Comportement |
|---|---|
| **Full auto** | Scaling auto, éviction campagnes, rotation créa auto, publication organique auto |
| **Semi-auto** | Scaling → validation client, pause auto budget, créatifs validés avant envoi, publication auto OK |
| **Supervision** | Toutes actions validées, l'agent propose seulement, client exécute manuellement |

---

## 5. Modes verticaux — Adaptation par secteur

| Mode | KPI prioritaire | Focus |
|---|---|---|
| **E-commerce** | ROAS | Scale produits + ROAS > 3× |
| **B2B / Lead gen** | CPL | LinkedIn + Google Search focus |
| **SaaS** | CAC / LTV | Retargeting long + nurturing |
| **Personal Branding** | Reach + engagement | Organique dominant + paid boost |

---

## 6. Intégrations & Stack technique

### Couche 1 — APIs Paid Media

| Plateforme | Usage | Priorité V1 |
|---|---|---|
| Google Ads API | Search + Display + YouTube | Core V1 |
| Meta Ads API | FB + Instagram Ads | Core V1 |
| LinkedIn Ads API | B2B Sponsored | Core V1 |
| X Ads API | Promoted Posts | Core V1 |
| TikTok Ads API | In-Feed + TopView | Core V1 |

### Couche 2 — APIs Social Media Organique

| Plateforme | Usage | Priorité V1 |
|---|---|---|
| Meta for Developers | IG + FB publishing | Core V1 |
| LinkedIn Marketing API | Post + Insights | Core V1 |
| X API v2 | Tweets + Analytics | Core V1 |
| TikTok Developers | Video + Analytics | Core V1 |
| Reddit API | Posts + Monitoring | Best effort V1 |

### Couche 3 — Tracking & Attribution

| Outil | Usage | Priorité V1 |
|---|---|---|
| GA Data API | Sessions + Conversions | Core V1 |
| Google Tag Manager | Event tracking | Core V1 |
| Meta Pixel | FB/IG conversions | Core V1 |
| TikTok Pixel | TikTok conversions | Core V1 |
| LinkedIn Insight Tag | B2B attribution | Core V1 |

### Couche 4 — Génération créative & stockage

| Outil | Usage | Priorité V1 |
|---|---|---|
| Claude (Anthropic) | Texte + stratégie | Core V1 |
| Google Sheets | Planning + Dashboard | Core V1 |
| Composio MCP | Orchestration globale | Colonne vertébrale |

---

## 7. Inputs & Outputs

### 7.1 — Brief structuré (collecte au démarrage)

| Champ | Description |
|---|---|
| Objectif business | Lead gen, ventes, notoriété, lancement, activation, branding |
| Budget mensuel global | Total + préférence de répartition par plateforme si définie |
| Plateformes actives | Google, Meta, LinkedIn, X, TikTok — 1 à 5 selon stratégie |
| Mode vertical | E-commerce (ROAS), B2B (CPL), SaaS (CAC/LTV), Personal Branding |
| Audience cible | Démographie, secteur, comportement, persona |
| Offre / produit promu | Produit, service, landing page, code promo, event |
| KPIs prioritaires | CPA cible, ROAS min., CPL max., CTR attendu, objectif leads/mois |
| Niveau d'autonomie | Full auto / Semi-auto / Supervision |
| Historique performances | Import optionnel pour calibrer le modèle d'optimisation |

### 7.2 — Outputs produits

| Livrable | Contenu | Trigger / Fréquence |
|---|---|---|
| Calendrier organique | Planning mensuel des posts par plateforme + horaires | Mensuel ou à la demande |
| Contenus générés | Posts, captions, hashtags, variantes A/B créatifs | Par campagne |
| Structure campagnes paid | Objectifs, audiences, placements, budgets, enchères | Au lancement |
| Plan budget dynamique | % cold / % retargeting / % scaling / % tests | Hebdomadaire |
| Rapport performance | KPIs agrégés par plateforme, écarts, gagnants A/B | Hebdomadaire auto |
| Alertes & ajustements | Pause campagne, rotation créa, scaling, réalloc budget | Dès détection KPI |
| Recommandations | Actions pour le prochain cycle basées sur les patterns | Post-analyse hebdo |

---

## 8. Parcours client

### PHASE 1 — Onboarding & diagnostic (J1)

1. Le client choisit l'agent et connecte ses plateformes via OAuth
2. L'agent importe l'historique de performances et calibre le modèle
3. Le client répond au diagnostic structuré dans le chat : objectifs, KPIs, budget, vertical
4. L'agent génère la stratégie opérationnelle initiale et la soumet pour validation

**Livrable :** Stratégie opérationnelle validée + Comptes connectés + Historique importé + Budget alloué par plateforme

### PHASE 2 — Lancement campagnes & contenu organique

1. L'agent génère le calendrier éditorial mensuel par plateforme
2. Le client prévisualise et valide les posts dans le chat
3. L'agent configure et lance les campagnes paid sur chaque plateforme
4. Génère les créatifs et propose 2 variantes A/B
5. Tracking conversions configuré : pixels activés, conversion goals définis

**Livrable :** Calendrier organique mensuel + Campagnes paid actives + Créatifs A/B lancés + Tracking configuré

### PHASE 3 — Optimisation hebdomadaire

1. Rapport automatique chaque lundi dans le chat
2. KPIs agrégés par plateforme avec écarts vs objectifs
3. Actions automatiques exécutées (full auto) ou proposées (semi-auto)
4. Campagnes sous-performantes mises en pause + budget réalloué
5. Rotation créative et lancement nouvelles variantes

**Livrable :** Rapport hebdo + Réallocations exécutées + Nouvelles variantes créatives + Recommandations

---

## 9. Optimisation des coûts API

| Stratégie | Description |
|---|---|
| Lecture performance hebdo | Pas de monitoring temps réel — batch hebdomadaire |
| Agrégation au niveau campagne | Pas d'analyse annonce par annonce — KPIs agrégés |
| Cache audiences | Structures audiences en cache — pas de régénération inutile |
| Cache structures campagnes | Pas de refetch complet si rien n'a changé |
| Batch créatifs | Génération groupée — pas de call unitaire pour chaque créatif |
| Webhooks vs polling | Pas de polling permanent — webhooks Composio pour triggers |
| Centralisation data avant IA | Agrégation multi-plateformes avant traitement — 1 appel vs N |

---

## 10. Roadmap

### V1 — en production

- Diagnostic & planification : brief structuré + stratégie opérationnelle + budget initial
- Contenu organique : génération + publication via API sur 5 réseaux
- Campagnes paid ×5 : Google, Meta, LinkedIn, X, TikTok — création + lancement
- Budget dynamique : répartition + réallocation hebdomadaire selon KPIs
- Tracking & attribution : pixels + GA4 + conversion goals configurés
- Rapport hebdo automatique : KPIs agrégés + écarts + actions exécutées
- A/B test créatifs : 2 variantes par campagne, gagnant détecté auto
- Niveaux d'autonomie : full auto / semi-auto / supervision
- 4 modes verticaux : e-commerce, B2B, SaaS, personal branding

### Hors V1

| Module | Version |
|---|---|
| Couplage Agent 15 | V2 — connexion stratégique avec l'Ads Strategy Agent |
| Prédiction performance | V2 — modèle ML prédictif de CPA/ROAS avant lancement |
| Retargeting avancé | V2 — audiences lookalike dynamiques + séquencing cross-plateforme |
| Dashboard web | V2 — interface graphique dédiée historique + planning |
| Reddit Ads | V2 — intégration plateforme publicitaire Reddit |
| Attribution multi-touch | V2 — modèle d'attribution avancé entre canaux |

---

## 11. Structure code recommandée

```
src/agents/social-campaign-manager/
├── core/
│   ├── types.ts                 ← CampaignBrief, CampaignStructure, BudgetAllocation, PerformanceReport
│   ├── constants.ts             ← VERTICAL_CONFIGS, BUDGET_DEFAULTS, KPI_THRESHOLDS
│   └── prompts.ts               ← System prompts (diagnostic, organic, paid, optimization, reporting)
├── modules/
│   ├── diagnostic.ts            ← Onboarding conversationnel + calibration
│   ├── organic-planner.ts       ← Calendrier éditorial + génération posts
│   ├── organic-publisher.ts     ← Publication via API (Composio)
│   ├── paid-manager.ts          ← Création + gestion campagnes paid ×5
│   ├── budget-allocator.ts      ← Répartition dynamique + arbre de décision
│   ├── optimizer.ts             ← Analyse hebdo + ajustements + A/B
│   ├── reporter.ts              ← Rapport hebdo + alertes
│   └── tracking-setup.ts        ← Configuration pixels + conversion goals
├── utils/
│   ├── platform-adapters/       ← Un adapter par plateforme (google, meta, linkedin, x, tiktok)
│   ├── audience-cache.ts        ← Cache structures audiences
│   └── kpi-calculator.ts        ← Calculs KPI agrégés
└── index.ts                     ← Orchestrateur principal
```

### Routes API

```
src/app/api/agents/social-campaign-manager/
├── chat/route.ts                ← POST (SSE) — Conversation diagnostic + commandes
├── diagnostic/route.ts          ← POST — Diagnostic initial structuré
├── organic/
│   ├── calendar/route.ts        ← GET/POST — Calendrier éditorial
│   └── publish/route.ts         ← POST — Publication posts
├── paid/
│   ├── create/route.ts          ← POST — Créer une campagne
│   ├── adjust/route.ts          ← POST — Ajuster budget/audience
│   └── pause/route.ts           ← POST — Pause/relance campagne
├── report/route.ts              ← GET — Rapport performance
├── budget/route.ts              ← GET/POST — Vue/modification allocation budget
└── dashboard/route.ts           ← GET — Données dashboard
```
