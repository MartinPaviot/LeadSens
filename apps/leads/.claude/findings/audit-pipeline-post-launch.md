# Audit: Pipeline Post-Launch — 2026-03-09

> Component: Post-Launch Pipeline (LeadStatus lifecycle, webhook, reply management, CRM handoff)
> STRATEGY Ref: §11 (pipeline complet), §12 (roadmap Phase 1 post-launch), §3.3 (curseur d'autonomie post-launch)
> Research Ref: RESEARCH-FEEDBACK-LOOPS-2026 (FL-3 negative reply guard), RESEARCH-DELIVERABILITY-2026 (D4 bounce guard)
> Score: **6/10** (target 5/10) — ✅ DÉPASSÉ but significant gaps remain
> Previous audit: 2026-03-09-audit-v2-with-research.md scored 6/10

---

## Current State

The post-launch pipeline is **functionally complete** for the core happy path: lead lifecycle from PUSHED → MEETING_BOOKED, webhook handling for 4 event types, reply classification + drafting + sending, CRM push, and campaign insights. This was a 0/10 component 48 hours ago — the velocity is impressive.

However, the implementation has **security gaps** (unauthenticated webhook), **data integrity issues** (race conditions between webhook and classify_reply, empty fromEmail/toEmail on replies), **missing lifecycle transitions** (no SENT transition), and **zero test coverage** across 815 lines of critical pipeline code.

### LeadStatus State Machine — `lead-status.ts`

| Capability | Status | File:Line |
|---|---|---|
| Pre-launch transitions (SOURCED→...→PUSHED) | ✅ | `lead-status.ts:12-15` |
| Post-launch transitions (PUSHED→SENT→REPLIED→...) | ✅ | `lead-status.ts:17-20` |
| BOUNCED/UNSUBSCRIBED from PUSHED+SENT | ✅ | `lead-status.ts:17-18` |
| MEETING_BOOKED from INTERESTED | ✅ | `lead-status.ts:20` |
| Batch transition with validation | ✅ | `lead-status.ts:54-83` |
| SENT transition trigger (who sets PUSHED→SENT?) | ❌ | No code sets leads to SENT |
| NOT_INTERESTED terminal transitions | ❌ | Dead end — no path forward |
| BOUNCED/UNSUBSCRIBED cleanup (remove from sequence) | ❌ | Status updated but no Instantly action |

### Webhook Endpoint — `webhooks/instantly/route.ts`

| Capability | Status | File:Line |
|---|---|---|
| 4 event types with Zod discriminated union | ✅ | `route.ts:54-59` |
| reply_received → EmailPerformance + ReplyThread + Reply | ✅ | `route.ts:107-167` |
| email_bounced → EmailPerformance + bounce-guard | ✅ | `route.ts:170-193` |
| lead_unsubscribed → EmailPerformance + status | ✅ | `route.ts:196-216` |
| campaign_completed → Campaign.status = ACTIVE | ✅ | `route.ts:219-230` |
| Webhook authentication (HMAC/secret) | ❌ | **Anyone can POST to this endpoint** |
| Auto-registration of webhook URL in Instantly | ❌ | Manual setup required |
| Rate limiting / replay protection | ❌ | No idempotency or timestamp validation |
| Unknown event graceful handling | ✅ | `route.ts:99-101` |

### Reply Management — `pipeline-tools.ts`

| Capability | Status | File:Line |
|---|---|---|
| classify_reply — 6 interest levels + meeting_intent | ✅ | `pipeline-tools.ts:117-233` |
| draft_reply — contextual with enrichment + CompanyDNA | ✅ | `pipeline-tools.ts:236-311` |
| reply_to_email — Instantly Unibox API | ✅ | `pipeline-tools.ts:314-379` |
| import_leads_csv — multi-format, dedup, field mapping | ✅ | `pipeline-tools.ts:382-491` |
| campaign_insights — segment analysis + suggestions | ✅ | `pipeline-tools.ts:494-637` |
| reply_to_email isSideEffect flag | ✅ | `pipeline-tools.ts:323` |
| classify_reply isSideEffect (it changes state!) | ❌ | Missing — transitions lead status without user confirmation |
| Reply.fromEmail/toEmail populated correctly | ❌ | Empty strings at `pipeline-tools.ts:199,365` |
| Classify→status race condition with webhook | ❌ | Both webhook and classify_reply transition PUSHED→REPLIED |

### CRM Tools — `crm-tools.ts`

| Capability | Status | File:Line |
|---|---|---|
| crm_check_duplicates (HubSpot search) | ✅ | `crm-tools.ts:9-36` |
| crm_create_contact (CRMProvider) | ✅ | `crm-tools.ts:38-89` |
| crm_create_deal (HubSpot direct API) | ✅ | `crm-tools.ts:91-176` |
| Contact dedup check (crmContactId) | ✅ | `crm-tools.ts:57-64` |
| Deal association with contact | ✅ | `crm-tools.ts:157-164` |
| isSideEffect on both CRM tools | ✅ | `crm-tools.ts:44,101` |
| crm_create_deal hardcodes HubSpot API | ⚠️ | `crm-tools.ts:118-164` — bypasses CRMProvider |
| Salesforce deal creation | ❌ | Not implemented (STRATEGY §12 Phase 2) |
| Enrichment data pushed to CRM | ❌ | Only basic fields (email, name, company, jobTitle, phone) |

### Phase/Tool Integration

| Capability | Status | File:Line |
|---|---|---|
| PHASE_ACTIVE prompt with reply management instructions | ✅ | `route.ts:116-150` |
| Tool filtering: reply tools in PUSHED+ACTIVE | ✅ | `tools/index.ts:94-123` |
| import_leads_csv always available | ✅ | `tools/index.ts:50` |
| performance_insights always available | ✅ | `tools/index.ts:49` |
| PHASE_MONITORING separate prompt | ❌ | Only PHASE_ACTIVE exists (STRATEGY §11.4 specifies both) |

---

## STRATEGY Target

### §11.2 — Extended Lead Lifecycle

> "SENT → REPLIED → INTERESTED → MEETING_BOOKED" — **DONE** (state machine)
> "Chaque transition post-launch déclenche une action agent" — **PARTIALLY** (classify triggers CRM suggestion in prompt, but no automated action on BOUNCED/UNSUBSCRIBED beyond status update)
> "OPENED n'est PAS un statut lead" — **DONE** (correct design decision)

### §11.3 — User Experience Phases

> "Phase 4: Monitoring" — **PARTIALLY** (analytics sync works, proactive insights in prompt, but no auto-triggered agent notifications)
> "Phase 5: Reply Management" — **DONE** (classify + draft + send)
> "Phase 6: Handoff" — **PARTIALLY** (CRM contact+deal works, but no "retrait de la séquence d'envoi" on INTERESTED)
> "Phase 7: Learning Loop" — Covered in feedback-loop audit

### §11.4 — Infrastructure

> "Webhook endpoint" — **DONE** (but unsecured)
> "Auto-registration via setup_webhooks au premier lancement" — **NOT DONE**
> "PHASE_MONITORING prompt tier" — **NOT DONE** (merged into PHASE_ACTIVE)
> "ReplyThread + Reply models" — **DONE**

### §12 — Roadmap Phase 1

> All Phase 1 post-launch items checked: ✅ LeadStatus extension, ✅ state machine, ✅ import CSV, ✅ sync performance, ✅ classify/draft/reply, ✅ webhook, ✅ ReplyThread+Reply models
> Missing: PHASE_MONITORING prompt tier (merged, acceptable)

### §3.3 — Autonomy Cursor Post-Launch

> "Reply classification: Auto / Auto / Review manuel" — **NOT IMPLEMENTED** (no autonomy mode check)
> "Reply drafting: Auto send / Preview / Composition manuelle" — **PARTIALLY** (always preview, no auto-send mode)
> "CRM push: Auto / Confirmation / Manuel" — **PARTIALLY** (always confirmation via isSideEffect)

---

## Research Best Practice

### Full-Lifecycle Management (Competitor Comparison)

| Capability | Instantly Native | AiSDR | Smartlead | **LeadSens** |
|---|---|---|---|---|
| Lead lifecycle tracking | ✅ Built-in | ✅ | ✅ Built-in | **✅ Custom state machine** |
| Webhook real-time events | ✅ | ❌ | ✅ | **✅** |
| Reply classification (LLM) | ✅ (AI Copilot) | ✅ | ❌ | **✅ (Mistral Small)** |
| Reply drafting | ✅ (AI Copilot) | ✅ (autonomous) | ❌ | **✅ (Mistral Large)** |
| CRM push (contact+deal) | Via Zapier | ❌ | ❌ | **✅ Direct HubSpot** |
| Webhook authentication | ✅ (HMAC) | N/A | ✅ | **❌** |
| Sequence removal on interested | ✅ Built-in | ✅ | ✅ | **❌** |
| Bounce → remove from lists | ✅ Built-in | N/A | ✅ | **❌ (status only)** |
| Auto-send replies | ✅ (AI Copilot) | ✅ | ❌ | **❌ (preview only)** |
| Autonomy modes | ❌ | Full auto only | ❌ | **❌ (not enforced)** |

### RESEARCH-DELIVERABILITY Key Gaps

- **D4 (Bounce guard)**: ✅ Implemented — `bounce-guard.ts` auto-pauses at 3% after 50 sends
- **Webhook security**: Industry standard is HMAC-SHA256 signature verification. LeadSens accepts any POST, making the endpoint vulnerable to spoofing (fake bounce events could pause campaigns, fake reply events could create garbage data)

---

## Gap Analysis

### Gap 1: No SENT Status Transition (HIGH)

The state machine defines `PUSHED → SENT` as valid, but **no code anywhere sets a lead to SENT**. The webhook has `campaign_completed` (sets Campaign to ACTIVE) but nothing for individual lead sends. The `analytics-sync-worker` syncs EmailPerformance but doesn't update lead status. This means leads jump directly from PUSHED → REPLIED/BOUNCED/UNSUBSCRIBED, skipping SENT entirely.

**Impact**: The SENT status is effectively dead code. classify_reply at `pipeline-tools.ts:211` checks `lead.status === "SENT"` — this check never fires. The state machine appears complete but has a phantom state.

**Options**:
A) Remove SENT status entirely (simplify, acknowledge Instantly handles send tracking)
B) Set SENT when analytics-sync-worker detects a lead has been emailed (via EmailPerformance upsert)
C) Set SENT when webhook detects any first email-related event for a lead

### Gap 2: Webhook Has Zero Authentication (CRITICAL)

`webhooks/instantly/route.ts` accepts any POST request with valid JSON. No HMAC verification, no shared secret, no IP whitelist. An attacker could:
- Send fake `email_bounced` events to trigger bounce-guard auto-pause (DoS on campaigns)
- Send fake `reply_received` events to pollute ReplyThread/Reply data
- Send fake `lead_unsubscribed` events to transition leads to terminal state

**Impact**: Any unauthenticated client can manipulate lead statuses, pause campaigns, and inject garbage data. This is the #1 security gap in the entire post-launch pipeline.

### Gap 3: Classify_reply Lacks isSideEffect Flag (HIGH)

`classify_reply` in `pipeline-tools.ts:117` does NOT have `isSideEffect: true`. But it transitions lead status (`pipeline-tools.ts:210-225`) and creates Reply records (`pipeline-tools.ts:194-206`). In supervised/manual mode, the user should approve status changes — but the autonomy cursor isn't implemented anyway.

Worse: both the webhook handler AND `classify_reply` can transition PUSHED/SENT → REPLIED. If a webhook fires AND the agent calls classify_reply, there's a race condition. `safeTransition()` in the webhook handler swallows errors, so the second transition fails silently — but the double Reply creation causes duplicate records.

### Gap 4: Reply Records Have Empty fromEmail/toEmail (MEDIUM)

- `pipeline-tools.ts:199`: `toEmail: ""` — outbound reply `fromEmail` is the user's email (unknown), `toEmail` should be `lead.email`
- `pipeline-tools.ts:365`: Both `fromEmail: ""` and `toEmail: ""` — `reply_to_email` doesn't know sender/recipient
- `route.ts:155-156`: Webhook correctly sets `fromEmail: event.from_email` and `toEmail: lead.email`

**Impact**: Reply records from agent-driven paths have no email addresses. Search/filter by email on ReplyThread breaks. CRM export would have gaps.

### Gap 5: No Sequence Removal on INTERESTED/NOT_INTERESTED (MEDIUM)

STRATEGY §11.2 specifies:
- INTERESTED → "Draft reply, notify user" + **"Retrait de la sequence d'envoi"**
- NOT_INTERESTED → "Remove from sequence"
- MEETING_BOOKED → "Remove from sequence"

Currently, `classify_reply` transitions the lead status but does NOT call Instantly to stop sending. The lead continues receiving follow-up emails even after expressing interest or disinterest. This is the single most damaging gap for user trust.

### Gap 6: crm_create_deal Hardcodes HubSpot API (MEDIUM)

`crm-tools.ts:118-164` bypasses the `CRMProvider` interface and calls HubSpot API directly. The comment acknowledges this: "The CRMProvider interface doesn't have createDeal yet" (`crm-tools.ts:119`). This blocks Salesforce/Pipedrive deal creation.

**Impact**: Low for now (only HubSpot in Phase 1), but creates technical debt for Phase 2.

### Gap 7: CRM Push Missing Enrichment Data (MEDIUM)

`crm_create_contact` at `crm-tools.ts:66-73` only sends: email, firstName, lastName, company, jobTitle, phone. STRATEGY §11.3 Phase 6 specifies: "Creation contact HubSpot/Salesforce avec toutes les données enrichies (Company DNA, pain points, historique emails)".

Missing from CRM push: industry, companySize, linkedinUrl, enrichmentData (pain points, tech stack, recent news), icpScore, email sequence history, reply classification.

### Gap 8: instantly_get_replies Doesn't Sync to DB (LOW)

STRATEGY §11.1 called out: "`instantly_get_replies` retourne du JSON brut sans sync DB ni update de statut." This is still partially true — the tool returns raw Instantly data. The webhook handles real-time sync, but if the user asks "show me replies", the agent calls `instantly_get_replies` which returns Instantly API data without checking/syncing to local Reply/ReplyThread records.

### Gap 9: Zero Test Coverage for Pipeline Post-Launch (HIGH)

| Module | Lines | Tests |
|---|---|---|
| `webhooks/instantly/route.ts` | 238 | 0 |
| `pipeline-tools.ts` | 637 | 0 |
| `crm-tools.ts` | 179 | 0 |
| `lead-status.ts` | 84 | 0 |
| **Total** | **1138** | **0** |

The lead status state machine (transition validation), webhook event handling (Zod parsing, DB operations, status transitions), reply classification (LLM integration, status updates), CSV parsing (delimiter detection, field mapping, dedup), and CRM handoff are ALL untested. Any regression in the state machine transitions would silently corrupt lead data.

### Gap 10: CSV Parser Doesn't Handle Quoted Fields (LOW)

`parseCSV()` at `pipeline-tools.ts:87-111` splits by delimiter naively. A CSV field like `"Smith, John"` with a comma inside quotes would be split incorrectly. This breaks names with commas, companies with commas ("Acme, Inc."), etc.

### Gap 11: No Webhook Auto-Registration (LOW)

STRATEGY §11.4: "Auto-registration via `setup_webhooks` au premier lancement de campagne." Not implemented. Users must manually configure the webhook URL in Instantly. This is a friction point but not blocking for MVP.

---

## Issues

### ISSUE 1 — Webhook endpoint has zero authentication (CRITICAL)

**Files:** `src/app/api/webhooks/instantly/route.ts:89-96`
**Severity:** CRITICAL
**Impact:** Any HTTP client can send fake events to pause campaigns (DoS via fake bounces), pollute reply data (fake reply_received), or transition leads to terminal states (fake unsubscribe). The bounce-guard auto-pause makes this especially dangerous — a single malicious POST with 50+ fake bounce events could pause an active campaign.
**Detail:** Instantly supports webhook signing via a shared secret. Add `INSTANTLY_WEBHOOK_SECRET` env var. Verify HMAC-SHA256 signature in the `X-Instantly-Signature` header before processing events. If no secret configured, accept all events (graceful degradation for dev/testing). This is the single most important fix before going to production.

### ISSUE 2 — No SENT status transition exists (HIGH)

**Files:** `src/server/lib/lead-status.ts:17` (defines PUSHED→SENT as valid), no code triggers it
**Severity:** HIGH
**Impact:** SENT is a phantom state. `classify_reply` checks `lead.status === "SENT"` at `pipeline-tools.ts:211` — never fires. The state machine's post-launch path starts at PUSHED, not SENT. If a future feature depends on distinguishing "pushed but not yet emailed" from "emailed", it won't work.
**Detail:** The analytics-sync-worker already detects when leads have been emailed (via EmailPerformance upsert). Add `transitionLeadStatus(leadId, "SENT")` when first EmailPerformance record is created for a lead with status PUSHED. Or: remove SENT from the enum and transition map, and allow PUSHED→REPLIED directly. Option B is simpler.

### ISSUE 3 — No sequence removal on INTERESTED/NOT_INTERESTED/MEETING_BOOKED (HIGH)

**Files:** `src/server/lib/tools/pipeline-tools.ts:209-225`
**Severity:** HIGH
**Impact:** Leads classified as INTERESTED continue receiving automated follow-up emails. A prospect who says "yes, let's schedule a call" gets a "New Angle" email 4 days later. This damages trust and can lose deals.
**Detail:** After transitioning to INTERESTED, NOT_INTERESTED, or MEETING_BOOKED, call Instantly API to remove the lead from the campaign sequence. The `DELETE /api/v2/campaigns/{id}/leads` endpoint or `POST /api/v2/leads/status` endpoint (set lead to "completed" in Instantly) would work. This should be called from `classify_reply` after the status transition.

### ISSUE 4 — classify_reply missing isSideEffect flag (MEDIUM)

**Files:** `src/server/lib/tools/pipeline-tools.ts:117`
**Severity:** MEDIUM
**Impact:** classify_reply transitions lead status (line 210-225) and creates Reply records (line 194-206) without user confirmation. In supervised mode, the user should approve before status changes. The tool also creates duplicate Reply records if called after the webhook already stored the same reply.
**Detail:** Add `isSideEffect: true` to the tool definition. Consider deduplication: check if a Reply with the same body already exists for this thread before creating.

### ISSUE 5 — Reply records have empty fromEmail/toEmail (MEDIUM)

**Files:** `src/server/lib/tools/pipeline-tools.ts:199,365`
**Severity:** MEDIUM
**Impact:** Reply records from classify_reply have `toEmail: ""`. Reply records from reply_to_email have both `fromEmail: ""` and `toEmail: ""`. Data integrity violation — these fields should never be empty.
**Detail:**
- `classify_reply` (line 199): Set `toEmail: lead.email` (the lead's email, since it's inbound)
- `reply_to_email` (line 365): Set `toEmail: lead.email` (fetch lead by args.lead_id). `fromEmail` requires fetching the sending account — for now, set to workspace sending email or leave as "unknown" with a TODO.

### ISSUE 6 — CRM contact push missing enrichment data (MEDIUM)

**Files:** `src/server/lib/tools/crm-tools.ts:66-73`
**Severity:** MEDIUM
**Impact:** CRM contacts created with only 5 basic fields. Sales team loses all enrichment intelligence (pain points, tech stack, industry, company size, LinkedIn URL, ICP score, reply history). STRATEGY §11.3 Phase 6 explicitly requires "toutes les données enrichies."
**Detail:** Add optional HubSpot custom properties: `industry`, `company_size`, `linkedin_url`, `leadsens_icp_score`, `leadsens_enrichment_notes` (serialized pain points + recent news). The CRMProvider interface needs extension: `createContact(data: ContactData)` where `ContactData` includes enrichment fields. For MVP: add the fields directly in the HubSpot API call.

### ISSUE 7 — CSV parser breaks on quoted fields with delimiters (LOW)

**Files:** `src/server/lib/tools/pipeline-tools.ts:98-99`
**Severity:** LOW
**Impact:** CSV files with quoted fields containing commas/semicolons (e.g., `"Acme, Inc."`) are parsed incorrectly. Common in real-world CSV exports from CRMs.
**Detail:** Replace naive `split(delimiter)` with proper CSV parsing that respects quoted fields. Can use a simple state machine: track `inQuotes` boolean, only split on unquoted delimiters. Or import a lightweight CSV parser like `papaparse` (but adds dependency — prefer inline).

### ISSUE 8 — campaign_completed sets ACTIVE but no lead SENT transitions (LOW)

**Files:** `src/app/api/webhooks/instantly/route.ts:219-230`
**Severity:** LOW
**Impact:** When Instantly fires `campaign_completed`, the Campaign status changes to ACTIVE but individual leads remain at PUSHED. There's no batch transition of leads to SENT. Connected to ISSUE 2.
**Detail:** Could batch-transition all PUSHED leads to SENT on `campaign_completed`, but this is a blunt approach (some leads may not have been emailed if the campaign was paused mid-send).

### ISSUE 9 — Zero test coverage for 1138 lines of pipeline code (HIGH)

**Files:** All pipeline post-launch files
**Severity:** HIGH
**Impact:** State machine validation, webhook event handling, CSV parsing, reply classification integration, CRM handoff — zero tests. The state machine is the foundation of data integrity. A regression (e.g., allowing SOURCED→MEETING_BOOKED) would silently corrupt lead data.
**Detail:** Priority tests: (1) state machine transitions — test all valid + invalid transitions, (2) webhook handlers — test each event type with mock DB, (3) CSV parser — delimiter detection, field mapping, dedup, quoted fields, (4) classify_reply — status transition logic.

---

## Score Justification: 6/10

| Dimension | Score | Notes |
|---|---|---|
| State machine (lead-status.ts) | 7/10 | Well-structured, valid transitions, batch support. SENT is phantom, no terminal state cleanup |
| Webhook (route.ts) | 5/10 | Functionally complete for 4 events. Zero authentication = critical security gap |
| Reply management (pipeline-tools.ts) | 7/10 | Full cycle: classify → draft → send. Data quality issues (empty emails, no dedup) |
| CRM handoff (crm-tools.ts) | 6/10 | Contact + deal works. Hardcodes HubSpot, missing enrichment data |
| CSV import | 6/10 | Multi-format, dedup, field mapping. Breaks on quoted fields |
| Phase integration (PHASE_ACTIVE + tool filtering) | 8/10 | Clean separation, well-configured, correct tool availability per phase |
| Test coverage | 0/10 | Zero tests for 1138 lines |
| Security | 2/10 | Unauthenticated webhook, no rate limiting |
| **Overall** | **6/10** | Core pipeline works end-to-end. Security and data integrity prevent production-readiness |

### Path to 7/10:
- Fix ISSUE 1: Webhook authentication → +0.5
- Fix ISSUE 3: Sequence removal on interested → +0.3
- Fix ISSUE 5: Reply fromEmail/toEmail → +0.1
- Add basic tests (state machine + webhook) → +0.1

### Path to 8/10:
- Above + ISSUE 2: Resolve SENT status → +0.2
- Above + ISSUE 4: classify_reply isSideEffect + dedup → +0.1
- Above + ISSUE 6: CRM enrichment data → +0.2
- Above + ISSUE 9: Comprehensive test coverage → +0.3
- Above + Autonomy cursor enforcement → +0.2

---

## Recommended Tasks

### New tasks (not already in BACKLOG):

1. **PIPE-SEC-01** Webhook HMAC authentication **(CRITICAL — 1h)**
   **Fichiers:** `src/app/api/webhooks/instantly/route.ts`
   **Réf:** audit-pipeline-post-launch.md ISSUE 1
   **Impact:** Prevents campaign DoS via fake bounce events, reply data pollution, and unauthorized lead status transitions. Production blocker.
   **PASS IF:**
   - `INSTANTLY_WEBHOOK_SECRET` env var added to `.env.example`
   - If secret is configured: verify HMAC-SHA256 of request body against `X-Instantly-Signature` header (or equivalent Instantly header)
   - If signature invalid → return 401 Unauthorized
   - If no secret configured → accept all events (graceful degradation for dev/testing) with console.warn
   - Test: valid signature passes, invalid signature returns 401, missing secret accepts all
   - `pnpm typecheck && pnpm test` passent

2. **PIPE-SEQ-01** Remove lead from Instantly sequence on INTERESTED/NOT_INTERESTED/MEETING_BOOKED **(HIGH — 1h)**
   **Fichiers:** `src/server/lib/tools/pipeline-tools.ts`, `src/server/lib/connectors/instantly.ts`
   **Réf:** STRATEGY §11.2 ("retrait de la séquence"), audit-pipeline-post-launch.md ISSUE 3
   **Impact:** Prevents follow-up emails to leads who already replied positively or negatively. Single most damaging UX gap — loses deals.
   **PASS IF:**
   - After transitioning to INTERESTED, NOT_INTERESTED, or MEETING_BOOKED, calls Instantly API to remove lead from campaign
   - Uses `POST /api/v2/leads/status` or equivalent to mark lead as "completed" in Instantly
   - Best-effort: failure to remove from Instantly doesn't block the status transition
   - Test: mock Instantly API call, verify it's called after INTERESTED transition
   - `pnpm typecheck && pnpm test` passent

3. **PIPE-DATA-01** Fix empty fromEmail/toEmail in Reply records **(MEDIUM — 15 min)**
   **Fichiers:** `src/server/lib/tools/pipeline-tools.ts`
   **Réf:** audit-pipeline-post-launch.md ISSUE 5
   **Impact:** Data integrity — Reply records searchable by email address.
   **PASS IF:**
   - `classify_reply` (line 199): `toEmail` set to `lead.email`
   - `reply_to_email` (line 365): `toEmail` set to lead's email (fetch from DB if lead_id provided)
   - `fromEmail` on outbound replies: set to "sending_account" if available, else empty with TODO comment
   - `pnpm typecheck && pnpm test` passent

4. **PIPE-SIDE-01** Add isSideEffect to classify_reply + prevent duplicate Replies **(MEDIUM — 30 min)**
   **Fichiers:** `src/server/lib/tools/pipeline-tools.ts`
   **Réf:** audit-pipeline-post-launch.md ISSUE 4
   **Impact:** classify_reply changes lead state without user confirmation. Duplicate Reply records when webhook fires before classify_reply.
   **PASS IF:**
   - `classify_reply` has `isSideEffect: true`
   - Before creating Reply record, check if a Reply with matching `body` (first 100 chars) exists in the thread within last 5 minutes — skip if duplicate
   - Test: two calls with same body within 5 minutes → only 1 Reply created
   - `pnpm typecheck && pnpm test` passent

5. **PIPE-SENT-01** Resolve phantom SENT status **(MEDIUM — 30 min)**
   **Fichiers:** `src/server/lib/lead-status.ts`, `src/queue/analytics-sync-worker.ts`
   **Réf:** audit-pipeline-post-launch.md ISSUE 2
   **Impact:** SENT is defined but never triggered. Either activate it or remove it.
   **PASS IF:**
   - Option A (preferred): analytics-sync-worker transitions PUSHED→SENT when first EmailPerformance is created for a lead
   - OR Option B: remove SENT from enum and transitions, add PUSHED→REPLIED as valid transition
   - Either way: no phantom states in the state machine
   - `pnpm typecheck && pnpm test` passent

6. **PIPE-CRM-01** Enrich CRM contact with pipeline data **(MEDIUM — 1h)**
   **Fichiers:** `src/server/lib/tools/crm-tools.ts`
   **Réf:** STRATEGY §11.3 Phase 6, audit-pipeline-post-launch.md ISSUE 6
   **Impact:** Sales team receives enrichment intelligence alongside the contact.
   **PASS IF:**
   - `crm_create_contact` sends additional fields to HubSpot: industry, company website, LinkedIn URL, ICP score
   - Enrichment notes (top 3 pain points, recent news, tech stack) serialized into a `notes` or custom property
   - Basic fields still sent via CRMProvider interface for Salesforce compat
   - Extended fields sent via direct HubSpot API call if HubSpot integration
   - `pnpm typecheck && pnpm test` passent

7. **PIPE-TEST-01** Unit tests for lead-status state machine + webhook + CSV parser **(HIGH — 3h)**
   **Fichiers:** `tests/pipeline-post-launch.test.ts` (NEW)
   **Réf:** audit-pipeline-post-launch.md ISSUE 9
   **Impact:** 1138 lines of zero-tested code controlling lead data integrity.
   **PASS IF:**
   - Test all valid transitions from VALID_TRANSITIONS map (10+ cases)
   - Test all invalid transitions throw (SOURCED→PUSHED, DRAFTED→REPLIED, etc.)
   - Test batch transition with mixed valid/invalid leads
   - Test CSV parser: comma/semicolon/tab detection, field mapping, dedup, empty rows, missing email column
   - Test CSV parser: quoted fields with embedded delimiters
   - Test `buildInsightSuggestions()`: bounce >5%, reply <5%, high performer
   - Minimum 25 tests
   - `pnpm typecheck && pnpm test` passent

### Already in BACKLOG (validated by this audit):

- **RES-02** Auto-pause on bounce spike — ✅ Already DONE (bounce-guard.ts). BACKLOG should be marked [x].
- **FL-GUARD-01** Negative reply spike auto-pause — Confirmed relevant (webhook handler is the trigger point).
- **T2-INT-01** Import CSV — Confirmed implemented in `pipeline-tools.ts:382-491`. BACKLOG should be marked [x].
- **T2-INT-03** CRM push complet — ✅ Already marked done. Confirmed.

### Dependency Chain

```
PIPE-SEC-01 (webhook auth)              ← CRITICAL, independent, production blocker
    └── No downstream dependencies

PIPE-SEQ-01 (sequence removal)          ← HIGH, independent
    └── Requires: Instantly API endpoint for lead removal (exists in docs)

PIPE-DATA-01 (fix empty emails)         ← MEDIUM, independent, quick fix
PIPE-SIDE-01 (isSideEffect + dedup)     ← MEDIUM, independent
PIPE-SENT-01 (resolve SENT phantom)     ← MEDIUM, independent

PIPE-CRM-01 (enriched CRM contact)     ← MEDIUM, independent

PIPE-TEST-01 (tests)                    ← HIGH, should follow the above fixes
```

---

## Architectural Assessment

The post-launch pipeline is **structurally sound**. The state machine pattern in `lead-status.ts` with validated transitions is the right design. The webhook handler with Zod discriminated unions and graceful unknown-event handling is clean. The tool suite (classify → draft → reply → CRM) covers the complete lifecycle. Phase-specific tool filtering and prompt tiering are well-integrated.

The **critical gap** is security: the webhook endpoint accepts unauthenticated POSTs. This must be fixed before production. The **most damaging functional gap** is sequence removal — interested leads continue receiving follow-ups, which is worse than not having the pipeline at all.

The pipeline went from 0/10 to 6/10 in ~48 hours, which is impressive velocity. The remaining path to 8/10 is achievable with 5-6 focused tasks (~8 hours total).
