# Instantly API Integration Audit

> Generated 2026-03-04 from `docs/INSTANTLY-ENDPOINTS.md` (143 endpoints) vs actual codebase.

## Legend

| Symbol | Meaning |
|--------|---------|
| Y | Implemented |
| - | Not implemented |
| n/a | Not applicable to this layer |

**Status column:**
- **Full chain** = Connector + Tool + UI all wired
- **Connector only** = function exists but no tool exposes it
- **Partial** = some layers present, gap noted
- **None** = not implemented anywhere

---

## Layer Inventory (what we actually have)

### Layer 1 — Connector (`src/server/lib/connectors/instantly.ts`, 1051 lines)

| Function | API Endpoint | Method |
|----------|-------------|--------|
| `countLeads()` | `/supersearch-enrichment/count-leads-from-supersearch` | POST |
| `previewLeads()` | `/supersearch-enrichment/preview-leads-from-supersearch` | POST |
| `sourceLeads()` | `/supersearch-enrichment/enrich-leads-from-supersearch` | POST |
| `getEnrichmentStatus()` | `/supersearch-enrichment/{resource_id}` | GET |
| `listLeads()` | `/leads/list` | POST |
| `getLead()` | `/leads/{id}` | GET |
| `createLead()` | `/leads` | POST |
| `updateLead()` | `/leads/{id}` | PATCH |
| `deleteLead()` | `/leads/{id}` | DELETE |
| `deleteLeadsBulk()` | `/leads` | DELETE |
| `addLeadsToCampaign()` | `/leads/add` | POST |
| `moveLeads()` | `/leads/move` | POST |
| `updateLeadInterestStatus()` | `/leads/update-interest-status` | POST |
| `createCampaign()` | `/campaigns` | POST |
| `getCampaign()` | `/campaigns/{id}` | GET |
| `updateCampaign()` | `/campaigns/{id}` | PATCH |
| `deleteCampaign()` | `/campaigns/{id}` | DELETE |
| `activateCampaign()` | `/campaigns/{id}/activate` | POST |
| `listCampaigns()` | `/campaigns` | GET |
| `listAccounts()` | `/accounts` | GET |

**Total: 20 functions covering 20 unique endpoints.**

### Layer 2 — Tools (`src/server/lib/tools/instantly-tools.ts`, 537 lines)

| Tool Name | Connector Functions Used | Side Effect |
|-----------|------------------------|-------------|
| `parse_icp` | _(no Instantly call — LLM only)_ | No |
| `instantly_count_leads` | `countLeads()` (with 5-step auto-broadening) | No |
| `instantly_preview_leads` | `previewLeads()` | No |
| `instantly_source_leads` | `sourceLeads()`, `getEnrichmentStatus()`, `listLeads()`, `createCampaign()` | Yes |
| `instantly_create_campaign` | `createCampaign()` | Yes |
| `instantly_add_leads_to_campaign` | `addLeadsToCampaign()` | Yes |
| `instantly_activate_campaign` | `activateCampaign()` | Yes |
| `instantly_list_accounts` | `listAccounts()` | No |

**8 tools expose 10 unique connector functions.** 10 connector functions are NOT exposed via tools.

### Layer 3 — tRPC Routers

| Router | Instantly-related? |
|--------|-------------------|
| `campaign.ts` | DB only (list/get/getLeads from Prisma). No Instantly API calls. |
| `integration.ts` | DB only (list integrations, disconnect). No Instantly API calls. |
| `workspace.ts` | Company DNA management. No Instantly. |
| `feedback.ts` | Style feedback. No Instantly. |
| `conversation.ts` | Chat history. No Instantly. |

**No tRPC router calls Instantly API directly.** All Instantly calls go through Tools (via chat agent) or the `/api/integrations/instantly` route (for key validation).

### Layer 4 — UI Components

| Component | Renders data from | Instantly-sourced? |
|-----------|------------------|-------------------|
| `lead-table-card.tsx` | DB leads (via tool) | Yes (leads originally from SuperSearch) |
| `account-picker-card.tsx` | `listAccounts()` result | Yes (direct Instantly data) |
| `email-preview-card.tsx` | DB drafted emails | Indirect (emails drafted for Instantly leads) |
| `campaign-summary-card.tsx` | DB campaign stats | Indirect |
| `enrichment-card.tsx` | DB enrichment data | Indirect |
| `progress-bar.tsx` | Generic progress | No |
| `integrations/page.tsx` | Connect/disconnect Instantly | Yes (API key validation) |

---

## Coverage Matrix — All 143 Endpoints

### Analytics (7)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/accounts/warmup-analytics` | - | - | - | - | None |
| GET `/accounts/analytics/daily` | - | - | - | - | None |
| POST `/accounts/test/vitals` | - | - | - | - | None |
| GET `/campaigns/analytics` | - | - | - | - | None |
| GET `/campaigns/analytics/overview` | - | - | - | - | None |
| GET `/campaigns/analytics/daily` | - | - | - | - | None |
| GET `/campaigns/analytics/steps` | - | - | - | - | None |

### OAuth (3)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/oauth/google/init` | - | - | - | - | None |
| POST `/oauth/microsoft/init` | - | - | - | - | None |
| GET `/oauth/session/status/{sessionId}` | - | - | - | - | None |

### Account (15)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/accounts` | - | - | - | - | None |
| GET `/accounts` | Y | Y (`instantly_list_accounts`) | - | Y (`account-picker-card`) | Full chain |
| GET `/accounts/{email}` | - | - | - | - | None |
| PATCH `/accounts/{email}` | - | - | - | - | None |
| DELETE `/accounts/{email}` | - | - | - | - | None |
| POST `/accounts/warmup/enable` | - | - | - | - | None |
| POST `/accounts/warmup/disable` | - | - | - | - | None |
| POST `/accounts/{email}/pause` | - | - | - | - | None |
| POST `/accounts/{email}/resume` | - | - | - | - | None |
| POST `/accounts/{email}/mark-fixed` | - | - | - | - | None |
| GET `/accounts/ctd/status` | - | - | - | - | None |
| POST `/accounts/move` | - | - | - | - | None |

### Campaign (17)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/campaigns` | Y | Y (`instantly_source_leads`, `instantly_create_campaign`) | - | n/a | Partial (no dedicated UI) |
| GET `/campaigns` | Y | - | - | - | Connector only |
| GET `/campaigns/{id}` | Y | - | - | - | Connector only |
| PATCH `/campaigns/{id}` | Y | - | - | - | Connector only |
| DELETE `/campaigns/{id}` | Y | - | - | - | Connector only |
| POST `/campaigns/{id}/activate` | Y | Y (`instantly_activate_campaign`) | - | n/a | Partial (tool, no dedicated UI) |
| POST `/campaigns/{id}/pause` | - | - | - | - | None |
| GET `/campaigns/search-by-contact` | - | - | - | - | None |
| POST `/campaigns/{id}/share` | - | - | - | - | None |
| POST `/campaigns/{id}/from-export` | - | - | - | - | None |
| POST `/campaigns/{id}/export` | - | - | - | - | None |
| POST `/campaigns/{id}/duplicate` | - | - | - | - | None |
| GET `/campaigns/count-launched` | - | - | - | - | None |
| POST `/campaigns/{id}/variables` | - | - | - | - | None |
| GET `/campaigns/{id}/sending-status` | - | - | - | - | None |

### Email / Unibox (8)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/emails/reply` | - | - | - | - | None |
| POST `/emails/forward` | - | - | - | - | None |
| GET `/emails` | - | - | - | - | None |
| GET `/emails/{id}` | - | - | - | - | None |
| PATCH `/emails/{id}` | - | - | - | - | None |
| DELETE `/emails/{id}` | - | - | - | - | None |
| GET `/emails/unread/count` | - | - | - | - | None |
| POST `/emails/threads/{thread_id}/mark-as-read` | - | - | - | - | None |

### Email Verification (2)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/email-verification` | - | - | - | - | None |
| GET `/email-verification/{email}` | - | - | - | - | None |

### Lead List (6)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/lead-lists` | - | - | - | - | None |
| GET `/lead-lists` | - | - | - | - | None |
| GET `/lead-lists/{id}` | - | - | - | - | None |
| PATCH `/lead-lists/{id}` | - | - | - | - | None |
| DELETE `/lead-lists/{id}` | - | - | - | - | None |
| GET `/lead-lists/{id}/verification-stats` | - | - | - | - | None |

### Lead (13)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/leads` | Y | - | - | - | Connector only |
| DELETE `/leads` (bulk) | Y | - | - | - | Connector only |
| POST `/leads/list` | Y | Y (inside `instantly_source_leads`) | - | Y (`lead-table-card`) | Full chain |
| GET `/leads/{id}` | Y | - | - | - | Connector only |
| PATCH `/leads/{id}` | Y | - | - | - | Connector only |
| DELETE `/leads/{id}` | Y | - | - | - | Connector only |
| POST `/leads/merge` | - | - | - | - | None |
| POST `/leads/update-interest-status` | Y | - | - | - | Connector only |
| POST `/leads/subsequence/remove` | - | - | - | - | None |
| POST `/leads/bulk-assign` | - | - | - | - | None |
| POST `/leads/move` | Y | - | - | - | Connector only |
| POST `/leads/subsequence/move` | - | - | - | - | None |
| POST `/leads/add` | Y | Y (`instantly_add_leads_to_campaign`) | - | n/a | Partial (tool, no dedicated UI) |

### SuperSearch Enrichment (10)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `.../count-leads-from-supersearch` | Y | Y (`instantly_count_leads`) | - | n/a | Partial (tool, text output) |
| POST `.../preview-leads-from-supersearch` | Y | Y (`instantly_preview_leads`) | - | Y (`lead-table-card`) | Full chain |
| POST `.../enrich-leads-from-supersearch` | Y | Y (`instantly_source_leads`) | - | Y (`lead-table-card`) | Full chain |
| GET `.../supersearch-enrichment/{resource_id}` | Y | Y (polling in `instantly_source_leads`) | - | n/a | Partial (tool, no dedicated UI) |
| POST `/supersearch-enrichment` | - | - | - | - | None |
| PATCH `.../supersearch-enrichment/{resource_id}/settings` | - | - | - | - | None |
| POST `/supersearch-enrichment/ai` | - | - | - | - | None |
| GET `.../ai/{resource_id}/in-progress` | - | - | - | - | None |
| GET `.../history/{resource_id}` | - | - | - | - | None |
| POST `/supersearch-enrichment/run` | - | - | - | - | None |

### Campaign Subsequence (9)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/subsequences` | - | - | - | - | None |
| GET `/subsequences` | - | - | - | - | None |
| GET `/subsequences/{id}` | - | - | - | - | None |
| PATCH `/subsequences/{id}` | - | - | - | - | None |
| DELETE `/subsequences/{id}` | - | - | - | - | None |
| POST `/subsequences/{id}/duplicate` | - | - | - | - | None |
| POST `/subsequences/{id}/pause` | - | - | - | - | None |
| POST `/subsequences/{id}/resume` | - | - | - | - | None |
| GET `/subsequences/{id}/sending-status` | - | - | - | - | None |

### Webhook (8)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/webhooks` | - | - | - | - | None |
| POST `/webhooks` | - | - | - | - | None |
| GET `/webhooks/{id}` | - | - | - | - | None |
| PATCH `/webhooks/{id}` | - | - | - | - | None |
| DELETE `/webhooks/{id}` | - | - | - | - | None |
| GET `/webhooks/event-types` | - | - | - | - | None |
| POST `/webhooks/{id}/test` | - | - | - | - | None |
| POST `/webhooks/{id}/resume` | - | - | - | - | None |

### Webhook Event (4)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/webhook-events` | - | - | - | - | None |
| GET `/webhook-events/{id}` | - | - | - | - | None |
| GET `/webhook-events/summary` | - | - | - | - | None |
| GET `/webhook-events/summary-by-date` | - | - | - | - | None |

### Custom Tag (6)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/custom-tags` | - | - | - | - | None |
| GET `/custom-tags` | - | - | - | - | None |
| GET `/custom-tags/{id}` | - | - | - | - | None |
| PATCH `/custom-tags/{id}` | - | - | - | - | None |
| DELETE `/custom-tags/{id}` | - | - | - | - | None |
| POST `/custom-tags/toggle-resource` | - | - | - | - | None |

### Custom Tag Mapping (1)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/custom-tag-mappings` | - | - | - | - | None |

### Block List Entry (8)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/block-lists-entries` | - | - | - | - | None |
| GET `/block-lists-entries` | - | - | - | - | None |
| GET `/block-lists-entries/{id}` | - | - | - | - | None |
| PATCH `/block-lists-entries/{id}` | - | - | - | - | None |
| DELETE `/block-lists-entries/{id}` | - | - | - | - | None |
| DELETE `/block-lists-entries` (all) | - | - | - | - | None |
| POST `/block-lists-entries/bulk` | - | - | - | - | None |
| DELETE `/block-lists-entries/bulk` | - | - | - | - | None |

### Lead Label (6)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/lead-labels` | - | - | - | - | None |
| GET `/lead-labels` | - | - | - | - | None |
| GET `/lead-labels/{id}` | - | - | - | - | None |
| PATCH `/lead-labels/{id}` | - | - | - | - | None |
| DELETE `/lead-labels/{id}` | - | - | - | - | None |
| POST `/lead-labels/ai-reply-label` | - | - | - | - | None |

### Background Job (2)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/background-jobs` | - | - | - | - | None |
| GET `/background-jobs/{id}` | - | - | - | - | None |

### Workspace (6)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/workspaces/current` | - | - | - | - | None |
| PATCH `/workspaces/current` | - | - | - | - | None |
| POST `.../whitelabel-domain` | - | - | - | - | None |
| GET `.../whitelabel-domain` | - | - | - | - | None |
| DELETE `.../whitelabel-domain` | - | - | - | - | None |
| POST `.../change-owner` | - | - | - | - | None |

### Workspace Member (5)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/workspace-members` | - | - | - | - | None |
| GET `/workspace-members` | - | - | - | - | None |
| GET `/workspace-members/{id}` | - | - | - | - | None |
| PATCH `/workspace-members/{id}` | - | - | - | - | None |
| DELETE `/workspace-members/{id}` | - | - | - | - | None |

### Workspace Group Member (5)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/workspace-group-members` | - | - | - | - | None |
| GET `/workspace-group-members` | - | - | - | - | None |
| GET `/workspace-group-members/{id}` | - | - | - | - | None |
| DELETE `/workspace-group-members/{id}` | - | - | - | - | None |
| GET `/workspace-group-members/admin` | - | - | - | - | None |

### Account Campaign Mapping (1)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/account-campaign-mappings/{email}` | - | - | - | - | None |

### API Key (3)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/api-keys` | - | - | - | - | None |
| GET `/api-keys` | - | - | - | - | None |
| DELETE `/api-keys/{id}` | - | - | - | - | None |

### Inbox Placement Test (6)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/inbox-placement-tests` | - | - | - | - | None |
| GET `/inbox-placement-tests` | - | - | - | - | None |
| GET `/inbox-placement-tests/{id}` | - | - | - | - | None |
| DELETE `/inbox-placement-tests/{id}` | - | - | - | - | None |
| PATCH `/inbox-placement-tests/{id}` | - | - | - | - | None |
| GET `.../email-service-provider-options` | - | - | - | - | None |

### Inbox Placement Analytics (5)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/inbox-placement-analytics` | - | - | - | - | None |
| GET `/inbox-placement-analytics/{id}` | - | - | - | - | None |
| POST `.../stats-by-test-id` | - | - | - | - | None |
| POST `.../deliverability-insights` | - | - | - | - | None |
| POST `.../stats-by-date` | - | - | - | - | None |

### Inbox Placement Reports (2)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/inbox-placement-reports` | - | - | - | - | None |
| GET `/inbox-placement-reports/{id}` | - | - | - | - | None |

### DFY Email Account Order (7)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| POST `/dfy-email-account-orders` | - | - | - | - | None |
| GET `/dfy-email-account-orders` | - | - | - | - | None |
| POST `.../domains/similar` | - | - | - | - | None |
| POST `.../domains/check` | - | - | - | - | None |
| POST `.../domains/pre-warmed-up-list` | - | - | - | - | None |
| GET `.../accounts` | - | - | - | - | None |
| POST `.../accounts/cancel` | - | - | - | - | None |

### Workspace Billing (2)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/workspace-billing/plan-details` | - | - | - | - | None |
| GET `/workspace-billing/subscription-details` | - | - | - | - | None |

### Audit Log (1)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/audit-logs` | - | - | - | - | None |

### CRM Actions (2)

| Endpoint | Connector | Tool | tRPC | UI | Status |
|----------|-----------|------|------|----|--------|
| GET `/crm-actions/phone-numbers` | - | - | - | - | None |
| DELETE `/crm-actions/phone-numbers/{id}` | - | - | - | - | None |

---

## Summary

### Coverage Stats

| Metric | Count |
|--------|-------|
| Total Instantly API v2 endpoints | 143 |
| Endpoints with connector function | 20 (14%) |
| Endpoints exposed as agent tools | 10 (7%) |
| Endpoints with full chain (Connector + Tool + UI) | 4 (3%) |
| Endpoints not implemented at all | 123 (86%) |

### Full Chain Endpoints (4)

1. **GET `/accounts`** — `listAccounts()` → `instantly_list_accounts` → `account-picker-card`
2. **POST `/leads/list`** — `listLeads()` → inside `instantly_source_leads` → `lead-table-card`
3. **POST `.../preview-leads-from-supersearch`** — `previewLeads()` → `instantly_preview_leads` → `lead-table-card`
4. **POST `.../enrich-leads-from-supersearch`** — `sourceLeads()` → `instantly_source_leads` → `lead-table-card`

### Connector-Only Endpoints (10 — have code but no tool/UI)

| Endpoint | Function | Why no tool? |
|----------|----------|-------------|
| GET `/campaigns` | `listCampaigns()` | Used internally, no agent tool yet |
| GET `/campaigns/{id}` | `getCampaign()` | Used internally |
| PATCH `/campaigns/{id}` | `updateCampaign()` | Not exposed to agent |
| DELETE `/campaigns/{id}` | `deleteCampaign()` | Not exposed to agent |
| POST `/leads` | `createLead()` | Bulk add used instead |
| GET `/leads/{id}` | `getLead()` | Used internally |
| PATCH `/leads/{id}` | `updateLead()` | Not exposed to agent |
| DELETE `/leads/{id}` | `deleteLead()` | Not exposed to agent |
| DELETE `/leads` (bulk) | `deleteLeadsBulk()` | Not exposed to agent |
| POST `/leads/move` | `moveLeads()` | Not exposed to agent |
| POST `/leads/update-interest-status` | `updateLeadInterestStatus()` | Not exposed to agent |

### Undocumented / Out-of-Connector API Calls

| File | Line | Call | Issue |
|------|------|------|-------|
| `src/app/api/integrations/instantly/route.ts` | 24 | `fetch("https://api.instantly.ai/api/v2/accounts")` | **Bypasses connector layer.** Direct `fetch()` to validate API key on connect. Uses `GET /accounts` which IS a documented endpoint, but the call doesn't go through `instantlyFetch()` (no retry, no auth helper). |

**No calls to undocumented/deprecated Instantly endpoints were found.**

---

## Priority Endpoints for V1 Completion

These are the endpoints most likely needed to complete the V1 pipeline:

### Tier 1 — High value for current flow

| Endpoint | Why |
|----------|-----|
| POST `/campaigns/{id}/pause` | Pause campaign (safety — agent should be able to pause) |
| GET `/campaigns/analytics` | Campaign performance monitoring after activation |
| GET `/emails` | Read replies / Unibox integration (next big feature per STRATEGY.md) |
| POST `/emails/reply` | Reply to prospects from within LeadSens |
| GET `/campaigns/{id}/sending-status` | Check if campaign is actually sending |

### Tier 2 — Useful for pipeline robustness

| Endpoint | Why |
|----------|-----|
| GET `/lead-lists` | Manage lead lists (currently lists are created implicitly) |
| POST `/lead-labels` | Tag/label leads for segmentation |
| POST `/block-lists-entries` | Block domains/emails from campaigns |
| GET `/background-jobs/{id}` | Monitor async jobs (lead moves, bulk ops) |
| POST `/campaigns/{id}/variables` | Add/update campaign variables without full update |

### Tier 3 — Nice to have

| Endpoint | Why |
|----------|-----|
| POST `/webhooks` | Real-time events (replies, opens, bounces) |
| GET `/accounts/{email}` | Per-account health/warmup status |
| POST `/accounts/warmup/enable` | Warmup management |
| GET `/campaigns/analytics/steps` | Per-step analytics (which framework performs best) |
| POST `/email-verification` | Verify emails before sending |

---

## Part A — MVP Blockers by Pipeline Step

Core flow: ICP -> Find/Enrich -> Draft -> Create Campaign -> Launch -> Monitor

### Step 1: User describes ICP in chat

**No blockers.** `parse_icp` is LLM-only. No Instantly API needed.

### Step 2: Agent parses ICP, finds/enriches leads

**No blockers.** All required endpoints implemented:

| Endpoint | Function | Status |
|----------|----------|--------|
| POST `.../count-leads-from-supersearch` | `countLeads()` | OK |
| POST `.../preview-leads-from-supersearch` | `previewLeads()` | OK |
| POST `.../enrich-leads-from-supersearch` | `sourceLeads()` | OK |
| GET `.../supersearch-enrichment/{resource_id}` | `getEnrichmentStatus()` | OK |
| POST `/leads/list` | `listLeads()` | OK |

Scoring uses Mistral Small (no Instantly API). Enrichment uses Jina + Apify (no Instantly API).

### Step 3: Agent drafts personalized cold emails

**No blockers.** `draft_emails_batch` uses Mistral Large + DB. No Instantly API needed.

### Step 4: Agent creates Instantly campaign, adds leads + emails

**No blockers.** Full chain implemented:

| Action | Tool | Connector | Endpoint | Status |
|--------|------|-----------|----------|--------|
| List sending accounts | `instantly_list_accounts` | `listAccounts()` | GET `/accounts` | OK |
| Create campaign (6 steps with `{{email_step_N_*}}` vars) | `instantly_create_campaign` | `createCampaign()` | POST `/campaigns` | OK |
| Push leads with email custom_variables | `instantly_add_leads_to_campaign` | `createLead()` per lead | POST `/leads` | OK |

Note: the tool uses `createLead()` (one-by-one, line 476 of `instantly-tools.ts`), NOT `addLeadsToCampaign()`. Each lead is created with `campaign` + `customVariables` containing `email_step_N_subject` and `email_step_N_body`. This works but is O(n) API calls — could be optimized later with POST `/leads/add` (bulk, max 1000).

### Step 5: Agent launches campaign

**No blockers.** `instantly_activate_campaign` -> `activateCampaign()` -> POST `/campaigns/{id}/activate` is implemented.

**However:** after activation, there is zero feedback — the agent returns `{ activated: true }` and the user has no way to verify the campaign is actually sending without going to the Instantly dashboard.

### Step 6: User monitors results in chat — BLOCKED

**4 missing endpoints block the monitoring loop.** Without these, users must leave LeadSens and use the Instantly dashboard for ALL post-launch activity.

#### Blocker 1: GET `/campaigns/{id}/sending-status`

**What's blocked:** User can't verify campaign is actually sending after activation. No way to catch misconfigured campaigns, failed sends, or account issues.

| Layer | File | What to add |
|-------|------|-------------|
| Connector | `src/server/lib/connectors/instantly.ts` | `getSendingStatus(apiKey: string, campaignId: string)` |
| Tool | `src/server/lib/tools/instantly-tools.ts` | `instantly_campaign_status` tool |

```
GET /campaigns/{campaignId}/sending-status
Authorization: Bearer <API_KEY>
Response: { status, sent_count, total_count, ... }
```

#### Blocker 2: POST `/campaigns/{id}/pause`

**What's blocked:** No emergency stop. If emails have a typo, wrong tone, or go to wrong audience, the user cannot pause from LeadSens. This is a safety-critical gap — the user MUST have a way to stop a live campaign from the same tool that started it.

| Layer | File | What to add |
|-------|------|-------------|
| Connector | `src/server/lib/connectors/instantly.ts` | `pauseCampaign(apiKey: string, campaignId: string)` |
| Tool | `src/server/lib/tools/instantly-tools.ts` | `instantly_pause_campaign` tool (isSideEffect: true) |

```
POST /campaigns/{campaignId}/pause
Authorization: Bearer <API_KEY>
Body: (empty)
Response: 200 OK
```

#### Blocker 3: GET `/campaigns/analytics`

**What's blocked:** User can't see sent/opened/replied/bounced counts. The entire value proposition of "monitor results in chat" is broken. STRATEGY.md section 3.2 (Feedback loop, Tier 3) depends on this data.

| Layer | File | What to add |
|-------|------|-------------|
| Connector | `src/server/lib/connectors/instantly.ts` | `getCampaignAnalytics(apiKey: string, params: { campaignId: string; startDate?: string; endDate?: string })` |
| Tool | `src/server/lib/tools/instantly-tools.ts` | `instantly_campaign_analytics` tool |
| UI | `src/components/chat/inline/` | New `analytics-card.tsx` inline component |

```
GET /campaigns/analytics?campaign_id={id}&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
Authorization: Bearer <API_KEY>
Response: { campaign_id, sent, opened, replied, bounced, unsubscribed, ... }
```

#### Blocker 4: GET `/emails`

**What's blocked:** User can't read prospect replies. The entire post-launch conversation loop — the part that generates revenue — is invisible. Users must switch to the Instantly Unibox.

| Layer | File | What to add |
|-------|------|-------------|
| Connector | `src/server/lib/connectors/instantly.ts` | `listEmails(apiKey: string, params: { campaignId?: string; ueType?: number; isRead?: boolean; limit?: number; startingAfter?: string })` |
| Tool | `src/server/lib/tools/instantly-tools.ts` | `instantly_list_replies` tool |
| UI | `src/components/chat/inline/` | New `reply-thread-card.tsx` inline component |

```
GET /emails?campaign_id={id}&ue_type=2&limit=25
Authorization: Bearer <API_KEY>
Headers: (rate limit: 20 req/min)
Response: { items: [{ id, thread_id, from_address, to_address, subject, content_preview, is_auto_reply, ai_interest_value, timestamp_created, ... }], next_starting_after }
```

`ue_type=2` filters for received emails (replies). `ai_interest_value` gives Instantly's AI-based lead interest classification.

### Summary: MVP blocker map

```
Step 1  ICP description       -> No blocker
Step 2  Find & enrich leads   -> No blocker
Step 3  Draft emails           -> No blocker
Step 4  Create & push campaign -> No blocker
Step 5  Launch campaign        -> No blocker
Step 6  Monitor results        -> BLOCKED (4 missing endpoints)
         |
         +-- Can't verify sending    -> GET /campaigns/{id}/sending-status
         +-- Can't pause             -> POST /campaigns/{id}/pause
         +-- Can't see performance   -> GET /campaigns/analytics
         +-- Can't read replies      -> GET /emails
```

The pipeline creates and launches campaigns but abandons the user at the exact moment they need the most confidence — right after pressing "activate." Without Step 6, LeadSens is a one-way launcher, not a monitoring tool.

---

## Part B — High-Leverage UX Enhancements (10)

Selection criteria: unimplemented Instantly endpoint + buildable in <1 day + directly improves user confidence or reduces manual work.

### 1. Pause campaign via chat

**Endpoint:** POST `/campaigns/{id}/pause`
**What it does:** Adds `instantly_pause_campaign` tool — agent pauses any active campaign on user request.
**User experience:** User says "pause the campaign" and gets instant confirmation. No context-switching to Instantly dashboard. Safety net for every launch.

### 2. Sending status check after activation

**Endpoint:** GET `/campaigns/{id}/sending-status`
**What it does:** Auto-queries sending status 10s after `instantly_activate_campaign` returns, reports back.
**User experience:** Instead of "Campaign activated" (and silence), user sees "Campaign is live — 0/340 scheduled, first emails going out in ~15 min."

### 3. Campaign analytics in chat

**Endpoint:** GET `/campaigns/analytics`
**What it does:** Adds `instantly_campaign_analytics` tool + inline analytics card. Agent fetches sent/opened/replied/bounced.
**User experience:** "How's my campaign doing?" -> inline card: "340 sent, 142 opened (41.8%), 18 replied (5.3%), 2 bounced." No Instantly dashboard needed.

### 4. Read prospect replies in chat

**Endpoint:** GET `/emails` (filtered by `ue_type=2`)
**What it does:** Adds `instantly_list_replies` tool. Fetches received emails, displays inline with sender, subject, preview.
**User experience:** "Any replies?" -> agent shows reply list with interest level. User reads conversations without leaving LeadSens.

### 5. Unread reply count on chat load

**Endpoint:** GET `/emails/unread/count`
**What it does:** Auto-fetch on chat session start when an active campaign exists. Agent opens with count.
**User experience:** Opening LeadSens: "You have 7 unread replies on your SaaS CTO campaign. Want to see them?"

### 6. Pre-launch account health check

**Endpoint:** POST `/accounts/test/vitals`
**What it does:** Before activation, auto-test all selected sending accounts. Warn if any fail.
**User experience:** "Checking accounts... account-2@domain.com has DNS issues. Fix before launching?" Catches deliverability problems before they ruin a campaign.

### 7. Per-step email analytics

**Endpoint:** GET `/campaigns/analytics/steps`
**What it does:** Adds `instantly_step_analytics` tool. Shows open/reply rate broken down by email step (PAS, Value-add, Social Proof, etc.).
**User experience:** "Which email works best?" -> "Step 0 (PAS): 44% open, 6.2% reply. Step 4 (Micro-value): 38% open, 3.1% reply. Step 5 (Breakup): 28% open, 8.4% reply." Direct input for framework optimization.

### 8. Bulk block domains

**Endpoint:** POST `/block-lists-entries/bulk`
**What it does:** Adds `instantly_block_domains` tool. Accepts domain list, blocks across workspace.
**User experience:** "Block all .edu and .gov domains" or "block our competitors: competitor1.com, competitor2.com" -> done in one command, applies to all campaigns.

### 9. Campaign analytics overview (quick summary)

**Endpoint:** GET `/campaigns/analytics/overview`
**What it does:** Lightweight version of #3 — single aggregated stat line, no detailed breakdown.
**User experience:** Agent uses this for the greeting message: "Your 2 active campaigns: 1,200 sent total, 8.3% reply rate." Quick pulse without asking.

### 10. Reply to prospects from chat

**Endpoint:** POST `/emails/reply`
**What it does:** Adds `instantly_reply` tool. Takes `reply_to_uuid` from a listed reply + user's response text, sends via Instantly.
**User experience:** User reads a reply (enhancement #4), types "tell them I'm available Thursday", agent composes and sends the reply through Instantly. Full conversation loop without leaving LeadSens.
