import { describe, it, expect } from "vitest";
import { extractFlatEnrichmentFields, type EnrichmentData } from "../src/server/lib/enrichment/summarizer";

function makeEnrichment(overrides: Partial<EnrichmentData> = {}): EnrichmentData {
  return {
    companySummary: null,
    products: [],
    targetMarket: null,
    valueProposition: null,
    painPoints: [],
    recentNews: [],
    techStack: [],
    teamSize: null,
    signals: [],
    hiringSignals: [],
    fundingSignals: [],
    productLaunches: [],
    leadershipChanges: [],
    publicPriorities: [],
    techStackChanges: [],
    linkedinHeadline: null,
    recentLinkedInPosts: [],
    careerHistory: [],
    industry: null,
    enrichmentContext: null,
    enrichmentLinkedin: null,
    enrichmentSignals: null,
    enrichmentDiagnostic: null,
    ...overrides,
  };
}

describe("extractFlatEnrichmentFields", () => {
  it("returns all nulls for empty enrichment", () => {
    const result = extractFlatEnrichmentFields(makeEnrichment());
    expect(result.companyPositioning).toBeNull();
    expect(result.companyOneLiner).toBeNull();
    expect(result.companyDescription).toBeNull();
    expect(result.painPointsFlat).toBeNull();
    expect(result.productsFlat).toBeNull();
    expect(result.valueProp).toBeNull();
    expect(result.targetCustomers).toBeNull();
    expect(result.buyingSignals).toBeNull();
    expect(result.techStackFlat).toBeNull();
    expect(result.linkedinHeadline).toBeNull();
    expect(result.careerHistory).toBeNull();
    expect(result.recentPosts).toBeNull();
  });

  it("extracts companyPositioning from industry", () => {
    const result = extractFlatEnrichmentFields(makeEnrichment({ industry: "SaaS" }));
    expect(result.companyPositioning).toBe("SaaS");
  });

  it("extracts first sentence as companyOneLiner", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ companySummary: "Acme builds widgets. They sell worldwide. Founded in 2020." }),
    );
    expect(result.companyOneLiner).toBe("Acme builds widgets.");
  });

  it("handles companySummary without period (single sentence)", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ companySummary: "Acme builds widgets" }),
    );
    // No sentence-ending punctuation followed by space — split returns the whole string
    expect(result.companyOneLiner).toBe("Acme builds widgets.");
  });

  it("handles companySummary ending with exclamation", () => {
    // Split on /[.!?]\s/ consumes the punctuation — first segment is "Acme is amazing"
    // Then "." is appended → "Acme is amazing."
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ companySummary: "Acme is amazing! They do great things." }),
    );
    expect(result.companyOneLiner).toBe("Acme is amazing.");
  });

  it("prefers enrichmentContext for companyDescription", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({
        enrichmentContext: "Detailed context here",
        companySummary: "Short summary",
      }),
    );
    expect(result.companyDescription).toBe("Detailed context here");
  });

  it("falls back to companySummary for companyDescription", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ companySummary: "Short summary" }),
    );
    expect(result.companyDescription).toBe("Short summary");
  });

  it("joins painPoints with semicolons", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ painPoints: ["Slow onboarding", "High churn", "Low NPS"] }),
    );
    expect(result.painPointsFlat).toBe("Slow onboarding; High churn; Low NPS");
  });

  it("joins products with semicolons", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ products: ["CRM", "Analytics"] }),
    );
    expect(result.productsFlat).toBe("CRM; Analytics");
  });

  it("extracts valueProp from valueProposition", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ valueProposition: "AI-powered sales automation" }),
    );
    expect(result.valueProp).toBe("AI-powered sales automation");
  });

  it("extracts targetCustomers from targetMarket", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ targetMarket: "Mid-market SaaS companies" }),
    );
    expect(result.targetCustomers).toBe("Mid-market SaaS companies");
  });

  it("joins techStack with semicolons", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ techStack: ["React", "Node.js", "PostgreSQL"] }),
    );
    expect(result.techStackFlat).toBe("React; Node.js; PostgreSQL");
  });

  it("extracts linkedinHeadline", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ linkedinHeadline: "VP Sales at Acme" }),
    );
    expect(result.linkedinHeadline).toBe("VP Sales at Acme");
  });

  it("joins careerHistory with semicolons", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ careerHistory: ["VP Sales at Acme (2023-present)", "Director at BigCo (2020-2023)"] }),
    );
    expect(result.careerHistory).toBe("VP Sales at Acme (2023-present); Director at BigCo (2020-2023)");
  });

  it("joins recentLinkedInPosts with semicolons", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({ recentLinkedInPosts: ["Post about AI", "Post about sales"] }),
    );
    expect(result.recentPosts).toBe("Post about AI; Post about sales");
  });

  it("merges all signal types into buyingSignals", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({
        signals: ["Expanding APAC"],
        hiringSignals: ["Hiring 5 SDRs"],
        fundingSignals: ["Series B $20M"],
        productLaunches: ["Launched v3.0"],
        leadershipChanges: [{ event: "New CRO: Jane Doe", date: "2026-01", source: "press" }],
        publicPriorities: [{ statement: "CEO: 2x revenue in 2026", date: "2026-02", source: "blog" }],
        techStackChanges: [{ change: "Migrated to HubSpot", date: "2025-Q4" }],
      }),
    );
    expect(result.buyingSignals).toBe(
      "Expanding APAC; Hiring 5 SDRs; Series B $20M; Launched v3.0; New CRO: Jane Doe; CEO: 2x revenue in 2026; Migrated to HubSpot",
    );
  });

  it("returns null buyingSignals when all signal arrays are empty", () => {
    const result = extractFlatEnrichmentFields(makeEnrichment());
    expect(result.buyingSignals).toBeNull();
  });

  it("handles a fully populated enrichment", () => {
    const result = extractFlatEnrichmentFields(
      makeEnrichment({
        industry: "FinTech",
        companySummary: "FinCo provides payments. Global leader.",
        enrichmentContext: "FinCo is a B2B payments platform serving enterprise clients.",
        painPoints: ["Manual reconciliation"],
        products: ["PaymentOS"],
        valueProposition: "Automated payment reconciliation",
        targetMarket: "Enterprise finance teams",
        techStack: ["AWS", "Python"],
        signals: ["Growing 40% YoY"],
        hiringSignals: [],
        fundingSignals: [],
        productLaunches: [],
        leadershipChanges: [],
        publicPriorities: [],
        techStackChanges: [],
        linkedinHeadline: "CFO at FinCo",
        careerHistory: ["CFO at FinCo"],
        recentLinkedInPosts: ["Excited about Q4 results"],
      }),
    );

    expect(result.companyPositioning).toBe("FinTech");
    expect(result.companyOneLiner).toBe("FinCo provides payments.");
    expect(result.companyDescription).toBe("FinCo is a B2B payments platform serving enterprise clients.");
    expect(result.painPointsFlat).toBe("Manual reconciliation");
    expect(result.productsFlat).toBe("PaymentOS");
    expect(result.valueProp).toBe("Automated payment reconciliation");
    expect(result.targetCustomers).toBe("Enterprise finance teams");
    expect(result.buyingSignals).toBe("Growing 40% YoY");
    expect(result.techStackFlat).toBe("AWS; Python");
    expect(result.linkedinHeadline).toBe("CFO at FinCo");
    expect(result.careerHistory).toBe("CFO at FinCo");
    expect(result.recentPosts).toBe("Excited about Q4 results");
  });
});
