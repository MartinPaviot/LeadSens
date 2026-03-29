# MDG-11 — Meta Description Generator

> *« Chaque page mérite une meta description qui donne envie de cliquer »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | Meta Description Generator |
| Code | AGT-SEO-MDG-11 |
| Version | 1.0 |
| Catégorie | Agent SEO — Optimisation on-page |
| Nature | Agent de production — traitement batch de pages |
| Double objectif | SEO on-page (mots-clés) + CTR (incitation au clic depuis les SERP) |
| Périmètre | Toutes les pages d'un site |
| Output | 1-3 variations de meta description par page (155-160 car.) |

## Duo avec ALT-12

| | MDG-11 | ALT-12 |
|-|--------|--------|
| Objet | Meta description `<meta name="description">` | Texte ALT `<img alt="">` |
| Objectif | Inciter au clic depuis les SERP (CTR) | Décrire l'image pour Google Images + accessibilité |
| Longueur cible | 155-160 caractères | 50-125 caractères |
| CTA | Oui | Non |

Ensemble, MDG-11 et ALT-12 couvrent l'intégralité du SEO on-page lié aux méta-données.

## Problème résolu

**Avant** : Sur un site de 100 pages, 100 metas à écrire, calibrer, aligner avec les mots-clés et maintenir cohérentes. Sans automatisation : metas vides, en double, ou génériques qui n'incitent pas au clic.

**Après** : L'agent crawle le site, analyse le contenu et les mots-clés, génère 1-3 variations CTR-optimisées et les injecte directement dans le CMS ou les exporte en CSV — en batch.

## Matrice ton × type de page

| Type de page | Ton | CTA type | Angle |
|-------------|-----|----------|-------|
| Page d'accueil | Inspirant + brand promise | Découvrez / Explorez | Vision émotionnelle + KW marque |
| Page service / produit | Persuasif + bénéfices | Essayez / Téléchargez | Problème → solution + KW produit |
| Article de blog | Informatif + curiosité | Découvrez / Lisez | Question ou chiffre + réponse partielle |
| Page catégorie e-com | Pratique + sélectif | Voir la sélection | Nombre produits + attribut clé + CTA |
| Fiche produit | Spécifique + rassurant | Voir les détails | Caractéristique unique + bénéfice |
| Page à propos / contact | Humain + crédibilité | Contactez / En savoir plus | Valeurs + équipe + invitation |

## Standards qualité

| Dimension | Bonne pratique | Erreur détectée |
|-----------|---------------|-----------------|
| Longueur | 155-160 caractères | < 100 ou > 165 → alerte + régénération |
| Mot-clé principal | Intégré naturellement, début ou milieu | Absent ou répété > 2 fois |
| CTA | Présent et adapté au type de page | Absent |
| Unicité | Une meta unique par page | Duplication détectée et signalée |
| Ton | Adapté au type de page | Générique (« bienvenue sur notre site ») |

## Injection CMS

| CMS | Méthode | Champ cible |
|-----|---------|-------------|
| WordPress | REST API + Yoast/RankMath/SEOPress | `_yoast_wpseo_metadesc` |
| HubSpot | Pages API — PATCH | `metaDescription` |
| Shopify | Admin API — PUT | SEO description |
| Webflow | CMS API — PATCH | `seo.description` |
| Google Sheets | Export CSV | URL / Meta / Mot-clé / Longueur |

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| URL du site | Oui |
| Périmètre (toutes pages / blog / produits / liste) | Oui |
| CMS | Oui |
| Ton de marque | Oui |
| Mots-clés par page (fournis ou via DataForSEO) | Recommandé |
| Nombre de variations (1/2/3) | Oui |
| Langue | Oui |
| Injection directe ou export | Oui |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| DataForSEO | Mots-clés ranking + volume + intention | Essentiel |
| SerpAPI | Benchmark meta concurrents sur SERP | Essentiel |
| WordPress / HubSpot / Shopify / Webflow | Injection directe | Essentiel |
| Google Sheets API | Export + suivi statut | Essentiel |
| Composio MCP | Auth + batch + rate limit | Colonne vertébrale |

## Optimisation coûts API
- Batch de 20-50 pages par appel
- Benchmark concurrent réutilisé pour toutes les pages de même catégorie
- Mots-clés DataForSEO récupérés une fois par page et cachés pour la session

## Workflow
```
collect_site_urls (crawl ou liste manuelle)
→ [batch 20-50 pages] fetch_page_content + target_keywords
→ benchmark_competitor_metas (SerpAPI — réutilisé par catégorie)
→ detect_existing_issues (vides, doublons, trop courtes, trop longues)
→ generate_meta_variations (1-3 par page selon type + ton)
→ quality_check (longueur, KW, CTA, unicité)
→ preview_table → validation client
→ inject_cms OU export_sheets_csv
```