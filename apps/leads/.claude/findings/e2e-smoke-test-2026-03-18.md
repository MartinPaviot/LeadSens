# E2E Smoke Test — 2026-03-18

> ICP: "Head of Marketing at ecommerce companies in Germany, 20-100 employees"
> Mode: Supervised | Instantly connected | Mistral Large + Small

## Pipeline Results (Browser E2E + Tool-Level Verification)

| # | Step | Result | Time | Evidence |
|---|------|--------|------|----------|
| 1 | ICP Parse → filters | **PASS** | 2.5s | Role: Head of Marketing, Industry: Retail + Software & Internet, Size: 0-25/25-100, Geo: Germany |
| 2 | Count leads | **PASS** | 6.4s | 489 leads available |
| 3 | Preview (5 leads) | **PASS** | ~3s | Lead table with LinkedIn links rendered |
| 4 | Source 47 leads | **PASS** | 3m12s | Auto-confirm on "yes" → no confirmation loop. 47 real emails. |
| 5 | Score 47 leads | **PASS** | 1m57s | 43 scored 8/10, 4 scored 7/10. Zero skipped. |
| 6 | Enrich 3 leads | **PASS** | ~5min | Jina scrape 3 websites. All 3 → ENRICHED (even with Apify LinkedIn errors). |
| 7 | Draft email (Step 0) | **PASS** | 51s | Subject: "wiredminds' outbound pipeline". Quality: 9/10. Body references real company data. |
| 8 | Email preview card | **PASS** | — | `__component: "email-preview"` returned with qualityScore, signalType, body. |
| 9 | DB persistence | **PASS** | — | DraftedEmail record in DB with all metadata. |

## Confirmation Loop Fix — VERIFIED

`[auto-confirm] Executed source_leads directly (user said: "yes")` — server log proof.
No re-parsing, no infinite loop. Pipeline flows from source → score → enrich → draft.

## Bugs Found & Fixed (Total: 9)

| # | Bug | Impact | Fix |
|---|-----|--------|-----|
| 1 | Confirmation loop (original target) | Pipeline broken | Auto-execute confirmed tools server-side |
| 2 | Missing `conversationId` in auto-exec | Downstream tools can't resolve campaign | Added to context |
| 3 | `score_leads_batch` missing from ENRICHING phase | Scoring blocked after status change | Added to phase tools |
| 4 | Vague injection messages post auto-exec | Mistral wasted steps re-parsing | Explicit instructions + tool removal |
| 5 | `draft_single_email` step type mismatch | `"0"` (string) vs `0` (number) | `z.coerce.number()` |
| 6 | `draft_emails_batch` requires lead_ids | Mistral can't guess IDs from compressed context | Auto-select top N from DB |
| 7 | Quality gate float→int crash | `7.5` fails `.int()` check | `.transform(Math.round)` |
| 8 | Redis crash without REDIS_URL | Enrichment + drafting crash | Graceful degradation in cache.ts |
| 9 | Enrichment rejects SOURCED leads | Can't skip scoring | Accept SOURCED + SCORED + ENRICHED |

## Files Changed (9 total)

| File | Lines | Key Change |
|------|-------|-----------|
| `mistral-client.ts` | +1 | `__saved_args` in confirmation output |
| `route.ts` | ~150 | Auto-confirm engine, auto-continue loop (3 turns), tool filtering |
| `context-manager.ts` | +20 | `stripAllMarkers()`, strip all marker types in Level 1 |
| `assistant-message.tsx` | +3 | Strip `@@PENDING_CONFIRM@@` from display |
| `email-tools.ts` | ~40 | `z.coerce`, `__component` in draft_single, auto-select in batch, logger |
| `enrichment-tools.ts` | +3 | Accept SOURCED leads |
| `index.ts` | +1 | `score_leads_batch` in ENRICHING phase |
| `quality-gate.ts` | +2 | `.transform(Math.round)` for LLM float scores |
| `redis.ts` + `cache.ts` | +30 | Graceful degradation without Redis |

## Email Quality Check

```
Lead: Marina Libal @ Wiredminds (Head of Marketing)
Step 0 (PAS) | Quality: 9/10 | Framework: PAS Timeline Hook

Subject: wiredminds' outbound pipeline

Body:
Marina,

Since Wiredminds serves retail SaaS, outbound pipeline pressure is real —
especially when leads dry up mid-quarter.

ElevenLabs went from 5% to 30% of pipeline from outbound in 3 months.
Same stack, same ICP, just better data and multichannel automation.

Worth a quick look?
```

- References real company name (Wiredminds) and industry (retail SaaS)
- Uses PAS framework (Problem: pipeline pressure → Agitate: leads dry up → Solution: proof point)
- Concise (under 85 words, step 0 target)
- Social proof (ElevenLabs case study)
- Low-commitment CTA
- No generic filler, no AI tells

## Compute Timing

| Step | Time | Per-unit |
|------|------|----------|
| ICP Parse | 2.5s | — |
| Count + Preview | ~10s | — |
| Source 47 leads | 3m12s | ~4s/lead (Instantly API) |
| Score 47 leads | 1m57s | ~2.5s/lead (Mistral Small) |
| Enrich 3 leads | ~5min | ~1.7min/lead (Jina multi-page) |
| Draft 1 email | 51s | 51s/email (Mistral Large + quality gate) |
| **Total pipeline (47 leads → 1 email)** | **~12min** | — |

## Auto-Continue Feature

Implemented but not yet tested in browser (Playwright MCP disconnected). The feature:
- Detects when `finishReason === "length"` (5-step limit hit) with tool calls in progress
- Auto-injects continuation message and starts new chatStream turn
- Up to 3 auto-continues (15 total tool steps per user message)
- User sees "Continuing pipeline..." status
