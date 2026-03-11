# CURRENT

## Tâche: T3-SCORE-02 Broadened filters → scoring signals
## Réf: STRATEGY.md §6.2, §7.3.3
## Tier: 3
## Impact attendu: Leads matching originally-requested criteria get boosted scores after broadening
## Status: IN_PROGRESS
## Démarré: 2026-03-11

### Analyse
When count_leads returns 0, it progressively removes filters (news, funding_type, technologies, keyword_filter, job_listing, employee_count, revenue, job_titles, industries). The removed filter names are tracked in `broadened_fields` array and returned to the LLM, but they're never stored or used downstream. After broadening, all sourced leads are scored identically — a lead matching the original narrower criteria gets no advantage over one that doesn't.

### Plan
- [ ] 1. Add `broadenedFields String[]` to Campaign model + migration
- [ ] 2. Store broadened_fields in source_leads when creating Campaign
- [ ] 3. Fetch broadened fields in enrich_leads_batch and pass to computeSignalBoost
- [ ] 4. Add broadenedFields parameter to computeSignalBoost with bonus logic
- [ ] 5. Write unit tests for broadening bonus logic
- [ ] 6. Typecheck + test + commit

### Fichiers impactés
- `prisma/schema.prisma` — add broadenedFields String[]
- `src/server/lib/tools/sourcing-tools.ts` — store broadened_fields on Campaign
- `src/server/lib/tools/enrichment-tools.ts` — fetch & pass broadened fields to scorer
- `src/server/lib/enrichment/icp-scorer.ts` — add broadenedFields bonus logic to computeSignalBoost

### Tests à écrire
- `tests/broadening-scoring.test.ts` — broadening bonus logic in computeSignalBoost

### Risques
- Schema change → need migration → mitigated by simple additive field (String[], default [])
- Over-boosting → mitigated by conservative +1 bonus per matching field, capped
