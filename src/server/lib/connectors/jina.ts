const JINA_BASE = "https://r.jina.ai";
const JINA_DELAY_MS = 3400; // ~18 req/min rate limit

export interface JinaResult {
  ok: true;
  markdown: string;
}

export interface JinaError {
  ok: false;
  reason: "not_found" | "timeout" | "rate_limit" | "network" | "empty";
  message: string;
}

/**
 * Scrapes a URL via Jina Reader and returns clean markdown.
 * Returns a structured result so callers can decide how to handle failures.
 */
export async function scrapeViaJina(
  url: string,
): Promise<JinaResult | JinaError> {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: { Accept: "text/markdown" },
      signal: AbortSignal.timeout(20_000),
    });

    if (res.status === 422) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: "not_found", message: `URL inaccessible: ${body}` };
    }
    if (res.status === 429) {
      return { ok: false, reason: "rate_limit", message: "Jina rate limit (20 req/min)" };
    }
    if (!res.ok) {
      return { ok: false, reason: "network", message: `Jina HTTP ${res.status}` };
    }

    const md = await res.text();
    if (!md || md.trim().length < 50) {
      return { ok: false, reason: "empty", message: "Page returned too little content" };
    }

    return { ok: true, markdown: md.slice(0, 15000) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { ok: false, reason: "timeout", message: "Jina timeout (20s)" };
    }
    return {
      ok: false,
      reason: "network",
      message: err instanceof Error ? err.message : "Unknown network error",
    };
  }
}

// ─── Multi-page scraping for lead enrichment ──────────

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

function extractMarkdown(result: JinaResult | JinaError): string | null {
  return result.ok ? result.markdown : null;
}

async function scrapeWithFallbacks(
  baseUrl: string,
  paths: string[],
): Promise<string | null> {
  for (const path of paths) {
    await new Promise((r) => setTimeout(r, JINA_DELAY_MS));
    const md = extractMarkdown(await scrapeViaJina(`${baseUrl}${path}`));
    if (md && md.length > 100) return md;
  }
  return null;
}

const LEAD_ABOUT_PATHS = ["/about", "/about-us", "/a-propos"];
const LEAD_BLOG_PATHS = ["/blog", "/blog/", "/articles", "/resources"];
const LEAD_CAREERS_PATHS = ["/careers", "/jobs", "/recrutement", "/nous-rejoindre"];
const LEAD_PRESS_PATHS = ["/press", "/news", "/actualites", "/newsroom"];

/**
 * Multi-page scraper for lead enrichment.
 * Scrapes homepage + about + blog + careers + press (with fallbacks).
 * Returns combined markdown (max 15K chars) or null on total failure.
 */
export async function scrapeLeadCompany(url: string): Promise<string | null> {
  const baseUrl = normalizeBaseUrl(url);

  // Homepage is mandatory
  const homepageResult = await scrapeViaJina(baseUrl);
  if (!homepageResult.ok) return null;
  const homepage = homepageResult.markdown;

  // Scrape additional pages (best effort, respect rate limit)
  const about = await scrapeWithFallbacks(baseUrl, LEAD_ABOUT_PATHS);
  const blog = await scrapeWithFallbacks(baseUrl, LEAD_BLOG_PATHS);
  const careers = await scrapeWithFallbacks(baseUrl, LEAD_CAREERS_PATHS);
  const press = await scrapeWithFallbacks(baseUrl, LEAD_PRESS_PATHS);

  const sections = [
    { label: "HOMEPAGE", content: homepage },
    { label: "ABOUT", content: about },
    { label: "BLOG", content: blog },
    { label: "CAREERS", content: careers },
    { label: "PRESS/NEWS", content: press },
  ].filter((s) => s.content);

  const combined = sections
    .map((s) => `--- ${s.label} ---\n${s.content}`)
    .join("\n\n");

  return combined.slice(0, 15000);
}
