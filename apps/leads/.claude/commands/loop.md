# /loop — Boucle autonome complète

## Ce que cette commande fait

Lance une boucle complète d'auto-amélioration :
1. Audit → identifie les écarts
2. Priorise → met à jour le backlog
3. Implémente → exécute la tâche la plus impactante
4. Vérifie → tests + typecheck
5. Documente → findings + done log
6. **Recommence** (si du budget contexte reste)

---

## Exécution

### Round 1 : État des lieux

1. Lis `.claude/tasks/BACKLOG.md`
   - Si le backlog est vide ou date de > 7 jours → lance un audit d'abord
   - Si le backlog a des tâches → passe directement à l'implémentation

2. Lis `.claude/tasks/CURRENT.md`
   - Si IN_PROGRESS → reprends cette tâche
   - Si vide → pioche la prochaine du backlog

3. Lis `.claude/tasks/DONE.md`
   - Combien de tâches terminées ? Quel tier ?
   - Estimation du score actuel basée sur les améliorations faites

### Round 2+ : Audit ciblé + implémentation

Après chaque tâche terminée, fais un **mini-audit ciblé** (pas le full audit) :

1. Le changement que tu viens de faire a-t-il des effets de bord ?
   ```bash
   # Qui consomme le module que tu as modifié ?
   grep -r "import.*from.*[module-modifié]" src/ --include="*.ts"
   ```

2. Le changement a-t-il créé de nouvelles opportunités d'amélioration ?
   - Ex: tu as ajouté le multi-page scraping → le summarizer reçoit plus de données → le prompt email peut maintenant utiliser plus de champs → nouvelle tâche

3. Le changement a-t-il révélé un bug ou une dette technique ?
   → Si oui : finding + tâche dans le backlog

4. Pioche la prochaine tâche du backlog et implémente-la

### Conditions d'arrêt

Arrête la boucle quand :
- Le contexte est à **50%** (lance `/compact` puis continue, ou arrête proprement)
- Tu as terminé **3 tâches** dans cette session (pour éviter la dérive de qualité)
- Tu rencontres un blocage qui nécessite une décision humaine
- Tous les Tier 1 sont terminés (arrête et signale le milestone)

### Résumé de session

À la fin de chaque session /loop, affiche :

```
🔄 SESSION LOOP — [date]

Tâches terminées : [N]
├── [tâche 1] — [impact]
├── [tâche 2] — [impact]
└── [tâche 3] — [impact]

Findings générés : [N]
├── 🔴 CRITICAL : [N]
├── 🟠 HIGH : [N]
└── 🟡 MEDIUM : [N]

Score estimé : [X]/10 (était [Y]/10 avant cette session)

Backlog restant :
├── Tier 1 : [N] tâches restantes
├── Tier 2 : [N] tâches restantes
└── Tier 3 : [N] tâches restantes

🔜 Prochaine session devrait commencer par : [recommandation]

⚠️ Décisions en attente (nécessitent input humain) :
├── [question 1] (voir .claude/findings/...)
└── [question 2]
```

---

## Mode headless

Pour lancer en autonome total :

```bash
# Session unique
claude -p "/loop" --dangerously-skip-permissions

# Boucle de sessions (attention aux limites du plan)
while true; do
  echo "=== Nouvelle session loop $(date) ===" >> .claude/loop-log.txt
  claude -p "/loop" --dangerously-skip-permissions 2>&1 | tee -a .claude/loop-log.txt
  echo "=== Fin session $(date) ===" >> .claude/loop-log.txt
  echo "Pause 60s avant prochaine session..."
  sleep 60
done
```

### Tips pour maximiser le Max 20x

- **Time tes sessions** : `/loop` devrait tourner ~30-45 min par session (3 tâches)
- **Git worktrees** : lance 2 instances en parallèle sur des branches séparées
  ```bash
  git worktree add ../leadsens-tier1 && cd ../leadsens-tier1 && claude -p "/loop"
  # Dans un autre terminal :
  git worktree add ../leadsens-audit && cd ../leadsens-audit && claude -p "/audit"
  ```
- **Modèle** : `/loop` doit tourner sur **Opus** (raisonnement profond). Les tâches simples (formatting, renaming) → Sonnet
- **Compact** : si le contexte atteint 50%, `/compact` puis continue. Ne laisse pas atteindre 80%
