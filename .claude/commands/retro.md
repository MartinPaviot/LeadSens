# /retro -- Weekly engineering retrospective for LeadSens

## Cognitive Mode: ENGINEERING MANAGER

Analyze commit history, work patterns, shipping velocity, and pipeline progress.
Data-driven, not vibes. Specific, not generic. Anchored in actual commits.

## Arguments
- `/retro` -- default: last 7 days
- `/retro 24h` -- last 24 hours
- `/retro 14d` -- last 14 days
- `/retro 30d` -- last 30 days
- `/retro compare` -- compare current vs prior same-length window

---

## Step 1: Gather Data

Parse the argument for time window. Default to 7 days.

Run ALL of these in parallel (they are independent):

```bash
# 1. Commits with timestamps and stats
git log origin/main --since="<window>" --format="%H|%ai|%s" --shortstat

# 2. Per-commit file breakdown (test vs production)
git log origin/main --since="<window>" --format="COMMIT:%H" --numstat

# 3. Timestamps for session detection
git log origin/main --since="<window>" --format="%at|%ai|%s" | sort -n

# 4. Hotspot files
git log origin/main --since="<window>" --format="" --name-only | sort | uniq -c | sort -rn

# 5. PR numbers from commit messages
git log origin/main --since="<window>" --format="%s" | grep -oE '#[0-9]+' | sort -n | uniq
```

Also read:
- `.claude/tasks/BACKLOG.md` -- task completion progress
- `.claude/progress.txt` -- recent iteration logs (last 20 entries)

---

## Step 2: Compute Metrics

| Metric | Value |
|--------|-------|
| Commits to main | N |
| PRs merged | N |
| Total insertions | N |
| Total deletions | N |
| Net LOC added | N |
| Test LOC (insertions) | N |
| Test LOC ratio | N% |
| Active days | N |
| Detected sessions | N |

---

## Step 3: Pipeline Progress (LeadSens-specific)

Cross-reference with BACKLOG.md and CLAUDE.md section 3:

```
  PIPELINE SCORE CARD:
  Component        | Score  | Target | Status
  -----------------+--------+--------+--------
  Enrichment       | X/10   | 6/10   | [MET/GAP]
  ICP Scoring      | X/10   | 7/10   | [MET/GAP]
  Copywriting      | X/10   | 8/10   | [MET/GAP]
  Subject Lines    | X/10   | 6/10   | [MET/GAP]
  A/B Testing      | X/10   | 5/10   | [MET/GAP]
  Cadence          | X/10   | 7/10   | [MET/GAP]
  Feedback Loop    | X/10   | 5/10   | [MET/GAP]
  Post-launch      | X/10   | 5/10   | [MET/GAP]

  BACKLOG:
  Tier 1: [done]/[total] (reply rate 9% -> 14%)
  Tier 2: [done]/[total] (reply rate 14% -> 17%)
  Tier 3: [done]/[total] (reply rate 17% -> 20%)

  Overall: [total done]/[total tasks] = [%] complete
```

---

## Step 4: Commit Time Distribution

Show hourly histogram:
```
  Hour  Commits  ████████████████
   08:    4      ████
   09:    5      █████
   ...
```

Identify: peak hours, dead zones, late-night clusters.

---

## Step 5: Work Session Detection

Use 45-minute gap threshold between consecutive commits.

Classify:
- **Deep sessions** (50+ min) -- architecture, complex features
- **Medium sessions** (20-50 min) -- standard implementation
- **Micro sessions** (<20 min) -- quick fixes, config changes

Calculate: total active time, average session length, LOC per hour.

---

## Step 6: Commit Type Breakdown

Categorize by conventional commit prefix (feat/fix/refactor/test/chore/docs):

```
  feat:     20  (40%)  ████████████████████
  fix:      15  (30%)  ███████████████
  refactor:  5  (10%)  █████
  test:      5  (10%)  █████
  chore:     5  (10%)  █████
```

Flag if fix ratio > 50% (ship-fast-fix-fast pattern).

---

## Step 7: Hotspot Analysis

Top 10 most-changed files. Flag:
- Files changed 5+ times (churn hotspots -- architectural smell?)
- Whether hotspots are in the critical path (enrichment, email, scoring)
- Test files vs production files ratio in hotspot list

---

## Step 8: Focus Score + Ship of the Week

**Focus score:** % of commits touching the most-changed directory.
Higher = deeper focused work. Lower = context-switching.

**Ship of the week:** Highest-impact PR/commit cluster. What was it, why it matters.

---

## Step 9: Streak Tracking

```bash
# Count consecutive days with commits
git log origin/main --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

Count backward from today. Display: "Shipping streak: N consecutive days"

---

## Step 10: Load History & Save

Check for prior retros:
```bash
ls -t .claude/retros/*.json 2>/dev/null
```

If prior exists: load most recent, calculate deltas, show trends table.

Save new snapshot to `.claude/retros/YYYY-MM-DD-N.json`:
```json
{
  "date": "YYYY-MM-DD",
  "window": "7d",
  "metrics": {
    "commits": N,
    "prs_merged": N,
    "insertions": N,
    "deletions": N,
    "net_loc": N,
    "test_loc": N,
    "test_ratio": 0.XX,
    "active_days": N,
    "sessions": N,
    "deep_sessions": N,
    "feat_pct": 0.XX,
    "fix_pct": 0.XX
  },
  "pipeline": {
    "score": "<derive from BACKLOG.md component scores>",
    "tier1_pct": "<count done/total in Tier 1>",
    "tier2_pct": "<count done/total in Tier 2>",
    "tier3_pct": "<count done/total in Tier 3>",
    "backlog_total": "<count all tasks>",
    "backlog_done": "<count checked tasks>"
  },
  "streak_days": N,
  "tweetable": "Week of Mar X: N commits, X.Xk LOC, X% tests, N PRs | Score: 7.0/10"
}
```

---

## Step 11: Write the Narrative

### Output Structure

**Tweetable summary** (first line):
```
Week of [date]: N commits, X.Xk LOC, X% tests, N PRs | Score: X/10 | Streak: Nd
```

Then:
1. **Summary Table** (Step 2)
2. **Pipeline Progress** (Step 3) -- LeadSens-specific, cross-ref STRATEGY.md
3. **Trends vs Last Retro** (Step 10, skip if first retro)
4. **Time & Session Patterns** (Steps 4-5)
5. **Shipping Velocity** (Steps 6-7)
6. **Focus & Highlights** (Step 8)
7. **Top 3 Wins** -- highest-impact things shipped, WHY they matter for reply rate
8. **3 Things to Improve** -- specific, actionable, anchored in actual commits
9. **3 Habits for Next Week** -- small, practical, <5 min to adopt

---

## Compare Mode

When `/retro compare`:
1. Compute metrics for current window (default 7d)
2. Compute metrics for prior same-length window (`--since --until` to avoid overlap)
3. Side-by-side comparison with deltas and arrows
4. Brief narrative on biggest improvements and regressions
5. Save only current-window snapshot

---

## Tone

- Encouraging but candid. No coddling.
- Specific -- always anchor in actual commits/code.
- Skip generic praise. Say exactly what was good and why.
- Frame improvements as leveling up, not criticism.
- Keep total output around 2000-3000 words.
- ALL narrative output goes to conversation. Only file written is the JSON snapshot.

---

## Important Rules

- Use `origin/main` for all queries (not stale local main)
- If zero commits in window, say so and suggest a different window
- Round LOC/hour to nearest 50
- Do not read CLAUDE.md or STRATEGY.md beyond what's needed for pipeline scores
- Create `.claude/retros/` directory if it doesn't exist
