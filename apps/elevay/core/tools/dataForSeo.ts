import { ToolUnavailableError } from '../types';
import { cacheGetOrFetch, cacheKey, TTL } from './cache';

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';

function basicAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN!;
  const password = process.env.DATAFORSEO_PASSWORD!;
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
}

async function dataForSeoPost<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${DATAFORSEO_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DataForSEO ${endpoint} — HTTP ${res.status}`);
  }

  const json = await res.json() as { status_code: number; tasks: { result: T }[] };

  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO ${endpoint} — status ${json.status_code}`);
  }

  return json.tasks[0]?.result ?? ([] as unknown as T);
}

// ─── Types ────────────────────────────────────────────────

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intent: string;
  geo: string;
}

export interface CrawlResult {
  url: string;
  statusCode: number;
  indexable: boolean;
  canonical?: string;
  title?: string;
  metaDescription?: string;
  internalLinks: string[];
  issues: string[];
}

// ─── Keyword Data API ─────────────────────────────────────

export async function getKeywordData(
  keywords: string[],
  geo: string,
): Promise<KeywordData[]> {
  const key = cacheKey.keywords(keywords.join(','), geo);

  return cacheGetOrFetch(key, TTL.KEYWORDS, async () => {
    try {
      type RawKw = {
        keyword: string;
        keyword_info: { search_volume: number; cpc: number };
        keyword_properties: { keyword_difficulty: number };
        search_intent_info: { main_intent: string };
      };

      const result = await dataForSeoPost<RawKw[]>(
        '/keywords_data/google_ads/search_volume/live',
        [{
          keywords,
          location_name: geoToLocation(geo),
          language_name: 'French',
        }],
      );

      return result.map((kw) => ({
        keyword: kw.keyword,
        volume: kw.keyword_info?.search_volume ?? 0,
        difficulty: kw.keyword_properties?.keyword_difficulty ?? 50,
        cpc: kw.keyword_info?.cpc ?? 0,
        intent: kw.search_intent_info?.main_intent ?? 'informational',
        geo,
      }));
    } catch {
      throw new ToolUnavailableError('dataForSeo:keywords', 'core/tools');
    }
  });
}

// ─── On-Page Crawl API ────────────────────────────────────

export async function crawlSite(siteUrl: string): Promise<CrawlResult[]> {
  const key = cacheKey.crawl(siteUrl);

  return cacheGetOrFetch(key, TTL.CRAWL, async () => {
    try {
      // Step 1 — create task
      type TaskPostResult = { id: string }[];

      const tasks = await dataForSeoPost<TaskPostResult>(
        '/on_page/task_post',
        [{
          target: siteUrl,
          max_crawl_pages: 100,
          load_resources: false,
          enable_javascript: false,
          check_spell: false,
        }],
      );

      const taskId = tasks[0]?.id;
      if (!taskId) throw new Error('No task ID returned');

      // Step 2 — poll until ready (max 30s)
      await pollUntilReady(taskId, '/on_page/summary', 30);

      // Step 3 — fetch pages
      type RawPage = {
        url: string;
        status_code: number;
        meta: {
          canonical: string;
          title: string;
          description: string;
          follow: boolean;
          robots: string;
        };
        resource_errors: { error_message: string }[];
      };

      const pages = await dataForSeoPost<RawPage[]>(
        '/on_page/pages',
        [{ id: taskId, limit: 100 }],
      );

      return pages.map((p) => ({
        url: p.url,
        statusCode: p.status_code,
        indexable: p.meta?.robots !== 'noindex' && p.meta?.follow !== false,
        canonical: p.meta?.canonical,
        title: p.meta?.title,
        metaDescription: p.meta?.description,
        internalLinks: [],
        issues: (p.resource_errors ?? []).map((e) => e.error_message),
      }));
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('dataForSeo:crawl', 'core/tools');
    }
  });
}

// ─── SERP Rankings API ────────────────────────────────────

export async function getRankings(
  domain: string,
  keywords: string[],
  geo: string,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  for (const keyword of keywords) {
    const key = cacheKey.ranking(domain, keyword, geo);

    const position = await cacheGetOrFetch(key, TTL.RANKING, async () => {
      try {
        type SerpItem = {
          type: string;
          domain: string;
          rank_absolute: number;
        };

        type SerpResult = { items: SerpItem[] }[];

        const serp = await dataForSeoPost<SerpResult>(
          '/serp/google/organic/live/advanced',
          [{
            keyword,
            location_name: geoToLocation(geo),
            language_name: 'French',
            depth: 30,
          }],
        );

        const items = serp[0]?.items ?? [];
        const match = items.find(
          (item) => item.type === 'organic' && item.domain === domain,
        );

        return match?.rank_absolute ?? 100;
      } catch {
        throw new ToolUnavailableError('dataForSeo:rankings', 'core/tools');
      }
    });

    results[keyword] = position;
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────

async function pollUntilReady(
  taskId: string,
  endpoint: string,
  maxSeconds: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    await delay(2000);
    try {
      type SummaryResult = { crawl_progress: string }[];
      const summary = await dataForSeoPost<SummaryResult>(
        endpoint,
        [{ id: taskId }],
      );
      if (summary[0]?.crawl_progress === 'finished') return;
    } catch {
      // continue polling
    }
  }
  throw new Error(`DataForSEO task ${taskId} timed out after ${maxSeconds}s`);
}

function geoToLocation(geo: string): string {
  const map: Record<string, string> = {
    FR: 'France',
    BE: 'Belgium',
    CH: 'Switzerland',
    GB: 'United Kingdom',
    US: 'United States',
    DE: 'Germany',
    ES: 'Spain',
    IT: 'Italy',
    NL: 'Netherlands',
    CA: 'Canada',
    // cities
    Paris: 'Paris,Ile-de-France,France',
    Lyon: 'Lyon,Auvergne-Rhone-Alpes,France',
    Marseille: 'Marseille,Provence-Alpes-Cote d\'Azur,France',
    Bordeaux: 'Bordeaux,Nouvelle-Aquitaine,France',
    Bruxelles: 'Brussels,Brussels Capital,Belgium',
  };
  return map[geo] ?? geo;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
