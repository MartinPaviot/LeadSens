# Instantly API V2 — Complete Endpoint Inventory

> Generated 2026-03-04 from `docs/INSTANTLY-API.md` + developer portal scraping.
> Both `instantly-api.json` and `instantly-api2.json` are HTML dumps (the developer portal is a Redocly SPA that doesn't serve raw JSON). The real source of truth is `docs/INSTANTLY-API.md`.

**Base URL**: `https://api.instantly.ai/api/v2`
**Auth**: `Authorization: Bearer <API_KEY>`

---

## All Endpoints (143 total)

### Analytics (7)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/accounts/warmup-analytics` | Analytics | Warmup analytics (filter by email list) |
| GET | `/accounts/analytics/daily` | Analytics | Daily account analytics |
| POST | `/accounts/test/vitals` | Analytics | Test account health |
| GET | `/campaigns/analytics` | Analytics | Campaign analytics (supports `expand_crm_events`) |
| GET | `/campaigns/analytics/overview` | Analytics | Campaign analytics overview |
| GET | `/campaigns/analytics/daily` | Analytics | Daily campaign analytics |
| GET | `/campaigns/analytics/steps` | Analytics | Campaign step analytics |

### OAuth (3)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/oauth/google/init` | OAuth | Init Google OAuth |
| POST | `/oauth/microsoft/init` | OAuth | Init Microsoft OAuth |
| GET | `/oauth/session/status/{sessionId}` | OAuth | Check OAuth session status |

### Account (15)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/accounts` | Account | Create email account |
| GET | `/accounts` | Account | List accounts |
| GET | `/accounts/{email}` | Account | Get account by email |
| PATCH | `/accounts/{email}` | Account | Update account |
| DELETE | `/accounts/{email}` | Account | Delete account |
| POST | `/accounts/warmup/enable` | Account | Enable warmup (background job) |
| POST | `/accounts/warmup/disable` | Account | Disable warmup |
| POST | `/accounts/{email}/pause` | Account | Pause account |
| POST | `/accounts/{email}/resume` | Account | Resume account |
| POST | `/accounts/{email}/mark-fixed` | Account | Mark account as fixed |
| GET | `/accounts/ctd/status` | Account | Custom tracking domain status |
| POST | `/accounts/move` | Account | Move accounts between workspaces |

### Campaign (17)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/campaigns` | Campaign | Create campaign (requires `campaign_schedule`) |
| GET | `/campaigns` | Campaign | List campaigns |
| GET | `/campaigns/{id}` | Campaign | Get campaign by ID |
| PATCH | `/campaigns/{id}` | Campaign | Update campaign |
| DELETE | `/campaigns/{id}` | Campaign | Delete campaign |
| POST | `/campaigns/{id}/activate` | Campaign | Activate/resume campaign |
| POST | `/campaigns/{id}/pause` | Campaign | Pause campaign |
| GET | `/campaigns/search-by-contact` | Campaign | Search campaigns by lead email |
| POST | `/campaigns/{id}/share` | Campaign | Share campaign |
| POST | `/campaigns/{id}/from-export` | Campaign | Import from export |
| POST | `/campaigns/{id}/export` | Campaign | Export campaign |
| POST | `/campaigns/{id}/duplicate` | Campaign | Duplicate campaign |
| GET | `/campaigns/count-launched` | Campaign | Count launched campaigns |
| POST | `/campaigns/{id}/variables` | Campaign | Add campaign variables |
| GET | `/campaigns/{id}/sending-status` | Campaign | Get sending status |

### Email / Unibox (8)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/emails/reply` | Email | Reply to email (`reply_to_uuid`) |
| POST | `/emails/forward` | Email | Forward email |
| GET | `/emails` | Email | List emails (rate limit: 20 req/min) |
| GET | `/emails/{id}` | Email | Get email by ID |
| PATCH | `/emails/{id}` | Email | Update email (only `is_unread`, `reminder_ts`) |
| DELETE | `/emails/{id}` | Email | Delete email |
| GET | `/emails/unread/count` | Email | Count unread emails |
| POST | `/emails/threads/{thread_id}/mark-as-read` | Email | Mark thread as read |

### Email Verification (2)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/email-verification` | EmailVerification | Verify email address |
| GET | `/email-verification/{email}` | EmailVerification | Get verification status |

### Lead List (6)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/lead-lists` | LeadList | Create lead list |
| GET | `/lead-lists` | LeadList | List lead lists |
| GET | `/lead-lists/{id}` | LeadList | Get lead list by ID |
| PATCH | `/lead-lists/{id}` | LeadList | Update lead list |
| DELETE | `/lead-lists/{id}` | LeadList | Delete lead list |
| GET | `/lead-lists/{id}/verification-stats` | LeadList | Verification statistics |

### Lead (13)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/leads` | Lead | Create single lead |
| DELETE | `/leads` | Lead | Bulk delete leads |
| POST | `/leads/list` | Lead | List leads (POST, complex filters) |
| GET | `/leads/{id}` | Lead | Get lead by ID |
| PATCH | `/leads/{id}` | Lead | Update lead |
| DELETE | `/leads/{id}` | Lead | Delete lead |
| POST | `/leads/merge` | Lead | Merge two leads |
| POST | `/leads/update-interest-status` | Lead | Update interest status (async 202) |
| POST | `/leads/subsequence/remove` | Lead | Remove lead from subsequence |
| POST | `/leads/bulk-assign` | Lead | Bulk assign leads (async 202) |
| POST | `/leads/move` | Lead | Move leads (returns BackgroundJob) |
| POST | `/leads/subsequence/move` | Lead | Move lead to subsequence |
| POST | `/leads/add` | Lead | Bulk add leads (max 1000) |

### SuperSearch Enrichment (10)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/supersearch-enrichment/count-leads-from-supersearch` | SuperSearch | Count matching leads (no credits) |
| POST | `/supersearch-enrichment/preview-leads-from-supersearch` | SuperSearch | Preview sample leads (no credits, camelCase) |
| POST | `/supersearch-enrichment/enrich-leads-from-supersearch` | SuperSearch | Source & enrich leads (**consumes credits**) |
| GET | `/supersearch-enrichment/{resource_id}` | SuperSearch | Get enrichment status (poll) |
| POST | `/supersearch-enrichment` | SuperSearch | Create enrichment on resource |
| PATCH | `/supersearch-enrichment/{resource_id}/settings` | SuperSearch | Update enrichment settings |
| POST | `/supersearch-enrichment/ai` | SuperSearch | Create AI enrichment |
| GET | `/supersearch-enrichment/ai/{resource_id}/in-progress` | SuperSearch | Check AI enrichment progress |
| GET | `/supersearch-enrichment/history/{resource_id}` | SuperSearch | Get enrichment history |
| POST | `/supersearch-enrichment/run` | SuperSearch | Run enrichment |

### Campaign Subsequence (9)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/subsequences` | Subsequence | Create subsequence |
| GET | `/subsequences` | Subsequence | List subsequences (requires `parent_campaign`) |
| GET | `/subsequences/{id}` | Subsequence | Get subsequence by ID |
| PATCH | `/subsequences/{id}` | Subsequence | Update subsequence |
| DELETE | `/subsequences/{id}` | Subsequence | Delete subsequence |
| POST | `/subsequences/{id}/duplicate` | Subsequence | Duplicate subsequence |
| POST | `/subsequences/{id}/pause` | Subsequence | Pause subsequence |
| POST | `/subsequences/{id}/resume` | Subsequence | Resume subsequence |
| GET | `/subsequences/{id}/sending-status` | Subsequence | Sending status |

### Webhook (8)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/webhooks` | Webhook | List webhooks |
| POST | `/webhooks` | Webhook | Create webhook |
| GET | `/webhooks/{id}` | Webhook | Get webhook by ID |
| PATCH | `/webhooks/{id}` | Webhook | Update webhook |
| DELETE | `/webhooks/{id}` | Webhook | Delete webhook |
| GET | `/webhooks/event-types` | Webhook | List event types |
| POST | `/webhooks/{id}/test` | Webhook | Test webhook |
| POST | `/webhooks/{id}/resume` | Webhook | Resume disabled webhook |

### Webhook Event (4)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/webhook-events` | WebhookEvent | List webhook events |
| GET | `/webhook-events/{id}` | WebhookEvent | Get event by ID |
| GET | `/webhook-events/summary` | WebhookEvent | Event summary |
| GET | `/webhook-events/summary-by-date` | WebhookEvent | Event summary by date |

### Custom Tag (6)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/custom-tags` | CustomTag | Create tag |
| GET | `/custom-tags` | CustomTag | List tags |
| GET | `/custom-tags/{id}` | CustomTag | Get tag by ID |
| PATCH | `/custom-tags/{id}` | CustomTag | Update tag |
| DELETE | `/custom-tags/{id}` | CustomTag | Delete tag |
| POST | `/custom-tags/toggle-resource` | CustomTag | Toggle tag on resource |

### Custom Tag Mapping (1)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/custom-tag-mappings` | CustomTagMapping | List tag-resource mappings |

### Block List Entry (8)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/block-lists-entries` | BlockList | Create entry |
| GET | `/block-lists-entries` | BlockList | List entries |
| GET | `/block-lists-entries/{id}` | BlockList | Get entry by ID |
| PATCH | `/block-lists-entries/{id}` | BlockList | Update entry |
| DELETE | `/block-lists-entries/{id}` | BlockList | Delete entry |
| DELETE | `/block-lists-entries` | BlockList | Delete all entries |
| POST | `/block-lists-entries/bulk` | BlockList | Bulk create entries |
| DELETE | `/block-lists-entries/bulk` | BlockList | Bulk delete entries |

### Lead Label (6)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/lead-labels` | LeadLabel | Create label |
| GET | `/lead-labels` | LeadLabel | List labels |
| GET | `/lead-labels/{id}` | LeadLabel | Get label by ID |
| PATCH | `/lead-labels/{id}` | LeadLabel | Update label |
| DELETE | `/lead-labels/{id}` | LeadLabel | Delete label |
| POST | `/lead-labels/ai-reply-label` | LeadLabel | AI reply labelling |

### Background Job (2)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/background-jobs` | BackgroundJob | List background jobs |
| GET | `/background-jobs/{id}` | BackgroundJob | Get job by ID |

### Workspace (6)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/workspaces/current` | Workspace | Get current workspace |
| PATCH | `/workspaces/current` | Workspace | Update current workspace |
| POST | `/workspaces/current/whitelabel-domain` | Workspace | Set whitelabel domain |
| GET | `/workspaces/current/whitelabel-domain` | Workspace | Get whitelabel domain |
| DELETE | `/workspaces/current/whitelabel-domain` | Workspace | Delete whitelabel domain |
| POST | `/workspaces/current/change-owner` | Workspace | Change workspace owner |

### Workspace Member (5)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/workspace-members` | WorkspaceMember | Add member |
| GET | `/workspace-members` | WorkspaceMember | List members |
| GET | `/workspace-members/{id}` | WorkspaceMember | Get member by ID |
| PATCH | `/workspace-members/{id}` | WorkspaceMember | Update member |
| DELETE | `/workspace-members/{id}` | WorkspaceMember | Remove member |

### Workspace Group Member (5)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/workspace-group-members` | WorkspaceGroupMember | Add group member |
| GET | `/workspace-group-members` | WorkspaceGroupMember | List group members |
| GET | `/workspace-group-members/{id}` | WorkspaceGroupMember | Get member by ID |
| DELETE | `/workspace-group-members/{id}` | WorkspaceGroupMember | Remove member |
| GET | `/workspace-group-members/admin` | WorkspaceGroupMember | Get admin member |

### Account Campaign Mapping (1)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/account-campaign-mappings/{email}` | AccountCampaignMapping | Campaigns linked to account |

### API Key (3)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/api-keys` | ApiKey | Create API key (with scopes) |
| GET | `/api-keys` | ApiKey | List API keys |
| DELETE | `/api-keys/{id}` | ApiKey | Delete API key |

### Inbox Placement Test (6)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/inbox-placement-tests` | InboxPlacement | Create test |
| GET | `/inbox-placement-tests` | InboxPlacement | List tests |
| GET | `/inbox-placement-tests/{id}` | InboxPlacement | Get test by ID |
| DELETE | `/inbox-placement-tests/{id}` | InboxPlacement | Delete test |
| PATCH | `/inbox-placement-tests/{id}` | InboxPlacement | Update test |
| GET | `/inbox-placement-tests/email-service-provider-options` | InboxPlacement | ESP options |

### Inbox Placement Analytics (5)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/inbox-placement-analytics` | InboxPlacementAnalytics | List analytics |
| GET | `/inbox-placement-analytics/{id}` | InboxPlacementAnalytics | Get by ID |
| POST | `/inbox-placement-analytics/stats-by-test-id` | InboxPlacementAnalytics | Stats by test ID |
| POST | `/inbox-placement-analytics/deliverability-insights` | InboxPlacementAnalytics | Deliverability insights |
| POST | `/inbox-placement-analytics/stats-by-date` | InboxPlacementAnalytics | Stats by date |

### Inbox Placement Reports (2)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/inbox-placement-reports` | InboxPlacementReport | List reports |
| GET | `/inbox-placement-reports/{id}` | InboxPlacementReport | Get report by ID |

### DFY Email Account Order (7)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| POST | `/dfy-email-account-orders` | DFYOrder | Create DFY order |
| GET | `/dfy-email-account-orders` | DFYOrder | List orders |
| POST | `/dfy-email-account-orders/domains/similar` | DFYOrder | Generate similar domains |
| POST | `/dfy-email-account-orders/domains/check` | DFYOrder | Check domain availability |
| POST | `/dfy-email-account-orders/domains/pre-warmed-up-list` | DFYOrder | Pre-warmed-up domains list |
| GET | `/dfy-email-account-orders/accounts` | DFYOrder | List DFY accounts |
| POST | `/dfy-email-account-orders/accounts/cancel` | DFYOrder | Cancel DFY accounts |

### Workspace Billing (2)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/workspace-billing/plan-details` | WorkspaceBilling | Plan details |
| GET | `/workspace-billing/subscription-details` | WorkspaceBilling | Subscription details |

### Audit Log (1)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/audit-logs` | AuditLog | List audit logs |

### CRM Actions (2)

| Method | Path | Resource Group | Description |
|--------|------|----------------|-------------|
| GET | `/crm-actions/phone-numbers` | CRMActions | List phone numbers |
| DELETE | `/crm-actions/phone-numbers/{id}` | CRMActions | Delete phone number |

---

## File Comparison: instantly-api.json vs instantly-api2.json

Both files are **identical HTML pages** (161KB each) returned by `https://developer.instantly.ai/openapi.json`. The Instantly developer portal is a Redocly SPA — it serves HTML regardless of the URL path. Neither file contains a valid OpenAPI JSON spec.

**Conclusion**: The authoritative reference is `docs/INSTANTLY-API.md` which was built from:
1. The `instantly-schema.txt` raw API schema dump (5995 lines)
2. Developer portal scraping via WebFetch agents
3. Live API testing and validation

The scraped data from our agents confirmed and enriched the existing `INSTANTLY-API.md` reference with:
- Complete request/response schemas for Email, Account, LeadList, Subsequence
- Detailed query parameters for all list endpoints
- New fields: `cc_list`, `bcc_list`, `owned_by`, `ai_sdr_id`, `provider_routing_rules` on Campaign
- Block list bulk endpoints (`/bulk` create/delete)
- Complete `search_filters` schema for SuperSearch
