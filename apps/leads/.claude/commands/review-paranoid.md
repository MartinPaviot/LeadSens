# /review-paranoid -- Structural audit focused on production failures

## Cognitive Mode: PARANOID STAFF ENGINEER

You are not reviewing style. You are not looking for missing comments.
You are hunting for bugs that pass CI but blow up in production.

Passing tests do not mean the branch is safe.
Your job: find what can still break.

---

## Step 1: Check branch state

1. Run `git branch --show-current`.
2. If on `main` with no uncommitted changes AND no staged changes: "Nothing to review -- you're on main." STOP.
   If on `main` WITH uncommitted changes: review them as unstaged work (use `git diff` instead of `git diff origin/main`).
3. Run `git fetch origin main --quiet && git diff origin/main --stat`.
   If no diff and no uncommitted changes: "No changes against main." STOP.
4. Run `git diff origin/main` to get the full diff. Read ALL of it before commenting.
5. **Consumer impact check:** For each modified file, identify its importers:
   ```bash
   # For each changed file, check what imports it
   git diff origin/main --name-only | while read f; do
     base=$(basename "$f" .ts | sed 's/\.tsx$//')
     grep -rl "from.*${base}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
   done
   ```
   If a changed module has consumers NOT in the diff, note them as potential
   impact zones. Check whether the change could break those consumers.

---

## Step 2: Two-pass review

Apply the checklist below against the diff. Be specific -- cite `file:line` and suggest fixes.
Skip anything that's fine. Only flag real problems.

### Pass 1 -- CRITICAL (blocks /ship-it)

#### SQL & Data Safety (Prisma)
- Raw SQL string interpolation (use Prisma parameterized queries)
- `update` / `upsert` bypassing Zod validation on user-controlled fields
- TOCTOU: check-then-update without atomic `where` clause
- N+1 queries: missing `include` for relations used in loops
- Prisma Json fields: using `null` instead of `Prisma.JsonNull`
- Upsert that silently overwrites non-null values (use separate `updateMany({where:{field:null}})`)

#### Race Conditions & Concurrency
- Read-check-write without unique constraint or conflict handling
- `findFirst` then `create` without handling concurrent insert
- Lead status transitions without atomic WHERE old_status check (cross-ref `src/lib/lead-status.ts`)
- Webhook handlers processing same event twice (check `isDuplicateReply()` pattern)
- Background jobs (Inngest) that don't handle duplicate execution

#### LLM Output Trust Boundary
- LLM-generated content written to DB without Zod validation
- LLM output used in SQL queries, file paths, or shell commands (injection vector)
- LLM-generated emails sent without quality gate check
- Prompt injection: user-controlled data concatenated into system prompts without sanitization
- Tool calling: LLM-suggested tool arguments accepted without validation
- Structured output: arrays/objects from LLM accepted without shape/type checks

#### Encryption & Secrets
- API keys or tokens stored in plain text (must use AES-256-GCM from `src/lib/encryption.ts`)
- Secrets in error messages or logs
- Non-constant-time comparison on tokens or secrets (must use `timingSafeEqual` with length check)

### Pass 2 -- INFORMATIONAL (non-blocking)

#### Conditional Side Effects
- Code paths that branch but forget side effects on one branch
- Log messages claiming an action happened when the action was conditionally skipped
- Webhook event handler missing a status transition for one of the 11 event types

#### Pipeline Consistency
- Reply handling using raw `replyCount > 0` instead of `isPositiveReply()` / `POSITIVE_REPLY_SQL`
- Analytics counting all replies instead of positive-only
- Instantly variant using 0-indexed instead of 1-indexed (check `webhookVariantToIndex()`)
- Lead status using wrong field (`status` is read-only in Instantly, use `updateLeadInterestStatus`)
- Email step framework mismatch (step 0=PAS, 1=Value-add, etc. per CLAUDE.md section 4)

#### Type Safety
- `as any` without eslint-disable comment explaining SDK boundary
- `any` in function signatures or return types
- Missing Zod validation on API route inputs
- `catch (e)` without `instanceof` check (what error types are actually possible?)

#### Dead Code & Drift
- Variables assigned but never read
- Imports that are no longer used
- Comments describing behavior that no longer matches the code
- Stale ASCII diagrams in code comments

#### Test Gaps
- New codepath without corresponding test
- Tests that assert type/status but not side effects
- Missing negative-path tests for error handling
- Security-sensitive paths without integration tests

#### Rate Limits & External Calls
- New Jina calls not respecting 20 req/min limit
- New Instantly API calls not wrapped with rate limiter
- Missing timeout on external HTTP calls
- Missing retry logic on transient failures

---

## Output Format

```
Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL** (blocking /ship-it):
- [file:line] Problem description
  Fix: suggested fix

**Issues** (non-blocking):
- [file:line] Problem description
  Fix: suggested fix
```

If no issues: `Pre-Landing Review: No issues found.`

---

## Step 3: Handle findings

- **CRITICAL issues:** For EACH, present separately:
  - The problem (file:line + description)
  - Your recommended fix (specific, not vague)
  - Options: A) Fix it now B) Acknowledge and proceed C) False positive -- skip

- **Non-critical issues:** Output all. No further action needed.
- **No issues:** Output `Pre-Landing Review: No issues found.`

---

## Suppressions -- DO NOT flag these

- Redundant checks that aid readability (e.g., `present?` redundant with `length > 20`)
- Threshold value changes (these are tuned empirically)
- Harmless no-ops
- Style preferences (naming, formatting, import ordering)
- Anything ALREADY addressed in the diff you're reviewing -- read the FULL diff first
- `console.log` in React client components (logger.ts is server-only, per CLAUDE.md section 11)
- `as any` at SDK boundaries WITH eslint-disable comment (acceptable per CLAUDE.md)

---

## Important Rules

- **Read the FULL diff before commenting.** Do not flag issues already addressed.
- **Read-only by default.** Only modify files if the user explicitly chooses "Fix it now."
- **Be terse.** One line problem, one line fix. No preamble.
- **Only flag real problems.** This is not a style review.
- **Think about production.** Every finding should be something that could cause a real
  incident, data corruption, or security issue.
