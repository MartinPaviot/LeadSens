# /status — État du système autonome

## Exécution

1. Lis `.claude/tasks/BACKLOG.md` → compte les tâches par tier (done vs total)
2. Lis `.claude/tasks/CURRENT.md` → tâche en cours ?
3. Lis `.claude/tasks/DONE.md` → dernières tâches terminées
4. Lis `.claude/findings/` → findings non résolus
5. Dernier commit → `git log --oneline -5`

## Output

```
📊 LEADSENS STATUS — [date]

Score estimé : [X]/10

Backlog :
├── Tier 1 (9% → 14%) : [done]/[total] ████████░░ [%]
├── Tier 2 (14% → 17%) : [done]/[total] ████░░░░░░ [%]
└── Tier 3 (17% → 20%) : [done]/[total] ░░░░░░░░░░ [%]

Tâche en cours : [nom] (depuis [date])
Dernière terminée : [nom] ([date])

Findings non résolus : [N]
├── 🔴 CRITICAL : [N]
├── 🟠 HIGH : [N]
└── 🟡 MEDIUM : [N]

Derniers commits :
[git log --oneline -5]

💡 Recommandation : [prochaine action]
```
