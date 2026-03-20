# /implement-next — Exécute la prochaine tâche du backlog

## Pré-vol

1. Lis `.claude/tasks/CURRENT.md`
   - Si IN_PROGRESS → **reprends-la** (ne commence pas une nouvelle)
   - Si vide → continue

2. Lis `.claude/tasks/BACKLOG.md`
   - Trouve la première tâche `- [ ]` dans le tier le plus haut non terminé
   - Tier 1 complet ? → Tier 2. Tier 2 complet ? → Tier 3.
   - Tout coché ? → lance `/audit` pour alimenter le backlog, puis reprends

---

## Phase 1 : Comprendre (NE PAS SKIP)

1. Lis la description de la tâche dans BACKLOG.md
2. Lis la section référencée de `docs/STRATEGY.md`
3. Identifie les fichiers source impactés :
   ```bash
   # Cherche les fichiers pertinents
   grep -rl "[mot-clé de la tâche]" src/ --include="*.ts" --include="*.tsx"
   ```
4. **Lis le contenu** de chaque fichier impacté (pas juste les noms)
5. Lis les tests existants pour ces fichiers

---

## Phase 2 : Challenge

Pose-toi ces questions AVANT de planifier :

- Cette tâche est-elle toujours pertinente ? (le code a peut-être évolué)
- L'approche STRATEGY.md est-elle la meilleure ? Si tu vois mieux → `.claude/findings/` + propose l'alternative
- Y a-t-il des dépendances non résolues ? Si oui → note le blocage, passe à la tâche suivante
- Le scope est-il trop large ? Si oui → découpe en sous-tâches dans BACKLOG.md

---

## Phase 3 : Planifier

Écris dans `.claude/tasks/CURRENT.md` :

```markdown
## Tâche: [nom court]
## Réf: STRATEGY.md §[section]
## Tier: [1|2|3]
## Impact attendu: [ex: "enrichissement 2.5 → 6/10"]
## Status: IN_PROGRESS
## Démarré: [date ISO]

### Analyse
[3-5 lignes : ce que le code fait actuellement vs ce qu'il devrait faire]

### Plan
- [ ] 1. [description + fichiers]
- [ ] 2. ...
- [ ] 3. ...

### Fichiers impactés
- `src/path/file.ts` — [nature du changement]

### Tests à écrire/modifier
- `__tests__/path/test.ts` — [ce qui est testé]

### Risques
- [risque] → [mitigation]
```

---

## Phase 4 : Implémenter

Pour CHAQUE étape du plan :

1. **Lis le fichier cible** (obligatoire, même si tu penses le connaître)
2. **Implémente** le changement
3. **Vérifie** :
   ```bash
   pnpm typecheck && pnpm test
   ```
4. Tests passent → coche l'étape dans CURRENT.md
5. Tests échouent → corrige (max 3 tentatives). 3 échecs → revert, note le blocage, passe à l'étape suivante

### Garde-fous

- Zod sur chaque nouvelle boundary (input API, output LLM, config)
- Pas de `any`, pas de `console.log`
- Encryption pour tout nouveau token/credential
- AI Event logging pour tout nouvel appel LLM
- Si tu modifies un module → vérifie TOUS ses consommateurs (`grep -r "import.*from.*module"`)

---

## Phase 5 : Vérifier

Avant de commit :

```bash
pnpm typecheck        # ZERO erreurs
pnpm test             # ZERO régressions
pnpm lint             # si configuré
git diff --stat       # review visuel
git diff              # chaque ligne est intentionnelle ?
```

---

## Phase 6 : Commit + documenter

1. **Commit** (Conventional Commits) :
   ```
   feat(enrichment): multi-page scraping with domain cache

   - Scrape about, blog, careers, press via Jina Reader
   - Cache par domaine pour éviter re-scraping
   - Réf: STRATEGY.md §7.1.1
   ```

2. **CURRENT.md** → Status: DONE

3. **DONE.md** → ajouter :
   ```markdown
   ### [date] — [nom tâche]
   - Réf: STRATEGY.md §X.Y
   - Fichiers: [liste]
   - Tests ajoutés: [liste]
   - Impact: [description]
   ```

4. **BACKLOG.md** → cocher `- [x]`

5. **Vider** CURRENT.md

---

## Phase 7 : Résumé

```
✅ [nom tâche]
📁 [N] fichiers modifiés
🧪 [passés/total] tests
📊 Impact : [description]
🔜 Prochaine : [nom prochaine tâche]
💡 Findings générés : [N] (voir .claude/findings/)
```
