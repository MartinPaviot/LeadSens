# Audit: Feedback Loop — 2026-03-09

> Component: Feedback Loop (4-layer architecture: Data Sync → Correlation → Insights → Adaptive Drafting)
> STRATEGY Ref: §6.2 (was 1.5/10, now 5/10), §7.3.2 (auto-pause, CampaignAngle adjustment), §7.3.4 (style learner), §11.5 Phase 7 (Learning Loop)
> Research Ref: RESEARCH-FEEDBACK-LOOPS-2026.md (FL-1 through FL-10), RESEARCH-LANDSCAPE §R6.3 (A/B auto-pause)
> Score: **5/10** (target 5/10) — ✅ ATTEINT but fragile
> Previous audit: 2026-03-09-audit-v2-with-research.md scored 5/10

---

## Current State

The feedback loop has a solid **4-layer architecture** that is architecturally correct and ahead of all named competitors. However, several critical data quality issues prevent the loop from actually self-improving: the primary metric is wrong (raw replies, not positive replies), the style learner captures but doesn't categorize, and variant performance is invisible. The "feedback" part of the loop flows one direction (performance → adaptive weights) but several planned feedback paths are completely absent.

### Layer 1: Data Sync — `analytics-sync-worker.ts` + `bounce-guard.ts` + webhook

| Capability | Status | File:Line |
|---|---|---|
| Analytics sync every 30 min | ✅ | `analytics-sync-worker.ts:17-117` |
| Overall campaign analytics → `analyticsCache` | ✅ | `analytics-sync-worker.ts:30-37` |
| Step analytics → `StepAnalytics` (per step) | ✅ | `analytics-sync-worker.ts:40-67` |
| Lead performance → `EmailPerformance` (per lead) | ✅ | `analytics-sync-worker.ts:69-114` |
| Paginated with rate limiting (500ms) | ✅ | `analytics-sync-worker.ts:111-113` |
| Bounce guard auto-pause (>3% after 50+ sends) | ✅ | `bounce-guard.ts:38-50` |
| Webhook: reply, bounce, unsub, campaign_complete | ✅ | `webhooks/instantly/route.ts:106-231` |
| Reply classification (6 interest levels) | ✅ | `pipeline-tools.ts` (classify_reply) |
| Variant-to-lead attribution | ❌ | No code exists — blocks A/B optimization |
| Negative reply spike detection | ❌ | Bounce guard only, no reply quality guard |

### Layer 2: Correlation — `correlator.ts`

| Capability | Status | File:Line |
|---|---|---|
| 6 dimension queries (signal, step, quality, enrichment, industry, word_count) | ✅ | `correlator.ts:67-200` |
| Minimum 5 sent per dimension filter | ✅ | `correlator.ts:48` |
| Campaign-specific and workspace-wide scoping | ✅ | `correlator.ts:18-23` |
| Subject variant correlation | ❌ | Not implemented — blocked by attribution |
| Subject pattern correlation | ❌ | Not implemented — no `subjectPattern` metadata |
| **Positive reply rate** (vs raw reply count) | ❌ | Uses `ep."replyCount" > 0`, ignores reply classification |

### Layer 3: Insights — `insights.ts`

| Capability | Status | File:Line |
|---|---|---|
| Workspace-level insights (6 dimensions) | ✅ | `insights.ts:59-85` |
| Campaign report (overview + steps + top leads + insights) | ✅ | `insights.ts:121-187` |
| Confidence levels (high/medium/low) | ✅ | `insights.ts:20-24` |
| Recommendation text per dimension | ✅ | `insights.ts:41-47` |
| Industry benchmark comparison | ❌ | Not implemented — no context for "is 6% good?" |
| Variant breakdown per step | ❌ | Not implemented — blocked by attribution |
| Negative reply reporting | ❌ | Not tracked |

### Layer 4: Adaptive Drafting — `adaptive.ts` + `style-learner.ts` + `prompt-builder.ts`

| Capability | Status | File:Line |
|---|---|---|
| Data-driven signal weights (0-10 normalized) | ✅ | `adaptive.ts:13-32` |
| Step performance annotations (best/worst) | ✅ | `adaptive.ts:38-58` |
| Winning pattern extraction (signal+framework+wordcount+enrichment) | ✅ | `style-learner.ts:46-114` |
| Style corrections capture | ✅ | `style-learner.ts:7-22` |
| Signal weights injected into drafting prompt | ✅ | `prompt-builder.ts:181,466` |
| Step annotation injected into drafting prompt | ✅ | `prompt-builder.ts:548` |
| Winning patterns injected into drafting prompt | ✅ | `prompt-builder.ts:547` |
| Adaptive data loaded in batch AND single draft paths | ✅ | `email-tools.ts:96-99,344-348` |
| Style correction categorization (subject vs tone vs CTA) | ❌ | `contentType` stored but not auto-categorized |
| Subject variant/pattern in winning patterns | ❌ | Ignores which subject drove the reply |
| CampaignAngle auto-update from performance | ❌ | Generated once, never updated |
| ICP refinement from reply data | ❌ | ICP feedback exists for scoring, not for reply-driven targeting |

---

## STRATEGY Target

### §6.2 (original audit, was 1.5/10):
> "Zero integration avec les stats Instantly" → **FIXED** (data sync complete)
> "Pas de distillation des corrections en profil de style" → **NOT FIXED** (raw examples, no profile)
> "Pas de categorisation (correction de subject vs tone vs CTA)" → **NOT FIXED**
> "Pas de propagation des 'winners' d'A/B tests" → **NOT FIXED** (pattern propagation works for signal/framework, NOT for subject variants)
> "CampaignAngle genere une fois et jamais mis a jour" → **NOT FIXED**

### §7.3.2 (Feedback loop avec stats Instantly):
> "Open rate par subject line → identifier les patterns gagnants" → **PARTIALLY** (open rate tracked per step, not per variant/pattern)
> "Reply rate par segment → identifier les angles qui marchent" → **DONE** (6 dimensions)
> "Auto-pause des variantes faibles" → **NOT DONE** (bounce guard exists, variant auto-pause doesn't)
> "Suggerer des ajustements au CampaignAngle" → **NOT DONE**

### §7.3.4 (Style learner avancé):
> "Distiller les corrections en profil de style (pas juste 5 raw examples)" → **NOT DONE**
> "Categoriser: correction de subject vs tone vs structure vs CTA" → **NOT DONE**
> "Learning par persona (corrections sur C-Level ≠ corrections sur Tech)" → **NOT DONE**
> "Propagation cross-campagne" → **PARTIALLY** (winning patterns propagate, style corrections don't categorize)

### §11.5 Phase 7 — Learning Loop:
> "Identification des patterns gagnants" → **DONE** (getWinningEmailPatterns)
> "Analytics croisees par segment, industrie, taille, role" → **PARTIALLY** (industry yes, size/role no)
> "Suggestions d'ajustement ICP" → **NOT DONE**
> "Propagation des learnings aux prochaines campagnes" → **PARTIALLY** (signal weights propagate, subject patterns don't)

---

## Research Best Practice

### RESEARCH-FEEDBACK-LOOPS-2026 Cross-Reference

| Gap | Research ID | Status in LeadSens | Impact | Effort |
|---|---|---|---|---|
| Positive reply rate as primary metric | FL-1 | ❌ Uses raw replyCount > 0 | HIGH | 1 day |
| Variant → lead tracking | FL-2 | ❌ Not implemented | HIGH (blocks all A/B) | 2-3 days |
| Auto-pause on negative reply spikes | FL-3 | ❌ Only bounce guard | HIGH | 1 day |
| Thompson Sampling for variants | FL-4 | ❌ Future | MEDIUM | 2-3 days |
| Style learner categorized | FL-5 | ❌ Raw corrections only | MEDIUM | 1-2 days |
| Industry benchmarks in reporting | FL-6 | ❌ No context | MEDIUM | 0.5 day |
| Practical low-volume decision rules | FL-7 | ❌ No min sample rules | MEDIUM | 1 day |
| Benjamini-Hochberg for 3+ variants | FL-8 | ❌ Future | LOW | 0.5 day |
| Contextual bandits (per-segment learning) | FL-9 | ❌ Future | LOW | 3-5 days |
| Confirmation testing before propagation | FL-10 | ❌ Future | LOW | 1 day |

### Competitor Comparison

| Capability | Instantly Native | AiSDR | Smartlead | **LeadSens** |
|---|---|---|---|---|
| Data sync from ESP | ✅ Built-in | ❌ | ✅ Built-in | **✅ 30-min worker** |
| Multi-dimension correlation | ❌ | ❌ | ❌ | **✅ 6 dimensions** |
| Adaptive drafting weights | ❌ | ❌ "self-improving" (opaque) | ❌ | **✅ Data-driven** |
| Winning pattern extraction | ❌ | ❌ | ❌ | **✅** |
| Positive reply rate metric | ❌ (all replies) | Unknown | ❌ | **❌ (all replies)** |
| Negative reply guardrail | ❌ | ❌ | ❌ | **❌** |
| Multi-armed bandit | ❌ | ❌ | **✅** | ❌ |
| Contextual bandits | ❌ | ❌ | **✅** | ❌ |
| Style correction learning | ❌ | ❌ | ❌ | **✅ (uncategorized)** |

**Key insight**: LeadSens has the **most transparent and structured** feedback loop of any platform at this price point. The 6-dimension correlator with adaptive weights is genuinely unique. But the data quality is compromised by counting ALL replies (including "stop emailing me") as positive signals, and the style learner is underutilized.

---

## Gap Analysis

### Gap 1: Wrong Primary Metric — Raw Reply Count vs Positive Reply Rate (HIGH)

The entire correlation + insights + adaptive layer is built on a flawed foundation: `ep."replyCount" > 0` counts ALL replies including negative ones. LeadSens already classifies replies into 6 interest levels via `classify_reply` (Mistral Small). This classification is stored in `Reply.aiInterest` / `EmailPerformance.replyAiInterest`. But the correlator NEVER uses this data.

**Concrete impact**: A provocative subject line that generates "stop emailing me" replies would appear as the top performer. An aggressive CTA that triggers low-quality "send me info" responses gets inflated weight. Data-driven signal weights from `getDataDrivenWeights()` could amplify the wrong signals.

Research (Outbound System): "Positive reply rate is the primary metric." LeadSens has ALL the data needed (reply classification exists) but doesn't connect it.

### Gap 2: No Negative Reply Spike Guard (HIGH)

`bounce-guard.ts` monitors bounce rate and auto-pauses campaigns. But there's no equivalent for negative reply spikes. If 5 leads reply "stop emailing me" or "reported as spam" within 24 hours, the campaign continues sending.

Research (Enginy AI): "If a variant increases complaints or bounces, stop immediately even if KPI goes up."

### Gap 3: Style Learner Captures But Doesn't Categorize (MEDIUM)

`captureStyleCorrection()` stores `contentType` as free-text metadata. `getStyleSamples()` retrieves all corrections without filtering. The system can't distinguish "user always changes my subject lines to be shorter" from "user always changes my CTA to be less aggressive."

STRATEGY §7.3.4 explicitly requires categorization. Research FL-5 validates.

### Gap 4: Winning Patterns Blind to Subject Information (MEDIUM)

`getWinningEmailPatterns()` at `style-learner.ts:92-97` builds pattern keys from `signalType + bodyWordCount + frameworkName + enrichmentDepth`. Subject line variant and subject pattern (Question/Observation/etc.) are completely ignored. The system can identify "leadership_change signal + 62 words + PAS framework gets replies" but never "Question-type subjects outperform Direct-type."

Research §7: "Winning PATTERNS propagate better than winning COPY."

### Gap 5: No Industry Benchmarks (MEDIUM)

`insights.ts` compares dimensions internally but never against benchmarks. A 6% reply rate in SaaS is below the 8-12% benchmark — the system never tells the user this.

Already in BACKLOG as RES-04. Not duplicated here.

### Gap 6: Analytics Sync Code Duplicated (LOW)

The analytics sync logic exists in TWO places:
- `analytics-sync-worker.ts:19-117` (BullMQ worker for background sync)
- `analytics-tools.ts:16-124` (agent tool for on-demand sync)

Both have identical upsert logic for campaign analytics, step analytics, and lead performance. Copy-paste DRY violation — a bug fix in one won't automatically apply to the other.

### Gap 7: No CampaignAngle Performance Update (LOW)

`Campaign.angle` is generated once at creation and never updated. The insights system can identify that "funding signals get 15% reply rate in this campaign" but this learning never feeds back to update the angle for future campaigns. STRATEGY §7.3.2: "Suggerer des ajustements au CampaignAngle."

### Gap 8: No ICP Refinement from Reply Data (LOW)

ICP feedback exists for scoring phase (alert when >70% leads eliminated). But no feedback from reply data to ICP refinement. STRATEGY §11.5 Phase 7: "85% des reponses viennent de startups 50-200 employes. Affiner le ciblage?" The correlator has reply rate by industry — this could drive ICP suggestions.

### Gap 9: Zero Tests for Feedback Loop Components (MEDIUM)

| Module | Lines | Tests |
|---|---|---|
| `correlator.ts` | 200 | 0 |
| `insights.ts` | 187 | 0 |
| `adaptive.ts` | 58 | 0 |
| `style-learner.ts` | 114 | 0 |
| `analytics-sync-worker.ts` | 117 | 0 |
| `analytics-tools.ts` | 194 | 0 |
| `bounce-guard.ts` | 172 | ✅ exists |

870 lines of feedback loop code with 0 tests. The correlator's SQL queries, confidence thresholds, rate calculations, normalization logic, and pattern extraction are all untested. A regression in the `toCorrelationRows()` filter (minimum 5 sent) or the `getDataDrivenWeights()` normalization would go undetected.

---

## Issues

### ISSUE 1 — Correlator uses raw reply count, not positive reply rate (HIGH)

**Files:** `src/server/lib/analytics/correlator.ts:75,94,116,141,157,183` (all 6 queries)
**Severity:** HIGH
**Impact:** All correlation data, adaptive weights, and winning patterns are polluted by negative replies. A confrontational subject that generates "stop" replies gets counted as a winner. This is the foundation of the entire feedback loop — if the metric is wrong, every downstream decision is wrong.
**Detail:** Each correlator query uses `SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END)`. The fix is to join with `EmailPerformance.replyAiInterest` and filter for positive interest (`replyAiInterest >= 5` or join with `Reply` where `aiInterest >= 5`). The data exists — `replyAiInterest Float?` is already on `EmailPerformance` (schema.prisma:331).

### ISSUE 2 — No negative reply spike guard (HIGH)

**Files:** None (feature doesn't exist). Should be in `src/server/lib/analytics/` alongside `bounce-guard.ts`.
**Severity:** HIGH
**Impact:** Campaign continues sending after multiple negative replies. Could lead to domain blacklisting from spam complaints.
**Detail:** Research FL-3, Enginy AI: "Stop immediately if complaints spike." The webhook handler already classifies `replyAiInterest` — when multiple low-interest replies arrive in a short window, the campaign should auto-pause. Thresholds: ≥3 negative replies (interest < 3) within 24 hours AND ≥20 sends total.

### ISSUE 3 — Style learner non-categorized (MEDIUM)

**Files:** `src/server/lib/email/style-learner.ts:7-22` (capture), `style-learner.ts:27-40` (retrieve)
**Severity:** MEDIUM
**Impact:** Cannot distinguish subject corrections from tone corrections. All corrections are injected equally into the drafting prompt, diluting their effectiveness.
**Detail:** `captureStyleCorrection()` accepts `contentType` parameter but callers pass generic values. `getStyleSamples()` has no category filter. Fix: auto-categorize based on heuristic (subject changed → subject, CTA changed → cta, body length significantly changed → length, tone words changed → tone), filter when injecting into prompt.

### ISSUE 4 — Winning patterns ignore subject variant/pattern (MEDIUM)

**Files:** `src/server/lib/email/style-learner.ts:92-97`
**Severity:** MEDIUM
**Impact:** Subject line optimization impossible via winning patterns. Cannot identify "Question-type subjects get 2x replies."
**Detail:** Pattern key construction at L92-97 uses `signalType`, `bodyWordCount`, `frameworkName`, `enrichmentDepth`. Never includes subject information. Blocked by: no `subjectPattern` metadata on DraftedEmail (RES-05 in BACKLOG).

### ISSUE 5 — Analytics sync code duplicated (LOW)

**Files:** `src/queue/analytics-sync-worker.ts:19-117` and `src/server/lib/tools/analytics-tools.ts:16-124`
**Severity:** LOW
**Impact:** Bug fix in one path doesn't apply to the other. Maintenance burden.
**Detail:** Both files have nearly identical code for: (1) fetch overall analytics → upsert Campaign, (2) fetch step analytics → upsert StepAnalytics, (3) paginate leads → upsert EmailPerformance. Should extract to a shared `syncCampaignData(apiKey, campaign)` function called by both.

### ISSUE 6 — Zero test coverage for feedback loop (MEDIUM)

**Files:** All analytics/ files + style-learner.ts
**Severity:** MEDIUM
**Impact:** 870 lines of code with SQL queries, rate calculations, normalization, confidence thresholds, and pattern extraction — zero tests. The correlator's minimum-5-sent filter, the insights confidence levels, the adaptive weights normalization, and the winning pattern extraction are all untested.
**Detail:** Only `bounce-guard.test.ts` exists (pure function `shouldPauseCampaign()`). Missing: correlator queries (with mock DB or query structure tests), insights confidence thresholds, adaptive weights normalization edge cases, style learner capture/retrieve, winning pattern extraction logic.

### ISSUE 7 — getDataDrivenWeights threshold delays early campaigns (LOW)

**Files:** `src/server/lib/analytics/adaptive.ts:19`
**Severity:** LOW
**Impact:** First campaign with ~100 leads may not activate adaptive weights because `sent >= 20` per signal type + `< 2 significant types` check. Conservative but delays the feedback loop.
**Detail:** Intentionally conservative. Could lower threshold to `sent >= 10` for early feedback, but risk of noisy weights. Current design is acceptable but worth noting.

### ISSUE 8 — CampaignAngle never updated from performance (LOW)

**Files:** `prisma/schema.prisma:212` (Campaign.angle), insights.ts, adaptive.ts
**Severity:** LOW
**Impact:** Learnings from one campaign don't systematically improve the next campaign's angle. STRATEGY §7.3.2.
**Detail:** The agent could manually apply insights, but there's no automated mechanism.

---

## Score Justification: 5/10

| Dimension | Score | Notes |
|---|---|---|
| Data sync (Layer 1) | 7/10 | Worker + webhook + bounce guard. Missing: variant attribution, negative reply guard |
| Correlation (Layer 2) | 6/10 | 6 dimensions, well-structured. Wrong primary metric (raw replies). Missing: variant, pattern |
| Insights (Layer 3) | 5/10 | Workspace + campaign reports. Missing: benchmarks, variant breakdown |
| Adaptive drafting (Layer 4) | 6/10 | Signal weights + step annotations + winning patterns. Missing: style categorization |
| Style learning | 3/10 | Captures corrections. No categorization, no distillation, no persona learning |
| Test coverage | 1/10 | Only bounce-guard tested. 870 lines with 0 tests |
| **Overall** | **5/10** | Architecture is excellent. Data quality and coverage are the gaps |

### Path to 6/10:
- Fix FL-1: Correlator uses positive reply rate → +0.5
- Add FL-3: Negative reply guard → +0.3
- Add basic tests (correlator, insights) → +0.2

### Path to 7/10:
- Above + FL-5: Style learner categorized → +0.3
- Above + RES-04: Industry benchmarks → +0.2
- Above + Extract shared sync logic (DRY) → +0.1
- Above + FL-7: Low-volume decision rules in insights → +0.4

### Path to 8/10 (competitive moat):
- Above + FL-2/AB-ATTR-01: Variant attribution (unblocks all A/B) → +0.3
- Above + RES-05: Subject pattern tracking → +0.2
- Above + FL-4: Thompson Sampling → +0.3
- Above + CampaignAngle auto-update → +0.2

---

## Recommended Tasks

### New tasks (not already in BACKLOG):

1. **FL-METRIC-01** Correlator uses positive reply rate instead of raw reply count **(HIGH — 2h)**
   **Fichiers:** `src/server/lib/analytics/correlator.ts`, `src/server/lib/email/style-learner.ts`
   **Réf:** RESEARCH-FEEDBACK-LOOPS §FL-1, audit-feedback-loop.md ISSUE 1
   **Impact:** Fixes the primary metric of the entire feedback loop. All 6 correlator queries, adaptive weights, winning patterns, and insights are currently polluted by negative replies.
   **PASS IF:**
   - All 6 correlator queries replace `ep."replyCount" > 0` with a join that considers `ep."replyAiInterest"` — only count as reply if `replyAiInterest IS NULL OR replyAiInterest >= 5` (positive or unclassified)
   - `getWinningEmailPatterns()` also uses positive-only filter (join EmailPerformance.replyAiInterest)
   - Backward compatible: leads with no reply classification (replyAiInterest IS NULL) still count as replies (graceful degradation)
   - Test unitaire: query with positive + negative replies returns only positive in reply rate
   - `pnpm typecheck && pnpm test` passent

2. **FL-GUARD-01** Negative reply spike auto-pause **(HIGH — 2h)**
   **Fichiers:** `src/server/lib/analytics/reply-guard.ts` (NEW), `src/app/api/webhooks/instantly/route.ts`
   **Réf:** RESEARCH-FEEDBACK-LOOPS §FL-3, Enginy AI, audit-feedback-loop.md ISSUE 2
   **Impact:** Protects domain reputation from spam complaint cascades. Complements existing bounce-guard.
   **PASS IF:**
   - Pure function: `shouldPauseOnNegativeReplies(totalSends, negativeReplyCount24h) → { shouldPause, rate }`
   - Threshold: ≥3 negative replies (replyAiInterest < 3) within 24h AND ≥20 total sends
   - `checkAndPauseOnReplies(campaignId)` — counts negative replies in last 24h, auto-pauses via Instantly API
   - Called from webhook handler after reply_received event IF `ai_interest_value < 3`
   - Stores notification in conversation (same pattern as bounce-guard)
   - Test unitaire for pure function (below threshold, at threshold, above threshold)
   - `pnpm typecheck && pnpm test` passent

3. **FL-DRY-01** Extract shared analytics sync logic **(LOW — 1h)**
   **Fichiers:** `src/server/lib/analytics/sync.ts` (NEW), `src/queue/analytics-sync-worker.ts`, `src/server/lib/tools/analytics-tools.ts`
   **Réf:** audit-feedback-loop.md ISSUE 5
   **Impact:** Eliminates copy-paste between worker and tool. Bug fixes apply to both paths.
   **PASS IF:**
   - `syncCampaignAnalytics(apiKey, campaignId, instantlyCampaignId)` extracted to `analytics/sync.ts`
   - Both `analytics-sync-worker.ts` and `analytics-tools.ts:sync_campaign_analytics` call the shared function
   - No logic duplication between the two callers
   - `pnpm typecheck && pnpm test` passent

4. **FL-TEST-01** Unit tests for feedback loop components **(MEDIUM — 3h)**
   **Fichiers:** `tests/feedback-loop.test.ts` (NEW)
   **Réf:** audit-feedback-loop.md ISSUE 6
   **Impact:** 870 lines of untested feedback loop code. SQL query correctness, rate calculations, normalization, confidence thresholds, and pattern extraction are all unguarded.
   **PASS IF:**
   - Test `toCorrelationRows()` — filters rows with < 5 sent, computes correct rates
   - Test `buildInsight()` — minimum 2 rows + 20 total sent, correct top/bottom identification, confidence levels
   - Test `getDataDrivenWeights()` — normalization to 0-10 scale, null if < 2 significant types
   - Test `getStepAnnotation()` — null if < 50 sent, correct isTop determination
   - Test `getWinningEmailPatterns()` — correct pattern key construction, frequency sorting, top 3 limit
   - Test `captureStyleCorrection()` + `getStyleSamples()` — roundtrip with mock DB
   - Minimum 20 tests
   - `pnpm typecheck && pnpm test` passent

### Already in BACKLOG (validated by this audit):

- **RES-04** Industry benchmarks in reporting (MEDIUM) — Confirmed gap. Exact match with ISSUE 4 / FL-6.
- **RES-05** Subject pattern tracking (MEDIUM) — Confirmed gap. Blocks winning pattern subject awareness (ISSUE 4).
- **RES-06** A/B auto-pause with z-test (MEDIUM) — Validated. Note: RESEARCH-FEEDBACK-LOOPS recommends Thompson Sampling over z-test for cold email volume. Consider upgrading to MAB in the future.
- **RES-07** Style learner categorized (MEDIUM) — Exact match with ISSUE 3 / FL-5. Already well-specified.
- **AB-ATTR-01** Variant-to-lead attribution (CRITICAL) — Confirmed #1 A/B blocker. Also blocks subject variant in winning patterns.
- **T3-QUAL-03** Style learner avancé — Overlaps with RES-07. RES-07 is better specified.

### Dependency Chain

```
FL-METRIC-01 (positive reply rate)      ← Foundational, blocks nothing but fixes ALL downstream data
    └── Improves: getDataDrivenWeights(), getWinningEmailPatterns(), all insights

FL-GUARD-01 (negative reply guard)      ← Independent, implements alongside bounce-guard

RES-07 (style categorization)           ← Independent, no data dependencies

RES-05 (subject pattern tracking)       ← Blocks winning pattern subject awareness
    └── Enhances: getWinningEmailPatterns() subject dimension

AB-ATTR-01 (variant attribution)        ← Blocks A/B correlator + reports (from A/B audit)

FL-DRY-01 (extract sync logic)          ← Independent refactor

FL-TEST-01 (tests)                      ← Should follow FL-METRIC-01 (test the correct metric)
```

---

## Architectural Assessment

The feedback loop architecture is **genuinely ahead of competitors**. No other platform at this price point ($49-149/mo) offers:
- 6-dimension correlation with workspace and campaign scoping
- Data-driven signal weight adaptation
- Step performance annotations
- Winning pattern extraction and injection into drafting
- Bounce guard with auto-pause

The **fundamental design is correct**. The gaps are not architectural — they're data quality (wrong metric), coverage (missing dimensions), and refinement (no categorization). The path from 5/10 to 7/10 is achievable with 3-4 focused tasks. The path to 8/10 requires the A/B attribution work (AB-ATTR-01) which is already in the backlog.

### Research Validation

RESEARCH-FEEDBACK-LOOPS-2026 recommends Thompson Sampling (MAB) over frequentist z-test for cold email A/B testing due to low base rates. At 1-5% reply rate, traditional A/B testing requires 5,000-28,000 sends per variant for statistical significance — far more than typical LeadSens campaigns (100-5,000 leads). MAB is a Phase 4 enhancement that should replace the z-test approach if/when it's implemented.

For now, the practical decision rules from Outbound System (1,000+ delivered OR 30-50 replies, 30%+ lift, 2 consecutive batches) are the right MVP approach.
