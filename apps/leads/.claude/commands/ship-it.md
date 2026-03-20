# /ship-it -- Automated ship workflow for LeadSens

## Cognitive Mode: RELEASE ENGINEER

You are a disciplined release machine. The user said /ship-it -- that means DO IT.
No ideation. No brainstorming. Sync, test, push, PR. Land the plane.

Run straight through. Output the PR URL at the end.

**Only stop for:**
- On `main` branch (abort -- must ship from feature branch)
- Merge conflicts that can't be auto-resolved
- Test failures (typecheck or vitest)
- Critical review findings the user wants to fix

**Never stop for:**
- Uncommitted changes (always include them)
- Commit message approval (auto-compose)
- PR description approval (auto-generate)

---

## Step 1: Pre-flight

1. Check current branch:
   ```bash
   git branch --show-current
   ```
   If on `main`: **ABORT** -- "You're on main. Create a feature branch first:
   `git checkout -b auto/improve-$(date +%Y%m%d)`"

2. Check state:
   ```bash
   git status
   git log main..HEAD --oneline
   git diff main...HEAD --stat
   ```

3. If no commits AND no uncommitted changes: **ABORT** -- "Nothing to ship."

---

## Step 2: Sync with main

Fetch and merge origin/main so tests run against the latest merged state:

```bash
git fetch origin main && git merge origin/main --no-edit
```

- **Merge conflicts:** Try to auto-resolve simple ones (schema.prisma, lock files).
  If complex or ambiguous, **STOP** and show them.
- **Already up to date:** Continue silently.

---

## Step 3: Run tests

Run both checks in parallel:

```bash
pnpm typecheck 2>&1 | tee /tmp/ship_typecheck.txt &
pnpm vitest run --config tests/vitest.config.ts --exclude 'tests/icp-parser/golden-set.test.ts' --exclude 'tests/icp-parser/icp-parser.test.ts' --exclude 'tests/icp-parser/stress-test.test.ts' --exclude 'tests/icp-parser/vagueness.test.ts' 2>&1 | tee /tmp/ship_tests.txt &
wait
```

After both complete, check results.

- **Any failure:** Show the failures and **STOP**. Do not proceed.
- **All pass:** Note counts briefly and continue.

---

## Step 4: Pre-landing review (lightweight)

Run a quick structural review of the diff:

1. Get the diff:
   ```bash
   git diff origin/main
   ```

2. Check for CRITICAL issues only (from /review-paranoid Pass 1):
   - Prisma data safety (raw SQL, missing validation, TOCTOU)
   - LLM trust boundary violations (unvalidated LLM output to DB)
   - Encryption gaps (plain text secrets)
   - Race conditions (non-atomic status transitions)

3. Output: `Quick Review: N critical issues found` or `Quick Review: Clean.`

4. **If critical issues:** For EACH, ask:
   A) Fix it now (recommended)
   B) Acknowledge and ship anyway
   C) False positive

   If user chose A on any: apply fixes, re-run Step 3, then continue.

---

## Step 5: Stage and commit

1. Stage changes BY NAME (never `git add -A` -- it can include .env, credentials, binaries):
   ```bash
   # List changed files, review each, then add by name
   git diff --name-only
   git diff --cached --name-only
   git ls-files --others --exclude-standard
   # Then: git add <file1> <file2> ...
   ```
   **Skip files matching:** `.env*`, `credentials*`, `*.pem`, `*.key`, `node_modules/`

2. Compose commit message from the diff. Use Conventional Commits format:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <summary>

   <body -- brief description of what changed and why>

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

   Type inference:
   - New functionality -> `feat`
   - Bug fix -> `fix`
   - Refactoring -> `refactor`
   - Tests only -> `test`
   - Config/tooling -> `chore`
   - Documentation -> `docs`

---

## Step 6: Push

Push with upstream tracking:

```bash
git push -u origin $(git branch --show-current)
```

---

## Step 7: Create PR

Create the pull request:

```bash
gh pr create --title "<type>(<scope>): <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points describing what changed>

## Pre-Landing Review
<findings from Step 4, or "Clean -- no critical issues.">

## Test Results
- [x] TypeScript typecheck passes
- [x] Vitest: N tests pass (0 failures)

## Test plan
<what to verify manually, if anything>

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Output the PR URL.** This is the last thing the user sees.

---

## Important Rules

- **Never skip tests.** If tests fail, stop.
- **Never force push.** Regular `git push` only.
- **Never push to main.** Always from a feature branch.
- **Branch naming:** Follow `auto/improve-*` convention per CLAUDE.md section 5.16.
- **Commit format:** Conventional Commits per CLAUDE.md section 5.14.
- **The goal:** User says `/ship-it`, next thing they see is the PR URL.
