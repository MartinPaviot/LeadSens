import { ToolUnavailableError } from '../types';
import { cacheGetOrFetch, cacheKey, TTL } from './cache';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

// ─── Types ────────────────────────────────────────────────

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  metaDescription: string;
  wordCount?: number;
  h2s?: string[];
}

export interface AiOverviewResult {
  detected: boolean;
  sources: string[];
  snippet?: string;
}

// ─── Core SERP fetch ──────────────────────────────────────

async function fetchSerp(params: Record<string, string>): Promise<unknown> {
  const url = new URL(SERPAPI_BASE);
  url.searchParams.set('api_key', process.env.SERPAPI_KEY!);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Organic SERP results ─────────────────────────────────

export async function getSerp(
  keyword: string,
  geo: string,
  limit = 10,
): Promise<SerpResult[]> {
  const key = cacheKey.serp(keyword, geo);

  return cacheGetOrFetch(key, TTL.SERP, async () => {
    try {
      const data = await fetchSerp({
        q: keyword,
        gl: geoToCountryCode(geo),
        hl: geoToLanguage(geo),
        google_domain: geoToGoogleDomain(geo),
        num: String(Math.min(limit, 10)),
        engine: 'google',
      }) as {
        organic_results?: {
          position: number;
          link: string;
          title: string;
          snippet?: string;
        }[];
      };

      return (data.organic_results ?? []).slice(0, limit).map((r) => ({
        position: r.position,
        url: r.link,
        title: r.title,
        metaDescription: r.snippet ?? '',
        wordCount: undefined,
        h2s: [],
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('serpApi:organic', 'core/tools');
    }
  });
}

// ─── AI Overview detection (Google SGE) ──────────────────

export async function detectAiOverview(
  keyword: string,
  geo: string,
): Promise<AiOverviewResult> {
  const key = cacheKey.serp(`aio:${keyword}`, geo);

  return cacheGetOrFetch(key, TTL.SERP, async () => {
    try {
      const data = await fetchSerp({
        q: keyword,
        gl: geoToCountryCode(geo),
        hl: geoToLanguage(geo),
        google_domain: geoToGoogleDomain(geo),
        engine: 'google',
      }) as {
        ai_overview?: {
          snippet?: string;
          sources?: { link: string }[];
        };
      };

      const aio = data.ai_overview;
      if (!aio) {
        return { detected: false, sources: [] };
      }

      return {
        detected: true,
        sources: (aio.sources ?? []).map((s) => s.link),
        snippet: aio.snippet,
      };
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('serpApi:aiOverview', 'core/tools');
    }
  });
}

// ─── Competitor meta benchmark ────────────────────────────

export async function getCompetitorMetas(
  keyword: string,
  geo: string,
  limit = 5,
): Promise<{ url: string; title: string; metaDescription: string }[]> {
  const key = cacheKey.competitor('metas', keyword);

  return cacheGetOrFetch(key, TTL.COMPETITOR, async () => {
    try {
      const results = await getSerp(keyword, geo, limit);
      return results.map((r) => ({
        url: r.url,
        title: r.title,
        metaDescription: r.metaDescription,
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('serpApi:competitorMetas', 'core/tools');
    }
  });
}

// ─── People Also Ask ──────────────────────────────────────

export async function getPeopleAlsoAsk(
  keyword: string,
  geo: string,
): Promise<string[]> {
  const key = cacheKey.serp(`paa:${keyword}`, geo);

  return cacheGetOrFetch(key, TTL.SERP, async () => {
    try {
      const data = await fetchSerp({
        q: keyword,
        gl: geoToCountryCode(geo),
        hl: geoToLanguage(geo),
        google_domain: geoToGoogleDomain(geo),
        engine: 'google',
      }) as {
        related_questions?: { question: string }[];
      };

      return (data.related_questions ?? []).map((q) => q.question);
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('serpApi:paa', 'core/tools');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────

function geoToCountryCode(geo: string): string {
  const map: Record<string, string> = {
    FR: 'fr', BE: 'be', CH: 'ch', GB: 'gb', US: 'us',
    DE: 'de', ES: 'es', IT: 'it', NL: 'nl', CA: 'ca',
    Paris: 'fr', Lyon: 'fr', Marseille: 'fr', Bordeaux: 'fr',
    Bruxelles: 'be', Genève: 'ch', Zurich: 'ch',
  };
  return map[geo] ?? 'fr';
}

function geoToLanguage(geo: string): string {
  const map: Record<string, string> = {
    FR: 'fr', BE: 'fr', CH: 'fr', GB: 'en', US: 'en',
    DE: 'de', ES: 'es', IT: 'it', NL: 'nl', CA: 'fr',
    Paris: 'fr', Lyon: 'fr', Marseille: 'fr', Bordeaux: 'fr',
    Bruxelles: 'fr', Genève: 'fr', Zurich: 'de',
  };
  return map[geo] ?? 'fr';
}

function geoToGoogleDomain(geo: string): string {
  const map: Record<string, string> = {
    FR: 'google.fr', BE: 'google.be', CH: 'google.ch',
    GB: 'google.co.uk', US: 'google.com', DE: 'google.de',
    ES: 'google.es', IT: 'google.it', NL: 'google.nl', CA: 'google.ca',
    Paris: 'google.fr', Lyon: 'google.fr', Marseille: 'google.fr',
    Bruxelles: 'google.be', Genève: 'google.ch', Zurich: 'google.ch',
  };
  return map[geo] ?? 'google.fr';
}
