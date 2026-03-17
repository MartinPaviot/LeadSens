import { describe, it, expect } from "vitest";
import { findBestMatches, findPortfolioMatches } from "@/server/lib/email/industry-taxonomy";

// ─── Test helpers ──────────────────────────────────────

const makeSocialProof = (
  industry: string,
  vertical?: string | null,
  companySize?: string | null,
) => ({
  industry,
  vertical: vertical ?? null,
  companySize: companySize ?? null,
  clients: ["Acme"],
  keyMetric: "+50%",
});

// ─── findBestMatches ───────────────────────────────────

describe("findBestMatches", () => {
  const items = [
    makeSocialProof("SaaS", "HR Tech", "enterprise"),
    makeSocialProof("FinTech", "InsurTech", "mid-market"),
    makeSocialProof("Healthcare", null, "startup"),
    makeSocialProof("E-commerce", "D2C", "smb"),
    makeSocialProof("Manufacturing", null, null),
  ];

  it("returns exact match (same industry + vertical) with highest score", () => {
    const results = findBestMatches(items, "SaaS", "HR Tech");
    expect(results[0].item.industry).toBe("SaaS");
    expect(results[0].score).toBe(100);
    expect(results[0].matchType).toBe("exact");
  });

  it("returns vertical match (same industry, no vertical specified) with score 80", () => {
    const results = findBestMatches(items, "SaaS");
    expect(results[0].item.industry).toBe("SaaS");
    expect(results[0].score).toBe(80);
    expect(results[0].matchType).toBe("vertical");
  });

  it("returns parent match when prospect is in a sub-vertical", () => {
    // "HR Tech" has parent "SaaS", so matching "HR Tech" against "SaaS" should give parent match
    const results = findBestMatches(items, "HR Tech");
    // The SaaS entry should match as parent
    const saasMatch = results.find((r) => r.item.industry === "SaaS");
    expect(saasMatch).toBeDefined();
    expect(saasMatch!.score).toBeGreaterThanOrEqual(60);
    expect(saasMatch!.matchType).toBe("parent");
  });

  it("returns adjacent match for related industries", () => {
    // "Retail" is adjacent to "E-commerce"
    const results = findBestMatches(items, "Retail");
    const ecomMatch = results.find((r) => r.item.industry === "E-commerce");
    expect(ecomMatch).toBeDefined();
    expect(ecomMatch!.score).toBe(40);
    expect(ecomMatch!.matchType).toBe("adjacent");
  });

  it("returns fallback (score 10) when no taxonomy match exists", () => {
    const results = findBestMatches(items, "Nonprofit");
    // None of the items are in Nonprofit or adjacent to it
    const top = results[0];
    expect(top.score).toBeLessThanOrEqual(20); // 10 + maybe size tiebreaker
    expect(top.matchType).toBe("fallback");
  });

  it("adds +10 tiebreaker for matching company size", () => {
    const results = findBestMatches(items, "FinTech", null, "mid-market");
    const finMatch = results.find((r) => r.item.industry === "FinTech");
    expect(finMatch).toBeDefined();
    // 80 (vertical match) + 10 (size) = 90
    expect(finMatch!.score).toBe(90);
  });

  it("handles null prospect industry gracefully", () => {
    const results = findBestMatches(items, null);
    expect(results.length).toBe(items.length);
    // All should be fallback
    for (const r of results) {
      expect(r.matchType).toBe("fallback");
    }
  });

  it("handles empty items array", () => {
    const results = findBestMatches([], "SaaS");
    expect(results).toEqual([]);
  });

  it("sorts results by score descending", () => {
    const results = findBestMatches(items, "SaaS", "HR Tech", "enterprise");
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("handles case-insensitive matching", () => {
    const results = findBestMatches(items, "saas");
    expect(results[0].item.industry).toBe("SaaS");
    expect(results[0].score).toBe(80);
  });

  it("handles partial string matching (e.g. 'HR Technology' → 'HR Tech')", () => {
    const results = findBestMatches(items, "HR Technology");
    // Should resolve to HR Tech via partial match
    const saasMatch = results.find((r) => r.item.industry === "SaaS");
    expect(saasMatch).toBeDefined();
    expect(saasMatch!.score).toBeGreaterThanOrEqual(60);
  });

  it("matches sibling verticals through shared parent", () => {
    // "MarTech" and "HR Tech" both have parent "SaaS"
    const marTechItems = [makeSocialProof("SaaS", "MarTech")];
    const results = findBestMatches(marTechItems, "HR Tech");
    // Both under SaaS → parent match
    expect(results[0].score).toBeGreaterThanOrEqual(60);
  });
});

// ─── findPortfolioMatches ──────────────────────────────

describe("findPortfolioMatches", () => {
  const portfolio = [
    { name: "Stripe", industry: "FinTech", vertical: "Payments" },
    { name: "HubSpot", industry: "SaaS", vertical: "MarTech" },
    { name: "Zendesk", industry: "SaaS", vertical: "Customer Success" },
    { name: "Nike", industry: "Retail", vertical: null },
    { name: "Acme Corp", industry: null, vertical: null },
  ];

  it("returns clients in the same industry", () => {
    const matches = findPortfolioMatches(portfolio, "SaaS");
    expect(matches).toContain("HubSpot");
    expect(matches).toContain("Zendesk");
  });

  it("returns clients in adjacent industries", () => {
    // E-commerce is adjacent to Retail
    const matches = findPortfolioMatches(portfolio, "E-commerce");
    expect(matches).toContain("Nike");
  });

  it("filters out low-score matches (below 40)", () => {
    const matches = findPortfolioMatches(portfolio, "Healthcare");
    // None of the portfolio items are in Healthcare or adjacent
    expect(matches).not.toContain("Stripe");
    expect(matches).not.toContain("Nike");
  });

  it("returns empty array when no prospect industry", () => {
    const matches = findPortfolioMatches(portfolio, null);
    expect(matches).toEqual([]);
  });

  it("returns empty array for empty portfolio", () => {
    const matches = findPortfolioMatches([], "SaaS");
    expect(matches).toEqual([]);
  });

  it("handles clients with null industry gracefully", () => {
    const matches = findPortfolioMatches(portfolio, "SaaS");
    // "Acme Corp" has null industry, should not appear
    expect(matches).not.toContain("Acme Corp");
  });
});
