# /challenge [module] — Challenge un module en profondeur

## Usage

```
/challenge enrichment
/challenge email
/challenge scoring
/challenge sequence
/challenge tools
/challenge connectors
```

---

## Processus

### 1. Cartographier le module

Lis TOUS les fichiers du module :
```bash
find src/ -path "*[module]*" -name "*.ts" -o -path "*[module]*" -name "*.tsx"
```

Pour chaque fichier, note :
- Son rôle
- Ses imports (dépendances)
- Ses exports (consommateurs)
- Sa taille (lignes)
- Sa couverture de tests

### 2. Tracer le data flow

Dessine le chemin des données à travers le module :
```
Input → [transformation 1] → [transformation 2] → Output
         ↓                      ↓
     [side effect]          [side effect]
```

Questions :
- D'où viennent les données ? Sont-elles complètes ?
- Quelle transformation ajoute de la valeur ? Laquelle est un pass-through ?
- Où les données sont-elles perdues ou tronquées ?
- L'output contient-il tout ce que le consommateur suivant attend ?

### 3. Challenge chaque décision

Pour chaque choix d'implémentation trouvé :

```
DÉCISION : [ce que le code fait]
POURQUOI ? : [raison probable]
ALTERNATIVE : [autre approche possible]
IMPACT : [qu'est-ce qui changerait — perf, qualité, maintenabilité]
VERDICT : [garder | changer | investiguer]
```

### 4. Comparer avec STRATEGY.md

- Le module atteint-il le score cible de STRATEGY.md §6.2 ?
- Quelles améliorations de STRATEGY.md §7 s'appliquent à ce module ?
- Le module est-il prêt pour les phases suivantes de STRATEGY.md §12 ?

### 5. Red flags automatiques

Cherche ces patterns :

```bash
# Données hardcodées qui devraient être dynamiques
grep -n "null\|undefined\|''\|\"\"" src/server/lib/[module]/ --include="*.ts" | head -20

# Truncation de données
grep -n "slice\|substring\|substr\|truncat\|limit\|max.*length" src/server/lib/[module]/ --include="*.ts"

# Valeurs ignorées
grep -n "// TODO\|// FIXME\|// HACK\|\.then()\|void " src/server/lib/[module]/ --include="*.ts"

# Error swallowing
grep -n "catch.*{}" src/server/lib/[module]/ --include="*.ts"
```

### 6. Documenter

Crée `.claude/findings/{date}-challenge-{module}.md` avec :

```markdown
# Challenge: [module]
**Date:** [date]

## Architecture du module
[diagramme data flow]

## Décisions challengées
### 1. [décision]
- Verdict: [garder|changer]
- Si changer: [tâche ajoutée au backlog]

## Score actuel vs cible
- Actuel: X/10
- Cible (STRATEGY.md): Y/10
- Écart principal: [description]

## Tâches générées
- [ ] ...
```
