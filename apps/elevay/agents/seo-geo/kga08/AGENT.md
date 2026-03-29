# KGA-08 — Keyword & GEO Action Planner

> *« L'orchestrateur SEO — il dit quoi faire, les autres le font »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | Keyword & GEO Action Planner |
| Code | AGT-SEO-KGA-08 |
| Version | 2.0 — Scoring marchés + GBP + Hreflang |
| Catégorie | Agent SEO — Stratégie, GEO Planning & Architecture internationale |
| Nature | Agent d'analyse et de planification — non rédacteur |
| Livrable principal | Plan d'action SEO 90 jours + Scoring marchés + GBP plan + Architecture hreflang |
| Modes | Ponctuel (audit stratégique) ou Récurrent (veille mensuelle) |
| Relation | Agent amont — nourrit WPW-09, BSW-10, MDG-11, ALT-12 |

## Rôle dans la famille

KGA-08 dit **quoi faire, où et quand**. Les agents WPW-09, BSW-10, MDG-11, ALT-12 l'exécutent.

## Problème résolu

**Avant** : Rechercher des mots-clés prend trop de temps et ne produit aucun plan d'action. Difficile de prioriser selon potentiel, difficulté et localisation. Opportunités locales manquées.

**Après** : L'agent transforme la recherche de mots-clés en plan d'action SEO opérationnel : il score chaque opportunité sur 4 axes, intègre la dimension GEO, et produit un tableau de bord priorisé avec les actions concrètes à exécuter.

## Modules fonctionnels (v2.0)

### 1. Onboarding stratégique
- Objectifs business, URL, pages prioritaires
- Marché cible : national, régional, local, multi-pays
- Présence GEO locale : fiche Google Business Profile
- Volume de contenu créable par mois

### 2. Collecte & analyse KW
- DataForSEO + SerpAPI + GSC (fruits mûrs pos. 4-15)
- Longue traîne par zone GEO
- Benchmark concurrents

### 3. Scoring KW — 4 axes pondérés

| Composante | Poids | Calcul |
|-----------|-------|--------|
| Potentiel trafic | 30% | Volume × CTR estimé selon position cible |
| Difficulté SEO | 25% | Score KD (0-100) — inversé dans le score final |
| Valeur business | 25% | Intention commerciale + proximité offre + conversion estimée |
| Pertinence GEO | 20% | Volume local vs national + présence concurrents locaux |

### 4. Scoring des marchés GEO (v2.0)
- 4 axes par marché : volume, potentiel commercial, concurrence, facilité d'entrée
- Matrice de priorisation des marchés cibles
- Granularité : national / régional / ville / multi-pays

### 5. Détection city landing pages

| Signal | Action |
|--------|--------|
| Volume local > 100/mois + KD < 40 + 0 page dédiée | Créer une landing page par ville |
| URL pattern | `/services/{slug}-{ville}` |
| Contenu | WPW-09 — 600-1000 mots + NAP |
| Limite V1 | 5-10 villes max |

### 6. Google Business Profile (v2.0)
- Audit fiche GBP existante
- Recommandations : description, catégories, photos, posts, Q&A, NAP
- Plan d'optimisation GBP

### 7. Architecture hreflang (v2.0)
- Détection besoin hreflang (multi-pays / multi-langue)
- Architecture recommandée par cas d'usage
- Détection erreurs courantes (canonical contradictoire, x-default manquant, non réciproque)

### 8. Plan d'action 90 jours
- Actions par mois + agent cible + page + KPI
- Cluster map pour BSW-10
- City landing map pour WPW-09

## Granularité GEO

| Niveau | Exemple | Cas d'usage |
|--------|---------|-------------|
| National | France, Belgique, Suisse | E-commerce, couverture nationale |
| Régional | Île-de-France, PACA | Services régionaux, franchise |
| Ville / Local | Paris, Lyon, Bordeaux | PME locale, restaurant, agence |
| Multi-GEO | FR + BE + CH ou EU | Scale-up, SaaS international |

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| URL du site + pages prioritaires | Oui |
| Objectifs business | Oui |
| Marché GEO | Oui |
| Concurrents (2-3) | Recommandé |
| Volume de contenu créable/mois | Oui |
| Maturité SEO (DA < 20 / 20-50 / 50+) | Recommandé |
| Prioritisation volume vs conversion | Oui |
| GSC connecté | Recommandé |

## Outputs

| Livrable | Contenu | Format |
|----------|---------|--------|
| Dashboard KW | Top KW par priorité + GEO + score + action + horizon | Chat + Sheets |
| Plan d'action 90j | Actions par mois + agent cible + page + KPI | Sheets + Chat |
| City landing map | Pages GEO à créer avec URLs recommandées | Sheets |
| Cluster map | Regroupement thématique pour BSW-10 | Chat + Sheets |
| GBP plan | Actions optimisation fiche locale | Chat |
| Architecture hreflang | Plan si multi-pays | Chat + Sheets |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| DataForSEO | KW + volume + difficulté + longue traîne par GEO | Essentiel |
| SerpAPI | SERP réel par zone géo + concurrents | Essentiel |
| Google Search Console | KW existants pos. 4-15 (fruits mûrs) | Essentiel si accès |
| Google Analytics | Trafic par page — calibrage potentiel | Optionnel |
| Google Business Profile API | Audit + optimisation fiche GBP | Essentiel si GEO local |
| Ahrefs | Backlinks + opportunités KW longue traîne | Premium optionnel |
| Google Sheets API | Dashboard KW + plan d'action + scoring marchés | Essentiel |
| Composio MCP | Auth + cache + rate limit | Colonne vertébrale |

## Workflow
```
onboarding_strategique
→ collect_existing_kw (GSC — fruits mûrs pos. 4-15)
→ expand_kw_research (DataForSEO + SerpAPI par GEO)
→ score_all_keywords (4 axes pondérés)
→ score_geo_markets
→ gbp_audit (si GEO local)
→ hreflang_check (si multi-pays)
→ detect_city_landing_pages
→ build_90day_action_plan
→ export_dashboard (Sheets) + summary (Chat)
→ [mode récurrent] schedule_monthly_refresh
```