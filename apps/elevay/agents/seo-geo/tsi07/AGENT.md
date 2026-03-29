# TSI-07 — Technical SEO & Indexing Manager

> *« Le Chief Technical SEO Officer IA — la fondation de toute stratégie SEO »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | Technical SEO & Indexing Manager |
| Code | AGT-SEO-TSI-07 |
| Version | 1.0 |
| Catégorie | Agent SEO — Santé technique & Indexation |
| Nature | Agent d'audit, de surveillance et de correction technique |
| Position | Agent #07 — premier de la famille — un site sain avant tout contenu |
| Modes | Audit initial + Surveillance continue + Alertes temps réel |
| Complexité | Élevée — crawl technique + détection 20+ types d'erreurs + suivi continu |
| Relation | Prérequis de KGA-08 et des agents de contenu WPW-09 à ALT-12 |

## Pourquoi en premier

Un site avec des problèmes techniques (pages non indexées, erreurs 404, canonical incorrect, Core Web Vitals dégradés) ne peut pas bénéficier de la stratégie KW ni de la production de contenu. La fondation doit être saine avant tout investissement éditorial.

## Problème résolu

**Avant** : Les erreurs d'indexation, les pages orphelines, les canonical incorrects ou les Core Web Vitals dégradés coûtent des positions sans que l'équipe ne s'en aperçoive. Une vérification manuelle prend des jours.

**Après** : L'agent surveille en continu la santé technique, détecte les problèmes dès leur apparition, les classe par impact SEO et les corrige automatiquement selon le niveau d'autonomie configuré.

## Modules fonctionnels

### 1. Audit initial complet
- Crawl complet via DataForSEO Crawl API
- Analyse d'indexation : pages indexées, exclues, bloquées
- Détection erreurs : 404, 500, redirections en chaîne, redirections brisées
- Analyse structure : sitemap.xml, robots.txt, canonical, maillage interne
- Pages orphelines : pages sans aucun lien interne entrant
- Core Web Vitals : LCP, CLS, FID via Google PageSpeed API par lot

### 2. Détection & priorisation — 4 niveaux

| Niveau | Problèmes détectés |
|--------|-------------------|
| **CRITIQUE** | 404 sur pages à fort trafic, pages bloquées par robots.txt/noindex, canonical incorrect, redirections en boucle, baisse soudaine d'indexation |
| **HAUTE** | Pages orphelines, duplication de contenu, cannibalisation KW, Core Web Vitals dégradés sur pages stratégiques, sitemap obsolète |
| **MOYENNE** | Metas manquantes ou dupliquées, mobile non optimisé, URLs paramétriques en doublon, schema.org absent, indexation lente |
| **SURVEILLANCE** | Noindex volontaires, CWV mobile, backlinks toxiques, positions en fluctuation |

### 3. Corrections & recommandations
- Plan d'action priorisé par impact SEO + facilité d'exécution
- Correction redirections 301 via CMS API (semi-auto)
- Ajustements balises : meta title, meta description, canonical manquants
- Optimisation sitemap.xml
- Maillage interne : détection et recommandation de liens manquants
- Core Web Vitals : recommandations précises (lazy loading, compression, cache)

### 4. Surveillance continue & alertes
- Monitoring indexation des nouvelles pages après publication
- Surveillance pages critiques : top trafic, pages de conversion
- Alertes temps réel : baisse soudaine d'indexation, nouvel erreur 404
- Rapport hebdomadaire différentiel
- Intégration Google Search Console

## Niveaux d'automatisation

| Mode | Comportement |
|------|-------------|
| Audit seul | Rapport complet, toutes corrections manuelles |
| Semi-auto | Auto : redirections, metas manquantes, sitemap — Validation : canonical, cannibalisation |
| Full auto | Toutes corrections selon règles configurées — Alerte si problème inconnu |

## Validation humaine obligatoire (tous modes)
- Corrections de canonical tags
- Merge ou redirection de pages (cannibalisation)
- Modification de pages > 1000 visites/mois
- Suppression de pages

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| URL du site | Oui |
| CMS utilisé | Oui |
| Niveau d'automatisation | Oui |
| Pages prioritaires | Recommandé |
| Canal d'alerte | Oui |
| Google Search Console (OAuth) | Recommandé |
| Google Analytics (OAuth) | Recommandé |

## Outputs

| Livrable | Contenu | Fréquence |
|----------|---------|-----------|
| Rapport d'audit initial | Problèmes classés + priorité + impact SEO | Ponctuel |
| Plan d'action priorisé | Actions triées urgence + facilité + agent cible | Avec audit |
| Corrections exécutées | Log corrections appliquées | Après correction |
| Rapport hebdo différentiel | Problèmes apparus, résolus, évolution KPIs | Hebdomadaire |
| Alertes critiques | Notification immédiate si problème Critique | Temps réel |
| Dashboard technique | Tendances indexation, erreurs récurrentes, CWV | Chat + Sheets |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| DataForSEO Crawl API | Crawl complet + détection erreurs + structure | Essentiel |
| Google Search Console | Indexation + couverture + Core Web Vitals + alertes | Essentiel |
| Google PageSpeed API | CWV LCP/CLS/FID par lot | Essentiel |
| SerpAPI | Vérification position des pages sur requêtes clés | Essentiel |
| Google Analytics | Trafic par page pour prioriser les corrections | Essentiel |
| Ahrefs API | Backlinks + autorité domaine | Premium optionnel |
| WordPress REST API + Yoast | Correction metas, sitemap, redirections | Essentiel |
| HubSpot CMS API | Correction metas + gestion redirections | Essentiel |
| Shopify Admin API | Correction metas + redirections + ALT | Essentiel |
| Webflow CMS API | Correction metas + structure | Best effort |
| Google Sheets API | Rapport d'audit + suivi corrections + alertes | Essentiel |
| Slack / Email (Composio) | Alertes critiques en temps réel | Essentiel |
| Composio MCP | Auth + batch + rate limit + webhooks | Colonne vertébrale |

## Workflow
crawl_complet
→ analyse_indexation (GSC)
→ detect_errors → classify_by_level
→ audit_cwv (PageSpeed API batch)
→ generate_audit_report + plan_action
→ [si semi-auto/full-auto] apply_safe_corrections via CMS API
→ setup_continuous_monitoring → alert_on_critical
→ schedule_weekly_diff_report