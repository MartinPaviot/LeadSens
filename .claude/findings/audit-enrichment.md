# Audit: Enrichissement Prospect — 2026-03-09

> Component: Enrichissement Prospect
> STRATEGY Ref: §6.2 (audit), §7.1.1 (multi-page scraping + cache)
> Research Ref: RESEARCH-LEAD-ENRICHMENT-2026.md (E1-E6)
> Score: **7/10** (target 6/10) — ✅ TARGET EXCEEDED
> Previous audit: 2026-03-09-audit-v2-with-research.md scored 7/10

---

## Current State

The enrichment pipeline is architecturally strong with a 3-layer waterfall (Apollo → LinkedIn → Website → LinkedIn-only → always advance), persistent domain caching, multi-page scraping, and a comprehensive summarizer producing 18+ structured fields.

### Files Audited

| File | Lines | Purpose |
|------|-------|---------|
| `src/server/lib/connectors/jina.ts` | 121 | Multi-page scraping via Jina Reader |
| `src/server/lib/enrichment/summarizer.ts` | 161 | LLM summarization → EnrichmentData schema |
| `src/server/lib/enrichment/company-cache.ts` | 57 | Prisma CompanyCache with 7d TTL |
| `src/server/lib/connectors/apify.ts` | 138 | LinkedIn profile scraping via Apify |
| `src/server/lib/connectors/apollo.ts` | 259 | Apollo person + organization enrichment |
| `src/server/lib/tools/enrichment-tools.ts` | 792 | Tool orchestration (batch + single) |
| `src/server/lib/enrichment/icp-scorer.ts` | 241 | Post-enrichment signal boost scoring |

### What's Implemented

1. **Multi-page scraping** — 5 pages per domain (homepage + about + blog + careers + press) with French fallback paths. `jina.ts:83-120`
2. **Persistent domain cache** — Prisma CompanyCache, 7-day TTL, upsert on miss. `company-cache.ts:25-56`
3. **LinkedIn scraping** — Apify actor `2SyF0bVxmgGr8IVCZ`, extracts headline/career/posts/companyWebsite. `apify.ts:22-137`
4. **Apollo enrichment** — Optional Step 0 when Apollo integration active, person match + org data. `apollo.ts:162-211`
5. **Structured summarizer** — 18+ fields via Zod schema, Mistral Small, includes enrichmentDiagnostic. `summarizer.ts:4-51`
6. **Signal extraction** — 6 signal types: hiringSignals, fundingSignals, productLaunches, leadershipChanges, publicPriorities, techStackChanges. `summarizer.ts:14-42`
7. **Non-blocking failures** — Leads always advance to ENRICHED. `enrichment-tools.ts:480-509`
8. **Post-enrichment signal boost** — Deterministic fit 40% + intent 35% + timing 25%. `icp-scorer.ts:157-240`
9. **Rate limiting** — 3.4s delay between Jina calls (~18 req/min). `jina.ts:2`
10. **Enrichment quality summary** — Per-lead quality diagnostic for agent context. `enrichment-tools.ts:117-168`
11. **Flat field extraction** — Dual-write: JSON blob + CSV-ready columns. `summarizer.ts:59-76`
12. **URL resolution** — 3-priority: companyDomain > website > LinkedIn-sourced URL. `enrichment-tools.ts:68-96`

---

## STRATEGY Target (§7.1.1)

> "Impact: Raises enrichment score from 2.5 to 6/10."
>
> Today: 1 page (homepage), 8K chars truncated.
> Target: 3-5 pages per enterprise (about, recent blog, careers, press), cache by domain.
>
> Data unlocked: real pain points (blog), hiring signals (careers), recent news (press), real positioning (about).

**Verdict:** All §7.1.1 targets met or exceeded. Multi-page scraping (5 pages), persistent cache (Prisma, 7d TTL), and all target data fields extracted. Score 7/10 vs 6/10 target.

---

## Research Best Practice (RESEARCH-LEAD-ENRICHMENT-2026.md)

### What research validates:
- **Intelligence layer > contact waterfall** — LeadSens's approach (company context + person context + signals) is the right differentiator vs Clay/BetterContact which focus on contact data completeness. (§E4)
- **Smaller, well-enriched lists = 3x reply rate** — 5.8% vs 2.1% (§E1). Architecture supports this.
- **Signal-based personalization = 15-25% reply rate** — timeline hooks are 2.3x better than PAS. Enrichment pipeline provides the data. (§E1)

### What research flags as gaps:
- **E3.1 — Signal recency** — Stale triggers hurt credibility. `hiringSignals`/`fundingSignals` are plain `string[]` without dates. No decay function in scoring.
- **E3.3 — Enrichment completeness score** — No metric tracks % of fields filled. Can't flag thin data to quality gate.
- **E3.4 — Failed scrape caching** — Transient failures cached for 7 days blocks retries.

---

## Gap Analysis

### Overall Assessment

The enrichment pipeline is **architecturally mature** — the waterfall, caching, multi-source fusion, and structured output are all well-designed. The remaining gaps are **refinement-level** issues, not architectural. The biggest impact items are signal recency weighting and a bug in the Apollo connector.

### Comparison to Clay/Apollo Enrichment Waterfall

| Capability | Clay ($149-720/mo) | Apollo ($49-199/mo) | LeadSens |
|---|---|---|---|
| Contact data waterfall | ✅ 75+ providers | ✅ Built-in | ✅ Via Instantly SuperSearch |
| Company intelligence | ❌ Raw firmographics | ❌ Raw firmographics | ✅ Multi-page scraping → summarization |
| Person-level context | ❌ Title/seniority only | Partial (headline) | ✅ LinkedIn career + posts + diagnostic |
| Business signals | ❌ | ❌ | ✅ 6 structured signal types |
| Connection bridge material | ❌ | ❌ | ✅ enrichmentDiagnostic |
| Persistent cache | N/A (manual) | N/A | ✅ 7d TTL Prisma |
| Signal recency weighting | ❌ | ❌ | ❌ (GAP) |
| Enrichment completeness | ❌ | ❌ | Partial (quality summary, not scored) |

**LeadSens is ahead** on intelligence depth. The gap is in refinement, not architecture.

---

## Issues

### ISSUE 1 — Apollo connector sends domain as `organization_name` (HIGH)
**File:** `apollo.ts:178`
**Code:** `if (params.domain) body.organization_name = params.domain;`
**Problem:** Apollo's `/v1/people/match` API has separate fields: `organization_name` (company name string) and `domain` (company domain). Sending a domain like `acme.com` as `organization_name` will cause mismatches or no-matches for many lookups.
**Impact:** Apollo enrichment silently returns fewer matches than it should. Users paying for Apollo get degraded results.
**Fix:** Change to `body.domain = params.domain` (1-line fix).

### ISSUE 2 — Signal recency weighting absent (HIGH)
**Files:** `summarizer.ts:14-16`, `icp-scorer.ts:177-227`
**Problem:** `hiringSignals` and `fundingSignals` are plain `string[]` — no dates, no sources. The summarizer prompt says "signals < 6 months old are 3-5x more valuable" but `computeSignalBoost()` treats a 2-year-old funding round identically to a last-week funding round. In contrast, `leadershipChanges`, `publicPriorities`, and `techStackChanges` DO have structured date/source fields.
**Impact:** Stale triggers in email openers hurt credibility (Research E3.1). A "Series A $5M" from 2024 used as an opener in 2026 looks uninformed.
**Research:** "Stale triggers actually hurt credibility. Recent triggers (< 3 months) drive 3-5x more replies." — RESEARCH-LEAD-ENRICHMENT E3.1
**Effort:** 1 day — schema migration + summarizer prompt + scorer + prompt-builder

### ISSUE 3 — Failed scrape cached for 7 days (MEDIUM)
**File:** `company-cache.ts:46-53`
**Code:**
```typescript
const markdown = await scrapeLeadCompany(url);
await prisma.companyCache.upsert({
  where: { domain },
  create: { domain, markdown, scrapedAt: new Date() },
  update: { markdown, scrapedAt: new Date() },
});
```
**Problem:** When `scrapeLeadCompany()` returns `null` (homepage scrape failed), `null` is cached with a 7-day TTL. A transient failure (Jina downtime, network glitch, temporary 429) locks out the domain for 7 days.
**Impact:** Domains that fail once due to transient issues produce unenriched leads for a full week.
**Fix:** Use shorter TTL for null results (e.g., 1 hour) or skip caching nulls entirely.

### ISSUE 4 — No tests for Jina scraper or summarizer (MEDIUM)
**Files:** No `tests/*jina*`, no `tests/*summar*`
**Existing tests:** `tests/flat-enrichment.test.ts` (18 tests for `extractFlatEnrichmentFields`), `tests/signal-boost.test.ts` (13 tests for `computeSignalBoost`)
**Problem:** `scrapeLeadCompany()`, `scrapeViaJina()`, `scrapeWithFallbacks()`, and `summarizeCompanyContext()` have zero unit tests. These are critical-path functions:
- `scrapeLeadCompany` orchestrates 5 sub-page scrapes with fallbacks
- `scrapeViaJina` handles 5 error types (not_found, timeout, rate_limit, network, empty)
- `summarizeCompanyContext` produces the entire EnrichmentData structure
**Impact:** Regressions in scraping logic would go undetected until production.
**Effort:** 0.5 day — mock Jina responses, test fallback paths and error handling.

### ISSUE 5 — 15K char truncation is naive (MEDIUM)
**File:** `jina.ts:119`
**Code:** `return combined.slice(0, 15000);`
**Problem:** Truncation is applied to the concatenated markdown after joining all sections. If homepage is 10K chars, about is 3K, blog gets 2K, and careers/press get nothing. The most valuable signal-rich pages (press, careers) are lost.
**Impact:** Hiring signals from careers pages and news from press pages — the strongest triggers for email openers — are the first to be truncated.
**Fix:** Per-section budget: allocate max chars per section (e.g., homepage 4K, about 3K, blog 3K, careers 2.5K, press 2.5K = 15K total), truncate each independently.

### ISSUE 6 — No enrichment completeness score stored on lead (MEDIUM)
**File:** `enrichment-tools.ts:117-168`
**Problem:** `summarizeEnrichmentQuality()` computes a rough quality metric (rich/partial/minimal/none) but it's only returned in the tool response — not stored on the lead record. The quality gate has no way to warn about thin data.
**Impact:** Emails drafted from leads with 3/18 enrichment fields filled will be generic. The quality gate scores email quality but can't detect thin input data.
**Research:** "Without a completeness metric, the quality gate can't flag emails built on thin data." — RESEARCH-LEAD-ENRICHMENT E3.3
**Fix:** Compute 0-1 completeness score, store as `enrichmentCompleteness` on Lead, surface in quality gate as warning if < 0.4.

### ISSUE 7 — Homepage scrape failure = total failure, no retry (LOW)
**File:** `jina.ts:97-98`
**Code:**
```typescript
const homepageResult = await scrapeViaJina(baseUrl);
if (!homepageResult.ok) return null;
```
**Problem:** If the homepage scrape fails (rate limit, timeout, network error), the entire domain scrape returns null. No retry, even for transient errors. Sub-pages have fallback paths but homepage has a single attempt.
**Impact:** A temporary 429 from Jina kills the entire scrape for that lead.
**Fix:** Add 1 retry with delay for homepage on rate_limit/timeout/network errors (not for not_found/empty).

### ISSUE 8 — Apify connector uses console.log/warn (LOW)
**File:** `apify.ts:117-119, 29, 45, 130-135`
**Problem:** 5 instances of `console.log`/`console.warn` — violates CLAUDE.md §5.13 convention (use structured logger).
**Impact:** Low — cosmetic, but inconsistent with the rest of the codebase's direction toward structured logging.

### ISSUE 9 — Summarizer doesn't receive ICP context (LOW)
**File:** `summarizer.ts:138-160`
**Problem:** The summarizer extracts generic fields from scraped content. It doesn't know what the ICP is looking for. If the user targets "companies expanding to APAC", the summarizer doesn't prioritize APAC expansion signals.
**Impact:** Low — the summarizer is comprehensive enough to extract most signals. But ICP-aware extraction could improve signal relevance for niche ICPs.
**Effort:** 0.5 day — pass ICP description to summarizer, add "prioritize signals relevant to: {icp}" in system prompt.

---

## Test Coverage Assessment

| Module | Tests | Coverage | Assessment |
|--------|-------|----------|------------|
| `extractFlatEnrichmentFields` | 18 | ✅ Comprehensive | All field mappings tested |
| `computeSignalBoost` | 13 | ✅ Comprehensive | All signal types, capping, edge cases |
| `scrapeViaJina` | 0 | ❌ None | 5 error types untested |
| `scrapeLeadCompany` | 0 | ❌ None | Multi-page orchestration untested |
| `summarizeCompanyContext` | 0 | ❌ None | LLM call, needs mock |
| `scrapeLinkedInViaApify` | 0 | ❌ None | Profile parsing untested |
| `enrichPerson` / `enrichOrganization` | 0 | ❌ None | API response parsing untested |
| `getOrScrapeCompany` | 0 | ❌ None | Cache logic untested |
| `mergeLinkedInData` / `mergeApolloData` | 0 | ❌ None | Merge logic untested |
| `resolveLeadUrl` | 0 | ❌ None | URL resolution untested |

**Verdict:** Core data extraction is well-tested. Scraping, caching, and merge functions (the integration layer) have zero tests.

---

## Recommended Tasks

### New tasks to add to BACKLOG.md (not already present):

1. **ENR-BUG-01** — Fix Apollo domain parameter bug (`apollo.ts:178`) — HIGH, 10 min
2. **ENR-CACHE-01** — Short TTL for failed scrapes in company cache — MEDIUM, 30 min
3. **ENR-TEST-01** — Unit tests for Jina scraper (mock responses, fallbacks, error handling) — MEDIUM, 2-3 hours
4. **ENR-TEST-02** — Unit tests for merge functions + resolveLeadUrl + getOrScrapeCompany — MEDIUM, 1-2 hours
5. **ENR-TRUNC-01** — Per-section char budget in multi-page scraper — MEDIUM, 1 hour
6. **ENR-COMPL-01** — Enrichment completeness score stored on lead — MEDIUM, 2 hours

### Already in BACKLOG (validated by this audit):

- Signal recency weighting → aligns with Research E3.1 recommendation (not yet a formal task — should be added)
- Style learner categorization → T3-QUAL-03 (different component)

---

## Score Justification: 7/10

| Criterion | Score | Notes |
|-----------|-------|-------|
| Multi-source data fusion | 9/10 | Apollo + LinkedIn + Website + LinkedIn-only fallback |
| Signal extraction depth | 8/10 | 6 structured signal types, narrative fields |
| Caching | 7/10 | Persistent, TTL-based. -1 for caching failures |
| Resilience | 7/10 | Non-blocking, fallbacks. -1 for no homepage retry |
| Test coverage | 4/10 | Only extraction/scoring tested, not scraping/caching/merging |
| Data freshness | 5/10 | No signal recency weighting |
| **Overall** | **7/10** | Architecturally strong. Refinement gaps in recency, testing, caching edge cases |

The component exceeds its 6/10 target but has clear room for improvement toward 8/10 with signal recency, better caching, and test coverage.
