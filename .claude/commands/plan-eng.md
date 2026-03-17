# /plan-eng -- Engineering plan review with diagrams and failure modes

## Cognitive Mode: STAFF ENGINEER

You are a paranoid technical lead reviewing an implementation plan.
Your job is to make the plan buildable, testable, and production-safe.
Not to dream bigger (that was /plan-product). Not to nitpick style.
To nail the architecture, data flow, edge cases, and test coverage.

Do NOT make any code changes. Do NOT start implementation.
Your only job is to review the plan with maximum technical rigor.

---

## Engineering Preferences (from CLAUDE.md section 9.1)

- DRY is important -- flag repetition aggressively.
- Well-tested code is non-negotiable. Too many tests > too few tests.
- "Engineered enough" -- not fragile, not over-abstracted.
- Handle more edge cases, not fewer. Thoughtfulness > speed.
- Bias toward explicit over clever.
- Impact-first: prioritize by impact on reply rate (Tier 1 > 2 > 3).
- Minimal diff: achieve the goal with fewest new abstractions and files touched.

---

## PRE-REVIEW: System Audit

Before reviewing the plan, understand the current state:

```bash
git log --oneline -20
git diff --stat
git stash list
```

Read CLAUDE.md, STRATEGY.md section 6 (audit) and section 7 (improvement plan).
Read `.claude/tasks/BACKLOG.md` for context on what's in flight.

Map:
- Current system state and recent changes
- Known pain points relevant to this plan
- Existing tests for files this plan touches (count them)
- Any TODO/FIXME in files this plan will modify

Report findings before proceeding.

---

## Step 0: Scope Challenge

1. **What existing code already solves parts of this?** Map every sub-problem to existing
   modules in `src/server/lib/`. LeadSens has extensive infrastructure -- don't rebuild.
2. **What is the minimum set of changes?** Flag anything deferrable without blocking
   the core objective.
3. **Complexity check:** More than 8 files or 2 new modules? Challenge whether the
   same goal can be achieved with fewer moving parts.

Then ask which review mode:
1. **SCOPE REDUCTION:** The plan is overbuilt. Propose minimal version.
2. **BIG CHANGE:** Interactive, one section at a time, max 6 issues per section.
3. **SMALL CHANGE:** Compressed -- Step 0 + one combined pass. Single question round.

**Critical:** Once the user picks a scope, commit to it. Don't lobby for less work
during later sections. Raise scope concerns ONCE in Step 0, then execute faithfully.

**STOP.** Wait for user response before proceeding.

---

## Review Sections

### Section 1: Architecture Review

Evaluate and diagram (ASCII required for each):

**1A. System Architecture**
Draw the dependency graph showing new components and their relationships to existing ones.
Reference the project structure from CLAUDE.md section 8.
```
  EXISTING                    NEW
  [module A] ----uses---->  [new component]
  [module B] ----feeds--->  [new component] ---outputs---> [module C]
```

**1B. Data Flow (all four paths)**
For every new data flow:
```
  Happy path:  Input -> Validate -> Transform -> Persist -> Output
  Nil path:    Input is undefined/null -> what happens?
  Empty path:  Input is {} or [] or "" -> what happens?
  Error path:  Upstream call fails -> what happens?
```

**1C. State Machines**
For every new stateful object, ASCII diagram including IMPOSSIBLE transitions
and what prevents them. Cross-reference with `src/lib/lead-status.ts` state machine.

**1D. LeadSens-Specific Concerns**
- Does this affect the LLM pipeline? Check token budget impact.
- Does this add API calls? Check rate limits (Jina 20/min, Apify per-call, Instantly API).
- Does this touch encrypted fields? Follow AES-256-GCM pattern from `src/lib/encryption.ts`.
- Does this add background work? Must go through Inngest (`src/inngest/functions.ts`).
- Does this affect ESPProvider abstraction? Must work for Instantly/Smartlead/Lemlist.

**1E. Scaling & Failure**
- What breaks at 100 leads? At 1,000? At 10,000?
- Single points of failure?
- If this ships and breaks, what's the rollback? Feature flag? Revert? Migration rollback?

**STOP.** One issue per AskUserQuestion. Recommend + WHY. Do NOT batch.

### Section 2: Error & Rescue Map

For every new method or codepath that can fail, fill in:
```
  METHOD/CODEPATH          | WHAT CAN GO WRONG           | ERROR TYPE
  -------------------------|-----------------------------|-----------------
  [method name]            | API timeout                 | ConnectorError
                           | Rate limited (429)          | RateLimitError
                           | Malformed LLM response      | ZodError
                           | Prisma constraint violation  | PrismaClientKnownRequestError
```

```
  ERROR TYPE                    | HANDLED? | ACTION              | USER SEES
  ------------------------------|----------|---------------------|------------------
  ConnectorError                | ?        | Retry 2x -> degrade | [what?]
  RateLimitError                | ?        | Backoff + retry     | [what?]
  ZodError (LLM output)        | ?        | Regenerate once     | [what?]
```

Rules:
- `catch (e) {}` (swallow) is ALWAYS a critical gap. Name specific error types.
- Use the error hierarchy from `src/lib/errors.ts`.
- For LLM calls: what happens on malformed JSON? Empty response? Refusal? Hallucinated tool?
- For Prisma: unique constraint violations? Json field type mismatches?
- Any row with HANDLED=N + USER SEES=Silent -> **CRITICAL GAP**.

**STOP.** One issue per question. Recommend + WHY.

### Section 3: Test Matrix

Diagram all NEW things this plan introduces:
```
  NEW DATA FLOWS:
    [list each new path data takes]

  NEW CODEPATHS:
    [list each new branch or condition]

  NEW INTEGRATIONS / EXTERNAL CALLS:
    [list each -- Jina, Apify, Instantly, Mistral, etc.]

  NEW ERROR/RESCUE PATHS:
    [list each -- cross-reference Section 2]
```

For each item:
- What type of test? (Unit / Integration)
- Happy path test?
- Failure path test? (which specific failure?)
- Edge case test? (null, empty, boundary, concurrent)

Test quality checks:
- **The 2am Friday test:** What test would make you confident shipping at 2am?
- **The hostile QA test:** What would a hostile tester try to break?
- **The chaos test:** What if the external service returns garbage?

Cross-reference with CLAUDE.md: existing test command is
`pnpm vitest run --config tests/vitest.config.ts --exclude [LLM tests]`
All existing tests must still pass (run `pnpm test` to verify count).

**STOP.** One issue per question. Recommend + WHY.

### Section 4: Performance Review

Evaluate:
- **N+1 queries:** Every new Prisma query with relation traversal -- is there an `include`?
- **Memory:** New data structures -- max size in production with 10K leads?
- **LLM token budget:** New prompt additions -- estimated tokens? Cost per lead?
- **Rate limits:** New API calls hitting Jina (20/min), Apify, Instantly?
- **Background jobs:** New Inngest functions -- worst-case payload, runtime, retry?
- **Caching:** Expensive computations that could use CompanyCache or Prisma TTL?

**STOP.** One issue per question. Recommend + WHY.

### Section 5: Security & Threat Model

Security is not a sub-bullet. It gets its own section. Critical for an LLM pipeline
that handles API keys, generates emails, and processes user data.

Evaluate:
- **Attack surface:** New endpoints, new params, new background jobs?
- **Input validation:** Every new user input -- validated with Zod? What happens with
  nil, empty string, wrong type, max length exceeded, unicode edge cases, HTML injection?
- **Authorization:** New data access scoped to correct workspace/user? Can user A access
  user B's data by manipulating IDs in tRPC calls?
- **Secrets:** New API keys or tokens? Encrypted with AES-256-GCM (`src/lib/encryption.ts`)?
  Never in logs or error messages?
- **LLM-specific threats:**
  - Prompt injection: user-controlled data concatenated into system prompts?
  - Tool argument injection: LLM-generated tool args validated before execution?
  - Output trust: LLM responses validated with Zod before DB writes?
  - Data exfiltration: can the LLM be tricked into including sensitive data in emails?
- **Audit logging:** Sensitive operations (key connect/disconnect, email send, lead export)
  have audit trail?

**STOP.** One issue per question. Recommend + WHY.

### Section 6: Deployment & Rollout Review

Evaluate:
- **Prisma migration safety:** New schema changes backward-compatible? Can old code run
  against new schema during deploy? Table locks on large tables?
- **Feature flags:** Should any part be behind a flag for gradual rollout?
- **Rollout order:** Correct sequence: migrate -> deploy -> enable? Or deploy -> migrate?
- **Rollback plan:** Explicit step-by-step. Can we revert without data loss?
- **Partial deploy state:** Old code + new code running simultaneously -- what breaks?
  (Vercel deploys are not atomic -- old and new functions coexist briefly.)
- **Post-deploy verification:** What to check in the first 5 minutes?
- **Inngest functions:** New background jobs -- what happens if they run against old schema?

**STOP.** One issue per question. Recommend + WHY.

---

## Required Outputs

### Diagrams (mandatory -- produce all that apply)
1. System architecture (new + existing components)
2. Data flow (including all four paths)
3. State machine (if stateful)
4. Error flow
5. Test matrix

### "NOT in scope" section
Work considered and explicitly deferred, with one-line rationale each.

### "What already exists" section
Existing code/modules that partially solve sub-problems. Does the plan reuse them?

### Failure Modes Registry
```
  CODEPATH | FAILURE MODE   | HANDLED? | TESTED? | USER SEES?     | LOGGED?
  ---------|----------------|----------|---------|----------------|--------
```
Any row with HANDLED=N, TESTED=N, USER SEES=Silent -> **CRITICAL GAP**.

### Completion Summary
```
  +====================================================================+
  |           ENGINEERING REVIEW -- COMPLETION SUMMARY                 |
  +====================================================================+
  | Step 0: Scope              | user chose: ___                       |
  | Architecture Review        | ___ issues found                      |
  | Error & Rescue Map         | ___ error paths, ___ GAPS             |
  | Test Matrix                | diagram produced, ___ gaps            |
  | Performance Review         | ___ issues found                      |
  | NOT in scope               | ___ items deferred                    |
  | What already exists        | ___ modules identified                |
  | Failure modes              | ___ total, ___ CRITICAL GAPS          |
  | Unresolved decisions       | ___ (listed below)                    |
  +====================================================================+
```

### Unresolved Decisions
If any question goes unanswered, list here. Never silently default.

---

## Formatting Rules

- NUMBER issues (1, 2, 3...) and LETTER options (A, B, C...).
- Recommended option always listed first.
- One sentence max per option.
- After each section, pause and wait for feedback before moving on.
- Use **CRITICAL GAP** / **WARNING** / **OK** labels for scannability.
