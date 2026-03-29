# WPW-09 — Web Page SEO Writer

> *« Rédacteur SEO complet — de la structure à la publication »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | Web Page SEO Writer |
| Code | AGT-SEO-WPW-09 |
| Version | 1.0 |
| Catégorie | Agent SEO — Création de contenu on-page |
| Nature | Agent de production — rédige une page complète à la demande |
| Périmètre | About Us, services, landing pages, pillar pages, pages contact, catégories |
| Export | HTML, Markdown, WordPress, HubSpot, Shopify, Google Sheets |
| Durée économisée | 4 à 8 heures par page |

## Différence dans la famille

| Agent | Périmètre |
|-------|-----------|
| WPW-09 | Pages statiques du site (intentions commerciales/navigationnelles) |
| BSW-10 | Blog — contenu éditorial (intentions informationnelles) |
| MDG-11 | Metas en batch sur tout le site |
| ALT-12 | ALT texts des images en batch |

## Problème résolu

**Avant** : Créer une page web SEO-optimisée = 4 à 8 heures. Trouver les KW, étudier les concurrents, construire la structure, rédiger, calibrer la longueur, intégrer les CTAs et liens internes, puis préparer pour publication.

**Après** : L'agent guide de l'idée à la page publiable — brief → benchmark → structure validée → rédaction complète → export CMS.

## Types de pages couvertes

| Type | Longueur cible | Angle |
|------|---------------|-------|
| About Us / À propos | 600–1500 mots | Storytelling + autorité + confiance |
| Page service | 800–2000 mots | Problème → solution + preuves sociales |
| Landing page | 500–1200 mots | Conversion first + CTA multiples |
| Pillar page / Guide | 2000–5000 mots | Référence SEO + densité thématique |
| Page contact | 200–500 mots | Clarté + confiance + CTA évident |
| Page catégorie | 300–800 mots | Navigation + mots-clés catégorie |

## Livrables par page

| Élément | Détail |
|---------|--------|
| Meta title | 2 variations (50-60 car.) — KW principal en début |
| Meta description | 1 version (155-160 car.) — CTA intégré |
| H1 | 2 variations — KW principal intégré naturellement |
| Structure H2/H3 | Plan complet validé AVANT rédaction |
| Corps complet | Rédigé selon plan + ton + mots-clés |
| Liens internes | 2-5 liens avec ancres SEO-optimisées |
| CTA | 1-2 appels à l'action selon objectif |
| Suggestions images | Descriptions + ALT texts recommandés |

## Formats d'export

| Format | Description |
|--------|-------------|
| HTML | Balises sémantiques H1/H2/H3/p/ul/a |
| Markdown | Pour Notion, GitBook, Webflow, Framer |
| WordPress (API) | REST API — titres, corps, meta Yoast/RankMath, slug |
| HubSpot (API) | Pages API — titres, body, meta |
| Shopify (API) | Admin API — title, body_html, metafields |
| Google Sheets | URL / H1 / meta title / meta desc / longueur / statut |

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| Type de page | Oui |
| Brief (description de la page) | Oui |
| URL si mise à jour page existante | Non |
| Mots-clés cibles | Recommandé (ou récupérés via DataForSEO) |
| Ton de marque | Oui |
| Public cible | Oui |
| Pages du site disponibles pour liens internes | Recommandé |
| CMS et format d'export | Oui |
| Contexte KGA-08 (si activé avant) | Optionnel |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| DataForSEO | Mots-clés, volumes, intention, difficulté | Essentiel |
| SerpAPI | Top 5 SERP + structure concurrents + meta | Essentiel |
| Ahrefs | Autorité domaine + backlinks concurrents | Premium optionnel |
| WordPress REST API | Création/mise à jour page + meta Yoast | Essentiel |
| HubSpot Pages API | Création page + meta description | Essentiel |
| Shopify Admin API | Pages statiques + metafields SEO | Essentiel |
| Google Sheets API | Export + suivi statut | Essentiel |
| Composio MCP | Auth + cache + rate limit | Colonne vertébrale |

## Workflow
```
collect_brief
→ benchmark_serp (SerpAPI — top 5 concurrents)
→ fetch_keywords (DataForSEO si non fournis)
→ propose_structure (H1×2 + H2/H3 complet) → VALIDATION CLIENT
→ rediger_contenu_complet
→ validate_quality (longueur, densité KW, maillage, CTA)
→ export (HTML / Markdown / CMS API / Sheets)
```