import { ToolUnavailableError } from '../types';
import { cacheGetOrFetch, cacheKey, TTL } from './cache';
import { requireEnv } from '../../src/lib/env';

const PAGESPEED_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PAGESPEED_API_KEY = requireEnv('GOOGLE_PAGESPEED_API_KEY');

// ─── Types ────────────────────────────────────────────────

export interface CoreWebVitals {
  url: string;
  strategy: 'mobile' | 'desktop';
  lcp: number | null;   // Largest Contentful Paint (ms)
  cls: number | null;   // Cumulative Layout Shift (score)
  fid: number | null;   // First Input Delay (ms) — INP in newer reports
  fcp: number | null;   // First Contentful Paint (ms)
  ttfb: number | null;  // Time to First Byte (ms)
  performanceScore: number | null;  // 0-100
  passed: boolean;      // true if LCP < 2500ms AND CLS < 0.1
}

export interface PageSpeedBatchResult {
  results: CoreWebVitals[];
  failedUrls: string[];
}

// ─── Single URL ───────────────────────────────────────────

export async function getCoreWebVitals(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
): Promise<CoreWebVitals> {
  const key = cacheKey.pagespeed(`${url}:${strategy}`);

  return cacheGetOrFetch(key, TTL.PAGESPEED, async () => {
    try {
      const endpoint = new URL(PAGESPEED_BASE);
      endpoint.searchParams.set('url', url);
      endpoint.searchParams.set('strategy', strategy);
      endpoint.searchParams.set('key', PAGESPEED_API_KEY);
      endpoint.searchParams.set('category', 'performance');

      const res = await fetch(endpoint.toString(), {
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        throw new Error('PageSpeed API failed: HTTP ' + res.status);
      }

      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('json')) throw new Error('PageSpeed API returned non-JSON response: HTTP ' + res.status);

      const data = await res.json() as PageSpeedRawResponse;
      return parsePageSpeedResponse(url, strategy, data);
    } catch (err) {
      if (err instanceof ToolUnavailableError) throw err;
      throw new ToolUnavailableError('pagespeed', 'core/tools');
    }
  });
}

// ─── Batch (TSI-07 audits multiple pages) ─────────────────

export async function getCoreWebVitalsBatch(
  urls: string[],
  strategy: 'mobile' | 'desktop' = 'mobile',
  concurrency = 3,
): Promise<PageSpeedBatchResult> {
  const results: CoreWebVitals[] = [];
  const failedUrls: string[] = [];

  // Process in chunks to respect rate limits
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      chunk.map((url) => getCoreWebVitals(url, strategy)),
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome?.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        failedUrls.push(chunk[j] ?? '');
      }
    }

    // Rate limit pause between chunks (PageSpeed API: 400 req/100s)
    if (i + concurrency < urls.length) {
      await delay(1000);
    }
  }

  return { results, failedUrls };
}

// ─── CWV thresholds (Google Core Web Vitals 2024) ─────────

export const CWV_THRESHOLDS = {
  lcp:  { good: 2500, needsImprovement: 4000 },  // ms
  cls:  { good: 0.1,  needsImprovement: 0.25 },  // score
  fid:  { good: 100,  needsImprovement: 300  },  // ms
  fcp:  { good: 1800, needsImprovement: 3000 },  // ms
  ttfb: { good: 800,  needsImprovement: 1800 },  // ms
} as const;

export function cwvStatus(
  metric: keyof typeof CWV_THRESHOLDS,
  value: number | null,
): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
  if (value === null) return 'unknown';
  const t = CWV_THRESHOLDS[metric];
  if (value <= t.good) return 'good';
  if (value <= t.needsImprovement) return 'needs-improvement';
  return 'poor';
}

// ─── Parser ───────────────────────────────────────────────

interface PageSpeedRawResponse {
  lighthouseResult?: {
    audits?: {
      'largest-contentful-paint'?: { numericValue?: number };
      'cumulative-layout-shift'?:  { numericValue?: number };
      'total-blocking-time'?:      { numericValue?: number };
      'first-contentful-paint'?:   { numericValue?: number };
      'server-response-time'?:     { numericValue?: number };
    };
    categories?: {
      performance?: { score?: number };
    };
  };
}

function parsePageSpeedResponse(
  url: string,
  strategy: 'mobile' | 'desktop',
  data: PageSpeedRawResponse,
): CoreWebVitals {
  const audits = data.lighthouseResult?.audits ?? {};
  const lcp  = audits['largest-contentful-paint']?.numericValue ?? null;
  const cls  = audits['cumulative-layout-shift']?.numericValue ?? null;
  const fid  = audits['total-blocking-time']?.numericValue ?? null;
  const fcp  = audits['first-contentful-paint']?.numericValue ?? null;
  const ttfb = audits['server-response-time']?.numericValue ?? null;
  const score = data.lighthouseResult?.categories?.performance?.score ?? null;

  return {
    url,
    strategy,
    lcp,
    cls,
    fid,
    fcp,
    ttfb,
    performanceScore: score !== null ? Math.round(score * 100) : null,
    passed:
      lcp !== null && cls !== null
        ? lcp < CWV_THRESHOLDS.lcp.good && cls < CWV_THRESHOLDS.cls.good
        : false,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
