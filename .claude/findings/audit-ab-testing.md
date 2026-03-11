# Audit: A/B Testing — 2026-03-09

> Component: A/B Testing
> STRATEGY Ref: §6.2 (audit — was 0/10), §7.2.1 (A/B via variants[]), §7.3.2 (auto-pause + winner propagation)
> Research Ref: RESEARCH-LANDSCAPE §R6.3 (z-test auto-pause), RESEARCH-DELIVERABILITY §7.4 + §11.1
> Score: **4/10** (target 5/10) — ⚠️ GAP -1
> Previous audit: 2026-03-09-audit-v2-with-research.md scored 4/10

---

## Current State

The A/B testing pipeline has three working pieces: variant generation (LLM produces 3 subject variants), variant storage (DraftedEmail.subjectVariants), and variant push (Instantly native variants[] via custom variables). But the pipeline is **write-only**: variants go out, zero data comes back. There is no mechanism to determine which variant won, no auto-pause of losers, no winner propagation to future campaigns. The system generates A/B tests it can never learn from.

### Files Audited

| File | Lines | Purpose |
|------|-------|---------|
| `src/server/lib/tools/email-tools.ts` | 644 | Variant generation + storage (batch + single) |
| `src/server/lib/tools/instantly-tools.ts` | 679 | Campaign creation with variants[], lead push with custom vars |
| `src/server/lib/connectors/instantly.ts` | 970 | createCampaign() maps subjects→variants[], getCampaignStepAnalytics() |
| `src/server/lib/analytics/correlator.ts` | 200 | 6 correlation queries — NONE for subject variant |
| `src/server/lib/analytics/adaptive.ts` | 58 | Data-driven weights + step annotations — NO variant awareness |
| `src/server/lib/analytics/insights.ts` | 187 | Campaign reports + insights — NO variant breakdown |
| `src/queue/analytics-sync-worker.ts` | 117 | Syncs step-level analytics — NO variant-level granularity |
| `src/server/lib/email/style-learner.ts` | 114 | Winning patterns — uses signalType/frameworkName, NOT subject variant |
| `prisma/schema.prisma` | DraftedEmail, StepAnalytics | subjectVariants stored, NO per-variant perf fields |
| `docs/INSTANTLY-API.md` | 862 | Documents `v_disabled`, `auto_variant_select` API fields |

### What's Implemented (Generation → Push)

1. **3 subject variants per step** — LLM generates `subjects: ["...", "...", "..."]` via system prompt instruction. `drafting.ts:108-112`
2. **DraftedEmail stores variants** — `subjectVariants Json?` field persists alternative subjects. `schema.prisma:235`
3. **Instantly campaign uses native variants[]** — `createCampaign()` maps subjects array to Instantly's native `variants` array per step. `instantly.ts:919-930`
4. **Custom variable mapping** — Push tool creates `email_step_N_subject`, `_v2`, `_v3` as lead-level custom variables. `instantly-tools.ts:524-530`
5. **Campaign template references 3 subjects** — Template uses `{{email_step_N_subject}}`, `{{email_step_N_subject_v2}}`, `{{email_step_N_subject_v3}}`. `instantly-tools.ts:461-467`

### What's NOT Implemented (Tracking → Learning)

1. **Zero per-variant performance tracking** — StepAnalytics stores aggregate (sent, opened, replied) per step. No breakdown by variant.
2. **Zero variant → reply rate correlation** — Correlator has 6 dimensions (signal_type, step, quality_score, enrichment_depth, industry, word_count). None for subject variant.
3. **Zero auto-pause of losing variants** — Instantly API supports `v_disabled: true` to pause a variant. Never called.
4. **Zero winner propagation** — Winning subject patterns are never identified or reused in future campaigns.
5. **Zero statistical significance testing** — No z-test, no confidence intervals, no minimum sample size checks.

---

## STRATEGY Target

### §6.2 (original audit)
> "A/B Testing — 0/10. L'API Instantly accepte variants[] par step. Le code envoie toujours exactement 1 variante."

**Status:** Generation + push is now working (up from 0/10). But tracking/optimization is completely missing.

### §7.2.1
> "Tracker la performance par pattern"

**Status:** Not implemented. No `subjectPattern` metadata on DraftedEmail. No correlator query.

### §7.3.2
> "Auto-pause des variantes faibles"

**Status:** Not implemented. Zero auto-pause logic exists.

### §3.3 (Curseur d'autonomie)
> "A/B variant disable (perf basse) | Auto | Confirmation | Manuel"

**Status:** Not implemented. The autonomy cursor for A/B variant management doesn't exist.

---

## Research Best Practice

### RESEARCH-LANDSCAPE §R6.3 — A/B Auto-Pause with Statistical Rigor

| Parameter | Best Practice | LeadSens |
|-----------|---------------|----------|
| Confidence level | 95% (p < 0.05) | ❌ Not implemented |
| Min sample per variant | 100-200 recipients | ❌ Not checked |
| Min test duration | 5-7 days | ❌ Not checked |
| Auto-pause trigger | Both thresholds met + z-test significant | ❌ Not implemented |
| Test formula | Two-proportion z-test | ❌ Not implemented |
| Variant disable API | `v_disabled: true` via PATCH campaigns | ❌ Not used |

**z = (p1 - p2) / sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))**
Significant if |z| > 1.96

### Competitor Comparison

| Capability | Instantly Native | AiSDR | Lemlist | **LeadSens** |
|-----------|-----------------|-------|---------|-------------|
| Generate variants | ❌ Manual | ❌ Manual | ❌ Manual | **✅ Auto (3/step)** |
| Native A/B testing | ✅ Built-in UI | ❌ | ✅ | ✅ via variants[] |
| Per-variant analytics | ✅ Built-in | ❌ | ✅ | **❌ Not tracked** |
| Auto-pause loser | ❌ Manual | ❌ | ❌ | **❌ Not implemented** |
| Winner propagation | ❌ | ❌ | ❌ | **❌ Not implemented** |
| Statistical rigor | ❌ | ❌ | ❌ | **❌ Not implemented** |

**Key insight:** LeadSens already has the **hardest part** done (auto-generation of quality variants). The tracking + optimization layer is pure plumbing that could leapfrog every competitor's A/B capabilities.

---

## Gap Analysis

### Gap 1: Write-Only A/B Testing (CRITICAL)

The system generates 3 variants, pushes them to Instantly, and then... nothing. The analytics sync (`analytics-sync-worker.ts:40-66`) fetches `getCampaignStepAnalytics()` which returns aggregate step-level data (total sent, opened, replied per step). There is **no per-variant breakdown**.

The Instantly API step analytics endpoint does NOT return per-variant metrics directly. To get variant performance, you need to either:
- **Option A:** Read the campaign structure (`getCampaign()`) to get variant IDs, then use Instantly's native analytics UI (not API-accessible)
- **Option B:** Track which custom variable each lead received (`email_step_N_subject` vs `_v2` vs `_v3`) and correlate with `EmailPerformance` data locally

Currently, when leads are pushed via custom variables (`instantly-tools.ts:524-530`), the system doesn't record WHICH variant was selected for each lead. Since all 3 custom vars are set per lead, Instantly picks one at random — but LeadSens never knows which one was picked for whom.

### Gap 2: No Variant-to-Lead Attribution

Even if we had per-variant performance data, there's no way to correlate it back:
- `DraftedEmail` has `subject` (primary) and `subjectVariants` (alternatives), but no field indicating which variant a specific lead actually received
- `EmailPerformance` tracks opens/replies per lead but has no variant identifier
- The Instantly API email endpoint (`GET /emails`) includes `subject` on each email, which could be used to match back to variant — but this data is never fetched or stored

### Gap 3: No `v_disabled` API Integration

The Instantly API supports `v_disabled: boolean` on each variant within a campaign step (`INSTANTLY-API.md:400`). The connector's `updateCampaign()` method exists (`instantly.ts:951-962`) but is a generic PATCH — no specialized method for disabling variants. No code calls it for A/B management.

### Gap 4: No `auto_variant_select` Configuration

The Instantly campaign schema includes `auto_variant_select: null | object` (`INSTANTLY-API.md:427`), which appears to be Instantly's native A/B auto-selection feature. This field is never set during campaign creation (`instantly.ts:935-941`). Its schema is undocumented in our API docs.

### Gap 5: No Feedback Loop Integration

The adaptive drafting system (`adaptive.ts`) computes data-driven signal weights and step annotations from correlator data. But there's zero A/B variant awareness:
- `getDataDrivenWeights()` weights signal types — not subject patterns
- `getStepAnnotation()` annotates step performance — not per-variant performance
- `getWinningEmailPatterns()` in `style-learner.ts:46-114` identifies winning patterns by signalType + frameworkName + enrichmentDepth — never by subject variant or subject pattern

### Gap 6: draft_single_email Drops Variants (also in audit-subject-lines.md)

`email-tools.ts:357` destructures `{ subject, body, qualityScore }` from `draftWithQualityGate()`, dropping the `subjects` array. Single-drafted emails never get `subjectVariants` stored. When pushed, only 1 subject is set — the other 2 custom vars are missing, causing raw `{{template}}` text to appear (SUBJ-FIX-01/02 from subject lines audit, not duplicated here).

---

## Issues

### ISSUE 1 — No per-variant performance tracking (CRITICAL)
**Files:** `analytics-sync-worker.ts:40-66`, `correlator.ts` (entire file), `prisma/schema.prisma` (StepAnalytics model)
**Severity:** CRITICAL
**Impact:** The system runs A/B tests it can never learn from. 3 variants are generated and sent but no data comes back to identify winners. This is the single highest-leverage gap in the entire A/B component — without it, all other A/B features are blocked.
**Detail:** `getCampaignStepAnalytics()` returns aggregate step metrics. Instantly's step analytics API does not break down by variant natively. The only way to get per-variant attribution is to fetch each sent email via `GET /emails` (which includes the `subject` field) and match it back to the stored variants. The sync worker never does this.

### ISSUE 2 — No variant-to-lead attribution stored (CRITICAL)
**Files:** `src/server/lib/tools/instantly-tools.ts:515-530`, `prisma/schema.prisma` (EmailPerformance model)
**Severity:** CRITICAL
**Impact:** Without knowing which variant each lead received, per-variant reply rates cannot be computed. Blocks all downstream A/B optimization.
**Detail:** When pushing leads, all 3 custom variables are set per lead (`email_step_N_subject`, `_v2`, `_v3`). Instantly randomly selects one for each lead. The selected variant is never fetched or stored back in LeadSens. The Instantly `GET /emails` endpoint returns `subject` on each sent email — this could be matched back to stored variants to determine attribution.

### ISSUE 3 — No auto-pause of losing variants (HIGH)
**Files:** None (feature doesn't exist)
**Severity:** HIGH
**Impact:** Losing variants continue receiving traffic indefinitely, wasting impressions and reducing overall campaign reply rate. Research R6.3: auto-pause after z-test significance (|z| > 1.96) with min 100 sends + 5 days.
**Detail:** Instantly API supports `v_disabled: true` per variant via campaign PATCH. The connector has `updateCampaign()` but no logic calls it for variant management. The autonomy cursor (STRATEGY §3.3) defines A/B variant disable behavior per mode (Auto/Confirmation/Manual) — none implemented.

### ISSUE 4 — No winner propagation to future campaigns (HIGH)
**Files:** `src/server/lib/email/style-learner.ts:46-114`, `src/server/lib/analytics/adaptive.ts`
**Severity:** HIGH
**Impact:** Each campaign starts from scratch. A subject pattern that got 25% open rate is never reused preferentially. Compound improvement is impossible.
**Detail:** `getWinningEmailPatterns()` identifies winning patterns by `signalType + frameworkName + enrichmentDepth + bodyWordCount` — but never by subject line or subject pattern. Even if we tracked subject patterns, there's no mechanism to feed "your best subject patterns are Question and Personalized" back into the variant generation prompt.

### ISSUE 5 — No z-test or statistical significance check (HIGH)
**Files:** None (feature doesn't exist)
**Severity:** HIGH
**Impact:** Without statistical rigor, auto-pause decisions would be based on noise. Research specifies: two-proportion z-test, min 100 sends per variant, min 5 days.
**Detail:** The z-test formula is documented in RESEARCH-LANDSCAPE §R6.3 and already specified in the BACKLOG (RES-06). The implementation is straightforward (~50 lines) but blocked by ISSUE 1/2 (no data to test).

### ISSUE 6 — No correlator query for subject variant (MEDIUM)
**Files:** `src/server/lib/analytics/correlator.ts`
**Severity:** MEDIUM (blocked by ISSUE 1)
**Impact:** Cannot answer "which subject variant gets the most opens/replies per step?" — the most direct A/B insight.
**Detail:** Correlator has 6 `getReplyRateBy*()` queries. A 7th query `getReplyRateBySubjectVariant()` would require per-variant attribution data (ISSUE 2) to function.

### ISSUE 7 — StepAnalytics has no variant breakdown (MEDIUM)
**Files:** `prisma/schema.prisma` (StepAnalytics model), `analytics-sync-worker.ts:44-67`
**Severity:** MEDIUM
**Impact:** Step-level analytics are aggregate across all variants. No way to see "Step 0, Variant A: 15% open rate vs Variant B: 22% open rate."
**Detail:** StepAnalytics stores `sent, opened, replied, bounced` per step. A variant-aware model would need either: (A) separate rows per step×variant, or (B) a JSON field with per-variant breakdown. Option A is cleaner and enables SQL queries.

### ISSUE 8 — `auto_variant_select` never configured (LOW)
**Files:** `src/server/lib/connectors/instantly.ts:935-941`
**Severity:** LOW
**Impact:** Instantly may have native A/B optimization that we're not using. The `auto_variant_select` field in the campaign schema is undocumented in our API docs and never set.
**Detail:** Campaign creation in `createCampaign()` doesn't set `auto_variant_select`. Investigating this Instantly feature could provide out-of-the-box A/B optimization that supplements our own logic. LOW priority because our own logic would be more tailored.

### ISSUE 9 — Campaign insights report has no variant section (LOW)
**Files:** `src/server/lib/analytics/insights.ts:121-187`
**Severity:** LOW (blocked by ISSUE 1)
**Impact:** `getCampaignReport()` shows step breakdown but no variant breakdown. Users can't see which subjects won.
**Detail:** The `stepBreakdown` array in campaign reports shows per-step metrics but never per-variant. Once per-variant data is available, the report should include a `variantBreakdown` section per step.

---

## Architectural Recommendation: The A/B Feedback Pipeline

The A/B component needs a 4-layer pipeline to go from 4/10 to 7+/10:

```
Layer 1: ATTRIBUTION (Blocked — CRITICAL)
  Sync worker fetches sent emails via GET /emails → extracts subject → matches to stored variants
  → Stores variantIndex (0/1/2) on a new VariantPerformance table or on EmailPerformance

Layer 2: ANALYSIS (Blocked by Layer 1)
  New correlator query: getReplyRateBySubjectVariant(workspaceId, campaignId, step)
  Z-test computation: twoProportionZTest(variant1, variant2) → z-score + p-value
  Minimum thresholds: 100+ sends per variant, 5+ days

Layer 3: ACTION (Blocked by Layer 2)
  Auto-pause losing variant: client.updateCampaign() with v_disabled: true
  Respects autonomy cursor: Auto (pause immediately) / Supervised (confirm) / Manual (suggest)
  Agent notification: "Variant B (3.2% reply) outperforms Variant A (1.1%). Auto-paused A."

Layer 4: PROPAGATION (Blocked by Layer 3)
  Winner patterns fed back to adaptive.ts / prompt-builder.ts
  Future campaigns preferentially use winning patterns
  Style learner gains subject-specific category
```

---

## Recommended Tasks

### New tasks (not already in BACKLOG):

1. **AB-ATTR-01** Variant-to-lead attribution via email sync **(CRITICAL — 3-4h)**
   This is the **#1 blocker** for the entire A/B component.
   **Fichiers:** `src/queue/analytics-sync-worker.ts`, `src/server/lib/connectors/instantly.ts`, `prisma/schema.prisma`
   **Réf:** ISSUE 1 + 2
   **Impact:** Unblocks all A/B optimization. Without this, variant generation is wasted effort.
   **PASS IF:**
   - Analytics sync worker fetches sent emails per campaign (via `GET /emails` with `ue_type=1`)
   - For each sent email, extracts `subject` and matches against `DraftedEmail.subject` + `subjectVariants`
   - Stores `variantIndex` (0=primary, 1=v2, 2=v3) on `EmailPerformance` (new nullable Int field)
   - Handles the case where subject doesn't match any stored variant (fallback to null)
   - Rate limited to avoid Instantly API throttling
   - Test unitaire: given 3 variants + a sent email subject, correctly identifies variantIndex
   - `pnpm typecheck && pnpm test` passent

2. **AB-CORR-01** Correlator query for subject variant performance **(HIGH — 1h)**
   **Fichiers:** `src/server/lib/analytics/correlator.ts`, `src/server/lib/analytics/insights.ts`
   **Réf:** ISSUE 6 + 7
   **Impact:** Enables "which variant won?" analysis per step
   **PASS IF:**
   - `getReplyRateBySubjectVariant(workspaceId, campaignId, step)` query in correlator
   - Groups by variantIndex, returns sent/opened/replied/openRate/replyRate per variant
   - Minimum 5 sent per variant to include
   - `getCampaignReport()` includes `variantBreakdown` section per step
   - `pnpm typecheck && pnpm test` passent

3. **AB-REPORT-01** Variant performance in campaign report **(MEDIUM — 1h)**
   **Fichiers:** `src/server/lib/analytics/insights.ts`, `src/server/lib/tools/analytics-tools.ts`
   **Réf:** ISSUE 9
   **Impact:** Users can see "Variant A: 22% open, Variant B: 15% open" in performance reports
   **PASS IF:**
   - `campaign_performance_report` tool includes per-step variant breakdown (subject, sent, opened, replied, rates)
   - Variants labeled with their actual subject text (not just "Variant 0/1/2")
   - Analytics report inline component updated to render variant breakdown
   - `pnpm typecheck && pnpm test` passent

### Already in BACKLOG (validated and expanded by this audit):

- **RES-06** A/B auto-pause with z-test (MEDIUM) — Validated. **Depends on AB-ATTR-01** (needs variant attribution data first). The z-test formula and thresholds are correctly specified.
- **AUDIT-04** A/B winner propagation — Validated. **Depends on AB-CORR-01** (needs per-variant correlation data). Should feed winning subject patterns into `adaptive.ts` + `prompt-builder.ts`.
- **SUBJ-FIX-01** Variant placeholder fallback bug (CRITICAL) — Cross-cutting, also impacts A/B quality.
- **SUBJ-FIX-02** draft_single_email drops subjects (HIGH) — Cross-cutting, also impacts A/B coverage.
- **RES-05** Subject pattern tracking (MEDIUM) — Orthogonal but complementary. Pattern tracking answers "which pattern wins?" while variant tracking answers "which variant wins within a step?"

### Dependency Chain

```
AB-ATTR-01 (variant attribution)    ← BLOCKS EVERYTHING
    ├── AB-CORR-01 (correlator query)
    │       ├── AB-REPORT-01 (report visualization)
    │       └── AUDIT-04 (winner propagation)
    └── RES-06 (z-test auto-pause)
            └── Autonomy cursor integration
```

---

## Score Justification: 4/10

| Dimension | Score | Notes |
|-----------|-------|-------|
| Variant generation | 8/10 | 3 variants, different patterns enforced, quality gated |
| Variant push to ESP | 6/10 | Works for batch, **broken for single drafts** (SUBJ-FIX-01/02) |
| Per-variant tracking | 0/10 | Zero data flows back. Write-only pipeline |
| Auto-pause / z-test | 0/10 | Not implemented. API support exists but unused |
| Winner propagation | 0/10 | Not implemented. Cross-campaign learning impossible |
| Report/insights | 0/10 | No variant breakdown in any report or insight |
| Autonomy cursor | 0/10 | A/B variant disable per mode (§3.3) not implemented |
| **Overall** | **4/10** | Strong generation, **zero optimization loop** |

Target 5/10 is not met. The generation half (4 items) averages ~7/10. The optimization half (4 items) averages 0/10. The single blocker is **AB-ATTR-01** — without variant-to-lead attribution, everything downstream is impossible.

### Path to 5/10:
- Fix SUBJ-FIX-01 + SUBJ-FIX-02 (variant push reliability) → +0.5
- Implement AB-ATTR-01 (variant attribution) → +0.5

### Path to 7/10:
- Above + AB-CORR-01 + AB-REPORT-01 (tracking + reporting) → +1
- Above + RES-06 (z-test auto-pause) → +0.5
- Above + AUDIT-04 (winner propagation) → +0.5

### Path to 9/10 (competitive advantage):
- Above + autonomy cursor integration (Auto/Supervised/Manual)
- Above + cross-campaign challenger generation
- Above + Instantly `auto_variant_select` investigation
