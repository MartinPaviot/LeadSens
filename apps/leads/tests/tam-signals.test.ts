import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jina before importing detect-signals
vi.mock("@/server/lib/connectors/jina", () => ({
  scrapeViaJina: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { detectAllSignals, type ApolloOrgData, type ApolloPersonData } from "@/server/lib/tam/detect-signals";
import { scrapeViaJina } from "@/server/lib/connectors/jina";

const mockScrape = vi.mocked(scrapeViaJina);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Hiring Outbound ─────────────────────────────────────

describe("TAM detect-signals: Hiring Outbound", () => {
  it("detects SDR hiring from careers page", async () => {
    mockScrape.mockResolvedValue({
      ok: true,
      markdown: `# Careers\n\nOpen positions:\n- Senior SDR\n- Sales Development Representative\n- Account Executive\n`,
    });

    const signals = await detectAllSignals("acme.com");
    const hiring = signals.find((s) => s.name === "Hiring Outbound");
    expect(hiring?.detected).toBe(true);
    expect(hiring?.points).toBeGreaterThan(0);
    expect(hiring?.evidence).toContain("sales role");
  });

  it("returns false when no sales roles found", async () => {
    mockScrape.mockResolvedValue({
      ok: true,
      markdown: `# Careers\n\nOpen positions:\n- Software Engineer\n- Product Designer\n`,
    });

    const signals = await detectAllSignals("acme.com");
    const hiring = signals.find((s) => s.name === "Hiring Outbound");
    expect(hiring?.detected).toBe(false);
  });

  it("handles scrape failure gracefully", async () => {
    mockScrape.mockResolvedValue({
      ok: false,
      reason: "not_found" as const,
      message: "Not found",
    });

    const signals = await detectAllSignals("acme.com");
    const hiring = signals.find((s) => s.name === "Hiring Outbound");
    expect(hiring?.detected).toBe(false);
    expect(hiring?.points).toBe(0);
  });
});

// ─── Recent Funding ──────────────────────────────────────

describe("TAM detect-signals: Recent Funding", () => {
  it("detects funding < 12 months ago", async () => {
    // Need to mock scrape for the parallel calls
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const orgData: ApolloOrgData = {
      latestFundingRoundDate: sixMonthsAgo.toISOString(),
      fundingTotal: "$10M",
    };

    const signals = await detectAllSignals("acme.com", orgData);
    const funding = signals.find((s) => s.name === "Recent Funding");
    expect(funding?.detected).toBe(true);
    expect(funding?.points).toBeGreaterThanOrEqual(7);
  });

  it("rejects funding > 12 months ago", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const orgData: ApolloOrgData = {
      latestFundingRoundDate: twoYearsAgo.toISOString(),
    };

    const signals = await detectAllSignals("acme.com", orgData);
    const funding = signals.find((s) => s.name === "Recent Funding");
    expect(funding?.detected).toBe(false);
  });
});

// ─── Tech Stack Fit ──────────────────────────────────────

describe("TAM detect-signals: Tech Stack Fit", () => {
  it("detects relevant technologies", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const orgData: ApolloOrgData = {
      technologies: ["Salesforce", "HubSpot", "Stripe", "Intercom"],
    };

    const signals = await detectAllSignals("acme.com", orgData);
    const tech = signals.find((s) => s.name === "Tech Stack Fit");
    expect(tech?.detected).toBe(true);
    expect(tech?.points).toBeGreaterThan(0);
  });

  it("returns false when no relevant tech", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const orgData: ApolloOrgData = {
      technologies: ["MySQL", "Redis"],
    };

    const signals = await detectAllSignals("acme.com", orgData);
    const tech = signals.find((s) => s.name === "Tech Stack Fit");
    expect(tech?.detected).toBe(false);
  });
});

// ─── New in Role ─────────────────────────────────────────

describe("TAM detect-signals: New in Role", () => {
  it("detects job change < 90 days", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const personData: ApolloPersonData = {
      employmentStartDate: thirtyDaysAgo.toISOString(),
    };

    const signals = await detectAllSignals("acme.com", undefined, personData);
    const newRole = signals.find((s) => s.name === "New in Role");
    expect(newRole?.detected).toBe(true);
    expect(newRole?.points).toBe(5); // <= 30 days = 5 points
  });

  it("rejects job change > 90 days", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

    const personData: ApolloPersonData = {
      employmentStartDate: sixMonthsAgo.toISOString(),
    };

    const signals = await detectAllSignals("acme.com", undefined, personData);
    const newRole = signals.find((s) => s.name === "New in Role");
    expect(newRole?.detected).toBe(false);
  });
});

// ─── All 5 signals returned ──────────────────────────────

describe("TAM detect-signals: always returns 5 signals", () => {
  it("returns 5 signal results even with no data", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "not_found" as const, message: "nope" });

    const signals = await detectAllSignals("acme.com");
    expect(signals).toHaveLength(5);
    expect(signals.map((s) => s.name)).toEqual([
      "Hiring Outbound",
      "Sales-Led Growth",
      "Recent Funding",
      "Tech Stack Fit",
      "New in Role",
    ]);
  });
});
