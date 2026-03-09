# DONE

### 2026-03-09 — T1-ENR-02 Cache par domaine persistant
- Réf: STRATEGY.md §6.2, §7.1.1
- Fichiers: prisma/schema.prisma, src/server/lib/enrichment/company-cache.ts (NEW), src/server/lib/tools/enrichment-tools.ts, tests/company-cache.test.ts (NEW), prisma/migrations/20260309210530_add_company_cache/
- Tests ajoutés: 11 tests (cache hit, cache miss, TTL expiry, null caching, onStatus callback)
- Impact: Eliminates redundant Jina scrapes between batches. Same domain within 7 days → instant cache hit (0 API calls vs 5+ Jina requests per domain).
