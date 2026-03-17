# Integration Test Suite

Run a full end-to-end test of every LeadSens integration connector.

## Steps

1. **Check env vars** — List all integration API keys available in `.env` (values masked)
2. **Query DB** — Read the `Integration` table to find all connected integrations with their encrypted keys
3. **Test each connector** — For each connected integration:
   - Decrypt the stored API key
   - Call the connector's `testConnection()` function (defined in `src/server/lib/integrations/registry.ts`)
   - For ESPs: list accounts/campaigns (read-only)
   - For Email Verification: check credits
   - For CRMs: list contacts (limit=1)
   - For Export: verify function exists
   - Measure latency
4. **Test infrastructure services** — Jina Reader, Apify, TinyFish (keys in env, not DB)
5. **TypeScript health check** — Run `npx tsc --noEmit` and report any connector errors
6. **Generate report** — Save to `.claude/integration-tests/report-{date}.md`

## Rules
- ALL API calls are READ-ONLY. Never create, update, or delete anything.
- Use Node.js `fetch()` for API calls (not curl — Windows schannel SSL issues)
- Log every result with status, latency, and response summary
- For connectors without a stored key, log "NOT CONNECTED — skip"
- For "coming_soon" connectors, log "COMING SOON — no test"

## Report format
See `.claude/integration-tests/report-2026-03-16.md` for the template.
