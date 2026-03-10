import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companyCache: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

// Mock Jina scraper
const mockScrapeLeadCompany = vi.fn();
vi.mock("@/server/lib/connectors/jina", () => ({
  scrapeLeadCompany: (...args: unknown[]) => mockScrapeLeadCompany(...args),
}));

// Import AFTER mocks are set up
import { getOrScrapeCompany, extractDomain } from "../src/server/lib/enrichment/company-cache";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({});
});

describe("extractDomain", () => {
  it("extracts hostname from full URL", () => {
    expect(extractDomain("https://www.acme.com/about")).toBe("www.acme.com");
  });

  it("extracts hostname without www", () => {
    expect(extractDomain("https://acme.com")).toBe("acme.com");
  });

  it("returns raw string for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("not-a-url");
  });
});

describe("getOrScrapeCompany", () => {
  const domain = "acme.com";
  const url = "https://acme.com";
  const cachedMarkdown = "--- HOMEPAGE ---\n# Acme Corp\nWe build widgets.";

  it("returns cached markdown on cache hit within TTL", async () => {
    mockFindUnique.mockResolvedValue({
      markdown: cachedMarkdown,
      scrapedAt: new Date(), // fresh
    });

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBe(cachedMarkdown);
    expect(mockScrapeLeadCompany).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns cached null on cache hit with null markdown (failed scrape)", async () => {
    mockFindUnique.mockResolvedValue({
      markdown: null,
      scrapedAt: new Date(), // fresh
    });

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBeNull();
    expect(mockScrapeLeadCompany).not.toHaveBeenCalled();
  });

  it("scrapes and caches on cache miss", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockScrapeLeadCompany.mockResolvedValue(cachedMarkdown);

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBe(cachedMarkdown);
    expect(mockScrapeLeadCompany).toHaveBeenCalledWith(url);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain },
        create: expect.objectContaining({ domain, markdown: cachedMarkdown }),
        update: expect.objectContaining({ markdown: cachedMarkdown }),
      }),
    );
  });

  it("scrapes and caches null on scrape failure", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockScrapeLeadCompany.mockResolvedValue(null);

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBeNull();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ domain, markdown: null }),
      }),
    );
  });

  it("re-scrapes on expired cache (>7 days) for successful scrapes", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      markdown: "old content",
      scrapedAt: eightDaysAgo,
    });
    mockScrapeLeadCompany.mockResolvedValue(cachedMarkdown);

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBe(cachedMarkdown);
    expect(mockScrapeLeadCompany).toHaveBeenCalledWith(url);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("does NOT re-scrape successful cache within 7-day TTL", async () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      markdown: "slightly old content",
      scrapedAt: sixDaysAgo,
    });

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBe("slightly old content");
    expect(mockScrapeLeadCompany).not.toHaveBeenCalled();
  });

  it("re-scrapes failed cache (null markdown) after 1 hour", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      markdown: null,
      scrapedAt: twoHoursAgo,
    });
    mockScrapeLeadCompany.mockResolvedValue(cachedMarkdown);

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBe(cachedMarkdown);
    expect(mockScrapeLeadCompany).toHaveBeenCalledWith(url);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("does NOT re-scrape failed cache within 1-hour TTL", async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      markdown: null,
      scrapedAt: thirtyMinAgo,
    });

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBeNull();
    expect(mockScrapeLeadCompany).not.toHaveBeenCalled();
  });

  it("re-scrapes failed cache and stores new success", async () => {
    const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      markdown: null,
      scrapedAt: ninetyMinAgo,
    });
    mockScrapeLeadCompany.mockResolvedValue("# Fresh content");

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBe("# Fresh content");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ markdown: "# Fresh content" }),
      }),
    );
  });

  it("re-scrapes failed cache but scrape fails again — caches null with fresh timestamp", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      markdown: null,
      scrapedAt: twoHoursAgo,
    });
    mockScrapeLeadCompany.mockResolvedValue(null);

    const result = await getOrScrapeCompany(domain, url);

    expect(result).toBeNull();
    expect(mockScrapeLeadCompany).toHaveBeenCalledWith(url);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ markdown: null }),
      }),
    );
  });

  it("calls onStatus callback when scraping", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockScrapeLeadCompany.mockResolvedValue(cachedMarkdown);
    const onStatus = vi.fn();

    await getOrScrapeCompany(domain, url, onStatus);

    expect(onStatus).toHaveBeenCalledWith(`Scraping ${domain} (multi-page)...`);
  });

  it("does NOT call onStatus on cache hit", async () => {
    mockFindUnique.mockResolvedValue({
      markdown: cachedMarkdown,
      scrapedAt: new Date(),
    });
    const onStatus = vi.fn();

    await getOrScrapeCompany(domain, url, onStatus);

    expect(onStatus).not.toHaveBeenCalled();
  });
});
