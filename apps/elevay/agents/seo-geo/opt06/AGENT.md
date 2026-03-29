# OPT-06 — SEO & GEO Performance Optimizer

> *« Optimise l'existant pour grimper — Google, GEO et moteurs génératifs »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | SEO & GEO Performance Optimizer |
| Code | AGT-SEO-OPT-06 |
| Version | 1.0 |
| Catégorie | Agent SEO — Optimisation on-page & Ranking |
| Nature | Agent d'optimisation itérative — améliore ce qui existe |
| Différence vs TSI-07 | TSI-07 = santé technique. OPT-06 = ranking et contenu. |
| Différence vs WPW-09/BSW-10 | WPW-09/BSW-10 créent du neuf. OPT-06 améliore l'existant. |
| Cible principale | Pages en position 4–15 ("fruits mûrs") |
| Canaux | SEO Google + GEO local (Maps) + Moteurs génératifs (SGE, Copilot, Perplexity) |
| Niveau d'automatisation | Audit seul / Semi-auto / Full auto |

## Problème résolu

**Avant** : Des pages en position 4–15 stagnent. Optimiser manuellement chaque page (contenu, balises, maillage, structure) est chronophage et souvent dépriorisé.

**Après** : L'agent analyse le ranking actuel, identifie ce qui bloque la progression, exécute les optimisations et surveille l'impact. Il itère jusqu'au résultat.

## Modules fonctionnels

### 1. Audit ranking & diagnostic
- Analyse de chaque page existante vs SERP cible
- Scoring Impact/Effort par page
- Identification des pages en position 4–15

### 2. Optimisations on-page
- Contenu : densité KW, sémantique, structure H2/H3
- Balises : meta title, meta description, H1
- Schema.org : FAQ, HowTo, Article
- Maillage interne : détection liens manquants

### 3. Dimension GEO & Moteurs génératifs

| Canal | Objectif | Levier |
|-------|----------|--------|
| Google AI Overview (SGE) | Citations dans réponses IA | E-E-A-T + FAQ + schema.org |
| Bing Copilot | Mentions génératives | Contenu direct + faits vérifiables |
| Google Maps / Local | Pack 3-map | Google Business Profile + NAP cohérent |
| Perplexity / SearchGPT | Visibilité moteurs IA alt. | Sources autoritatives + backlinks |
| Rich Snippets / Position 0 | Featured snippets | FAQ schema + HowTo + Article schema |

### 4. Monitoring continu

| Périmètre | Fréquence | Trigger action |
|-----------|-----------|----------------|
| Top 20 pages | Quotidien | Alerte si baisse > 3 positions |
| Pages pos. 4-15 | Hebdomadaire | Rapport hebdo |
| Toutes pages | Mensuel | Rapport mensuel |
| Nouvelles pages | J+7, J+30 | Auto post-publication |

### 5. Corrections CMS
- Via WordPress REST API + Yoast/RankMath
- Via HubSpot Pages API
- Via Shopify Admin API
- Via Webflow CMS API (best effort)

## Niveaux d'automatisation

| Mode | Comportement |
|------|-------------|
| Audit seul | Rapport uniquement, zéro modification |
| Semi-auto | Auto : metas, schema, maillage — Validation : rewriting contenu |
| Full auto | Toutes optimisations selon règles — Alerte si inconnu |

## Garde-fous (tous modes)
- Pas de modification des pages > 1000 visites/mois sans validation humaine
- Historique complet des modifications avec rollback possible
- Alerte avant tout rewriting de page pilier

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| URL du site | Oui |
| Pages cibles à optimiser | Oui |
| Mots-clés cibles par page | Recommandé |
| Concurrents (2-3) | Recommandé |
| Niveau d'automatisation | Oui |
| Zones GEO cibles | Si GEO local |
| Google Business Profile ID | Si GEO local |

## Outputs

| Livrable | Fréquence |
|----------|-----------|
| Audit ranking initial + Score Impact/Effort | Phase 1 |
| Log modifications appliquées | Après chaque optimisation |
| Rapport impact J+7/J+14/J+30 | Auto post-modification |
| Alertes ranking + rapport mensuel | Continu |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| Google Search Console | Positions, CTR, impressions | Essentiel |
| Google Analytics | Trafic organique + comportement | Essentiel |
| DataForSEO | Ranking temps réel + KW GEO en batch | Essentiel |
| SerpAPI | SERP actuel sur mots-clés cibles | Essentiel |
| Ahrefs | Backlinks + KW gap + ranking concurrent | Premium optionnel |
| Google Business Profile API | Fiche locale + citations | Si GEO local |
| WordPress / HubSpot / Shopify / Webflow | Corrections CMS | Essentiel |
| Google Sheets API | Dashboard ranking + log modifications | Essentiel |
| Composio MCP | Auth + batch + cache + webhooks | Colonne vertébrale |

## Workflow
audit_ranking → score_impact_effort → plan_action
→ optimise_contenu → optimise_balises → optimise_schema → optimise_maillage
→ monitor_quotidien → alert_si_baisse → rapport_hebdo → rapport_mensuel