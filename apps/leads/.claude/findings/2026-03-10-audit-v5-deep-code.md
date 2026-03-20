# Audit v5 — Deep Code Review | 2026-03-10

## Scope
Full codebase audit: 180 .ts/.tsx files, 36 test files, 619 tests. All 8 STRATEGY components audited against code, research docs, and previous findings.

## Technical Health
- Typecheck: CLEAN
- Tests: 619/619 pass
- `as any`: 6 (SDK boundaries, justified)
- `console.log`: 2 (down from 47 at v3)
- Critical untested code: 2,623 lines (instantly.ts, pipeline-tools, email-tools)

## Score: 6.9/10 (unchanged)

| Component | Score | Target | Status |
|-----------|-------|--------|--------|
| Enrichment | 7.5 | 6 | EXCEEDED |
| ICP Scoring | 7 | 7 | MET |
| Copywriting | 8 | 8 | MET |
| Subject Lines | 6 | 6 | MET |
| A/B Testing | 5 | 5 | MET |
| Cadence | 7.5 | 7 | EXCEEDED |
| Feedback Loop | 5.5 | 5 | EXCEEDED |
| Pipeline | 7 | 5 | EXCEEDED |

---

## CRITICAL Issues (3)

### C1. PIPE-METRIC-01 — pipeline-tools.ts uses raw replyCount
**Location:** `src/server/lib/tools/pipeline-tools.ts` lines 610, 614, 618, 637
**Problem:** `campaign_insights` tool and `buildInsightSuggestions()` use `replyCount > 0` instead of `isPositiveReply()`. This violates the CLAUDE.md convention. Agent sees inflated reply rates (includes "stop emailing me") from this tool but accurate rates from correlator tools. The inconsistency causes bad agent decisions.
**Fix:** Replace with positive reply filter. Import from correlator.

### C2. ROUTE-STEPS-01 — maxSteps: 15 vs convention of 5
**Location:** `src/app/api/agents/chat/route.ts` line 698
**Problem:** CLAUDE.md §5 says "Max 5 steps per message." Code allows 15. A confused LLM can spiral through 15 tool calls burning ~$0.15+ per message.
**Fix:** Change to `maxSteps: 5`.

### C3. WEBHOOK-ATTR-01 — reply_received overwrites variantIndex
**Location:** `src/app/api/webhooks/instantly/route.ts` line 143
**Problem:** `email_sent` handler (line 268) has `variantIndex: { not: null }` guard. `reply_received` does not. Repeated replies overwrite the original send-based variantIndex, corrupting A/B attribution.
**Fix:** Add same null-guard pattern.

---

## HIGH Issues (7)

### H1. ROUTE-PHASE-01 — MONITORING phantom phase
`CampaignPhase` includes "MONITORING" but no prompt case and no tool set. Falls to DISCOVERY prompt + minimal tools.

### H2. ANALYTICS-ESP-01 — sync hardcoded to Instantly
`sync_campaign_analytics` directly queries INSTANTLY integration, bypassing ESPProvider. Non-Instantly users get silent failure.

### H3. INSIGHTS-METRIC-01 — Overview includes negative replies
`getCampaignReport` overview uses StepAnalytics.replied (all replies) while correlator uses positive-only. Inconsistent metrics.

### H4. PROMPT-TRUNC-01 — 500 char truncation on previous emails
`buildPreviousEmailsSection()` truncates at 500 chars. STRATEGY §7.2.3 requires full body. Signal-stacked Step 0 emails get cut.

### H5. SUBJ-CONSISTENCY-01 — Subject constraint in 3 places, 3 values
drafting.ts: "2-4 words", prompt-builder.ts: "2-4 words", quality-gate.ts: max 5 words. LLM sees conflicting instructions.

### H6. CORR-CAMPAIGN-01 — Cross-campaign contamination in correlator
`getReplyRateBySubjectPattern` joins lead.performance across ALL campaigns. Thompson Sampling gets noisy data.

### H7. SOURCE-TIMEOUT-01 — No polling timeout in source_leads
Instantly enrichment job hang → polls until Vercel 300s timeout → generic error.

---

## MEDIUM Issues (12)

| ID | Issue | Location |
|----|-------|----------|
| M1 | N+1 DB writes in batch operations | enrichment-tools.ts |
| M2 | Style category filter not wired to callers | email-tools.ts |
| M3 | findRelevantCaseStudy null access | prompt-builder.ts |
| M4 | classify_reply stale-status chain | pipeline-tools.ts |
| M5 | draft_reply no DB footprint | pipeline-tools.ts |
| M6 | reply_to_email empty fromEmail | pipeline-tools.ts |
| M7 | CSV import no auto-enrichment | pipeline-tools.ts |
| M8 | Duplicate guard notifications | bounce/reply-guard.ts |
| M9 | Webhook reply no dedup check | route.ts |
| M10 | Misleading per-pattern reply rate | style-learner.ts |
| M11 | Hardcoded delays in preview | esp-tools.ts |
| M12 | No concurrent scrape guard | company-cache.ts |

---

## Email Pipeline Deep Dive

### prompt-builder.ts (639 lines)
**Strengths:** 6-step frameworks hardcoded, signal prioritization with recency + data-driven weights, connection bridge with BAD/GOOD example, vertical mismatch detection, CTA commitment scaling.
**Gaps:** 500-char truncation (H4), findRelevantCaseStudy null-access (M3), no test for Thompson ranking branch or vertical mismatch branch.

### drafting.ts (125 lines)
**Strengths:** High-quality system prompt with persona adaptation, banned phrases, timeline hooks.
**Gaps:** No quality gate in raw `draftEmail()` — callers must use `draftWithQualityGate()`. Subject constraint inconsistency (H5). No test for system prompt content.

### quality-gate.ts (224 lines)
**Strengths:** 5-layer deterministic pre-scan (spam → word count → subject → filler → AI tell), step-aware threshold (Step 0 = 8/10), clean Zod schema.
**Gaps:** No test for tied-score path when all retries return same score. `scoreEmail()` exported and callable directly (bypasses retry loop).

### style-learner.ts (170 lines)
**Strengths:** detectCategory() auto-classifies, getWinningEmailPatterns() uses positive replies.
**Gaps:** Category filter never used by callers (M2). "general" category is dead code (always falls to "tone"). Zero tests.

### ai-tell-scanner.ts (132 lines)
**Strengths:** Pure function, 3-check system, consistent with spam-words/filler-phrases pattern. Well-tested (18 tests).
**Gaps:** No em-dash detection (common Mistral tell). No null body guard.

---

## Enrichment & Scoring Deep Dive

### icp-scorer.ts (299 lines)
**Strengths:** Compound bonus, recency weighting, pure `computeSignalBoost()`, excellent test coverage (33 tests).
**Gaps:** Null-ed path returns `combinedScore: fitScore` which doesn't match the formula. `recentNews` not recency-weighted. `productLaunches` are string[] (no recency).

### company-cache.ts (69 lines)
**Strengths:** Dual TTL (1h null / 7d success), workspace scoping, idempotent upsert.
**Gaps:** No concurrent request guard (M12). No `www.` normalization on domain extraction.

### jina.ts (121 lines)
**Strengths:** Structured error returns, per-request timeout, 3.4s rate limit.
**Gaps:** 15K char naive truncation (homepage takes all budget), no retry on 429, no tests.

### enrichment-tools.ts (922 lines)
**Strengths:** 3-layer fallback, non-blocking failures, ICP feedback loop, Apollo rate limit pre-check.
**Gaps:** Sequential processing (no parallelism), N+1 DB writes (M1), ZERO tests.

---

## Analytics & Webhook Deep Dive

### correlator.ts (511 lines)
**Strengths:** 6 dimensions, positive reply filtering via POSITIVE_REPLY_SQL, pure helper functions well-tested.
**Gaps:** `getReplyRateBySubjectVariant` duplicates POSITIVE_REPLY_SQL inline. Cross-campaign contamination in subject pattern query (H6).

### webhook route.ts (430 lines)
**Strengths:** 11 event types, HMAC auth, Zod discriminatedUnion, variant attribution on send events.
**Gaps:** reply_received overwrites variantIndex (C3), no webhook dedup (M9), safeTransition catch swallows errors silently.

### sync.ts (137 lines)
**Strengths:** Shared between cron and tool (DRY).
**Gaps:** N+1 DB queries per lead, syncVariantAttribution re-runs full pagination on every 30-min cron.

---

## Route & Tools Deep Dive

### chat/route.ts (789 lines)
**Strengths:** Phase-aware prompts (58% token savings), tool filtering by phase, SSE streaming, context management.
**Gaps:** maxSteps: 15 (C2), MONITORING phantom (H1), autonomyLevel type gap, icpDescription in every system prompt.

### pipeline-tools.ts (711 lines)
**Strengths:** Reply classification, draft+send, CSV import, insight suggestions.
**Gaps:** Raw replyCount (C1), stale-status chain (M4), no draft DB footprint (M5), empty fromEmail (M6), zero tests.

---

## What Changed Since v4+ Audit
- ENR-RECENCY-01: Signal recency weighting (new)
- SUBJ-NUM-01: Numbers in subject patterns (new)
- WEBHOOK-EXPAND-01: 11 webhook events (new)
- SCORE-STACK-01: Compound signal bonus (new)
- PROMPT-BRIDGE-01: Signal→pain reasoning (new)
- console.log: 47 → 2 (major cleanup happened)
- Tests: stable at 619/619

## Conclusion
All 8 component targets met or exceeded. The codebase is functionally complete for V1 launch. The 3 CRITICAL issues are data correctness bugs that are quick to fix (~30 min total). The path from 6.9 to 8.0 requires ~15h of focused engineering, primarily fixing correctness issues (C1-C3, H1-H7) and adding test coverage for the 2,623 lines of untested critical code.
