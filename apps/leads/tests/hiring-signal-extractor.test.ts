import { describe, it, expect } from "vitest";
import {
  extractCareersSection,
  extractJobTitles,
  extractHiringSignals,
  mergeHiringSignals,
} from "@/server/lib/enrichment/hiring-signal-extractor";
import { enhanceWithCareersSignals } from "@/server/lib/tools/enrichment-tools";
import type { StructuredSignal, EnrichmentData } from "@/server/lib/enrichment/summarizer";

// ─── extractCareersSection ──────────────────────────────

describe("extractCareersSection", () => {
  it("extracts careers section from combined markdown", () => {
    const md = [
      "--- HOMEPAGE ---",
      "Welcome to Acme Inc",
      "",
      "--- CAREERS ---",
      "Join our team! We are hiring Senior Engineers.",
      "Open positions: Backend Developer, Product Manager",
      "",
      "--- PRESS/NEWS ---",
      "Acme raises $10M Series A",
    ].join("\n");

    const result = extractCareersSection(md);
    expect(result).toContain("Join our team");
    expect(result).toContain("Backend Developer");
    expect(result).not.toContain("Welcome to Acme");
    expect(result).not.toContain("raises $10M");
  });

  it("returns null when no careers section exists", () => {
    const md = "--- HOMEPAGE ---\nWelcome\n--- ABOUT ---\nAbout us";
    expect(extractCareersSection(md)).toBeNull();
  });

  it("returns null for very short careers sections", () => {
    const md = "--- CAREERS ---\nShort\n--- PRESS/NEWS ---\nNews";
    expect(extractCareersSection(md)).toBeNull();
  });

  it("handles careers as last section (no trailing marker)", () => {
    const md = "--- HOMEPAGE ---\nWelcome\n--- CAREERS ---\nWe are hiring Software Engineers and Product Designers.";
    const result = extractCareersSection(md);
    expect(result).toContain("Software Engineers");
  });
});

// ─── extractJobTitles ───────────────────────────────────

describe("extractJobTitles", () => {
  it("extracts standard job titles from list items", () => {
    const md = [
      "- Senior Software Engineer",
      "- Product Manager",
      "- UX Designer",
      "- Data Scientist",
    ].join("\n");

    const titles = extractJobTitles(md);
    expect(titles).toContain("Senior Software Engineer");
    expect(titles).toContain("Product Manager");
    expect(titles).toContain("Data Scientist");
  });

  it("extracts titles with bullet characters", () => {
    const md = [
      "• Lead Backend Developer",
      "* Frontend Engineer",
      "– DevOps Specialist",
    ].join("\n");

    const titles = extractJobTitles(md);
    expect(titles).toContain("Lead Backend Developer");
    expect(titles).toContain("Frontend Engineer");
  });

  it("extracts titles from 'hiring' patterns", () => {
    const md = "We're hiring a Senior Product Designer to join our team.";
    const titles = extractJobTitles(md);
    expect(titles.some((t) => t.includes("Product Designer"))).toBe(true);
  });

  it("filters out navigation/false positive titles", () => {
    const md = [
      "About Our Company",
      "Join Our Team",
      "- Senior Software Engineer",
      "Learn More",
      "View All Positions",
    ].join("\n");

    const titles = extractJobTitles(md);
    expect(titles).not.toContain("About Our Company");
    expect(titles).not.toContain("Learn More");
    expect(titles).toContain("Senior Software Engineer");
  });

  it("deduplicates identical titles", () => {
    const md = [
      "- Software Engineer",
      "- Software Engineer",
      "- Software Engineer",
    ].join("\n");

    const titles = extractJobTitles(md);
    expect(titles.filter((t) => t === "Software Engineer")).toHaveLength(1);
  });

  it("handles empty / minimal input", () => {
    expect(extractJobTitles("")).toHaveLength(0);
    expect(extractJobTitles("No jobs here")).toHaveLength(0);
  });
});

// ─── extractHiringSignals ───────────────────────────────

describe("extractHiringSignals", () => {
  it("returns empty for empty/short input", () => {
    expect(extractHiringSignals("")).toHaveLength(0);
    expect(extractHiringSignals("short")).toHaveLength(0);
  });

  it("extracts hiring scope signal with role count", () => {
    const md = [
      "Join Acme Inc! We're growing fast.",
      "- Senior Backend Engineer",
      "- Product Manager",
      "- UX Designer",
      "- Data Analyst",
    ].join("\n");

    const signals = extractHiringSignals(md);
    expect(signals.length).toBeGreaterThanOrEqual(1);
    const scopeSignal = signals.find((s) => s.detail.startsWith("Hiring"));
    expect(scopeSignal).toBeDefined();
    expect(scopeSignal!.detail).toMatch(/Hiring \d+ roles/);
    expect(scopeSignal!.source).toBe("careers page");
    expect(scopeSignal!.date).toBeNull();
  });

  it("extracts specific role titles", () => {
    const md = [
      "Open positions:",
      "- Senior Backend Engineer",
      "- Frontend Developer",
      "- Staff Software Architect",
    ].join("\n");

    const signals = extractHiringSignals(md);
    const titleSignal = signals.find((s) => s.detail.startsWith("Open positions:"));
    expect(titleSignal).toBeDefined();
    expect(titleSignal!.detail).toContain("Senior Backend Engineer");
  });

  it("detects growth language", () => {
    const md = [
      "We are rapidly growing our engineering team.",
      "- Software Engineer",
      "- QA Engineer",
    ].join("\n");

    const signals = extractHiringSignals(md);
    const growthSignal = signals.find((s) =>
      s.detail.toLowerCase().includes("growing"),
    );
    expect(growthSignal).toBeDefined();
  });

  it("detects multi-department hiring as strong growth signal", () => {
    const md = [
      "Join our team across multiple departments:",
      "- Senior Sales Representative",
      "- Marketing Manager",
      "- Software Engineer",
      "- Product Designer",
      "- Customer Success Manager",
      "- Data Analyst",
    ].join("\n");

    const signals = extractHiringSignals(md);
    const deptSignal = signals.find((s) => s.detail.includes("departments"));
    expect(deptSignal).toBeDefined();
    expect(deptSignal!.detail).toMatch(/\d+ departments/);
  });

  it("detects seniority levels being recruited", () => {
    const md = [
      "- Senior Software Engineer",
      "- Lead Product Designer",
      "- Director of Engineering",
    ].join("\n");

    const signals = extractHiringSignals(md);
    const scopeSignal = signals.find((s) => s.detail.startsWith("Hiring"));
    expect(scopeSignal).toBeDefined();
    expect(scopeSignal!.detail).toMatch(/(senior|lead|director)/i);
  });

  it("caps role titles at 5 in the detail", () => {
    const md = [
      "- Backend Engineer",
      "- Frontend Developer",
      "- DevOps Specialist",
      "- Product Manager",
      "- UX Designer",
      "- Data Scientist",
      "- QA Engineer",
    ].join("\n");

    const signals = extractHiringSignals(md);
    const titleSignal = signals.find((s) => s.detail.startsWith("Open positions:"));
    expect(titleSignal).toBeDefined();
    expect(titleSignal!.detail).toContain("+");
  });

  it("detects open positions count pattern", () => {
    const md = [
      "We have 15 open positions across the company.",
      "- Software Engineer",
      "- Product Manager",
    ].join("\n");

    const signals = extractHiringSignals(md);
    const countSignal = signals.find((s) => s.detail.includes("15"));
    expect(countSignal).toBeDefined();
  });
});

// ─── mergeHiringSignals ─────────────────────────────────

describe("mergeHiringSignals", () => {
  const makeSignal = (detail: string, source: string | null = null): StructuredSignal => ({
    detail,
    date: null,
    source,
  });

  it("returns extracted signals when LLM has none", () => {
    const extracted = [makeSignal("Hiring 3 roles", "careers page")];
    expect(mergeHiringSignals([], extracted)).toEqual(extracted);
  });

  it("returns LLM signals when no extracted signals", () => {
    const llm = [makeSignal("Expanding team", "careers page")];
    expect(mergeHiringSignals(llm, [])).toEqual(llm);
  });

  it("merges non-overlapping signals", () => {
    const llm = [makeSignal("Funding round $10M", "press release")];
    const extracted = [makeSignal("Hiring 5 roles across engineering", "careers page")];
    const merged = mergeHiringSignals(llm, extracted);
    expect(merged).toHaveLength(2);
  });

  it("deduplicates similar careers-sourced signals", () => {
    const llm = [makeSignal("Hiring Senior Backend Engineer and Frontend Developer", "careers page")];
    const extracted = [makeSignal("Open positions: Senior Backend Engineer, Frontend Developer", "careers page")];
    const merged = mergeHiringSignals(llm, extracted);
    // Should deduplicate because they share key words from same source
    expect(merged.length).toBeLessThan(3);
  });

  it("keeps distinct signals from same source", () => {
    const llm = [makeSignal("Team doubled in Q4", "careers page")];
    const extracted = [makeSignal("Expanding across 4 departments: engineering, sales, marketing, product", "careers page")];
    const merged = mergeHiringSignals(llm, extracted);
    expect(merged).toHaveLength(2);
  });
});

// ─── enhanceWithCareersSignals (integration) ────────────

describe("enhanceWithCareersSignals", () => {
  const baseEnrichment: EnrichmentData = {
    companySummary: "Acme builds widgets",
    products: ["Widget Pro"],
    targetMarket: "Enterprise",
    valueProposition: "Best widgets",
    painPoints: ["scaling"],
    recentNews: [],
    techStack: ["React"],
    teamSize: "50-100",
    signals: [],
    hiringSignals: [{ detail: "Recruiting 2 engineers", date: "2026-01", source: "LinkedIn" }],
    fundingSignals: [],
    productLaunches: [],
    leadershipChanges: [],
    publicPriorities: [],
    techStackChanges: [],
    linkedinHeadline: null,
    recentLinkedInPosts: [],
    careerHistory: [],
    industry: "SaaS",
    enrichmentContext: null,
    enrichmentLinkedin: null,
    enrichmentSignals: null,
    enrichmentDiagnostic: null,
  };

  it("enhances enrichment data with careers signals", () => {
    const markdown = [
      "--- HOMEPAGE ---",
      "Welcome to Acme",
      "",
      "--- CAREERS ---",
      "Join our rapidly growing team!",
      "- Senior Backend Developer",
      "- Product Manager",
      "- DevOps Engineer",
      "",
      "--- PRESS/NEWS ---",
      "Acme in the news",
    ].join("\n");

    const enhanced = enhanceWithCareersSignals(baseEnrichment, markdown);
    // Should have original LLM signal + extracted signals
    expect(enhanced.hiringSignals.length).toBeGreaterThan(baseEnrichment.hiringSignals.length);
    // Original signal preserved
    expect(enhanced.hiringSignals.some((s) => s.detail === "Recruiting 2 engineers")).toBe(true);
    // New extracted signals added
    expect(enhanced.hiringSignals.some((s) => s.source === "careers page")).toBe(true);
  });

  it("returns unchanged data when no careers section", () => {
    const markdown = "--- HOMEPAGE ---\nWelcome to Acme";
    const result = enhanceWithCareersSignals(baseEnrichment, markdown);
    expect(result).toEqual(baseEnrichment);
  });

  it("preserves all non-hiringSignals fields", () => {
    const markdown = "--- CAREERS ---\n- Senior Software Engineer\n- Product Designer\n- Data Analyst";
    const result = enhanceWithCareersSignals(baseEnrichment, markdown);
    expect(result.companySummary).toBe(baseEnrichment.companySummary);
    expect(result.industry).toBe(baseEnrichment.industry);
    expect(result.fundingSignals).toEqual(baseEnrichment.fundingSignals);
    expect(result.products).toEqual(baseEnrichment.products);
  });
});
