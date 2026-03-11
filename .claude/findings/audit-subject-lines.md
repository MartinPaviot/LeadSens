# Audit: Subject Lines — 2026-03-09

> Component: Subject Lines
> STRATEGY Ref: §6.2 (audit — was 2/10), §7.2.1 (pattern library + A/B)
> Research Ref: RESEARCH-DELIVERABILITY §7.4, RESEARCH-LANDSCAPE §R2.3 + §R6.2, RESEARCH-COLD-EMAIL-SCIENCE §3
> Score: **6/10** (target 6/10) — ✅ TARGET ATTEINT
> Previous audit: 2026-03-09-audit-v2-with-research.md scored 6/10

---

## Current State

The subject line system has gone from 2/10 (bare "2-4 words, lowercase" rule) to 6/10 with a formal pattern library and A/B variant generation. The core architecture works end-to-end: LLM generates 3 variants → stored in DraftedEmail.subjectVariants → pushed via Instantly custom variables → rendered as native Instantly variants[].

### Files Audited

| File | Lines | Purpose |
|------|-------|---------|
| `src/server/lib/email/prompt-builder.ts` | 586 | Pattern library (L565-574), prompt constraints (L576-585) |
| `src/server/lib/email/drafting.ts` | 118 | System prompt with variant instructions (L108-113) |
| `src/server/lib/email/quality-gate.ts` | 125 | Quality scoring (includes formatting axis for subjects) |
| `src/server/lib/email/spam-words.ts` | ~180 | Spam word scanner (scans both subject + body) |
| `src/server/lib/tools/email-tools.ts` | 644 | DraftedEmail persistence with subjectVariants (L154-167) |
| `src/server/lib/tools/instantly-tools.ts` | ~550 | Instantly push with custom vars for variants (L461-530) |
| `src/server/lib/connectors/instantly.ts` | ~960 | createCampaign with native variants[] API (L917-932) |
| `src/server/lib/llm/mistral-client.ts` | ~870 | Email output schema with subjects[] (L862-866) |
| `src/server/lib/analytics/correlator.ts` | 200 | 6 correlation dimensions (NO subject pattern) |
| `prisma/schema.prisma` | DraftedEmail model | subjectVariants Json?, NO subjectPattern field |
| `tests/prompt-builder.test.ts` | ~325 | 25 tests including subject pattern snapshot |

### What's Implemented (Good)

1. **5-pattern library** — Question, Observation, Curiosity gap, Direct, Personalized. Each with best-for step mapping and 3 examples. `prompt-builder.ts:565-574`
2. **3 variants per step** — System prompt instructs LLM to generate `subjects: ["...", "...", "..."]`. `drafting.ts:108-113`
3. **Different pattern per variant** — Prompt explicitly says "Each variant in 'subjects' MUST use a DIFFERENT pattern from this table." `prompt-builder.ts:574`
4. **Instantly native variants[]** — `createCampaign()` maps subjects array to native Instantly variants. `instantly.ts:919-930`
5. **Custom variable mapping** — Push tool creates `email_step_N_subject`, `email_step_N_subject_v2`, `email_step_N_subject_v3` custom vars per lead. `instantly-tools.ts:461-530`
6. **Subjectection stored** — `DraftedEmail.subjectVariants` persists alternative subjects as JSON array. `schema.prisma:235`
7. **Constraints enforced in prompt** — "2-4 words, lowercase, no forced caps, no punctuation" in prompt-builder. `prompt-builder.ts:578`
8. **Spam word scanning** — Both subject and body scanned before quality gate. `spam-words.ts:170`, `quality-gate.ts:92`
9. **Quality gate formatting axis** — Scores "Subject 2-4 words, lowercase?" as part of formatting. `quality-gate.ts:48`
10. **Snapshot tests** — Pattern table tested for regression. `tests/prompt-builder.test.ts:302-322`

---

## STRATEGY Target (§7.2.1)

> "Subject lines: librairie de patterns + A/B testing"
> - Librairie de 5 patterns prouvés: question, observation, curiosité, direct, personnalisé ✅
> - Générer 2-3 variantes par step ✅
> - Utiliser `variants[]` natif Instantly ✅
> - **Tracker la performance par pattern** ❌

---

## Research Best Practices

| Source | Finding | LeadSens Status |
|--------|---------|----------------|
| RESEARCH-DELIVERABILITY §7.4 | Personalized subjects +22-32% vs generic | ✅ Personalized pattern available |
| RESEARCH-DELIVERABILITY §7.4 | Numbers in subjects +45% open rate | ❌ No numbers guidance in prompt |
| RESEARCH-DELIVERABILITY §7.4 | Question format +10% open rate | ✅ Question pattern available |
| RESEARCH-DELIVERABILITY §7.4 | 3, 7, or 8 word subjects = 33% open rate | ⚠️ Prompt says 2-4 words (misses 7-8) |
| RESEARCH-DELIVERABILITY §7.4 | First name in subject = 43.41% reply rate | ❌ Current rule explicitly forbids it |
| RESEARCH-DELIVERABILITY §7.4 | Sentence case = 24% vs lowercase | ⚠️ Forces lowercase (OK per best practice consensus) |
| RESEARCH-LANDSCAPE §R2.3 | Trigger-based subjects = 54.7% open rate (+42.4% lift) | ✅ Personalized pattern covers triggers |
| RESEARCH-LANDSCAPE §R2.3 | Numbers in subjects = +113% lift | ❌ No explicit number guidance |
| RESEARCH-LANDSCAPE §R6.2 | Track `subjectPattern` metadata in DraftedEmail | ❌ Field doesn't exist |
| RESEARCH-LANDSCAPE §R6.6 | Subject line pattern as correlator dimension | ❌ Missing from correlator.ts |
| RESEARCH-COLD-EMAIL-SCIENCE §3 | Step 0 subject = highest ROI for A/B budget | ⚠️ All steps treated equally |

---

## Gap Analysis

### Gap 1: No pattern tracking (CRITICAL for optimization loop)

The system generates subjects using 5 patterns, but **never records which pattern was used**. The `DraftedEmail` schema has `signalType`, `frameworkName`, `enrichmentDepth` etc. for correlation — but no `subjectPattern`. The correlator has 6 queries (signal type, step, quality score, enrichment depth, industry, word count) — but none for subject pattern.

**Result:** Impossible to answer "which subject line patterns get the most opens/replies?" This breaks the optimization flywheel for the #1 open-rate lever.

### Gap 2: No subject length validation (runtime)

The prompt instructs "2-4 words" but there's **no runtime enforcement**. The quality gate's formatting axis mentions subjects but scoring is LLM-based — there's no deterministic check that the subject is under a certain character count (research says under 50 chars) or word count. If Mistral outputs a 10-word subject, it gets saved as-is.

### Gap 3: FirstName-in-subject contradiction

Research shows first name in subject = 43.41% reply rate (RESEARCH-DELIVERABILITY §7.4, Snovio 2026). The current system prompt explicitly bans `[FirstName]` in subjects (`drafting.ts:50`). The prompt-builder includes `{{firstName}}` in Question pattern examples (`prompt-builder.ts:568`) but the system prompt overrides with "no [FirstName]". This is a contradiction.

### Gap 4: Numbers guidance missing

Research shows numbers in subjects = +45% open rate / +113% lift (RESEARCH-DELIVERABILITY §7.4, RESEARCH-LANDSCAPE §R2.3). The current pattern library doesn't mention numbers at all. The Curiosity gap examples could naturally include numbers ("3 SaaS teams switching to...") but there's no explicit instruction.

### Gap 5: Missing subjects for single drafts

`draft_single_email` in `email-tools.ts:357` calls `draftWithQualityGate()` but only destructures `{ subject, body, qualityScore }` — the `subjects` array is **dropped**. This means single-drafted emails never get stored with `subjectVariants`. Only `draft_emails_batch` (line 120) captures `subjects`.

### Gap 6: Variant fallback silently degrades

In `instantly-tools.ts:525-530`, if `subjectVariants` is null (e.g., from draft_single_email), the custom vars `email_step_N_subject_v2` and `email_step_N_subject_v3` are never set. But the Instantly campaign template at `instantly-tools.ts:463-466` references them. Instantly will display the raw `{{email_step_0_subject_v2}}` placeholder as the subject line for variant 2 — a **user-visible bug**.

---

## Issues

### ISSUE 1 — No `subjectPattern` metadata on DraftedEmail (HIGH)
**File:** `prisma/schema.prisma:229-257`, `src/server/lib/tools/email-tools.ts:37-49`
**Severity:** HIGH
**Impact:** Blocks data-driven pattern optimization — the single highest-leverage feedback loop for open rates.
**Detail:** `buildDraftMetadata()` captures signalType, frameworkName, enrichmentDepth, bodyWordCount, leadIndustry — but not which subject line pattern was used. The LLM is asked to pick from 5 patterns but never asked to report which one it chose. No way to correlate pattern → open rate.

### ISSUE 2 — `draft_single_email` drops `subjects` array (HIGH)
**File:** `src/server/lib/tools/email-tools.ts:357`
**Severity:** HIGH
**Impact:** Single-drafted emails lose A/B variants → pushed to Instantly with only 1 subject instead of 3.
**Detail:** Line 357 destructures `const { subject, body, qualityScore }` but `subjects` is available from `draftWithQualityGate()`. Compare with batch draft at line 120 which correctly captures `subjects`. The `upsert` at lines 393-414 never writes `subjectVariants`.

### ISSUE 3 — Variant placeholder fallback bug (HIGH)
**File:** `src/server/lib/tools/instantly-tools.ts:461-467, 525-530`
**Severity:** HIGH
**Impact:** If a lead has no `subjectVariants` (from single draft, or if LLM doesn't return subjects[]), Instantly receives `{{email_step_N_subject_v2}}` as the literal subject line for that variant. This is visible to prospects.
**Detail:** The campaign template always declares 3 subjects per step (L463-466), but the custom variable population only sets v2/v3 if variants exist (L526-530). Missing custom variables in Instantly are rendered as raw placeholder text.

### ISSUE 4 — No subject length enforcement (MEDIUM)
**File:** `src/server/lib/email/quality-gate.ts:48`, `src/server/lib/email/prompt-builder.ts:578`
**Severity:** MEDIUM
**Impact:** LLM may generate 6+ word subjects that violate the 2-4 word constraint. Quality gate catches it only probabilistically via formatting axis.
**Detail:** The constraint is purely in the LLM prompt — no deterministic post-processing validation. Research recommends < 50 chars. A simple `if (subject.split(/\s+/).length > 5)` check would catch violations.

### ISSUE 5 — First name in subject banned but research suggests testing (MEDIUM)
**File:** `src/server/lib/email/drafting.ts:50`
**Severity:** MEDIUM
**Impact:** Missing 43.41% reply rate potential (Snovio 2026). Rule contradicts prompt-builder examples.
**Detail:** `drafting.ts:50` says "no [FirstName]" in subjects. `prompt-builder.ts:568` shows example `"quick question, {{firstName}}"`. Research data suggests first name in subject correlates with higher replies. This should be A/B tested, not banned outright.

### ISSUE 6 — No numbers guidance in subject patterns (LOW)
**File:** `src/server/lib/email/prompt-builder.ts:565-574`
**Severity:** LOW
**Impact:** Missing +45% open rate potential from numbers in subjects.
**Detail:** Research shows numbers boost subject performance significantly. The Curiosity gap pattern could naturally include guidance like "include a concrete number when possible." Not in any prompt instruction.

### ISSUE 7 — No correlator query for subject pattern (LOW)
**File:** `src/server/lib/analytics/correlator.ts`
**Severity:** LOW (blocked by ISSUE 1 — needs subjectPattern field first)
**Impact:** Cannot build data-driven pattern selection until ISSUE 1 is resolved.
**Detail:** `correlator.ts` has 6 `getReplyRateBy*` queries. Once `subjectPattern` exists on DraftedEmail, a 7th query `getReplyRateBySubjectPattern()` completes the feedback loop.

---

## Recommended Tasks

### Priority order by impact:

1. **SUBJ-FIX-01** Fix variant placeholder bug (ISSUE 3) — **CRITICAL, 30 min**
   - Prevents raw `{{template}}` text from being sent to prospects
   - Must be done before any more campaigns are pushed

2. **SUBJ-FIX-02** Fix draft_single_email dropping subjects (ISSUE 2) — **HIGH, 15 min**
   - One-line destructuring fix + write to subjectVariants in upsert

3. **RES-05** Subject pattern tracking (ISSUE 1 + 7) — **HIGH, 2-3h** (already in BACKLOG)
   - Add `subjectPattern` to DraftedEmail schema
   - Ask LLM to report which pattern per variant
   - Add correlator query `getReplyRateBySubjectPattern()`

4. **SUBJ-VALID-01** Subject length validation (ISSUE 4) — **MEDIUM, 30 min**
   - Deterministic check in quality gate: warn if >5 words or >50 chars
   - Auto-truncate is risky; flag for regeneration instead

5. **SUBJ-AB-01** A/B test first name in subject (ISSUE 5) — **MEDIUM, 1h**
   - Make firstName-in-subject a campaign-level toggle
   - Track results via pattern metadata

6. **SUBJ-NUM-01** Numbers guidance in patterns (ISSUE 6) — **LOW, 15 min**
   - Add to Curiosity gap and Observation pattern examples

---

## Score Justification: 6/10

| Dimension | Score | Notes |
|-----------|-------|-------|
| Pattern library | 8/10 | 5 patterns, examples, step mapping |
| Variant generation | 7/10 | 3 variants via LLM, different patterns enforced |
| Instantly integration | 5/10 | Works for batch, **broken for single drafts** (ISSUE 2+3) |
| Subject constraints | 6/10 | Prompt-level only, no runtime enforcement |
| Performance tracking | 1/10 | Zero tracking — no pattern metadata, no correlator |
| Research alignment | 5/10 | Missing firstName, numbers, length research insights |
| **Overall** | **6/10** | Solid generation, **broken optimization loop** |

Target 6/10 is technically met but the score is fragile — two HIGH bugs (ISSUE 2, 3) could drop it to 5/10 if they ship to production.
