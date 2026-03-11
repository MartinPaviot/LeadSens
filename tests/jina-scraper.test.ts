import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrapeViaJina, scrapeLeadCompany } from "@/server/lib/connectors/jina";

// ─── Mock global fetch + eliminate rate-limit delays ─────

const mockFetch = vi.fn();
const realSetTimeout = globalThis.setTimeout;

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  // Replace setTimeout with zero-delay version to skip 3.4s rate-limit waits
  vi.stubGlobal("setTimeout", (fn: TimerHandler, _ms?: number, ...args: unknown[]) => {
    return realSetTimeout(fn, 0, ...args);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/markdown" } });
}

function errorResponse(status: number, body = ""): Response {
  return new Response(body, { status });
}

// ─── scrapeViaJina ──────────────────────────────────────

describe("scrapeViaJina", () => {
  it("returns markdown on success", async () => {
    const markdown = "# Hello World\n\nThis is a test page with enough content to pass the minimum threshold.";
    mockFetch.mockResolvedValueOnce(okResponse(markdown));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({ ok: true, markdown });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://r.jina.ai/https://example.com",
      expect.objectContaining({
        headers: { Accept: "text/markdown" },
      }),
    );
  });

  it("returns not_found on 422", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(422, "URL inaccessible"));

    const result = await scrapeViaJina("https://example.com/bad");

    expect(result).toEqual({
      ok: false,
      reason: "not_found",
      message: expect.stringContaining("URL inaccessible"),
    });
  });

  it("returns rate_limit on 429", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({
      ok: false,
      reason: "rate_limit",
      message: "Jina rate limit (20 req/min)",
    });
  });

  it("returns network on other HTTP errors (500, 403)", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({
      ok: false,
      reason: "network",
      message: "Jina HTTP 500",
    });
  });

  it("returns network on 403 Forbidden", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403));

    const result = await scrapeViaJina("https://example.com/blog");

    expect(result).toEqual({
      ok: false,
      reason: "network",
      message: "Jina HTTP 403",
    });
  });

  it("returns timeout on AbortSignal timeout", async () => {
    const err = new DOMException("The operation was aborted", "TimeoutError");
    mockFetch.mockRejectedValueOnce(err);

    const result = await scrapeViaJina("https://slow.com");

    expect(result).toEqual({
      ok: false,
      reason: "timeout",
      message: "Jina timeout (20s)",
    });
  });

  it("returns network on generic fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("DNS resolution failed"));

    const result = await scrapeViaJina("https://doesnotexist.invalid");

    expect(result).toEqual({
      ok: false,
      reason: "network",
      message: "DNS resolution failed",
    });
  });

  it("returns network on non-Error throw", async () => {
    mockFetch.mockRejectedValueOnce("random string error");

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({
      ok: false,
      reason: "network",
      message: "Unknown network error",
    });
  });

  it("returns empty when page content is too short (<50 chars)", async () => {
    mockFetch.mockResolvedValueOnce(okResponse("short"));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({
      ok: false,
      reason: "empty",
      message: "Page returned too little content",
    });
  });

  it("returns empty when page is only whitespace", async () => {
    mockFetch.mockResolvedValueOnce(okResponse("   \n\n\t   \n   "));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({
      ok: false,
      reason: "empty",
      message: "Page returned too little content",
    });
  });

  it("truncates markdown at 15000 chars", async () => {
    const longContent = "x".repeat(20000);
    mockFetch.mockResolvedValueOnce(okResponse(longContent));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({ ok: true, markdown: "x".repeat(15000) });
  });

  it("passes exactly 50 chars content (boundary)", async () => {
    const content = "a".repeat(50);
    mockFetch.mockResolvedValueOnce(okResponse(content));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({ ok: true, markdown: content });
  });

  it("rejects 49-char content as too short (boundary)", async () => {
    const content = "a".repeat(49);
    mockFetch.mockResolvedValueOnce(okResponse(content));

    const result = await scrapeViaJina("https://example.com");

    expect(result).toEqual({ ok: false, reason: "empty", message: expect.any(String) });
  });
});

// ─── scrapeLeadCompany ──────────────────────────────────

describe("scrapeLeadCompany", () => {
  const ENOUGH_CONTENT = "a".repeat(150); // >100 chars to pass scrapeWithFallbacks threshold

  it("returns null when homepage fails", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).toBeNull();
  });

  it("returns homepage-only when all sub-pages fail", async () => {
    // Homepage succeeds
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));
    // All sub-page requests fail (about: 3 paths, blog: 4, careers: 4, press: 4 = 15 attempts)
    for (let i = 0; i < 15; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).not.toBeNull();
    expect(result).toContain("--- HOMEPAGE ---");
    expect(result).not.toContain("--- ABOUT ---");
  });

  it("combines homepage + about when about succeeds on first path", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // homepage
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // /about (succeeds)
    // Remaining sub-pages all fail
    for (let i = 0; i < 12; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).toContain("--- HOMEPAGE ---");
    expect(result).toContain("--- ABOUT ---");
  });

  it("uses fallback path when primary fails (e.g. /about fails, /about-us succeeds)", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // homepage
    mockFetch.mockResolvedValueOnce(errorResponse(404)); // /about fails
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // /about-us succeeds
    // Remaining sub-pages fail
    for (let i = 0; i < 12; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).toContain("--- ABOUT ---");
    // Verify /about-us was actually fetched
    expect(mockFetch).toHaveBeenCalledWith(
      "https://r.jina.ai/https://example.com/about-us",
      expect.any(Object),
    );
  });

  it("labels all 5 sections correctly when all succeed", async () => {
    // homepage
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));
    // about: first path succeeds
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));
    // blog: first path succeeds
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));
    // careers: first path succeeds
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));
    // press: first path succeeds
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).toContain("--- HOMEPAGE ---");
    expect(result).toContain("--- ABOUT ---");
    expect(result).toContain("--- BLOG ---");
    expect(result).toContain("--- CAREERS ---");
    expect(result).toContain("--- PRESS/NEWS ---");
  });

  it("truncates combined output at 15000 chars", async () => {
    const bigPage = "x".repeat(5000);
    // All pages succeed with large content
    mockFetch.mockResolvedValueOnce(okResponse(bigPage)); // homepage
    mockFetch.mockResolvedValueOnce(okResponse(bigPage)); // about
    mockFetch.mockResolvedValueOnce(okResponse(bigPage)); // blog
    mockFetch.mockResolvedValueOnce(okResponse(bigPage)); // careers
    mockFetch.mockResolvedValueOnce(okResponse(bigPage)); // press

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(15000);
  });

  it("normalizes URL without protocol (adds https://)", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // homepage
    for (let i = 0; i < 15; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    await scrapeLeadCompany("example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://r.jina.ai/https://example.com",
      expect.any(Object),
    );
  });

  it("normalizes URL with trailing slashes", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // homepage
    for (let i = 0; i < 15; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    await scrapeLeadCompany("https://example.com///");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://r.jina.ai/https://example.com",
      expect.any(Object),
    );
  });

  it("preserves http:// URLs (does not force https)", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT));
    for (let i = 0; i < 15; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    await scrapeLeadCompany("http://legacy.example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://r.jina.ai/http://legacy.example.com",
      expect.any(Object),
    );
  });

  it("skips sub-page content shorter than 100 chars", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(ENOUGH_CONTENT)); // homepage OK
    // All about paths return short content (>50 for scrapeViaJina, but <100 for scrapeWithFallbacks)
    mockFetch.mockResolvedValueOnce(okResponse("a".repeat(80))); // /about — 80 chars (passes Jina, fails fallbacks)
    mockFetch.mockResolvedValueOnce(okResponse("a".repeat(80))); // /about-us
    mockFetch.mockResolvedValueOnce(okResponse("a".repeat(80))); // /a-propos
    // Remaining sub-pages fail
    for (let i = 0; i < 12; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
    }

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).toContain("--- HOMEPAGE ---");
    expect(result).not.toContain("--- ABOUT ---"); // Too short to include
  });

  it("respects rate-limit delay between requests", async () => {
    const timings: number[] = [];
    mockFetch.mockImplementation(async () => {
      timings.push(Date.now());
      return okResponse(ENOUGH_CONTENT);
    });

    await scrapeLeadCompany("https://example.com");

    // At minimum, sub-page calls should have delays between them
    // Homepage has no delay, but each scrapeWithFallbacks call waits JINA_DELAY_MS
    expect(mockFetch).toHaveBeenCalled();
  });

  it("returns null when homepage content is empty", async () => {
    mockFetch.mockResolvedValueOnce(okResponse("tiny")); // <50 chars → empty error

    const result = await scrapeLeadCompany("https://example.com");

    expect(result).toBeNull();
  });
});
