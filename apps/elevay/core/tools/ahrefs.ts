import { ToolUnavailableError } from '../types';
import { executeAction } from './composio';
import { cacheGetOrFetch, cacheKey, TTL } from './cache';

// ─── Types ────────────────────────────────────────────────

export interface AhrefsDomainMetrics {
  domain: string;
  domainRating: number;        // DR 0-100
  urlRating: number;           // UR 0-100
  backlinks: number;
  referringDomains: number;
  organicTraffic: number;
  organicKeywords: number;
}

export interface AhrefsKeywordMetrics {
  keyword: string;
  volume: number;
  difficulty: number;          // KD 0-100
  cpc: number;
  country: string;
}

export interface AhrefsBacklinkStats {
  domain: string;
  totalBacklinks: number;
  referringDomains: number;
  dofollow: number;
  nofollow: number;
  edu: number;
  gov: number;
}

export interface AhrefsOrganicCompetitor {
  domain: string;
  commonKeywords: number;
  organicTraffic: number;
  domainRating: number;
}

export interface AhrefsOrganicKeyword {
  keyword: string;
  position: number;
  volume: number;
  difficulty: number;
  url: string;
  trafficShare: number;
}

// ─── Domain Rating (used by PIO-05 for E-E-A-T scoring) ──

export async function ahrefsGetDomainRating(
  domain: string,
  userId: string,
): Promise<AhrefsDomainMetrics | null> {
  const key = cacheKey.competitor(domain, 'dr');

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_DOMAIN_RATING_FOR_SITE_EXPLORER',
        { target: domain, mode: 'domain' },
        userId,
      ) as {
        domain_rating?: number;
        url_rating?: number;
        backlinks?: number;
        refdomains?: number;
        org_traffic?: number;
        org_keywords?: number;
      };

      return {
        domain,
        domainRating: result.domain_rating ?? 0,
        urlRating: result.url_rating ?? 0,
        backlinks: result.backlinks ?? 0,
        referringDomains: result.refdomains ?? 0,
        organicTraffic: result.org_traffic ?? 0,
        organicKeywords: result.org_keywords ?? 0,
      };
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:domainRating', 'core/tools');
    }
  });
}

// ─── Backlink stats (used by PIO-05 for E-E-A-T + authoritative backlinks axis) ──

export async function ahrefsGetBacklinkStats(
  domain: string,
  userId: string,
): Promise<AhrefsBacklinkStats | null> {
  const key = cacheKey.competitor(domain, 'backlinks');

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_BACKLINKS_STATS_RETRIEVAL',
        { target: domain, mode: 'domain' },
        userId,
      ) as {
        backlinks?: number;
        refdomains?: number;
        dofollow?: number;
        nofollow?: number;
        gov?: number;
        edu?: number;
      };

      return {
        domain,
        totalBacklinks: result.backlinks ?? 0,
        referringDomains: result.refdomains ?? 0,
        dofollow: result.dofollow ?? 0,
        nofollow: result.nofollow ?? 0,
        edu: result.edu ?? 0,
        gov: result.gov ?? 0,
      };
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:backlinkStats', 'core/tools');
    }
  });
}

// ─── Keyword overview (used by KGA-08 for KD + volume enrichment) ──

export async function ahrefsGetKeywordMetrics(
  keywords: string[],
  country: string,
  userId: string,
): Promise<AhrefsKeywordMetrics[]> {
  const key = cacheKey.keywords(keywords.join(','), `ahrefs:${country}`);

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_EXPLORE_KEYWORDS_OVERVIEW',
        {
          keywords,
          country: country.toLowerCase(),
        },
        userId,
      ) as {
        keywords?: {
          keyword: string;
          volume: number;
          difficulty: number;
          cpc: number;
        }[];
      };

      return (result.keywords ?? []).map((kw) => ({
        keyword: kw.keyword,
        volume: kw.volume ?? 0,
        difficulty: kw.difficulty ?? 50,
        cpc: kw.cpc ?? 0,
        country,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:keywordMetrics', 'core/tools');
    }
  });
}

// ─── Keyword volume by country (used by KGA-08 for multi-GEO scoring) ──

export async function ahrefsGetVolumeByCountry(
  keyword: string,
  userId: string,
): Promise<Record<string, number>> {
  const key = cacheKey.keywords(keyword, 'ahrefs:all-countries');

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_EXPLORE_KEYWORD_VOLUME_BY_COUNTRY',
        { keyword },
        userId,
      ) as {
        countries?: { country: string; volume: number }[];
      };

      return Object.fromEntries(
        (result.countries ?? []).map((c) => [c.country.toUpperCase(), c.volume]),
      );
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:volumeByCountry', 'core/tools');
    }
  });
}

// ─── Organic competitors (used by KGA-08 + PIO-05) ──

export async function ahrefsGetOrganicCompetitors(
  domain: string,
  userId: string,
): Promise<AhrefsOrganicCompetitor[]> {
  const key = cacheKey.competitor(domain, 'ahrefs:competitors');

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_RETRIEVE_ORGANIC_COMPETITORS',
        { target: domain, mode: 'domain', limit: 10 },
        userId,
      ) as {
        competitors?: {
          domain: string;
          common_keywords: number;
          org_traffic: number;
          domain_rating: number;
        }[];
      };

      return (result.competitors ?? []).map((c) => ({
        domain: c.domain,
        commonKeywords: c.common_keywords ?? 0,
        organicTraffic: c.org_traffic ?? 0,
        domainRating: c.domain_rating ?? 0,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:organicCompetitors', 'core/tools');
    }
  });
}

// ─── Organic keywords (used by OPT-06 for ranking gap analysis) ──

export async function ahrefsGetOrganicKeywords(
  domain: string,
  country: string,
  userId: string,
  limit = 50,
): Promise<AhrefsOrganicKeyword[]> {
  const key = cacheKey.ranking(domain, 'organic-kw', `ahrefs:${country}`);

  return cacheGetOrFetch(key, TTL.RANKING, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_RETRIEVE_ORGANIC_KEYWORDS',
        {
          target: domain,
          country: country.toLowerCase(),
          mode: 'domain',
          limit,
        },
        userId,
      ) as {
        keywords?: {
          keyword: string;
          position: number;
          volume: number;
          difficulty: number;
          url: string;
          traffic_share: number;
        }[];
      };

      return (result.keywords ?? []).map((kw) => ({
        keyword: kw.keyword,
        position: kw.position ?? 0,
        volume: kw.volume ?? 0,
        difficulty: kw.difficulty ?? 50,
        url: kw.url ?? '',
        trafficShare: kw.traffic_share ?? 0,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:organicKeywords', 'core/tools');
    }
  });
}

// ─── Top pages by traffic (used by OPT-06 + PIO-05) ──

export async function ahrefsGetTopPages(
  domain: string,
  country: string,
  userId: string,
  limit = 20,
): Promise<{ url: string; traffic: number; keywords: number }[]> {
  const key = cacheKey.ranking(domain, 'top-pages', `ahrefs:${country}`);

  return cacheGetOrFetch(key, TTL.RANKING, async () => {
    try {
      const result = await executeAction(
        'ahrefs',
        'AHREFS_RETRIEVE_TOP_PAGES_FROM_SITE_EXPLORER',
        {
          target: domain,
          country: country.toLowerCase(),
          mode: 'domain',
          limit,
        },
        userId,
      ) as {
        pages?: {
          url: string;
          traffic: number;
          keywords: number;
        }[];
      };

      return (result.pages ?? []).map((p) => ({
        url: p.url,
        traffic: p.traffic ?? 0,
        keywords: p.keywords ?? 0,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('ahrefs:topPages', 'core/tools');
    }
  });
}
