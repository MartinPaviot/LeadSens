# PIO-05 — SEO & GEO Performance Intelligence Officer

> *« Il ne travaille plus seulement pour les SERP. Il travaille pour les moteurs conversationnels. »*

## Identité

| Champ | Valeur |
|-------|--------|
| Nom | SEO & GEO Performance Intelligence Officer |
| Code | AGT-SEO-PIO-05 |
| Version | 1.0 |
| Catégorie | Agent SEO — Intelligence & Mesure |
| Nature | Agent d'analyse pure — mesure, score, identifie — ne modifie pas |
| Positionnement | Chief Intelligence Officer SEO+GEO — mesure ce que les autres agents doivent optimiser |
| Différence clé | Seul agent de la famille à mesurer la visibilité dans les moteurs génératifs IA |
| Score clé | Score de citabilité LLM (0–100) |
| Canaux GEO | Google AI Overview, Bing Copilot, ChatGPT (via Bing), Perplexity AI |
| Mode | Audit ponctuel + Monitoring mensuel + Alertes anomalies |
| Relation | Nourrit OPT-06 (optimisation) et WPW-09/BSW-10 (contenu) avec ses diagnostics |

## Rôle dans la famille

L'Agent 05 est l'intelligence de la famille. Il mesure et diagnostique. Sans lui, les autres agents optimisent sans cible de performance mesurée.

## Problème résolu

**Avant** : Les équipes mesurent le SEO classique (positions Google) mais ignorent leur visibilité dans les moteurs génératifs (ChatGPT, Perplexity, Copilot) qui captent une part croissante des requêtes informationnelles.

**Après** : Cet agent produit un dashboard dual SEO + GEO avec un score de citabilité LLM (0–100) mesurant la probabilité d'être cité comme source par un LLM.

## Modules fonctionnels

### 1. Dashboard dual SEO + GEO
- Positions Google par mot-clé et par zone GEO
- Trafic organique par page (GSC + GA)
- Visibilité dans Google AI Overview, Bing Copilot, Perplexity
- Évolution vs mois précédent

### 2. Score de citabilité LLM (0–100)

| Axe | Poids | Signal mesuré |
|-----|-------|---------------|
| E-E-A-T | 25% | Autorité auteur, About page, citations |
| Structure contenu | 25% | FAQ schema, HowTo, titres clairs |
| Faits vérifiables | 25% | Chiffres, sources, données datées |
| Backlinks autoritaires | 25% | DA, liens éditoriaux de qualité |

### 3. Audit de structure LLM-friendly
Formats optimaux pour être cité par les IA :
- FAQ structurées avec schema.org `FAQPage`
- Définitions directes (réponse dans les 2 premières phrases)
- Listes numérotées avec contexte
- Tableaux comparatifs balisés
- Citations d'experts avec attribution

### 4. Monitoring mensuel
- Rapport différentiel vs mois précédent
- Alertes si baisse > 3 positions sur top 20 pages
- Détection anomalies (baisse trafic soudaine, perte de citations LLM)

### 5. Reporting
- Export Google Sheets (dashboard)
- Export Google Slides (deck CMO)
- Résumé chat

## Inputs onboarding

| Champ | Requis |
|-------|--------|
| URL du site | Oui |
| Mots-clés cibles | Oui |
| Zones GEO cibles | Oui |
| URLs concurrents (2-3) | Recommandé |
| Fréquence reporting | Oui — monthly / weekly / on-demand |

## Outputs

| Livrable | Contenu | Fréquence |
|----------|---------|-----------|
| Dashboard dual SEO+GEO | Positions, trafic, citabilité LLM par canal | Mensuel auto |
| Score citabilité LLM | 0-100 avec axes détaillés + recommandations | Mensuel |
| Audit LLM-friendly | Pages à restructurer + format recommandé | Ponctuel |
| Rapport comparatif | Évolution vs mois précédent + concurrents | Mensuel |

## Stack technique

| Outil | Usage | Priorité |
|-------|-------|---------|
| Google Search Console | Positions, CTR, impressions | Essentiel |
| Google Analytics | Trafic organique par page | Essentiel |
| DataForSEO | Ranking temps réel | Essentiel |
| SerpAPI | SERP + AI Overview détection | Essentiel |
| Ahrefs | DA + backlinks autoritaires | Premium optionnel |
| Google Sheets API | Export dashboard | Essentiel |
| Composio MCP | Auth + batch + rate limit | Colonne vertébrale |

## Graceful degradation

| Outil manquant | Comportement dégradé |
|----------------|----------------------|
| GSC | DataForSEO pour ranking — trafic non disponible |
| GA | Comportement utilisateur non disponible |
| Ahrefs | Score E-E-A-T estimé sur critères structurels |
| Perplexity API | Score LLM estimé — pas de mesure directe |

## Workflow
collect_data → dual_scoring → llm_audit → report → export