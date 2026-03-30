import { ToolUnavailableError } from '../types';
import { executeAction } from './composio';
import { cacheGetOrFetch, cacheKey, TTL } from './cache';

// ─── Types ────────────────────────────────────────────────

export interface SemrushKeywordData {
  keyword: string;
  volume: number;
  difficulty: number;          // KD 0-100
  cpc: number;
  competition: number;         // 0-1
  results: number;             // SERP results count
  database: string;            // regional DB (fr, be, etc.)
}

export interface SemrushDomainMetrics {
  domain: string;
  authorityScore: number;      // AS 0-100
  organicTraffic: number;
  organicKeywords: number;
  backlinks: number;
  referringDomains: number;
}

export interface SemrushOrganicKeyword {
  keyword: string;
  position: number;
  volume: number;
  difficulty: number;
  url: string;
  cpc: number;
}

export interface SemrushCompetitor {
  domain: string;
  commonKeywords: number;
  organicTraffic: number;
  authorityScore: number;
}

export interface SemrushRelatedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
}

// ─── Keyword difficulty (used by KGA-08 for scoring 4 axes) ──

export async function semrushGetKeywordDifficulty(
  keyword: string,
  database: string,
  userId: string,
): Promise<number> {
  const key = cacheKey.keywords(`semrush:kd:${keyword}`, database);

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_KEYWORD_DIFFICULTY',
        { phrase: keyword, database: geoToSemrushDb(database) },
        userId,
      ) as { keyword_difficulty?: number };

      return result.keyword_difficulty ?? 50;
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:keywordDifficulty', 'core/tools');
    }
  });
}

// ─── Batch keyword overview (used by KGA-08 for bulk KW analysis) ──

export async function semrushGetKeywordsBatch(
  keywords: string[],
  database: string,
  userId: string,
): Promise<SemrushKeywordData[]> {
  const key = cacheKey.keywords(`semrush:batch:${keywords.join(',')}`, database);

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      // SEMrush batch supports up to 100 keywords
      const batch = keywords.slice(0, 100);
      const result = await executeAction(
        'semrush',
        'SEMRUSH_BATCH_KEYWORD_OVERVIEW',
        {
          phrases: batch,
          database: geoToSemrushDb(database),
        },
        userId,
      ) as {
        data?: {
          keyword: string;
          search_volume: number;
          keyword_difficulty_index: number;
          cpc: number;
          competition: number;
          results: number;
        }[];
      };

      return (result.data ?? []).map((kw) => ({
        keyword: kw.keyword,
        volume: kw.search_volume ?? 0,
        difficulty: kw.keyword_difficulty_index ?? 50,
        cpc: kw.cpc ?? 0,
        competition: kw.competition ?? 0,
        results: kw.results ?? 0,
        database,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:keywordsBatch', 'core/tools');
    }
  });
}

// ─── Domain authority score (used by PIO-05 for E-E-A-T scoring) ──

export async function semrushGetAuthorityScore(
  domain: string,
  userId: string,
): Promise<SemrushDomainMetrics | null> {
  const key = cacheKey.competitor(domain, 'semrush:as');

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_AUTHORITY_SCORE_PROFILE',
        { target: domain },
        userId,
      ) as {
        authority_score?: number;
        organic_traffic?: number;
        organic_keywords?: number;
        backlinks?: number;
        referring_domains?: number;
      };

      return {
        domain,
        authorityScore: result.authority_score ?? 0,
        organicTraffic: result.organic_traffic ?? 0,
        organicKeywords: result.organic_keywords ?? 0,
        backlinks: result.backlinks ?? 0,
        referringDomains: result.referring_domains ?? 0,
      };
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:authorityScore', 'core/tools');
    }
  });
}

// ─── Organic keywords for a domain (used by OPT-06 + KGA-08) ──

export async function semrushGetDomainKeywords(
  domain: string,
  database: string,
  userId: string,
  limit = 50,
): Promise<SemrushOrganicKeyword[]> {
  const key = cacheKey.ranking(domain, 'semrush:kw', database);

  return cacheGetOrFetch(key, TTL.RANKING, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_DOMAIN_ORGANIC_SEARCH_KEYWORDS',
        {
          domain,
          database: geoToSemrushDb(database),
          display_limit: limit,
        },
        userId,
      ) as {
        data?: {
          keyword: string;
          position: number;
          search_volume: number;
          keyword_difficulty_index: number;
          url: string;
          cpc: number;
        }[];
      };

      return (result.data ?? []).map((kw) => ({
        keyword: kw.keyword,
        position: kw.position ?? 0,
        volume: kw.search_volume ?? 0,
        difficulty: kw.keyword_difficulty_index ?? 50,
        url: kw.url ?? '',
        cpc: kw.cpc ?? 0,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:domainKeywords', 'core/tools');
    }
  });
}

// ─── Organic competitors (used by KGA-08 + PIO-05) ──

export async function semrushGetCompetitors(
  domain: string,
  database: string,
  userId: string,
): Promise<SemrushCompetitor[]> {
  const key = cacheKey.competitor(domain, `semrush:${database}`);

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_COMPETITORS_IN_ORGANIC_SEARCH',
        {
          domain,
          database: geoToSemrushDb(database),
          display_limit: 10,
        },
        userId,
      ) as {
        data?: {
          domain: string;
          common_keywords: number;
          organic_traffic: number;
          authority_score: number;
        }[];
      };

      return (result.data ?? []).map((c) => ({
        domain: c.domain,
        commonKeywords: c.common_keywords ?? 0,
        organicTraffic: c.organic_traffic ?? 0,
        authorityScore: c.authority_score ?? 0,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:competitors', 'core/tools');
    }
  });
}

// ─── Related keywords (used by BSW-10 + KGA-08 for cluster expansion) ──

export async function semrushGetRelatedKeywords(
  keyword: string,
  database: string,
  userId: string,
  limit = 20,
): Promise<SemrushRelatedKeyword[]> {
  const key = cacheKey.keywords(`semrush:related:${keyword}`, database);

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_RELATED_KEYWORDS',
        {
          phrase: keyword,
          database: geoToSemrushDb(database),
          display_limit: limit,
        },
        userId,
      ) as {
        data?: {
          keyword: string;
          search_volume: number;
          keyword_difficulty_index: number;
          cpc: number;
        }[];
      };

      return (result.data ?? []).map((kw) => ({
        keyword: kw.keyword,
        volume: kw.search_volume ?? 0,
        difficulty: kw.keyword_difficulty_index ?? 50,
        cpc: kw.cpc ?? 0,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:relatedKeywords', 'core/tools');
    }
  });
}

// ─── Phrase questions (used by BSW-10 for PAA enrichment) ──

export async function semrushGetPhraseQuestions(
  keyword: string,
  database: string,
  userId: string,
  limit = 10,
): Promise<string[]> {
  const key = cacheKey.keywords(`semrush:questions:${keyword}`, database);

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_PHRASE_QUESTIONS',
        {
          phrase: keyword,
          database: geoToSemrushDb(database),
          display_limit: limit,
        },
        userId,
      ) as {
        data?: { keyword: string }[];
      };

      return (result.data ?? []).map((q) => q.keyword);
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:phraseQuestions', 'core/tools');
    }
  });
}

// ─── Domain vs Domain (used by KGA-08 for competitive gap) ──

export async function semrushDomainVsDomain(
  domains: string[],
  database: string,
  userId: string,
): Promise<{ keyword: string; positions: Record<string, number> }[]> {
  if (domains.length < 2 || domains.length > 5) return [];
  const key = cacheKey.competitor(domains.join(','), `semrush:dvd:${database}`);

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_DOMAIN_VS_DOMAIN',
        {
          domains,
          database: geoToSemrushDb(database),
          display_limit: 50,
        },
        userId,
      ) as {
        data?: {
          keyword: string;
          positions: Record<string, number>;
        }[];
      };

      return result.data ?? [];
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:domainVsDomain', 'core/tools');
    }
  });
}

// ─── Backlinks overview (used by PIO-05 for E-E-A-T axis) ──

export async function semrushGetBacklinksOverview(
  domain: string,
  userId: string,
): Promise<{ authorityScore: number; backlinks: number; referringDomains: number } | null> {
  const key = cacheKey.competitor(domain, 'semrush:bl-overview');

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'semrush',
        'SEMRUSH_BACKLINKS_OVERVIEW',
        { target: domain, target_type: 'root_domain' },
        userId,
      ) as {
        authority_score?: number;
        backlinks?: number;
        domains_num?: number;
      };

      return {
        authorityScore: result.authority_score ?? 0,
        backlinks: result.backlinks ?? 0,
        referringDomains: result.domains_num ?? 0,
      };
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('semrush:backlinksOverview', 'core/tools');
    }
  });
}

// ─── Helper — GEO → SEMrush database code ────────────────

function geoToSemrushDb(geo: string): string {
  const map: Record<string, string> = {
    FR: 'fr', BE: 'be', CH: 'ch', GB: 'uk', US: 'us',
    DE: 'de', ES: 'es', IT: 'it', NL: 'nl', CA: 'ca',
    // cities → country DB
    Paris: 'fr', Lyon: 'fr', Marseille: 'fr', Bordeaux: 'fr',
    Bruxelles: 'be', Genève: 'ch', Zurich: 'ch',
  };
  return map[geo] ?? 'fr';
}
