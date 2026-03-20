# DONE

### 2026-03-09 — T1-FIX-02 Pagination listLeads (verification only)
- Réf: STRATEGY.md §6.2
- Fichiers: none (verification task)
- Tests ajoutés: none
- Impact: Confirmed all 4 callers of `listLeads` already paginate correctly (cursor-based do/while loops). No bug exists in current code.

### 2026-03-09 — T2-SUBJ-01 Subject line pattern library
- Réf: STRATEGY.md §7.2.1
- Fichiers: src/server/lib/email/prompt-builder.ts, tests/prompt-builder.test.ts (NEW)
- Tests ajoutés: 25 tests (getFramework, prioritizeSignals, buildEmailPrompt structure, subject line patterns snapshot)
- Impact: Subject lines 5/10 → 6/10. 5 patterns with 3 examples each + step mapping. Snapshot test ensures patterns don't regress.

### 2026-03-09 — T1-ENR-02 Cache par domaine persistant
- Réf: STRATEGY.md §6.2, §7.1.1
- Fichiers: prisma/schema.prisma, src/server/lib/enrichment/company-cache.ts (NEW), src/server/lib/tools/enrichment-tools.ts, tests/company-cache.test.ts (NEW), prisma/migrations/20260309210530_add_company_cache/
- Tests ajoutés: 11 tests (cache hit, cache miss, TTL expiry, null caching, onStatus callback)
- Impact: Eliminates redundant Jina scrapes between batches. Same domain within 7 days → instant cache hit (0 API calls vs 5+ Jina requests per domain).
