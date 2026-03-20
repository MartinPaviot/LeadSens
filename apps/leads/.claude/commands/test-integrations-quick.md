# Quick Integration Re-test

Re-test only integrations that FAILED or had WARNINGS in the last report.

## Steps

1. **Read last report** — Find the most recent file in `.claude/integration-tests/report-*.md`
2. **Extract failures** — Parse the report for lines with FAIL, WARNING, or DB_UNREACHABLE
3. **Re-test each** — Run the same tests as `/test-integrations` but ONLY for failed/warning items
4. **Compare** — Show before/after status for each re-tested item
5. **Update report** — Append a "Re-test" section to the existing report (don't overwrite)

## Rules
- ALL API calls are READ-ONLY
- Use Node.js `fetch()` for API calls
- If the DB was previously unreachable, try again — Neon may have woken up
- Focus on actionable fixes: what changed, what still needs attention
