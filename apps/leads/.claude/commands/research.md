# /research [topic] — Veille produit + intégration

## Usage

```
/research cold-email-copywriting
/research instantly-api-features
/research ab-testing-patterns
/research enrichment-pipeline
/research reply-management
/research subject-line-optimization
```

---

## Ce que cette commande fait

1. **Cherche** les meilleures pratiques sur un sujet spécifique
2. **Compare** avec l'état actuel de LeadSens (code + STRATEGY.md)
3. **Génère** des recommandations actionnables
4. **Met à jour** le backlog si pertinent

---

## Phase 1 : Sources à consulter

### Repos de référence (git clone ou curl raw)

```bash
# Patterns de cold email / outreach
curl -s https://raw.githubusercontent.com/snarktank/ralph/main/AGENTS.md
curl -s https://raw.githubusercontent.com/snarktank/compound-product/main/README.md

# Instantly API — toujours vérifier les dernières features
curl -s https://developer.instantly.ai/introduction
```

### Documentation des outils qu'on utilise

```bash
# Instantly API V2 — chercher les endpoints qu'on n'utilise pas encore
curl -s "https://developer.instantly.ai/api-reference" 2>/dev/null || echo "Fetch docs/INSTANTLY-API.md instead"

# Jina Reader — limites, nouvelles features
curl -s "https://r.jina.ai/" -H "Accept: text/markdown" 2>/dev/null | head -100

# Apify — nouveaux actors LinkedIn
curl -s "https://apify.com/store?q=linkedin" 2>/dev/null | head -100
```

### Recherches web ciblées (si web search disponible)

Chercher ces queries exactes :
- `"cold email" "reply rate" best practices 2026`
- `"instantly api" new features 2026`
- `"b2b email" "subject line" "a/b testing" patterns`
- `"email sequence" "follow up" frameworks high reply rate`
- `"lead enrichment" pipeline architecture`
- `"style learner" "email personalization" ai`
- `cold email "trigger event" personalization technique`

---

## Phase 2 : Analyser les trouvailles

Pour chaque trouvaille pertinente, évaluer :

```markdown
### Trouvaille : [titre]
**Source :** [URL ou repo]
**Pertinence pour LeadSens :** HIGH / MEDIUM / LOW
**Composant impacté :** [enrichment / copywriting / scoring / sequence / ...]

**Ce que ça dit :**
[résumé en 3 lignes]

**Comparaison avec LeadSens :**
- Ce qu'on fait déjà : [...]
- Ce qui nous manque : [...]
- Impact estimé sur le reply rate : [...]

**Actionable ?** OUI / NON
**Si OUI → tâche :** [description de la tâche à ajouter au backlog]
```

---

## Phase 3 : Intégrer dans LeadSens

### Si la trouvaille est un pattern de code
→ Lire le code source, adapter au style LeadSens, créer un finding dans `.claude/findings/`

### Si la trouvaille est une meilleure pratique de copywriting
→ Mettre à jour le prompt dans `src/server/lib/email/prompt-builder.ts`
→ Ajouter la règle dans CLAUDE.md section 4 (Email Frameworks)

### Si la trouvaille est une feature API qu'on n'utilise pas
→ Vérifier dans `docs/INSTANTLY-API.md` si l'endpoint existe
→ Ajouter une tâche dans BACKLOG.md

### Si la trouvaille est un benchmark
→ Mettre à jour les benchmarks dans STRATEGY.md... NON.
→ Créer un finding qui recommande la mise à jour, le humain décidera.

---

## Phase 4 : Documenter

Créer `.claude/findings/{date}-research-{topic}.md` :

```markdown
# Research: [topic]
**Date:** [date]
**Sources consultées:** [N]

## Trouvailles clés
1. [trouvaille 1 — impact HIGH]
2. [trouvaille 2 — impact MEDIUM]
3. ...

## Comparaison avec état actuel
[tableau comparatif]

## Actions recommandées
- [ ] [tâche 1 — ajoutée au backlog comme T?-???-??]
- [ ] [tâche 2]

## Learnings ajoutés à CLAUDE.md section 11
- [learning 1]
- [learning 2]
```

---

## Sujets de research pré-configurés

### Pour le Tier 1 (enrichissement + copywriting)
```
/research enrichment-pipeline
→ Chercher : multi-source enrichment, company scraping, LinkedIn data integration
→ Comparer avec : jina-scraper.ts, summarizer.ts, apify.ts

/research cold-email-copywriting
→ Chercher : connection bridge patterns, trigger-based openers, framework sequences
→ Comparer avec : prompt-builder.ts, drafting.ts
```

### Pour le Tier 2 (subject lines + séquence + post-launch)
```
/research subject-line-optimization
→ Chercher : A/B testing patterns, subject line formulas, open rate data
→ Comparer avec : prompt-builder.ts, instantly-tools.ts (variants[])

/research reply-management
→ Chercher : reply classification, intent detection, automated follow-up
→ Comparer avec : (rien — à construire)
```

### Pour le Tier 3 (feedback loop + intelligence)
```
/research feedback-loop-email
→ Chercher : campaign optimization loops, performance-based prompt tuning
→ Comparer avec : style-learner.ts

/research lead-scoring-intent
→ Chercher : intent signals, multi-dimensional scoring, hiring/funding signals
→ Comparer avec : icp-scorer.ts
```
