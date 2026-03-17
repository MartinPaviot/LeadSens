import { prisma } from "@/lib/prisma";
import { scrapeLeadCompany } from "@/server/lib/connectors/jina";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for successful scrapes
const CACHE_FAILED_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour for failed scrapes (null markdown)

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
 * @param workspaceId - Optional workspace ID for cache scoping
 */
export async function getOrScrapeCompany(
  domain: string,
  url: string,
  onStatus?: (msg: string) => void,
  workspaceId?: string,
): Promise<string | null> {
  // Check persistent cache (global first, then workspace-scoped)
  const cached = await prisma.companyCache.findFirst({
    where: {
      domain,
      OR: [
        { workspaceId: workspaceId ?? null },
        { workspaceId: null },
      ],
    },
    select: { markdown: true, scrapedAt: true },
    orderBy: { scrapedAt: "desc" },
  });

  if (cached) {
    const age = Date.now() - cached.scrapedAt.getTime();
    const ttl = cached.markdown === null ? CACHE_FAILED_TTL_MS : CACHE_TTL_MS;
    if (age < ttl) {
      return cached.markdown;
    }
    // Expired — will re-scrape below
  }

  // Cache miss or expired — scrape
  onStatus?.(`Scraping ${domain} (multi-page)...`);
  const markdown = await scrapeLeadCompany(url);

  // Upsert: store result (including null for failed scrapes)
  // Use domain as the unique key (shared cache — company data is public)
  await prisma.companyCache.upsert({
    where: { domain },
    create: { domain, markdown, workspaceId: workspaceId ?? null, scrapedAt: new Date() },
    update: { markdown, scrapedAt: new Date() },
  });

  return markdown;
}
