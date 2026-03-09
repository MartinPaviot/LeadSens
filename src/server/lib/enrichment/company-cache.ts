import { prisma } from "@/lib/prisma";
import { scrapeLeadCompany } from "@/server/lib/connectors/jina";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Extracts the hostname from a URL for use as the cache key.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Gets cached company markdown or scrapes & caches it.
 * Returns `null` if the scrape failed (also cached to avoid retrying bad domains within TTL).
 *
 * @param domain - Hostname used as cache key (e.g. "acme.com")
 * @param url - Full URL to scrape if cache miss
 * @param onStatus - Optional status callback for UI updates
 */
export async function getOrScrapeCompany(
  domain: string,
  url: string,
  onStatus?: (msg: string) => void,
): Promise<string | null> {
  // Check persistent cache
  const cached = await prisma.companyCache.findUnique({
    where: { domain },
    select: { markdown: true, scrapedAt: true },
  });

  if (cached) {
    const age = Date.now() - cached.scrapedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return cached.markdown;
    }
    // Expired — will re-scrape below
  }

  // Cache miss or expired — scrape
  onStatus?.(`Scraping ${domain} (multi-page)...`);
  const markdown = await scrapeLeadCompany(url);

  // Upsert: store result (including null for failed scrapes)
  await prisma.companyCache.upsert({
    where: { domain },
    create: { domain, markdown, scrapedAt: new Date() },
    update: { markdown, scrapedAt: new Date() },
  });

  return markdown;
}
