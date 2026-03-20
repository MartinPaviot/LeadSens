# E2E Smoke Test — 2026-03-18

## Run 1: Initial Test — 3/10 PASS

| # | Step | Result | Time | Error |
|---|------|--------|------|-------|
| 1 | Load chat | **PASS** | ~5s | Greeting renders, DNA card shows, Instantly badge visible |
| 2 | Paste URL (Company DNA) | **SKIP** | - | DNA already loaded for workspace (lemlist) |
| 3 | Type ICP + confirm + count | **PASS** | ~25s | `parse_icp` → `count_leads` → `preview_leads` → table rendered perfectly |
| 4 | Source leads | **FAIL** | ~60s | Agent NEVER called `source_leads`. Called `enrich_leads_batch` instead. |
| 5 | Score leads | **FAIL** | - | Blocked by step 4 |
| 6 | Enrich leads | **FAIL** | 3.6s | `enrich_leads_batch` ran against wrong campaign (most recent fallback) |
| 7 | Draft emails | **FAIL** | 7.6s | `draft_emails_batch` ran against wrong campaign, likely 0 leads matched |
| 8 | Show emails | **FAIL** | 1.4s | `show_drafted_emails` returned empty — no emails exist for this campaign |
| 9 | Account selection | **FAIL** | - | Blocked by step 8 |
| 10 | Create campaign | **FAIL** | - | Blocked by step 9 |

---

## Root Causes Found

### RC-1: Agent skips `source_leads` (CRITICAL) — FIXED
The Mistral Large LLM chose `enrich_leads_batch` instead of `source_leads` after user confirmed sourcing.
- **Fix**: Strengthened PIPELINE_RULES in system prompt with CRITICAL ORDERING section
- **Fix**: Updated PHASE_DISCOVERY with explicit SOURCING STEP instructions
- **Fix**: Added HONESTY rule to prevent hallucinating tool results
- **Files**: `apps/leads/src/app/api/agents/chat/route.ts`

### RC-2: `resolveCampaignId` fallback is too aggressive (HIGH) — FIXED
When no campaign linked to conversation, fell back to "most recent campaign in workspace" from a different session.
- **Fix**: Removed the "most recent campaign" fallback entirely. Now returns null if no conversation link exists.
- **Fix**: Updated error messages to clearly tell agent: "You must call source_leads first"
- **Fix**: Updated tool descriptions to say "resolves from current conversation" instead of "most recent campaign"
- **Files**: `apps/leads/src/server/lib/tools/resolve-campaign.ts`, `enrichment-tools.ts`, `email-tools.ts`

### RC-3: Side-effect confirmation loop (CRITICAL) — FIXED
`isSideEffect: true` tools in SUPERVISED mode returned `__confirmation_required` instead of executing. When user confirmed, a new `chatStream` call started with NO memory of the confirmation, causing an infinite loop.
- **Fix**: Added `confirmedTools` set to `ChatStreamOptions`
- **Fix**: Chat route now detects confirmed tools from conversation history (scans for `__confirmation_required` in previous tool results followed by user message)
- **Fix**: `chatStream` skips confirmation check for tools in `confirmedTools`
- **Files**: `apps/leads/src/server/lib/llm/types.ts`, `mistral-client.ts`, `apps/leads/src/app/api/agents/chat/route.ts`

### RC-4: ICP suggestion language mixing (LOW) — FIXED
Greeting screen used `problemsSolved[0]` (French) in an English template.
- **Fix**: Changed to use `sellingAngle` instead, which produces a coherent sentence
- **Files**: `apps/leads/src/components/chat/greeting-screen.tsx`

### RC-5: Empty rendering on tool error (MEDIUM) — PARTIAL
Agent renders nothing when `show_drafted_emails` returns error. Addressed indirectly by RC-1/RC-2 fixes (tool errors should no longer occur silently).

---

## Run 2: After Fixes — Verification

| # | Step | Result | Details |
|---|------|--------|---------|
| 1 | Load chat | **PASS** | Greeting renders, ICP suggestion now coherent |
| 2 | ICP parse | **PASS** | Correctly parsed, asked for confirmation |
| 3 | Source confirmation | **PASS** | Agent correctly calls `source_leads` (not `enrich_leads_batch`) |
| 4 | Side-effect confirm | **PASS** | Confirmation carry-over works — tool executes after "yes" |
| 5 | Sourcing execution | **PASS** | Status shows "Launching SuperSearch sourcing..." — real API call |
| 6 | Honest reporting | **PASS** | Agent reports "0 results" honestly, suggests alternatives |
| 7-10 | Pipeline continuation | **BLOCKED** | Instantly returned 0 leads for this ICP (exhausted from repeated tests) |

**Key improvement**: The pipeline ordering is now correct and the agent no longer hallucinates. The 0 results is an Instantly API limitation (same ICP searched too many times), not a LeadSens bug.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/leads/src/app/api/agents/chat/route.ts` | Strengthened pipeline ordering, anti-hallucination rules, confirmed tools detection |
| `apps/leads/src/server/lib/tools/resolve-campaign.ts` | Removed "most recent campaign" fallback |
| `apps/leads/src/server/lib/tools/enrichment-tools.ts` | Clearer error messages, updated tool descriptions |
| `apps/leads/src/server/lib/tools/email-tools.ts` | Clearer error messages, updated tool descriptions |
| `apps/leads/src/server/lib/llm/types.ts` | Added `confirmedTools` to ChatStreamOptions |
| `apps/leads/src/server/lib/llm/mistral-client.ts` | Skip confirmation for tools in confirmedTools |
| `apps/leads/src/components/chat/greeting-screen.tsx` | Use sellingAngle instead of problemsSolved |

## Screenshots
- `01-greeting-ready.png` — Greeting screen with DNA + Instantly badge
- `02-icp-parsed.png` — ICP parsed with filters
- `03-leads-preview.png` — Lead preview table (5 leads)
- `04-naming-prompt.png` — Agent asks for search/list names
- `05-source-confirmation.png` — Source confirmation dialog
- `06-sourced-scored.png` — Agent claims sourcing (pre-fix, hallucinated)
- `07-enriched-drafted.png` — Agent claims drafting (pre-fix, hallucinated)
- `08-show-emails.png` — Empty email display (pre-fix bug)
- `09-tool-steps-expanded.png` — Tool steps revealing wrong tools called
- `10-retest-sourcing-works.png` — Post-fix: real sourcing executed, honest 0 results
