# BSW-10 — Blog SEO Writer

> *« De l'article SEO au Topic Cluster complet »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | Blog SEO Writer |
| Code | AGT-SEO-BSW-10 |
| Version | 1.0 |
| Catégorie | Agent SEO — Création de contenu éditorial |
| Nature | Agent de production — rédige des articles et planifie des séries |
| Modes | Unitaire (1 article) / Cluster (pilier + satellites) / Calendrier éditorial |
| Module clé | Topic Cluster — 1 pilier + N articles satellites intégrés et maillés |
| Formats | 7 types d'articles |

## Différence vs WPW-09

| Dimension | WPW-09 | BSW-10 |
|-----------|--------|--------|
| Type de contenu | Pages statiques du site | Articles de blog |
| Objectif SEO | Requêtes commerciales/navigationnelles | Trafic informationnel + clusters |
| Longueur typique | 600–2000 mots | 800–3000 mots |
| Fréquence | Ponctuelle | Régulière (1-8 articles/mois) |
| Cluster de contenu | Non | Oui — pilier + satellites |
| Calendrier éditorial | Non applicable | Oui |

## Problème résolu

**Avant** : Produire régulièrement des articles SEO-optimisés = 4 à 8 heures par article + aucune vision d'ensemble. Maintenir un ton de marque cohérent sur la durée est difficile sans assistance.

**Après** : L'agent transforme un brief en article complet publiable, ou un sujet en cluster de contenus articulés, avec maillage interne et export CMS direct.

## 7 formats d'articles

| Format | Intention | Longueur | Angle |
|--------|-----------|----------|-------|
| Guide complet / How-to | Informationnelle | 1500–3000 mots | Référence exhaustive |
| Article liste / Top N | Informationnelle | 800–1500 mots | Scannable, fort trafic |
| Étude de cas | Investigationnelle | 800–1500 mots | Preuve sociale + résultat |
| Comparatif / Versus | Investigationnelle | 1200–2500 mots | Capte intentions d'achat |
| Opinion / Thought leadership | Informationnelle | 600–1200 mots | Autorité de marque |
| Tutoriel pas-à-pas | Informationnelle | 1000–2000 mots | Fort potentiel position 0 |
| Glossaire / Définition | Navigationnelle | 400–1000 mots | Sémantique + maillage cluster |

## Topic Cluster — logique

Le mode cluster génère :
1. La pillar page (ou brief pour WPW-09 si page statique)
2. La liste des articles satellites avec sujets + mots-clés + format
3. Le calendrier éditorial avec dates et ordre de publication
4. La logique de maillage interne entre tous les articles

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| Sujet / thématique | Oui |
| Mode (unitaire / cluster / calendrier) | Oui |
| Format d'article | Oui |
| Public cible + niveau d'expertise | Oui |
| Objectif (trafic / lead-gen / conversion / autorité) | Oui |
| Ton de marque | Oui |
| Mots-clés (fournis ou via DataForSEO) | Recommandé |
| Pages du site pour liens internes | Recommandé |
| CTA prioritaire | Oui |
| Durée calendrier si mode calendar (30/60/90j) | Si mode calendar |
| Contexte KGA-08 | Optionnel |

## Outputs

| Livrable | Format |
|----------|--------|
| 2-3 titres H1 proposés (CTR-optimisés) | Avant rédaction |
| Structure H2/H3 validée | Avant rédaction |
| Article complet rédigé | Chat + export |
| [Cluster] Architecture complète pilier + satellites | Chat + Sheets |
| [Calendar] Calendrier éditorial 30/60/90j | Sheets |
| Export CMS ou Google Docs | Sur validation |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| DataForSEO | Mots-clés, volumes, difficulté, LSI, PAA | Essentiel |
| SerpAPI | Top 5 articles concurrents + structure | Essentiel |
| Ahrefs | Backlinks articles + DA concurrents | Premium optionnel |
| WordPress REST API | Création post + catégories + meta Yoast | Essentiel |
| HubSpot Blog API | Création article + meta + slug | Essentiel |
| Google Docs API | Export formaté relecture équipe | Essentiel |
| Google Sheets API | Calendrier éditorial + suivi | Essentiel |
| Composio MCP | Auth + cache + rate limit | Colonne vertébrale |

## Workflow
```
collect_brief
→ fetch_keywords_paa (DataForSEO — KW + LSI + PAA)
→ benchmark_top5 (SerpAPI)
→ [mode cluster] build_cluster_architecture → validation
→ propose_titles (2-3 H1 CTR-optimisés) → choix client
→ propose_structure (H2/H3) → validation
→ rediger_article_complet
→ integrate_internal_links + CTA
→ export (CMS / Google Docs / Sheets)
→ [mode calendar] schedule_next_articles
```