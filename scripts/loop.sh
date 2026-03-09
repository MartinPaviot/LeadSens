#!/bin/bash
# LeadSens Autonomous Improvement Loop
# Inspiré de Ralph (snarktank/ralph) — adapté pour l'auto-amélioration produit
#
# Usage:
#   ./scripts/loop.sh                  # Boucle jusqu'à backlog vide (défaut max 20)
#   ./scripts/loop.sh 5                # Max 5 itérations
#   ./scripts/loop.sh --audit-first    # Lance un audit avant la boucle d'implémentation
#
# Chaque itération :
#   1. Spawne une NOUVELLE instance Claude Code (contexte frais)
#   2. Lit BACKLOG.md, pioche la prochaine tâche
#   3. Implémente, teste, commit
#   4. Écrit dans progress.txt
#   5. Met à jour CLAUDE.md section 11 (learnings)
#   6. Exit → prochaine itération

set -euo pipefail

# --- Config ---
MAX_ITERATIONS="${1:-20}"
AUDIT_FIRST=false
PROGRESS_FILE=".claude/progress.txt"
BACKLOG_FILE=".claude/tasks/BACKLOG.md"
LOOP_LOG=".claude/loop-log.txt"

# Parse flags
for arg in "$@"; do
  case $arg in
    --audit-first) AUDIT_FIRST=true; shift ;;
    *) ;;
  esac
done

# --- Pré-checks ---
if [ ! -f "CLAUDE.md" ]; then
  echo "❌ CLAUDE.md not found. Run from project root."
  exit 1
fi

if [ ! -f "$BACKLOG_FILE" ]; then
  echo "❌ $BACKLOG_FILE not found. Set up .claude/tasks/ first."
  exit 1
fi

# Ensure progress.txt exists
mkdir -p .claude/tasks .claude/findings
touch "$PROGRESS_FILE"
touch "$LOOP_LOG"

echo "🔄 LeadSens Loop — max $MAX_ITERATIONS iterations"
echo "📋 Backlog: $BACKLOG_FILE"
echo "📝 Progress: $PROGRESS_FILE"
echo ""

# --- Audit phase (optional) ---
if [ "$AUDIT_FIRST" = true ]; then
  echo "🔍 Running audit first..."
  echo "=== AUDIT | $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOOP_LOG"

  claude -p "Run /audit. Read docs/STRATEGY.md first. Audit the entire codebase against it. Generate findings in .claude/findings/ and add new tasks to .claude/tasks/BACKLOG.md. Write a summary to .claude/progress.txt." \
    --dangerously-skip-permissions 2>&1 | tee -a "$LOOP_LOG"

  echo "=== AUDIT COMPLETE | $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOOP_LOG"
  echo ""
  echo "✅ Audit complete. Starting implementation loop..."
  echo ""
  sleep 10
fi

# --- Main loop ---
ITERATION=0
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Iteration $ITERATION/$MAX_ITERATIONS — $TIMESTAMP"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Check if backlog has remaining tasks
  REMAINING=$(grep -c "^- \[ \]" "$BACKLOG_FILE" 2>/dev/null || echo "0")
  if [ "$REMAINING" -eq 0 ]; then
    echo "🎉 Backlog empty! All tasks done."
    echo "=== BACKLOG EMPTY | $TIMESTAMP ===" >> "$LOOP_LOG"
    break
  fi
  echo "📋 $REMAINING tasks remaining"

  # Log iteration start
  echo "=== ITERATION $ITERATION | $TIMESTAMP ===" >> "$LOOP_LOG"

  # Run Claude Code with fresh context
  # The prompt tells Claude to:
  # 1. Read BACKLOG, pick next task
  # 2. Follow implement-next.md instructions
  # 3. Log to progress.txt
  # 4. Add learnings to CLAUDE.md section 11
  # 5. Exit when done
  claude -p "
You are executing iteration $ITERATION of the LeadSens autonomous improvement loop.

INSTRUCTIONS:
1. Read .claude/tasks/BACKLOG.md — find the first unchecked task (- [ ])
2. Read .claude/tasks/CURRENT.md — if a task is IN_PROGRESS, resume it instead
3. Read docs/STRATEGY.md for context on the task's section
4. Follow the instructions in .claude/commands/implement-next.md exactly
5. After completion, append to .claude/progress.txt with format:
   === ITERATION $ITERATION | [timestamp] ===
   TASK: [task ID and name]
   STATUS: [DONE/BLOCKED/FAILED]
   DURATION: [estimated]
   FILES CHANGED: [list]
   TESTS: [passed/total]
   COMMIT: [commit message]
   LEARNINGS: [bullet points of what you discovered]
   NEXT: [next task ID]
6. Add any gotchas or patterns to CLAUDE.md section 11 (Gotchas & Patterns)
7. If BLOCKED: note the reason in CURRENT.md, skip to the next task
8. Complete exactly ONE task, then stop.

CRITICAL RULES:
- NEVER assume a feature exists without checking the code
- ALWAYS run pnpm typecheck && pnpm test before committing
- ALWAYS read files before modifying them
- If tests fail after 3 attempts, mark as BLOCKED and move on
- Do not modify docs/STRATEGY.md
" \
    --dangerously-skip-permissions 2>&1 | tee -a "$LOOP_LOG"

  # Log iteration end
  echo "=== END ITERATION $ITERATION | $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOOP_LOG"

  # Check if task was completed (look at last progress entry)
  LAST_STATUS=$(tail -20 "$PROGRESS_FILE" | grep "^STATUS:" | tail -1 | awk '{print $2}' || echo "UNKNOWN")
  echo "📊 Last task status: $LAST_STATUS"

  if [ "$LAST_STATUS" = "BLOCKED" ]; then
    echo "⚠️  Task blocked — continuing to next"
  fi

  # Brief pause between iterations (rate limit friendly)
  if [ $ITERATION -lt $MAX_ITERATIONS ]; then
    echo "⏳ Pause 30s before next iteration..."
    sleep 30
  fi
done

# --- Summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 LOOP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Iterations: $ITERATION"
echo "Tasks done: $(grep -c "^STATUS: DONE" "$PROGRESS_FILE" 2>/dev/null || echo 0)"
echo "Tasks blocked: $(grep -c "^STATUS: BLOCKED" "$PROGRESS_FILE" 2>/dev/null || echo 0)"
echo "Remaining: $(grep -c "^- \[ \]" "$BACKLOG_FILE" 2>/dev/null || echo 0)"
echo ""
echo "Review: git log --oneline -$ITERATION"
echo "Progress: cat $PROGRESS_FILE"
echo "Findings: ls .claude/findings/"
