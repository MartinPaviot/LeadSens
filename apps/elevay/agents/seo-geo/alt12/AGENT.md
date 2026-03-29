# ALT-12 — Image ALT Text Generator

> *« SEO + Accessibilité — Chaque image compte »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | Image ALT Text Generator |
| Code | AGT-SEO-ALT-12 |
| Version | 1.0 |
| Catégorie | Agent SEO & Accessibilité — Optimisation on-page |
| Nature | Agent de production — traitement batch d'images |
| Double objectif | SEO on-page (Google Images + ranking) + Accessibilité (WCAG 2.1) |
| Périmètre | Toutes les images d'un site |
| Output | 1-2 variations d'ALT text par image + export CSV + injection CMS |
| Spécificité | Images décoratives reçoivent `alt=""` conforme WCAG — jamais de keyword stuffing |

## Problème résolu

**Avant** : Rédiger des ALT texts pertinents pour chaque image = fastidieux et répétitif. L'employé doit décrire chaque image, intégrer les bons mots-clés sans sur-optimisation, garantir la cohérence et respecter WCAG. Sans automatisation : ALTs vides, génériques, ou pénalisation SEO.

**Après** : L'agent analyse chaque image dans son contexte de page, génère 1-2 ALT texts SEO-optimisés et conformes WCAG, et les injecte directement dans le CMS ou les exporte en CSV — en batch.

## Règles qualité SEO + Accessibilité

| Règle | Bonne pratique | Erreur courante |
|-------|---------------|-----------------|
| Longueur | 50-125 caractères | < 10 (trop vague) ou > 150 (trop long) |
| Mot-clé principal | Présent une fois, position naturelle | Absent ou répété (keyword stuffing) |
| Description | Précise, contextuelle, utile pour un malvoyant | Générique (« image », « photo ») |
| Cohérence | ALT aligné avec le contenu de la page | ALT sans rapport avec la page |
| Images décoratives | `alt=""` (WCAG 2.1) | ALT keyword-stuffed sur une décorative |

## Types d'images traités

| Type | Contexte | KW intégré |
|------|----------|-----------|
| Photo produit | Fiche produit | KW produit |
| Photo équipe | Page À propos | Nom marque + équipe |
| Illustration UI | Page fonctionnalités | KW logiciel / outil |
| Icône décorative | Partout sur le site | Aucun — `alt=""` |
| Héro homepage | Accueil | KW principal de la page |
| Photo blog | Article | KW de l'article |

## Injection CMS

| CMS | Méthode | Champ cible |
|-----|---------|-------------|
| WordPress | REST API — PATCH `/wp/v2/media/{id}` | `alt_text` |
| HubSpot | Files API — PATCH `/filemanager/api/v3/files/{fileId}` | `alt` |
| Shopify | Admin API — PUT `/products/{id}/images/{image_id}.json` | `alt` |
| Webflow | API — PATCH `/collections/{id}/items/{itemId}` | `alt` (champ asset) |
| Google Sheets | Export CSV | URL / ALT / mot-clé / type / statut |

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| URL du site | Oui |
| Périmètre (toutes pages / blog / produits / liste) | Oui |
| CMS | Oui |
| Mots-clés par page ou catégorie | Recommandé |
| Ton (descriptif / informatif / marketing) | Oui |
| Langue | Oui |
| Règles spéciales (noms de marque, termes proscrits) | Non |
| Nombre de variations (1/2) | Oui |
| Injection directe ou export | Oui |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| DataForSEO | Mots-clés par page, volumes, sémantique | Essentiel |
| Crawl HTML | Extraction balises img, ALT existants, contexte | Essentiel |
| Vision API (Google ou OpenAI) | Description contenu visuel si image sans contexte | Best effort |
| WordPress / HubSpot / Shopify / Webflow | Injection directe | Essentiel |
| Google Sheets API | Export + suivi statut par image | Essentiel |
| Composio MCP | Auth + batch + rate limit | Colonne vertébrale |

## Optimisation coûts API
- Batch par type d'image (toutes images produit ensemble)
- Cache des ALT générés pour templates répétitifs (même produit, plusieurs couleurs)
- Vision API uniquement si l'image n'a pas de contexte de page

## Workflow
```
crawl_images (extraction <img>, ALT existants, URL page de contexte)
→ classify_images (produit / équipe / UI / héro / décorative)
→ fetch_page_keywords (DataForSEO — par page, caché pour la session)
→ [si image sans contexte] vision_api_description (best effort)
→ generate_alt_texts (1-2 variations, règles qualité + WCAG)
→ quality_check (longueur, KW, WCAG décoratives)
→ preview_table → validation client
→ inject_cms OU export_csv OU export_sheets
```